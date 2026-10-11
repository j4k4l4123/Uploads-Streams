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
      await generateThumbnail(filePath, thumbPath, Math.min(2, (metadata.duration || 2) / 2 || 1));
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
