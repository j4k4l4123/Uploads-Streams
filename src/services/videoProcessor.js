const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { updateVideoHlsStatus } = require('../db/database');

function processToHls(inputPath, outputDir, metadata = {}) {
  return new Promise((resolve, reject) => {
    const dir720 = path.join(outputDir, '720p');
    const dir360 = path.join(outputDir, '360p');

    fs.mkdirSync(dir720, { recursive: true });
    fs.mkdirSync(dir360, { recursive: true });

    const seg720 = path.join(dir720, 'segment_%03d.ts').replace(/\\/g, '/');
    const m3u8_720 = path.join(dir720, 'index.m3u8').replace(/\\/g, '/');
    const seg360 = path.join(dir360, 'segment_%03d.ts').replace(/\\/g, '/');
    const m3u8_360 = path.join(dir360, 'index.m3u8').replace(/\\/g, '/');

    // Multi-variant HLS FFmpeg command
    // Uses H.264/AAC for universal browser & RTX VSR compatibility
    const cmd = `ffmpeg -y -i "${inputPath}" ` +
      `-filter_complex "[v:0]split=2[v1][v2]; [v1]scale=w=1280:h=720:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2[v1out]; [v2]scale=w=640:h=360:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2[v2out]" ` +
      `-map "[v1out]" -c:v:0 libx264 -b:v:0 2500k -maxrate:v:0 2800k -bufsize:v:0 5000k -preset veryfast -g 48 -sc_threshold 0 ` +
      `-f hls -hls_time 4 -hls_playlist_type vod -hls_segment_filename "${seg720}" "${m3u8_720}" ` +
      `-map "[v2out]" -c:v:1 libx264 -b:v:1 800k -maxrate:v:1 900k -bufsize:v:1 1600k -preset veryfast -g 48 -sc_threshold 0 ` +
      `-f hls -hls_time 4 -hls_playlist_type vod -hls_segment_filename "${seg360}" "${m3u8_360}"`;

    exec(cmd, { env: process.env }, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(`HLS generation failed: ${stderr || error.message}`));
      }

      // Generate master playlist
      const masterContent = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1280x720,NAME="720p"
720p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=900000,RESOLUTION=640x360,NAME="360p"
360p/index.m3u8
`;
      fs.writeFileSync(path.join(outputDir, 'master.m3u8'), masterContent);
      resolve(outputDir);
    });
  });
}

function queueHlsProcessing(videoId, inputPath, metadata) {
  const hlsDir = path.join(process.cwd(), 'storage', 'hls', videoId);
  updateVideoHlsStatus(videoId, 'processing');

  processToHls(inputPath, hlsDir, metadata)
    .then(() => {
      updateVideoHlsStatus(videoId, 'ready');
      console.log(`[HLS] Video ${videoId} successfully converted to HLS!`);
    })
    .catch((err) => {
      console.error(`[HLS ERROR] Failed converting video ${videoId}:`, err.message);
      updateVideoHlsStatus(videoId, 'error');
    });
}

module.exports = {
  processToHls,
  queueHlsProcessing
};
