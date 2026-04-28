import * as THREE from 'three';
import { LocationBased, DeviceOrientationControls, Webcam } from 'locar';

// ─── Target coordinates ───────────────────────────────────────────────────
const TARGET_LAT = 59.836704661579994;
const TARGET_LON = 13.540565734604412;

// ─── DOM ──────────────────────────────────────────────────────────────────
const loadingScreen = document.getElementById('loading-screen');
const errorMsg      = document.getElementById('error-msg');
const distBadge     = document.getElementById('distance-badge');
const elLat         = document.getElementById('my-lat');
const elLon         = document.getElementById('my-lon');
const elAcc         = document.getElementById('my-acc');

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.style.display = 'block';
  console.error('[AR]', msg);
}

// ─── Haversine distance (metres) ──────────────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
  const R    = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ─── Three.js Setup ───────────────────────────────────────────────────────
const scene    = new THREE.Scene();
const camera   = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.autoClear = false;          // needed for webcam + scene layering
document.getElementById('app').appendChild(renderer.domElement);

// ─── Lighting ─────────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(5, 10, 5);
scene.add(sun);

// ─── Red box ──────────────────────────────────────────────────────────────
const box = new THREE.Mesh(
  new THREE.BoxGeometry(4, 4, 4),
  new THREE.MeshPhongMaterial({ color: 0xff2020, emissive: 0x550000, shininess: 80 })
);

// Wireframe overlay for a techy look
const wireMat  = new THREE.MeshBasicMaterial({ color: 0xff6666, wireframe: true });
const wireBox  = new THREE.Mesh(new THREE.BoxGeometry(4.05, 4.05, 4.05), wireMat);
box.add(wireBox);

// ─── locar: Webcam ────────────────────────────────────────────────────────
const webcam = new Webcam({ video: { facingMode: 'environment' } });

// Ortho camera to render the webcam background
const camWebcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

webcam.on('webcamstarted', ({ texture }) => {
  // Fullscreen quad with the webcam feed
  const bgGeo  = new THREE.PlaneGeometry(2, 2);
  const bgMat  = new THREE.MeshBasicMaterial({ map: texture, depthTest: false, depthWrite: false });
  const bgMesh = new THREE.Mesh(bgGeo, bgMat);
  webcam.sceneWebcam.add(bgMesh);
});

webcam.on('webcamerror', (e) => {
  showError(`Camera error: ${e.message ?? e.code}`);
});

// ─── locar: LocationBased ─────────────────────────────────────────────────
// gpsMinAccuracy raised to 10000 so cold-start / low-accuracy readings are
// still accepted — otherwise the world origin never gets set and add() throws.
const locationBased = new LocationBased(scene, camera, {
  gpsMinDistance: 0,
  gpsMinAccuracy: 10000,
});

// ⚠️  IMPORTANT: locationBased.add() must only be called AFTER the first GPS
// fix is received, because internally it calls lonLatToWorldCoords() which
// requires the world origin to be set. We use a flag to add the box once.
let boxAdded = false;

locationBased.on('gpsupdate', (pos) => {
  const { latitude, longitude, accuracy } = pos.position.coords;

  elLat.textContent = latitude.toFixed(5);
  elLon.textContent = longitude.toFixed(5);
  elAcc.textContent = `±${accuracy.toFixed(0)} m`;

  const dist = haversine(latitude, longitude, TARGET_LAT, TARGET_LON);
  distBadge.textContent =
    dist < 5000
      ? `📦 Red box is ${dist.toFixed(0)} m away`
      : `📦 Red box is ${(dist / 1000).toFixed(1)} km away`;

  // Add the box only once, after the world origin is established
  if (!boxAdded) {
    boxAdded = true;
    locationBased.add(box, TARGET_LON, TARGET_LAT, 1.5);
  }

  // Dismiss loading screen on first GPS fix
  loadingScreen.classList.add('hidden');
});

locationBased.on('gpserror', (err) => {
  showError(`GPS error (${err.code}): ${err.message}`);
  loadingScreen.classList.add('hidden');
});

// Start GPS
locationBased.startGps();

// ─── Device Orientation ───────────────────────────────────────────────────
const orientationControls = new DeviceOrientationControls(camera);

// iOS 13+ requires user-gesture permission for DeviceOrientationEvent
if (typeof DeviceOrientationEvent !== 'undefined' &&
    typeof DeviceOrientationEvent.requestPermission === 'function') {
  // Create a tap-to-start overlay for iOS
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:200;display:flex;flex-direction:column;
    align-items:center;justify-content:center;background:rgba(0,0,0,0.7);
    color:#fff;font-family:'Courier New',monospace;gap:16px;cursor:pointer;
  `;
  overlay.innerHTML = `
    <div style="color:#ff3c3c;font-size:18px;letter-spacing:.2em;text-transform:uppercase">Tap to Start</div>
    <div style="font-size:12px;color:rgba(255,255,255,.5)">Required for iOS orientation access</div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', () => {
    DeviceOrientationEvent.requestPermission().then(state => {
      if (state === 'granted') {
        orientationControls.connect?.();
      }
      overlay.remove();
    }).catch(() => overlay.remove());
  });
}

// ─── Resize ───────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Render Loop ──────────────────────────────────────────────────────────
let rotY = 0;

function animate() {
  requestAnimationFrame(animate);

  // Gentle spin on the box
  rotY += 0.008;
  box.rotation.y = rotY;

  // Update orientation
  orientationControls.update();

  // 1. Render webcam background (no depth)
  renderer.clear();
  renderer.render(webcam.sceneWebcam, camWebcam);

  // 2. Render the AR scene on top
  renderer.clearDepth();
  renderer.render(scene, camera);
}

animate();
