const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const TEMPO_MS = 5000;
const CLUSTERS = 8;

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
  return (c1[0] - c2[0]) ** 2 + (c1[1] - c2[1]) ** 2 + (c1[2] - c2[2]) ** 2;
}

function quantizeAndRecolor() {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const pixels = [];

  for (let i = 0; i < data.length; i += 16) {
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }

  const colorMap = MMCQ.quantize(pixels, CLUSTERS);
  palette = colorMap.palette();

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
    data[i] = palette[best][0];
    data[i + 1] = palette[best][1];
    data[i + 2] = palette[best][2];
  }

  originalImageData = imageData;
  ctx.putImageData(imageData, 0, 0);

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
        data[offset] = baseColor[0];
        data[offset + 1] = baseColor[1];
        data[offset + 2] = baseColor[2];
      } else {
        data[offset] = baseColor[0] + (255 - baseColor[0]) * fadeFactor;
        data[offset + 1] = baseColor[1] + (255 - baseColor[1]) * fadeFactor;
        data[offset + 2] = baseColor[2] + (255 - baseColor[2]) * fadeFactor;
      }
    }

    ctx.putImageData(new ImageData(data, canvas.width, canvas.height), 0, 0);
    playSpectrogram(current);

    current = (current + 1) % palette.length;
  }, TEMPO_MS);
}

function extractSpectrogramFromCluster(clusterId, width = 256, height = 256) {
  const grid = Array.from({ length: width }, () => new Float32Array(height));
  const stepX = canvas.width / width;
  const stepY = canvas.height / height;

  for (let gx = 0; gx < width; gx++) {
    for (let gy = 0; gy < height; gy++) {
      const x = Math.floor(gx * stepX);
      const y = Math.floor(gy * stepY);
      const i = (y * canvas.width + x);
      if (pixelLabels[i] !== clusterId) continue;

      const offset = i * 4;
      const r = originalImageData.data[offset];
      const g = originalImageData.data[offset + 1];
      const b = originalImageData.data[offset + 2];
      const brightness = (r + g + b) / 3 / 255;
      grid[gx][height - 1 - gy] = brightness;
    }
  }

  return grid;
}

function synthesizeFromSpectrogram(grid, sampleRate = 44100, frameTime = 0.4) {
  const width = grid.length;
  const height = grid[0].length;
  const frameSamples = Math.floor(frameTime * sampleRate);
  const totalSamples = frameSamples * width;
  const buffer = audioCtx.createBuffer(1, totalSamples, sampleRate);
  const data = buffer.getChannelData(0);

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const amp = grid[x][y];
      if (amp < 0.01) continue;
      const freq = 100 + (y / height) * 2000;
      for (let i = 0; i < frameSamples; i++) {
        const t = (x * frameSamples + i) / sampleRate;
        data[x * frameSamples + i] += Math.sin(2 * Math.PI * freq * t) * amp;
      }
    }
  }

  return buffer;
}

function playSpectrogram(clusterId) {
  const spectro = extractSpectrogramFromCluster(clusterId);
  const buf = synthesizeFromSpectrogram(spectro);
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  src.connect(audioCtx.destination);
  src.start();
}

document.getElementById("recolorBtn").addEventListener("click", quantizeAndRecolor);
