import * as THREE from 'three';
import { Webcam } from 'locar';

// ─── Config ───────────────────────────────────────────────────────────────
const TARGET_LAT  = 59.83666054587699;
const TARGET_LON  = 13.540475354526265;
const CAM_HEIGHT  = 1.6;   // eye height in metres above ground
const BOX_SIZE    = 2.0;   // cube side length in metres (real-world scale)

// ─── DOM ──────────────────────────────────────────────────────────────────
const loadingScreen = document.getElementById('loading-screen');
const loadingStatus = document.getElementById('loading-status');
const errorMsg      = document.getElementById('error-msg');
const distBadge     = document.getElementById('distance-badge');
const elLat         = document.getElementById('my-lat');
const elLon         = document.getElementById('my-lon');
const elAcc         = document.getElementById('my-acc');
const elDist        = document.getElementById('my-dist');

function setStatus(msg)  { if (loadingStatus) loadingStatus.textContent = msg; }
function showError(msg)  {
  if (errorMsg) { errorMsg.textContent = msg; errorMsg.style.display = 'block'; }
  console.error('[AR]', msg);
}

// ─── Flat-earth GPS → metres ──────────────────────────────────────────────
// Good to ~1 km accuracy — more than enough for walking AR.
// Returns {x, z} where +X = East, +Z = South (Three.js default).
function gpsToMetres(lat, lon, originLat, originLon) {
  const R      = 6371000;
  const cosLat = Math.cos(originLat * Math.PI / 180);
  return {
    x:  (lon - originLon) * (Math.PI / 180) * R * cosLat,
    z: -(lat - originLat) * (Math.PI / 180) * R,   // lat↑ = -Z in Three.js
  };
}

function haversine(lat1, lon1, lat2, lon2) {
  const R    = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a    = Math.sin(dLat/2)**2 +
    Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ─── Three.js ─────────────────────────────────────────────────────────────
const scene    = new THREE.Scene();
const camera   = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.01, 100000);
camera.position.y = CAM_HEIGHT;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.autoClear = false;
renderer.shadowMap.enabled = true;
document.getElementById('app').appendChild(renderer.domElement);

// ─── Lighting ─────────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 0.55));

const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(50, 100, 80);
sun.castShadow = true;
scene.add(sun);

// Soft fill from below so undersides aren't pure black
scene.add(Object.assign(new THREE.HemisphereLight(0x88aaff, 0x553300, 0.4), {}));

// ─── Red cube ─────────────────────────────────────────────────────────────
// Six faces painted different shades of red so you can clearly see which face
// you're looking at as you walk around — makes the "orbit effect" obvious.
const faceMaterials = [
  new THREE.MeshPhongMaterial({ color: 0xff1111, emissive: 0x550000 }), // +X right
  new THREE.MeshPhongMaterial({ color: 0xcc0000, emissive: 0x440000 }), // -X left
  new THREE.MeshPhongMaterial({ color: 0xff4444, emissive: 0x550000 }), // +Y top
  new THREE.MeshPhongMaterial({ color: 0x990000, emissive: 0x330000 }), // -Y bottom
  new THREE.MeshPhongMaterial({ color: 0xff2222, emissive: 0x550000 }), // +Z front
  new THREE.MeshPhongMaterial({ color: 0xbb1111, emissive: 0x440000 }), // -Z back
];

const cube = new THREE.Mesh(new THREE.BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE), faceMaterials);
cube.castShadow    = true;
cube.receiveShadow = false;
cube.position.y    = BOX_SIZE / 2;  // base sits on y=0 ground plane

// Thin white edge lines so the cube reads clearly against any background
const edges = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE)),
  new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 })
);
edges.position.y = BOX_SIZE / 2;
// Both added to scene after first GPS fix positions them

