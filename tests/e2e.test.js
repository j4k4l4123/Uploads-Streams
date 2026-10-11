const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

test('End-to-End: Full application workflow test', async (t) => {
  const app = require('../src/server');
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  // 1. Health check
  const healthRes = await fetch(`${baseUrl}/api/health`);
  const health = await healthRes.json();
  assert.equal(health.status, 'ok');
  assert.equal(health.rtx_vsr_compatible, true);

  // 2. Create synthetic test video
  const testSampleMp4 = path.join(__dirname, 'e2e-sample.mp4');
  execSync(`ffmpeg -y -f lavfi -i testsrc=duration=2:size=640x360:rate=30 -c:v libx264 -pix_fmt yuv420p "${testSampleMp4}"`, { stdio: 'ignore' });

  // 3. Upload test video
  const fileBuffer = fs.readFileSync(testSampleMp4);
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: 'video/mp4' });
  formData.append('video', blob, 'e2e-sample.mp4');

  const uploadRes = await fetch(`${baseUrl}/api/upload`, {
    method: 'POST',
    body: formData
  });
  assert.equal(uploadRes.status, 201);
  const uploadData = await uploadRes.json();
  assert.ok(uploadData.video.id);
  const videoId = uploadData.video.id;

  // 4. List videos
  const listRes = await fetch(`${baseUrl}/api/videos`);
  const list = await listRes.json();
  const found = list.find(v => v.id === videoId);
  assert.ok(found);
  assert.equal(found.title, 'e2e-sample');
  assert.equal(found.width, 640);
  assert.equal(found.height, 360);

  // 5. Test stream byte-range request
  const streamRes = await fetch(`${baseUrl}/api/stream/${videoId}`, {
    headers: { Range: 'bytes=0-100' }
  });
  assert.equal(streamRes.status, 206);
  assert.equal(streamRes.headers.get('content-length'), '101');

  // 6. Test delete video
  const deleteRes = await fetch(`${baseUrl}/api/videos/${videoId}`, {
    method: 'DELETE'
  });
  assert.equal(deleteRes.status, 200);

  // 7. Verify deleted
  const checkRes = await fetch(`${baseUrl}/api/videos/${videoId}`);
  assert.equal(checkRes.status, 404);

  // Cleanup
  server.close();
  if (fs.existsSync(testSampleMp4)) fs.unlinkSync(testSampleMp4);
});
