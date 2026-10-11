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
