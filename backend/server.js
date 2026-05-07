require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const sceneRoutes = require('./routes/sceneRoutes');
const avatarRoutes = require('./routes/avatarRoutes');
const storyRoutes = require('./routes/storyRoutes');
const authRoutes = require('./routes/authRoutes');
const ttsRoutes = require('./routes/ttsRoutes');

const app = express();
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/avaturn3d';
const TRUST_PROXY = process.env.TRUST_PROXY || '1';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// Render and other managed platforms sit behind reverse proxies.
// This allows rate limiters and request IP detection to use X-Forwarded-For safely.
app.set('trust proxy', TRUST_PROXY);

app.use(
  cors({
    origin: CORS_ORIGIN.split(',').map((origin) => origin.trim()),
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));

app.use('/api/scene', sceneRoutes);
app.use('/api/avatar', avatarRoutes);
app.use('/api/story', storyRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/tts', ttsRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Connect to MongoDB — server starts regardless of DB availability
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) =>
    console.warn('MongoDB connection failed (running without DB):', err.message)
  );

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
