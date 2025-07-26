const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
//import * as Tone from 'tone';

// sound.js
const reverb = new Tone.Reverb({
  decay: 60,      // length of the tail
  preDelay: 0.01 // time before reverb starts
}).toDestination();

reverb.generate(); // pre-render the impulse response

const dryGain = new Tone.Gain(0.2).toDestination();
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
  duration *= 0.2
  const amplitude = Math.min(1.0, cluster.size / 1000);
  const pan = (cluster.cx - 0.5) * 2;

  const osc = new Tone.Oscillator(freq, 'square').start(now).stop(now + duration);

  const filter = new Tone.Filter({
    type: 'lowpass',
    frequency: 400 + ((cluster.color[0] + cluster.color[1] + cluster.color[2]) / 3) * 10
  });

  const ampEnv = new Tone.AmplitudeEnvelope({
    attack: 0.05,
    decay: duration * 0.3,
    sustain: 1.0,
    release: duration * 4.5
  });

  const panner = new Tone.Panner(pan);

  osc.chain(filter, ampEnv, panner);

  // Send dry and wet to different paths
  panner.fan(dryGain, wetGain);

  ampEnv.triggerAttackRelease(duration, now);
}
