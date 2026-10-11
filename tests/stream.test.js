const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

test('Stream route handles HTTP Range 206 requests', async (t) => {
  const uploadsDir = path.join(process.cwd(), 'storage', 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });

  const streamTestId = 'stream-id-' + Date.now();
  const testVideo = path.join(uploadsDir, `${streamTestId}.mp4`);
  execSync(`ffmpeg -y -f lavfi -i testsrc=duration=1:size=320x240:rate=30 -c:v libx264 "${testVideo}"`, { stdio: 'ignore' });

  const { initDb, createVideo, deleteVideo } = require('../src/db/database');
  initDb();
  createVideo({
    id: streamTestId,
    title: 'Stream Sample',
    original_name: 'stream-sample.mp4',
    filename: `${streamTestId}.mp4`,
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
  const response = await fetch(`http://localhost:${port}/api/stream/${streamTestId}`, {
    headers: { Range: 'bytes=0-99' }
  });

  assert.equal(response.status, 206);
  assert.equal(response.headers.get('content-range')?.startsWith('bytes 0-99/'), true);
  assert.equal(response.headers.get('content-length'), '100');

  server.close();
  deleteVideo(streamTestId);
  if (fs.existsSync(testVideo)) fs.unlinkSync(testVideo);
});
