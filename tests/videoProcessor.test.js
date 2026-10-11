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
