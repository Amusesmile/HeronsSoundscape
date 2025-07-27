const canvas = document.getElementById("canvas");
const waveformCanvas = document.getElementById("waveformCanvas");
const startButton = document.getElementById("startButton")
const video = document.getElementById("video");
const ctx = canvas.getContext("2d");
const TEMPO_MS = 100;
const MAX_CLUSTERS = 20;
const MIN_CLUSTER_SIZE = 100; // Minimum pixels per region
const COLOR_THRESHOLD = 40; // Max color distance per channel
let currentCluster = -1;
let clusters = [];
let rhythmPattern = [];
let rhythmStep = 0;
let originalImageData;
let currentVideoFrame = null;

console.log("tempo: ", TEMPO_MS)

function createClusters(){
  //call after canvas width/height have been determined 

  // const startTime = Date.now();
  // // ... do some stuff ...
  // const elapsed = Date.now() - startTime; // milliseconds since start
  // console.log(`Elapsed time: ${elapsed} ms`);

  clusters = [];
  const width = canvas.width;
  const height = canvas.height;
  for (let i = 0; i < MAX_CLUSTERS; i++) {
    const locations = [];

    while (locations.length < 10) {
      const x = Math.floor(Math.random() * width);
      const y = Math.floor(Math.random() * height);
      const key = `${x},${y}`;
      locations.push([x, y]);
    }

    const cluster = {
      locations,  // array of 10 unique [x, y] points
      playing: false,
      startTime: Date.now()
    };

    clusters.push(cluster);
  }
    animateClusterCycle();

  // Access:
  //const [x, y] = seedLocations[i];
}

function generateRhythmPattern(beatLengthMs) {
  const count = Math.floor(Math.random() * 16) + 8; // 8–24 steps
  const pattern = [];
  for (let i = 0; i < count; i++) {
    const multiplier = Math.floor(Math.random() * 5) + 1; // 1–8
    pattern.push(multiplier * beatLengthMs);
  }
  return pattern;
}

video.addEventListener('loadedmetadata', () => {
  console.log("video loaded");
  const scale = Math.min(600 / video.videoWidth, 1);
  canvas.width = video.videoWidth * scale;
  canvas.height = video.videoHeight * scale;
  //ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  waveformCanvas.width = canvas.width;
  waveformCanvas.height = canvas.height*0.15

  canvas.style.left = "0px"
  canvas.style.top = "0px"
  waveformCanvas.style.left = "0px"
  waveformCanvas.style.top = String(canvas.height-waveformCanvas.height) + "px"

  startButton.style.left = "0px"
  startButton.style.top = String(canvas.height) + "px"

  //createClusters();

  drawVideoFrame(); // start animation loop
});

video.load()

function drawVideoFrame() {
  startClock("drawVideo");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  currentVideoFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  //endClock("drawVideo");
  // for (const cluster of clusters) {
  //   if (cluster.playing && cluster.imageDataOverlay) {
  //     ctx.putImageData(cluster.imageDataOverlay, 0, 0);
  //   }
  // }

  startClock("change data");


  //method 1
  // const baseFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const baseData = currentVideoFrame.data;

  for (const cluster of clusters) {
    if (!cluster.playing || !cluster.pixels) continue;

    for (const [x, y] of cluster.pixels) {
      const idx = (y * canvas.width + x) * 4;

      // Optionally boost brightness or tint cluster pixels
      // baseData[idx]     = Math.min(255, baseData[idx] + 40);     // R
      // baseData[idx + 1] = Math.min(255, baseData[idx + 1] + 20); // G
      // baseData[idx + 2] = Math.min(255, baseData[idx + 2] + 20); // B
      // baseData[idx + 3] = 255; // leave alpha alone
      baseData[idx]     = 255;     // R
      baseData[idx + 1] = 0; // G
      baseData[idx + 2] = 0; // B
    }
  }

  // Put modified pixels back onto canvas
  ctx.putImageData(currentVideoFrame, 0, 0);
  //endClock("change data");

  requestAnimationFrame(drawVideoFrame);
}

function printClusterInfo(cluster) {
  console.log("Cluster Info:");
  console.log("  Size:", cluster.size);
  console.log("  Centroid (approx):", cluster.centroid);
  console.log("cx: ", cluster.cx, " cy: ", cluster.cy)
  console.log("  Avg Color:", cluster.color);
  console.log("  Width:", cluster.width);
  console.log("  Height:", cluster.height);
  console.log("  WidthN:", cluster.widthN);
  console.log("  minXN:", cluster.minXN);
}

function analyzeCluster(cluster, points, data, width, height) {
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
  cluster.pixels = points;
  cluster.color = [Math.round(r / size), Math.round(g / size), Math.round(b / size)];
  cluster.centroid = points[0];
  cluster.cx = points[0][0]/width;
  cluster.cy = points[0][1]/height;
  cluster.minX = minX;
  cluster.minXN = minX/width;
  cluster.minY = minY;
  cluster.maxX = maxX;
  cluster.maxY = maxY;
  cluster.size = size;
  cluster.width = maxX - minX;
  cluster.height = maxY - minY;
  cluster.widthN = (maxX - minX)/width;
  cluster.longRatio = Math.max(cluster.width, cluster.height) / Math.min(cluster.width, cluster.height);
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

function playNextCluster() {
  startClock("playNextCluster");
  if (!currentVideoFrame) return;
  if(currentCluster > -1)
  {
    clusters[currentCluster].playing = false;
  }
  currentCluster = (currentCluster+1)%clusters.length;
  const imageData = currentVideoFrame;
  //originalImageData = imageData;
  const { width, height, data } = imageData;
  let cluster = clusters[currentCluster];
  cluster.data = imageData;

  for (let i = 0; i < cluster.locations.length; i++) {
    const [x, y] = cluster.locations[i];
    const visited = Array.from({ length: height }, () => Array(width).fill(false));
    const points = floodFillCluster(x, y, visited, data, width, height, COLOR_THRESHOLD ** 2);
    if (points.length >= MIN_CLUSTER_SIZE) {
      analyzeCluster(cluster, points, data, width, height);
      cluster.playing = true;
      cluster.startTime = Date.now();
      break;
    }
  }
  endClock("playNextCluster");
  //printClusterInfo(cluster);  // Just print one for now
  //sanimateClusterCycle();
}

function animateClusterCycle() {
  let current = 0;
  const baseBeat = TEMPO_MS;
  rhythmPattern = generateRhythmPattern(baseBeat);
  rhythmStep = 0;

  function step() {
    playNextCluster();
    playClusterGrainSound(clusters[currentCluster]);
    rhythmStep = (rhythmStep + 1) % rhythmPattern.length;
    const delay = rhythmPattern[rhythmStep];

    setTimeout(step, delay);
  }

  step(); // initial call
}

startButton.addEventListener("click", createClusters);
