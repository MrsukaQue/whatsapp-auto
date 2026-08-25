import { config } from './config.js';
import { Storage } from './storage.js';
import { AutoReplyService } from './autoReplyService.js';
import { AiReplyService } from './aiReplyService.js';
import { MoodGifService } from './moodGifService.js';
import { DisasterAlertService } from './disasterAlertService.js';
import { ContactDirectory } from './contactDirectory.js';
import { createMessageHandler } from './messageHandler.js';
import { ConnectionManager } from './connection.js';

// libsignal currently prints entire session records (including key material) via
// console.info when pruning sessions. Prevent that privacy-unsafe library log.
const originalConsoleInfo = console.info;
console.info = (...args) => {
  if (args[0] === 'Closing session:') return;
  originalConsoleInfo(...args);
};

function log(event, fields = {}) {
  // Deliberately no body/name output: terminal logs remain privacy-minimal.
  console.log(`[${event}]`, Object.keys(fields).length ? JSON.stringify(fields) : '');
}

const storage = new Storage(config.dataDir, config.mappingTtl);
await storage.init({
  ownerNumber: config.ownerNumber,
  autoReplyEnabled: config.autoReply.enabled,
  autoReplyMessage: config.autoReply.message,
  autoReplyMinDelay: config.autoReply.minDelay,
  autoReplyMaxDelay: config.autoReply.maxDelay,
  autoReplyCooldown: config.autoReply.cooldown,
  notifyOwnerEnabled: config.notifyOwnerEnabled
});

const autoReply = new AutoReplyService();
const aiReply = new AiReplyService();
const moodGif = new MoodGifService();
const disasterAlerts = new DisasterAlertService();
const contactDirectory = new ContactDirectory();
if (config.contacts.enabled) await contactDirectory.load(config.contacts.vcfFile, log);
let manager;
const onMessages = (event) => createMessageHandler({ sock: manager.sock, storage, config, autoReply, aiReply, moodGif, contactDirectory, log })(event);
manager = new ConnectionManager({
  config,
  onMessages,
  log,
  onConnected: () => disasterAlerts.start(() => manager.sock, { ...config.disasterAlerts, ownerJid: config.ownerJid }, log)
});
await manager.start();

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[SHUTDOWN] ${signal}`);
  await manager.stop().catch((error) => log('ERROR', { event: 'shutdown_socket', error: error.message }));
  disasterAlerts.stop();
  await storage.close().catch((error) => log('ERROR', { event: 'shutdown_storage', error: error.message }));
  process.exit(0);
}
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
