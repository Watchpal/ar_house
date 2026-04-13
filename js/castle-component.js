/**
 * castle-model — A-Frame component
 *
 * Builds a procedural castle from A-Frame primitives so the project works
 * OUT OF THE BOX with no external 3D file.
 *
 * When you have a real .glb model, comment out the "Procedural castle" block
 * and uncomment the "Real model" block at the bottom.
 */

AFRAME.registerComponent("castle-model", {
  init: function () {
    const el = this.el;

    // ── PROCEDURAL CASTLE ──────────────────────────────────────────────────
    // A simple but recognisable castle silhouette built from boxes & cylinders.
    // Dimensions are in metres.  Scale the parent entity in index.html to resize.

    /*

    const STONE = '#8a7a6a';
    const STONE_DARK = '#6b5c4e';
    const ROOF = '#5a3a2a';
    const FLAG = '#cc2222';

    // Helper to create a primitive child
    const add = (tag, attrs) => {
      const child = document.createElement(tag);
      for (const [k, v] of Object.entries(attrs)) child.setAttribute(k, v);
      el.appendChild(child);
      return child;
    };

    // ── Keep-tower (central large tower)
    add('a-box', {
      position: '0 5 0',
      width: '6', height: '10', depth: '6',
      color: STONE
    });
    // Keep battlements (top row of merlons)
    for (let i = -2; i <= 2; i += 2) {
      add('a-box', { position: `${i} 10.6 3.1`, width: '1.2', height: '1.2', depth: '0.4', color: STONE_DARK });
      add('a-box', { position: `${i} 10.6 -3.1`, width: '1.2', height: '1.2', depth: '0.4', color: STONE_DARK });
      add('a-box', { position: `3.1 10.6 ${i}`, width: '0.4', height: '1.2', depth: '1.2', color: STONE_DARK });
      add('a-box', { position: `-3.1 10.6 ${i}`, width: '0.4', height: '1.2', depth: '1.2', color: STONE_DARK });
    }
    // Conical keep roof
    add('a-cone', { position: '0 13 0', radius-bottom: '3.6', radius-top: '0.1', height: '4', color: ROOF, 'segments-radial': '8' });
    // Flag pole + flag
    add('a-cylinder', { position: '0 16 0', radius: '0.06', height: '3', color: '#555' });
    add('a-box', { position: '0.75 17.5 0', width: '1.5', height: '0.8', depth: '0.05', color: FLAG });

    // ── Corner towers (4)
    const corners = [[-4, -4], [4, -4], [-4, 4], [4, 4]];
    corners.forEach(([x, z]) => {
      add('a-cylinder', {
        position: `${x} 4 ${z}`,
        radius: '1.5', height: '8',
        color: STONE_DARK,
        'segments-radial': '10'
      });
      // Battlements on each tower
      for (let a = 0; a < 360; a += 72) {
        const rad = a * Math.PI / 180;
        const bx = x + Math.cos(rad) * 1.55;
        const bz = z + Math.sin(rad) * 1.55;
        add('a-box', { position: `${bx} 8.6 ${bz}`, width: '0.5', height: '1', depth: '0.5', color: STONE_DARK });
      }
      // Small cone roof on corner towers
      add('a-cone', { position: `${x} 9.5 ${z}`, 'radius-bottom': '1.7', 'radius-top': '0.1', height: '2.5', color: ROOF, 'segments-radial': '10' });
    });

    // ── Curtain walls connecting keep to corner towers
    const walls = [
      { pos: '-4 2.5 0', w: '0.5', h: '5', d: '8' },  // left
      { pos: '4 2.5 0',  w: '0.5', h: '5', d: '8' },  // right
      { pos: '0 2.5 4',  w: '8',   h: '5', d: '0.5' }, // front
      { pos: '0 2.5 -4', w: '8',   h: '5', d: '0.5' }, // back
    ];
    walls.forEach(({ pos, w, h, d }) => {
      add('a-box', { position: pos, width: w, height: h, depth: d, color: STONE });
    });

    // Wall battlements (front and back for visibility)
    for (let i = -3; i <= 3; i += 1.5) {
      add('a-box', { position: `${i} 5.6 4.3`, width: '0.8', height: '1', depth: '0.4', color: STONE_DARK });
      add('a-box', { position: `${i} 5.6 -4.3`, width: '0.8', height: '1', depth: '0.4', color: STONE_DARK });
    }

    // ── Gate (arched entrance in front wall)
    add('a-box', { position: '0 1.2 4.1', width: '2', height: '2.4', depth: '0.6', color: '#2a1f15' }); // gate dark opening
    add('a-box', { position: '0 2.8 4.05', width: '2.2', height: '0.8', depth: '0.5', color: STONE }); // arch lintel

    // ── Moat hint (flat ring of dark water color)
    add('a-ring', {
      position: '0 0.05 0',
      'radius-inner': '5.5',
      'radius-outer': '7',
      color: '#1a3a4a',
      rotation: '-90 0 0',
      'segments-theta': '32'
    });

    // ── Ground base
    add('a-cylinder', {
      position: '0 0 0',
      radius: '9', height: '0.1',
      color: '#4a5a30',
      'segments-radial': '32'
    });

    console.log('[CastleAR] Procedural castle spawned');
    */

    // ── REAL MODEL — uncomment and edit path when you have a .glb file ──────

    const model = document.createElement("a-entity");
    model.setAttribute("gltf-model", "models/House.glb");
    model.setAttribute("position", "0 0 0");
    model.setAttribute("rotation", "0 0 0");
    el.appendChild(model);
  },
});
