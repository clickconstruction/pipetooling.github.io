import type { CSSProperties } from 'react'

export const HOURS_TAB_SECTION_ANCHOR_STYLE: CSSProperties = { scrollMarginTop: '3.5rem' }

export const HOURS_TAB_SECTION_SHELL: CSSProperties = {
  ...HOURS_TAB_SECTION_ANCHOR_STYLE,
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: '0.65rem 0.85rem',
  background: '#fafafa',
  boxSizing: 'border-box',
}

/** Primary section header control (chevron + label) */
export const HOURS_TAB_SECTION_TOGGLE_BTN: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
  padding: '0.35rem 0.55rem',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  background: '#ffffff',
  cursor: 'pointer',
  fontSize: '0.875rem',
  fontWeight: 600,
  color: '#111827',
  fontFamily: 'inherit',
  lineHeight: 1.25,
  textAlign: 'left',
}

export const HOURS_TAB_SECTION_CHEVRON: CSSProperties = {
  fontSize: '0.65rem',
  color: '#6b7280',
  flexShrink: 0,
  lineHeight: 1,
}

export function hoursTabSectionHeaderGap(open: boolean): CSSProperties {
  return { marginBottom: open ? '0.75rem' : 0 }
}

/** Pick readable text color (white/dark) for a hex background by relative luminance. */
export function textColorForBackground(hex: string): string {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
  if (!m) return '#374151'
  const r = parseInt(m[1] ?? '00', 16) / 255
  const g = parseInt(m[2] ?? '00', 16) / 255
  const b = parseInt(m[3] ?? '00', 16) / 255
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b
  return luminance < 0.5 ? '#ffffff' : '#374151'
}
