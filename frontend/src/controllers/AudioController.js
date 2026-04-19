/**
 * AudioController — manages HTML5 Audio playback for the 3D scene.
 *
 * Supports any browser-native audio format (mp3, wav, ogg, etc.).
 * Designed to be decoupled from Three.js so it can be driven independently
 * or synchronized with a TTS/lipsync timeline.
 *
 * Usage:
 *   const audio = new AudioController();
 *   audio.load('https://example.com/speech.mp3');
 *   audio.play();
 *   audio.onTimeUpdate((time, duration) => { ... });
 */
export class AudioController {
  constructor() {
    this._audio = new Audio();
    this._audio.preload = 'metadata';
    this._timeUpdateCbs = [];
    this._endedCbs = [];

    this._audio.addEventListener('timeupdate', () => {
      for (const cb of this._timeUpdateCbs) {
        cb(this._audio.currentTime, this._audio.duration || 0);
      }
    });

    this._audio.addEventListener('ended', () => {
      for (const cb of this._endedCbs) cb();
    });
  }

  /**
   * Load a new audio URL. If audio was playing it will resume after load.
   * @param {string} url  mp3 / wav / ogg URL
   */
  load(url) {
    const wasPlaying = !this._audio.paused;
    this._audio.pause();
    this._audio.src = url ?? '';
    this._audio.load();
    if (wasPlaying && url) {
      this._audio.play().catch((err) => {
        console.warn('AudioController: autoplay blocked after load.', err);
      });
    }
  }

  /** Start playback. Returns a Promise (may be rejected if autoplay is blocked). */
  play() {
    if (!this._audio.src) return Promise.resolve();
    return this._audio.play().catch((err) => {
      console.warn('AudioController: play() blocked by browser autoplay policy.', err);
    });
  }

  /** Pause playback without resetting position. */
  pause() {
    this._audio.pause();
  }

  /** Pause and reset to the beginning. */
  stop() {
    this._audio.pause();
    this._audio.currentTime = 0;
  }

  /**
   * Set playback volume.
   * @param {number} v  0–1
   */
  setVolume(v) {
    this._audio.volume = Math.max(0, Math.min(1, v));
  }

  /** Whether audio is currently playing. */
  get isPlaying() {
    return !this._audio.paused && !this._audio.ended;
  }

  /** Current playback position in seconds. */
  get currentTime() {
    return this._audio.currentTime;
  }

  /** Seek to position in seconds. */
  set currentTime(t) {
    this._audio.currentTime = t;
  }

  /** Total duration in seconds (0 if not loaded). */
  get duration() {
    return this._audio.duration || 0;
  }

  /**
   * Register a callback for time progress: (currentTime, duration) => void.
   * Useful for driving lipsync or subtitles.
   * @param {(currentTime: number, duration: number) => void} cb
   */
  onTimeUpdate(cb) {
    this._timeUpdateCbs.push(cb);
  }

  /**
   * Register a callback for when playback ends: () => void.
   * @param {() => void} cb
   */
  onEnded(cb) {
    this._endedCbs.push(cb);
  }

  /** Release resources. */
  dispose() {
    this._audio.pause();
    this._audio.src = '';
    this._timeUpdateCbs = [];
    this._endedCbs = [];
  }
}
