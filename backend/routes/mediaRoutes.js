const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../middleware/authMiddleware');
const { cloudinaryConfigured, uploadBuffer, destroyByUrl } = require('../config/cloudinary');

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

// Cloudinary free plan caps individual uploads at 10 MB for raw files.
// Match that limit at the multer layer so we reject early with a clear 413
// instead of buffering the whole file only for Cloudinary to refuse it.
const MODEL_SIZE_LIMIT = cloudinaryConfigured ? 10 * 1024 * 1024 : 50 * 1024 * 1024;

const modelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MODEL_SIZE_LIMIT },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(glb|vrm)$/i.test(file.originalname)
      || ['model/gltf-binary', 'model/vrm', 'application/octet-stream'].includes(file.mimetype);
    cb(null, ok);
  },
});

// ── Rate limiters ─────────────────────────────────────────────────────────────

const audioLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60,  standardHeaders: true, legacyHeaders: false });
// 60 model uploads per 15 min — generous enough for iterative testing while
// still blocking brute-force abuse. Cloudinary deduplicates by content hash
// so repeated uploads of the same file don't waste storage quota.
const modelLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60,  standardHeaders: true, legacyHeaders: false });

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

// Removes a previously-generated narration audio file from Cloudinary when it
// is replaced by a new one. No-op (besides the response) when Cloudinary isn't
// configured, since disk-fallback files are harmless local leftovers.
router.delete('/audio', audioLimiter, requireAuth, async (req, res) => {
  const { url } = req.body || {};
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'URL ausente' });
  if (!cloudinaryConfigured) return res.json({ ok: true });
  try {
    await destroyByUrl(url, 'video');
    res.json({ ok: true });
  } catch (err) {
    console.error('Audio delete failed', err);
    res.status(502).json({ error: 'Falha ao remover o áudio anterior' });
  }
});

// Multer's LIMIT_FILE_SIZE fires as middleware error before the route handler.
function modelUploadMiddleware(req, res, next) {
  modelUpload.single('file')(req, res, (err) => {
    if (err?.code === 'LIMIT_FILE_SIZE') {
      const limitMB = Math.round(MODEL_SIZE_LIMIT / 1024 / 1024);
      return res.status(413).json({ error: `Arquivo muito grande. O limite é ${limitMB} MB.` });
    }
    if (err) return next(err);
    next();
  });
}

router.post('/model', modelLimiter, requireAuth, modelUploadMiddleware, async (req, res) => {
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
    // Cloudinary rejects files exceeding the plan's per-upload size cap with a
    // message like "File size too large. Got N. Maximum is M."
    if (/file size too large/i.test(err?.message)) {
      const limitMB = Math.round(MODEL_SIZE_LIMIT / 1024 / 1024);
      return res.status(413).json({ error: `Arquivo muito grande. O limite é ${limitMB} MB.` });
    }
    res.status(502).json({ error: 'Falha ao enviar o modelo para o armazenamento', reason: err?.message || String(err) });
  }
});

module.exports = router;