// Ground shadow catcher (invisible plane)
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(2000, 2000),
  new THREE.ShadowMaterial({ opacity: 0.18 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// ─── Webcam background ────────────────────────────────────────────────────
const webcam  = new Webcam({ video: { facingMode: 'environment' } });
const bgCam   = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

webcam.on('webcamstarted', ({ texture }) => {
  webcam.sceneWebcam.add(new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.MeshBasicMaterial({ map: texture, depthTest: false, depthWrite: false })
  ));
  console.log('[AR] Webcam started ✓');
});
webcam.on('webcamerror', (e) => showError(`Camera error: ${e.message ?? e.code}`));

// ─── GPS World Anchoring ───────────────────────────────────────────────────
// Strategy:
//   • First GPS fix → record as world origin (camera at 0,0).
//   • Convert TARGET lat/lon → world metres → place cube there. Never moves again.
//   • Every subsequent GPS update → convert user position → smooth camera XZ.
//
// gpsMinDistance is NOT used here — we do our own low-pass smoothing in the
// render loop so the camera glides rather than snaps, hiding GPS noise.

let originLat  = null, originLon = null;
let camTargetX = 0,    camTargetZ = 0;   // smoothed GPS target for camera
let gpsReady   = false;

function onGPSPosition(pos) {
  const { latitude: lat, longitude: lon, accuracy } = pos.coords;

  if (!gpsReady) {
    // ── First fix: establish world origin at user's current position ──────
    originLat = lat;
    originLon = lon;

    // Place cube at target GPS, expressed in metres from user's start point
    const t = gpsToMetres(TARGET_LAT, TARGET_LON, originLat, originLon);
    cube.position.x  = t.x;
    cube.position.z  = t.z;
    edges.position.x = t.x;
    edges.position.z = t.z;
    scene.add(cube);
    scene.add(edges);

    // Camera starts exactly at world origin (user's first position)
    camera.position.x = 0;
    camera.position.z = 0;
    camTargetX = 0;
    camTargetZ = 0;

    gpsReady = true;
    loadingScreen.classList.add('hidden');

    console.log(`[AR] World origin set. Cube at: x=${t.x.toFixed(1)} z=${t.z.toFixed(1)}`);
  } else {
    // ── Subsequent fixes: move camera XZ target ───────────────────────────
    const u = gpsToMetres(lat, lon, originLat, originLon);
    camTargetX = u.x;
    camTargetZ = u.z;
  }

  // HUD
  const dist = haversine(lat, lon, TARGET_LAT, TARGET_LON);
  if (elLat)  elLat.textContent  = lat.toFixed(5);
  if (elLon)  elLon.textContent  = lon.toFixed(5);
  if (elAcc)  elAcc.textContent  = `±${accuracy.toFixed(0)} m`;
  if (elDist) elDist.textContent = dist < 1000 ? `${dist.toFixed(0)} m` : `${(dist/1000).toFixed(2)} km`;

  if (distBadge) {
    distBadge.textContent = dist < 5000
      ? `📦 ${dist.toFixed(0)} m to the red cube`
      : `📦 ${(dist/1000).toFixed(1)} km to the red cube`;
  }
}

function onGPSError(err) {
  showError(`GPS error: ${err.message}`);
  loadingScreen.classList.add('hidden');
}

if (!navigator.geolocation) {
  showError('Geolocation not supported by this browser.');
} else {
  setStatus('Waiting for GPS fix…');
  navigator.geolocation.watchPosition(onGPSPosition, onGPSError, {
    enableHighAccuracy: true,
    maximumAge:         2000,
    timeout:            20000,
  });
}

// ─── Device Orientation → Camera Quaternion ───────────────────────────────
// Classic Three.js DeviceOrientationControls math (works on iOS + Android).
// Uses compass-accurate alpha where available:
//   • Android Chrome: `deviceorientationabsolute` has absolute alpha (compass)
//   • iOS Safari:     `webkitCompassHeading` on the regular event
//   • Fallback:       raw alpha (relative to initial orientation — still gives
//                     the correct tilt feel; just won't align to compass North)

const _euler = new THREE.Euler();
const _q1    = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // -90° X
const _qScr  = new THREE.Quaternion();
const _zee   = new THREE.Vector3(0, 0, 1);

// Track which source is providing absolute orientation so we don't double-apply
let hasAbsoluteOrientation = false;

function applyOrientation(alpha, beta, gamma) {
  if (alpha === null || beta === null || gamma === null) return;

  // Convert to radians
  const aRad = THREE.MathUtils.degToRad(alpha);
  const bRad = THREE.MathUtils.degToRad(beta);
  const gRad = THREE.MathUtils.degToRad(gamma);
  const screenOrient = THREE.MathUtils.degToRad(window.orientation || 0);

  _euler.set(bRad, aRad, -gRad, 'YXZ');
  camera.quaternion.setFromEuler(_euler);
  camera.quaternion.multiply(_q1);
  _qScr.setFromAxisAngle(_zee, -screenOrient);
  camera.quaternion.multiply(_qScr);
}

// Android: absolute (compass-calibrated)
window.addEventListener('deviceorientationabsolute', (e) => {
  hasAbsoluteOrientation = true;
  applyOrientation(e.alpha, e.beta, e.gamma);
}, true);

// iOS + Android fallback
window.addEventListener('deviceorientation', (e) => {
  if (hasAbsoluteOrientation) return; // already handled above

  let alpha = e.alpha;

  // iOS: use compass heading for true-North alpha
  if (e.webkitCompassHeading != null) {
    alpha = 360 - e.webkitCompassHeading;
  }

  applyOrientation(alpha, e.beta, e.gamma);
});

// ─── iOS 13+ permission prompt ────────────────────────────────────────────
function requestOrientationPermission() {
  if (
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof DeviceOrientationEvent.requestPermission === 'function'
  ) {
    const btn = document.createElement('div');
    btn.style.cssText = `
      position:fixed;inset:0;z-index:300;
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      background:rgba(0,0,0,0.82);gap:18px;cursor:pointer;
      font-family:'Courier New',monospace;color:#fff;
    `;
    btn.innerHTML = `
      <div style="color:#ff3c3c;font-size:20px;letter-spacing:.15em;text-transform:uppercase">Tap to Start</div>
      <div style="font-size:12px;color:rgba(255,255,255,.45);text-align:center;max-width:260px">
        Allows the camera to follow your phone orientation
      </div>
    `;
    document.body.appendChild(btn);
    btn.addEventListener('click', () => {
      DeviceOrientationEvent.requestPermission()
        .then(s => { console.log('[AR] Orientation permission:', s); })
        .catch(console.warn)
        .finally(() => btn.remove());
    });
  }
}
requestOrientationPermission();

// ─── Resize ───────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ─── Render loop ──────────────────────────────────────────────────────────
// Camera XZ position is lerped toward the GPS target each frame.
// This hides GPS jitter (noise bursts) and gives smooth walking movement.
// A factor of 0.05 means it reaches ~95% of a new position in ~60 frames (1 s at 60 fps).
const POS_LERP = 0.05;

function animate() {
  requestAnimationFrame(animate);

  if (gpsReady) {
    camera.position.x += (camTargetX - camera.position.x) * POS_LERP;
    camera.position.z += (camTargetZ - camera.position.z) * POS_LERP;
  }

  // Webcam background (no depth)
  renderer.clear();
  renderer.render(webcam.sceneWebcam, bgCam);

  // AR scene on top
  renderer.clearDepth();
  renderer.render(scene, camera);
}

animate();
