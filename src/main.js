import * as THREE from 'three';
import { Webcam } from 'locar';

// ─── Target GPS coordinates ───────────────────────────────────────────────
const TARGET_LAT = 59.83666054587699;
const TARGET_LON = 13.540475354526265;

// ─── DOM ──────────────────────────────────────────────────────────────────
const loadingScreen = document.getElementById('loading-screen');
const errorMsg      = document.getElementById('error-msg');
const distBadge     = document.getElementById('distance-badge');
const elLat         = document.getElementById('my-lat');
const elLon         = document.getElementById('my-lon');
const elAcc         = document.getElementById('my-acc');
const elBearing     = document.getElementById('box-pos'); // reused for bearing

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.style.display = 'block';
  console.error('[AR]', msg);
}

// ─── Geo helpers ──────────────────────────────────────────────────────────
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

// Bearing FROM user TO target, in degrees clockwise from North
function bearingTo(lat1, lon1, lat2, lon2) {
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const y  = Math.sin(Δλ) * Math.cos(φ2);
  const x  = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// ─── Three.js ─────────────────────────────────────────────────────────────
const scene    = new THREE.Scene();
const camera   = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.autoClear = false;
renderer.shadowMap.enabled = true;
document.getElementById('app').appendChild(renderer.domElement);

// ─── Lighting ─────────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 0.5));

const sun = new THREE.DirectionalLight(0xffffff, 2.0);
sun.position.set(80, 120, 60);
sun.castShadow = true;
scene.add(sun);

// Subtle fill light from below to avoid pure-black undersides
const fill = new THREE.DirectionalLight(0x4466ff, 0.3);
fill.position.set(-40, -60, -40);
scene.add(fill);

// ─── Red cube at scene origin ─────────────────────────────────────────────
// The cube stays at (0,0,0). The camera orbits around it.
const BOX_SIZE = 1;

const box = new THREE.Mesh(
  new THREE.BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE),
  new THREE.MeshPhongMaterial({
    color:     0xff2020,
    emissive:  0x550000,
    shininess: 90,
    specular:  0xff6666,
  })
);
box.castShadow = true;
scene.add(box);

// Wireframe overlay
box.add(new THREE.Mesh(
  new THREE.BoxGeometry(BOX_SIZE * 1.005, BOX_SIZE * 1.005, BOX_SIZE * 1.005),
  new THREE.MeshBasicMaterial({ color: 0xff7777, wireframe: true, transparent: true, opacity: 0.6 })
));

