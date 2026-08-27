import 'dotenv/config';
import { readFileSync } from 'node:fs';

function positiveInt(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? String(fallback), 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function bool(name, fallback) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return value.trim().toLowerCase() === 'true';
}

function loadSystemPrompt() {
  const file = process.env.AI_SYSTEM_PROMPT_FILE?.trim();
  if (file) {
    try {
      const prompt = readFileSync(file, 'utf8').trim();
      if (prompt) return prompt;
    } catch (error) {
      console.warn(`[CONFIG] Tidak dapat membaca AI_SYSTEM_PROMPT_FILE: ${error.message}`);
    }
  }
  return process.env.AI_SYSTEM_PROMPT?.trim() || 'Kamu adalah asisten WhatsApp yang ramah dan profesional. Jawab singkat dalam Bahasa Indonesia.';
}

function thinkingLevel() {
  const value = (process.env.AI_THINKING_LEVEL ?? 'low').trim().toLowerCase();
  return ['minimal', 'low', 'medium', 'high'].includes(value) ? value : 'low';
}

const ownerNumber = (process.env.OWNER_NUMBER ?? '').replace(/\D/g, '');
if (!ownerNumber || ownerNumber.length < 7) {
  throw new Error('OWNER_NUMBER wajib diisi di .env dalam format internasional, hanya digit.');
}

const minDelay = positiveInt('AUTO_REPLY_MIN_DELAY', 2000);
const maxDelay = positiveInt('AUTO_REPLY_MAX_DELAY', 5000);

export const config = Object.freeze({
  ownerNumber,
  ownerJid: `${ownerNumber}@s.whatsapp.net`,
  authDir: 'auth_info_baileys',
  dataDir: 'data',
  autoReply: {
    enabled: bool('AUTO_REPLY_ENABLED', true),
    message: process.env.AUTO_REPLY_MESSAGE ?? 'Halo, pesan kamu sudah diterima.',
    minDelay: Math.min(minDelay, maxDelay),
    maxDelay: Math.max(minDelay, maxDelay),
    cooldown: positiveInt('AUTO_REPLY_COOLDOWN', 300000)
  },
  notifyOwnerEnabled: bool('NOTIFY_OWNER_ENABLED', true),
  ai: {
    enabled: bool('AI_ENABLED', false),
    provider: (process.env.AI_PROVIDER ?? 'ollama').trim().toLowerCase(),
    geminiApiKey: process.env.GEMINI_API_KEY?.trim() || null,
    geminiModel: process.env.GEMINI_MODEL?.trim() || 'gemini-3-flash-preview',
    geminiFallbackModels: (process.env.GEMINI_FALLBACK_MODELS ?? '')
      .split(',').map((model) => model.trim()).filter(Boolean),
    antigravityAgent: process.env.ANTIGRAVITY_AGENT?.trim() || 'antigravity-preview-05-2026',
    geminiMinRequestInterval: Math.max(1000, positiveInt('GEMINI_MIN_REQUEST_INTERVAL_MS', 8000)),
    openAiApiKey: process.env.OPENAI_API_KEY?.trim() || null,
    openAiModel: process.env.OPENAI_MODEL?.trim() || 'gpt-5-mini',
    baseUrl: (process.env.AI_OLLAMA_URL ?? 'http://127.0.0.1:11434').replace(/\/$/, ''),
    model: process.env.AI_MODEL?.trim() || 'qwen2.5:1.5b',
    systemPrompt: loadSystemPrompt(),
    maxHistory: positiveInt('AI_MAX_HISTORY', 6),
    maxReplyChars: positiveInt('AI_MAX_REPLY_CHARS', 700),
    maxOutputTokens: positiveInt('AI_MAX_OUTPUT_TOKENS', 1024),
    thinkingLevel: thinkingLevel(),
    timeoutMs: positiveInt('AI_TIMEOUT_MS', 120000)
  },
  contacts: {
    enabled: bool('CONTACTS_ENABLED', false),
    vcfFile: process.env.CONTACTS_VCF_FILE?.trim() || null
  },
  group: {
    aiEnabled: bool('GROUP_AI_ENABLED', false),
    mentionOnly: bool('GROUP_REPLY_ON_MENTION_ONLY', true)
  },
  moodGif: {
    enabled: bool('MOOD_GIF_ENABLED', false),
    cooldown: positiveInt('MOOD_GIF_COOLDOWN', 21600000)
  },
  disasterAlerts: {
    enabled: bool('DISASTER_ALERTS_ENABLED', true),
    interval: Math.max(60000, positiveInt('DISASTER_ALERT_INTERVAL_MS', 3600000))
  },
  discordBackup: {
    enabled: bool('DISCORD_BACKUP_ENABLED', false),
    webhookUrl: process.env.DISCORD_BACKUP_WEBHOOK_URL?.trim() || null,
    interval: Math.max(3600000, positiveInt('DISCORD_BACKUP_INTERVAL_MS', 86400000))
  },
  mappingTtl: positiveInt('MESSAGE_MAPPING_TTL', 86400000),
  reconnect: {
    maxAttempts: positiveInt('RECONNECT_MAX_ATTEMPTS', 8),
    baseDelay: positiveInt('RECONNECT_BASE_DELAY', 2000)
  }
});
