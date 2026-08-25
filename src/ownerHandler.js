import { getQuotedMessageId } from './routingService.js';

export async function handleOwnerMessage({ sock, message, storage, config, log }) {
  const text = extractText(message.message);
  if (text?.startsWith('.')) {
    await handleCommand({ sock, message, text, storage, config });
    return true;
  }
  const quotedId = getQuotedMessageId(message);
  if (!quotedId) return false;
  const mapping = storage.getMapping(quotedId);
  if (!mapping) {
    await sock.sendMessage(config.ownerJid, { text: '⚠️ Pesan ini sudah tidak dapat diroute karena mapping telah expired atau tidak dikenal.' }, { quoted: message });
    return true;
  }
  try {
    const payload = ownerPayload(message.message, text);
    if (!payload) {
      await sock.sendMessage(config.ownerJid, { text: '⚠️ Jenis balasan ini belum didukung. Kirim teks sebagai Reply.' }, { quoted: message });
      return true;
    }
    await sock.sendMessage(mapping.senderJid, payload);
    log('OWNER_REPLY', { target: mapping.senderJid, status: 'SENT' });
  } catch (error) {
    log('ERROR', { event: 'owner_reply', error: error.message });
    await sock.sendMessage(config.ownerJid, { text: '⚠️ Balasan gagal dikirim. Silakan coba lagi.' }, { quoted: message }).catch(() => undefined);
  }
  return true;
}

function extractText(content = {}) { return content.conversation ?? content.extendedTextMessage?.text ?? null; }
function ownerPayload(content, text) {
  if (text) return { text };
  return null;
}

async function handleCommand({ sock, message, text, storage, config }) {
  const command = text.trim().toLowerCase();
  let response;
  if (command === '.autoreply on' || command === '.autoreply off') {
    const enabled = command.endsWith('on'); await storage.updateSettings({ autoReplyEnabled: enabled }); response = `🤖 Auto reply: ${enabled ? 'ENABLED' : 'DISABLED'}`;
  } else if (command === '.notify on' || command === '.notify off') {
    const enabled = command.endsWith('on'); await storage.updateSettings({ notifyOwnerEnabled: enabled }); response = `📩 Notifikasi owner: ${enabled ? 'ENABLED' : 'DISABLED'}`;
  } else if (command === '.autoreply status') {
    const s = storage.settings; response = `🤖 AUTO REPLY STATUS\n\nStatus: ${s.autoReplyEnabled ? 'ENABLED' : 'DISABLED'}\nDelay: ${s.autoReplyMinDelay / 1000}s sampai ${s.autoReplyMaxDelay / 1000}s\nCooldown: ${Math.round(s.autoReplyCooldown / 60000)} menit`;
  } else if (command === '.notify status') {
    response = `📩 NOTIFIKASI OWNER\n\nStatus: ${storage.settings.notifyOwnerEnabled ? 'ENABLED' : 'DISABLED'}`;
  } else if (command === '.bot status') {
    response = `🤖 BOT STATUS\n\nKoneksi: aktif\nAuto reply: ${storage.settings.autoReplyEnabled ? 'ENABLED' : 'DISABLED'}\nNotifikasi: ${storage.settings.notifyOwnerEnabled ? 'ENABLED' : 'DISABLED'}`;
  } else if (command === '.group list') {
    try {
      const groups = Object.values(await sock.groupFetchAllParticipating());
      response = groups.length
        ? `👥 GRUP YANG TERHUBUNG\n\n${groups.map((group) => `• ${group.subject || 'Tanpa nama'}\n  ${group.id}`).join('\n\n')}\n\nKirim: .group send <ID_GRUP> | <pesan>`
        : '👥 Bot belum menjadi anggota grup mana pun.';
    } catch (error) {
      response = '⚠️ Daftar grup tidak dapat diambil. Pastikan bot masih terhubung.';
    }
  } else if (text.trim().toLowerCase().startsWith('.group send ')) {
    const input = text.trim().slice('.group send '.length);
    const separator = input.indexOf('|');
    const groupJid = input.slice(0, separator).trim();
    const groupText = input.slice(separator + 1).trim();
    if (separator < 1 || !groupJid.endsWith('@g.us') || !groupText) {
      response = '⚠️ Format: .group send <ID_GRUP> | <pesan>\nGunakan .group list untuk melihat ID grup.';
    } else {
      try {
        const groups = await sock.groupFetchAllParticipating();
        if (!groups[groupJid]) {
          response = '⚠️ ID grup tidak ditemukan atau bot bukan anggota grup tersebut.';
        } else {
          await sock.sendMessage(groupJid, { text: groupText });
          response = '✅ Pesan berhasil dikirim ke grup.';
        }
      } catch (error) {
        response = '⚠️ Pesan grup gagal dikirim. Periksa koneksi dan keanggotaan bot.';
      }
    }
  } else if (text.trim().toLowerCase().startsWith('.send ')) {
    const input = text.trim().slice('.send '.length);
    const separator = input.indexOf('|');
    const target = normalizeTarget(input.slice(0, separator));
    const messageText = input.slice(separator + 1).trim();
    if (separator < 1 || !target || !messageText) {
      response = '⚠️ Format: .send <nomor_tujuan> | <pesan>\nContoh: .send 628123456789 | Halo, ini pesan dari Mike.';
    } else {
      try {
        await sock.sendMessage(`${target}@s.whatsapp.net`, { text: messageText });
        response = '✅ Pesan berhasil dikirim.';
      } catch (error) {
        response = '⚠️ Pesan gagal dikirim. Periksa nomor tujuan dan koneksi bot.';
      }
    }
  } else if (text.trim().toLowerCase().startsWith('.copy ')) {
    const target = normalizeTarget(text.trim().slice('.copy '.length));
    const copiedText = extractQuotedText(message.message);
    if (!target) {
      response = '⚠️ Nomor tujuan tidak valid. Contoh: .copy 628123456789';
    } else if (!copiedText) {
      response = '⚠️ Balas (Reply) pesan teks yang ingin disalin, lalu kirim: .copy <nomor_tujuan>';
    } else {
      try {
        await sock.sendMessage(`${target}@s.whatsapp.net`, { text: copiedText });
        response = '✅ Salinan pesan berhasil dikirim.';
      } catch (error) {
        response = '⚠️ Salinan pesan gagal dikirim. Periksa nomor tujuan dan koneksi bot.';
      }
    }
  } else if (command === '.help') {
    response = '🤖 BANTUAN\n\n.autoreply on|off|status\n.notify on|off|status\n.bot status\n.group list\n.group send <ID_GRUP> | <pesan>\n.send <nomor> | <pesan>\n.copy <nomor> (Reply pesan teks)\n.help\n\nBalas (Reply) notifikasi pesan masuk untuk mengirim jawaban ke pengirim.';
  } else return;
  await sock.sendMessage(config.ownerJid, { text: response }, { quoted: message });
}

function extractQuotedText(content = {}) {
  const context = Object.values(content).find((part) => part?.contextInfo)?.contextInfo;
  return extractText(context?.quotedMessage ?? {});
}

function normalizeTarget(input = '') {
  let number = String(input).replace(/\D/g, '');
  if (number.startsWith('0')) number = `62${number.slice(1)}`;
  return number.length >= 7 ? number : null;
}