// Ground shadow plane
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(10, 10),
  new THREE.ShadowMaterial({ opacity: 0.25 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -BOX_SIZE / 2;
ground.receiveShadow = true;
scene.add(ground);

// ─── Webcam background ────────────────────────────────────────────────────
const webcam    = new Webcam({ video: { facingMode: 'environment' } });
const camWebcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

webcam.on('webcamstarted', ({ texture }) => {
  webcam.sceneWebcam.add(new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.MeshBasicMaterial({ map: texture, depthTest: false, depthWrite: false })
  ));
  console.log('[AR] Webcam started ✓');
});
webcam.on('webcamerror', (e) => showError(`Camera error: ${e.message ?? e.code}`));

// ─── Camera orbit state ───────────────────────────────────────────────────
// The camera sits on a sphere of radius ORBIT_RADIUS centred on the cube.
// azimuth  = horizontal angle (driven by GPS bearing)
// elevation = vertical angle (driven by device tilt / DeviceOrientation beta)
const ORBIT_RADIUS = BOX_SIZE * 2.8; // close enough to fill ~40% of screen

let azimuth   = 0;   // radians, clockwise from +Z axis
let elevation = 0.3; // radians above the horizon (default: slightly above)

// Smooth targets — we lerp toward these each frame
let targetAzimuth   = azimuth;
let targetElevation = elevation;

function setCameraOrbit() {
  // Spherical → Cartesian
  camera.position.set(
    ORBIT_RADIUS * Math.sin(azimuth)   * Math.cos(elevation),
    ORBIT_RADIUS * Math.sin(elevation),
    ORBIT_RADIUS * Math.cos(azimuth)   * Math.cos(elevation)
  );
  camera.lookAt(0, 0, 0);
}

setCameraOrbit();

// ─── GPS ──────────────────────────────────────────────────────────────────
// We use GPS ONLY for two things:
//   1. Calculate the bearing from user → target → set camera azimuth
//   2. Show the distance in the HUD
// We do NOT use LocationBased because we don't need world-space placement.

let gpsReady = false;

function onGPSPosition(pos) {
  const { latitude, longitude, accuracy } = pos.coords;

  elLat.textContent = latitude.toFixed(5);
  elLon.textContent = longitude.toFixed(5);
  elAcc.textContent = `±${accuracy.toFixed(0)} m`;

  const dist  = haversine(latitude, longitude, TARGET_LAT, TARGET_LON);
  const brng  = bearingTo(latitude, longitude, TARGET_LAT, TARGET_LON);

  distBadge.textContent = dist < 5000
    ? `📦 Red box is ${dist.toFixed(0)} m away`
    : `📦 Red box is ${(dist / 1000).toFixed(1)} km away`;

  if (elBearing) elBearing.textContent = `${brng.toFixed(0)}°`;

  // Convert bearing (CW from North) → Three.js azimuth
  // Camera sits on the OPPOSITE side so it looks FROM the user TOWARD the box
  // bearing 0° (N) → user is north of box → camera at +Z (south) → azimuth = π
  // bearing 90° (E) → user is east → camera at +X → azimuth = π/2
  targetAzimuth = (brng * Math.PI / 180) + Math.PI;

  if (!gpsReady) {
    gpsReady = true;
    azimuth  = targetAzimuth; // snap on first fix, then lerp after
    loadingScreen.classList.add('hidden');
    console.log(`[AR] GPS ready. Bearing to target: ${brng.toFixed(1)}°`);
  }
}

function onGPSError(err) {
  showError(`GPS error (${err.code}): ${err.message}`);
  loadingScreen.classList.add('hidden');
}

if (navigator.geolocation) {
  navigator.geolocation.watchPosition(onGPSPosition, onGPSError, {
    enableHighAccuracy: true,
    maximumAge: 3000,
    timeout: 15000,
  });
} else {
  showError('Geolocation not supported by this browser.');
}

// ─── Device Orientation → elevation ──────────────────────────────────────
// We only use `beta` (front-to-back tilt, 0° = flat, 90° = upright) to set
// the camera elevation. This gives the "look up / look down" effect when you
// tilt your phone, without needing the full orientation quaternion.
//
// Portrait phone held upright: beta ≈ 90°
// Phone tilted back 30°: beta ≈ 60°  → we want elevation ≈ +30° above horizon
// Phone tilted forward:   beta > 90° → elevation goes negative (look down at cube)

let lastBeta = null;

function onDeviceOrientation(e) {
  if (e.beta === null) return;

  // beta in [−180, 180], but practically [0, 180] when held upright in portrait
  // Map so that:
  //   beta = 90  → elevation = 0   (horizontal, looking straight at cube)
  //   beta = 60  → elevation = 30° (tilted back, looking slightly up)
  //   beta = 120 → elevation = -30° (tilted forward, looking slightly down)
  const beta = e.beta;
  const raw  = (90 - beta) * Math.PI / 180; // radians
  targetElevation = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, raw));
  lastBeta = beta;
}

// Request iOS 13+ permission
function setupOrientation() {
  if (
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof DeviceOrientationEvent.requestPermission === 'function'
  ) {
    // Need a user gesture — show a tap overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:200;display:flex;flex-direction:column;
      align-items:center;justify-content:center;background:rgba(0,0,0,0.75);
      color:#fff;font-family:'Courier New',monospace;gap:16px;cursor:pointer;
    `;
    overlay.innerHTML = `
      <div style="color:#ff3c3c;font-size:18px;letter-spacing:.2em;text-transform:uppercase">Tap to Enable Tilt</div>
      <div style="font-size:12px;color:rgba(255,255,255,.5)">Required for iOS orientation access</div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', () => {
      DeviceOrientationEvent.requestPermission()
        .then(state => {
          if (state === 'granted') window.addEventListener('deviceorientation', onDeviceOrientation);
          overlay.remove();
        })
        .catch(() => overlay.remove());
    });
  } else {
    window.addEventListener('deviceorientation', onDeviceOrientation);
  }
}
setupOrientation();

// ─── Resize ───────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Render loop ──────────────────────────────────────────────────────────
const LERP = 0.06; // smoothing factor — lower = smoother but slower to react

function animate() {
  requestAnimationFrame(animate);

  // Smooth azimuth (handle wrap-around at ±π)
  let da = targetAzimuth - azimuth;
  // Keep delta in [-π, π] so we always take the shorter arc
  while (da >  Math.PI) da -= 2 * Math.PI;
  while (da < -Math.PI) da += 2 * Math.PI;
  azimuth   += da * LERP;

  // Smooth elevation
  elevation += (targetElevation - elevation) * LERP;

  setCameraOrbit();

  // Webcam background
  renderer.clear();
  renderer.render(webcam.sceneWebcam, camWebcam);

  // 3-D scene
  renderer.clearDepth();
  renderer.render(scene, camera);
}

animate();
