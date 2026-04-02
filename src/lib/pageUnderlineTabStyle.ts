import type { CSSProperties } from 'react'

/** Underline tabs (Jobs / People pattern): no box border, bottom accent when active. */
export function pageUnderlineTabStyle(active: boolean): CSSProperties {
  return {
    padding: '0.75rem 1.5rem',
    border: 'none',
    background: 'none',
    borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
    color: active ? '#3b82f6' : '#6b7280',
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    flexShrink: 0,
  }
}
