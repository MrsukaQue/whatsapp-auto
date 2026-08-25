import makeWASocket, { DisconnectReason, makeCacheableSignalKeyStore, useMultiFileAuthState } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcode from 'qrcode-terminal';

const logger = pino({ level: 'silent' });

export class ConnectionManager {
  constructor({ config, onMessages, onConnected = async () => {}, log }) {
    this.config = config;
    this.onMessages = onMessages;
    this.onConnected = onConnected;
    this.log = log;
    this.sock = null;
    this.reconnectAttempts = 0;
    this.stopped = false;
    this.retryTimer = null;
  }

  async start() {
    this.stopped = false;
    const { state, saveCreds } = await useMultiFileAuthState(this.config.authDir);
    const sock = makeWASocket({
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
      logger,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      emitOwnEvents: false,
      browser: ['WhatsApp Owner Assistant', 'Chrome', '1.0.0']
    });
    this.sock = sock;
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('messages.upsert', this.onMessages);
    sock.ev.on('connection.update', (update) => this.#onConnectionUpdate(update));
    return sock;
  }

  async stop() {
    this.stopped = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.sock?.ev.removeAllListeners('messages.upsert');
    this.sock?.ev.removeAllListeners('connection.update');
    this.sock?.ws.close();
  }

  #onConnectionUpdate({ connection, lastDisconnect, qr }) {
    if (qr) { console.log('\nPindai QR ini di WhatsApp > Perangkat tertaut:\n'); qrcode.generate(qr, { small: true }); }
    if (connection === 'open') {
      this.reconnectAttempts = 0;
      this.log('CONNECTED');
      this.onConnected().catch((error) => this.log('ERROR', { event: 'connected_callback', error: error.message }));
      return;
    }
    if (connection !== 'close' || this.stopped) return;
    // Baileys supplies a Boom-compatible error; preserve its original disconnect code.
    const code = lastDisconnect?.error?.output?.statusCode ?? new Boom(lastDisconnect?.error)?.output?.statusCode;
    const terminal = [DisconnectReason.loggedOut, DisconnectReason.connectionReplaced, DisconnectReason.badSession].includes(code);
    if (terminal) {
      this.log('ERROR', { event: 'connection', code, action: 'login_required' });
      console.error('[LOGIN_REQUIRED] Session logout/replaced/bad. Hapus auth_info_baileys lalu pindai QR baru.');
      return;
    }
    if (this.reconnectAttempts >= this.config.reconnect.maxAttempts) {
      this.log('ERROR', { event: 'connection', code, action: 'reconnect_limit_reached' });
      return;
    }
    const attempt = ++this.reconnectAttempts;
    const wait = Math.min(this.config.reconnect.baseDelay * 2 ** (attempt - 1), 60000);
    this.log('ROUTING', { event: 'reconnect_scheduled', attempt, waitMs: wait, code });
    this.retryTimer = setTimeout(() => this.start().catch((error) => this.log('ERROR', { event: 'reconnect', error: error.message })), wait);
  }
}
