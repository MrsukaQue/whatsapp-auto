const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class AutoReplyService {
  constructor() {
    this.lastSentAt = new Map();
  }

  async sendIfEligible(sock, senderJid, settings, log, replyText = settings.autoReplyMessage, { useCooldown = true } = {}) {
    if (!settings.autoReplyEnabled) return false;
    const now = Date.now();
    if (useCooldown && now - (this.lastSentAt.get(senderJid) ?? 0) < settings.autoReplyCooldown) return false;
    // Reserve before awaiting: repeated upserts cannot schedule duplicate replies.
    if (useCooldown) this.lastSentAt.set(senderJid, now);
    const wait = random(settings.autoReplyMinDelay, settings.autoReplyMaxDelay);
    try {
      await sock.sendPresenceUpdate('composing', senderJid);
      log('AUTO_REPLY_TYPING', { target: senderJid });
      await delay(wait);
      await sock.sendMessage(senderJid, { text: replyText });
      log('AUTO_REPLY_SENT', { target: senderJid });
      return true;
    } catch (error) {
      // Let the next inbound message retry after a send failure.
      if (useCooldown) this.lastSentAt.delete(senderJid);
      log('ERROR', { event: 'auto_reply', error: error.message });
      return false;
    } finally {
      await sock.sendPresenceUpdate('paused', senderJid).catch(() => undefined);
    }
  }
}

function random(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
