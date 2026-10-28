/**
 * Sticker illustrations — flat characters with 2px ink outlines (Superr
 * reference). Purely decorative: always aria-hidden, never interactive, and
 * the sky / bubblegum / sprout colours never leak into functional UI.
 * Original artwork, drawn as inline SVG so nothing is downloaded.
 */
import type { CSSProperties } from 'react';

const INK = '#171717';

export type StickerKind = 'bolt' | 'heart' | 'sparkle' | 'ghost' | 'star' | 'smile';

function Art({ kind }: { kind: StickerKind }) {
  switch (kind) {
    case 'bolt':
      return (
        <svg viewBox="0 0 64 64">
          <path d="M36 4 12 36h16l-6 24 28-34H33l7-22z" fill="#3b82f6" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M30 14l-8 11" stroke="#fdfbf9" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case 'heart':
      return (
        <svg viewBox="0 0 64 64">
          <path d="M32 56S6 40 6 22c0-8 6-14 13-14 6 0 10 3 13 8 3-5 7-8 13-8 7 0 13 6 13 14 0 18-26 34-26 34z" fill="#ff6f1e" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <circle cx="24" cy="27" r="3" fill={INK} />
          <circle cx="40" cy="27" r="3" fill={INK} />
          <path d="M26 36c3 3 9 3 12 0" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case 'sparkle':
      return (
        <svg viewBox="0 0 64 64">
          <path d="M32 4c2 14 6 20 26 28-20 6-24 12-26 28-2-16-6-22-26-28 20-8 24-14 26-28z" fill="#22c55e" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        </svg>
      );
    case 'ghost':
      return (
        <svg viewBox="0 0 64 64">
          <path d="M12 58V28C12 15 21 6 32 6s20 9 20 22v30l-7-5-6 5-7-5-6 5-7-5z" fill="#ff66cf" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <ellipse cx="25" cy="28" rx="3" ry="4" fill={INK} />
          <ellipse cx="39" cy="28" rx="3" ry="4" fill={INK} />
          <path d="M28 38c2 2 6 2 8 0" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case 'star':
      return (
        <svg viewBox="0 0 64 64">
          <path d="M32 5l8 17 19 2-14 13 4 19-17-10-17 10 4-19L5 24l19-2z" fill="#fdfbf9" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <circle cx="26" cy="31" r="2.2" fill={INK} />
          <circle cx="38" cy="31" r="2.2" fill={INK} />
        </svg>
      );
    case 'smile':
      return (
        <svg viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="26" fill="#3b82f6" stroke={INK} strokeWidth="2.5" />
          <circle cx="24" cy="27" r="3" fill={INK} />
          <circle cx="40" cy="27" r="3" fill={INK} />
          <path d="M22 38c5 6 15 6 20 0" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
  }
}

export function Sticker({ kind, size = 48, rotate = 8, style, className = '' }: { kind: StickerKind; size?: number; rotate?: number; style?: CSSProperties; className?: string }) {
  return (
    <span className={`sticker ${className}`} aria-hidden="true" style={{ width: size, height: size, transform: `rotate(${rotate}deg)`, ...style }}>
      <Art kind={kind} />
    </span>
  );
}

/** Hand-drawn Arrow: a thin ink stroke with a little curl, no filled head. */
export function HandArrow({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 38 26" aria-hidden="true">
      <path d="M2 4c8-2 18 0 24 6s6 10 4 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M24 19l6 5 4-7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
