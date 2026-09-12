const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name:                    { type: String,  default: '' },
  email:                   { type: String,  required: true, unique: true, lowercase: true, trim: true },
  passwordHash:            { type: String,  required: true },
  emailVerified:           { type: Boolean, default: false },
  emailVerificationToken:  { type: String,  default: null },
  resetToken:              { type: String,  default: null },
  resetTokenExpiry:        { type: Date,    default: null },
  // Links this account to its Avaturn SDK user id, so "load my avatars"
  // works from any device/browser instead of only the one that created them
  // (the SDK itself only ever hands back an id — it has no per-account concept).
  avaturnUserId:           { type: String,  default: '' },
  createdAt:               { type: Date,    default: Date.now },
});

module.exports = mongoose.model('User', UserSchema);
