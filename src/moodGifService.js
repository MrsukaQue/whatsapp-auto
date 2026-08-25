import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';

const MOODS = [
  { name: 'happy', words: /\b(haha|wkwk|lucu|senang|bahagia|mantap|keren|hebat)\b/i },
  { name: 'sad', words: /\b(sedih|kesepian|galau|capek|lelah|menangis)\b/i },
  { name: 'busy', words: /\b(sibuk|nanti|tunggu|kerja|kuliah|deadline)\b/i }
];

/** Sends only user-supplied local MP4s; it never downloads arbitrary internet GIFs. */
export class MoodGifService {
  constructor() { this.lastSentAt = new Map(); }

  async sendIfRelevant(sock, jid, incomingText, config, log) {
    if (!config.enabled || !incomingText) return;
    const mood = MOODS.find((item) => item.words.test(incomingText))?.name;
    if (!mood) return;
    const key = `${jid}:${mood}`;
    if (Date.now() - (this.lastSentAt.get(key) ?? 0) < config.cooldown) return;
    const file = join('assets', 'gifs', `${mood}.mp4`);
    try {
      await access(file, constants.R_OK);
      this.lastSentAt.set(key, Date.now());
      await sock.sendMessage(jid, { video: await readFile(file), gifPlayback: true });
      log('MOOD_GIF_SENT', { target: jid, mood });
    } catch (error) {
      if (error.code !== 'ENOENT') log('ERROR', { event: 'mood_gif', error: error.message });
    }
  }
}
