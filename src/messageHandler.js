import { describeMessage, buildNotification } from './notificationService.js';
import { isOwner, isPrivateUserJid, unwrapMessage } from './routingService.js';
import { handleOwnerMessage } from './ownerHandler.js';
import { musicQueryFromText, sendMusicRequest } from './musicService.js';

export function createMessageHandler({ sock, storage, config, autoReply, aiReply, moodGif, contactDirectory, log }) {
  return async ({ messages, type }) => {
    if (type !== 'notify') return;
    // Do not let one sender's typing delay hold up another sender in the same upsert.
    await Promise.allSettled(messages.map((message) => processOne({ sock, message, storage, config, autoReply, aiReply, moodGif, contactDirectory, log })));
  };
}

async function processOne({ sock, message, storage, config, autoReply, aiReply, moodGif, contactDirectory, log }) {
  try {
    const jid = message.key?.remoteJid;
    if (!jid || jid === 'status@broadcast') return;
    // Ignore this socket's outbound messages (including owner notifications).
    if (message.key.fromMe) return;
    if (jid.endsWith('@g.us')) {
      if (await handleMusicRequest({ sock, message, jid, log })) return;
      await handleGroupMessage({ sock, message, storage, config, autoReply, aiReply, log });
      return;
    }
    if (!isPrivateUserJid(jid)) return;
    if (await handleMusicRequest({ sock, message, jid, log })) return;
    // Baileys may supply remoteJidAlt for LID-addressed messages; use it only
    // for owner validation while retaining the actual JID for reply routing.
    if (isOwner(message.key.remoteJidAlt ?? jid, config.ownerNumber)) {
      const handled = await handleOwnerMessage({ sock, message, storage, config, log });
      // OWNER may also send ordinary chat messages. Commands and quoted replies
      // remain administrative/routing actions; other messages get the usual auto reply.
      if (!handled) await sendAutomatedReply({ sock, jid, message, storage, config, autoReply, aiReply, moodGif, contactDirectory, log, isOwner: true });
      return;
    }
    await handleIncoming({ sock, message, storage, config, autoReply, aiReply, moodGif, contactDirectory, log });
  } catch (error) {
    log('ERROR', { event: 'message_processing', error: error.message });
  }
}

async function handleGroupMessage({ sock, message, storage, config, autoReply, aiReply, log }) {
  if (!config.group.aiEnabled) return;
  const content = unwrapMessage(message.message);
  const description = describeMessage(content);
  if (description.type !== 'Text') return;
  const mentions = getMentionedJids(content);
  const botUser = sock.user?.id;
  if (config.group.mentionOnly && !mentions.some((jid) => sameUser(jid, botUser))) return;

  const groupJid = message.key.remoteJid;
  log('GROUP_MESSAGE_RECEIVED', { group: groupJid, mentionOnly: config.group.mentionOnly });
  const participant = message.key.participantAlt ?? message.key.participant ?? 'unknown';
  const aiText = await aiReply.generate(`${groupJid}:${participant}`, description.text, config.ai, log, { isGroup: true });
  const sent = await autoReply.sendIfEligible(sock, groupJid, storage.settings, log, aiText ?? storage.settings.autoReplyMessage, {
    useCooldown: !aiText
  });
  if (sent) markAsRead(sock, message, log);
}

function getMentionedJids(content) {
  const context = Object.values(content ?? {}).find((part) => part?.contextInfo)?.contextInfo;
  return context?.mentionedJid ?? [];
}

function sameUser(first, second) {
  return first?.split('@')[0].split(':')[0] === second?.split('@')[0].split(':')[0];
}

async function handleIncoming({ sock, message, storage, config, autoReply, aiReply, moodGif, contactDirectory, log }) {
  const senderJid = message.key.remoteJid;
  const isFirstContact = !storage.hasSeenSender(senderJid);
  const content = unwrapMessage(message.message);
  const description = describeMessage(content);
  if (description.type === 'Unsupported') return;
  log('MESSAGE_RECEIVED', { sender: senderJid, type: description.type });
  if (storage.settings.notifyOwnerEnabled) {
    try {
      if (description.type === 'Sticker') {
        await sock.sendMessage(`${storage.settings.ownerNumber}@s.whatsapp.net`, { forward: message });
      }
      const text = buildNotification({ senderJid, pushName: message.pushName, timestamp: Number(message.messageTimestamp) * 1000 || Date.now(), description });
      const notification = await sock.sendMessage(`${storage.settings.ownerNumber}@s.whatsapp.net`, { text });
      if (!notification?.key?.id) throw new Error('ID notifikasi tidak tersedia');
      await storage.addMapping({ notificationMessageId: notification.key.id, senderJid, timestamp: Date.now(), messageType: description.type });
      log('NOTIFICATION_SENT', { target: storage.settings.ownerNumber, messageId: notification.key.id });
    } catch (error) {
      log('ERROR', { event: 'notification', error: error.message });
    }
  }
  await sendAutomatedReply({ sock, jid: senderJid, message, storage, config, autoReply, aiReply, moodGif, contactDirectory, log, description, isFirstContact });
  if (isFirstContact) await storage.markSenderSeen(senderJid);
}

async function handleMusicRequest({ sock, message, jid, log }) {
  const description = describeMessage(unwrapMessage(message.message));
  if (description.type !== 'Text') return false;
  const query = musicQueryFromText(description.text);
  if (!query) return false;
  const handled = await sendMusicRequest(sock, jid, query, log);
  if (handled) markAsRead(sock, message, log);
  return handled;
}

async function sendAutomatedReply({ sock, jid, message, storage, config, autoReply, aiReply, moodGif, contactDirectory, log, description, isOwner = false, isFirstContact = false }) {
  const detected = description ?? describeMessage(unwrapMessage(message.message));
  const prompt = detected.type === 'Text'
    ? detected.text
    : detected.type === 'Sticker'
      ? 'Pengguna mengirim sebuah sticker. Balas singkat, santai, dan relevan tanpa mengaku bisa melihat isi stickernya.'
      : null;
  const aiText = prompt
    ? await aiReply.generate(jid, prompt, config.ai, log, { isOwner, isFirstConversation: isFirstContact, contactName: contactDirectory.find(message.key.remoteJidAlt ?? jid) })
    : null;
  // AI conversations should answer every message; the fixed fallback keeps its anti-spam cooldown.
  const sent = await autoReply.sendIfEligible(sock, jid, storage.settings, log, aiText ?? storage.settings.autoReplyMessage, { useCooldown: !aiText });
  if (sent) markAsRead(sock, message, log);
  if (detected.type === 'Text') await moodGif.sendIfRelevant(sock, jid, detected.text, config.moodGif, log);
}

function markAsRead(sock, message, log) {
  // Receipt delivery is best-effort and must not hold up the next message.
  void sock.readMessages([message.key]).catch((error) => {
    log('ERROR', { event: 'read_receipt', error: error.message });
  });
}
