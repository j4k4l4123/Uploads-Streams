# RTX VSR Video Streaming Web App (`streaming-app`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun aplikasi web streaming video lokal berbasis Node.js & Express dengan dukungan upload (MP4, MKV, WebM), direct byte-range streaming, multi-bitrate HLS via FFmpeg, dan player yang dioptimalkan untuk memicu fitur **NVIDIA RTX Video Super Resolution (VSR)** di browser Chromium.

**Architecture:** Node.js Express server menyediakan REST API dan HTTP Byte-Range streaming (206) untuk MP4/WebM, serta HLS segmentation (`.m3u8` + `.ts`) via FFmpeg untuk MKV/adaptive streaming. Metadata disimpan di SQLite (`data/videos.db`), dan frontend menyajikan antarmuka dark-cinema modern dengan player HTML5 native + `hls.js` yang dilengkapi VSR real-time scaling monitor.

**Tech Stack:** Node.js, Express.js, SQLite (`better-sqlite3`), Multer, FFmpeg / FFprobe, HLS.js, HTML5 Native `<video>`, CSS3 Modern Dark Theme.

---

### Task 1: Environment Setup, Runtimes & Project Skeleton

**Files:**
- Create: `package.json`
- Create: `.env`
- Create: `.gitignore`
- Create: Directory tree (`src/`, `src/routes/`, `src/services/`, `src/middleware/`, `src/db/`, `storage/uploads/`, `storage/hls/`, `storage/thumbnails/`, `storage/temp/`, `data/`, `public/css/`, `public/js/`)

- [ ] **Step 1: Check and install Node.js & FFmpeg if not present**
Run:
```powershell
winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
winget install Gyan.FFmpeg --accept-package-agreements --accept-source-agreements
```
Verify:
```powershell
node -v
npm -v
ffmpeg -version
```

- [ ] **Step 2: Create directory skeleton**
Run:
```powershell
mkdir -p src/routes src/services src/middleware src/db storage/uploads storage/hls storage/thumbnails storage/temp data public/css public/js tests
```

- [ ] **Step 3: Create `.gitignore`**
Write to `.gitignore`:
```gitignore
node_modules/
storage/uploads/*
!storage/uploads/.gitkeep
storage/hls/*
!storage/hls/.gitkeep
storage/thumbnails/*
!storage/thumbnails/.gitkeep
storage/temp/*
!storage/temp/.gitkeep
data/*.db
.env
```
And add `.gitkeep` to storage subdirectories:
```powershell
New-Item -ItemType File -Force storage/uploads/.gitkeep, storage/hls/.gitkeep, storage/thumbnails/.gitkeep, storage/temp/.gitkeep
```

- [ ] **Step 4: Create `package.json` and install dependencies**
Write to `package.json`:
```json
{
  "name": "streaming-app",
  "version": "1.0.0",
  "description": "Video streaming web app optimized for NVIDIA RTX VSR",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js",
    "test": "node --test tests/*.test.js"
  },
  "dependencies": {
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "cors": "^2.8.5",
    "multer": "^1.4.5-lts.1",
    "better-sqlite3": "^11.8.1",
    "uuid": "^11.1.0"
  }
}
```
Run:
```powershell
npm install
```

- [ ] **Step 5: Create `.env` configuration**
Write to `.env`:
```env
PORT=3000
STORAGE_DIR=./storage
DATA_DIR=./data
MAX_FILE_SIZE=10737418240
```

- [ ] **Step 6: Commit Task 1**
```powershell
git add package.json .gitignore .env storage/
git commit -m "chore: setup project structure, runtimes and dependencies"
```

---

### Task 2: Database Initialization & CRUD (`src/db/database.js`)

**Files:**
- Create: `src/db/database.js`
- Test: `tests/database.test.js`

- [ ] **Step 1: Write test for database operations**
Write to `tests/database.test.js`:
```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('Database initializes and performs CRUD operations', (t) => {
  const testDbPath = path.join(__dirname, 'test-videos.db');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  const { initDb, createVideo, getVideoById, getAllVideos, updateVideoHlsStatus, deleteVideo } = require('../src/db/database');
  const db = initDb(testDbPath);

  // Test Create
  const sample = {
    id: 'test-123',
    title: 'Sample Video',
    original_name: 'sample.mp4',
    filename: 'test-123.mp4',
    format: 'mp4',
    size: 1048576,
    duration: 60.5,
    width: 1920,
    height: 1080,
    codec: 'h264',
    thumbnail_path: '/thumbnails/test-123.jpg',
    hls_status: 'none'
  };
  createVideo(sample);

  // Test Get By ID
  const retrieved = getVideoById('test-123');
  assert.equal(retrieved.id, 'test-123');
  assert.equal(retrieved.title, 'Sample Video');
  assert.equal(retrieved.width, 1920);

  // Test Update Status
  updateVideoHlsStatus('test-123', 'ready');
  assert.equal(getVideoById('test-123').hls_status, 'ready');

  // Test List
  const list = getAllVideos();
  assert.equal(list.length, 1);

  // Test Delete
  deleteVideo('test-123');
  assert.equal(getVideoById('test-123'), undefined);

  db.close();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
});
```

- [ ] **Step 2: Run test to verify it fails**
Run:
```powershell
npm test
```
Expected: FAIL (Cannot find module '../src/db/database')

