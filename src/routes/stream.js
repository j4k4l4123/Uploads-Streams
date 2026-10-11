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
