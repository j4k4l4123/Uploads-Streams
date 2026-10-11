require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Database
initDb();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Static Frontend Assets
app.use(express.static(path.join(__dirname, '..', 'public')));

// Serve Thumbnails
app.use('/thumbnails', express.static(path.join(__dirname, '..', 'storage', 'thumbnails')));

// API Routes
app.use('/api/videos', require('./routes/videos'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/stream', require('./routes/stream'));
app.use('/api/hls', require('./routes/hls'));

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', rtx_vsr_compatible: true, timestamp: new Date() });
});

// Fallback to index.html for client-side navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err.message);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🎬 RTX VSR StreamHub berjalan di:`);
    console.log(`👉 http://localhost:${PORT}`);
    console.log(`💡 Buka di Google Chrome / Microsoft Edge untuk`);
    console.log(`   mengaktifkan NVIDIA RTX Video Super Resolution!`);
    console.log(`===============================================`);
  });
}

module.exports = app;
