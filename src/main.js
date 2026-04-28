import * as THREE from 'three';
import { LocationBased, DeviceOrientationControls, Webcam } from 'locar';

// ─── Target coordinates ───────────────────────────────────────────────────
const TARGET_LAT = 59.83666135300356;
const TARGET_LON = 13.540471225509355;

// ─── DOM ──────────────────────────────────────────────────────────────────
const loadingScreen = document.getElementById('loading-screen');
const errorMsg      = document.getElementById('error-msg');
const distBadge     = document.getElementById('distance-badge');
const elLat         = document.getElementById('my-lat');
const elLon         = document.getElementById('my-lon');
const elAcc         = document.getElementById('my-acc');
const elBoxPos      = document.getElementById('box-pos');

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
// 20 m cube — large enough to spot from hundreds of metres away
const BOX_SIZE = 20;
const box = new THREE.Mesh(
  new THREE.BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE),
  new THREE.MeshPhongMaterial({ color: 0xff2020, emissive: 0x660000, shininess: 80 })
);

const wireBox = new THREE.Mesh(
  new THREE.BoxGeometry(BOX_SIZE + 0.1, BOX_SIZE + 0.1, BOX_SIZE + 0.1),
  new THREE.MeshBasicMaterial({ color: 0xff8888, wireframe: true })
);
box.add(wireBox);

// ─── locar: Webcam ────────────────────────────────────────────────────────
const webcam    = new Webcam({ video: { facingMode: 'environment' } });
const camWebcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

webcam.on('webcamstarted', ({ texture }) => {
  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.MeshBasicMaterial({ map: texture, depthTest: false, depthWrite: false })
  );
  webcam.sceneWebcam.add(quad);
});

webcam.on('webcamerror', (e) => showError(`Camera error: ${e.message ?? e.code}`));

// ─── locar: LocationBased ─────────────────────────────────────────────────
const locationBased = new LocationBased(scene, camera, {
  gpsMinDistance: 0,
  gpsMinAccuracy: 10000,
});

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

  // add() requires the world origin to already be set — only safe inside gpsupdate
  if (!boxAdded) {
    boxAdded = true;
    locationBased.add(box, TARGET_LON, TARGET_LAT, BOX_SIZE / 2);
    const p = box.position;
    if (elBoxPos) elBoxPos.textContent = `${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}`;
    console.log('[AR] box world pos:', p);
  }

  loadingScreen.classList.add('hidden');
});

locationBased.on('gpserror', (err) => {
  showError(`GPS error (${err.code}): ${err.message}`);
  loadingScreen.classList.add('hidden');
});

locationBased.startGps();

// ─── Device Orientation ───────────────────────────────────────────────────
// FIX: Simply creating DeviceOrientationControls does NOT start listening.
// You must call init() (which handles iOS permission dialogs) and then call
// connect() once 'deviceorientationgranted' fires. Only then does update()
// have any data to work with.
const orientationControls = new DeviceOrientationControls(camera, {
  enablePermissionDialog: true,  // locar shows its own iOS tap-to-allow dialog
  smoothingFactor: 0.5,
});

orientationControls.on('deviceorientationgranted', () => {
  orientationControls.connect();
  console.log('[AR] DeviceOrientation connected ✓');
});

orientationControls.on('deviceorientationerror', (e) => {
  console.warn('[AR] DeviceOrientation unavailable:', e.message);
  // Not fatal — scene still renders, user just can't pan by rotating the phone
});

// Start the permission flow (instant on Android/desktop, shows dialog on iOS)
orientationControls.init();

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

  // Pass 1: webcam background (no depth test / no depth write)
  renderer.clear();
  renderer.render(webcam.sceneWebcam, camWebcam);

  // Pass 2: AR scene on top
  renderer.clearDepth();
  renderer.render(scene, camera);
}

animate();
