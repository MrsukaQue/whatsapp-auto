# WhatsApp Owner Assistant

Bot Node.js berbasis Baileys untuk meneruskan pesan masuk ke OWNER dan merelay balasan OWNER ketika OWNER membalas (Reply) notifikasi bot.

## Instalasi dan login

1. Gunakan Node.js 20 atau lebih baru.
2. Salin `.env.example` menjadi `.env`, lalu isi `OWNER_NUMBER` dengan nomor WhatsApp owner dalam format internasional (contoh: `628123456789`).
3. Jalankan `npm install`, lalu `npm start`.
4. QR akan tampil di terminal. Pada WhatsApp yang menjadi **akun bot**, buka **Perangkat tertaut / Linked devices** lalu pindai QR tersebut.

Session disimpan lokal di `auth_info_baileys/`; jangan dibagikan atau di-commit. Untuk login ulang setelah logout, hentikan bot, hapus hanya folder `auth_info_baileys/`, lalu jalankan kembali dan scan QR baru.

## Penggunaan

- Semua chat pribadi masuk dikirim sebagai notifikasi ke OWNER (jika `.notify on`).
- OWNER membalas *notifikasi tertentu* menggunakan fitur **Reply** WhatsApp. Bot mencocokkan ID pesan notifikasi ke mapping internal, lalu mengirim jawaban ke pengirim yang tepat. Nomor tidak diparsing dari teks notifikasi.
- `.autoreply on|off|status` mengubah/menampilkan auto reply.
- `.notify on|off|status` mengubah/menampilkan notifikasi owner.
- `.bot status` dan `.help` tersedia untuk OWNER.
- OWNER dapat mengirim satu pesan ke grup yang bot ikuti: kirim `.group list`, lalu `.group send <ID_GRUP> | <pesan>`. Bot tidak melakukan broadcast dan tidak mengaktifkan auto reply di grup.

Untuk mengaktifkan AI di grup, gunakan `GROUP_AI_ENABLED=true`. Secara default bot hanya menjawab saat di-mention; ubah `GROUP_REPLY_ON_MENTION_ONLY=false` jika bot memang harus menjawab setiap pesan grup. Sticker tidak dikirim ke grup.

Perubahan `.autoreply` dan `.notify` disimpan di `data/settings.json`, sehingga tetap berlaku setelah restart. Auto reply memakai indikator typing, jeda acak, dan cooldown per pengirim; setiap pesan tetap dapat dinotifikasikan saat cooldown aktif.

## Balasan AI

Bot mengirim balasan teks AI. Tidak ada sticker otomatis yang dikirim bot.

## AI gratis di komputer sendiri

