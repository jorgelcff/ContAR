const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../middleware/authMiddleware');

// Resolve the public base URL for constructing file URLs.
// In production (Docker/Render) req.get('host') returns the internal container
// address, not the public hostname. BACKEND_URL overrides this — but only
// when it points somewhere reachable from the browser. A BACKEND_URL left
// over from a local .env (http://localhost:...) would otherwise leak into
// production responses and break uploads with a CORS/loopback error.
function serverBaseUrl(req) {
  const configured = process.env.BACKEND_URL;
  if (configured && !/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(configured)) {
    return configured.replace(/\/$/, '');
  }
  const proto = req.get('X-Forwarded-Proto') || req.protocol;
  const host  = req.get('X-Forwarded-Host')  || req.get('host');
  return `${proto}://${host}`;
}

// ── Audio ─────────────────────────────────────────────────────────────────────

const AUDIO_DIR = path.join(__dirname, '..', 'uploads', 'audio');
fs.mkdirSync(AUDIO_DIR, { recursive: true });

const audioStorage = multer.diskStorage({
  destination: AUDIO_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp3';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const audioUpload = multer({
  storage: audioStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm']
      .includes(file.mimetype) || /\.(mp3|wav|ogg|webm)$/i.test(file.originalname);
    cb(null, ok);
  },
});

// ── Models (GLB / VRM) ────────────────────────────────────────────────────────

const MODEL_DIR = path.join(__dirname, '..', 'uploads', 'models');
fs.mkdirSync(MODEL_DIR, { recursive: true });

const modelStorage = multer.diskStorage({
  destination: MODEL_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.glb';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const modelUpload = multer({
  storage: modelStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(glb|vrm)$/i.test(file.originalname)
      || ['model/gltf-binary', 'model/vrm', 'application/octet-stream'].includes(file.mimetype);
    cb(null, ok);
  },
});

// ── Rate limiters ─────────────────────────────────────────────────────────────

const audioLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60,  standardHeaders: true, legacyHeaders: false });
const modelLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20,  standardHeaders: true, legacyHeaders: false });

// ── Routes ────────────────────────────────────────────────────────────────────

const router = express.Router();

router.post('/audio', audioLimiter, requireAuth, audioUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  const url = `${serverBaseUrl(req)}/uploads/audio/${req.file.filename}`;
  res.json({ url });
});

router.post('/model', modelLimiter, requireAuth, modelUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  const url = `${serverBaseUrl(req)}/uploads/models/${req.file.filename}`;
  res.json({ url, filename: req.file.filename, size: req.file.size });
});

module.exports = router;
