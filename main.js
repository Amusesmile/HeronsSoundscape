const canvas = document.getElementById("canvas");
const waveformCanvas = document.getElementById("waveformCanvas");
const startButton = document.getElementById("startButton")
const pauseButton = document.getElementById("pauseButton")
const overlay = document.getElementById("overlayText")
const video = document.getElementById("video");
const cameraSelect = document.getElementById("camera-select");
const ctx = canvas.getContext("2d");
const MAX_CLUSTERS = 40;
const MIN_CLUSTER_SIZE = 100; // Minimum pixels per region
const COLOR_THRESHOLD = 40; // Max color distance per channel
const FADE_MS = 800;
let TEMPO_MS = 50;
let currentCluster = -1;
let clusters = [];
let rhythmPattern = [];
let rhythmStep = 0;
let originalImageData;
let currentVideoFrame = null;
let started = false;
let movementTimeMS = 0;
let isTouching = false;
let touchX = 0;
let touchY = 0;
let useCamera = true; // Flip this to true to use live video input

const videoCanvas = document.createElement("canvas");
const videoCtx = videoCanvas.getContext("2d");

let currentStream;

async function getCameraDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter(d => d.kind === 'videoinput');
}

function stopCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }
}

async function startCamera(videoDeviceId = null) {
  stopCamera();

  const constraints = {
    audio: false,
    video: {
      deviceId: videoDeviceId ? { exact: videoDeviceId } : undefined,
      facingMode: 'environment', // fallback
      // width: { ideal: 640 },
      // height: { ideal: 640 },
      // aspectRatio: matchMedia('all and (orientation:landscape)').matches ? 16 / 9 : 9 / 16,
    },
  };

  try {
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = currentStream;
    await video.play();
  } catch (e) {
    console.error("Camera start error:", e);
  }
}

cameraSelect.addEventListener("change", async () => {
  await startCamera(cameraSelect.value);
});

getCameraDevices().then(devices => {
  devices.forEach(({ deviceId, label }) => {
    const option = document.createElement("option");
    option.value = deviceId;
    option.text = label || deviceId;
    cameraSelect.appendChild(option);
  });
});





(async () => {
  if (useCamera) {
     await startCamera();  // Will default to rear cam or best guess
  } else {
    video.src = "video/IMG_6299.mov";
    video.load();
  }
})();


console.log("tempo: ", TEMPO_MS)

function toggleOverlay(){
  if(overlay.style.visibility == "hidden"){
    overlay.style.visibility = "visible";
  } else{
    overlay.style.visibility = "hidden";//"visible" is opposite 
  }
}

function createClusters(){
  toggleOverlay();
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

video.addEventListener('canplay', () => {
  console.log("video loaded");

  // Get available screen size
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;

  const buttonAreaHeight = 100; // Reserve 100px at bottom

  const availableHeight = screenHeight - buttonAreaHeight;

  // Video's native aspect ratio
  const aspect = video.videoWidth / video.videoHeight;

  // Calculate max canvas size within constraints
  let canvasWidth = Math.min(screenWidth, 600);
  let canvasHeight = canvasWidth / aspect;

  if (canvasHeight > availableHeight) {
    canvasHeight = availableHeight;
    canvasWidth = canvasHeight * aspect;
  }

  // Round to integers
  canvas.width = Math.floor(canvasWidth);
  canvas.height = Math.floor(canvasHeight);

  // Center the canvas horizontally if needed
  canvas.style.position = "absolute";
  canvas.style.left = `${(screenWidth - canvas.width) / 2}px`;
  canvas.style.top = `0px`;

  console.log("VIDEO dimensions: ", video.videoWidth, video.videoHeight);
  waveformCanvas.width = canvas.width;
  waveformCanvas.height = canvas.height*0.15

  canvas.style.left = "0px"
  canvas.style.top = "0px"
  waveformCanvas.style.left = "0px"
  waveformCanvas.style.top = String(canvas.height-waveformCanvas.height) + "px"

  startButton.style.left = "0px"
  startButton.style.top = String(canvas.height) + "px"
  startButton.style.width = "100px";
  startButton.style.height = "50px";
  pauseButton.style.left = "110px"
  pauseButton.style.top = String(canvas.height) + "px"
  pauseButton.style.width = "100px";
  pauseButton.style.height = "50px";

  cameraSelect.style.left = "220px"
  cameraSelect.style.top = String(canvas.height) + "px"
  cameraSelect.style.width = "200px";
  cameraSelect.style.height = "50px";


  overlay.style.left = "0px"
  overlay.style.top = "0px"
  overlay.style.width = canvas.width + "px";
  overlay.style.height = canvas.height + "px";

  //createClusters();

  drawVideoFrame(); // start animation loop
});

video.load()

function drawVideoFrame() {
  startClock("drawVideo");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  if(!video.paused)
  {
    currentVideoFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);  
  }
  
  //endClock("drawVideo");
  // for (const cluster of clusters) {
  //   if (cluster.playing && cluster.imageDataOverlay) {
  //     ctx.putImageData(cluster.imageDataOverlay, 0, 0);
  //   }
  // }

  startClock("change data");
  // Step 1: Draw the video frame
ctx.putImageData(currentVideoFrame, 0, 0);

// Step 2: Apply semi-transparent white overlay
ctx.fillStyle = "rgba(0, 0, 0, 0.0)";
ctx.fillRect(0, 0, canvas.width, canvas.height);

// Step 3: Restore true color for cluster pixels
const baseData = currentVideoFrame.data;
const brightFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);
const brightData = brightFrame.data;

