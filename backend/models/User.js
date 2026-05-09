const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name:                    { type: String,  default: '' },
  email:                   { type: String,  required: true, unique: true, lowercase: true, trim: true },
  passwordHash:            { type: String,  required: true },
  emailVerified:           { type: Boolean, default: false },
  emailVerificationToken:  { type: String,  default: null },
  resetToken:              { type: String,  default: null },
  resetTokenExpiry:        { type: Date,    default: null },
  createdAt:               { type: Date,    default: Date.now },
});

module.exports = mongoose.model('User', UserSchema);
