import { jidDecode } from '@whiskeysockets/baileys';

export function userFromJid(jid = '') {
  return jidDecode(jid)?.user ?? jid.split('@')[0].split(':')[0];
}

export function isOwner(jid, ownerNumber) {
  return userFromJid(jid) === ownerNumber;
}

export function isPrivateUserJid(jid = '') {
  return jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid');
}

export function getQuotedMessageId(message) {
  const content = unwrapMessage(message?.message);
  const context = Object.values(content ?? {}).find((part) => part?.contextInfo)?.contextInfo;
  return context?.stanzaId ?? null;
}

export function unwrapMessage(content) {
  let current = content;
  while (current?.ephemeralMessage?.message || current?.viewOnceMessage?.message || current?.viewOnceMessageV2?.message) {
    current = current.ephemeralMessage?.message ?? current.viewOnceMessage?.message ?? current.viewOnceMessageV2?.message;
  }
  return current;
}