const now = Date.now();

for (const cluster of clusters) {
  if (!cluster.playing || !cluster.pixels) continue;

  const elapsed = (now - cluster.startTime) / FADE_MS; // seconds
  const flashAmount = Math.max(0, 1.0 - elapsed); // from 1 → 0 over 1 sec

  for (const [x, y] of cluster.pixels) {
    const idx = (y * canvas.width + x) * 4;


    const r = baseData[idx];
    const g = baseData[idx + 1];
    const b = baseData[idx + 2];

    // Flash to white or red — uncomment the one you prefer:
    
    // Flash to white:
    // brightData[idx]     = r + (255 - r) * flashAmount;
    // brightData[idx + 1] = g + (255 - g) * flashAmount;
    // brightData[idx + 2] = b + (255 - b) * flashAmount;
    // brightData[idx + 3] = 255; // optional

    // Flash to bright red:
    brightData[idx]     = r + (255 - r) * flashAmount;
    brightData[idx + 1] = g * (1.0 - flashAmount); // fade out green
    brightData[idx + 2] = b * (1.0 - flashAmount); // fade out blue
  }
}

// Put the vivid cluster pixels back on top
ctx.putImageData(brightFrame, 0, 0);

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
    //clusters[currentCluster].playing = false;
  }

  const now = Date.now();
  for(let i = 0;i<clusters.length;i++)
  {
    const elapsed = (now - clusters[i].startTime) / FADE_MS; // seconds
    if(elapsed > 1000.0){
      custers[i].playing = false;
    }
  }

  currentCluster = (currentCluster+1)%clusters.length;
  const imageData = currentVideoFrame;
  //originalImageData = imageData;
  const { width, height, data } = imageData;
  let cluster = clusters[currentCluster];
  cluster.data = imageData;

  for (let i = 0; i < cluster.locations.length; i++) {
    let [x, y] = cluster.locations[i];
    console.log("Calculating: ", touchX, touchY, x, y);
    if(isTouching)
    {
      x = Math.floor(x + (touchX-x)*0.7);
      y = Math.floor(y + (touchY-y)*0.7);
    }
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

  if(!started)
  {
    started = true;
    function step() {
      playNextCluster();
      playClusterGrainSound(clusters[currentCluster]);
      rhythmStep = (rhythmStep + 1) % rhythmPattern.length;
      const delay = rhythmPattern[rhythmStep];
      movementTimeMS += delay;

      if(movementTimeMS > 10000 && !video.paused){
        incrementMovement();
        const baseBeat = TEMPO_MS;
        rhythmPattern = generateRhythmPattern(baseBeat);
        rhythmStep = 0;
        movementTimeMS = 0;
      }

      setTimeout(step, delay);
    }
    step(); // initial call
  }
}

function unlockAudio() {
  const audio = new Audio();
  audio.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA="; // 1ms silence
  audio.play().then(() => {
    console.log("Audio unlocked");
  }).catch(err => {
    console.warn("Audio unlock failed", err);
  });
}

startButton.addEventListener("click", function(){
  unlockAudio();
  createClusters();
});
pauseButton.addEventListener("click", function(){
  if(video.paused){
    video.play();
  } else{
    video.pause()  
  }
  
});




function getCanvasCoords(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  let clientX, clientY;

  if (event.touches && event.touches.length > 0) {
    clientX = event.touches[0].clientX;
    clientY = event.touches[0].clientY;
  } else {
    clientX = event.clientX;
    clientY = event.clientY;
  }

  touchX = Math.floor((clientX - rect.left) * (canvas.width / rect.width));
  touchY = Math.floor((clientY - rect.top) * (canvas.height / rect.height));
}

// TOUCH EVENTS
canvas.addEventListener("touchstart", (event) => {
  isTouching = true;
  getCanvasCoords(event, canvas);
});

canvas.addEventListener("touchend", () => {
  isTouching = false;
});

canvas.addEventListener("touchmove", (event) => {
  getCanvasCoords(event, canvas);
  // handle move if needed
}, { passive: false });

// MOUSE EVENTS
canvas.addEventListener("mousedown", (event) => {
  isTouching = true;
  getCanvasCoords(event, canvas);
});

canvas.addEventListener("mouseup", () => {
  isTouching = false;
});

canvas.addEventListener("mousemove", (event) => {
  if (!isTouching) return;
  getCanvasCoords(event, canvas);
  // handle drag if needed
});
