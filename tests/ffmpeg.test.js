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
  assert.ok(metadata.duration >= 1.8);

  await generateThumbnail(testVideoPath, testThumbPath, 1);
  assert.ok(fs.existsSync(testThumbPath));
  assert.ok(fs.statSync(testThumbPath).size > 100);

  // Cleanup
  if (fs.existsSync(testVideoPath)) fs.unlinkSync(testVideoPath);
  if (fs.existsSync(testThumbPath)) fs.unlinkSync(testThumbPath);
});
