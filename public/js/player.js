// Video Player Controller with HLS.js and Real-Time RTX VSR HUD
let hlsInstance = null;
let vsrPollTimer = null;
let currentVideoData = null;

function openPlayer(videoId) {
  const video = allVideos.find(v => v.id === videoId);
  if (!video) return;
  currentVideoData = video;

  const modal = document.getElementById('playerModal');
  const mainVideo = document.getElementById('mainVideo');
  const titleEl = document.getElementById('playerVideoTitle');
  const metaEl = document.getElementById('playerVideoMeta');
  const btnHls = document.getElementById('btnGenerateHls');

  titleEl.textContent = video.title;
  metaEl.textContent = `${video.width || '?'}x${video.height || '?'} • ${video.format.toUpperCase()} • ${video.codec || 'Native'}`;

  // Reset video & HLS
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }
  mainVideo.removeAttribute('src');
  mainVideo.load();

  // Route playback: HLS vs Direct
  if (video.hls_status === 'ready') {
    const hlsUrl = `/api/hls/${video.id}/master.m3u8`;
    if (window.Hls && Hls.isSupported()) {
      hlsInstance = new Hls({ enableWorker: true });
      hlsInstance.loadSource(hlsUrl);
      hlsInstance.attachMedia(mainVideo);
      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        mainVideo.play().catch(() => {});
      });
    } else if (mainVideo.canPlayType('application/vnd.apple.mpegurl')) {
      mainVideo.src = hlsUrl;
      mainVideo.play().catch(() => {});
    }
    btnHls.style.display = 'none';
  } else {
    // Direct stream (MP4 / WebM)
    mainVideo.src = `/api/stream/${video.id}`;
    mainVideo.play().catch(() => {});

    if (video.format !== 'mkv') {
      btnHls.style.display = 'inline-block';
      btnHls.onclick = () => triggerHlsGeneration(video.id);
    } else {
      btnHls.style.display = 'none';
    }
  }

  modal.classList.add('active');
  startVsrMonitoring(mainVideo);
}

function closePlayer() {
  const modal = document.getElementById('playerModal');
  const mainVideo = document.getElementById('mainVideo');

  mainVideo.pause();
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }
  mainVideo.removeAttribute('src');
  modal.classList.remove('active');

  if (vsrPollTimer) {
    clearInterval(vsrPollTimer);
    vsrPollTimer = null;
  }
}

// RTX VSR Scale & DirectComposition Monitor
function startVsrMonitoring(videoElement) {
  if (vsrPollTimer) clearInterval(vsrPollTimer);

  const vsrBadge = document.getElementById('vsrBadge');
  const vsrStatusText = document.getElementById('vsrStatusText');
  const vsrResolution = document.getElementById('vsrResolution');
  const vsrScale = document.getElementById('vsrScale');

  vsrPollTimer = setInterval(() => {
    if (!videoElement || videoElement.paused || !videoElement.videoWidth) {
      return;
    }

    const nativeW = videoElement.videoWidth;
    const nativeH = videoElement.videoHeight;
    const rect = videoElement.getBoundingClientRect();
    const renderW = Math.round(rect.width * window.devicePixelRatio);
    const renderH = Math.round(rect.height * window.devicePixelRatio);

    const scaleFactor = (renderW / nativeW).toFixed(2);

    vsrResolution.textContent = `Native: ${nativeW}x${nativeH} ➔ Screen: ${renderW}x${renderH}`;
    vsrScale.textContent = `Scale: ${scaleFactor}x`;

    // RTX VSR activates when scale factor > 1.0 (video is being upscaled on display)
    if (scaleFactor > 1.05) {
      vsrBadge.classList.add('active');
      vsrStatusText.textContent = `RTX VSR Active (${scaleFactor}x AI Upscaling)`;
    } else {
      vsrBadge.classList.remove('active');
      vsrStatusText.textContent = `1:1 Native (Fullscreen untuk VSR)`;
    }
  }, 500);
}

async function triggerHlsGeneration(videoId) {
  try {
    const res = await fetch(`/api/videos/${videoId}/hls`, { method: 'POST' });
    if (res.ok) {
      alert('Proses HLS multi-bitrate sedang dijalankan di latar belakang!');
      loadVideos();
    }
  } catch (err) {
    alert('Gagal memicu konversi HLS');
  }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  const btnClose = document.getElementById('btnClosePlayer');
  const backdrop = document.getElementById('modalBackdrop');
  const btnFullscreen = document.getElementById('btnToggleFullscreen');
  const mainVideo = document.getElementById('mainVideo');

  if (btnClose) btnClose.addEventListener('click', closePlayer);
  if (backdrop) backdrop.addEventListener('click', closePlayer);

  if (btnFullscreen) {
    btnFullscreen.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        if (mainVideo.requestFullscreen) {
          mainVideo.requestFullscreen();
        } else if (mainVideo.webkitRequestFullscreen) {
          mainVideo.webkitRequestFullscreen();
        }
      } else {
        document.exitFullscreen();
      }
    });
  }

  // Handle ESC key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('playerModal')?.classList.contains('active')) {
      closePlayer();
    }
  });
});
