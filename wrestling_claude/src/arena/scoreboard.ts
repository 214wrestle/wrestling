import {
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three';
import { formatClock, formatRidingTime, periodLabel } from '../sim/rules';
import type { School } from '../sim/types';

/**
 * The hanging scoreboard.
 *
 * Drawn into a canvas and redrawn only when a value changes, so it costs one
 * texture upload per second instead of one per frame.
 */

export interface ScoreboardState {
  score: [number, number];
  period: number;
  clock: number;
  ridingTime: number;
  nearFall: number;
}

const W = 1024;
const H = 512;

export class Scoreboard {
  readonly group = new Group();
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: CanvasTexture;
  private last = '';

  constructor(
    private home: School,
    private away: School,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;

    const frame = new Mesh(
      new BoxGeometry(7.6, 3.9, 0.5),
      new MeshStandardMaterial({ color: '#10151e', roughness: 0.7, metalness: 0.2 }),
    );
    this.group.add(frame);

    const screen = new Mesh(
      new PlaneGeometry(7.2, 3.6),
      new MeshBasicMaterial({ map: this.texture }),
    );
    screen.position.z = 0.26;
    this.group.add(screen);

    const screenBack = new Mesh(
      new PlaneGeometry(7.2, 3.6),
      new MeshBasicMaterial({ map: this.texture }),
    );
    screenBack.position.z = -0.26;
    screenBack.rotation.y = Math.PI;
    this.group.add(screenBack);

    // Hanging cables.
    for (const sx of [-2.6, 2.6]) {
      const cable = new Mesh(
        new CylinderGeometry(0.03, 0.03, 4.2, 6),
        new MeshStandardMaterial({ color: '#2b313d', roughness: 0.6 }),
      );
      cable.position.set(sx, 4.05, 0);
      this.group.add(cable);
    }

    this.draw({ score: [0, 0], period: 1, clock: 180, ridingTime: 0, nearFall: 0 });
  }

  update(state: ScoreboardState): void {
    const key = [
      state.score[0],
      state.score[1],
      state.period,
      Math.ceil(state.clock),
      Math.round(state.ridingTime),
      state.nearFall,
    ].join('|');
    if (key === this.last) return;
    this.last = key;
    this.draw(state);
    this.texture.needsUpdate = true;
  }

  private draw(state: ScoreboardState): void {
    const g = this.ctx;
    g.fillStyle = '#05080e';
    g.fillRect(0, 0, W, H);

    const panel = (x: number, school: School, score: number) => {
      g.fillStyle = school.primary;
      g.fillRect(x, 24, 300, 110);
      g.fillStyle = school.secondary;
      g.font = 'bold 56px "Arial Black", Impact, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(school.name.slice(0, 11).toUpperCase(), x + 150, 80);

      g.fillStyle = '#0b0f17';
      g.fillRect(x, 150, 300, 200);
      g.strokeStyle = '#2a3342';
      g.lineWidth = 4;
      g.strokeRect(x, 150, 300, 200);
      g.fillStyle = '#ffcf4a';
      g.font = 'bold 170px "DS-Digital", "Courier New", monospace';
      g.fillText(String(score), x + 150, 258);
    };

    panel(42, this.home, state.score[0]);
    panel(W - 342, this.away, state.score[1]);

    // Clock column.
    g.fillStyle = '#0b0f17';
    g.fillRect(380, 150, 264, 200);
    g.strokeStyle = '#2a3342';
    g.lineWidth = 4;
    g.strokeRect(380, 150, 264, 200);
    g.fillStyle = state.clock <= 10 ? '#ff6b57' : '#8ef0a8';
    g.font = 'bold 118px "DS-Digital", "Courier New", monospace';
    g.textAlign = 'center';
    g.fillText(formatClock(state.clock), 512, 258);

    g.fillStyle = '#cdd6e3';
    g.font = 'bold 46px "Arial Black", Impact, sans-serif';
    g.fillText(periodLabel(state.period), 512, 78);

    // Riding time and near-fall indicator strip.
    g.fillStyle = '#121824';
    g.fillRect(42, 376, W - 84, 104);
    g.fillStyle = '#90a0b8';
    g.font = 'bold 34px Arial, sans-serif';
    g.textAlign = 'left';
    g.fillText('RIDING TIME', 68, 430);
    g.fillStyle = Math.abs(state.ridingTime) >= 60 ? '#ffcf4a' : '#e8eef7';
    g.font = 'bold 48px "DS-Digital", "Courier New", monospace';
    g.fillText(formatRidingTime(state.ridingTime), 330, 432);

    if (state.nearFall > 0) {
      g.fillStyle = '#ff5a3c';
      g.textAlign = 'right';
      g.font = 'bold 44px "Arial Black", Impact, sans-serif';
      g.fillText(`NEAR FALL  ${state.nearFall.toFixed(1)}`, W - 68, 432);
    }
  }
}
