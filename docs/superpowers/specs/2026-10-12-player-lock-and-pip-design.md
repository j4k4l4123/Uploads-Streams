# Desain Fitur: Player Lock (Focus Mode) & Picture-in-Picture (PiP)

## 1. Ringkasan & Tujuan
Menambahkan dua fitur peningkatan pengalaman menonton pada StreamHub video player:
1. **Mode Kunci / Fokus (Lock Mode):** Menyembunyikan kursor mouse dan seluruh elemen kontrol/HUD saat menonton sehingga tidak menghalangi tayangan video, dilengkapi auto-hide kursor saat mouse diam selama 2.5 detik, tombol unlock melayang, dan shortcut keyboard `L`.
2. **Picture-in-Picture (PiP):** Memungkinkan video diputar dalam jendela melayang (*floating window*) di tingkat sistem operasi (desktop Windows) menggunakan native W3C Picture-in-Picture API, sehingga pengguna tetap bisa menonton saat berpindah tab atau menggunakan aplikasi lain.

---

## 2. Arsitektur & Perubahan Komponen

### A. Antarmuka HTML ([`public/index.html`](file:///C:/Users/ALVIN%20DWI%20LINTANG%20H/.openclaw/workspace/Project%20an/Upload%20And%20Stream/public/index.html))
- Di dalam `.player-wrapper`:
  - Menambahkan tombol unlock overlay:
    ```html
    <button id="btnUnlockOverlay" class="btn-unlock-overlay" style="display: none;">
      🔓 Buka Kunci Layar
    </button>
    ```
- Di dalam `.player-tools`:
  - Menambahkan tombol kontrol:
    ```html
    <button class="btn btn-sm btn-outline" id="btnToggleLock">🔒 Mode Fokus</button>
    <button class="btn btn-sm btn-outline" id="btnTogglePip">📺 Picture-in-Picture</button>
    ```

### B. Styling CSS ([`public/css/style.css`](file:///C:/Users/ALVIN%20DWI%20LINTANG%20H/.openclaw/workspace/Project%20an/Upload%20And%20Stream/public/css/style.css))
- **`.is-locked` pada `.player-modal` / `.player-wrapper`:**
  - Menyembunyikan kursor kursor mouse: `cursor: none !important;`.
  - Menyembunyikan header modal, player-tools, dan HUD VSR (`opacity: 0; pointer-events: none; transition: opacity 0.3s ease;`).
- **`.is-idle-hidden` pada `.player-wrapper`:**
  - Menyembunyikan kursor saat mouse tidak bergerak selama 2.5 detik selama video diputar.
- **`.btn-unlock-overlay`:**
  - Posisi `absolute`, pojok kanan atas player wrapper, latar belakang gelap semi-transparan dengan aksen border glow hijau, `z-index: 20`.

### C. Logika Kontrol ([`public/js/player.js`](file:///C:/Users/ALVIN%20DWI%20LINTANG%20H/.openclaw/workspace/Project%20an/Upload%20And%20Stream/public/js/player.js))
- **Mode Kunci & Auto-Hide:**
  - State: `isPlayerLocked` (boolean), `mouseIdleTimer`, `unlockOverlayTimer`.
  - Fungsi `setLockMode(locked)`: mengatur kelas CSS, status tombol, dan visibilitas tombol unlock.
  - Event `mousemove` pada player:
    - Jika terkunci: tampilkan `#btnUnlockOverlay`, set timer 2.5s untuk menyembunyikannya kembali.
    - Jika tidak terkunci dan video playing: reset timer 2.5s untuk auto-hide kursor (`is-idle-hidden`).
  - Keyboard shortcuts:
    - Tombol `L`: toggle lock mode.
    - Tombol `Escape`: buka kunci jika sedang terkunci, atau tutup player jika tidak terkunci.
- **Picture-in-Picture (PiP):**
  - Cek ketersediaan `document.pictureInPictureEnabled`.
  - Fungsi `togglePictureInPicture()`:
    - Jika `document.pictureInPictureElement`: `document.exitPictureInPicture()`.
    - Lainnya: `mainVideo.requestPictureInPicture()`.
  - Listener event `enterpictureinpicture` & `leavepictureinpicture` pada `mainVideo` untuk memperbarui teks tombol.

---

## 3. Strategi Pengujian (Testing)
1. Menjalankan test suite otomatis `npm test` untuk memastikan tidak ada efek samping pada fungsionalitas streaming, database, dan pemrosesan HLS/FFmpeg.
2. Memverifikasi fungsionalitas event listener Lock mode, keyboard shortcut, dan fallback PiP API secara manual di browser.
