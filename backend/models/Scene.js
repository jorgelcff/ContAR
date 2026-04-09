const mongoose = require('mongoose');

const SceneSchema = new mongoose.Schema({
  sceneId: { type: String, required: true, unique: true },
  metadata: {
    title: { type: String, default: 'Untitled Scene' },
    theme: { type: String, default: '' },
  },
  content: {
    avatar: {
      modelUrl: { type: String, default: '' },
      transform: {
        position: { type: [Number], default: [0, 0, 0] },
        rotation: { type: [Number], default: [0, 0, 0] },
        scale: { type: [Number], default: [1, 1, 1] },
      },
    },
    narrative: {
      text: { type: String, default: '' },
      audioUrl: { type: String, default: '' },
      bubbleStyle: {
        color: { type: String, default: '#ffffff' },
        fontSize: { type: Number, default: 14 },
      },
    },
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Scene', SceneSchema);