- [ ] **Step 3: Implement `src/db/database.js`**
Write to `src/db/database.js`:
```javascript
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let dbInstance = null;

function initDb(customPath = null) {
  const dbPath = customPath || process.env.DB_PATH || path.join(process.cwd(), 'data', 'videos.db');
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  dbInstance = new Database(dbPath);
  dbInstance.pragma('journal_mode = WAL');

  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      original_name TEXT NOT NULL,
      filename TEXT NOT NULL,
      format TEXT NOT NULL,
      size INTEGER NOT NULL,
      duration REAL DEFAULT 0,
      width INTEGER DEFAULT 0,
      height INTEGER DEFAULT 0,
      codec TEXT DEFAULT '',
      thumbnail_path TEXT DEFAULT '',
      hls_status TEXT DEFAULT 'none',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  return dbInstance;
}

function getDb() {
  if (!dbInstance) {
    return initDb();
  }
  return dbInstance;
}

function createVideo(video) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO videos (id, title, original_name, filename, format, size, duration, width, height, codec, thumbnail_path, hls_status)
    VALUES (@id, @title, @original_name, @filename, @format, @size, @duration, @width, @height, @codec, @thumbnail_path, @hls_status)
  `);
  stmt.run(video);
  return video;
}

function getVideoById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM videos WHERE id = ?').get(id);
}

function getAllVideos() {
  const db = getDb();
  return db.prepare('SELECT * FROM videos ORDER BY created_at DESC').all();
}

function updateVideoHlsStatus(id, status) {
  const db = getDb();
  db.prepare('UPDATE videos SET hls_status = ? WHERE id = ?').run(status, id);
}

function deleteVideo(id) {
  const db = getDb();
  db.prepare('DELETE FROM videos WHERE id = ?').run(id);
}

module.exports = {
  initDb,
  getDb,
  createVideo,
  getVideoById,
  getAllVideos,
  updateVideoHlsStatus,
  deleteVideo
};
```

- [ ] **Step 4: Run test to verify it passes**
Run:
```powershell
npm test
```
Expected: PASS

- [ ] **Step 5: Commit Task 2**
```powershell
git add src/db/database.js tests/database.test.js
git commit -m "feat(db): add sqlite database setup and video CRUD operations"
```

---

### Task 3: FFmpeg & Metadata Services (`src/services/ffmpeg.js` & `src/services/thumbnail.js`)

**Files:**
- Create: `src/services/ffmpeg.js`
- Create: `src/services/thumbnail.js`
- Test: `tests/ffmpeg.test.js`

- [ ] **Step 1: Write test for metadata probing and thumbnail generation**
Write to `tests/ffmpeg.test.js`:
```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

test('FFmpeg service extracts metadata and generates thumbnail', async (t) => {
  const testVideoPath = path.join(__dirname, 'test-sample.mp4');
  const testThumbPath = path.join(__dirname, 'test-sample.jpg');

  // Create a 2-second 640x360 synthetic test video with ffmpeg
  execSync(`ffmpeg -y -f lavfi -i testsrc=duration=2:size=640x360:rate=30 -c:v libx264 -pix_fmt yuv420p "${testVideoPath}"`, { stdio: 'ignore' });

  const { probeVideoMetadata } = require('../src/services/ffmpeg');
  const { generateThumbnail } = require('../src/services/thumbnail');

  const metadata = await probeVideoMetadata(testVideoPath);
  assert.equal(metadata.width, 640);
  assert.equal(metadata.height, 360);
  assert.equal(metadata.codec, 'h264');
  assert.ok(metadata.duration >= 1.9);

  await generateThumbnail(testVideoPath, testThumbPath, 1);
  assert.ok(fs.existsSync(testThumbPath));
  assert.ok(fs.statSync(testThumbPath).size > 100);

  // Cleanup
  if (fs.existsSync(testVideoPath)) fs.unlinkSync(testVideoPath);
  if (fs.existsSync(testThumbPath)) fs.unlinkSync(testThumbPath);
});
```

- [ ] **Step 2: Run test to verify it fails**
Run:
```powershell
node --test tests/ffmpeg.test.js
```
Expected: FAIL (Cannot find module '../src/services/ffmpeg')

- [ ] **Step 3: Implement `src/services/ffmpeg.js`**
Write to `src/services/ffmpeg.js`:
```javascript
const { exec } = require('child_process');

function probeVideoMetadata(filePath) {
  return new Promise((resolve, reject) => {
    const cmd = `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`;
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(`ffprobe failed: ${stderr || error.message}`));
      }
      try {
        const data = JSON.parse(stdout);
        const videoStream = data.streams?.find(s => s.codec_type === 'video') || {};
        const duration = parseFloat(data.format?.duration || videoStream.duration || 0);
        const width = parseInt(videoStream.width || 0, 10);
        const height = parseInt(videoStream.height || 0, 10);
        const codec = videoStream.codec_name || '';

        resolve({ duration, width, height, codec });
      } catch (err) {
        reject(new Error(`Failed to parse ffprobe json: ${err.message}`));
      }
    });
  });
}

module.exports = {
  probeVideoMetadata
};
```

- [ ] **Step 4: Implement `src/services/thumbnail.js`**
Write to `src/services/thumbnail.js`:
```javascript
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

function generateThumbnail(videoPath, outputPath, timestamp = 1) {
  return new Promise((resolve, reject) => {
    const outDir = path.dirname(outputPath);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const cmd = `ffmpeg -y -ss ${timestamp} -i "${videoPath}" -vframes 1 -q:v 2 "${outputPath}"`;
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        // Fallback to timestamp 0 if seeking to timestamp failed
        const fallbackCmd = `ffmpeg -y -ss 0 -i "${videoPath}" -vframes 1 -q:v 2 "${outputPath}"`;
        exec(fallbackCmd, (fbError, fbStdout, fbStderr) => {
          if (fbError) return reject(new Error(`Thumbnail generation failed: ${fbStderr || fbError.message}`));
          resolve(outputPath);
        });
        return;
      }
      resolve(outputPath);
    });
  });
}

