const mongoose = require('mongoose');

const AvatarSchema = new mongoose.Schema({
  avatarId: { type: String, required: true, unique: true },
  modelUrl: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Avatar', AvatarSchema);
