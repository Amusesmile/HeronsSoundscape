const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
//import * as Tone from 'tone';

// sound.js
const reverb = new Tone.Reverb({
  decay: 60,      // length of the tail
  preDelay: 0.01 // time before reverb starts
}).toDestination();

reverb.generate(); // pre-render the impulse response

const dryGain = new Tone.Gain(0.5).toDestination();
const wetGain = new Tone.Gain(0.4).connect(reverb);


// Scale loosely inspired by Scarborough Fair (Dorian)
const scarboroughScale = [0, 2, 3, 5, 7, 9, 10];
const baseMidiNote = 12;

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function getScaleNoteFromXY(xNorm, yNorm) {
  const degree = Math.floor(xNorm * scarboroughScale.length);
  const octave = 3 + Math.floor(yNorm * 3);
  const midi = baseMidiNote + scarboroughScale[degree % scarboroughScale.length] + 12 * octave;
  return midiToFreq(midi);
}

function playClusterSound(cluster) {
  const now = Tone.now();
  const freq = getScaleNoteFromXY(cluster.cx, cluster.cy);
  let duration = 0.8 + Math.min(1.5, cluster.size / 1000);
  duration *= 1.0;
  const amplitude = Math.min(1.0, cluster.size / 1000);
  const pan = (cluster.cx - 0.5) * 2;

  // Main oscillator
  const osc = new Tone.Oscillator(freq, 'sawtooth').start(now).stop(now + duration);

  // Filter
  const filter = new Tone.Filter({
    type: 'lowpass',
    frequency: 400 + ((cluster.color[0] + cluster.color[1] + cluster.color[2]) / 3) * 10
  });

  // LFO on filter frequency
  const filterLFO = new Tone.LFO({
    frequency: (2 + cluster.cy * 5)*0.3, // Hz
    min: -200,
    max: 500
  }).start();
  filterLFO.connect(filter.frequency);

  // LFO on pitch
  let pitchModRange = 0.1
  const pitchLFO = new Tone.LFO({
    frequency: 2,
    min: freq-pitchModRange,
    max: freq+pitchModRange
  }).start();
  pitchLFO.connect(osc.frequency);

  // Amplitude Envelope
  const ampEnv = new Tone.AmplitudeEnvelope({
    attack: 0.05,
    decay: duration * 0.3,
    sustain: 1.0,
    release: duration * 4.5
  });

  // Pan
  const panner = new Tone.Panner(pan);

  osc.chain(filter, ampEnv, panner);

  // Dry and wet output
  panner.fan(dryGain, wetGain);

  ampEnv.triggerAttackRelease(duration, now);

  // Auto stop LFOs later to clean up
  filterLFO.stop(now + duration + 1);
  pitchLFO.stop(now + duration + 1);
}