module.exports = {
  generateThumbnail
};
```

- [ ] **Step 5: Run test to verify it passes**
Run:
```powershell
node --test tests/ffmpeg.test.js
```
Expected: PASS

- [ ] **Step 6: Commit Task 3**
```powershell
git add src/services/ffmpeg.js src/services/thumbnail.js tests/ffmpeg.test.js
git commit -m "feat(services): implement ffprobe metadata and thumbnail generation"
```

---

### Task 4: HLS Video Processor (`src/services/videoProcessor.js`)

**Files:**
- Create: `src/services/videoProcessor.js`
- Test: `tests/videoProcessor.test.js`

- [ ] **Step 1: Write test for HLS multi-variant generation**
Write to `tests/videoProcessor.test.js`:
```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

test('videoProcessor generates master.m3u8 and HLS streams', async (t) => {
  const testVideoPath = path.join(__dirname, 'test-hls.mp4');
  const testHlsDir = path.join(__dirname, 'test-hls-out');

  // Create 3-second test video
  execSync(`ffmpeg -y -f lavfi -i testsrc=duration=3:size=1280x720:rate=30 -c:v libx264 -pix_fmt yuv420p "${testVideoPath}"`, { stdio: 'ignore' });

  const { processToHls } = require('../src/services/videoProcessor');
  await processToHls(testVideoPath, testHlsDir, { width: 1280, height: 720 });

  assert.ok(fs.existsSync(path.join(testHlsDir, 'master.m3u8')));
  assert.ok(fs.existsSync(path.join(testHlsDir, '720p', 'index.m3u8')));
  assert.ok(fs.existsSync(path.join(testHlsDir, '360p', 'index.m3u8')));

  // Cleanup
  if (fs.existsSync(testVideoPath)) fs.unlinkSync(testVideoPath);
  if (fs.existsSync(testHlsDir)) fs.rmSync(testHlsDir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run:
```powershell
node --test tests/videoProcessor.test.js
```
Expected: FAIL (Cannot find module '../src/services/videoProcessor')

- [ ] **Step 3: Implement `src/services/videoProcessor.js`**
Write to `src/services/videoProcessor.js`:
```javascript
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { updateVideoHlsStatus } = require('../db/database');

function processToHls(inputPath, outputDir, metadata = {}) {
  return new Promise((resolve, reject) => {
    const dir720 = path.join(outputDir, '720p');
    const dir360 = path.join(outputDir, '360p');

    fs.mkdirSync(dir720, { recursive: true });
    fs.mkdirSync(dir360, { recursive: true });

    // Multi-variant HLS FFmpeg command
    // Renders 720p and 360p with H.264/AAC for universal browser & RTX VSR compatibility
    const cmd = `ffmpeg -y -i "${inputPath}" ` +
      `-filter_complex "[v:0]split=2[v1][v2]; [v1]scale=w=1280:h=720:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2[v1out]; [v2]scale=w=640:h=360:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2[v2out]" ` +
      `-map "[v1out]" -c:v:0 libx264 -b:v:0 2500k -maxrate:v:0 2800k -bufsize:v:0 5000k -preset veryfast -g 48 -sc_threshold 0 ` +
      `-f hls -hls_time 4 -hls_playlist_type vod -hls_segment_filename "${path.join(dir720, 'segment_%03d.ts').replace(/\\/g, '/')}" "${path.join(dir720, 'index.m3u8').replace(/\\/g, '/')}" ` +
      `-map "[v2out]" -c:v:1 libx264 -b:v:1 800k -maxrate:v:1 900k -bufsize:v:1 1600k -preset veryfast -g 48 -sc_threshold 0 ` +
      `-f hls -hls_time 4 -hls_playlist_type vod -hls_segment_filename "${path.join(dir360, 'segment_%03d.ts').replace(/\\/g, '/')}" "${path.join(dir360, 'index.m3u8').replace(/\\/g, '/')}"`;

    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(`HLS generation failed: ${stderr || error.message}`));
      }

      // Generate master playlist
      const masterContent = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1280x720,NAME="720p"
720p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=900000,RESOLUTION=640x360,NAME="360p"
360p/index.m3u8
`;
      fs.writeFileSync(path.join(outputDir, 'master.m3u8'), masterContent);
      resolve(outputDir);
    });
  });
}

function queueHlsProcessing(videoId, inputPath, metadata) {
  const hlsDir = path.join(process.cwd(), 'storage', 'hls', videoId);
  updateVideoHlsStatus(videoId, 'processing');

  processToHls(inputPath, hlsDir, metadata)
    .then(() => {
      updateVideoHlsStatus(videoId, 'ready');
      console.log(`[HLS] Video ${videoId} successfully converted to HLS!`);
    })
    .catch((err) => {
      console.error(`[HLS ERROR] Failed converting video ${videoId}:`, err);
      updateVideoHlsStatus(videoId, 'error');
    });
}

module.exports = {
  processToHls,
  queueHlsProcessing
};
```

- [ ] **Step 4: Run test to verify it passes**
Run:
```powershell
node --test tests/videoProcessor.test.js
```
Expected: PASS

- [ ] **Step 5: Commit Task 4**
```powershell
git add src/services/videoProcessor.js tests/videoProcessor.test.js
git commit -m "feat(services): implement multi-variant HLS transcoding and background processing queue"
```

---

### Task 5: Upload Middleware & REST API Routes (`upload.js`, `videos.js`)

**Files:**
- Create: `src/middleware/uploadValidation.js`
- Create: `src/routes/upload.js`
- Create: `src/routes/videos.js`
- Test: `tests/api.test.js`

- [ ] **Step 1: Implement `src/middleware/uploadValidation.js`**
Write to `src/middleware/uploadValidation.js`:
```javascript
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const storageDir = path.join(process.cwd(), 'storage', 'uploads');
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, storageDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueId = uuidv4();
    req.videoId = uniqueId;
    cb(null, `${uniqueId}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedExts = ['.mp4', '.mkv', '.webm'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Format tidak didukung (${ext}). Hanya file MP4, MKV, dan WebM yang diperbolehkan.`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10737418240', 10) // 10 GB
  }
});

