const mongoose = require('mongoose');

const StorySceneSchema = new mongoose.Schema(
  {
    sceneId: { type: String, required: true },
    order: { type: Number, required: true, min: 0 },
    transitionText: { type: String, default: '' },
    durationSeconds: { type: Number, default: 0, min: 0 },
    // 'time' counts durationSeconds off a clock; 'narration' holds the scene
    // until the narration audio finishes.
    //
    // Waiting is the default, and that does change how stories saved before
    // this existed play in the browser: a line longer than the configured
    // seconds is no longer cut off mid-sentence, and a shorter one no longer
    // leaves the character standing in silence. It is not a change in AR,
    // which has always advanced when the audio ended — the two players
    // disagreed, and this is the side that was right. A scene with no
    // narration still falls back to its seconds either way.
    advanceOn: { type: String, enum: ['time', 'narration'], default: 'narration' },
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
  // How many times someone other than the author opened the public link. The
  // reach panel counted sign-ups, which misses the entire audience a QR code
  // at a poster is for: they watch and leave without ever making an account,
  // so the number that matters most was the one number nobody had.
  views: { type: Number, default: 0 },
  lastViewedAt: { type: Date, default: null },
  // How many of those watched it through to the end. Opens alone say a link
  // was scanned; this says whether the story held anyone — the difference
  // between reach and retention, and the one a reader of the work will ask
  // about.
  completions: { type: Number, default: 0 },
  // Opens broken down by where the link was handed out: { poster: 12,
  // slide: 3, direct: 27 }. Print a different tag on each QR code and the
  // numbers say which channel actually worked.
  viewsBySource: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

StorySchema.pre('findOneAndUpdate', function setUpdatedAt() {
  this.set({ updatedAt: new Date() });
});

module.exports = mongoose.model('Story', StorySchema);
