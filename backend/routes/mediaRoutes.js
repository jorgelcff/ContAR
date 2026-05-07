const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../middleware/authMiddleware');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'audio');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp3';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm'];
    cb(null, allowed.includes(file.mimetype) || file.originalname.match(/\.(mp3|wav|ogg|webm)$/i));
  },
});

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });

const router = express.Router();

router.post('/audio', limiter, requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

  // Return a full URL so the browser can play it from any origin
  const proto = req.protocol;
  const host = req.get('host');
  const url = `${proto}://${host}/uploads/audio/${req.file.filename}`;
  res.json({ url });
});

module.exports = router;
