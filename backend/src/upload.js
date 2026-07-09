const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const PASTA_UPLOADS = path.join(__dirname, '..', 'uploads');
const LIMITE_BYTES = 50 * 1024 * 1024; // 50MB, mesmo limite do CHECK no banco

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PASTA_UPLOADS),
  filename: (req, file, cb) => {
    const sufixo = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${sufixo}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: LIMITE_BYTES },
});

module.exports = { upload, PASTA_UPLOADS };
