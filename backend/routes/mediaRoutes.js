const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../middleware/authMiddleware');
const { cloudinaryConfigured, uploadBuffer } = require('../config/cloudinary');

// Resolve the public base URL for constructing LOCAL file URLs (disk fallback).
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

// sha1 of the file content — used as the Cloudinary public_id so identical
// uploads dedupe to one stored asset (and the same returned URL).
function contentHash(buffer) {
  return crypto.createHash('sha1').update(buffer).digest('hex');
}

// ── Disk fallback (only used when Cloudinary is NOT configured) ─────────────────

const AUDIO_DIR = path.join(__dirname, '..', 'uploads', 'audio');
const MODEL_DIR = path.join(__dirname, '..', 'uploads', 'models');
if (!cloudinaryConfigured) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
  fs.mkdirSync(MODEL_DIR, { recursive: true });
}

// Write a buffer to a local uploads dir and return its public URL. Mirrors the
// previous disk-storage behavior so local dev works without Cloudinary.
function saveToDisk(req, buffer, dir, subpath, ext) {
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  fs.writeFileSync(path.join(dir, filename), buffer);
  return `${serverBaseUrl(req)}/uploads/${subpath}/${filename}`;
}

// ── Multer (in-memory — buffers go straight to Cloudinary or disk) ──────────────

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm']
      .includes(file.mimetype) || /\.(mp3|wav|ogg|webm)$/i.test(file.originalname);
    cb(null, ok);
  },
});

const modelUpload = multer({
  storage: multer.memoryStorage(),
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

router.post('/audio', audioLimiter, requireAuth, audioUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  const ext = path.extname(req.file.originalname).toLowerCase() || '.mp3';
  try {
    if (cloudinaryConfigured) {
      // Cloudinary stores audio under the "video" resource type.
      const result = await uploadBuffer(req.file.buffer, {
        folder: 'contar/audio',
        resourceType: 'video',
        publicId: contentHash(req.file.buffer),
      });
      return res.json({ url: result.secure_url, bytes: result.bytes });
    }
    const url = saveToDisk(req, req.file.buffer, AUDIO_DIR, 'audio', ext);
    res.json({ url });
  } catch (err) {
    console.error('Audio upload failed', err);
    res.status(502).json({ error: 'Falha ao enviar o áudio para o armazenamento' });
  }
});

router.post('/model', modelLimiter, requireAuth, modelUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  const ext = (path.extname(req.file.originalname).toLowerCase() || '.glb').replace('.', '');
  try {
    if (cloudinaryConfigured) {
      // GLB/VRM are binary, non-media files → "raw". Keep the extension in the
      // public_id so the delivered URL ends in .glb/.vrm (GLTFLoader-friendly).
      const hash = contentHash(req.file.buffer);
      const result = await uploadBuffer(req.file.buffer, {
        folder: 'contar/models',
        resourceType: 'raw',
        publicId: `${hash}.${ext}`,
      });
      return res.json({ url: result.secure_url, filename: `${hash}.${ext}`, size: result.bytes });
    }
    const url = saveToDisk(req, req.file.buffer, MODEL_DIR, 'models', `.${ext}`);
    res.json({ url, size: req.file.size });
  } catch (err) {
    console.error('Model upload failed', err);
    res.status(502).json({ error: 'Falha ao enviar o modelo para o armazenamento' });
  }
});

module.exports = router;
