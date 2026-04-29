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
const elBoxPos      = document.getElementById('box-pos');
const compass       = document.getElementById('compass-arrow');
const compassDot    = document.getElementById('compass-dot');

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.style.display = 'block';
  console.error('[AR]', msg);
}

// ─── Bearing + Haversine ──────────────────────────────────────────────────
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

// Returns degrees clockwise from North to the target
function bearing(lat1, lon1, lat2, lon2) {
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const y  = Math.sin(Δλ) * Math.cos(φ2);
  const x  = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// ─── Three.js Setup ───────────────────────────────────────────────────────
const scene    = new THREE.Scene();
const camera   = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.1, 500000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.autoClear = false;
document.getElementById('app').appendChild(renderer.domElement);

// ─── Lighting ─────────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(5, 10, 5);
scene.add(sun);

// ─── Red box ──────────────────────────────────────────────────────────────
const BOX_SIZE = 20;
const box = new THREE.Mesh(
  new THREE.BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE),
  new THREE.MeshPhongMaterial({ color: 0xff2020, emissive: 0x660000, shininess: 80 })
);
box.add(new THREE.Mesh(
  new THREE.BoxGeometry(BOX_SIZE + 0.1, BOX_SIZE + 0.1, BOX_SIZE + 0.1),
  new THREE.MeshBasicMaterial({ color: 0xff8888, wireframe: true })
));

// ─── locar: Webcam ────────────────────────────────────────────────────────
const webcam    = new Webcam({ video: { facingMode: 'environment' } });
const camWebcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

webcam.on('webcamstarted', ({ texture }) => {
  webcam.sceneWebcam.add(new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.MeshBasicMaterial({ map: texture, depthTest: false, depthWrite: false })
  ));
});
webcam.on('webcamerror', (e) => showError(`Camera error: ${e.message ?? e.code}`));

// ─── locar: LocationBased ─────────────────────────────────────────────────
// KEY FIX: gpsMinDistance: 3 means the camera only repositions in world space
// when the user physically walks > 3 metres. Without this (gpsMinDistance: 0),
// every GPS poll — including ±10–30 m noise while standing still — teleports
// the camera, so the box jumps in and out of the frustum every few seconds.
const locationBased = new LocationBased(scene, camera, {
  gpsMinDistance: 3,      // ← prevents GPS jitter from moving the camera
  gpsMinAccuracy: 10000,
});

let boxAdded        = false;
let userLat         = null;
let userLon         = null;

locationBased.on('gpsupdate', (pos) => {
  const { latitude, longitude, accuracy } = pos.position.coords;
  userLat = latitude;
  userLon = longitude;

  elLat.textContent = latitude.toFixed(5);
  elLon.textContent = longitude.toFixed(5);
  elAcc.textContent = `±${accuracy.toFixed(0)} m`;

  const dist = haversine(latitude, longitude, TARGET_LAT, TARGET_LON);
  distBadge.textContent =
    dist < 5000
      ? `📦 Red box is ${dist.toFixed(0)} m away`
      : `📦 Red box is ${(dist / 1000).toFixed(1)} km away`;

  if (!boxAdded) {
    boxAdded = true;
    // Place the box floor-level (y=0); BOX_SIZE/2 lifts it so the base sits at y=0
    locationBased.add(box, TARGET_LON, TARGET_LAT, BOX_SIZE / 2);
    const p = box.position;
    if (elBoxPos) elBoxPos.textContent = `${p.x.toFixed(0)}, ${p.y.toFixed(0)}, ${p.z.toFixed(0)} m`;
    console.log('[AR] box world pos:', p.x.toFixed(1), p.y.toFixed(1), p.z.toFixed(1));
  }

  loadingScreen.classList.add('hidden');
});

locationBased.on('gpserror', (err) => {
  showError(`GPS error (${err.code}): ${err.message}`);
  loadingScreen.classList.add('hidden');
});

locationBased.startGps();

// ─── Device Orientation ───────────────────────────────────────────────────
const orientationControls = new DeviceOrientationControls(camera, {
  enablePermissionDialog: true,
  smoothingFactor: 0.5,
});

orientationControls.on('deviceorientationgranted', () => {
  orientationControls.connect();
  console.log('[AR] DeviceOrientation connected ✓');
});
orientationControls.on('deviceorientationerror', (e) => {
  console.warn('[AR] DeviceOrientation:', e.message);
});

orientationControls.init();

// ─── Compass Arrow (always points toward the box) ─────────────────────────
// Uses the box's 3-D world position projected into screen space.
// If the box is off-screen we show the arrow at the screen edge; if it's
// on-screen we move it right on top of the box and hide the outer ring.
const _ndcVec = new THREE.Vector3();

function updateCompass() {
  if (!boxAdded || !compass) return;

  // Project box centre into normalised device coordinates (-1…1)
  _ndcVec.copy(box.position);
  _ndcVec.project(camera);

  const onScreen = Math.abs(_ndcVec.x) <= 1 && Math.abs(_ndcVec.y) <= 1 && _ndcVec.z < 1;

  const W = window.innerWidth;
  const H = window.innerHeight;
  const MARGIN = 48;

  let sx, sy;

  if (onScreen) {
    // Convert NDC → CSS pixels
    sx = ( _ndcVec.x * 0.5 + 0.5) * W;
    sy = (-_ndcVec.y * 0.5 + 0.5) * H;
    compass.style.opacity = '0.4';
    if (compassDot) compassDot.style.display = 'block';
  } else {
    // Clamp to screen edge
    sx = Math.max(MARGIN, Math.min(W - MARGIN,  (_ndcVec.x * 0.5 + 0.5) * W));
    sy = Math.max(MARGIN, Math.min(H - MARGIN, (-_ndcVec.y * 0.5 + 0.5) * H));
    compass.style.opacity = '1';
    if (compassDot) compassDot.style.display = 'none';
  }

  // Angle of the arrow: from screen centre → clamped projection point
  const cx = W / 2, cy = H / 2;
  const angle = Math.atan2(sy - cy, sx - cx) * 180 / Math.PI + 90;

  compass.style.left      = `${sx}px`;
  compass.style.top       = `${sy}px`;
  compass.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
  compass.style.display   = 'flex';
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

  rotY += 0.006;
  box.rotation.y = rotY;

  orientationControls.update();
  updateCompass();

  renderer.clear();
  renderer.render(webcam.sceneWebcam, camWebcam);
  renderer.clearDepth();
  renderer.render(scene, camera);
}

animate();
