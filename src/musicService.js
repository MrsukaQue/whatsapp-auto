const REQUEST_COOLDOWN_MS = 60_000;
const MAX_DURATION_SECONDS = 10 * 60;
const lastRequestAt = new Map();

export function musicQueryFromText(text = '') {
  const match = text.trim().match(/^!lagu\s+(.+)$/is);
  return match?.[1]?.trim() || null;
}

/**
 * Sends only an Audius track whose API access metadata permits streaming.
 * This intentionally does not scrape or download music from YouTube.
 */
export async function sendMusicRequest(sock, jid, query, log) {
  const now = Date.now();
  if (now - (lastRequestAt.get(jid) ?? 0) < REQUEST_COOLDOWN_MS) {
    await sock.sendMessage(jid, { text: 'Tunggu sekitar satu menit dulu sebelum request lagu lagi ya 🎵' });
    return true;
  }
  lastRequestAt.set(jid, now);
  try {
    const endpoint = `https://api.audius.co/v1/tracks/search?query=${encodeURIComponent(query)}&limit=10`;
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`Audius HTTP ${response.status}`);
    const body = await response.json();
    const track = await findPlayableTrack(body?.data ?? []);
    if (!track) {
      await sock.sendMessage(jid, { text: 'Maaf, gw belum menemukan versi yang bisa dikirim dari katalog musik legal. Coba judul atau artis lain ya.' });
      return true;
    }
    const title = String(track.title ?? 'Lagu').replace(/[\\/:*?"<>|]/g, '').slice(0, 80);
    const artist = String(track.user?.name ?? 'Audius').slice(0, 80);
    await sock.sendPresenceUpdate('recording', jid);
    await sock.sendMessage(jid, {
      audio: { url: streamUrl(track) },
      mimetype: 'audio/mpeg',
      fileName: `${title || 'lagu'}.mp3`,
      ptt: false
    });
    log('MUSIC_REQUEST_SENT', { target: jid, source: 'audius' });
    await sock.sendMessage(jid, { text: `🎵 ${title} — ${artist}` });
    return true;
  } catch (error) {
    lastRequestAt.delete(jid);
    log('ERROR', { event: 'music_request', error: error.message });
    await sock.sendMessage(jid, { text: 'Maaf, lagu belum bisa dikirim sekarang. Coba beberapa saat lagi ya.' }).catch(() => undefined);
    return true;
  } finally {
    await sock.sendPresenceUpdate('paused', jid).catch(() => undefined);
  }
}

async function findPlayableTrack(tracks) {
  for (const track of tracks) {
    if (track?.access?.stream !== true || Number(track.duration ?? 0) <= 0 || Number(track.duration) > MAX_DURATION_SECONDS) continue;
    const probe = await fetch(streamUrl(track), { redirect: 'manual', signal: AbortSignal.timeout(10_000) });
    // A working Audius stream normally starts with an HTTP redirect to its
    // content node. Avoid stale search entries that point to a dead stream.
    if (probe.ok || (probe.status >= 300 && probe.status < 400)) return track;
  }
  return null;
}

function streamUrl(track) {
  return `https://api.audius.co/v1/tracks/${encodeURIComponent(track.track_id ?? track.id)}/stream`;
}
