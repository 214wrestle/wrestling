import type { Device } from '../engine/Input';
import type { ButtonId } from '../game/store';

/**
 * Button glyphs that follow the device in hand: keycaps on a keyboard, face
 * buttons on a gamepad, nothing on touch (the buttons are on screen).
 */

const KEYS: Record<ButtonId, string> = { shoot: 'J', fight: 'K', sprawl: 'L' };
const PAD: Record<ButtonId, { label: string; color: string }> = {
  shoot: { label: 'A', color: '#3fbf5f' },
  fight: { label: 'X', color: '#3c8dff' },
  sprawl: { label: 'B', color: '#ff4a4a' },
};

export function Glyph({ id, device }: { id: ButtonId; device: Device }) {
  if (device === 'gamepad') {
    const p = PAD[id];
    return (
      <span className="glyph glyph--pad" style={{ ['--pad' as string]: p.color }}>
        {p.label}
      </span>
    );
  }
  return <kbd className="glyph glyph--key">{KEYS[id]}</kbd>;
}

export function Key({ children }: { children: React.ReactNode }) {
  return <kbd className="glyph glyph--key">{children}</kbd>;
}

/** Small silhouettes for the starting-position choice. */
export function PositionIcon({ kind }: { kind: 'neutral' | 'top' | 'bottom' }) {
  const stroke = 'currentColor';
  if (kind === 'neutral') {
    return (
      <svg viewBox="0 0 120 64" className="posicon" aria-hidden="true">
        <g fill="none" stroke={stroke} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="34" cy="12" r="6" fill={stroke} />
          <path d="M32 19 L42 34 L36 50 M42 34 L26 48 M38 24 L52 30" />
          <circle cx="86" cy="12" r="6" fill={stroke} />
          <path d="M88 19 L78 34 L84 50 M78 34 L94 48 M82 24 L68 30" />
        </g>
      </svg>
    );
  }
  const topMan = kind === 'top';
  return (
    <svg viewBox="0 0 120 64" className="posicon" aria-hidden="true">
      <g fill="none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <g stroke={topMan ? 'var(--muted-ink)' : stroke}>
          <circle cx="94" cy="30" r="6" fill={topMan ? 'var(--muted-ink)' : stroke} />
          <path d="M86 34 L40 36 M40 36 L36 56 M44 36 L50 56 M84 36 L84 56" />
        </g>
        <g stroke={topMan ? stroke : 'var(--muted-ink)'}>
          <circle cx="62" cy="10" r="6" fill={topMan ? stroke : 'var(--muted-ink)'} />
          <path d="M58 16 L40 26 L34 54 M44 26 L58 30 L76 38 M40 26 L28 52" />
        </g>
      </g>
    </svg>
  );
}
