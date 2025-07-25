// sound.js

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Reverb setup (simple convolution or placeholder delay for now)
const reverbGain = audioCtx.createGain();
reverbGain.gain.value = 0.3;

const dryGain = audioCtx.createGain();
dryGain.gain.value = 1.0;

const masterGain = audioCtx.createGain();
masterGain.gain.value = 0.8;

dryGain.connect(masterGain);
reverbGain.connect(masterGain);
masterGain.connect(audioCtx.destination);

// Simple placeholder reverb using delay
const reverbDelay = audioCtx.createDelay();
reverbDelay.delayTime.value = 0.3;
reverbDelay.connect(reverbGain);
reverbDelay.connect(audioCtx.destination);

// Scale loosely inspired by Scarborough Fair (Dorian)
const scarboroughScale = [0, 2, 3, 5, 7, 9, 10]; // intervals in semitones
const baseMidiNote = 24; // Middle C

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function getScaleNoteFromXY(xNorm, yNorm) {
  const degree = Math.floor(xNorm * scarboroughScale.length);
  const octave = 3 + Math.floor(yNorm * 2);
  const midi = baseMidiNote + scarboroughScale[degree % scarboroughScale.length] + 12 * octave;
  return midiToFreq(midi);
}

function playClusterSound(cluster) {
  const now = audioCtx.currentTime;

  const freq = getScaleNoteFromXY(cluster.cx, cluster.cy);
  const duration = 0.8 + Math.min(1.5, cluster.size / 1000); // in seconds
  const amplitude = Math.min(1.0, cluster.size / 1000);
  const pan = (cluster.cx - 0.5) * 2; // -1 to 1
  const reverbAmount = cluster.longRatio > 0.8 ? 0.6 : 0.2; // long shapes = more space

  const osc = audioCtx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(freq, now);

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  const brightness = (cluster.color[0] + cluster.color[1] + cluster.color[2]) / (3 * 255);
  filter.frequency.setValueAtTime(400 + brightness * 3000, now);

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(amplitude, now + 0.05);
  gain.gain.linearRampToValueAtTime(0, now + duration);

  const panner = audioCtx.createStereoPanner();
  panner.pan.value = pan;

  // Connect graph
  osc.connect(filter).connect(gain);
  gain.connect(dryGain);
  gain.connect(reverbDelay);

  osc.start(now);
  osc.stop(now + duration + 0.1);
}
