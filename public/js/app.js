// Application logic: Upload, Gallery, Filtering
let allVideos = [];
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
  initDropzone();
  initModals();
  loadVideos();
});

let uploadQueue = [];
let uploadQueueIndex = 0;
let isQueueUploading = false;
let queueStats = { success: 0, failed: 0 };
let completionTimer = null;

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
  if (completionTimer) {
    clearTimeout(completionTimer);
    completionTimer = null;
  }

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

    uploadQueue = [];
    uploadQueueIndex = 0;
    loadVideos();

    completionTimer = setTimeout(() => {
      if (!isQueueUploading) progressContainer.style.display = 'none';
      completionTimer = null;
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
      try {
        const parsed = JSON.parse(xhr.responseText);
        err = parsed.error || parsed.message || err;
      } catch(e){}
      console.warn(`Gagal upload ${currentFile.name}:`, err);
      progressStatus.textContent = `Gagal mengunggah ${currentFile.name}. Melanjutkan antrean...`;
    }
    setTimeout(moveToNext, 600);
  };

  xhr.onerror = () => {
    queueStats.failed++;
    console.error(`Kesalahan jaringan pada ${currentFile.name}`);
    progressStatus.textContent = `Kesalahan koneksi saat mengunggah ${currentFile.name}. Melanjutkan antrean...`;
    setTimeout(moveToNext, 600);
  };

  xhr.ontimeout = () => {
    queueStats.failed++;
    console.error(`Timeout saat mengunggah ${currentFile.name}`);
    progressStatus.textContent = `Waktu habis saat mengunggah ${currentFile.name}. Melanjutkan antrean...`;
    setTimeout(moveToNext, 600);
  };

  xhr.send(formData);
}

async function loadVideos() {
  try {
    const res = await fetch('/api/videos');
    allVideos = await res.json();
    updateFilterCounts();
    renderVideos();
  } catch (err) {
    console.error('Error loading videos:', err);
  }
}

function updateFilterCounts() {
  document.getElementById('countAll').textContent = allVideos.length;
}

function renderVideos() {
  const grid = document.getElementById('videoGrid');
  const empty = document.getElementById('emptyState');
  grid.innerHTML = '';

  const filtered = allVideos.filter(v => {
    if (currentFilter === 'all') return true;
    return v.format === currentFilter;
  });

  if (filtered.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  filtered.forEach(video => {
    const card = document.createElement('div');
    card.className = 'video-card';

    const durationMin = Math.floor((video.duration || 0) / 60);
    const durationSec = Math.floor((video.duration || 0) % 60).toString().padStart(2, '0');
    const durationStr = `${durationMin}:${durationSec}`;
    const resolutionStr = video.width && video.height ? `${video.height}p` : 'HD';

    let hlsBadge = '';
    if (video.hls_status === 'ready') {
      hlsBadge = '<span class="badge-vsr" style="margin-left: 0; margin-top: 4px;">HLS Ready</span>';
    } else if (video.hls_status === 'processing') {
      hlsBadge = '<span class="badge-vsr" style="background: var(--vsr-idle); margin-left: 0; margin-top: 4px;">HLS Processing...</span>';
    }

    card.innerHTML = `
      <div class="card-thumb-wrapper" onclick="openPlayer('${video.id}')">
        <img class="card-thumb" src="${video.thumbnail_path || '/images/default-thumb.jpg'}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'320\\' height=\\'180\\' fill=\\'%23181b24\\'><rect width=\\'100%\\' height=\\'100%\\'/><text x=\\'50%\\' y=\\'50%\\' fill=\\'%238b949e\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\'>🎬 Video</text></svg>'">
        <span class="badge-format">${video.format}</span>
        <span class="badge-res">${resolutionStr}</span>
        <span class="badge-duration">${durationStr}</span>
      </div>
      <div class="card-body">
        <div class="card-title" title="${video.title}">${video.title}</div>
        <div class="card-meta">
          <span>${(video.size / (1024 * 1024)).toFixed(1)} MB</span>
          ${hlsBadge}
        </div>
        <div class="card-actions">
          <button class="btn btn-sm btn-primary" onclick="openPlayer('${video.id}')">▶ Putar</button>
          <button class="btn-delete" onclick="deleteVideo('${video.id}', event)">Hapus</button>
        </div>
      </div>
    `;

    grid.appendChild(card);
  });
}

// Filter button handlers
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderVideos();
  });
});

async function deleteVideo(id, e) {
  e.stopPropagation();
  if (!confirm('Yakin ingin menghapus video ini?')) return;

  try {
    const res = await fetch(`/api/videos/${id}`, { method: 'DELETE' });
    if (res.ok) {
      loadVideos();
    } else {
      alert('Gagal menghapus video.');
    }
  } catch (err) {
    alert('Terjadi kesalahan saat menghapus.');
  }
}

function initModals() {
  const guideModal = document.getElementById('guideModal');
  const btnVsrGuide = document.getElementById('btnVsrGuide');
  const btnCloseGuide = document.getElementById('btnCloseGuide');
  const btnGotIt = document.getElementById('btnGotIt');
  const guideBackdrop = document.getElementById('guideBackdrop');

  const openGuide = () => guideModal.classList.add('active');
  const closeGuide = () => guideModal.classList.remove('active');

  btnVsrGuide.addEventListener('click', openGuide);
  btnCloseGuide.addEventListener('click', closeGuide);
  btnGotIt.addEventListener('click', closeGuide);
  guideBackdrop.addEventListener('click', closeGuide);
}