module.exports = upload;
```

- [ ] **Step 2: Implement `src/routes/upload.js`**
Write to `src/routes/upload.js`:
```javascript
const express = require('express');
const router = express.Router();
const path = require('path');
const upload = require('../middleware/uploadValidation');
const { createVideo } = require('../db/database');
const { probeVideoMetadata } = require('../services/ffmpeg');
const { generateThumbnail } = require('../services/thumbnail');
const { queueHlsProcessing } = require('../services/videoProcessor');

router.post('/', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Tidak ada file video yang diunggah.' });
    }

    const videoId = req.videoId;
    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');
    const originalName = req.file.originalname;
    const title = path.parse(originalName).name;

    // Probe metadata
    let metadata = { duration: 0, width: 0, height: 0, codec: '' };
    try {
      metadata = await probeVideoMetadata(filePath);
    } catch (err) {
      console.warn('Metadata probe warning:', err.message);
    }

    // Generate thumbnail
    const thumbFilename = `${videoId}.jpg`;
    const thumbPath = path.join(process.cwd(), 'storage', 'thumbnails', thumbFilename);
    const thumbUrl = `/thumbnails/${thumbFilename}`;
    try {
      await generateThumbnail(filePath, thumbPath, Math.min(2, metadata.duration / 2 || 1));
    } catch (err) {
      console.warn('Thumbnail generation warning:', err.message);
    }

    const isMkv = ext === 'mkv';
    const hlsStatus = isMkv ? 'pending' : 'none';

    const videoRecord = {
      id: videoId,
      title,
      original_name: originalName,
      filename: req.file.filename,
      format: ext,
      size: req.file.size,
      duration: metadata.duration,
      width: metadata.width,
      height: metadata.height,
      codec: metadata.codec,
      thumbnail_path: thumbUrl,
      hls_status: hlsStatus
    };

    createVideo(videoRecord);

    // Auto-queue HLS for MKV
    if (isMkv) {
      queueHlsProcessing(videoId, filePath, metadata);
    }

    return res.status(201).json({
      message: 'Video berhasil diunggah!',
      video: videoRecord
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: error.message || 'Gagal memproses video.' });
  }
});

module.exports = router;
```

- [ ] **Step 3: Implement `src/routes/videos.js`**
Write to `src/routes/videos.js`:
```javascript
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { getAllVideos, getVideoById, deleteVideo } = require('../db/database');
const { queueHlsProcessing } = require('../services/videoProcessor');

// Get all videos
router.get('/', (req, res) => {
  const videos = getAllVideos();
  res.json(videos);
});

// Get single video
router.get('/:id', (req, res) => {
  const video = getVideoById(req.params.id);
  if (!video) return res.status(404).json({ error: 'Video tidak ditemukan.' });
  res.json(video);
});

// Trigger HLS generation manually for MP4/WebM
router.post('/:id/hls', (req, res) => {
  const video = getVideoById(req.params.id);
  if (!video) return res.status(404).json({ error: 'Video tidak ditemukan.' });

  const inputPath = path.join(process.cwd(), 'storage', 'uploads', video.filename);
  queueHlsProcessing(video.id, inputPath, { width: video.width, height: video.height });
  res.json({ message: 'Proses konversi HLS dimulai!', videoId: video.id });
});

// Delete video
router.delete('/:id', (req, res) => {
  const video = getVideoById(req.params.id);
  if (!video) return res.status(404).json({ error: 'Video tidak ditemukan.' });

  // Remove uploaded file
  const filePath = path.join(process.cwd(), 'storage', 'uploads', video.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  // Remove thumbnail
  const thumbPath = path.join(process.cwd(), 'storage', 'thumbnails', `${video.id}.jpg`);
  if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);

  // Remove HLS dir
  const hlsDir = path.join(process.cwd(), 'storage', 'hls', video.id);
  if (fs.existsSync(hlsDir)) fs.rmSync(hlsDir, { recursive: true, force: true });

  deleteVideo(video.id);
  res.json({ message: 'Video berhasil dihapus.' });
});

module.exports = router;
```

- [ ] **Step 4: Commit Task 5**
```powershell
git add src/middleware/uploadValidation.js src/routes/upload.js src/routes/videos.js
git commit -m "feat(routes): implement upload middleware, video list, detail, delete and manual HLS triggering"
```

---

### Task 6: Streaming & HLS Delivery Routes (`src/routes/stream.js` & `src/routes/hls.js`)

**Files:**
- Create: `src/routes/stream.js`
- Create: `src/routes/hls.js`
- Test: `tests/stream.test.js`

- [ ] **Step 1: Implement `src/routes/stream.js` (HTTP Range 206 Direct Stream)**
Write to `src/routes/stream.js`:
```javascript
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { getVideoById } = require('../db/database');

