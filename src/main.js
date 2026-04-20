import "./style.css";
import javascriptLogo from "./assets/javascript.svg";
import viteLogo from "./assets/vite.svg";
import heroImg from "./assets/hero.png";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as LocAR from "locar";
import HOUSE_MODEL_PATH from "./assets/House.glb";

// ============================================================
//  CONFIGURATION — edit these values before deploying
// ============================================================


const HOUSE_GPS = {
  latitude: 59.8366911802191, // <-- target GPS latitude
  longitude: 13.540368226155081, // <-- target GPS longitude
};

const HOUSE_SCALE = 10; // scale of the model (metres, roughly)
const HOUSE_ALTITUDE = 0; // y-offset in metres (0 = ground level)

// Minimum metres the user must move before GPS position is refreshed.
// Reduces "jumping" caused by sensor noise.
const GPS_MIN_DISTANCE = 3;

// ============================================================
//  SCENE SETUP
// ============================================================

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  10000,
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

// ============================================================
//  LIGHTING
// ============================================================

// Ambient light so the model isn't pitch-black on its dark side
const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambientLight);

// Directional light simulating sunlight
const sunLight = new THREE.DirectionalLight(0xfff4e0, 2.0);
sunLight.position.set(50, 100, 50);
sunLight.castShadow = true;
scene.add(sunLight);

// ============================================================
//  LOCAR — webcam background + GPS tracking
// ============================================================


const locar = new LocAR.LocationBased(scene, camera);

const cam = new LocAR.Webcam({
  video: {
    facingMode: "environment",
  },
});

cam.on("webcamstarted", (ev) => {
  scene.background = ev.texture;
});

cam.on("webcamerror", (error) => {
  alert(`Webcam error: code ${error.code} message ${error.message}`);
});

// Create the device orientation tracker
const deviceOrientationControls = new LocAR.DeviceOrientationControls(camera);

deviceOrientationControls.on("deviceorientationgranted", ev => {
    ev.target.connect();
});

deviceOrientationControls.on("deviceorientationerror", error => {
    alert(`Device orientation error: code ${error.code} message ${error.message}`);
});

deviceOrientationControls.init();

// ============================================================
//  LOAD 3D HOUSE MODEL
// ============================================================

let houseObject = null;

const loader = new GLTFLoader();

loader.load(
  HOUSE_MODEL_PATH,

  // onLoad
  (gltf) => {
    houseObject = gltf.scene;

    // Uniform scale
    houseObject.scale.setScalar(HOUSE_SCALE);

    // Lift model off ground if needed
    houseObject.position.y = HOUSE_ALTITUDE;

    // Enable shadows on every mesh inside the model
    houseObject.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });

    // Pin the model to the target GPS coordinates
    locar.add(houseObject, HOUSE_GPS.longitude, HOUSE_GPS.latitude);

    console.log("[LocAR] House model placed at", HOUSE_GPS);
    hideLoadingOverlay();
  },

  // onProgress
  (xhr) => {
    const pct = Math.round((xhr.loaded / xhr.total) * 100);
    updateLoadingProgress(pct);
    console.log(`[LocAR] Model loading: ${pct}%`);
  },

  // onError
  (error) => {
    console.error("[LocAR] Failed to load model:", error);
    showError(
      "Could not load the house model. Check that house.glb is in /public.",
    );
  },
);

// ============================================================
//  GPS — start tracking the user's position
// ============================================================

locar.startGps();



// ============================================================
//  RENDER LOOP
// ============================================================

renderer.setAnimationLoop(animate);

function animate() {
    // Update the scene using the latest sensor readings
    deviceOrientationControls.update();
    renderer.render(scene, camera);
}

// ============================================================
//  RESIZE HANDLING
// ============================================================

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ============================================================
//  UI HELPERS
// ============================================================

function hideLoadingOverlay() {
  const overlay = document.getElementById("loading-overlay");
  if (overlay) {
    overlay.style.opacity = "0";
    setTimeout(() => overlay.remove(), 600);
  }
}

function updateLoadingProgress(pct) {
  const bar = document.getElementById("loading-bar-fill");
  if (bar) bar.style.width = pct + "%";

  const label = document.getElementById("loading-label");
  if (label) label.textContent = `Loading model… ${pct}%`;
}

function updateDebugInfo(lat, lon) {
  const el = document.getElementById("debug-gps");
  if (el) el.textContent = `GPS  ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

function showError(msg) {
  const el = document.getElementById("error-banner");
  if (el) {
    el.textContent = msg;
    el.style.display = "block";
  }
}


