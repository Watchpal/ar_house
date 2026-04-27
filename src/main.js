import "./style.css";
import javascriptLogo from "./assets/javascript.svg";
import viteLogo from "./assets/vite.svg";
import heroImg from "./assets/hero.png";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  LocationBased,
  WebcamRenderer,
  DeviceOrientationControls,
} from "locar";

// Replace with your target GPS coordinates
const TARGET_LAT = 59.836704661579994;
const TARGET_LON = 13.540565734604412;


////////////////////////////////////////////////////////////////////////////////
// SCENE
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

document.body.appendChild(renderer.domElement);

////////////////////////////////////////////////////////////////////////////////
// LIGHT
////////////////////////////////////////////////////////////////////////////////

const light = new THREE.AmbientLight(0xffffff, 1);

scene.add(light);

////////////////////////////////////////////////////////////////////////////////
// CUBE
////////////////////////////////////////////////////////////////////////////////

const cube = new THREE.Mesh(
  new THREE.BoxGeometry(2, 2, 2),
  new THREE.MeshStandardMaterial({
    color: 0x00ff00,
  })
);

////////////////////////////////////////////////////////////////////////////////
// START AR
////////////////////////////////////////////////////////////////////////////////

async function startAR() {
  // Camera permission
  await navigator.mediaDevices.getUserMedia({
    video: true,
  });

  // iOS orientation permission
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

  // LOCAR
  const locationBased = new LocationBased(scene, camera);

  // Webcam background
  new WebcamRenderer(renderer);

  // Device orientation
  const controls = new DeviceOrientationControls(camera);

  // Add cube to GPS location
  locationBased.add(cube, TARGET_LON, TARGET_LAT);

  cube.position.y = 1;

  // Start GPS
  locationBased.startGps();

  // Animation loop
  renderer.setAnimationLoop(() => {
    controls.update();

    cube.rotation.y += 0.01;

    renderer.render(scene, camera);
  });
}

////////////////////////////////////////////////////////////////////////////////
// BUTTON
////////////////////////////////////////////////////////////////////////////////

const button = document.createElement("button");

button.innerText = "Start AR";

button.style.position = "absolute";
button.style.top = "20px";
button.style.left = "20px";
button.style.zIndex = "999";
button.style.padding = "12px 20px";

document.body.appendChild(button);

button.addEventListener("click", async () => {
  button.remove();

  try {
    await startAR();
  } catch (err) {
    console.error(err);

    alert(err.message);
  }
});

////////////////////////////////////////////////////////////////////////////////
// RESIZE
////////////////////////////////////////////////////////////////////////////////

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;

  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
});


