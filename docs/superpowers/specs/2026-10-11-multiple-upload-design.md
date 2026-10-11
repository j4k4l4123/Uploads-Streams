# Desain Fitur: Sequential Multiple Video Upload Queue

## 1. Ringkasan & Tujuan
Menambahkan kemampuan pengunggahan multi-file video (drag-and-drop dan file picker) pada aplikasi StreamHub, di mana beberapa file video yang dipilih/dijatuhkan akan diproses dan diunggah ke server secara berurutan (*sequential queue*) satu per satu. Setelah seluruh proses pengunggahan selesai, antarmuka memperbarui galeri video secara otomatis. Setelah implementasi kode selesai dan teruji, perubahan kode akan langsung di-commit dan di-push ke repository remote Git (`origin/master`).

---

## 2. Arsitektur & Komponen

### A. Frontend Modifikasi ([`public/index.html`](file:///C:/Users/ALVIN%20DWI%20LINTANG%20H/.openclaw/workspace/Project%20an/Upload%20And%20Stream/public/index.html))
- Mengubah atribut `<input type="file" id="fileInput" accept=".mp4,.mkv,.webm" hidden>` menjadi:
  `<input type="file" id="fileInput" accept=".mp4,.mkv,.webm" multiple hidden>`
- Memungkinkan pengguna memilih lebih dari satu file melalui dialog pemilihan file maupun drag-and-drop.

### B. Event Handling & Queue Manager ([`public/js/app.js`](file:///C:/Users/ALVIN%20DWI%20LINTANG%20H/.openclaw/workspace/Project%20an/Upload%20And%20Stream/public/js/app.js))
- **Ekstraksi File:**
  - Event `drop` pada dropzone membaca seluruh file dari `e.dataTransfer.files`.
  - Event `change` pada `fileInput` membaca seluruh file dari `fileInput.files`.
- **Validasi Format:**
  - File difilter berdasarkan ekstensi yang diizinkan (`.mp4`, `.mkv`, `.webm`).
  - File dengan format tidak valid akan dilewati dan dilaporkan.
- **Queue Controller:**
  - Menyimpan array file antrean, indeks file saat ini (`currentIndex`), status proses (`isUploading`), serta counter statistik (`successCount`, `failureCount`).
  - Fungsi `processQueue()` menjalankan upload untuk file pada `currentIndex` menggunakan `XMLHttpRequest` agar event upload progress dapat dipantau secara real-time.
  - Saat satu file selesai (baik berstatus 200/201 atau gagal), sistem mencatat hasil, menaikkan indeks, dan melanjutkan proses file berikutnya secara otomatis.
  - Setelah seluruh item antrean selesai, UI menampilkan status akhir dan memperbarui daftar video dengan memanggil `loadVideos()`.

### C. Tampilan Progress UI
- **Nama File & Nomor Antrean:**
  - `#uploadFileName` menampilkan format: `[X/Total] nama_file.ext`.
- **Progress Bar & Persentase:**
  - `#progressFill` dan `#uploadPercentage` menampilkan persentase pengunggahan file saat ini (0% - 100%).
- **Status Teks:**
  - Menampilkan keterangan: *"Mengunggah file X dari Total..."*, dilanjutkan *"Memproses metadata & thumbnail..."*, dan status akhir *"Selesai! X berhasil, Y gagal"*.

### D. Ketahanan Error (Resilience)
- Jika suatu file gagal diunggah atau server mengembalikan error, proses tidak dihentikan; sistem mencatat kegagalan file tersebut dan langsung berpindah ke file berikutnya dalam antrean.

---

## 3. Strategi Pengujian (Testing)
1. Menjalankan test suite otomatis melalui `npm test` untuk memverifikasi fungsionalitas server, SQLite DB, FFmpeg probing, dan endpoint upload/stream tidak terdampak regresi.
2. Memverifikasi logika antrean pada skrip frontend untuk memastikan urutan eksekusi berurutan berjalan dengan benar.

---

## 4. Alur Git Push
Setelah implementasi dan pengujian selesai:
1. `git add .`
2. `git commit -m "feat: implement sequential multiple video upload queue"`
3. `git push origin master`
