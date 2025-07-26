const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const TEMPO_MS = 800;
const SEED_COUNT = 100;
const MIN_CLUSTER_SIZE = 100; // Minimum pixels per region
const COLOR_THRESHOLD = 40; // Max color distance per channel
let clusters = [];

let rhythmPattern = [];
let rhythmStep = 0;

const img = new Image();
const photoIndex = Math.floor(Math.random() * 4) + 1;
img.src = `photos/${photoIndex}.png`;

let originalImageData;

img.onload = () => {
  const scale = Math.min(600 / img.width, 1);
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
};

function generateRhythmPattern(beatLengthMs) {
  const count = Math.floor(Math.random() * 16) + 8; // 8–24 steps
  const pattern = [];
  for (let i = 0; i < count; i++) {
    const multiplier = Math.floor(Math.random() * 5) + 1; // 1–8
    pattern.push(multiplier * beatLengthMs);
  }
  return pattern;
}

function printClusterInfo(cluster) {
  console.log("Cluster Info:");
  console.log("  Size:", cluster.size);
  console.log("  Centroid (approx):", cluster.centroid);
  console.log("cx: ", cluster.cx, " cy: ", cluster.cy)
  console.log("  Avg Color:", cluster.color);
  console.log("  Width:", cluster.width);
  console.log("  Height:", cluster.height);
}

function analyzeCluster(points, data, width, height) {
  let r = 0, g = 0, b = 0;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

  points.forEach(([x, y]) => {
    const idx = (y * width + x) * 4;
    r += data[idx];
    g += data[idx + 1];
    b += data[idx + 2];

    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  });

  const size = points.length;

  return {
    pixels: points,
    color: [Math.round(r / size), Math.round(g / size), Math.round(b / size)],
    centroid: points[0], // Using first pixel for speed, could average instead
    cx: points[0][0]/width,
    cy: points[0][1]/height,
    size: size,
    width: maxX - minX,
    height: maxY - minY,
    longRatio: Math.max(this.width, this.height) / Math.min(this.width, this.height)
  };
}



function colorDistanceSq(c1, c2) {
  return (c1[0] - c2[0]) ** 2 + (c1[1] - c2[1]) ** 2 + (c1[2] - c2[2]) ** 2;
}

function floodFillCluster(seedX, seedY, visited, data, width, height, thresholdSq) {
  const offset = (y, x) => (y * width + x) * 4;
  const seedIndex = offset(seedY, seedX);
  const seedColor = [
    data[seedIndex],
    data[seedIndex + 1],
    data[seedIndex + 2]
  ];

  const queue = [[seedX, seedY]];
  const cluster = [];

  while (queue.length) {
    const [x, y] = queue.pop();
    const idx = offset(y, x);
    if (visited[y][x]) continue;

    const color = [data[idx], data[idx + 1], data[idx + 2]];
    if (colorDistanceSq(color, seedColor) > thresholdSq) continue;

    visited[y][x] = true;
    cluster.push([x, y]);

    // Add neighbors
    [[1,0], [-1,0], [0,1], [0,-1]].forEach(([dx, dy]) => {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height && !visited[ny][nx]) {
        queue.push([nx, ny]);
      }
    });
  }

  return cluster;
}

function segmentImage() {
  startClock("segment");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  originalImageData = imageData;
  const { width, height, data } = imageData;
  clusters = [];

  const visited = Array.from({ length: height }, () => Array(width).fill(false));

  for (let i = 0; i < SEED_COUNT; i++) {
    const x = Math.floor(Math.random() * width);
    const y = Math.floor(Math.random() * height);
    if (visited[y][x]) continue;

    const points = floodFillCluster(x, y, visited, data, width, height, COLOR_THRESHOLD ** 2);
    if (points.length >= MIN_CLUSTER_SIZE) {
      const cluster = analyzeCluster(points, data, width, height);
      clusters.push(cluster);
    }
  }

  console.log(`Found ${clusters.length} clusters`);
  endClock("segment");
  printClusterInfo(clusters[0]);  // Just print one for now
  animateClusterCycle();
}

function animateClusterCycle() {
  let current = 0;
  const baseBeat = TEMPO_MS;
  rhythmPattern = generateRhythmPattern(baseBeat);
  rhythmStep = 0;

  function step() {
    const imageData = ctx.createImageData(canvas.width, canvas.height);
    const baseData = originalImageData.data;
    const outData = imageData.data;

    for (let i = 0; i < outData.length; i++) {
      outData[i] = baseData[i];
    }

    for (let i = 0; i < outData.length; i += 4) {
      outData[i] = outData[i] * 0.5 + 128;
      outData[i+1] = outData[i+1] * 0.5 + 128;
      outData[i+2] = outData[i+2] * 0.5 + 128;
    }

    const cluster = clusters[current];
    cluster.pixels.forEach(([x, y]) => {
      const idx = (y * canvas.width + x) * 4;
      outData[idx] = baseData[idx];
      outData[idx + 1] = baseData[idx + 1];
      outData[idx + 2] = baseData[idx + 2];
    });

    ctx.putImageData(imageData, 0, 0);
    playClusterSound(cluster);

    current = (current + 1) % clusters.length;
    rhythmStep = (rhythmStep + 1) % rhythmPattern.length;
    const delay = rhythmPattern[rhythmStep];

    setTimeout(step, delay);
  }

  step(); // initial call
}

document.getElementById("recolorBtn").addEventListener("click", segmentImage);
