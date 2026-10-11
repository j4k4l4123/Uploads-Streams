const { exec } = require('child_process');

function probeVideoMetadata(filePath) {
  return new Promise((resolve, reject) => {
    const cmd = `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`;
    exec(cmd, { env: process.env }, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(`ffprobe failed: ${stderr || error.message}`));
      }
      try {
        const data = JSON.parse(stdout);
        const videoStream = data.streams?.find(s => s.codec_type === 'video') || {};
        const duration = parseFloat(data.format?.duration || videoStream.duration || 0);
        const width = parseInt(videoStream.width || 0, 10);
        const height = parseInt(videoStream.height || 0, 10);
        const codec = videoStream.codec_name || '';

        resolve({ duration, width, height, codec });
      } catch (err) {
        reject(new Error(`Failed to parse ffprobe json: ${err.message}`));
      }
    });
  });
}

module.exports = {
  probeVideoMetadata
};
