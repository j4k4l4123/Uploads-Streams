# Sequential Multiple Video Upload Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan fitur multiple video upload secara berurutan (sequential queue) via drag-and-drop dan file picker dengan indikator status/progress real-time, lalu mem-push perubahan kode ke remote repository Git.

**Architecture:** Frontend mengelola antrean client-side (`uploadQueue`), memvalidasi setiap file (`.mp4`, `.mkv`, `.webm`), dan mengirimkan video satu per satu ke endpoint backend `POST /api/upload` via `XMLHttpRequest`. Progress dan status per file serta keseluruhan antrean diperbarui secara dinamis di UI. Jika suatu file gagal, proses tetap berlanjut ke file berikutnya.

**Tech Stack:** JavaScript (ES6+), HTML5, Express.js, Node.js, Git.

---

### Task 1: Enable Multiple Selection in Frontend HTML

**Files:**
- Modify: `public/index.html:37`

- [x] **Step 1: Update file input to allow multiple files**
Edit [`public/index.html`](file:///C:/Users/ALVIN%20DWI%20LINTANG%20H/.openclaw/workspace/Project%20an/Upload%20And%20Stream/public/index.html) baris 37 untuk menambahkan atribut `multiple`:
```html
<input type="file" id="fileInput" accept=".mp4,.mkv,.webm" multiple hidden>
```

- [x] **Step 2: Verify HTML change**
Periksa bahwa tag `<input type="file" ... multiple hidden>` memiliki atribut `multiple`.

- [x] **Step 3: Commit Task 1**
```powershell
git add public/index.html
git commit -m "feat: enable multiple file selection attribute in file input"
```

---

### Task 2: Implement Sequential Upload Queue in Frontend JavaScript

**Files:**
- Modify: `public/js/app.js:11-98`

- [x] **Step 1: Write sequential queue manager in `public/js/app.js`**
Ganti fungsi `initDropzone()` dan `uploadFile()` di [`public/js/app.js`](file:///C:/Users/ALVIN%20DWI%20LINTANG%20H/.openclaw/workspace/Project%20an/Upload%20And%20Stream/public/js/app.js) dengan logika antrean berurutan:
```javascript
let uploadQueue = [];
let uploadQueueIndex = 0;
let isQueueUploading = false;
let queueStats = { success: 0, failed: 0 };

function initDropzone() {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) enqueueFiles(files);
  });

  fileInput.addEventListener('change', () => {
    const files = Array.from(fileInput.files || []);
    if (files.length > 0) enqueueFiles(files);
    fileInput.value = ''; // Reset input agar file yang sama bisa dipilih kembali jika perlu
  });
}

function enqueueFiles(files) {
  const allowed = ['.mp4', '.mkv', '.webm'];
  const validFiles = [];
  const rejectedFiles = [];

  files.forEach(file => {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (allowed.includes(ext)) {
      validFiles.push(file);
    } else {
      rejectedFiles.push(file.name);
    }
  });

  if (rejectedFiles.length > 0) {
    alert(`File berikut dilewati karena format tidak didukung (hanya MP4, MKV, WebM):\n- ${rejectedFiles.join('\n- ')}`);
  }

  if (validFiles.length === 0) return;

  validFiles.forEach(f => uploadQueue.push(f));

  if (!isQueueUploading) {
    uploadQueueIndex = 0;
    queueStats = { success: 0, failed: 0 };
    processNextInQueue();
  }
}

function processNextInQueue() {
  const progressContainer = document.getElementById('uploadProgressContainer');
  const progressFill = document.getElementById('progressFill');
  const progressPercentage = document.getElementById('uploadPercentage');
  const uploadFileName = document.getElementById('uploadFileName');
  const progressStatus = document.getElementById('progressStatus');

  if (uploadQueueIndex >= uploadQueue.length) {
    // Seluruh antrean selesai
    isQueueUploading = false;
    const totalProcessed = queueStats.success + queueStats.failed;
    progressStatus.textContent = `Selesai! ${queueStats.success} berhasil, ${queueStats.failed} gagal diunggah.`;
    progressFill.style.width = '100%';
    progressPercentage.textContent = '100%';
    uploadFileName.textContent = `Antrean Selesai (${totalProcessed} video)`;

    setTimeout(() => {
      progressContainer.style.display = 'none';
      uploadQueue = [];
      uploadQueueIndex = 0;
      loadVideos();
    }, 2000);
    return;
  }

  isQueueUploading = true;
  const currentFile = uploadQueue[uploadQueueIndex];
  const totalFiles = uploadQueue.length;
  const currentNumber = uploadQueueIndex + 1;

  progressContainer.style.display = 'block';
  uploadFileName.textContent = `[${currentNumber}/${totalFiles}] ${currentFile.name}`;
  progressFill.style.width = '0%';
  progressPercentage.textContent = '0%';
  progressStatus.textContent = `Mengunggah file ${currentNumber} dari ${totalFiles}...`;

  const formData = new FormData();
  formData.append('video', currentFile);

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/upload', true);

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const percent = Math.round((e.loaded / e.total) * 100);
      progressFill.style.width = `${percent}%`;
      progressPercentage.textContent = `${percent}%`;
      if (percent === 100) {
        progressStatus.textContent = `Memproses metadata & thumbnail (${currentNumber}/${totalFiles})...`;
      }
    }
  };

  const moveToNext = () => {
    uploadQueueIndex++;
    processNextInQueue();
  };

  xhr.onload = () => {
    if (xhr.status === 201 || xhr.status === 200) {
      queueStats.success++;
      progressStatus.textContent = `Berhasil mengunggah ${currentFile.name}!`;
    } else {
      queueStats.failed++;
      let err = 'Upload gagal';
      try { err = JSON.parse(xhr.responseText).error; } catch(e){}
      console.warn(`Gagal upload ${currentFile.name}:`, err);
      progressStatus.textContent = `Gagal mengunggah ${currentFile.name}. Melanjutkan antrean...`;
    }
    // Lanjut ke file berikutnya dengan jeda singkat untuk transisi UI yang halus
    setTimeout(moveToNext, 600);
  };

  xhr.onerror = () => {
    queueStats.failed++;
    console.error(`Kesalahan jaringan pada ${currentFile.name}`);
    progressStatus.textContent = `Kesalahan koneksi saat mengunggah ${currentFile.name}. Melanjutkan antrean...`;
    setTimeout(moveToNext, 600);
  };

  xhr.send(formData);
}
```

- [x] **Step 2: Verify Syntax & Logic**
Pastikan tidak ada syntax error pada `public/js/app.js`.

- [x] **Step 3: Commit Task 2**
```powershell
git add public/js/app.js
git commit -m "feat: implement sequential client-side upload queue with status tracking"
```

---

### Task 3: Test Verification

**Files:**
- Test: `tests/*.test.js`

- [x] **Step 1: Run automated test suite**
```powershell
npm test
```
Expected output: 5 passing tests with exit code 0.

- [x] **Step 2: Commit any test adjustments if needed**

---

### Task 4: Push to Remote Git Repository

**Files:**
- Git remote: `origin/master`

- [x] **Step 1: Check git status**
```powershell
git status
```
Expected: Clean working tree on master branch.

- [x] **Step 2: Push commits to GitHub**
```powershell
git push origin master
```
Expected: Commits pushed successfully to `https://github.com/j4k4l4123/Uploads-Streams.git`.