Bot mendukung Ollama lokal, sehingga tidak memerlukan API key atau layanan AI berbayar. Install Ollama untuk Windows dari [situs Ollama](https://ollama.com/download), lalu di Command Prompt jalankan `ollama pull qwen2.5:1.5b`. Ubah `AI_ENABLED=true` pada `.env` dan restart bot. Saat aktif, jawaban teks dari AI dikirim sebelum sticker; jika Ollama mati atau gagal, bot tetap mengirim auto reply biasa. Riwayat AI dibatasi di memori dan tidak ditulis ke `data/`.

`AI_TIMEOUT_MS` mengatur waktu tunggu Ollama. Nilai default 120000 (2 menit) sesuai untuk pemuatan pertama model yang lebih besar seperti 7B.

### OpenAI API

Untuk memakai OpenAI, isi `OPENAI_API_KEY` di `.env`, lalu gunakan `AI_PROVIDER=openai` dan `OPENAI_MODEL=gpt-5-mini`. API ini berbayar sesuai pemakaian dan API key harus dirahasiakan. Bot memakai endpoint Responses API dengan `store: false`; riwayat pendek tetap dikelola lokal di RAM. Untuk kembali ke AI lokal gratis, ubah `AI_PROVIDER=ollama`.

### Gemini API free tier

Provider default adalah Gemini. Buat API key melalui [Google AI Studio](https://aistudio.google.com/app/apikey), isi `GEMINI_API_KEY` di `.env`, dan gunakan `AI_PROVIDER=gemini`. Project ini memakai `gemini-3.6-flash`, model terbaru yang diminta Google untuk akun baru. Free tier memiliki kuota terbatas dan input pada tier tersebut dapat dipakai Google untuk meningkatkan produk; jangan kirim informasi sensitif. Untuk kembali ke AI lokal yang tidak mengirim data keluar, gunakan `AI_PROVIDER=ollama`.

`GEMINI_MIN_REQUEST_INTERVAL_MS=8000` mengantrekan request Gemini secara global ketika banyak chat masuk. Ini bukan cooldown: setiap pesan tetap dijawab AI, hanya diproses berurutan untuk mengurangi error 429 pada free tier.

## Nama kontak untuk konteks AI

Set `CONTACTS_ENABLED=true` dan arahkan `CONTACTS_VCF_FILE` ke file vCard Anda. Bot membaca nama dan nomor secara lokal saat mulai, tidak menyimpan ulang seluruh daftar kontak, dan hanya memberi nama kontak yang cocok sebagai konteks untuk percakapan aktif. Jika memakai Gemini free tier, nama kontak aktif tersebut ikut menjadi bagian dari request AI; jangan aktifkan fitur ini bila Anda tidak menyetujui hal tersebut.

Untuk mencegah jawaban chat terpotong oleh reasoning, konfigurasi Gemini memakai `AI_THINKING_LEVEL=low` dan `AI_MAX_OUTPUT_TOKENS=1024`, sementara `AI_MAX_REPLY_CHARS` tetap membatasi panjang pesan WhatsApp.

Jika AI berhasil membuat jawaban, cooldown tidak diterapkan agar setiap pesan dapat ditanggapi. Cooldown hanya digunakan untuk balasan cadangan ketika AI tidak tersedia.

Pesan dari OWNER diverifikasi memakai JID sebelum AI diberi konteks bahwa instruksi tersebut berasal dari OWNER.

Sticker dari pengirim juga diteruskan ke OWNER beserta notifikasi routing, tanpa perlu mengunduhnya. Bot membalas sticker dengan teks AI singkat yang tidak mengaku memahami isi visualnya.

## Update bencana nasional

Dengan `DISASTER_ALERTS_ENABLED=true`, bot mengirim satu ringkasan BMKG nasional ke OWNER saat start dan setiap `DISASTER_ALERT_INTERVAL_MS` (default 1 jam). Ringkasan memuat gempa terbaru, gempa M5+ terbaru, gempa dirasakan, serta tautan resmi peringatan karhutla dan cuaca. Indeks karhutla adalah risiko berbasis kondisi cuaca, bukan konfirmasi kebakaran aktif.

## GIF suasana (opsional)

Set `MOOD_GIF_ENABLED=true`, lalu letakkan video MP4 pendek yang Anda miliki di `assets/gifs/` dengan nama `happy.mp4`, `sad.mp4`, atau `busy.mp4`. Bot mengirimnya sebagai GIF bila kata-kata suasana yang relevan terdeteksi, dengan cooldown per suasana dan pengirim. Bot tidak mengunduh GIF acak dari internet.

Persona panjang dapat disimpan sebagai file teks, misalnya `prompts/mikail.txt`, lalu aktifkan melalui `AI_SYSTEM_PROMPT_FILE=prompts/mikail.txt` di `.env`. Nilai file tersebut mengalahkan `AI_SYSTEM_PROMPT` satu baris.

## Troubleshooting

- **QR tidak muncul:** hapus `auth_info_baileys/` hanya bila Anda memang ingin membuat session baru, kemudian start ulang.
- **"mapping telah expired":** balas notifikasi sebelum `MESSAGE_MAPPING_TTL` (default 24 jam), atau tingkatkan nilai itu di `.env` dan restart.
- **Owner tidak dikenali:** pastikan `OWNER_NUMBER` hanya berisi digit dan sama dengan nomor WhatsApp yang menerima notifikasi.
- **Koneksi putus:** bot mencoba reconnect bertahap hingga batas `RECONNECT_MAX_ATTEMPTS`. Logout, bad session, atau connection replaced tidak direconnect otomatis demi keamanan; login ulang diperlukan.

Baileys adalah library tidak resmi; gunakan hanya pada akun yang Anda kendalikan dan patuhi ketentuan WhatsApp. Bot ini tidak mengumpulkan kontak, melakukan bulk messaging, atau menyimpan isi riwayat chat.
