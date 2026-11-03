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

/** Starting-position cues, paired with explicit Top/Bottom text. */
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
  // Abstract control/escape cues avoid ambiguous overlapping body silhouettes.
  return (
    <svg viewBox="0 0 120 64" className="posicon" aria-hidden="true">
      <g fill="none" stroke={stroke} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M24 54 H96" opacity=".4" />
        {kind === 'top' ? <>
          <path d="M36 12 H84 V28 C84 41 72 49 60 54 C48 49 36 41 36 28 Z" />
          <path d="M48 30 L58 39 L75 21" />
        </> : <>
          <path d="M60 43 V10 M44 26 L60 10 L76 26" />
          <path d="M38 40 V48 H82 V40" />
        </>}
      </g>
    </svg>
  );
}
