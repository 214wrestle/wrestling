import {
  ACESFilmicToneMapping,
  Color,
  Fog,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { Vector2 } from 'three';

export type Quality = 'high' | 'medium' | 'low';

/**
 * Rendering surface.
 *
 * Tone mapping, shadows and a light bloom are set once here; the rest of the game
 * never touches the renderer. Quality is a single switch so phones can drop
 * post-processing without any other code changing.
 */
export class Renderer {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private quality: Quality;
  private width = 1;
  private height = 1;

  constructor(canvas: HTMLCanvasElement, quality: Quality = 'high') {
    this.quality = quality;
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: quality !== 'high',
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'high' ? 2 : 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;

    this.scene.background = new Color('#05070c');
    this.scene.fog = new Fog('#070a12', 26, 64);

    this.camera = new PerspectiveCamera(38, 1, 0.1, 160);
    this.camera.position.set(0, 3, 9);

    if (quality === 'high') this.buildComposer();
    this.resize();
  }

  private buildComposer(): void {
    const composer = new EffectComposer(this.renderer);
    composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new UnrealBloomPass(new Vector2(1, 1), 0.2, 0.7, 0.95);
    composer.addPass(bloom);
    composer.addPass(new SMAAPass());
    composer.addPass(new OutputPass());
    this.composer = composer;
    this.bloom = bloom;
  }

  setQuality(quality: Quality): void {
    if (quality === this.quality) return;
    this.quality = quality;
    if (quality === 'high' && !this.composer) this.buildComposer();
    if (quality !== 'high') {
      this.composer?.dispose();
      this.composer = null;
      this.bloom = null;
    }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'high' ? 2 : 1.5));
    this.resize();
  }

  /** Nudge bloom up for celebrations. */
  setBloom(strength: number): void {
    if (this.bloom) this.bloom.strength = strength;
  }

  private lensShift = 0;

  /**
   * Slide the picture sideways without moving the camera — the title screen
   * uses it to frame the face-off beside the menu.
   */
  setLensShift(fraction: number): void {
    if (Math.abs(fraction - this.lensShift) < 1e-4) return;
    this.lensShift = fraction;
    this.applyLens();
  }

  private applyLens(): void {
    if (Math.abs(this.lensShift) > 1e-4) {
      this.camera.setViewOffset(this.width, this.height, -this.width * this.lensShift, 0, this.width, this.height);
    } else {
      this.camera.clearViewOffset();
    }
  }

  resize(): void {
    const parent = this.renderer.domElement.parentElement;
    this.width = parent?.clientWidth ?? window.innerWidth;
    this.height = parent?.clientHeight ?? window.innerHeight;
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.applyLens();
    this.camera.updateProjectionMatrix();
    this.composer?.setSize(this.width, this.height);
    if (this.bloom) this.bloom.resolution.set(this.width, this.height);
  }

  render(): void {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.composer?.dispose();
    this.renderer.dispose();
  }
}
