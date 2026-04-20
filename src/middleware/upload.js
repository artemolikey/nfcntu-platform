const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const env = require('../config/env');

fs.mkdirSync(env.uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const dateSegment = new Date().toISOString().slice(0, 10);
    const target = path.join(env.uploadsDir, dateSegment);
    fs.mkdirSync(target, { recursive: true });
    cb(null, target);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  }
});

module.exports = multer({ storage, limits: { fileSize: env.uploadMaxSizeMb * 1024 * 1024 } });
