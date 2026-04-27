import "./style.css";
import javascriptLogo from "./assets/javascript.svg";
import viteLogo from "./assets/vite.svg";
import heroImg from "./assets/hero.png";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as LocAR from "locar";

// Replace with your target GPS coordinates
const TARGET_LAT = 59.836704661579994;
const TARGET_LON = 13.540565734604412;

////////////////////////////////////////////////////////////////////////////////
// THREE.JS SETUP
////////////////////////////////////////////////////////////////////////////////

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
});

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.style.margin = "0";
document.body.appendChild(renderer.domElement);

////////////////////////////////////////////////////////////////////////////////
// LIGHTING
////////////////////////////////////////////////////////////////////////////////

const ambientLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambientLight);

////////////////////////////////////////////////////////////////////////////////
// CREATE CUBE
////////////////////////////////////////////////////////////////////////////////

const geometry = new THREE.BoxGeometry(2, 2, 2);

const material = new THREE.MeshStandardMaterial({
  color: 0x00ff00,
});

const cube = new THREE.Mesh(geometry, material);

////////////////////////////////////////////////////////////////////////////////
// LOCAR.JS SETUP
////////////////////////////////////////////////////////////////////////////////

async function initAR() {
  // Request camera permission
  await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false,
  });

  // iPhone orientation permission
  if (
    typeof DeviceOrientationEvent !== "undefined" &&
    typeof DeviceOrientationEvent.requestPermission === "function"
  ) {
    const permission = await DeviceOrientationEvent.requestPermission();

    if (permission !== "granted") {
      alert("Orientation permission denied");
      return;
    }
  }

  // Create LocAR instance
  const locar = new LocAR.LocationBased(scene, camera);

  // GPS tracking
  const gps = new LocAR.WebcamRenderer(renderer);

  // Start GPS
  locar.startGps();

  // Add cube at GPS coordinates
  locar.add(cube, TARGET_LON, TARGET_LAT);

  // Move cube slightly upward
  cube.position.y = 1;

  animate();
}

////////////////////////////////////////////////////////////////////////////////
// ANIMATION LOOP
////////////////////////////////////////////////////////////////////////////////

function animate() {
  requestAnimationFrame(animate);

  cube.rotation.y += 0.01;

  renderer.render(scene, camera);
}

////////////////////////////////////////////////////////////////////////////////
// HANDLE RESIZE
////////////////////////////////////////////////////////////////////////////////

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;

  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
});

////////////////////////////////////////////////////////////////////////////////
// START
////////////////////////////////////////////////////////////////////////////////

// Button required for iOS permission flow
const startButton = document.createElement("button");

startButton.innerText = "Start AR";

startButton.style.position = "absolute";
startButton.style.zIndex = "999";
startButton.style.top = "20px";
startButton.style.left = "20px";
startButton.style.padding = "12px 20px";

document.body.appendChild(startButton);

startButton.addEventListener("click", async () => {
  startButton.remove();

  try {
    await initAR();
  } catch (err) {
    console.error(err);
    alert("Failed to start AR");
  }
});


