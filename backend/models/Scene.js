const mongoose = require('mongoose');

const SceneSchema = new mongoose.Schema({
  sceneId:  { type: String, required: true, unique: true },
  ownerId:  { type: String, default: '' },
  metadata: {
    title: { type: String, default: 'Untitled Scene' },
    theme: { type: String, default: '' },
  },
  content: {
    avatar: {
      modelUrl:   { type: String, default: '' },
      posePreset: { type: String, default: 'idle' },
      // How the pose plays back: speed multiplier, whether it runs once instead
      // of looping, an optional VRM expression, and a custom .vrma animation.
      animSpeed:     { type: Number,  default: 1 },
      animLoopOnce:  { type: Boolean, default: false },
      vrmExpression: { type: String,  default: '' },
      vrmaUrl:       { type: String,  default: '' },
      transform: {
        position: { type: [Number], default: [0, 0, 0] },
        rotation: { type: [Number], default: [0, 0, 0] },
        scale:    { type: [Number], default: [1, 1, 1] },
      },
    },
    narrative: {
      text:     { type: String, default: '' },
      audioUrl: { type: String, default: '' },
      // How narration text is shown: 'bubble' | 'subtitle' | 'none'.
      displayMode: { type: String, default: 'bubble' },
      bubbleStyle: {
        color:    { type: String, default: '#ffffff' },
        fontSize: { type: Number, default: 14 },
      },
    },
    timeline: {
      duration: { type: Number, default: 10 },
      blocks:   { type: mongoose.Schema.Types.Mixed, default: [] },
    },
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Scene', SceneSchema);
