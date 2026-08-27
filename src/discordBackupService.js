import { createWriteStream } from 'node:fs';
import { mkdir, readFile, stat, unlink } from 'node:fs/promises';
import { basename, join } from 'node:path';
import archiver from 'archiver';

const BACKUP_FILES = ['src', 'prompts', 'assets', 'package.json', 'package-lock.json', '.env.example', '.gitignore', 'README.md', '.env', 'auth_info_baileys', 'data'];
const MAX_DISCORD_UPLOAD_BYTES = 8 * 1024 * 1024;

/** Creates a complete server ZIP then uploads it to the configured Discord webhook. */
export class DiscordBackupService {
  constructor(projectDirectory = process.cwd()) {
    this.projectDirectory = projectDirectory;
    this.timer = null;
    this.running = false;
  }

  start(options, log) {
    if (!options.enabled) return;
    if (!options.webhookUrl) {
      log('ERROR', { event: 'discord_backup', error: 'DISCORD_BACKUP_WEBHOOK_URL belum diisi' });
      return;
    }
    if (this.timer) return;
    void this.run(options, log);
    this.timer = setInterval(() => void this.run(options, log), options.interval);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async run(options, log) {
    if (this.running) return;
    this.running = true;
    let archivePath;
    try {
      // Keep the archive outside `data`, because `data` itself is included in
      // the backup and must never recursively archive the ZIP being created.
      const backupDirectory = join(this.projectDirectory, '.backup-tmp');
      await mkdir(backupDirectory, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      archivePath = join(backupDirectory, `milo-server-backup-${stamp}.zip`);
      await createZip(this.projectDirectory, archivePath, options.contactVcfFile);
      const metadata = await stat(archivePath);
      if (metadata.size > MAX_DISCORD_UPLOAD_BYTES) throw new Error('ZIP backup melebihi batas unggah Discord 8 MB');

      const form = new FormData();
      form.append('payload_json', JSON.stringify({ content: `📦 Backup server Milo — ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}` }));
      form.append('files[0]', new Blob([await readFile(archivePath)], { type: 'application/zip' }), archivePath.split(/[\\/]/).pop());
      const response = await fetch(options.webhookUrl, { method: 'POST', body: form, signal: AbortSignal.timeout(120_000) });
      if (!response.ok) throw new Error(`Discord webhook HTTP ${response.status}`);
      log('DISCORD_BACKUP_SENT', { bytes: metadata.size });
    } catch (error) {
      log('ERROR', { event: 'discord_backup', error: error.message });
    } finally {
      if (archivePath) await unlink(archivePath).catch(() => undefined);
      this.running = false;
    }
  }
}

async function createZip(projectDirectory, destination, contactVcfFile) {
  await new Promise((resolve, reject) => {
    const output = createWriteStream(destination);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
    archive.pipe(output);
    void addProjectFiles(archive, projectDirectory, contactVcfFile).then(() => archive.finalize(), reject);
  });
}

async function addProjectFiles(archive, projectDirectory, contactVcfFile) {
  for (const item of BACKUP_FILES) {
    const absolute = join(projectDirectory, item);
    try {
      const details = await stat(absolute);
      if (details.isDirectory()) archive.directory(absolute, item);
      else archive.file(absolute, { name: item });
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  if (contactVcfFile) {
    try {
      const details = await stat(contactVcfFile);
      if (details.isFile()) archive.file(contactVcfFile, { name: `contacts/${basename(contactVcfFile)}` });
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}