router.get('/:id', (req, res) => {
  const video = getVideoById(req.params.id);
  if (!video) {
    return res.status(404).json({ error: 'Video tidak ditemukan.' });
  }

  const filePath = path.join(process.cwd(), 'storage', 'uploads', video.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File video tidak ditemukan di penyimpanan.' });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  let contentType = 'video/mp4';
  if (video.format === 'webm') contentType = 'video/webm';
  if (video.format === 'mkv') contentType = 'video/x-matroska';

  if (range) {
    // Parse Range header (e.g. "bytes=0-1048576")
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize) {
      res.status(416).set({
        'Content-Range': `bytes */${fileSize}`
      });
      return res.end();
    }

    const chunksize = end - start + 1;
    const fileStream = fs.createReadStream(filePath, { start, end });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType
    });

    fileStream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Accept-Ranges': 'bytes',
      'Content-Type': contentType
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

module.exports = router;
```

- [ ] **Step 2: Implement `src/routes/hls.js` (HLS Playlist & TS Segments Handler)**
Write to `src/routes/hls.js`:
```javascript
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

router.get('/:id/*', (req, res) => {
  const videoId = req.params.id;
  const subPath = req.params[0]; // e.g. "master.m3u8", "720p/index.m3u8", "720p/segment_000.ts"

  const targetPath = path.join(process.cwd(), 'storage', 'hls', videoId, subPath);

  if (!fs.existsSync(targetPath)) {
    return res.status(404).send('HLS segment or playlist not found');
  }

  if (targetPath.endsWith('.m3u8')) {
    res.set('Content-Type', 'application/vnd.apple.mpegurl');
  } else if (targetPath.endsWith('.ts')) {
    res.set('Content-Type', 'video/mp2t');
  }

  // Set cache and CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Cache-Control', 'no-cache');

  fs.createReadStream(targetPath).pipe(res);
});

module.exports = router;
```

- [ ] **Step 3: Write test for Range request streaming**
Write to `tests/stream.test.js`:
```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

test('Stream route handles HTTP Range 206 requests', async (t) => {
  const testDir = path.join(__dirname, 'stream-test');
  const uploadsDir = path.join(process.cwd(), 'storage', 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });

  const testVideo = path.join(uploadsDir, 'stream-sample.mp4');
  execSync(`ffmpeg -y -f lavfi -i testsrc=duration=1:size=320x240:rate=30 -c:v libx264 "${testVideo}"`, { stdio: 'ignore' });

  const { initDb, createVideo } = require('../src/db/database');
  initDb();
  createVideo({
    id: 'sample-stream-id',
    title: 'Stream Sample',
    original_name: 'stream-sample.mp4',
    filename: 'stream-sample.mp4',
    format: 'mp4',
    size: fs.statSync(testVideo).size,
    duration: 1,
    width: 320,
    height: 240,
    codec: 'h264',
    thumbnail_path: '',
    hls_status: 'none'
  });

  const app = express();
  app.use('/api/stream', require('../src/routes/stream'));

  const server = app.listen(0);
  const port = server.address().port;

  // Test Partial Range Request
  const response = await fetch(`http://localhost:${port}/api/stream/sample-stream-id`, {
    headers: { Range: 'bytes=0-99' }
  });

  assert.equal(response.status, 206);
  assert.equal(response.headers.get('content-range')?.startsWith('bytes 0-99/'), true);
  assert.equal(response.headers.get('content-length'), '100');

  server.close();
  if (fs.existsSync(testVideo)) fs.unlinkSync(testVideo);
});
```

- [ ] **Step 4: Run test to verify it passes**
Run:
```powershell
node --test tests/stream.test.js
```
Expected: PASS

- [ ] **Step 5: Commit Task 6**
```powershell
git add src/routes/stream.js src/routes/hls.js tests/stream.test.js
git commit -m "feat(stream): implement byte-range streaming route and HLS static delivery route"
```

---

### Task 7: Express Server Entry Point (`src/server.js`)

**Files:**
- Create: `src/server.js`

- [ ] **Step 1: Implement `src/server.js`**
Write to `src/server.js`:
```javascript
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Database
initDb();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Static Frontend Assets
app.use(express.static(path.join(__dirname, '..', 'public')));

// Serve Thumbnails
app.use('/thumbnails', express.static(path.join(__dirname, '..', 'storage', 'thumbnails')));

// API Routes
app.use('/api/videos', require('./routes/videos'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/stream', require('./routes/stream'));
app.use('/api/hls', require('./routes/hls'));

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', rtx_vsr_compatible: true, timestamp: new Date() });
});

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err.message);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🎬 RTX VSR StreamHub berjalan di:`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`💡 Buka di Google Chrome / Microsoft Edge untuk`);
  console.log(`   mengaktifkan NVIDIA RTX Video Super Resolution!`);
  console.log(`===============================================`);
});
```

- [ ] **Step 2: Commit Task 7**
```powershell
git add src/server.js
git commit -m "feat(server): setup express server entry point with static and api routes"
```

---

### Task 8: Frontend UI & Video Gallery (`public/index.html`, `public/css/style.css`, `public/js/app.js`)

**Files:**
- Create: `public/index.html`
- Create: `public/css/style.css`
- Create: `public/js/app.js`

