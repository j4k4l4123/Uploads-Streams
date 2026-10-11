# 🎬 StreamHub - RTX VSR Video Streaming Web App

Aplikasi web lokal modern berbasis **Node.js**, **Express**, dan **SQLite** untuk upload dan streaming video (MP4, MKV, WebM) yang dioptimalkan secara khusus untuk memicu fitur **NVIDIA RTX Video Super Resolution (VSR)** di browser Chromium (Google Chrome / Microsoft Edge).

---

## ✨ Fitur Utama

- ⚡ **Optimasi NVIDIA RTX VSR:** Integrasi native HTML5 `<video>` DirectComposition swapchain dengan HUD monitor status VSR real-time (mendeteksi rasio AI upscaling).
- 🚀 **Hybrid Streaming Engine:**
  - **MP4 & WebM:** Instant direct streaming menggunakan HTTP 206 Byte-Range partial content tanpa perlu tunggu proses konversi.
  - **MKV & Adaptive Streaming:** Transcoding background otomatis ke playlist HLS multi-bitrate (`720p` & `360p`) menggunakan FFmpeg + `hls.js`.
- 📁 **Drag-and-Drop Uploader:** Upload interaktif dengan progress bar real-time hingga 10 GB per file.
- 🖼️ **Thumbnail & Metadata Otomatis:** FFprobe membaca resolusi, durasi, dan codec video, serta membuat thumbnail poster secara otomatis.
- 🎨 **Modern Cinema Dark UI:** Tampilan tema gelap bioskop responsif dan elegan.
- 💾 **100% Penyimpanan Lokal:** File dan database tersimpan di komputer Anda tanpa pihak ketiga/cloud.

---

## 🛠️ Persyaratan Sistem

1. **GPU:** NVIDIA GeForce RTX 30 Series atau 40 Series (dengan driver terbaru).
2. **Browser:** Google Chrome atau Microsoft Edge dengan *Hardware Acceleration* aktif.
3. **Runtime & Tools:**
   - Node.js (v20+ LTS)
   - FFmpeg & FFprobe

---

## 🚀 Panduan Menjalankan

### 1. Clone & Install Dependensi
```bash
git clone https://github.com/j4k4l4123/Uploads-Streams.git
cd Uploads-Streams
npm install
```

### 2. Konfigurasi Environment
Salin file konfigurasi:
```bash
cp .env.example .env
```

### 3. Jalankan Server
```bash
npm start
```
Buka browser di **http://localhost:3000**.

---

## 🟢 Mengaktifkan RTX VSR di Browser

1. **Hardware Acceleration di Browser:**
   - Buka `chrome://settings/system` (atau `edge://settings/system`).
   - Pastikan opsi **"Use graphics acceleration when available"** diaktifkan.
2. **NVIDIA Control Panel:**
   - Buka **NVIDIA Control Panel** ➔ **Adjust video image settings**.
   - Di bawah **RTX video enhancement**, centang **Super resolution** (pilih Quality 1–4).
3. **Putar Video di StreamHub:**
   - Putar video dan klik tombol **Layar Penuh (Fullscreen)**.
   - Indikator HUD VSR di pojok player akan menyala hijau (**RTX VSR Active**).

---

## 🧪 Menjalankan Test Suite
```bash
npm test
```
Semua unit test dan integration test end-to-end akan dijalankan secara otomatis.
