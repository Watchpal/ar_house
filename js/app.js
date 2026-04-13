/**
 * app.js — AR Castle main logic
 *
 * Handles:
 *  1. GPS permission + live position tracking
 *  2. Distance check against target location
 *  3. Enabling/disabling the Start button
 *  4. Launching and exiting the AR scene
 */

// ═══════════════════════════════════════════════════════════════
//  ⚙️  CONFIGURATION — Edit these values for your location
// ═══════════════════════════════════════════════════════════════

const CONFIG = {
  // Target GPS coordinates (the exact spot in the park)
  targetLat: 59.836682053092346,
  targetLon: 13.54035725371799,

  // Display name for the location (shown in "out of range" message)
  locationName: "Test Model Location",

  // Radius in metres the user must be within to start the experience
  allowedRadius: 50,

  // How often to poll GPS while on splash screen (ms)
  pollInterval: 3000,
};

// ── DOM refs ──────────────────────────────────────────────────
const splash = document.getElementById("splash");
const arWrapper = document.getElementById("ar-wrapper");
const startBtn = document.getElementById("start-btn");
const statusText = document.getElementById("status-text");
const dot = document.querySelector(".dot");
const outOfRange = document.getElementById("out-of-range");
const distDisplay = document.getElementById("distance-display");
const targetNameEl = document.getElementById("target-name");
const hudCoords = document.getElementById("hud-coords");

// Set location name in out-of-range overlay
targetNameEl.textContent = CONFIG.locationName;

// ── State ─────────────────────────────────────────────────────
let watchId = null;
let userLat = null;
let userLon = null;

// ── Haversine distance (metres) ───────────────────────────────
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in metres
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(metres) {
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

// ── GPS callbacks ─────────────────────────────────────────────
function onPosition(pos) {
  userLat = pos.coords.latitude;
  userLon = pos.coords.longitude;

  const dist = haversineDistance(
    userLat,
    userLon,
    CONFIG.targetLat,
    CONFIG.targetLon,
  );
  const inRange = dist <= CONFIG.allowedRadius;

  // Update status dot
  dot.className = "dot " + (inRange ? "in-range" : "out-range");

  if (inRange) {
    statusText.textContent = `You're in range! (${formatDistance(dist)} away)`;
    startBtn.disabled = false;
  } else {
    statusText.textContent = `${formatDistance(dist)} from the target`;
    distDisplay.textContent = formatDistance(dist);
    startBtn.disabled = true;
  }
}

function onError(err) {
  dot.className = "dot out-range";
  switch (err.code) {
    case err.PERMISSION_DENIED:
      statusText.textContent = "Location permission denied";
      break;
    case err.POSITION_UNAVAILABLE:
      statusText.textContent = "Location unavailable";
      break;
    case err.TIMEOUT:
      statusText.textContent = "Location request timed out";
      break;
    default:
      statusText.textContent = "Location error";
  }
  startBtn.disabled = true;
}

// ── Boot: request GPS ─────────────────────────────────────────
function initGPS() {
  if (!navigator.geolocation) {
    statusText.textContent = "GPS not supported on this device";
    dot.className = "dot out-range";
    return;
  }

  dot.className = "dot checking";
  statusText.textContent = "Checking your location…";

  watchId = navigator.geolocation.watchPosition(onPosition, onError, {
    enableHighAccuracy: true,
    maximumAge: 5000,
    timeout: 10000,
  });
}

// ── Dev/testing bypass ────────────────────────────────────────
// Uncomment the line below to SKIP location check during development:
//startBtn.disabled = false;
//dot.className = "dot in-range";
//statusText.textContent = "Dev mode — range bypassed";

// ── Start AR ─────────────────────────────────────────────────
startBtn.addEventListener("click", () => {
  if (startBtn.disabled) return;

  // Final range check
  if (userLat !== null) {
    const dist = haversineDistance(
      userLat,
      userLon,
      CONFIG.targetLat,
      CONFIG.targetLon,
    );
    if (dist > CONFIG.allowedRadius) {
      distDisplay.textContent = formatDistance(dist);
      outOfRange.classList.remove("hidden");
      return;
    }
  }

  // Hide splash, show AR
  splash.classList.add("hide");
  setTimeout(() => {
    splash.style.display = "none";
    arWrapper.classList.remove("hidden");
    startHUDUpdates();
  }, 600);
});

// ── HUD live coords ───────────────────────────────────────────
function startHUDUpdates() {
  function tick() {
    if (userLat !== null) {
      hudCoords.textContent = `${userLat.toFixed(5)}, ${userLon.toFixed(5)}`;
    }
    requestAnimationFrame(tick);
  }
  tick();
}

// ── Exit AR ───────────────────────────────────────────────────
window.exitAR = function () {
  arWrapper.classList.add("hidden");
  splash.style.display = "";
  splash.classList.remove("hide");
};

// ── Init ──────────────────────────────────────────────────────
initGPS();
