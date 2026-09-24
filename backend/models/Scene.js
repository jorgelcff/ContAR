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
      // Which language `text` and `audioUrl` above are in. Empty on every
      // scene saved before this existed, which the viewer reads as "the
      // original, whatever it is" — it will not claim a fallback happened.
      language: { type: String, default: '' },
      // The same narration in other languages: { en: { text, audioUrl }, … }.
      // A QR code left at a poster is read by whoever walks past it, and there
      // is nobody standing there to explain which language it is in.
      // Deliberately a separate audio file per language rather than one shared
      // recording — see utils/narration.js on why a language is never applied
      // by halves.
      translations: { type: mongoose.Schema.Types.Mixed, default: {} },
      // Per-sentence timing from Azure's synthesis (real audio seconds, not a
      // word-count estimate), so the narrator's gestures can sync to the
      // actual speech instead of guessing its pace. Empty for scenes recorded
      // before this existed, or narrated via the Web Speech API fallback —
      // the pacing estimate in narrationGestures.js covers those.
      sentenceTimeline: {
        type: [{
          start: { type: Number, required: true },
          end:   { type: Number, required: true },
          text:  { type: String, default: '' },
        }],
        default: [],
      },
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
