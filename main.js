const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const TEMPO_MS = 500
const CLUSTERS = 8

const img = new Image();
const photoIndex = Math.floor(Math.random() * 4) + 1;
img.src = `photos/${photoIndex}.png`;

let originalImageData;
let palette = [];
let pixelLabels = [];

img.onload = () => {
  const scale = Math.min(600 / img.width, 1);
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
};

function colorDistanceSq(c1, c2) {
  return (
    (c1[0] - c2[0]) ** 2 +
    (c1[1] - c2[1]) ** 2 +
    (c1[2] - c2[2]) ** 2
  );
}

function quantizeAndRecolor() {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const pixels = [];

  // Sample for quantization
  for (let i = 0; i < data.length; i += 16) {
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }

  // Quantize into 14 colors
  const colorMap = MMCQ.quantize(pixels, CLUSTERS);
  palette = colorMap.palette();

  // Label each pixel by closest palette color
  pixelLabels = [];
  for (let i = 0; i < data.length; i += 4) {
    const rgb = [data[i], data[i + 1], data[i + 2]];
    let best = 0;
    let minDist = Infinity;
    for (let j = 0; j < palette.length; j++) {
      const d = colorDistanceSq(rgb, palette[j]);
      if (d < minDist) {
        minDist = d;
        best = j;
      }
    }
    pixelLabels.push(best);
    // initially recolor to best palette color
    data[i] = palette[best][0];
    data[i + 1] = palette[best][1];
    data[i + 2] = palette[best][2];
  }

  originalImageData = imageData;
  ctx.putImageData(imageData, 0, 0);

  // Start animation
  animateHighlightCycle();
}

function animateHighlightCycle() {
  let current = 0;
  const fadeFactor = 0.7;

  setInterval(() => {
    const data = new Uint8ClampedArray(originalImageData.data);

    for (let i = 0; i < pixelLabels.length; i++) {
      const label = pixelLabels[i];
      const offset = i * 4;
      const baseColor = palette[label];

      if (label === current) {
        data[offset]     = baseColor[0];
        data[offset + 1] = baseColor[1];
        data[offset + 2] = baseColor[2];
      } else {
        data[offset]     = baseColor[0] + (255 - baseColor[0]) * fadeFactor;
        data[offset + 1] = baseColor[1] + (255 - baseColor[1]) * fadeFactor;
        data[offset + 2] = baseColor[2] + (255 - baseColor[2]) * fadeFactor;
      }
    }

    const frame = new ImageData(data, canvas.width, canvas.height);
    ctx.putImageData(frame, 0, 0);

    // 🔊 Play sound for current cluster
    playWavetableFromCluster(current);

    current = (current + 1) % palette.length;
  }, TEMPO_MS);
}

function getBrightnessWavetable(clusterId, waveSize = 2048) {
  const wave = new Float32Array(waveSize);
  let count = 0;

  for (let i = 0; i < pixelLabels.length; i++) {
    if (pixelLabels[i] !== clusterId) continue;

    const offset = i * 4;
    const r = originalImageData.data[offset];
    const g = originalImageData.data[offset + 1];
    const b = originalImageData.data[offset + 2];
    const brightness = (r + g + b) / 3;

    wave[count % waveSize] += (brightness / 255 - 0.5) * 2;
    count++;
  }

  // Normalize
  const max = Math.max(...wave.map(Math.abs)) || 1;
  for (let i = 0; i < wave.length; i++) {
    wave[i] /= max;
  }

  return wave;
}

function playWavetableFromCluster(clusterId) {
  const waveData = getBrightnessWavetable(clusterId);
  const real = new Float32Array(waveData.length);
  const imag = new Float32Array(waveData.length);

  for (let i = 0; i < waveData.length; i++) {
    real[i] = waveData[i];
    imag[i] = 0;
  }

const wave = audioCtx.createPeriodicWave(real, imag, { disableNormalization: true });
const osc = audioCtx.createOscillator();
osc.setPeriodicWave(wave);
osc.frequency.value = 40 + clusterId;

const gain = audioCtx.createGain();
gain.gain.value = 0;

const filter = audioCtx.createBiquadFilter();
filter.type = "lowpass";
filter.frequency.value = 3000;

osc.connect(filter).connect(gain).connect(audioCtx.destination);

const now = audioCtx.currentTime;
gain.gain.setValueAtTime(0, now);
gain.gain.linearRampToValueAtTime(0.05, now + 0.2);
gain.gain.linearRampToValueAtTime(0.0, now + 1.5);

osc.start();
osc.stop(now + 2.0);
}

document.getElementById("recolorBtn").addEventListener("click", quantizeAndRecolor);
