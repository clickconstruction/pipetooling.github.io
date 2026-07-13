/**
 * Projects → Forecast: shared toolbar styles for both sub-tabs.
 *
 * These mirror the Job History toolbar styles so the Forecast tab feels visually consistent
 * with the rest of the Projects page. Kept as a tiny `CSSProperties` module rather than CSS
 * modules to stay consistent with the rest of `src/lib/*Styles.ts`.
 */

import type { CSSProperties } from 'react'

export const forecastToolbarRowStyle: CSSProperties = {
  display: 'flex',
  gap: '0.75rem',
  alignItems: 'center',
  flexWrap: 'wrap',
}

export const forecastToolbarLabelStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.35rem',
  fontSize: '0.875rem',
  color: 'var(--text-700)',
}

export const forecastDateInputStyle: CSSProperties = {
  padding: '0.35rem 0.3rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  fontSize: '0.875rem',
  width: 92,
  boxSizing: 'border-box',
}

export const forecastSearchInputStyle: CSSProperties = {
  padding: '0.35rem 1.6rem 0.35rem 0.7rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 999,
  fontSize: '0.875rem',
  minWidth: 240,
  background: 'var(--surface)',
}

export const forecastSearchClearButtonStyle: CSSProperties = {
  position: 'absolute',
  right: 6,
  top: '50%',
  transform: 'translateY(-50%)',
  width: 20,
  height: 20,
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: 'var(--text-muted)',
  fontSize: '1rem',
  lineHeight: 1,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
}

export const forecastChipStyle: CSSProperties = {
  padding: '0.3rem 0.7rem',
  fontSize: '0.8125rem',
  background: 'var(--surface)',
  color: 'var(--text-700)',
  border: '1px solid #cbd5e1',
  borderRadius: 999,
  cursor: 'pointer',
}

export const forecastSecondaryButtonStyle: CSSProperties = {
  padding: '0.3rem 0.7rem',
  fontSize: '0.8125rem',
  background: 'var(--surface)',
  color: 'var(--text-700)',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  cursor: 'pointer',
}
