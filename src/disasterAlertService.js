const BMKG = 'https://data.bmkg.go.id/DataMKG/TEWS';
const KARHUTLA_URL = 'https://www.bmkg.go.id/cuaca/karhutla';
const WEATHER_WARNING_URL = 'https://www.bmkg.go.id/cuaca/peringatan-dini-cuaca';

/** Periodic, OWNER-only national situational report sourced from BMKG. */
export class DisasterAlertService {
  constructor() { this.timer = null; }

  async start(getSocket, config, log) {
    if (!config.enabled || this.timer) return;
    await this.#sendReport(getSocket, config, log);
    this.timer = setInterval(() => this.#sendReport(getSocket, config, log), config.interval);
  }

  stop() { if (this.timer) clearInterval(this.timer); }

  async #sendReport(getSocket, config, log) {
    try {
      const [latest, recent, felt] = await Promise.all([
        fetchJson(`${BMKG}/autogempa.json`),
        fetchJson(`${BMKG}/gempaterkini.json`),
        fetchJson(`${BMKG}/gempadirasakan.json`)
      ]);
      const sock = getSocket();
      if (!sock) throw new Error('Socket WhatsApp belum siap');
      await sock.sendMessage(config.ownerJid, { text: formatReport(latest, recent, felt) });
      log('DISASTER_UPDATE_SENT', { target: config.ownerJid });
    } catch (error) {
      log('ERROR', { event: 'disaster_alert', error: error.message });
    }
  }
}

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`BMKG HTTP ${response.status}`);
  return response.json();
}

function formatReport(latestData, recentData, feltData) {
  const latest = latestData.Infogempa.gempa;
  const recent = recentData.Infogempa.gempa.slice(0, 3);
  const felt = feltData.Infogempa.gempa.slice(0, 3);
  const checkedAt = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date());
  return [
    '🌏 UPDATE BENCANA NASIONAL',
    `Dicek: ${checkedAt} WIB`, '',
    '⚠️ GEMPA TERBARU (BMKG)',
    earthquake(latest), '',
    '📊 3 GEMPA M5+ TERBARU',
    ...recent.map((item) => `• ${item.Tanggal} ${item.Jam} — M${item.Magnitude}, ${item.Wilayah}`), '',
    '🫨 3 GEMPA DIRASAKAN TERBARU',
    ...felt.map((item) => `• ${item.Tanggal} ${item.Jam} — M${item.Magnitude}, ${item.Wilayah}${item.Dirasakan ? ` (${item.Dirasakan})` : ''}`), '',
    '🌲 KARHUTLA',
    `Pantau risiko/potensi berdasarkan cuaca BMKG: ${KARHUTLA_URL}`, '',
    '🌧️ PERINGATAN CUACA',
    WEATHER_WARNING_URL, '',
    'Sumber: BMKG. Ini ringkasan informasi, bukan pengganti peringatan darurat resmi.'
  ].join('\n');
}

function earthquake(item) {
  return [
    `${item.Tanggal}, ${item.Jam} — M${item.Magnitude}`,
    item.Wilayah,
    `Kedalaman: ${item.Kedalaman}`,
    `Potensi: ${item.Potensi}`,
    item.Dirasakan ? `Dirasakan: ${item.Dirasakan}` : null
  ].filter(Boolean).join('\n');
}
