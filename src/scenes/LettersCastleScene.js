/**
 * LettersCastleScene.js
 * A castle where the player explores 3 deeper rooms collecting scattered letters,
 * then returns to the main hall to arrange them in the correct order on the assembly box.
 *
 * Rooms: 0 = Assembly Hall (main), 1/2/3 = Letter Rooms
 * Letters are placed 2-per-room (6 total for a 6-letter word).
 */

import { createPlayer }   from "../entities/Player.js";
import { LETTER_WORDS }   from "../data/lettersPuzzles.js";
import { SaveManager }    from "../utils/SaveManager.js";

export function createLettersCastleScene(engine, onExit) {
  const BABYLON = window.BABYLON;
  const canvas  = engine.getRenderingCanvas();
  const scene   = new BABYLON.Scene(engine);

  // ── Dimensions ─────────────────────────────────────────────────────────────
  const ROOM_WIDTH   = 60;
  const ROOM_LENGTH  = 30;
  const ROOM_HEIGHT  = 7.0;
  const NUM_ROOMS    = 4;          // rooms 0-3
  const DESIRED_RADIUS = 12;

  // ── Pick a random word ──────────────────────────────────────────────────────
  const puzzleData   = LETTER_WORDS[Math.floor(Math.random() * LETTER_WORDS.length)];
  const TARGET_WORD  = puzzleData.word;
  const HINT_TEXT    = puzzleData.hint;
  const TARGET_LETTERS = puzzleData.letters.slice(); // ["C","A","S","T","L","E"]

  // ── State ───────────────────────────────────────────────────────────────────
  let currentRoom      = 0;
  let collectedLetters = [];     // letters player has picked up
  let letterTiles      = [];     // { mesh, letter, collected, update }
  let crownEarned      = false;

  // ── Scene setup ────────────────────────────────────────────────────────────
  scene.clearColor = new BABYLON.Color4(0.07, 0.04, 0.12, 1);
  scene.fogMode    = BABYLON.Scene.FOGMODE_NONE;

  // Ambient
  const ambient = new BABYLON.HemisphericLight("amb", new BABYLON.Vector3(0, 1, 0), scene);
  ambient.intensity = 0.65;
  ambient.diffuse   = new BABYLON.Color3(0.85, 0.80, 1.0);
  ambient.groundColor = new BABYLON.Color3(0.20, 0.12, 0.30);

  // ── Materials ──────────────────────────────────────────────────────────────
  function stdMat(name, r, g, b, emR, emG, emB) {
    const m = new BABYLON.StandardMaterial(name, scene);
    m.diffuseColor  = new BABYLON.Color3(r, g, b);
    if (emR !== undefined) m.emissiveColor = new BABYLON.Color3(emR, emG, emB);
    return m;
  }

  const wallMat    = stdMat("wallMat",  0.18, 0.10, 0.30);
  const floorMat   = stdMat("floorMat", 0.14, 0.08, 0.24);
  const ceilMat    = stdMat("ceilMat",  0.12, 0.07, 0.20);
  const stoneMat   = stdMat("stoneMat", 0.28, 0.24, 0.38);
  const doorMat    = stdMat("doorMat",  0.55, 0.35, 0.05);
  const goldMat    = stdMat("goldMat",  0.80, 0.65, 0.10, 0.20, 0.12, 0.00);
  const tealMat    = stdMat("tealMat",  0.10, 0.75, 0.65, 0.02, 0.25, 0.20);
  const crystalMat = stdMat("crystalMat", 0.45, 0.10, 0.80, 0.20, 0.02, 0.45);

  // ── Floor tile texture ─────────────────────────────────────────────────────
  function makeFloorMat(name) {
    const mat = new BABYLON.StandardMaterial(name, scene);
    try {
      const dt = new BABYLON.DynamicTexture(name + "_tex", { width: 256, height: 256 }, scene, false);
      const ctx = dt.getContext();
      ctx.fillStyle = "#1a0a30";
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = "#2d1a50";
      ctx.lineWidth = 3;
      for (let i = 0; i <= 256; i += 64) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
      }
      dt.update();
      mat.diffuseTexture  = dt;
      mat.diffuseTexture.uScale = ROOM_WIDTH  / 3;
      mat.diffuseTexture.vScale = ROOM_LENGTH / 3;
    } catch(e) { mat.diffuseColor = new BABYLON.Color3(0.10, 0.05, 0.18); }
    return mat;
  }
  const tiledFloorMat = makeFloorMat("floorTile");

  // ── Build all rooms ────────────────────────────────────────────────────────
  for (let r = 0; r < NUM_ROOMS; r++) {
    _buildRoom(r);
  }

  function _buildRoom(r) {
    const baseZ = r * ROOM_LENGTH;
    const cx = 0, cy = ROOM_HEIGHT / 2, cz = baseZ + ROOM_LENGTH / 2;
    const hw = ROOM_WIDTH / 2;

    // Floor
    const floor = BABYLON.MeshBuilder.CreateBox(`floor_${r}`,
      { width: ROOM_WIDTH, height: 0.4, depth: ROOM_LENGTH }, scene);
    floor.position.set(cx, -0.2, cz);
    floor.material = (r === 0) ? tiledFloorMat : floorMat;

    // Ceiling
    const ceil = BABYLON.MeshBuilder.CreateBox(`ceil_${r}`,
      { width: ROOM_WIDTH, height: 0.3, depth: ROOM_LENGTH }, scene);
    ceil.position.set(cx, ROOM_HEIGHT, cz);
    ceil.material = ceilMat;

    // Left wall
    const lw = BABYLON.MeshBuilder.CreateBox(`lwall_${r}`,
      { width: 0.5, height: ROOM_HEIGHT, depth: ROOM_LENGTH }, scene);
    lw.position.set(-hw - 0.25, cy, cz);
    lw.material = wallMat;

    // Right wall
    const rw = BABYLON.MeshBuilder.CreateBox(`rwall_${r}`,
      { width: 0.5, height: ROOM_HEIGHT, depth: ROOM_LENGTH }, scene);
    rw.position.set(hw + 0.25, cy, cz);
    rw.material = wallMat;

    // Back wall (only for room 0 — behind player start)
    if (r === 0) {
      const bk = BABYLON.MeshBuilder.CreateBox(`bkwall_${r}`,
        { width: ROOM_WIDTH, height: ROOM_HEIGHT, depth: 0.5 }, scene);
      bk.position.set(cx, cy, baseZ - 0.25);
      bk.material = wallMat;
    }

    // Front wall with door opening (except last room which has solid wall)
    if (r < NUM_ROOMS - 1) {
      _buildDoorWall(r, baseZ + ROOM_LENGTH, ROOM_WIDTH, ROOM_HEIGHT);
    } else {
      const fw = BABYLON.MeshBuilder.CreateBox(`fwall_${r}`,
        { width: ROOM_WIDTH, height: ROOM_HEIGHT, depth: 0.5 }, scene);
      fw.position.set(cx, cy, baseZ + ROOM_LENGTH + 0.25);
      fw.material = wallMat;
    }

    // Room-specific decor
    if (r === 0) {
      _buildAssemblyStation(baseZ);
      _buildEntranceSign(baseZ);
    } else {
      _buildLetterRoomDecor(r, baseZ);
    }

    // Torches
    _buildTorchPair(r, baseZ + ROOM_LENGTH * 0.25);
    _buildTorchPair(r, baseZ + ROOM_LENGTH * 0.75);

    // Pillars
    _buildPillarPair(r, baseZ + ROOM_LENGTH * 0.50);
  }

  // ── Door wall ──────────────────────────────────────────────────────────────
  function _buildDoorWall(r, wallZ, rw, rh) {
    const hw = rw / 2;
    const doorW = 5.0, doorH = 5.5;
    const sideW = (rw - doorW) / 2;

    // Left panel
    const lp = BABYLON.MeshBuilder.CreateBox(`dwL_${r}`,
      { width: sideW, height: rh, depth: 0.5 }, scene);
    lp.position.set(-hw + sideW / 2, rh / 2, wallZ);
    lp.material = wallMat;

    // Right panel
    const rp = BABYLON.MeshBuilder.CreateBox(`dwR_${r}`,
      { width: sideW, height: rh, depth: 0.5 }, scene);
    rp.position.set(hw - sideW / 2, rh / 2, wallZ);
    rp.material = wallMat;

    // Top lintel
    const tp = BABYLON.MeshBuilder.CreateBox(`dwT_${r}`,
      { width: doorW, height: rh - doorH, depth: 0.5 }, scene);
    tp.position.set(0, doorH + (rh - doorH) / 2, wallZ);
    tp.material = wallMat;

    // Door frame pillars
    for (const sx of [-doorW / 2, doorW / 2]) {
      const fp = BABYLON.MeshBuilder.CreateBox(`dframe_${r}_${sx}`,
        { width: 0.5, height: doorH, depth: 0.8 }, scene);
      fp.position.set(sx, doorH / 2, wallZ);
      fp.material = stoneMat;
    }

    // Puzzle sign above door
    _buildPuzzleSign(r, wallZ, doorH);
  }

  // ── Puzzle sign ────────────────────────────────────────────────────────────
  function _buildPuzzleSign(r, wallZ, doorH) {
    const postH = doorH + 1.0;
    for (const sx of [-1.5, 1.5]) {
      const post = BABYLON.MeshBuilder.CreateBox(`spost_${r}_${sx}`,
        { width: 0.12, height: postH, depth: 0.12 }, scene);
      post.position.set(sx, postH / 2, wallZ - 0.5);
      post.material = stoneMat;
    }

    const boardW = 4.0, boardH = 1.2;
    const board = BABYLON.MeshBuilder.CreateBox(`sboard_${r}`,
      { width: boardW, height: boardH, depth: 0.12 }, scene);
    board.position.set(0, doorH + boardH / 2 + 0.2, wallZ - 0.5);

    try {
      const dt = new BABYLON.DynamicTexture(`stex_${r}`, { width: 512, height: 160 }, scene, false);
      const ctx = dt.getContext();
      ctx.fillStyle = "#1a0540";
      ctx.fillRect(0, 0, 512, 160);
      ctx.fillStyle = "#b060ff";
      ctx.font = "bold 28px Arial";
      ctx.textAlign = "center";
      ctx.fillText("⬆  DEEPER ROOMS", 256, 44);
      ctx.fillStyle = "#d4aaff";
      ctx.font = "22px Arial";
      ctx.fillText("Collect all letters to", 256, 82);
      ctx.fillText("spell the secret word!", 256, 112);
      ctx.fillStyle = "#80ffee";
      ctx.font = "20px Arial";
      ctx.fillText("Return to the Assembly Box", 256, 144);
      dt.update();
      dt.uScale = -1;
      const sm = new BABYLON.StandardMaterial(`sbm_${r}`, scene);
      sm.diffuseTexture  = dt;
      sm.emissiveTexture = dt;
      board.material = sm;
    } catch(e) {
      board.material = crystalMat;
    }
  }

  // ── Torches ────────────────────────────────────────────────────────────────
  const torchLights = [];

  function _buildTorchPair(r, z) {
    const hw = ROOM_WIDTH / 2;
    for (const sx of [-(hw - 1.5), (hw - 1.5)]) {
      _buildTorch(sx, z, r);
    }
  }

  function _buildTorch(x, z, r) {
    const holder = BABYLON.MeshBuilder.CreateBox(`th_${x}_${z}`,
      { width: 0.15, height: 0.6, depth: 0.15 }, scene);
    holder.position.set(x, 3.5, z);
    holder.material = stoneMat;

    const flame = BABYLON.MeshBuilder.CreateCylinder(`tf_${x}_${z}`,
      { diameterTop: 0, diameterBottom: 0.22, height: 0.45, tessellation: 6 }, scene);
    flame.position.set(x, 4.05, z);
    const fm = new BABYLON.StandardMaterial(`tfm_${x}_${z}`, scene);
    fm.diffuseColor  = new BABYLON.Color3(0.55, 0.10, 1.0);
    fm.emissiveColor = new BABYLON.Color3(0.35, 0.04, 0.70);
    flame.material = fm;

    const tl = new BABYLON.PointLight(`tl_${x}_${z}`, new BABYLON.Vector3(x, 4.2, z), scene);
    tl.diffuse    = new BABYLON.Color3(0.68, 0.38, 1.0);
    tl.intensity  = 2.0;
    tl.range      = 14;
    torchLights.push({ light: tl, baseI: 2.0, offset: Math.random() * Math.PI * 2 });
  }

  // ── Pillars ────────────────────────────────────────────────────────────────
  function _buildPillarPair(r, z) {
    const hw = ROOM_WIDTH / 2;
    for (const sx of [-(hw * 0.40), (hw * 0.40)]) {
      const p = BABYLON.MeshBuilder.CreateCylinder(`pil_${r}_${sx}`,
        { diameter: 0.9, height: ROOM_HEIGHT - 0.2, tessellation: 10 }, scene);
      p.position.set(sx, (ROOM_HEIGHT - 0.2) / 2, z);
      p.material = stoneMat;

      const cap = BABYLON.MeshBuilder.CreateBox(`pcap_${r}_${sx}`,
        { width: 1.1, height: 0.25, depth: 1.1 }, scene);
      cap.position.set(sx, ROOM_HEIGHT - 0.1, z);
      cap.material = goldMat;
    }
  }

  // ── Assembly station (Room 0) ──────────────────────────────────────────────
  let assemblyBoxMesh = null;
  const ASSEMBLY_POS  = new BABYLON.Vector3(0, 0, ROOM_LENGTH * 0.55);

  function _buildAssemblyStation(baseZ) {
    const z = ASSEMBLY_POS.z;

    // Pedestal base
    const base = BABYLON.MeshBuilder.CreateBox("asmBase",
      { width: 4.5, height: 0.4, depth: 1.8 }, scene);
    base.position.set(0, 0.2, z);
    base.material = stoneMat;

    // Box on top
    assemblyBoxMesh = BABYLON.MeshBuilder.CreateBox("asmBox",
      { width: 4.0, height: 0.8, depth: 1.4 }, scene);
    assemblyBoxMesh.position.set(0, 0.8, z);

    try {
      const dt = new BABYLON.DynamicTexture("asmTex", { width: 512, height: 128 }, scene, false);
      const ctx = dt.getContext();
      ctx.fillStyle = "#0d1a30";
      ctx.fillRect(0, 0, 512, 128);
      ctx.fillStyle = "#40ffcc";
      ctx.font = "bold 32px Arial";
      ctx.textAlign = "center";
      ctx.fillText("ASSEMBLY BOX", 256, 50);
      ctx.fillStyle = "#80eedd";
      ctx.font = "22px Arial";
      ctx.fillText("Approach when you have all 6 letters", 256, 90);
      dt.update();
      dt.uScale = -1;
      const bm = new BABYLON.StandardMaterial("asmBoxMat", scene);
      bm.diffuseTexture  = dt;
      bm.emissiveTexture = dt;
      assemblyBoxMesh.material = bm;
    } catch(e) {
      assemblyBoxMesh.material = tealMat;
    }

    // Glowing ring around box
    const ring = BABYLON.MeshBuilder.CreateTorus("asmRing",
      { diameter: 3.2, thickness: 0.10, tessellation: 36 }, scene);
    ring.position.set(0, 0.3, z);
    ring.rotation.x = Math.PI / 2;
    const rm = new BABYLON.StandardMaterial("asmRingMat", scene);
    rm.diffuseColor  = new BABYLON.Color3(0.10, 0.90, 0.70);
    rm.emissiveColor = new BABYLON.Color3(0.02, 0.50, 0.38);
    ring.material = rm;

    // Light
    const al = new BABYLON.PointLight("asmLight", new BABYLON.Vector3(0, 2.0, z), scene);
    al.diffuse   = new BABYLON.Color3(0.30, 1.0, 0.80);
    al.intensity = 1.8;
    al.range     = 12;
  }

  // ── Entrance sign (Room 0) ─────────────────────────────────────────────────
  function _buildEntranceSign(baseZ) {
    const board = BABYLON.MeshBuilder.CreateBox("entrSign",
      { width: 6.0, height: 1.4, depth: 0.15 }, scene);
    board.position.set(0, 5.0, baseZ + ROOM_LENGTH * 0.20);

    try {
      const dt = new BABYLON.DynamicTexture("entrTex", { width: 512, height: 128 }, scene, false);
      const ctx = dt.getContext();
      ctx.fillStyle = "#0d0820";
      ctx.fillRect(0, 0, 512, 128);
      ctx.fillStyle = "#ffcc00";
      ctx.font = "bold 36px Arial";
      ctx.textAlign = "center";
      ctx.fillText("🔤 LETTERS CASTLE", 256, 52);
      ctx.fillStyle = "#ccaaff";
      ctx.font = "22px Arial";
      ctx.fillText(`Hint: ${HINT_TEXT}`, 256, 96);
      dt.update();
      dt.uScale = -1;
      const sm = new BABYLON.StandardMaterial("entrSignMat", scene);
      sm.diffuseTexture  = dt;
      sm.emissiveTexture = dt;
      board.material = sm;
    } catch(e) {
      board.material = goldMat;
    }
  }

  // ── Letter room decor + letter tiles ──────────────────────────────────────
  function _buildLetterRoomDecor(r, baseZ) {
    // Two letter tiles per room
    const idxA = (r - 1) * 2;       // 0,2,4
    const idxB = (r - 1) * 2 + 1;   // 1,3,5
    const zMid = baseZ + ROOM_LENGTH / 2;

    const positions = [
      new BABYLON.Vector3(-3, 1.4, zMid - 5),
      new BABYLON.Vector3( 3, 1.4, zMid + 5),
    ];

    [idxA, idxB].forEach((li, i) => {
      if (li < TARGET_LETTERS.length) {
        _buildLetterTile(TARGET_LETTERS[li], li, positions[i]);
      }
    });

    // Crystal pedestals for atmosphere
    for (const sx of [-ROOM_WIDTH * 0.18, ROOM_WIDTH * 0.18]) {
      _buildCrystalPedestal(sx, baseZ + ROOM_LENGTH * 0.30);
      _buildCrystalPedestal(sx, baseZ + ROOM_LENGTH * 0.70);
    }
  }

  // ── HSV helper (avoids BABYLON.Color3.FromHSV which may not exist) ─────────
  function _hsvToColor3(h, s, v) {
    const i = Math.floor(h / 60) % 6;
    const f = h / 60 - Math.floor(h / 60);
    const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    const table = [[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]];
    const [r, g, b] = table[i];
    return new BABYLON.Color3(r, g, b);
  }

  // ── Letter tile ────────────────────────────────────────────────────────────
  function _buildLetterTile(letter, index, pos) {
    const root = new BABYLON.TransformNode(`ltRoot_${index}`, scene);
    root.position.copyFrom(pos);

    const tile = BABYLON.MeshBuilder.CreateBox(`lt_${index}`,
      { width: 0.9, height: 0.9, depth: 0.12 }, scene);
    tile.parent = root;

    try {
      const dt = new BABYLON.DynamicTexture(`ltTex_${index}`, { width: 128, height: 128 }, scene, false);
      const ctx = dt.getContext();
      const hue = (index / 6) * 360;
      ctx.fillStyle = `hsl(${hue}, 70%, 15%)`;
      ctx.fillRect(0, 0, 128, 128);
      ctx.strokeStyle = `hsl(${hue}, 90%, 60%)`;
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, 120, 120);
      ctx.fillStyle = `hsl(${hue}, 90%, 85%)`;
      ctx.font = "bold 80px Arial";
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(letter, 64, 68);
      dt.update();
      const tm = new BABYLON.StandardMaterial(`ltMat_${index}`, scene);
      tm.diffuseTexture  = dt;
      tm.emissiveTexture = dt;
      tile.material = tm;
    } catch(e) {
      const tm = new BABYLON.StandardMaterial(`ltMat_${index}`, scene);
      tm.diffuseColor  = new BABYLON.Color3(0.3, 0.6, 1.0);
      tm.emissiveColor = new BABYLON.Color3(0.1, 0.2, 0.5);
      tile.material = tm;
    }

    // Glow ring
    const ring = BABYLON.MeshBuilder.CreateTorus(`ltRing_${index}`,
      { diameter: 1.0, thickness: 0.06, tessellation: 24 }, scene);
    ring.parent   = root;
    ring.rotation.x = Math.PI / 2;

    const hue360 = (index / 6) * 360;
    const c = _hsvToColor3(hue360, 0.8, 0.9);
    const rm = new BABYLON.StandardMaterial(`ltRingMat_${index}`, scene);
    rm.diffuseColor  = c;
    rm.emissiveColor = c.scale(0.45);
    ring.material = rm;

    // Point light
    const pl = new BABYLON.PointLight(`ltLight_${index}`, BABYLON.Vector3.Zero(), scene);
    pl.parent    = root;
    pl.diffuse   = c;
    pl.intensity = 1.5;
    pl.range     = 8;

    // State
    const tileObj = {
      root, tile, ring, light: pl,
      letter, index, collected: false,
      _t: Math.random() * Math.PI * 2,
      update() {
        if (this.collected) return;
        this._t += 0.025;
        this.root.position.y = pos.y + Math.sin(this._t) * 0.25;
        this.root.rotation.y += 0.018;
      }
    };
    letterTiles.push(tileObj);
  }

  // ── Crystal pedestal (atmosphere) ─────────────────────────────────────────
  function _buildCrystalPedestal(x, z) {
    const base = BABYLON.MeshBuilder.CreateBox(`cpBase_${x}_${z}`,
      { width: 0.7, height: 0.4, depth: 0.7 }, scene);
    base.position.set(x, 0.2, z);
    base.material = stoneMat;

    const col = BABYLON.MeshBuilder.CreateCylinder(`cpCol_${x}_${z}`,
      { diameterTop: 0.22, diameterBottom: 0.30, height: 0.7, tessellation: 8 }, scene);
    col.position.set(x, 0.75, z);
    col.material = stoneMat;

    const spire = BABYLON.MeshBuilder.CreateCylinder(`cpSpire_${x}_${z}`,
      { diameterTop: 0, diameterBottom: 0.32, height: 0.85, tessellation: 6 }, scene);
    spire.position.set(x, 1.53, z);
    spire.material = crystalMat;

    const sl = new BABYLON.PointLight(`cpLight_${x}_${z}`,
      new BABYLON.Vector3(x, 1.8, z), scene);
    sl.diffuse    = new BABYLON.Color3(0.55, 0.15, 1.0);
    sl.intensity  = 0.8;
    sl.range      = 7;
  }

  // ── Player ─────────────────────────────────────────────────────────────────
  const player = createPlayer(scene);
  player.mesh.position.set(0, 0.5, 5);
  player.camera.radius           = DESIRED_RADIUS;
  player.camera.lowerRadiusLimit = 3;
  player.camera.upperRadiusLimit = 28;

  // ── HUD ────────────────────────────────────────────────────────────────────
  const hudLocation = document.getElementById("hud-location");
  const hudStars    = document.getElementById("hud-stars");
  function _updateHUD() {
    if (hudLocation) hudLocation.textContent = `🔤 Letters Castle – Room ${currentRoom + 1}`;
    if (hudStars)    hudStars.textContent     = `📜 ${collectedLetters.length} / 6 letters`;
  }
  _updateHUD();

  // ── UI overlay helpers ─────────────────────────────────────────────────────
  const overlay = document.getElementById("ui-overlay");

  function _clearOverlay() {
    overlay.innerHTML = "";
    overlay.classList.remove("active");
  }

  // ── Assembly UI ────────────────────────────────────────────────────────────
  let assemblyOpen = false;

  function _showAssemblyUI() {
    assemblyOpen = true;
    overlay.innerHTML = "";
    overlay.classList.add("active");

    const panel = document.createElement("div");
    panel.className = "puzzle-panel";

    panel.innerHTML = `
      <h2>🔤 Arrange the Letters!</h2>
      <p class="tagline">${HINT_TEXT}</p>
      <p class="question">Tap letters in the correct order to spell the word:</p>
    `;

    // Selected word display
    const display = document.createElement("div");
    display.className = "sentence-builder";
    display.id = "asm-display";
    panel.appendChild(display);

    // Available tiles
    const tileArea = document.createElement("div");
    tileArea.className = "word-tiles";

    // selected = array of { ltr, btn } so we can re-enable buttons on removal
    const selected = [];

    function _refresh() {
      display.innerHTML = "";
      selected.forEach((item, i) => {
        const w = document.createElement("span");
        w.className = "sentence-word";
        w.textContent = item.ltr;
        w.onclick = () => {
          // Re-enable the source button
          item.btn.disabled = false;
          item.btn.classList.remove("used");
          selected.splice(i, 1);
          _refresh();
        };
        display.appendChild(w);
      });
      // check auto-complete
      if (selected.length === TARGET_LETTERS.length) {
        const attempt = selected.map(x => x.ltr).join("");
        if (attempt === TARGET_WORD) {
          _onWordCorrect();
        } else {
          feedback.className = "feedback wrong";
          feedback.textContent = "❌ Not quite — try again!";
          // Re-enable all buttons and clear selection
          selected.forEach(item => {
            item.btn.disabled = false;
            item.btn.classList.remove("used");
          });
          selected.length = 0;
          _refresh();
        }
      }
    }

    // Shuffle collected letters for display
    const shuffled = collectedLetters.slice().sort(() => Math.random() - 0.5);
    shuffled.forEach(ltr => {
      const btn = document.createElement("button");
      btn.className = "btn btn-word";
      btn.textContent = ltr;
      btn.onclick = () => {
        btn.disabled = true;
        btn.classList.add("used");
        selected.push({ ltr, btn });
        _refresh();
      };
      tileArea.appendChild(btn);
    });
    panel.appendChild(tileArea);

    // Feedback
    const feedback = document.createElement("div");
    feedback.className = "feedback";
    panel.appendChild(feedback);

    // Close button
    const closeBtn = document.createElement("button");
    closeBtn.className = "btn btn-primary";
    closeBtn.style.background = "#555";
    closeBtn.textContent = "Close";
    closeBtn.onclick = () => {
      _clearOverlay();
      assemblyOpen = false;
    };
    panel.appendChild(closeBtn);

    overlay.appendChild(panel);
  }

  // ── Word correct ───────────────────────────────────────────────────────────
  function _onWordCorrect() {
    crownEarned = true;
    const save = SaveManager.load();
    save.lettersIsland = save.lettersIsland || {};
    save.lettersIsland.crownEarned = true;
    SaveManager.save(save);

    _showVictory();
  }

  function _showVictory() {
    overlay.innerHTML = "";
    overlay.classList.add("active");

    _spawnConfetti();

    const panel = document.createElement("div");
    panel.className = "puzzle-panel victory-panel";
    panel.innerHTML = `
      <span class="victory-emoji">👑</span>
      <div class="victory-title">Amazing! You spelled ${TARGET_WORD}!</div>
      <div class="victory-sub">${HINT_TEXT}</div>
      <br>
    `;

    const exitBtn = document.createElement("button");
    exitBtn.className = "btn btn-primary";
    exitBtn.textContent = "🏠 Return to World Map";
    exitBtn.onclick = () => {
      _clearOverlay();
      if (typeof onExit === "function") onExit();
    };
    panel.appendChild(exitBtn);

    overlay.appendChild(panel);
  }

  // ── Confetti ───────────────────────────────────────────────────────────────
  function _spawnConfetti() {
    const wrap = document.createElement("div");
    wrap.className = "confetti-wrap";
    document.body.appendChild(wrap);
    const colors = ["#ff0","#f0f","#0ff","#0f0","#f80","#88f"];
    for (let i = 0; i < 60; i++) {
      const p = document.createElement("div");
      p.className = "confetti-piece";
      p.style.left     = Math.random() * 100 + "vw";
      p.style.background = colors[i % colors.length];
      p.style.animationDuration = (1.5 + Math.random() * 2) + "s";
      p.style.animationDelay    = (Math.random() * 1) + "s";
      wrap.appendChild(p);
    }
    setTimeout(() => { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }, 4000);
  }

  // ── Collect letter notification ────────────────────────────────────────────
  function _showCollectBanner(letter) {
    const b = document.createElement("div");
    b.className = "room-banner";
    b.textContent = `Collected letter: ${letter}  (${collectedLetters.length}/6)`;
    document.body.appendChild(b);
    setTimeout(() => { if (b.parentNode) b.parentNode.removeChild(b); }, 2500);
  }

  // ── Render loop ────────────────────────────────────────────────────────────
  let time = 0;

  scene.registerBeforeRender(() => {
    try {
      time += 0.016;

      player.update();

      const px = player.mesh.position.x;
      const py = player.mesh.position.y;
      const pz = player.mesh.position.z;

      // Torch flicker
      for (const t of torchLights) {
        t.light.intensity = t.baseI + 0.55 * Math.sin(time * 2.8 + t.offset) + 0.22 * Math.sin(time * 7.1 + t.offset);
      }

      // Letter tile animations + collection
      for (const tile of letterTiles) {
        tile.update();
        if (!tile.collected) {
          const dist = BABYLON.Vector3.Distance(
            new BABYLON.Vector3(px, py, pz),
            tile.root.position
          );
          if (dist < 5.0) {
            tile.collected = true;
            collectedLetters.push(tile.letter);
            tile.root.setEnabled(false);
            _showCollectBanner(tile.letter);
            _updateHUD();
          }
        }
      }

      // Assembly box proximity check
      if (!assemblyOpen && collectedLetters.length === 6) {
        const asmDist = BABYLON.Vector3.Distance(
          new BABYLON.Vector3(px, py, pz),
          ASSEMBLY_POS
        );
        if (asmDist < 4.5) {
          _showAssemblyUI();
        }
      }

      // Room detection
      currentRoom = Math.max(0, Math.min(NUM_ROOMS - 1, Math.floor(pz / ROOM_LENGTH)));
      _updateHUD();

      // Dynamic camera occlusion prevention
      const roomBaseZ = currentRoom * ROOM_LENGTH;
      const halfW     = ROOM_WIDTH / 2;
      const distBack  = Math.max(0.5, pz - roomBaseZ);
      const distFront = Math.max(0.5, roomBaseZ + ROOM_LENGTH - pz);
      const distLeft  = Math.max(0.5, px + halfW);
      const distRight = Math.max(0.5, halfW - px);
      const safeRadius = Math.min(DESIRED_RADIUS, distBack * 0.80, distFront * 0.80, distLeft * 0.80, distRight * 0.80);
      const clampedR   = Math.max(3.0, safeRadius);
      player.camera.radius = BABYLON.Scalar.Lerp(player.camera.radius, clampedR, 0.18);
      player.camera.upperRadiusLimit = clampedR + 0.5;

      // Exit trigger (walk back past room 0 start)
      if (pz < -1.5) {
        if (typeof onExit === "function") onExit();
      }

    } catch(err) {
      console.error("LettersCastle render error:", err);
    }
  });

  return scene;
}
