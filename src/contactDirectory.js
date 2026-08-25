import { readFile } from 'node:fs/promises';
import { jidDecode } from '@whiskeysockets/baileys';

/** Local-only name directory loaded from a user-provided vCard file. */
export class ContactDirectory {
  constructor() { this.byNumber = new Map(); }

  async load(filePath, log) {
    if (!filePath) return;
    try {
      const content = await readFile(filePath, 'utf8');
      const cards = content.replace(/\r?\n[ \t]/g, '').split(/END:VCARD/i);
      for (const card of cards) {
        const name = value(card, 'FN');
        const phones = [...card.matchAll(/^TEL[^:]*:(.+)$/gim)].map((match) => match[1]);
        for (const phone of phones) {
          const number = normalizeNumber(phone);
          if (name && number) this.byNumber.set(number, name);
        }
      }
      log('CONTACT_DIRECTORY_LOADED', { contacts: this.byNumber.size });
    } catch (error) {
      log('ERROR', { event: 'contact_directory', error: error.code === 'ENOENT' ? 'File vCard tidak ditemukan' : error.message });
    }
  }

  find(jid) {
    const number = normalizeNumber(jidDecode(jid)?.user ?? jid?.split('@')[0]);
    return number ? this.byNumber.get(number) ?? null : null;
  }
}

function value(card, field) {
  const line = card.match(new RegExp(`^${field}[^:]*:(.+)$`, 'im'))?.[1]?.trim();
  return line?.replace(/\\n/g, ' ') || null;
}

function normalizeNumber(input = '') {
  let digits = String(input).replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  return digits.length >= 7 ? digits : null;
}
