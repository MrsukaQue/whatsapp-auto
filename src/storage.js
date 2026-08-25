import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Small JSON store; it deliberately holds routing metadata, never chat bodies. */
export class Storage {
  constructor(directory, mappingTtl) {
    this.directory = directory;
    this.mappingTtl = mappingTtl;
    this.mappings = new Map();
    this.seenSenders = new Set();
    this.settings = null;
    this.writeChain = Promise.resolve();
  }

  async init(defaultSettings) {
    await mkdir(this.directory, { recursive: true });
    const data = await this.#read('mappings.json', []);
    const cutoff = Date.now() - this.mappingTtl;
    for (const entry of data) {
      if (entry?.notificationMessageId && entry?.senderJid && entry.timestamp >= cutoff) {
        this.mappings.set(entry.notificationMessageId, entry);
      }
    }
    await this.#saveMappings();
    const seenSenders = await this.#read('seen-senders.json', []);
    for (const senderJid of seenSenders) {
      if (typeof senderJid === 'string') this.seenSenders.add(senderJid);
    }
    const savedSettings = await this.#read('settings.json', {});
    // Commands control only the two on/off switches. Delivery content and timing
    // always come from .env, so a newly configured sticker is effective after restart.
    this.settings = {
      ...savedSettings,
      ...defaultSettings,
      autoReplyEnabled: savedSettings.autoReplyEnabled ?? defaultSettings.autoReplyEnabled,
      notifyOwnerEnabled: savedSettings.notifyOwnerEnabled ?? defaultSettings.notifyOwnerEnabled
    };
    delete this.settings.autoReplyStickerPath;
    await this.#write('settings.json', this.settings);
  }

  async addMapping(entry) {
    this.prune();
    this.mappings.set(entry.notificationMessageId, entry);
    await this.#saveMappings();
  }

  getMapping(notificationMessageId) {
    this.prune();
    return this.mappings.get(notificationMessageId);
  }

  hasSeenSender(senderJid) { return this.seenSenders.has(senderJid); }

  async markSenderSeen(senderJid) {
    if (this.seenSenders.has(senderJid)) return;
    this.seenSenders.add(senderJid);
    await this.#write('seen-senders.json', [...this.seenSenders]);
  }

  async updateSettings(patch) {
    this.settings = { ...this.settings, ...patch };
    await this.#write('settings.json', this.settings);
    return this.settings;
  }

  prune() {
    const cutoff = Date.now() - this.mappingTtl;
    for (const [id, value] of this.mappings) if (value.timestamp < cutoff) this.mappings.delete(id);
  }

  async close() {
    this.prune();
    await this.#saveMappings();
    await this.#write('seen-senders.json', [...this.seenSenders]);
    if (this.settings) await this.#write('settings.json', this.settings);
  }

  async #saveMappings() { await this.#write('mappings.json', [...this.mappings.values()]); }
  async #read(file, fallback) {
    try { return JSON.parse(await readFile(join(this.directory, file), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
  }
  async #write(file, value) {
    // Serialize writes: simultaneous incoming notifications must not overwrite mappings.
    const write = async () => {
      const target = join(this.directory, file);
      const temporary = `${target}.tmp`;
      await writeFile(temporary, JSON.stringify(value, null, 2), 'utf8');
      await rename(temporary, target);
    };
    this.writeChain = this.writeChain.then(write, write);
    return this.writeChain;
  }
}
