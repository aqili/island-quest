/**
 * LettersCastleScene.js
 * Castle with 4 rooms: Room 0 = Assembly Hall, Rooms 1/2/3 = Letter Rooms.
 * Player walks through each room collecting 2 letter tiles per room (6 total),
 * then returns to the Assembly Hall and arranges letters to spell the secret word.
 */

import { createPlayer }   from "../entities/Player.js";
import { LETTER_WORDS }   from "../data/lettersPuzzles.js";
import { SaveManager }    from "../utils/SaveManager.js";

export function createLettersCastleScene(engine, onExit) {
  const BABYLON = window.BABYLON;
  const scene   = new BABYLON.Scene(engine);

  // ── Dimensions ─────────────────────────────────────────────────────────────
  const ROOM_WIDTH   = 25;
  const ROOM_LENGTH  = 30;
  const ROOM_HEIGHT  = 7.0;
  const NUM_ROOMS    = 4;    // 0 = entry/assembly, 1–3 = letter rooms
  const DESIRED_RADIUS = 12;

  // ── Pick a random word ──────────────────────────────────────────────────────
  const puzzleData     = LETTER_WORDS[Math.floor(Math.random() * LETTER_WORDS.length)];
  const TARGET_WORD    = puzzleData.word;
  const HINT_TEXT      = puzzleData.hint;
  const TARGET_LETTERS = puzzleData.letters.slice();

  // ── State ───────────────────────────────────────────────────────────────────
  let currentRoom      = 0;
  let collectedLetters = [];
  let letterTiles      = [];
  let crownEarned      = false;

  // ── Scene setup ─────────────────────────────────────────────────────────────
  scene.clearColor = new BABYLON.Color4(0.06, 0.03, 0.10, 1);

  const ambient = new BABYLON.HemisphericLight("amb", new BABYLON.Vector3(0, 1, 0), scene);
  ambient.intensity   = 0.55;
  ambient.diffuse     = new BABYLON.Color3(0.80, 0.75, 1.0);
  ambient.groundColor = new BABYLON.Color3(0.15, 0.08, 0.25);

  // ── Shared materials ────────────────────────────────────────────────────────
  function stdMat(name, r, g, b, emR, emG, emB) {
    const m = new BABYLON.StandardMaterial(name, scene);
    m.diffuseColor = new BABYLON.Color3(r, g, b);
    if (emR !== undefined) m.emissiveColor = new BABYLON.Color3(emR, emG, emB);
    return m;
  }

  const wallMat    = stdMat("wallMat",    0.20, 0.11, 0.32);
  const floorMat   = stdMat("floorMat",   0.15, 0.09, 0.26);
  const ceilMat    = stdMat("ceilMat",    0.12, 0.07, 0.20);
  const stoneMat   = stdMat("stoneMat",   0.30, 0.26, 0.40);
  const goldMat    = stdMat("goldMat",    0.82, 0.67, 0.10, 0.22, 0.14, 0.00);
  const tealMat    = stdMat("tealMat",    0.10, 0.75, 0.65, 0.02, 0.28, 0.22);
  const crystalMat = stdMat("crystalMat", 0.45, 0.10, 0.80, 0.20, 0.02, 0.48);

  // Tiled floor for assembly room
  function _makeTiledFloor(name) {
    const mat = new BABYLON.StandardMaterial(name, scene);
    try {
      const dt = new BABYLON.DynamicTexture(name + "_dt", { width: 256, height: 256 }, scene, false);
      const ctx = dt.getContext();
      ctx.fillStyle = "#1a0a30";
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = "#2a1848";
      ctx.lineWidth = 2;
      for (let i = 0; i <= 256; i += 64) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
      }
      dt.update();
      mat.diffuseTexture        = dt;
      mat.diffuseTexture.uScale = ROOM_WIDTH  / 2.5;
      mat.diffuseTexture.vScale = ROOM_LENGTH / 2.5;
    } catch(e) {
      mat.diffuseColor = new BABYLON.Color3(0.12, 0.06, 0.20);
    }
    return mat;
  }
  const tiledFloorMat = _makeTiledFloor("tiledFloor");

  // ── Build rooms ─────────────────────────────────────────────────────────────
  for (let r = 0; r < NUM_ROOMS; r++) _buildRoom(r);

  function _buildRoom(r) {
    const baseZ = r * ROOM_LENGTH;
    const midZ  = baseZ + ROOM_LENGTH / 2;
    const hw    = ROOM_WIDTH / 2;
    const cy    = ROOM_HEIGHT / 2;

    // Floor
    const fl = BABYLON.MeshBuilder.CreateBox(`fl_${r}`,
      { width: ROOM_WIDTH, height: 0.4, depth: ROOM_LENGTH }, scene);
    fl.position.set(0, -0.2, midZ);
    fl.material = (r === 0) ? tiledFloorMat : floorMat;

    // Ceiling
    const cl = BABYLON.MeshBuilder.CreateBox(`cl_${r}`,
      { width: ROOM_WIDTH, height: 0.3, depth: ROOM_LENGTH }, scene);
    cl.position.set(0, ROOM_HEIGHT, midZ);
    cl.material = ceilMat;

    // Left wall
    const lw = BABYLON.MeshBuilder.CreateBox(`lw_${r}`,
      { width: 0.4, height: ROOM_HEIGHT, depth: ROOM_LENGTH }, scene);
    lw.position.set(-hw - 0.2, cy, midZ);
    lw.material = wallMat;

    // Right wall
    const rw = BABYLON.MeshBuilder.CreateBox(`rw_${r}`,
      { width: 0.4, height: ROOM_HEIGHT, depth: ROOM_LENGTH }, scene);
    rw.position.set(hw + 0.2, cy, midZ);
    rw.material = wallMat;

    // Back wall (room 0 only — entrance side)
    if (r === 0) {
      const bk = BABYLON.MeshBuilder.CreateBox("bkwall",
        { width: ROOM_WIDTH, height: ROOM_HEIGHT, depth: 0.4 }, scene);
      bk.position.set(0, cy, baseZ - 0.2);
      bk.material = wallMat;
    }

    // Front wall: door opening for rooms 0-2, solid wall for last room
    if (r < NUM_ROOMS - 1) {
      _buildDoorWall(r, baseZ + ROOM_LENGTH);
    } else {
      const fw = BABYLON.MeshBuilder.CreateBox(`fw_${r}`,
        { width: ROOM_WIDTH, height: ROOM_HEIGHT, depth: 0.4 }, scene);
      fw.position.set(0, cy, baseZ + ROOM_LENGTH + 0.2);
      fw.material = wallMat;
    }

    // Room-specific content
    if (r === 0) {
      _buildAssemblyHall(baseZ);
    } else {
      _buildLetterRoom(r, baseZ);
    }

    // Torches on both walls
    _buildWallTorch(-hw, baseZ + ROOM_LENGTH * 0.30, r);
    _buildWallTorch( hw, baseZ + ROOM_LENGTH * 0.30, r);
    _buildWallTorch(-hw, baseZ + ROOM_LENGTH * 0.70, r);
    _buildWallTorch( hw, baseZ + ROOM_LENGTH * 0.70, r);
  }

  // ── Door wall (wall with a central opening) ─────────────────────────────────
  function _buildDoorWall(r, wallZ) {
    const hw    = ROOM_WIDTH / 2;
    const doorW = 5.0;
    const doorH = 5.5;
    const sideW = (ROOM_WIDTH - doorW) / 2;  // 10

    // Left and right panels
    const lp = BABYLON.MeshBuilder.CreateBox(`dwL_${r}`,
      { width: sideW, height: ROOM_HEIGHT, depth: 0.4 }, scene);
    lp.position.set(-hw + sideW / 2, ROOM_HEIGHT / 2, wallZ);
    lp.material = wallMat;

    const rp = BABYLON.MeshBuilder.CreateBox(`dwR_${r}`,
      { width: sideW, height: ROOM_HEIGHT, depth: 0.4 }, scene);
    rp.position.set(hw - sideW / 2, ROOM_HEIGHT / 2, wallZ);
    rp.material = wallMat;

    // Top lintel (above door)
    const lintelH = ROOM_HEIGHT - doorH;
    const tp = BABYLON.MeshBuilder.CreateBox(`dwT_${r}`,
      { width: doorW, height: lintelH, depth: 0.4 }, scene);
    tp.position.set(0, doorH + lintelH / 2, wallZ);
    tp.material = wallMat;

    // Glowing archway frame
    for (const sx of [-doorW / 2, doorW / 2]) {
      const fp = BABYLON.MeshBuilder.CreateBox(`dfr_${r}_${sx > 0 ? "R" : "L"}`,
        { width: 0.4, height: doorH, depth: 0.6 }, scene);
      fp.position.set(sx, doorH / 2, wallZ);
      fp.material = stoneMat;
    }

    // Glowing arch top — teal emissive strip as visual invitation
    const arch = BABYLON.MeshBuilder.CreateBox(`darch_${r}`,
      { width: doorW + 0.4, height: 0.25, depth: 0.5 }, scene);
    arch.position.set(0, doorH + 0.12, wallZ);
    const archMat = new BABYLON.StandardMaterial(`darchMat_${r}`, scene);
    archMat.diffuseColor  = new BABYLON.Color3(0.10, 0.80, 0.65);
    archMat.emissiveColor = new BABYLON.Color3(0.03, 0.45, 0.35);
    arch.material = archMat;

    // Arch light
    const al = new BABYLON.PointLight(`darchL_${r}`,
      new BABYLON.Vector3(0, doorH + 0.3, wallZ - 0.5), scene);
    al.diffuse    = new BABYLON.Color3(0.20, 1.0, 0.80);
    al.intensity  = 1.2;
    al.range      = 8;

    // Direction sign above arch
    _buildDoorSign(r, wallZ, doorH);
  }

  // ── Sign above each doorway ──────────────────────────────────────────────────
  function _buildDoorSign(r, wallZ, doorH) {
    const board = BABYLON.MeshBuilder.CreateBox(`dsign_${r}`,
      { width: 3.2, height: 0.9, depth: 0.1 }, scene);
    board.position.set(0, doorH + 0.8, wallZ - 0.5);
    try {
      const roomNum = r + 1;
      const dt = new BABYLON.DynamicTexture(`dsigntex_${r}`, { width: 400, height: 112 }, scene, false);
      const ctx = dt.getContext();
      ctx.fillStyle = "#0e0428";
      ctx.fillRect(0, 0, 400, 112);
      ctx.fillStyle = "#60ffcc";
      ctx.font = "bold 30px Arial";
      ctx.textAlign = "center";
      ctx.fillText(`Room ${roomNum} ➜`, 200, 42);
      ctx.fillStyle = "#c090ff";
      ctx.font = "22px Arial";
      ctx.fillText("Find the hidden letters!", 200, 80);
      dt.update();
      dt.uScale = -1;
      const sm = new BABYLON.StandardMaterial(`dsignmat_${r}`, scene);
      sm.diffuseTexture  = dt;
      sm.emissiveTexture = dt;
      board.material = sm;
    } catch(e) {
      board.material = crystalMat;
    }
  }

  // ── Assembly Hall (Room 0) ───────────────────────────────────────────────────
  let assemblyBoxMesh = null;
  const ASSEMBLY_Z    = ROOM_LENGTH * 0.60;   // 13.2 — middle of room 0
  const ASSEMBLY_POS  = new BABYLON.Vector3(0, 0, ASSEMBLY_Z);

  function _buildAssemblyHall(baseZ) {
    // Welcome sign near entrance
    const wsign = BABYLON.MeshBuilder.CreateBox("wsign",
      { width: 5.5, height: 1.2, depth: 0.12 }, scene);
    wsign.position.set(0, 4.8, baseZ + ROOM_LENGTH * 0.20);
    try {
      const dt = new BABYLON.DynamicTexture("wsignTex", { width: 512, height: 112 }, scene, false);
      const ctx = dt.getContext();
      ctx.fillStyle = "#100420";
      ctx.fillRect(0, 0, 512, 112);
      ctx.fillStyle = "#ffcc00";
      ctx.font = "bold 34px Arial";
      ctx.textAlign = "center";
      ctx.fillText("🔤  LETTERS CASTLE", 256, 44);
      ctx.fillStyle = "#cc99ff";
      ctx.font = "21px Arial";
      ctx.fillText("Hint: " + HINT_TEXT, 256, 84);
      dt.update();
      dt.uScale = -1;
      const sm = new BABYLON.StandardMaterial("wsignMat", scene);
      sm.diffuseTexture  = dt;
      sm.emissiveTexture = dt;
      wsign.material = sm;
    } catch(e) {
      wsign.material = goldMat;
    }

    // Assembly pedestal
    const ped = BABYLON.MeshBuilder.CreateBox("asmPed",
      { width: 4.2, height: 0.4, depth: 1.6 }, scene);
    ped.position.set(0, 0.2, ASSEMBLY_Z);
    ped.material = stoneMat;

    // Assembly box on pedestal
    assemblyBoxMesh = BABYLON.MeshBuilder.CreateBox("asmBox",
      { width: 3.8, height: 0.75, depth: 1.2 }, scene);
    assemblyBoxMesh.position.set(0, 0.77, ASSEMBLY_Z);
    try {
      const dt = new BABYLON.DynamicTexture("asmTex", { width: 512, height: 128 }, scene, false);
      const ctx = dt.getContext();
      ctx.fillStyle = "#081420";
      ctx.fillRect(0, 0, 512, 128);
      ctx.fillStyle = "#30ffcc";
      ctx.font = "bold 30px Arial";
      ctx.textAlign = "center";
      ctx.fillText("✦  ASSEMBLY BOX  ✦", 256, 48);
      ctx.fillStyle = "#80eecc";
      ctx.font = "20px Arial";
      ctx.fillText("Collect all 6 letters, then return here", 256, 88);
      dt.update();
      dt.uScale = -1;
      const bm = new BABYLON.StandardMaterial("asmBoxMat", scene);
      bm.diffuseTexture  = dt;
      bm.emissiveTexture = dt;
      assemblyBoxMesh.material = bm;
    } catch(e) {
      assemblyBoxMesh.material = tealMat;
    }

    // Glowing torus ring around the box
    const ring = BABYLON.MeshBuilder.CreateTorus("asmRing",
      { diameter: 3.0, thickness: 0.09, tessellation: 32 }, scene);
    ring.position.set(0, 0.28, ASSEMBLY_Z);
    ring.rotation.x = Math.PI / 2;
    const rm = new BABYLON.StandardMaterial("asmRingMat", scene);
    rm.diffuseColor  = new BABYLON.Color3(0.10, 0.90, 0.70);
    rm.emissiveColor = new BABYLON.Color3(0.03, 0.50, 0.38);
    ring.material = rm;

    // Assembly light
    const al = new BABYLON.PointLight("asmL",
      new BABYLON.Vector3(0, 2.0, ASSEMBLY_Z), scene);
    al.diffuse    = new BABYLON.Color3(0.20, 1.0, 0.80);
    al.intensity  = 2.0;
    al.range      = 10;
  }

  // ── Letter Room (Rooms 1–3) ─────────────────────────────────────────────────
  function _buildLetterRoom(r, baseZ) {
    const idxA = (r - 1) * 2;        // letter indices 0, 2, 4
    const idxB = (r - 1) * 2 + 1;    // letter indices 1, 3, 5
    const midZ = baseZ + ROOM_LENGTH / 2;

    // Room label on the back wall
    _buildRoomLabel(r, baseZ);

    // Two letter tiles, centered on the walking path, staggered in depth
    const tilePositions = [
      new BABYLON.Vector3(0, 1.5, midZ - 4),
      new BABYLON.Vector3(0, 1.5, midZ + 4),
    ];

    if (idxA < TARGET_LETTERS.length) _buildLetterTile(TARGET_LETTERS[idxA], idxA, tilePositions[0]);
    if (idxB < TARGET_LETTERS.length) _buildLetterTile(TARGET_LETTERS[idxB], idxB, tilePositions[1]);

    // Crystal accent pillars flanking the tiles (near walls)
    _buildCrystalPillar(-9, midZ - 5);
    _buildCrystalPillar( 9, midZ - 5);
    _buildCrystalPillar(-9, midZ + 5);
    _buildCrystalPillar( 9, midZ + 5);
  }

  // ── Room number label on back wall ──────────────────────────────────────────
  function _buildRoomLabel(r, baseZ) {
    const board = BABYLON.MeshBuilder.CreateBox(`rlabel_${r}`,
      { width: 3.5, height: 1.0, depth: 0.10 }, scene);
    // Faces the player coming in from room 0 direction (at higher z, facing back = -z)
    board.position.set(0, 4.5, baseZ + 0.25);
    try {
      const dt = new BABYLON.DynamicTexture(`rlabeltex_${r}`, { width: 400, height: 112 }, scene, false);
      const ctx = dt.getContext();
      ctx.fillStyle = "#0c0820";
      ctx.fillRect(0, 0, 400, 112);
      ctx.fillStyle = "#ff9020";
      ctx.font = "bold 36px Arial";
      ctx.textAlign = "center";
      ctx.fillText(`Room ${r}  🔤`, 200, 46);
      ctx.fillStyle = "#ffcc88";
      ctx.font = "20px Arial";
      const letters = TARGET_LETTERS.slice((r - 1) * 2, (r - 1) * 2 + 2);
      ctx.fillText(`Find letters: ?  ?`, 200, 82);
      dt.update();
      dt.uScale = -1;
      const sm = new BABYLON.StandardMaterial(`rlabelmat_${r}`, scene);
      sm.diffuseTexture  = dt;
      sm.emissiveTexture = dt;
      board.material = sm;
    } catch(e) {
      board.material = goldMat;
    }
  }

  // ── HSV helper ──────────────────────────────────────────────────────────────
  function _hsvToColor3(h, s, v) {
    const i = Math.floor(h / 60) % 6;
    const f = h / 60 - Math.floor(h / 60);
    const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    const rows = [[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]];
    const [r, g, b] = rows[i];
    return new BABYLON.Color3(r, g, b);
  }

  // ── Letter tile ─────────────────────────────────────────────────────────────
  function _buildLetterTile(letter, index, pos) {
    const root = new BABYLON.TransformNode(`ltRoot_${index}`, scene);
    root.position.copyFrom(pos);

    // Large flat tile
    const tile = BABYLON.MeshBuilder.CreateBox(`lt_${index}`,
      { width: 1.2, height: 1.2, depth: 0.15 }, scene);
    tile.parent = root;

    try {
      const dt = new BABYLON.DynamicTexture(`ltTex_${index}`, { width: 128, height: 128 }, scene, false);
      const ctx = dt.getContext();
      const hue = (index / 6) * 360;
      ctx.fillStyle = `hsl(${hue}, 65%, 18%)`;
      ctx.fillRect(0, 0, 128, 128);
      ctx.strokeStyle = `hsl(${hue}, 90%, 65%)`;
      ctx.lineWidth = 5;
      ctx.strokeRect(5, 5, 118, 118);
      ctx.fillStyle = `hsl(${hue}, 85%, 88%)`;
      ctx.font = "bold 88px Arial";
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(letter, 64, 68);
      dt.update();
      const tm = new BABYLON.StandardMaterial(`ltMat_${index}`, scene);
      tm.diffuseTexture  = dt;
      tm.emissiveTexture = dt;
      tile.material = tm;
    } catch(e) {
      const tm = new BABYLON.StandardMaterial(`ltMatFb_${index}`, scene);
      tm.diffuseColor  = new BABYLON.Color3(0.30, 0.55, 1.0);
      tm.emissiveColor = new BABYLON.Color3(0.10, 0.18, 0.50);
      tile.material = tm;
    }

    // Glow ring
    const ring = BABYLON.MeshBuilder.CreateTorus(`ltRing_${index}`,
      { diameter: 1.4, thickness: 0.07, tessellation: 24 }, scene);
    ring.parent   = root;
    ring.rotation.x = Math.PI / 2;

    const c = _hsvToColor3((index / 6) * 360, 0.8, 0.9);
    const rm = new BABYLON.StandardMaterial(`ltRingMat_${index}`, scene);
    rm.diffuseColor  = c;
    rm.emissiveColor = new BABYLON.Color3(c.r * 0.5, c.g * 0.5, c.b * 0.5);
    ring.material = rm;

    // Point light (small range so it doesn't eat the light budget)
    const pl = new BABYLON.PointLight(`ltL_${index}`, BABYLON.Vector3.Zero(), scene);
    pl.parent    = root;
    pl.diffuse   = c;
    pl.intensity = 1.2;
    pl.range     = 6;

    letterTiles.push({
      root, letter, index, collected: false,
      _t: Math.random() * Math.PI * 2,
      update() {
        if (this.collected) return;
        this._t += 0.025;
        this.root.position.y = pos.y + Math.sin(this._t) * 0.22;
        this.root.rotation.y += 0.020;
      }
    });
  }

  // ── Crystal accent pillar ────────────────────────────────────────────────────
  function _buildCrystalPillar(x, z) {
    const base = BABYLON.MeshBuilder.CreateBox(`cpb_${x}_${z}`,
      { width: 0.5, height: 0.3, depth: 0.5 }, scene);
    base.position.set(x, 0.15, z);
    base.material = stoneMat;

    const spire = BABYLON.MeshBuilder.CreateCylinder(`cps_${x}_${z}`,
      { diameterTop: 0, diameterBottom: 0.28, height: 0.7, tessellation: 6 }, scene);
    spire.position.set(x, 0.65, z);
    spire.material = crystalMat;

    const cl = new BABYLON.PointLight(`cpl_${x}_${z}`,
      new BABYLON.Vector3(x, 1.0, z), scene);
    cl.diffuse    = new BABYLON.Color3(0.50, 0.10, 1.0);
    cl.intensity  = 0.6;
    cl.range      = 5;
  }

  // ── Wall torch ───────────────────────────────────────────────────────────────
  const torchLights = [];

  function _buildWallTorch(wallX, z, r) {
    // Bracket stub (inset 0.5 from wall)
    const sx = wallX > 0 ? wallX - 0.5 : wallX + 0.5;
    const holder = BABYLON.MeshBuilder.CreateBox(`thold_${r}_${wallX}_${z}`,
      { width: 0.12, height: 0.5, depth: 0.12 }, scene);
    holder.position.set(sx, 3.2, z);
    holder.material = stoneMat;

    const flame = BABYLON.MeshBuilder.CreateCylinder(`tflm_${r}_${wallX}_${z}`,
      { diameterTop: 0, diameterBottom: 0.20, height: 0.40, tessellation: 6 }, scene);
    flame.position.set(sx, 3.65, z);
    const fm = new BABYLON.StandardMaterial(`tfm_${r}_${wallX}_${z}`, scene);
    fm.diffuseColor  = new BABYLON.Color3(0.50, 0.08, 0.90);
    fm.emissiveColor = new BABYLON.Color3(0.30, 0.04, 0.60);
    flame.material = fm;

    const tl = new BABYLON.PointLight(`tl_${r}_${wallX}_${z}`,
      new BABYLON.Vector3(sx, 3.8, z), scene);
    tl.diffuse    = new BABYLON.Color3(0.65, 0.35, 1.0);
    tl.intensity  = 1.8;
    tl.range      = 12;
    torchLights.push({ light: tl, baseI: 1.8, offset: Math.random() * Math.PI * 2 });
  }

  // ── Player ───────────────────────────────────────────────────────────────────
  const player = createPlayer(scene);
  player.mesh.position.set(0, 0.5, 2);
  player.camera.radius           = DESIRED_RADIUS;
  player.camera.lowerRadiusLimit = 3;
  player.camera.upperRadiusLimit = 22;

  // ── HUD ──────────────────────────────────────────────────────────────────────
  const hudLocation = document.getElementById("hud-location");
  const hudStars    = document.getElementById("hud-stars");
  function _updateHUD() {
    if (hudLocation) hudLocation.textContent = `🔤 Letters Castle – Room ${currentRoom + 1}`;
    if (hudStars)    hudStars.textContent     = `📜 ${collectedLetters.length} / 6`;
  }
  _updateHUD();

  // ── Overlay helpers ──────────────────────────────────────────────────────────
  const overlay = document.getElementById("ui-overlay");
  function _clearOverlay() {
    overlay.innerHTML = "";
    overlay.classList.remove("active");
  }

  // ── Assembly UI ──────────────────────────────────────────────────────────────
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

    const display  = document.createElement("div");
    display.className = "sentence-builder";
    panel.appendChild(display);

    const tileArea = document.createElement("div");
    tileArea.className = "word-tiles";

    // selected = [{ltr, btn}] to track which button each selection came from
    const selected = [];

    function _refresh() {
      display.innerHTML = "";
      selected.forEach((item, i) => {
        const w = document.createElement("span");
        w.className  = "sentence-word";
        w.textContent = item.ltr;
        w.onclick = () => {
          item.btn.disabled = false;
          item.btn.classList.remove("used");
          selected.splice(i, 1);
          _refresh();
        };
        display.appendChild(w);
      });

      if (selected.length === TARGET_LETTERS.length) {
        const attempt = selected.map(x => x.ltr).join("");
        if (attempt === TARGET_WORD) {
          _onWordCorrect();
        } else {
          feedback.className  = "feedback wrong";
          feedback.textContent = "❌ Not quite — try again!";
          selected.forEach(item => {
            item.btn.disabled = false;
            item.btn.classList.remove("used");
          });
          selected.length = 0;
          _refresh();
        }
      }
    }

    const shuffled = collectedLetters.slice().sort(() => Math.random() - 0.5);
    shuffled.forEach(ltr => {
      const btn = document.createElement("button");
      btn.className  = "btn btn-word";
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

    const feedback = document.createElement("div");
    feedback.className = "feedback";
    panel.appendChild(feedback);

    const closeBtn = document.createElement("button");
    closeBtn.className  = "btn btn-primary";
    closeBtn.style.background = "#555";
    closeBtn.textContent = "Close";
    closeBtn.onclick = () => { _clearOverlay(); assemblyOpen = false; };
    panel.appendChild(closeBtn);

    overlay.appendChild(panel);
  }

  // ── Word correct ─────────────────────────────────────────────────────────────
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
      <div class="victory-sub">${HINT_TEXT}</div><br>
    `;

    const exitBtn = document.createElement("button");
    exitBtn.className  = "btn btn-primary";
    exitBtn.textContent = "🏠 Return to World Map";
    exitBtn.onclick = () => { _clearOverlay(); if (typeof onExit === "function") onExit(); };
    panel.appendChild(exitBtn);
    overlay.appendChild(panel);
  }

  // ── Confetti ─────────────────────────────────────────────────────────────────
  function _spawnConfetti() {
    const wrap = document.createElement("div");
    wrap.className = "confetti-wrap";
    document.body.appendChild(wrap);
    const colors = ["#ff0","#f0f","#0ff","#0f0","#f80","#88f"];
    for (let i = 0; i < 60; i++) {
      const p = document.createElement("div");
      p.className = "confetti-piece";
      p.style.left             = Math.random() * 100 + "vw";
      p.style.background       = colors[i % colors.length];
      p.style.animationDuration = (1.5 + Math.random() * 2) + "s";
      p.style.animationDelay   = (Math.random() * 1) + "s";
      wrap.appendChild(p);
    }
    setTimeout(() => { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }, 4000);
  }

  // ── Collect banner ───────────────────────────────────────────────────────────
  function _showCollectBanner(letter) {
    const b = document.createElement("div");
    b.className  = "room-banner";
    b.textContent = `✨ Collected letter: ${letter}  (${collectedLetters.length}/6)`;
    document.body.appendChild(b);
    setTimeout(() => { if (b.parentNode) b.parentNode.removeChild(b); }, 2500);
  }

  // ── Render loop ──────────────────────────────────────────────────────────────
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
        t.light.intensity = t.baseI
          + 0.50 * Math.sin(time * 2.9 + t.offset)
          + 0.20 * Math.sin(time * 7.3 + t.offset);
      }

      // Letter tile float + collection
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

      // Assembly box trigger (all 6 letters + close to box)
      if (!assemblyOpen && collectedLetters.length === 6) {
        const asmDist = BABYLON.Vector3.Distance(
          new BABYLON.Vector3(px, py, pz),
          ASSEMBLY_POS
        );
        if (asmDist < 5.0) _showAssemblyUI();
      }

      // Room number (floor division by room length)
      currentRoom = Math.max(0, Math.min(NUM_ROOMS - 1, Math.floor(pz / ROOM_LENGTH)));
      _updateHUD();

      // Camera radius — prevent clipping through walls
      const roomBaseZ = currentRoom * ROOM_LENGTH;
      const hw        = ROOM_WIDTH / 2;
      const dBack     = Math.max(0.5, pz - roomBaseZ);
      const dFront    = Math.max(0.5, roomBaseZ + ROOM_LENGTH - pz);
      const dLeft     = Math.max(0.5, px + hw);
      const dRight    = Math.max(0.5, hw - px);
      const safe = Math.min(DESIRED_RADIUS, dBack * 0.85, dFront * 0.85, dLeft * 0.85, dRight * 0.85);
      const clampedR  = Math.max(3.5, safe);
      player.camera.radius = BABYLON.Scalar.Lerp(player.camera.radius, clampedR, 0.15);
      player.camera.upperRadiusLimit = clampedR + 0.5;

      // Exit (walk back through entrance)
      if (pz < -1.5 && typeof onExit === "function") onExit();

    } catch(err) {
      console.error("LettersCastle render error:", err);
    }
  });

  return scene;
}
