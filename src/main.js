import "./style.css";
import javascriptLogo from "./assets/javascript.svg";
import viteLogo from "./assets/vite.svg";
import heroImg from "./assets/hero.png";
import * as THREE from 'three';
import * as LocAR from 'locar';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.001, 100);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

window.addEventListener("resize", e => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;    
    camera.updateProjectionMatrix();
});
const box = new THREE.BoxGeometry(2,2,2);
const cube = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: 0xff0000 }));

const locar = new LocAR.LocationBased(scene, camera);

const cam = new LocAR.Webcam({
    video: {
        facingMode: "environment"
    }
});

cam.on("webcamstarted", ev => {
    scene.background = ev.texture;
});

cam.on("webcamerror", error => {
    alert(`Webcam error: code ${error.code} message ${error.message}`);
});


locar.startGps();
locar.add(cube, -0.72, 51.0501);

renderer.setAnimationLoop(animate);


function animate() {
    renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

function animate() {
  renderer.render(scene, camera);
}