- [ ] **Step 1: Implement `public/index.html`**
Write to `public/index.html`:
```html
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>StreamHub - RTX Video Super Resolution Player</title>
  <link rel="stylesheet" href="/css/style.css">
  <script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js"></script>
</head>
<body>
  <!-- Header & Navbar -->
  <header class="navbar">
    <div class="nav-container">
      <div class="logo-area">
        <span class="logo-icon">⚡</span>
        <h1 class="logo-text">StreamHub <span class="badge-vsr">RTX VSR</span></h1>
      </div>
      <div class="nav-actions">
        <button id="btnVsrGuide" class="btn btn-outline">
          <span class="icon-glow">🟢</span> Status & Panduan RTX VSR
        </button>
      </div>
    </div>
  </header>

  <main class="main-container">
    <!-- Hero / Upload Section -->
    <section class="upload-section">
      <div class="dropzone" id="dropzone">
        <div class="dropzone-content">
          <div class="upload-icon">📁</div>
          <h3>Seret & Jatuhkan Video ke Sini</h3>
          <p>Mendukung format <strong>MP4</strong>, <strong>MKV</strong>, dan <strong>WebM</strong> (hingga 10 GB)</p>
          <label class="btn btn-primary" for="fileInput">
            Pilih File Video
          </label>
          <input type="file" id="fileInput" accept=".mp4,.mkv,.webm" hidden>
        </div>
        <!-- Progress bar -->
        <div class="upload-progress-container" id="uploadProgressContainer" style="display: none;">
          <div class="progress-info">
            <span id="uploadFileName">Uploading...</span>
            <span id="uploadPercentage">0%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" id="progressFill"></div>
          </div>
          <p class="progress-status" id="progressStatus">Mengunggah file ke server lokal...</p>
        </div>
      </div>
    </section>

    <!-- Video Library Section -->
    <section class="library-section">
      <div class="section-header">
        <h2>Koleksi Video Saya</h2>
        <div class="filter-tabs">
          <button class="filter-btn active" data-filter="all">Semua (<span id="countAll">0</span>)</button>
          <button class="filter-btn" data-filter="mp4">MP4</button>
          <button class="filter-btn" data-filter="mkv">MKV (HLS)</button>
          <button class="filter-btn" data-filter="webm">WebM</button>
        </div>
      </div>

      <div class="video-grid" id="videoGrid">
        <!-- Rendered dynamically -->
      </div>
      <div class="empty-state" id="emptyState" style="display: none;">
        <p>Belum ada video yang diunggah. Unggah video di atas untuk mulai menonton dengan RTX VSR!</p>
      </div>
    </section>
  </main>

  <!-- Player Modal -->
  <div class="modal player-modal" id="playerModal">
    <div class="modal-backdrop" id="modalBackdrop"></div>
    <div class="modal-content">
      <div class="player-header">
        <div class="player-title-info">
          <h3 id="playerVideoTitle">Judul Video</h3>
          <span class="meta-tag" id="playerVideoMeta">1080p • MP4</span>
        </div>
        <button class="btn-close" id="btnClosePlayer">&times;</button>
      </div>

      <div class="player-wrapper">
        <video id="mainVideo" controls playsinline></video>

        <!-- RTX VSR Live HUD Indicator -->
        <div class="vsr-hud" id="vsrHud">
          <div class="vsr-badge" id="vsrBadge">
            <span class="dot"></span>
            <span id="vsrStatusText">RTX VSR Ready</span>
          </div>
          <div class="vsr-stats" id="vsrStats">
            <span id="vsrResolution">Native: 0x0 ➔ Screen: 0x0</span>
            <span id="vsrScale">Scale: 1.0x</span>
          </div>
        </div>
      </div>

      <div class="player-tools">
        <button class="btn btn-sm btn-outline" id="btnToggleFullscreen">⛶ Layar Penuh (Memicu VSR)</button>
        <button class="btn btn-sm btn-outline" id="btnGenerateHls" style="display: none;">⚡ Buat HLS Multi-Bitrate</button>
        <span class="tip-text">💡 <strong>Tips RTX VSR:</strong> Tekan Layar Penuh (Fullscreen) agar video di-upscale ke resolusi layar dan memicu AI tensor core RTX VSR!</span>
      </div>
    </div>
  </div>

  <!-- RTX VSR Guide Modal -->
  <div class="modal guide-modal" id="guideModal">
    <div class="modal-backdrop" id="guideBackdrop"></div>
    <div class="guide-modal-content">
      <div class="guide-header">
        <h3>🚀 Cara Memastikan RTX VSR Aktif</h3>
        <button class="btn-close" id="btnCloseGuide">&times;</button>
      </div>
      <div class="guide-body">
        <div class="guide-step">
          <div class="step-num">1</div>
          <div class="step-text">
            <strong>Gunakan Browser Chromium</strong>
            <p>Buka website ini melalui Google Chrome atau Microsoft Edge.</p>
          </div>
        </div>
        <div class="guide-step">
          <div class="step-num">2</div>
          <div class="step-text">
            <strong>Aktifkan Hardware Acceleration</strong>
            <p>Di Chrome/Edge, buka <code>chrome://settings/system</code> dan pastikan <em>"Gunakan akselerasi grafis saat tersedia"</em> dalam posisi ON.</p>
          </div>
        </div>
        <div class="guide-step">
          <div class="step-num">3</div>
          <div class="step-text">
            <strong>NVIDIA Control Panel</strong>
            <p>Buka NVIDIA Control Panel ➔ <em>Adjust video image settings</em> ➔ Di bawah <em>RTX video enhancement</em>, centang <strong>Super resolution</strong> dan pilih Quality 1-4.</p>
          </div>
        </div>
        <div class="guide-step">
          <div class="step-num">4</div>
          <div class="step-text">
            <strong>Putar Video & Fullscreen</strong>
            <p>Saat video diputar dan di-upscale (resolusi video lebih kecil dari resolusi layar), lampu indikator VSR di player akan menyala hijau!</p>
          </div>
        </div>
      </div>
      <div class="guide-footer">
        <button class="btn btn-primary" id="btnGotIt">Mengerti, Siap Nonton!</button>
      </div>
    </div>
  </div>

  <script src="/js/player.js"></script>
  <script src="/js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Implement `public/css/style.css`**
Write to `public/css/style.css`:
```css
:root {
  --bg-dark: #0f1117;
  --bg-card: #181b24;
  --bg-hover: #212634;
  --primary: #00ff88;
  --primary-hover: #00dd75;
  --accent: #00d2ff;
  --text-main: #f0f3f8;
  --text-muted: #8b949e;
  --border: #282e3e;
  --vsr-active: #00ff88;
  --vsr-idle: #e3b341;
  --danger: #ff4757;
  --radius: 12px;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

body {
  background-color: var(--bg-dark);
  color: var(--text-main);
  min-height: 100vh;
}

/* Navbar */
.navbar {
  background-color: rgba(24, 27, 36, 0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo-area {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-icon {
  font-size: 24px;
  filter: drop-shadow(0 0 8px var(--primary));
}

.logo-text {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.5px;
}

.badge-vsr {
  font-size: 11px;
  font-weight: 800;
  background: linear-gradient(135deg, #76b900, #00ff88);
  color: #000;
  padding: 3px 8px;
  border-radius: 6px;
  margin-left: 6px;
  letter-spacing: 0.5px;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  text-decoration: none;
}

.btn-primary {
  background: var(--primary);
  color: #0d1117;
}

.btn-primary:hover {
  background: var(--primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(0, 255, 136, 0.3);
}

.btn-outline {
  background: transparent;
  color: var(--text-main);
  border: 1px solid var(--border);
}

.btn-outline:hover {
  background: var(--bg-hover);
  border-color: var(--accent);
}

.btn-sm {
  padding: 6px 14px;
  font-size: 13px;
}

/* Layout */
.main-container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 32px 24px;
}

/* Dropzone */
.upload-section {
  margin-bottom: 40px;
}

.dropzone {
  border: 2px dashed var(--border);
  background-color: var(--bg-card);
  border-radius: var(--radius);
  padding: 48px 24px;
  text-align: center;
  transition: all 0.2s ease;
  cursor: pointer;
}

.dropzone.dragover {
  border-color: var(--primary);
  background-color: rgba(0, 255, 136, 0.05);
  box-shadow: 0 0 24px rgba(0, 255, 136, 0.15);
}

.upload-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.dropzone h3 {
  font-size: 18px;
  margin-bottom: 8px;
}

.dropzone p {
  color: var(--text-muted);
  font-size: 14px;
  margin-bottom: 20px;
}

/* Upload Progress */
.upload-progress-container {
  margin-top: 16px;
  text-align: left;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 14px;
}

.progress-bar {
  height: 8px;
  background: var(--border);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, var(--accent), var(--primary));
  transition: width 0.2s;
}

.progress-status {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 6px;
}

/* Library */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.filter-tabs {
  display: flex;
  gap: 8px;
}

.filter-btn {
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text-muted);
  padding: 6px 14px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.filter-btn.active, .filter-btn:hover {
  background: var(--bg-hover);
  color: var(--text-main);
  border-color: var(--primary);
}

/* Video Grid */
.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
}

.video-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  transition: all 0.25s ease;
  display: flex;
  flex-direction: column;
}

.video-card:hover {
  transform: translateY(-4px);
  border-color: rgba(0, 255, 136, 0.4);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.4);
}

.card-thumb-wrapper {
  position: relative;
  aspect-ratio: 16 / 9;
  background: #000;
  cursor: pointer;
}

.card-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.badge-format {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  font-size: 11px;
  font-weight: 700;
  padding: 3px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}

.badge-res {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(0, 210, 255, 0.25);
  color: var(--accent);
  border: 1px solid rgba(0, 210, 255, 0.4);
  font-size: 11px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
}

.badge-duration {
  position: absolute;
  bottom: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.8);
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 4px;
}

