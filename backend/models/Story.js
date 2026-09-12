const mongoose = require('mongoose');

const StorySceneSchema = new mongoose.Schema(
  {
    sceneId: { type: String, required: true },
    order: { type: Number, required: true, min: 0 },
    transitionText: { type: String, default: '' },
    durationSeconds: { type: Number, default: 0, min: 0 },
    markerUrl: { type: String, default: '' },
  },
  { _id: false }
);

const StorySchema = new mongoose.Schema({
  ownerId: { type: String, required: true, index: true },
  storyId: { type: String, required: true, unique: true },
  metadata: {
    title: { type: String, default: 'Untitled Story' },
    description: { type: String, default: '' },
    language: { type: String, default: 'en' },
  },
  scenes: { type: [StorySceneSchema], default: [] },
  // A story is only reachable via its public share link once this is true —
  // saving/editing a story never implies publishing it.
  isPublic: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

StorySchema.pre('findOneAndUpdate', function setUpdatedAt() {
  this.set({ updatedAt: new Date() });
});

module.exports = mongoose.model('Story', StorySchema);
