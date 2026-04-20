import "./style.css";
import javascriptLogo from "./assets/javascript.svg";
import viteLogo from "./assets/vite.svg";
import heroImg from "./assets/hero.png";
import * as THREE from 'three';
import * as LocAR from 'locar';

const camera = new THREE.PerspectiveCamera(80, window.innerWidth/window.innerHeight, 0.001, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
const scene = new THREE.Scene();

document.body.appendChild(renderer.domElement);

window.addEventListener("resize", e => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

const locar = new LocAR.LocationBased(scene, camera);

const deviceOrientationControls = new LocAR.DeviceOrientationControls(camera);

deviceOrientationControls.on("deviceorientationgranted", ev => {
    ev.target.connect();
});

deviceOrientationControls.on("deviceorientationerror", error => {
    alert(`Device orientation error: code ${error.code} message ${error.message}`);
});

deviceOrientationControls.init();

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

let firstPosition = true;

const indexedObjects = { };

const cube = new THREE.BoxGeometry(20, 20, 20);

const clickHandler = new LocAR.ClickHandler(renderer);

locar.on("gpserror", error => {
    alert(`GPS error: ${error.code}`);
});

locar.on("gpsupdate", async(ev, distMoved) => {
    
    if(firstPosition || distMoved > 100) {

        const response = await fetch(`https://hikar.org/webapp/map?bbox=${ev.position.coords.longitude-0.02},${ev.position.coords.latitude-0.02},${ev.position.coords.longitude+0.02},${ev.position.coords.latitude+0.02}&layers=poi&outProj=4326`);
        const pois = await response.json();

        pois.features.forEach ( poi => {
            if(!indexedObjects[poi.properties.osm_id]) {
                const mesh = new THREE.Mesh(
                    cube,
                    new THREE.MeshBasicMaterial({color: 0xff0000})
                );                

                locar.add(
                    mesh, 
                    poi.geometry.coordinates[0], 
                    poi.geometry.coordinates[1]
                );
                indexedObjects[poi.properties.osm_id] = mesh;
            }
        });
        firstPosition = false;
    }

});
locar.startGps();

renderer.setAnimationLoop(animate);

function animate() {
    deviceOrientationControls.update();
    renderer.render(scene, camera);
}