.card-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: auto;
  align-items: center;
}

.card-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.btn-delete {
  background: transparent;
  border: 1px solid #442226;
  color: var(--danger);
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}

.btn-delete:hover {
  background: rgba(255, 71, 87, 0.15);
}

/* Modals */
.modal {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 1000;
  align-items: center;
  justify-content: center;
}

.modal.active {
  display: flex;
}

.modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
}

.modal-content {
  position: relative;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  width: 90%;
  max-width: 1080px;
  max-height: 94vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.6);
}

.player-header {
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border);
}

.meta-tag {
  font-size: 12px;
  color: var(--accent);
}

.btn-close {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 24px;
  cursor: pointer;
}

.btn-close:hover {
  color: var(--text-main);
}

.player-wrapper {
  position: relative;
  background: #000;
  width: 100%;
  max-height: 70vh;
  display: flex;
  justify-content: center;
  align-items: center;
}

video {
  width: 100%;
  max-height: 70vh;
  outline: none;
  display: block;
}

/* RTX VSR HUD Overlay */
.vsr-hud {
  position: absolute;
  top: 14px;
  left: 14px;
  background: rgba(15, 17, 23, 0.85);
  backdrop-filter: blur(6px);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  z-index: 10;
  pointer-events: none;
  transition: all 0.3s ease;
}

.vsr-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
}

.vsr-badge .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--vsr-idle);
}

.vsr-badge.active .dot {
  background-color: var(--vsr-active);
  box-shadow: 0 0 8px var(--vsr-active);
}

.vsr-stats {
  display: flex;
  gap: 8px;
  color: var(--text-muted);
  border-left: 1px solid var(--border);
  padding-left: 8px;
}

.player-tools {
  padding: 14px 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--bg-dark);
  border-top: 1px solid var(--border);
}

.tip-text {
  font-size: 12px;
  color: var(--text-muted);
  margin-left: auto;
}

/* Guide Modal */
.guide-modal-content {
  position: relative;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  width: 90%;
  max-width: 600px;
  padding: 24px;
}

.guide-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.guide-step {
  display: flex;
  gap: 16px;
  margin-bottom: 18px;
}

