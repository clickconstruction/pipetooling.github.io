import type { CSSProperties } from 'react'

/** Page tabs (Jobs / People pattern): the selected tab is a filled blue box with white bold
 * text; inactive tabs stay muted with no box (formerly pageUnderlineTabStyle's bottom accent). */
export function pageTabStyle(active: boolean): CSSProperties {
  return {
    padding: '0.75rem 1.5rem',
    border: 'none',
    background: active ? '#3b82f6' : 'none',
    borderRadius: 6,
    color: active ? 'white' : 'var(--text-muted)',
    fontWeight: active ? 700 : 400,
    cursor: 'pointer',
    flexShrink: 0,
  }
}
