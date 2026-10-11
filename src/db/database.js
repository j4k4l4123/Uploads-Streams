const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

let dbInstance = null;

function initDb(customPath = null) {
  const dbPath = customPath || process.env.DB_PATH || path.join(process.cwd(), 'data', 'videos.db');
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  dbInstance = new DatabaseSync(dbPath);

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
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    video.id,
    video.title,
    video.original_name,
    video.filename,
    video.format,
    video.size,
    video.duration || 0,
    video.width || 0,
    video.height || 0,
    video.codec || '',
    video.thumbnail_path || '',
    video.hls_status || 'none'
  );
  return video;
}

function getVideoById(id) {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM videos WHERE id = ?');
  return stmt.get(id);
}

function getAllVideos() {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM videos ORDER BY created_at DESC');
  return stmt.all();
}

function updateVideoHlsStatus(id, status) {
  const db = getDb();
  const stmt = db.prepare('UPDATE videos SET hls_status = ? WHERE id = ?');
  stmt.run(status, id);
}

function deleteVideo(id) {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM videos WHERE id = ?');
  stmt.run(id);
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
