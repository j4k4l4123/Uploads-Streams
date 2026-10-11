# Spec: RTX VSR Video Streaming Web App (`streaming-app`)

**Tanggal:** 2026-10-11  
**Status:** Approved  
**Tujuan:** Aplikasi web lokal berbasis Node.js untuk upload dan streaming video (MP4, MKV, WebM) dengan dukungan HLS multi-bitrate, serta dioptimalkan secara khusus untuk memicu fitur **NVIDIA RTX Video Super Resolution (VSR)** di browser Chromium (Google Chrome / Microsoft Edge).

---

## 1. Latar Belakang & Persyaratan RTX VSR

Fitur **NVIDIA RTX Video Super Resolution (VSR)** memanfaatkan AI Tensor Core pada GPU GeForce RTX (seri 30/40) untuk meng-upscale dan mempertajam kualitas video secara real-time. Agar RTX VSR aktif:
1. Video harus diputar di browser berbasis Chromium (Google Chrome / Microsoft Edge / Brave) dengan **Hardware Acceleration** aktif.
2. Fitur "Super resolution" aktif di **NVIDIA Control Panel** (`Adjust video image settings -> RTX video enhancement`).
3. Video diputar melalui elemen HTML5 `<video>` native tanpa canvas/WebGL post-processing overlays yang merusak DirectComposition swapchain GPU.
4. Video di-stream melalui protokol web (`http://localhost`) dengan dukungan HTTP 206 Partial Content (Byte-Range) atau HLS (`.m3u8`).
5. Resolusi video asli di-render pada ukuran tampilan yang lebih besar di layar (upscaled), misalnya video 720p/1080p yang diputar di monitor resolusi lebih tinggi atau dalam mode Fullscreen.

---

## 2. Struktur Proyek & Direktori

Struktur proyek mengikuti format modular:

```
streaming-app/
├── src/
│   ├── server.js                   # Entry point Express server
│   ├── routes/
│   │   ├── videos.js               # API CRUD & daftar video
│   │   ├── upload.js               # API upload file video
│   │   ├── stream.js               # Streaming HTTP Byte-Range (206) untuk MP4/WebM
│   │   └── hls.js                  # Penyedia playlist & segmen HLS
│   ├── services/
│   │   ├── ffmpeg.js               # Wrapper FFmpeg / FFprobe (metadata & transmux)
│   │   ├── thumbnail.js            # Pembuat thumbnail otomatis dari frame video
│   │   └── videoProcessor.js       # Orchestrator pemrosesan video & pipeline HLS
│   ├── middleware/
│   │   └── uploadValidation.js     # Validasi format file, ukuran, dan MIME type
│   └── db/
│       └── database.js             # Inisialisasi & query SQLite
├── storage/
│   ├── uploads/                    # File video original yang di-upload
│   ├── hls/
│   │   └── <video-id>/             # Output HLS per video
│   │       ├── master.m3u8
│   │       ├── 720p/
│   │       └── 360p/
│   ├── thumbnails/                 # Gambar thumbnail video (.jpg)
│   └── temp/                       # Direktori temporary saat konversi
├── data/
│   └── videos.db                   # File database SQLite
├── public/
│   ├── index.html                  # Halaman utama (dashboard, upload & gallery)
│   ├── css/
│   │   └── style.css               # Desain dark cinema modern
│   └── js/
│       ├── app.js                  # Logika upload, fetch video, dan interaksi UI
│       └── player.js               # Video player controller & VSR real-time metrics
├── .env                            # Konfigurasi port, batas upload, & path
├── .gitignore
└── package.json
```

---

## 3. Komponen & Teknologi

- **Backend Runtime:** Node.js (v20+ LTS).
- **Web Framework:** Express.js.
- **Database:** SQLite (`better-sqlite3` atau `sqlite3`) di `data/videos.db`.
- **Upload Handler:** `multer` dengan validasi ekstensi (`.mp4`, `.mkv`, `.webm`) dan MIME type.
- **Video Processing:** `ffmpeg` dan `ffprobe` (terpasang via winget).
- **Frontend:** Pure HTML5, CSS3 (Modern Cinema Dark Theme), Vanilla JavaScript + `hls.js` (via CDN / bundle) untuk HLS playback.

---

## 4. Skema Database (`data/videos.db`)

Tabel `videos`:
- `id` (TEXT PRIMARY KEY) - UUID unik untuk video.
- `title` (TEXT) - Judul video (default: nama file asli tanpa ekstensi).
- `original_name` (TEXT) - Nama file asli saat di-upload.
- `filename` (TEXT) - Nama file unik di folder `storage/uploads/`.
- `format` (TEXT) - Ekstensi format (`mp4`, `mkv`, `webm`).
- `size` (INTEGER) - Ukuran file dalam bytes.
- `duration` (REAL) - Durasi video dalam detik.
- `width` (INTEGER) - Lebar resolusi video asli.
- `height` (INTEGER) - Tinggi resolusi video asli.
- `codec` (TEXT) - Video codec (misal `h264`, `hevc`, `vp9`).
- `thumbnail_path` (TEXT) - Path file thumbnail.
- `hls_status` (TEXT) - Status proses HLS (`none`, `pending`, `processing`, `ready`, `error`).
- `created_at` (DATETIME) - Waktu upload.

---

## 5. Alur Pemrosesan Video (Hybrid Pipeline)

