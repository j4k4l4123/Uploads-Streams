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
