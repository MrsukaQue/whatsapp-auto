# Mika WhatsApp Bot

> A personal WhatsApp automation bot with AI replies, owner routing, group chat support, music requests, BMKG alerts, and optional Discord backups.

Built with **Node.js**, **Baileys**, and interchangeable AI providers such as **Gemini**, **Ollama**, and OpenAI.

## Features

- 🤖 AI-powered replies with a customizable persona
- 🔄 Automatic Gemini model rotation when a model reaches its daily quota
- 👤 Owner-only message routing, replies, and direct sends
- 👥 Group replies, with optional mention-only mode
- 📇 Optional local vCard contact labels for the active conversation
- 🎵 `!lagu <title>` requests from the Audius open music catalog
- 🌋 Hourly Indonesian disaster summaries from BMKG
- 💬 Read receipts after the bot has sent a reply
- 📦 Optional full-server ZIP backups uploaded to a private Discord webhook

## Requirements

- Node.js 20 or newer
- A WhatsApp account dedicated to the bot
- A Google Gemini API key, or a local Ollama installation

## Quick Start

```cmd
git clone https://github.com/MrsukaQue/whatsapp-auto.git
cd whatsapp-auto
copy .env.example .env
npm install
```

Open `.env` and set at least the following values:

```env
OWNER_NUMBER=628xxxxxxxxxx
AI_ENABLED=true
AI_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key
```

Start the bot:

```cmd
npm start
```

The terminal displays a QR code on the first run. Scan it from the WhatsApp account that will act as the bot: **Linked devices → Link a device**.

## AI Providers

### Gemini

```env
AI_ENABLED=true
AI_PROVIDER=gemini
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-3.1-flash-lite
GEMINI_FALLBACK_MODELS=gemini-3.5-flash-lite,gemini-3-flash-preview,gemini-2.5-flash-lite
```

When Gemini returns a quota-limit error, the bot automatically switches to the next configured model until the next day.

### Ollama (local)

```cmd
ollama pull qwen2.5:1.5b
```

```env
AI_ENABLED=true
AI_PROVIDER=ollama
AI_OLLAMA_URL=http://127.0.0.1:11434
AI_MODEL=qwen2.5:1.5b
```

### Persona

The active persona lives in [prompts/mikail-full.txt](prompts/mikail-full.txt). Set this in `.env`:

```env
AI_SYSTEM_PROMPT_FILE=prompts/mikail-full.txt
```

## Owner Commands

| Command | Description |
| --- | --- |
| `.autoreply on\|off\|status` | Manage automatic replies |
| `.notify on\|off\|status` | Manage owner notifications |
| `.bot status` | Show basic bot status |
| `.group list` | List groups joined by the bot |
| `.group send <GROUP_ID> \| <message>` | Send a group message |
| `.send <number> \| <message>` | Send a direct message |
| `.copy <number>` | Reply to a text message, then copy it to a number |
| `.help` | Show the command list |

## Group Replies

```env
GROUP_AI_ENABLED=true
GROUP_REPLY_ON_MENTION_ONLY=false
```

Set `GROUP_REPLY_ON_MENTION_ONLY=true` if the bot should reply only when someone mentions it.

## Music Requests

Anyone can request an available track from the Audius catalog:

```text
!lagu lofi beats
```

The bot sends audio only when a stream is available through Audius. Requests have a one-minute cooldown per chat.

## Local Contact Labels

```env
CONTACTS_ENABLED=true
CONTACTS_VCF_FILE=C:\path\to\contacts.vcf
```

The vCard file is read locally at startup. The bot only uses the matching label for the active sender; it does not publish the contact list to GitHub.

## Indonesian Disaster Alerts

```env
DISASTER_ALERTS_ENABLED=true
DISASTER_ALERT_INTERVAL_MS=3600000
```

The owner receives a national BMKG summary at startup and then every hour.

## Discord Full-Server Backup

> **Important:** This backup contains `.env`, WhatsApp session files, runtime data, and the configured vCard file. Use a private Discord channel and never expose its webhook URL.

```env
DISCORD_BACKUP_ENABLED=true
DISCORD_BACKUP_WEBHOOK_URL=https://discord.com/api/webhooks/...
DISCORD_BACKUP_INTERVAL_MS=86400000
```

The bot creates a ZIP on connection, uploads it to Discord, then removes the local temporary ZIP. It runs again every 24 hours.

## Deploying or Updating on a Windows Server

Initial deployment:

```cmd
git clone https://github.com/MrsukaQue/whatsapp-auto.git
cd whatsapp-auto
copy .env.example .env
npm install
npm start
```

For later updates:

```cmd
git pull origin main
npm install
npm start
```

Keep the server `.env`, `auth_info_baileys`, `data`, and contact files private. They are intentionally ignored by Git.

## Pushing Changes to GitHub

```cmd
git add .
git commit -m "Describe your change"
git push origin main
```

Before pushing, run:

```cmd
git status --short
```

Never commit `.env`, `auth_info_baileys`, `data`, API keys, Discord webhook URLs, or contact files.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| `Gemini HTTP 429` | The bot should rotate to a fallback model; check the terminal for `GEMINI_MODEL_LIMITED`. |
| `Gemini HTTP 404` | Verify `GEMINI_MODEL` against the models available to your API key. |
| Contact directory error | Make sure `CONTACTS_VCF_FILE` points to a `.vcf` file, not a folder. |
| QR is not shown | Remove `auth_info_baileys` only when you intentionally need to link a new WhatsApp session. |
| Group reply does not work | Confirm the bot is in the group and `GROUP_AI_ENABLED=true`. |

## Security

This project uses an unofficial WhatsApp library. Use it only with accounts you control, respect WhatsApp's terms, and protect every file that contains credentials or session data.
