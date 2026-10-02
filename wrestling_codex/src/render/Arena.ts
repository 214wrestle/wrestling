import { ArcRotateCamera, Color3, Color4, DefaultRenderingPipeline, DirectionalLight, DynamicTexture, Engine, HemisphericLight, Mesh, MeshBuilder, Scene, ShadowGenerator, StandardMaterial, Vector3 } from './babylon';
import { material, box, canvasMaterial, panel } from './materials';
import { WrestlerView } from './Wrestler';
import { clockText, type MatchState, type MatchSettings } from '../game/types';

export class Arena {
  readonly engine: Engine;
  readonly scene: Scene;
  readonly camera: ArcRotateCamera;
  private athletes: [WrestlerView, WrestlerView];
  private referee: WrestlerView;
  private shadowGenerator: ShadowGenerator;
  private scoreTexture!: DynamicTexture;
  private lastScore = '';
  private time = 0;
  private mode = 0;
  private desiredAlpha = -Math.PI / 2;
  private hit = 0;
  private pulseRing: Mesh;
  private ringMat: StandardMaterial;
  private confetti: { mesh: Mesh; velocity: Vector3; spin: number }[] = [];
  private winnerShown = false;
  private resizeObserver: ResizeObserver;
  private pipeline: DefaultRenderingPipeline;

