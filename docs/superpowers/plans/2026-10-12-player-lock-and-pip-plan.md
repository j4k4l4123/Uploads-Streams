# Player Lock Mode & Picture-in-Picture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan fitur Mode Kunci/Fokus (Lock Mode) untuk menyembunyikan kursor & elemen yang menghalangi video, serta fitur Picture-in-Picture (PiP) agar video dapat diputar di jendela melayang desktop saat membuka aplikasi lain.

**Architecture:** Modifikasi DOM player pada `public/index.html` dengan tombol Lock & PiP, aturan CSS di `public/css/style.css` untuk kelas `.is-locked` dan `.is-idle-hidden`, serta pengontrol interaksi di `public/js/player.js` menggunakan W3C Picture-in-Picture API dan event listener mouse/keyboard.

**Tech Stack:** JavaScript (ES6+), HTML5 Video API, CSS3 Transitions, Node.js, Git.

---

### Task 1: Add HTML Controls for Lock Mode & PiP

**Files:**
- Modify: `public/index.html:87-105`

- [x] **Step 1: Add unlock overlay button inside `.player-wrapper`**
Tambahkan tombol `#btnUnlockOverlay` tepat setelah `<video id="mainVideo" controls playsinline></video>` di [`public/index.html`](file:///C:/Users/ALVIN%20DWI%20LINTANG%20H/.openclaw/workspace/Project%20an/Upload%20And%20Stream/public/index.html):
```html
<button id="btnUnlockOverlay" class="btn-unlock-overlay" style="display: none;">
  🔓 Buka Kunci Layar
</button>
```

- [x] **Step 2: Add Lock and PiP buttons in `.player-tools`**
Tambahkan tombol `#btnToggleLock` dan `#btnTogglePip` di dalam `.player-tools`:
```html
<button class="btn btn-sm btn-outline" id="btnToggleLock">🔒 Mode Fokus</button>
<button class="btn btn-sm btn-outline" id="btnTogglePip">📺 Picture-in-Picture</button>
```

- [x] **Step 3: Commit Task 1**
```powershell
git add public/index.html
git commit -m "feat: add lock mode and pip buttons to player HTML markup"
```

---

### Task 2: Implement CSS Styles for Lock Mode, Auto-Hide & Overlay

**Files:**
- Modify: `public/css/style.css`

- [x] **Step 1: Add Lock, Idle, and Overlay styles in `public/css/style.css`**
Tambahkan style berikut ke akhir [`public/css/style.css`](file:///C:/Users/ALVIN%20DWI%20LINTANG%20H/.openclaw/workspace/Project%20an/Upload%20And%20Stream/public/css/style.css):
```css
/* Lock / Focus Mode & Auto-Hide Styles */
.player-modal.is-locked .player-header,
.player-modal.is-locked .player-tools,
.player-modal.is-locked .vsr-hud {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
}

.player-wrapper.is-locked,
.player-wrapper.is-locked video,
.player-wrapper.is-idle-hidden,
.player-wrapper.is-idle-hidden video {
  cursor: none !important;
}

/* Floating Unlock Button */
.btn-unlock-overlay {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(15, 17, 23, 0.85);
  backdrop-filter: blur(8px);
  color: var(--primary);
  border: 1px solid var(--primary);
  box-shadow: 0 0 14px rgba(0, 255, 136, 0.3);
  padding: 10px 18px;
  border-radius: 24px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  z-index: 50;
  transition: all 0.25s ease;
  pointer-events: auto;
}

.btn-unlock-overlay:hover {
  background: var(--primary);
  color: #0b0d13;
  box-shadow: 0 0 20px rgba(0, 255, 136, 0.6);
  transform: scale(1.05);
}

.btn.active-tool {
  background: rgba(0, 255, 136, 0.15);
  border-color: var(--primary);
  color: var(--primary);
}
```

- [x] **Step 2: Commit Task 2**
```powershell
git add public/css/style.css
git commit -m "feat: add css rules for player lock mode, cursor auto-hide and unlock overlay"
```

---

### Task 3: Implement Lock Mode and PiP Controller Logic

**Files:**
- Modify: `public/js/player.js`

- [x] **Step 1: Add Lock Mode state and logic in `public/js/player.js`**
Definisikan variabel state:
```javascript
let isPlayerLocked = false;
let mouseIdleTimer = null;
let unlockOverlayTimer = null;
```

Tambahkan fungsi `setLockMode(locked)`:
```javascript
function setLockMode(locked) {
  isPlayerLocked = locked;
  const modal = document.getElementById('playerModal');
  const wrapper = document.querySelector('.player-wrapper');
  const btnLock = document.getElementById('btnToggleLock');
  const btnUnlock = document.getElementById('btnUnlockOverlay');

  if (isPlayerLocked) {
    modal.classList.add('is-locked');
    wrapper.classList.add('is-locked');
    if (btnLock) {
      btnLock.classList.add('active-tool');
      btnLock.textContent = '🔓 Buka Kunci';
    }
    showUnlockOverlayTemporarily();
  } else {
    modal.classList.remove('is-locked');
    wrapper.classList.remove('is-locked');
    wrapper.classList.remove('is-idle-hidden');
    if (btnLock) {
      btnLock.classList.remove('active-tool');
      btnLock.textContent = '🔒 Mode Fokus';
    }
    if (btnUnlock) btnUnlock.style.display = 'none';
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
```

Tambahkan logika Picture-in-Picture:
```javascript
async function togglePictureInPicture() {
  const mainVideo = document.getElementById('mainVideo');
  if (!document.pictureInPictureEnabled) {
    alert('Browser Anda tidak mendukung Picture-in-Picture.');
    return;
  }

  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else if (mainVideo.readyState >= 1 || !mainVideo.paused) {
      await mainVideo.requestPictureInPicture();
    } else {
      alert('Putar video terlebih dahulu untuk mengaktifkan Picture-in-Picture.');
    }
  } catch (err) {
    console.warn('PiP error:', err.message);
  }
}
```

- [x] **Step 2: Connect event listeners in `document.addEventListener('DOMContentLoaded')`**
Hubungkan:
- `#btnToggleLock` klik ➔ `setLockMode(!isPlayerLocked)`.
- `#btnUnlockOverlay` klik ➔ `setLockMode(false)`.
- `#btnTogglePip` klik ➔ `togglePictureInPicture()`.
- `mainVideo.addEventListener('enterpictureinpicture')` ➔ ubah teks tombol menjadi `"📺 Keluar PiP"`, tambahkan class `active-tool`.
- `mainVideo.addEventListener('leavepictureinpicture')` ➔ ubah teks tombol menjadi `"📺 Picture-in-Picture"`, hapus class `active-tool`.
- Wrapper `mousemove`:
  - Jika `isPlayerLocked`: panggil `showUnlockOverlayTemporarily()`.
  - Jika tidak locked dan video playing: hapus `.is-idle-hidden`, reset `mouseIdleTimer` (2500ms) untuk menambahkan `.is-idle-hidden`.
- Keyboard handler:
  - Tombol `l` atau `L`: toggle lock mode jika modal terbuka.
  - Tombol `Escape`: jika sedang locked, panggil `setLockMode(false)` terlebih dahulu.
- Pada `closePlayer()`: panggil `setLockMode(false)` dan bersihkan semua timer.

- [x] **Step 3: Commit Task 3**
```powershell
git add public/js/player.js
git commit -m "feat: implement lock mode and picture-in-picture controller in player.js"
```

---

### Task 4: Run Tests & Verification

**Files:**
- Test: `tests/*.test.js`

- [x] **Step 1: Run automated test suite**
```powershell
npm test
```
Expected: 5 passing tests with exit code 0.

---

### Task 5: Push to Remote Git Repository

**Files:**
- Git remote: `origin/master`

- [x] **Step 1: Push changes to GitHub**
```powershell
git push origin master
```
Expected: All commits pushed successfully.
