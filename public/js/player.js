// Video Player Controller with HLS.js and Real-Time RTX VSR HUD
let hlsInstance = null;
let vsrPollTimer = null;
let currentVideoData = null;
let isPlayerLocked = false;
let mouseIdleTimer = null;
let unlockOverlayTimer = null;

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

  if (document.pictureInPictureElement) {
    document.exitPictureInPicture().catch(() => {});
  }

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

  setLockMode(false);
  if (mouseIdleTimer) {
    clearTimeout(mouseIdleTimer);
    mouseIdleTimer = null;
  }
  if (unlockOverlayTimer) {
    clearTimeout(unlockOverlayTimer);
    unlockOverlayTimer = null;
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

function setLockMode(locked) {
  isPlayerLocked = locked;
  const modal = document.getElementById('playerModal');
  const wrapper = document.querySelector('.player-wrapper');
  const btnLock = document.getElementById('btnToggleLock');
  const btnUnlock = document.getElementById('btnUnlockOverlay');

  if (isPlayerLocked) {
    if (modal) modal.classList.add('is-locked');
    if (wrapper) wrapper.classList.add('is-locked');
    if (btnLock) {
      btnLock.classList.add('active-tool');
      btnLock.textContent = '🔓 Buka Kunci';
    }
    showUnlockOverlayTemporarily();
  } else {
    if (modal) modal.classList.remove('is-locked');
    if (wrapper) {
      wrapper.classList.remove('is-locked');
      wrapper.classList.remove('is-idle-hidden');
    }
    if (btnLock) {
      btnLock.classList.remove('active-tool');
      btnLock.textContent = '🔒 Mode Fokus';
    }
    if (btnUnlock) btnUnlock.style.display = 'none';
    if (unlockOverlayTimer) {
      clearTimeout(unlockOverlayTimer);
      unlockOverlayTimer = null;
    }
  }
}

function showUnlockOverlayTemporarily() {
  const btnUnlock = document.getElementById('btnUnlockOverlay');
  if (!btnUnlock || !isPlayerLocked) return;

  btnUnlock.style.display = 'block';
  btnUnlock.style.opacity = '1';

  if (unlockOverlayTimer) clearTimeout(unlockOverlayTimer);
  unlockOverlayTimer = setTimeout(() => {
    if (isPlayerLocked && btnUnlock) {
      btnUnlock.style.opacity = '0';
      setTimeout(() => {
        if (isPlayerLocked && btnUnlock && btnUnlock.style.opacity === '0') {
          btnUnlock.style.display = 'none';
        }
      }, 300);
    }
  }, 2500);
}

async function togglePictureInPicture() {
  const mainVideo = document.getElementById('mainVideo');
  if (!document.pictureInPictureEnabled) {
    alert('Browser Anda tidak mendukung Picture-in-Picture.');
    return;
  }

  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else if (mainVideo && (mainVideo.readyState >= 1 || !mainVideo.paused)) {
      await mainVideo.requestPictureInPicture();
    } else {
      alert('Putar video terlebih dahulu untuk mengaktifkan Picture-in-Picture.');
    }
  } catch (err) {
    console.warn('PiP error:', err.message);
  }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  const btnClose = document.getElementById('btnClosePlayer');
  const backdrop = document.getElementById('modalBackdrop');
  const btnFullscreen = document.getElementById('btnToggleFullscreen');
  const btnToggleLock = document.getElementById('btnToggleLock');
  const btnUnlockOverlay = document.getElementById('btnUnlockOverlay');
  const btnTogglePip = document.getElementById('btnTogglePip');
  const playerWrapper = document.querySelector('.player-wrapper');
  const mainVideo = document.getElementById('mainVideo');

  if (btnClose) btnClose.addEventListener('click', closePlayer);
  if (backdrop) backdrop.addEventListener('click', closePlayer);

  if (btnToggleLock) {
    btnToggleLock.addEventListener('click', () => setLockMode(!isPlayerLocked));
  }

  if (btnUnlockOverlay) {
    btnUnlockOverlay.addEventListener('click', () => setLockMode(false));
  }

  if (btnTogglePip) {
    btnTogglePip.addEventListener('click', togglePictureInPicture);
  }

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

  if (mainVideo) {
    mainVideo.addEventListener('enterpictureinpicture', () => {
      const btnPip = document.getElementById('btnTogglePip');
      if (btnPip) {
        btnPip.textContent = '📺 Keluar PiP';
        btnPip.classList.add('active-tool');
      }
    });

    mainVideo.addEventListener('leavepictureinpicture', () => {
      const btnPip = document.getElementById('btnTogglePip');
      if (btnPip) {
        btnPip.textContent = '📺 Picture-in-Picture';
        btnPip.classList.remove('active-tool');
      }
    });

    const resetIdleCursor = () => {
      if (playerWrapper) playerWrapper.classList.remove('is-idle-hidden');
      if (mouseIdleTimer) {
        clearTimeout(mouseIdleTimer);
        mouseIdleTimer = null;
      }
    };
    mainVideo.addEventListener('pause', resetIdleCursor);
    mainVideo.addEventListener('ended', resetIdleCursor);
  }

  if (playerWrapper) {
    playerWrapper.addEventListener('mousemove', () => {
      if (isPlayerLocked) {
        showUnlockOverlayTemporarily();
      } else {
        playerWrapper.classList.remove('is-idle-hidden');
        if (mouseIdleTimer) clearTimeout(mouseIdleTimer);
        if (!mainVideo.paused) {
          mouseIdleTimer = setTimeout(() => {
            if (!isPlayerLocked && !mainVideo.paused) {
              playerWrapper.classList.add('is-idle-hidden');
            }
          }, 2500);
        }
      }
    });

    playerWrapper.addEventListener('mouseleave', () => {
      playerWrapper.classList.remove('is-idle-hidden');
      if (mouseIdleTimer) {
        clearTimeout(mouseIdleTimer);
        mouseIdleTimer = null;
      }
    });
  }

  // Handle Keyboard shortcuts (L for lock, ESC to unlock or close)
  window.addEventListener('keydown', (e) => {
    const modal = document.getElementById('playerModal');
    if (!modal || !modal.classList.contains('active')) return;

    if ((e.key === 'l' || e.key === 'L') && !e.ctrlKey && !e.altKey && !e.metaKey) {
      if (['input', 'textarea'].includes(document.activeElement?.tagName?.toLowerCase())) return;
      setLockMode(!isPlayerLocked);
      return;
    }

    if (e.key === 'Escape') {
      if (document.fullscreenElement || document.webkitFullscreenElement) return;
      if (isPlayerLocked) {
        setLockMode(false);
        e.preventDefault();
        e.stopPropagation();
        return;
      } else {
        closePlayer();
      }
    }
  });
});
