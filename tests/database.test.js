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