1. **Upload:**
   - Pengguna mengunggah file via drag-and-drop di antarmuka web.
   - `uploadValidation.js` memeriksa format (`mp4`, `mkv`, `webm`).
   - File disimpan sementara di `storage/uploads/`.
   - `ffmpeg.js` mengekstrak metadata (resolusi, durasi, codec) via `ffprobe`.
   - `thumbnail.js` membuat snapshot thumbnail pada detik ke-2 atau 10% durasi.
   - Data video disimpan ke `data/videos.db`.

2. **Jalur Pemutaran (Hybrid):**
   - **MP4 & WebM:**
     - Langsung dapat diputar seketika melalui `/api/stream/:id`.
     - Route `stream.js` memproses header `Range: bytes=start-end` dan merespons dengan HTTP `206 Partial Content`.
     - Pengguna juga dapat menekan tombol "Generate HLS" jika ingin membuat segmen multi-bitrate.
   - **MKV:**
     - Karena browser Chromium tidak mendukung kontainer MKV secara native, MKV otomatis masuk antrean pemrosesan di `videoProcessor.js`.
     - Status dicatat `processing`.
     - FFmpeg mengonversi MKV menjadi HLS multi-variant:
       - `720p` (atau sumber jika di bawah 720p)
       - `360p`
       - `master.m3u8`
     - Video codec dipertahankan (jika H.264/HEVC) atau di-transcode ringan, audio di-transcode ke AAC stereo.
     - Setelah selesai, status berubah menjadi `ready`.

---

## 6. Integrasi & Indikator RTX VSR

1. **Hardware Pipeline Preservation:**
   - Elemen `<video>` murni dihubungkan langsung ke window compositor tanpa filter CSS backdrop/canvas drawing yang dapat merusak video processor swapchain NVIDIA.
2. **Real-time VSR Scale Monitor:**
   - Player mendeteksi `video.videoWidth` x `video.videoHeight` (resolusi sumber) dan membandingkannya dengan `video.getBoundingClientRect()` (ukuran render di layar).
   - Menghitung rasio upscaling: `Scale Factor = Render Width / Native Width`.
   - Menampilkan status langsung di player:
     - Hijau: "RTX VSR Active (Upscaling: 1.5x / Fullscreen)" ketika `Scale Factor > 1.0`.
     - Kuning: "1:1 Native Resolution (Fullscreen untuk memicu VSR)".
3. **Panduan Konfigurasi:**
   - Modal checklist singkat dalam aplikasi:
     - [ ] Gunakan Google Chrome / Microsoft Edge.
     - [ ] Aktifkan `Hardware Acceleration` di `chrome://settings/system`.
     - [ ] Buka NVIDIA Control Panel -> `Adjust video image settings` -> Centang `RTX video enhancement / Super resolution` (Quality 1-4).

---

## 7. Desain Antarmuka Pengguna (UI/UX)

1. **Dashboard Utama:**
   - Navbar dengan logo modern, tombol panduan RTX VSR, dan indikator status server.
   - Upload Dropzone yang responsif dengan animasi drag over dan progress bar.
   - Filter & Tab: "Semua Video", "MP4/WebM", "MKV (HLS)".
   - Grid Kartu Video dengan thumbnail, badge format, badge resolusi asli (misal `1080p`), dan tombol tonton.
2. **Halaman / Modal Video Player:**
   - Layar pemutar bioskop (Theater Mode) & Fullscreen.
   - Switcher otomatis: Menggunakan `hls.js` jika HLS siap, atau native stream jika MP4/WebM.
   - Kontrol kustom: Play/Pause, Seekbar responsif, Volume/Mute, Kecepatan (0.5x - 2.0x), Picture-in-Picture, Fullscreen.
   - Overlay status VSR di pojok atas player (dapat di-minimize).

---

## 8. Penanganan Error (Error Handling)

- **File Tidak Didukung:** Dikembalikan HTTP 400 dengan pesan kesalahan deskriptif.
- **Kegagalan FFmpeg:** Log error dicatat ke console, status video diubah ke `error` di database, dan UI menampilkan tombol "Retry Transcode".
- **Invalid Byte-Range:** Jika range request di luar jangkauan file, server mengembalikan HTTP 416 `Range Not Satisfiable`.
- **HLS Segment Not Found:** Jika playlist atau chunk hilang, dikembalikan HTTP 404 tanpa menghentikan server.

---

## 9. Rencana Pengujian (Testing Plan)

1. **Uji Instalasi & Prasyarat:** Verifikasi Node.js dan FFmpeg di sistem Windows.
2. **Uji Upload:** Unggah sampel MP4, WebM, dan MKV; verifikasi file tersimpan dan record database dibuat.
3. **Uji Metadata & Thumbnail:** Verifikasi thumbnail ter-generate di `storage/thumbnails/` dan resolusi terbaca akurat.
4. **Uji Byte-Range Streaming:** Request potongan video dengan `curl` atau browser dan verifikasi header `Content-Range` serta status `206`.
5. **Uji HLS Conversion:** Verifikasi pembuatan `master.m3u8` dan segmen `.ts` untuk file MKV.
6. **Uji RTX VSR in Browser:** Buka di Google Chrome / Edge, putar video 720p dalam mode fullscreen di layar 1080p/1440p, dan verifikasi visual peningkatan ketajaman serta indikator rasio upscaling.
