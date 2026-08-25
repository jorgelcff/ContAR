require('dotenv').config();
const mongoose = require('mongoose');

const { getAuthSecret } = require('./config/auth');
getAuthSecret(); // fail fast in production if AUTH_JWT_SECRET is missing/insecure

const app = require('./app');

const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/avaturn3d';

// Connect to MongoDB — server starts regardless of DB availability
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) =>
    console.warn('MongoDB connection failed (running without DB):', err.message)
  );

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
