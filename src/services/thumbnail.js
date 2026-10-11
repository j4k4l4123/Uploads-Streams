const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

function generateThumbnail(videoPath, outputPath, timestamp = 1) {
  return new Promise((resolve, reject) => {
    const outDir = path.dirname(outputPath);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const cmd = `ffmpeg -y -ss ${timestamp} -i "${videoPath}" -vframes 1 -q:v 2 "${outputPath}"`;
    exec(cmd, { env: process.env }, (error, stdout, stderr) => {
      if (error) {
        // Fallback to timestamp 0 if seeking to timestamp failed
        const fallbackCmd = `ffmpeg -y -ss 0 -i "${videoPath}" -vframes 1 -q:v 2 "${outputPath}"`;
        exec(fallbackCmd, { env: process.env }, (fbError, fbStdout, fbStderr) => {
          if (fbError) return reject(new Error(`Thumbnail generation failed: ${fbStderr || fbError.message}`));
          resolve(outputPath);
        });
        return;
      }
      resolve(outputPath);
    });
  });
}

module.exports = {
  generateThumbnail
};