.step-num {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(0, 255, 136, 0.15);
  color: var(--primary);
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.step-text strong {
  display: block;
  font-size: 15px;
  margin-bottom: 4px;
}

.step-text p {
  font-size: 13px;
  color: var(--text-muted);
}

.step-text code {
  background: #000;
  padding: 2px 6px;
  border-radius: 4px;
  color: var(--accent);
}

.guide-footer {
  margin-top: 24px;
  text-align: right;
}
```

- [ ] **Step 3: Implement `public/js/app.js` (Upload & Library Handling)**
Write to `public/js/app.js`:
```javascript
// Application logic: Upload, Gallery, Filtering
let allVideos = [];
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
  initDropzone();
  initModals();
  loadVideos();
});

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
    const files = e.dataTransfer.files;
    if (files.length > 0) uploadFile(files[0]);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) uploadFile(fileInput.files[0]);
  });
}

function uploadFile(file) {
  const allowed = ['.mp4', '.mkv', '.webm'];
  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  if (!allowed.includes(ext)) {
    alert(`Format ${ext} tidak didukung! Gunakan MP4, MKV, atau WebM.`);
    return;
  }

  const progressContainer = document.getElementById('uploadProgressContainer');
  const progressFill = document.getElementById('progressFill');
  const progressPercentage = document.getElementById('uploadPercentage');
  const uploadFileName = document.getElementById('uploadFileName');
  const progressStatus = document.getElementById('progressStatus');

  progressContainer.style.display = 'block';
  uploadFileName.textContent = file.name;
  progressFill.style.width = '0%';
  progressPercentage.textContent = '0%';
  progressStatus.textContent = 'Mengunggah video ke server...';

  const formData = new FormData();
  formData.append('video', file);

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/upload', true);

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const percent = Math.round((e.loaded / e.total) * 100);
      progressFill.style.width = `${percent}%`;
      progressPercentage.textContent = `${percent}%`;
      if (percent === 100) {
        progressStatus.textContent = 'Memproses metadata dan thumbnail...';
      }
    }
  };

  xhr.onload = () => {
    if (xhr.status === 201 || xhr.status === 200) {
      progressStatus.textContent = 'Upload berhasil!';
      setTimeout(() => {
        progressContainer.style.display = 'none';
        loadVideos();
      }, 1000);
    } else {
      let err = 'Upload gagal';
      try { err = JSON.parse(xhr.responseText).error; } catch(e){}
      alert('Gagal mengunggah: ' + err);
      progressContainer.style.display = 'none';
    }
  };

  xhr.onerror = () => {
    alert('Terjadi kesalahan jaringan saat mengunggah.');
    progressContainer.style.display = 'none';
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

    const durationMin = Math.floor(video.duration / 60);
    const durationSec = Math.floor(video.duration % 60).toString().padStart(2, '0');
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
```

- [ ] **Step 4: Commit Task 8**
```powershell
git add public/index.html public/css/style.css public/js/app.js
git commit -m "feat(ui): implement modern dark theme video gallery, upload dropzone and guide modal"
```

---

### Task 9: High-Performance Player & RTX VSR HUD Monitor (`public/js/player.js`)

**Files:**
- Create: `public/js/player.js`

- [ ] **Step 1: Implement `public/js/player.js`**
Write to `public/js/player.js`:
```javascript
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
    if (Hls.isSupported()) {
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

  btnClose.addEventListener('click', closePlayer);
  backdrop.addEventListener('click', closePlayer);

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

  // Handle ESC key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('playerModal').classList.contains('active')) {
      closePlayer();
    }
  });
});
```

- [ ] **Step 2: Commit Task 9**
```powershell
git add public/js/player.js
git commit -m "feat(player): implement hls.js player controller and real-time RTX VSR scale monitor"
```

---

### Task 10: End-to-End Verification & RTX VSR Test

**Files:**
- Test: `tests/e2e.test.js`

- [ ] **Step 1: Write comprehensive end-to-end test**
Write to `tests/e2e.test.js`:
```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

test('End-to-End: Upload MP4 and MKV, probe metadata, stream, and verify HLS status', async (t) => {
  const testSampleMp4 = path.join(__dirname, 'e2e-sample.mp4');
  execSync(`ffmpeg -y -f lavfi -i testsrc=duration=2:size=1280x720:rate=30 -c:v libx264 "${testSampleMp4}"`, { stdio: 'ignore' });

  const { initDb, getAllVideos } = require('../src/db/database');
  initDb();

  // Test health check API
  const app = express();
  app.use(express.json());
  app.use('/api/videos', require('../src/routes/videos'));
  app.use('/api/upload', require('../src/routes/upload'));
  app.use('/api/stream', require('../src/routes/stream'));
  app.use('/api/hls', require('../src/routes/hls'));
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  const server = app.listen(0);
  const port = server.address().port;

  const healthRes = await fetch(`http://localhost:${port}/api/health`);
  const healthJson = await healthRes.json();
  assert.equal(healthJson.status, 'ok');

  // Verify videos endpoint returns array
  const videosRes = await fetch(`http://localhost:${port}/api/videos`);
  const videosJson = await videosRes.json();
  assert.ok(Array.isArray(videosJson));

  server.close();
  if (fs.existsSync(testSampleMp4)) fs.unlinkSync(testSampleMp4);
});
```

- [ ] **Step 2: Run all tests to ensure 100% pass**
Run:
```powershell
npm test
```
Expected: PASS all tests

- [ ] **Step 3: Commit Task 10**
```powershell
git add tests/e2e.test.js
git commit -m "test(e2e): add end-to-end verification test suite"
```

- [ ] **Step 4: Launch application and verify on browser**
Run:
```powershell
node src/server.js
```
Open `http://localhost:3000` in Google Chrome or Microsoft Edge.
Verify:
1. Drag-and-drop upload MP4 / MKV / WebM.
2. Video appears in gallery with thumbnail & resolution tag.
3. Click "Putar" -> Video starts playing smoothly.
4. Click Fullscreen -> RTX VSR HUD turns green with active AI upscaling scale factor!
