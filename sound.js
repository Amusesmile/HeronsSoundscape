const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
//import * as Tone from 'tone';

const grainPlayer = new Tone.GrainPlayer({
  url: 'samples/e3.mp3',
  loop: true,
  grainSize: 0.02,
  overlap: 0.05
}).toDestination();

//

grainPlayer.sync(); // optional if syncing to transport

//await Tone.loaded(); // ensure sample is ready before using

// sound.js
const reverb = new Tone.Reverb({
  decay: 6,      // length of the tail
  preDelay: 0.01 // time before reverb starts
}).toDestination();

reverb.generate(); // pre-render the impulse response

const dryGain = new Tone.Gain(1.0).toDestination();
const wetGain = new Tone.Gain(0.1).connect(reverb);
const analyser = new Tone.Analyser("waveform", 1024);
dryGain.connect(analyser);

// Scale loosely inspired by Scarborough Fair (Dorian)
const scarboroughScale = [0, 2, 3, 5, 7, 9, 10];
const baseMidiNote = 12;

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function getScaleNoteFromXY(xNorm, yNorm) {
  const degree = Math.floor(xNorm * scarboroughScale.length);
  const octave = 2 + Math.floor(yNorm * 2);
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
    type: 'bandpass',
    frequency: 300 + ((cluster.color[0] + cluster.color[1] + cluster.color[2]) / 3) * 10
  });

  // LFO on filter frequency
  const filterLFO = new Tone.LFO({
    frequency: (2 + cluster.cy * 5)*0.3, // Hz
    min: -400,
    max: 4000
  }).start();
  filterLFO.connect(filter.frequency);

  // LFO on pitch
  let pitchModRange = 0.2
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

console.log("test7")
function playClusterGrainSound(cluster) {
  const now = Tone.now();
  let duration = 0.8 + Math.min(1.5, cluster.size / 1000);
  duration = 5.0;//*= 0.2*Math.random()*10.0;
  const amplitude = Math.min(1.0, cluster.size / 1000);
  const pan = (cluster.cx - 0.5) * 2;
  const brightness = (cluster.color[0] + cluster.color[1] + cluster.color[2]) / (3 * 255);

  // Clone a player so grains can overlap without cutting each other
  let gs = 0.05
  let overlap = 0.1
  const player = new Tone.GrainPlayer({
    url: grainPlayer.buffer,
    loop: true,
    grainSize: gs,//(0.15 + brightness * 0.15)*0.8,
    overlap: overlap,//0.03 + (1 - brightness) * 0.05,
    playbackRate: 0.3,//(0.8 + cluster.cy * 0.6)*10
    detune: -2400+getRandomInt(0, 2)*1200
  });

  const filter = new Tone.Filter({
    type: 'bandpass',
    frequency: 200 + brightness * 800,
    Q: 1
  });

  const ampEnv = new Tone.AmplitudeEnvelope({
    attack: 0.01,
    decay: duration * 0.3,
    sustain: 0.9,
    release: duration * 0.25
  });

  const panner = new Tone.Panner(pan);

  player.chain(filter, ampEnv, panner);
  panner.fan(dryGain, wetGain);

  // Randomize start position in buffer
  const bufferDuration = player.buffer.duration;
  const startOffset = (cluster.cx + cluster.cy) % 1 * (bufferDuration - duration);
  player.loopStart = startOffset;
  player.loopEnd = startOffset+duration
  player.start(now, startOffset);
  ampEnv.triggerAttackRelease(duration*0.4, now);//first argument is duration of sustain! 

  // Auto-dispose after sound ends
  setTimeout(() => {
    player.dispose();
    filter.dispose();
    ampEnv.dispose();
    panner.dispose();
  }, (duration) * 1000);
}

//const waveformCanvas = document.getElementById("waveformCanvas");
const waveformCTX = waveformCanvas.getContext("2d");

function drawWaveform() {
  requestAnimationFrame(drawWaveform);

  const values = analyser.getValue();
  const width = waveformCanvas.width;
  const height = waveformCanvas.height;
  waveformCTX.clearRect(0, 0, width, height);

  waveformCTX.beginPath();
  waveformCTX.fillStyle = 'rgba(255, 255, 255, 0.5)';
  waveformCTX.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  waveformCTX.lineWidth = 2;

  // Draw the waveform line
  for (let i = 0; i < values.length; i++) {
    const x = (i / values.length) * width;
    const y = (1 - (values[i] + 1) / 2) * height;
    if (i === 0) waveformCTX.moveTo(x, y);
    else waveformCTX.lineTo(x, y);
  }

  // Complete the path down to bottom of canvas and back to start
  //waveformCTX.lineTo(width, height*0.5);
  //waveformCTX.lineTo(0, height*0.5);
  //waveformCTX.closePath();

  // Fill the shape
  waveformCTX.fill();

  // Optional: overlay stroke
  waveformCTX.stroke();
}

drawWaveform(); // Start the visualization loop

