# 🏰 AR Castle — WebAR Starter Project

A GPS-based augmented reality experience that places a 3D castle in a real-world location.
Built with **A-Frame + AR.js** — no app install required, runs in any modern mobile browser.

---

## 📁 Project Structure

```
webar-castle/
├── index.html              # Main page + AR scene
├── css/
│   └── style.css           # UI styles
├── js/
│   ├── app.js              # GPS detection, range check, start/stop logic
│   └── castle-component.js # A-Frame castle 3D component
├── models/
│   └── (put your .glb here when ready)
└── README.md
```

---

## ⚙️ Step 1 — Set Your Location

Open **`js/app.js`** and edit the `CONFIG` block at the top:

```js
const CONFIG = {
  targetLat: 59.3920,        // ← Your park GPS latitude
  targetLon: 12.1310,        // ← Your park GPS longitude
  locationName: 'Stadsparken', // ← Display name
  allowedRadius: 50,          // ← Metres the user must be within
};
```

Also open **`index.html`** and update the same coordinates on the castle entity:

```html
<a-entity
  gps-entity-place="latitude: 59.3920; longitude: 12.1310;"
  ...
```

**How to get your GPS coordinates:**
1. Open Google Maps on your phone
2. Long-press the exact spot in the park
3. The coordinates appear at the bottom — copy them

---

## 🏰 Step 2 — Add Your Own 3D Castle Model (optional)

The project ships with a **procedural castle** built from geometric shapes — it works immediately with no files to download.

When you're ready to use a real, detailed model:

1. Download a `.glb` or `.glTF` castle from:
   - [Sketchfab.com](https://sketchfab.com/search?q=castle&type=models) (many free under CC license)
   - [Poly Pizza](https://poly.pizza) (free low-poly models)
   - Commission one on Fiverr (~$50–200)

2. Put the file in the `models/` folder

3. In **`js/castle-component.js`**, comment out the procedural castle block and uncomment:

```js
const model = document.createElement('a-entity');
model.setAttribute('gltf-model', 'models/castle.glb');
model.setAttribute('position', '0 0 0');
el.appendChild(model);
```

4. Adjust the `scale` on the entity in `index.html` to resize:
   ```html
   <a-entity ... scale="5 5 5">
   ```

---

## 🚀 Step 3 — Deploy (HTTPS required)

Cameras and GPS only work over **HTTPS**. Use one of these free hosts:

### Option A — Netlify (recommended, drag & drop)
1. Go to [netlify.com](https://netlify.com) and create a free account
2. Drag the entire `webar-castle/` folder onto the Netlify dashboard
3. Done — you get a public HTTPS URL instantly

### Option B — GitHub Pages
1. Push this folder to a GitHub repo
2. Go to repo Settings → Pages → deploy from `main` branch
3. Your URL: `https://yourusername.github.io/webar-castle/`

### Option C — Local testing with HTTPS (ngrok)
```bash
# Install http-server and ngrok
npm install -g http-server ngrok

# In the project folder:
http-server . -p 8080

# In another terminal:
ngrok http 8080
# Copy the https:// URL and open it on your phone
```

---

## 📱 Step 4 — Test on Your Phone

1. Open the HTTPS URL in **Chrome (Android)** or **Safari (iOS)**
2. Allow camera + location permissions when prompted
3. Walk to your park location
4. Tap **Start Experience** — the castle appears!

---

## 🐛 Troubleshooting

| Problem | Fix |
|---|---|
| Camera black screen | Check HTTPS, reload, re-allow camera permission |
| Castle doesn't appear | Walk around — GPS can drift 3–5m. Try toggling location off/on |
| "Location denied" | iOS: Settings → Safari → Location → Allow. Android: Site Settings → Location |
| Model too big/small | Change `scale="X X X"` on the `<a-entity>` in `index.html` |
| Start button always disabled | Uncomment the dev bypass line in `js/app.js` for testing indoors |

### Dev bypass (for indoor testing)
In `js/app.js`, uncomment this line:
```js
// startBtn.disabled = false; dot.className='dot in-range'; statusText.textContent='Dev mode';
```
This skips the GPS range check so you can test the AR scene anywhere.

---

## 🛠 Tech Stack

| Library | Version | Purpose |
|---|---|---|
| [A-Frame](https://aframe.io) | 1.4.0 | 3D scene + WebXR |
| [AR.js](https://ar-js-org.github.io/AR.js-Docs/) | latest | GPS-based AR |
| Vanilla JS | — | App logic |
| CSS + Google Fonts | — | UI (Cinzel + Raleway) |

---

## 📐 Customisation Ideas

- **Multiple objects**: Add more `<a-entity gps-entity-place>` elements at different GPS spots
- **Info panel**: Show a popup with castle history when the user taps the model
- **Sound**: Add `<a-sound>` with ambient medieval music
- **Day/night**: Use `<a-sky>` to change the sky colour based on time of day
- **Animations**: Add `animation` components to make the castle "rise from the ground"

---

*Built with A-Frame + AR.js. No app install required.*
