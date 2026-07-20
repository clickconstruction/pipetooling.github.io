import type { CSSProperties } from 'react'

/** Page tabs (Jobs / People pattern): the selected tab is a filled blue box with white bold
 * text; inactive tabs stay muted with no box (formerly pageUnderlineTabStyle's bottom accent).
 *
 * The clickable area is taller than the visible pill: part of the vertical padding lives in
 * a transparent border, and `backgroundClip: 'padding-box'` keeps the blue fill inside it —
 * so the hit target keeps the full 0.75rem-per-side height while the pill reads shorter. */
export function pageTabStyle(active: boolean): CSSProperties {
  return {
    // 6px border + 6px padding = the original 0.75rem (12px) per side, exactly.
    padding: '6px 1.5rem',
    borderTop: '6px solid transparent',
    borderBottom: '6px solid transparent',
    borderLeft: 'none',
    borderRight: 'none',
    background: active ? '#3b82f6' : 'none',
    backgroundClip: 'padding-box',
    borderRadius: 6,
    color: active ? 'white' : 'var(--text-muted)',
    fontWeight: active ? 700 : 400,
    cursor: 'pointer',
    flexShrink: 0,
  }
}