  constructor(canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, powerPreference: 'high-performance', audioEngine: false });
    this.engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 1.5));
    const scene = this.scene = new Scene(this.engine);
    scene.clearColor = new Color4(0.12, 0.17, 0.16, 1);
    scene.ambientColor = new Color3(0.16, 0.18, 0.17);
    scene.fogMode = Scene.FOGMODE_EXP2; scene.fogDensity = 0.017; scene.fogColor = new Color3(0.18, 0.22, 0.2);
    this.camera = new ArcRotateCamera('broadcast', -1.0, 1.09, 13.4, new Vector3(-1.8, 0.55, 0), scene);
    this.camera.fov = 0.65; this.camera.minZ = 0.1; this.camera.maxZ = 90;
    this.camera.lowerRadiusLimit = 6; this.camera.upperRadiusLimit = 22;
    const ambient = new HemisphericLight('roof-bounce', new Vector3(0, 1, 0), scene);
    ambient.intensity = 0.72; ambient.diffuse = Color3.FromHexString('#e4ecdf'); ambient.groundColor = Color3.FromHexString('#72654e');
    const key = new DirectionalLight('afternoon-light', new Vector3(-0.42, -1, 0.38), scene);
    key.position.set(5, 11, -4); key.intensity = 1.24; key.diffuse = Color3.FromHexString('#fff1d8');
    key.shadowMinZ = 1; key.shadowMaxZ = 32; key.autoCalcShadowZBounds = false;
    const fill = new DirectionalLight('cool-rim', new Vector3(0.7, -0.5, -0.7), scene);
    fill.intensity = 0.55; fill.diffuse = Color3.FromHexString('#c5e5ee');
    this.shadowGenerator = new ShadowGenerator(2048, key);
    this.shadowGenerator.useBlurExponentialShadowMap = true;
    this.shadowGenerator.blurKernel = 28; this.shadowGenerator.depthScale = 60; this.shadowGenerator.bias = 0.0002;
    this.shadowGenerator.normalBias = 0.018; this.shadowGenerator.setDarkness(0.26);
    this.environment();
    this.athletes = [new WrestlerView(scene, 0, this.shadowGenerator), new WrestlerView(scene, 1, this.shadowGenerator)];
    this.referee = new WrestlerView(scene, 0, this.shadowGenerator, true);
    this.pipeline = new DefaultRenderingPipeline('broadcast-grade', true, scene, [this.camera]);
    this.pipeline.samples = 4; this.pipeline.fxaaEnabled = true;
    this.pipeline.bloomEnabled = true; this.pipeline.bloomThreshold = 1.4; this.pipeline.bloomWeight = 0.12; this.pipeline.bloomKernel = 48; this.pipeline.bloomScale = 0.35;
    this.pipeline.imageProcessingEnabled = true;
    this.pipeline.imageProcessing.exposure = 1.02; this.pipeline.imageProcessing.contrast = 1.14;
    this.pipeline.imageProcessing.vignetteEnabled = true; this.pipeline.imageProcessing.vignetteWeight = 1.25;
    this.pipeline.imageProcessing.vignetteColor = new Color4(0.05, 0.07, 0.06, 0);
    this.pulseRing = MeshBuilder.CreateTorus('engagement', { diameter: 1.02, thickness: 0.016, tessellation: 64 }, scene);
    this.pulseRing.position.y = 0.16;
    this.ringMat = material(scene, 'player-ring', '#e8c477'); this.ringMat.emissiveColor = Color3.FromHexString('#b08c36'); this.ringMat.alpha = 0.55; this.pulseRing.material = this.ringMat;
    this.resizeObserver = new ResizeObserver(() => this.engine.resize()); this.resizeObserver.observe(canvas);
    window.addEventListener('resize', this.resize);
  }
  private resize = () => this.engine.resize();
  quality(level: MatchSettings['quality']) {
    this.engine.setHardwareScalingLevel(level === 'balanced' ? 1.25 : 1 / Math.min(devicePixelRatio || 1, 1.5));
    this.pipeline.samples = level === 'balanced' ? 1 : 4; this.pipeline.bloomEnabled = level === 'high';
    this.shadowGenerator.getShadowMap()!.refreshRate = level === 'balanced' ? 2 : 1;
  }
  cycleCamera() { this.mode = (this.mode + 1) % 3; }
  rotate(delta: number) { this.desiredAlpha += delta; }
  impact(amount = 0.07) { this.hit = amount; }
  private environment() {
    const s = this.scene;
    const steel = material(s, 'roof-steel', '#22342f', 0.3), wall = material(s, 'plaster', '#c3c1a7', 0.02), wood = material(s, 'bleacher-wood', '#886746', 0.12), padded = material(s, 'wall-padding', '#194535', 0.06), cream = material(s, 'warm-ivory', '#dbd8bf', 0.12), gold = material(s, 'school-gold', '#c0a468', 0.16), dark = material(s, 'scoreboard-case', '#11211c');
    const floorMat = canvasMaterial(s, 'maple-floor', 2048, 2048, c => {
      let seed = 87; const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
      c.fillStyle = '#b39361'; c.fillRect(0, 0, 2048, 2048);
      for (let row = 0; row < 80; row++) {
        for (let col = -1; col < 10; col++) {
          const x = col * 260 + (row % 3) * 86, y = row * 26, l = 55 + rand() * 15;
          c.fillStyle = `hsl(35,${32 + rand() * 15}%,${l}%)`; c.fillRect(x, y, 259, 25);
          for (let g = 0; g < 4; g++) { c.strokeStyle = `rgba(75,49,22,${0.03 + rand() * 0.06})`; c.beginPath(); c.moveTo(x, y + 3 + g * 6); c.bezierCurveTo(x + 80, y + g * 6, x + 140, y + 10 + g * 4, x + 260, y + 4 + g * 6); c.stroke(); }
        }
      }
      c.strokeStyle = 'rgba(247,233,183,.8)'; c.lineWidth = 7; c.strokeRect(190, 120, 1668, 1808);
      c.strokeStyle = '#38513a'; c.lineWidth = 5; c.beginPath(); c.arc(1024, 1024, 350, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(190, 1024); c.lineTo(1858, 1024); c.stroke();
      for (const y of [120, 1928]) { c.beginPath(); c.arc(1024, y, 550, 0, Math.PI * 2); c.stroke(); }
    });
    floorMat.specularColor.set(0.22, 0.19, 0.15); floorMat.specularPower = 85;
    box(s, 'gym-floor', 34, 0.18, 28, new Vector3(0, -0.1, 0), floorMat);
    const mat = canvasMaterial(s, 'competition-mat', 2048, 2048, c => {
      const scale = 2048 / 12;
      c.fillStyle = '#1b493e'; c.fillRect(0, 0, 2048, 2048);
      c.fillStyle = '#c6c4a5'; c.beginPath(); c.arc(1024, 1024, 4.57 * scale, 0, Math.PI * 2); c.fill();
      c.lineWidth = 14; c.strokeStyle = '#e7d290'; c.stroke();
      c.strokeStyle = '#759381'; c.lineWidth = 2; c.beginPath(); c.arc(1024, 1024, 5.45 * scale, 0, Math.PI * 2); c.stroke();
      c.save(); c.translate(1024, 1024);
      c.fillStyle = 'rgba(27,73,62,.14)'; c.font = 'bold 660px Georgia'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('N', 0, 0);
      c.fillStyle = '#1b493e'; c.font = 'bold 25px Arial'; c.fillText('NORTHWOOD UNIVERSITY', 0, -480);
      c.font = '18px Arial'; c.fillText('EST. 1896   /   HOME OF THE TIMBERWOLVES', 0, -440);
      c.fillStyle = 'rgba(27,73,62,.5)'; c.font = 'bold 17px Arial'; c.fillText('WORK. BELIEVE. PREVAIL.', 0, 480);
      c.restore();
      c.strokeStyle = '#f4ead2'; c.lineWidth = 6; c.strokeRect(1024 - 1.52 * scale, 1024 - 0.305 * scale, 3.04 * scale, 0.61 * scale);
      c.fillStyle = '#a74e43'; c.fillRect(1024 - 0.45 * scale, 1024 - 0.31 * scale, 0.9 * scale, 10);
      c.fillStyle = '#2e7851'; c.fillRect(1024 - 0.45 * scale, 1024 + 0.25 * scale, 0.9 * scale, 10);
      for (let i = 0; i < 4; i++) { c.save(); c.translate(1024, 1024); c.rotate(i * Math.PI / 2); c.fillStyle = '#e4d9b5'; c.textAlign = 'center'; c.font = 'bold 40px Arial'; c.fillText(i % 2 ? 'TIMBERWOLVES' : 'N O R T H W O O D', 0, -940); c.restore(); }
      // Fine, repeatable vinyl grain avoids a flat plastic look.
      for (let i = 0; i < 18000; i++) { const x = (i * 1597) % 2048, y = (i * 3137) % 2048; c.fillStyle = i % 2 ? 'rgba(255,255,255,.025)' : 'rgba(0,0,0,.025)'; c.fillRect(x, y, 2, 2); }
    });
    mat.specularColor.set(0.1, 0.12, 0.1); mat.specularPower = 35;
    box(s, 'mat-base', 12.1, 0.1, 12.1, new Vector3(0, 0.03, 0), padded);
    const surface = MeshBuilder.CreateGround('mat-surface', { width: 12, height: 12 }, s); surface.position.y = 0.136; surface.material = mat; surface.receiveShadows = true;
    // A college fieldhouse: masonry, protective wall pads, exposed steel and windows.
    box(s, 'back-wall', 34, 11, 0.35, new Vector3(0, 5.4, 13), wall);
    box(s, 'left-wall', 0.35, 11, 28, new Vector3(-17, 5.4, 0), wall);
    box(s, 'right-wall', 0.35, 11, 28, new Vector3(17, 5.4, 0), wall);
    box(s, 'ceiling', 34, 0.2, 28, new Vector3(0, 11, 0), material(s, 'ceiling-paint', '#777f70', 0));
    for (let i = -16; i <= 16; i += 1.33) box(s, 'back-wall-pad', 1.28, 2.45, 0.16, new Vector3(i, 1.2, 12.75), padded);
    const windowMat = material(s, 'blue-glass', '#b7cdc5', 0.5); windowMat.emissiveColor = new Color3(0.18, 0.24, 0.22);
    for (let x = -14; x <= 14; x += 4) {
      box(s, 'window-frame', 3.5, 2.1, 0.18, new Vector3(x, 8.5, 12.76), steel);
      for (const a of [-0.8, 0.8]) for (const y of [-0.44, 0.44]) box(s, 'window-pane', 1.45, 0.79, 0.09, new Vector3(x + a, 8.5 + y, 12.64), windowMat);
    }
    for (let z = -10; z <= 10; z += 5) {
      box(s, 'roof-truss', 33.5, 0.16, 0.16, new Vector3(0, 9.5, z), steel);
      box(s, 'roof-truss-upper', 33.5, 0.14, 0.14, new Vector3(0, 10.4, z), steel);
      for (let x = -15; x < 16; x += 3) { const beam = box(s, 'truss-brace', 0.085, 3.05, 0.085, new Vector3(x, 9.95, z), steel); beam.rotation.z = Math.PI / 2 - (Math.floor(x) % 2 ? 0.3 : -0.3); }
      for (const x of [-7, 7]) {
        box(s, 'light-cable', 0.035, 0.9, 0.035, new Vector3(x, 9.1, z), steel);
        const shade = MeshBuilder.CreateCylinder('pendant-light', { height: 0.34, diameterTop: 0.24, diameterBottom: 0.85, tessellation: 24 }, s); shade.position.set(x, 8.6, z); shade.material = steel;
        const lit = material(s, `light-${x}-${z}`, '#fff1ce'); lit.emissiveColor = new Color3(1.2, 1.1, 0.9);
        const bulb = MeshBuilder.CreateCylinder('light-diffuser', { height: 0.035, diameter: 0.76, tessellation: 24 }, s); bulb.position.set(x, 8.42, z); bulb.material = lit;
      }
    }
    // Pennants flank the main scoreboard.
    for (const x of [-11, -7.3, 7.3, 11]) {
      const bannerMat = canvasMaterial(s, `banner-${x}`, 384, 640, c => {
        c.fillStyle = '#173d30'; c.fillRect(0, 0, 384, 640); c.strokeStyle = '#c6b278'; c.lineWidth = 8; c.strokeRect(14, 14, 356, 612);
        c.fillStyle = '#ded7b5'; c.textAlign = 'center'; c.font = 'bold 116px Georgia'; c.fillText('N', 192, 190);
        c.font = 'bold 27px Arial'; c.fillText('NORTHWOOD', 192, 276); c.font = '20px Arial'; c.fillText('WRESTLING', 192, 313);
        c.fillStyle = '#cdb66e'; c.font = 'bold 40px Arial'; c.fillText('CHAMPIONS', 192, 426); c.font = '30px Georgia'; c.fillText(x < 0 ? '1998 · 2006' : '2018 · 2024', 192, 492);
      });
      panel(s, 'championship-pennant', 1.75, 2.95, new Vector3(x, 5.55, 12.49), bannerMat);
      box(s, 'pennant-rod', 2, 0.065, 0.09, new Vector3(x, 7.09, 12.46), gold);
    }
    box(s, 'scoreboard-housing', 7, 2.8, 0.24, new Vector3(0, 5.8, 12.3), dark);
    box(s, 'scoreboard-trim', 7.15, 0.07, 0.28, new Vector3(0, 7.22, 12.26), gold);
    const boardMat = canvasMaterial(s, 'scoreboard', 1024, 384, () => {}, true);
    this.scoreTexture = boardMat.diffuseTexture as DynamicTexture;
    panel(s, 'live-scoreboard', 6.7, 2.52, new Vector3(0, 5.8, 12.15), boardMat);
    const titleMat = canvasMaterial(s, 'fieldhouse-name', 2048, 200, c => {
      c.fillStyle = '#c3c1a7'; c.fillRect(0, 0, 2048, 200); c.fillStyle = '#254737'; c.textAlign = 'center'; c.font = 'bold 95px Georgia'; c.fillText('NORTHWOOD FIELDHOUSE', 1024, 140);
    });
    panel(s, 'gym-lettering', 11.5, 1.05, new Vector3(0, 3.65, 12.46), titleMat);
    // Instanced spectators share their geometry and materials.
    const crowdColors = ['#203e31', '#baab80', '#a55f43', '#3b4a52', '#d4c4a1', '#46463a', '#652c2c'];
    const crowdBodies = crowdColors.map((color, i) => {
      const body = MeshBuilder.CreateCylinder(`crowd-body-source-${i}`, { height: 0.48, diameterTop: 0.42, diameterBottom: 0.3, tessellation: 10 }, s); body.material = material(s, `crowd-shirt-${i}`, color); body.isVisible = false; return body;
    });
    const crowdHead = MeshBuilder.CreateSphere('crowd-head-source', { diameter: 0.24, segments: 6 }, s); crowdHead.material = material(s, 'crowd-skin', '#aa8260'); crowdHead.isVisible = false;
    const crowdLeg = MeshBuilder.CreateCylinder('crowd-legs-source', { height: 0.35, diameter: 0.12, tessellation: 8 }, s); crowdLeg.material = material(s, 'crowd-pants', '#283330'); crowdLeg.isVisible = false;
    const crowdHair = MeshBuilder.CreateSphere('crowd-hair-source', { diameter: 1, segments: 6 }, s); crowdHair.scaling.set(0.245, 0.13, 0.245); crowdHair.material = material(s, 'crowd-hair', '#393229'); crowdHair.isVisible = false;
    const crowdArm = MeshBuilder.CreateCylinder('crowd-arm-source', { height: 0.36, diameter: 0.085, tessellation: 7 }, s); crowdArm.material = crowdHead.material; crowdArm.isVisible = false;
    for (const side of [-1, 1]) {
      for (let row = 0; row < 5; row++) {
        const x = side * (8.3 + row * 0.9), y = 0.38 + row * 0.44;
        box(s, 'bleacher-riser', 1.02, y, 19.5, new Vector3(x, y / 2, 1.5), steel);
        box(s, 'bleacher-seat', 0.7, 0.1, 19.5, new Vector3(x, y + 0.11, 1.5), wood);
        box(s, 'bleacher-edge', 0.06, 0.045, 19.5, new Vector3(x - side * 0.34, y + 0.14, 1.5), cream);
        for (let seat = 0; seat < 23; seat++) {
          if ((seat + row * 3) % 7 === 0) continue;
          const z = -7.45 + seat * 0.81, jitter = Math.sin(seat * 7.3 + row) * 0.1;
          const body = crowdBodies[(seat * 3 + row) % crowdBodies.length].createInstance('spectator'); body.position.set(x + jitter, y + 0.52, z); body.rotation.x = Math.sin(seat) * 0.05;
          const head = crowdHead.createInstance('spectator-head'); head.position.set(x + jitter - side * 0.035, y + 0.9, z);
          const hair = crowdHair.createInstance('spectator-hair'); hair.position.set(x + jitter - side * 0.035, y + 0.98, z);
          for (const offset of [-0.115, 0.115]) {
            const leg = crowdLeg.createInstance('spectator-leg'); leg.position.set(x - side * 0.2, y + 0.05, z + offset); leg.freezeWorldMatrix();
            const thigh = crowdLeg.createInstance('spectator-thigh'); thigh.position.set(x - side * 0.12, y + 0.22, z + offset); thigh.rotation.z = Math.PI / 2; thigh.freezeWorldMatrix();
            const arm = crowdArm.createInstance('spectator-arm'); arm.position.set(x + jitter - side * 0.12, y + 0.48, z + offset * 1.8); arm.rotation.z = -side * 0.6; arm.freezeWorldMatrix();
          }
          body.freezeWorldMatrix(); head.freezeWorldMatrix(); hair.freezeWorldMatrix();
        }
      }
      box(s, 'bleacher-top-rail', 0.07, 0.07, 20, new Vector3(side * 12.5, 3.45, 1.5), cream);
      for (let z = -8; z <= 11; z += 3.2) box(s, 'rail-post', 0.08, 1.2, 0.08, new Vector3(side * 12.5, 2.87, z), steel);
    }
    // Scorer's table, team seats, a rack of folded chairs and a basketball goal.
    const tableMat = canvasMaterial(s, 'table-brand', 1024, 256, c => { c.fillStyle = '#183d31'; c.fillRect(0, 0, 1024, 256); c.fillStyle = '#e7d99e'; c.font = 'bold 64px Georgia'; c.textAlign = 'center'; c.fillText('NORTHWOOD ATHLETICS', 512, 145); });
    box(s, 'scorers-table', 5.2, 0.8, 0.9, new Vector3(0, 0.43, 8.8), steel);
    panel(s, 'scorers-table-front', 5.1, 0.72, new Vector3(0, 0.46, 8.33), tableMat);
    box(s, 'table-top', 5.35, 0.08, 1.02, new Vector3(0, 0.87, 8.8), wood);
    for (const x of [-1.35, 1.35]) {
      box(s, 'laptop', 0.48, 0.3, 0.045, new Vector3(x, 1.05, 8.88), dark);
      const body = crowdBodies[3].createInstance('table-official'); body.position.set(x, 0.92, 9.45);
      const head = crowdHead.createInstance('table-official-head'); head.position.set(x, 1.3, 9.45);
    }
    for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
      const x = side * (4.2 + i * 0.67), z = 8.7;
      box(s, 'team-chair-seat', 0.48, 0.08, 0.5, new Vector3(x, 0.48, z), padded);
      box(s, 'team-chair-back', 0.48, 0.55, 0.075, new Vector3(x, 0.76, z + 0.23), padded);
      for (const a of [-0.19, 0.19]) box(s, 'chair-leg', 0.04, 0.46, 0.04, new Vector3(x + a, 0.23, z), steel);
    }
    box(s, 'basketball-backboard', 2.7, 1.6, 0.08, new Vector3(-15.6, 4.5, 0), cream).rotation.y = Math.PI / 2;
    const rim = MeshBuilder.CreateTorus('basketball-rim', { diameter: 0.62, thickness: 0.045, tessellation: 24 }, s); rim.position.set(-15.1, 3.93, 0); rim.material = material(s, 'orange-rim', '#c2693a');
    for (const m of s.meshes) {
      if (!m.name.includes('source')) m.freezeWorldMatrix();
      m.isPickable = false;
    }
  }
  private drawScore(s: MatchState) {
    const label = s.stage === 'regulation' ? `${s.period}` : s.stage === 'sudden' ? 'OT' : 'TB';
    const key = `${s.score.join('-')}-${Math.ceil(s.remaining)}-${label}`;
    if (key === this.lastScore) return; this.lastScore = key;
    const c = this.scoreTexture.getContext() as unknown as CanvasRenderingContext2D;
    c.fillStyle = '#10241e'; c.fillRect(0, 0, 1024, 384);
    c.textAlign = 'center'; c.fillStyle = '#b9c3a4'; c.font = 'bold 30px Arial'; c.fillText('NORTHWOOD', 196, 67); c.fillText('RIDGEFIELD', 828, 67);
    c.fillStyle = '#e5bf73'; c.font = 'bold 155px monospace'; c.fillText(String(s.score[0]).padStart(2, '0'), 196, 228); c.fillText(String(s.score[1]).padStart(2, '0'), 828, 228);
    c.fillStyle = '#eeead0'; c.font = 'bold 90px monospace'; c.fillText(clockText(s.remaining), 512, 185);
    c.font = '24px Arial'; c.fillStyle = '#a4b7a1'; c.fillText(`PERIOD  ${label}`, 512, 244);
    c.fillStyle = '#627e64'; c.fillRect(55, 291, 914, 2); c.fillStyle = '#d3c290'; c.font = 'bold 24px Arial'; c.fillText('157 LB     •     COLLEGIATE WRESTLING', 512, 344); this.scoreTexture.update();
  }
  update(s: MatchState, dt: number) {
    this.time += dt;
    for (const side of [0, 1] as const) this.athletes[side].update(s.wrestlers[side], s, dt, this.time);
    this.referee.root.setEnabled(s.phase !== 'menu');
    this.referee.update(s.wrestlers[0], s, dt, this.time, true);
    this.drawScore(s);
    const menu = s.phase === 'menu', intro = s.phase === 'intro';
    let alpha = this.desiredAlpha, radius = this.mode === 0 ? 10.3 : this.mode === 1 ? 15.5 : 7.8, beta = this.mode === 0 ? 1.34 : this.mode === 1 ? 0.86 : 1.4;
    const middle = new Vector3((s.wrestlers[0].x + s.wrestlers[1].x) / 2, 0.75, (s.wrestlers[0].z + s.wrestlers[1].z) / 2);
    if (menu) { alpha = -1.1 + Math.sin(this.time * 0.07) * 0.08; radius = 12.4; beta = 1.33; middle.set(-2.1, 0.85, 0); }
    if (intro) { alpha = -1.15 + Math.min(1, s.phaseAge / 6.5) * (-Math.PI / 2 + 1.15); radius = 9.0 + Math.min(1, s.phaseAge / 6.5) * 1.8; }
    if (s.result) { alpha = -Math.PI / 2 + Math.sin(this.time * 0.14) * 0.1; radius = 9.3; beta = 1.15; middle.set(-1.5, 0.9, 0); }
    radius = Math.max(radius, Math.hypot(s.wrestlers[0].x - s.wrestlers[1].x, s.wrestlers[0].z - s.wrestlers[1].z) * 1.5 + 5);
    const smooth = 1 - Math.exp(-dt * 2.5);
    this.camera.alpha += (alpha - this.camera.alpha) * smooth; this.camera.beta += (beta - this.camera.beta) * smooth;
    this.camera.radius += (radius - this.camera.radius) * smooth;
    // Keep the desired orbit while tracking the action. The target property setter
    // rebuilds alpha/beta/radius from the previous frame and cancels camera changes.
    this.camera.setTarget(Vector3.Lerp(this.camera.target, middle, smooth), false, true, true);
    this.hit *= Math.exp(-dt * 12); this.camera.target.y += Math.sin(this.time * 90) * this.hit;
    this.pulseRing.setEnabled(s.phase === 'wrestling' && s.top === null);
    this.pulseRing.position.x = s.wrestlers[0].x; this.pulseRing.position.z = s.wrestlers[0].z;
    const scale = 1 + s.wrestlers[0].setup * 0.3; this.pulseRing.scaling.set(scale, 1, scale); this.ringMat.alpha = 0.28 + s.wrestlers[0].setup * 0.45;
    if (s.result && !this.winnerShown) { this.winnerShown = true; this.celebrate(); }
    if (!s.result && this.winnerShown) { this.winnerShown = false; for (const p of this.confetti) p.mesh.dispose(); this.confetti = []; }
    for (const p of this.confetti) {
      p.velocity.y -= dt * 0.8; p.mesh.position.addInPlace(p.velocity.scale(dt)); p.mesh.rotation.z += dt * p.spin; p.mesh.rotation.x += dt * 2;
      if (p.mesh.position.y < 0.16) { p.mesh.position.y = 0.16; p.velocity.set(0, 0, 0); }
    }
    this.scene.render();
  }
  private celebrate() {
    const mats = [material(this.scene, 'confetti-gold', '#d5b763'), material(this.scene, 'confetti-cream', '#ebe5d1'), material(this.scene, 'confetti-green', '#328566')];
    for (let i = 0; i < 100; i++) {
      const mesh = MeshBuilder.CreatePlane('confetti', { width: 0.06, height: 0.13, sideOrientation: Mesh.DOUBLESIDE }, this.scene); mesh.material = mats[i % 3];
      mesh.position.set(Math.sin(i * 7) * 3, 5 + (i % 13) * 0.17, Math.cos(i * 9) * 2); mesh.rotation.y = i;
      this.confetti.push({ mesh, velocity: new Vector3(Math.sin(i) * 0.4, -0.6 - (i % 5) * 0.1, Math.cos(i) * 0.35), spin: (i % 7) - 3 });
    }
  }
  /** Convert screen-oriented movement into mat coordinates for every camera preset. */
  movement(x: number, z: number) {
    const a = this.camera.alpha;
    return { x: -Math.sin(a) * x - Math.cos(a) * z, z: Math.cos(a) * x - Math.sin(a) * z };
  }
  dispose() { this.resizeObserver.disconnect(); window.removeEventListener('resize', this.resize); this.scene.dispose(); this.engine.dispose(); }
}
