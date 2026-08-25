import { userFromJid } from './routingService.js';

export function describeMessage(content) {
  if (content?.conversation || content?.extendedTextMessage?.text) return { type: 'Text', text: content.conversation ?? content.extendedTextMessage.text };
  const types = [
    ['imageMessage', 'Image'], ['videoMessage', 'Video'], ['audioMessage', 'Audio'],
    ['documentMessage', 'Document'], ['stickerMessage', 'Sticker'], ['locationMessage', 'Location'],
    ['contactMessage', 'Contact'], ['reactionMessage', 'Reaction']
  ];
  const found = types.find(([key]) => content?.[key]);
  return { type: found?.[1] ?? 'Unsupported', text: null };
}

export function buildNotification({ senderJid, pushName, timestamp, description }) {
  const number = userFromJid(senderJid) || 'Tidak tersedia';
  const name = pushName?.trim() || 'Tidak tersedia';
  const time = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short', timeZone: process.env.TZ || 'Asia/Jakarta' }).format(timestamp);
  const isText = description.type === 'Text';
  return [
    '╔═════════════════════╗',
    `      📩 PESAN ${isText ? 'MASUK' : 'MEDIA'}`,
    '╚═════════════════════╝', '',
    '👤 Nama', name, '',
    '📱 Nomor', number, '',
    '🆔 JID', senderJid, '',
    '🕐 Waktu', time, '',
    ...(isText ? ['💬 Pesan', description.text || 'Tidak tersedia', ''] : []),
    '📎 Tipe', description.type, '',
    '↩️ Reply pesan ini untuk membalas.'
  ].join('\n');
}
