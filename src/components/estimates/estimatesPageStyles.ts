import type { CSSProperties } from 'react'

/**
 * The Estimates page's input and button styles, shared by the page and the pieces that have left
 * it (the catalog modal, step 3 of the map — v2.3870). Style factories, no state.
 */

export const estInputBase: CSSProperties = {
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  fontSize: '0.875rem',
  boxSizing: 'border-box',
}

export function estInputBlock(extra?: CSSProperties): CSSProperties {
  return {
    ...estInputBase,
    display: 'block',
    width: '100%',
    maxWidth: 480,
    marginTop: '0.25rem',
    padding: '0.5rem',
    ...extra,
  }
}

export function estPrimaryButton(disabled: boolean): CSSProperties {
  return {
    padding: '0.5rem 1rem',
    background: disabled ? '#9ca3af' : '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: 4,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 500,
    fontSize: '0.875rem',
  }
}

export function estSecondaryButton(disabled?: boolean): CSSProperties {
  return {
    padding: '0.5rem 1rem',
    background: 'var(--bg-muted)',
    border: '1px solid var(--border-strong)',
    borderRadius: 4,
    color: 'var(--text-700)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 500,
    fontSize: '0.875rem',
    opacity: disabled ? 0.65 : 1,
  }
}

export function estSendButton(disabled: boolean): CSSProperties {
  return {
    ...estPrimaryButton(disabled),
    background: disabled ? '#9ca3af' : '#ea580c',
  }
}

export function estDangerOutlineButton(disabled?: boolean): CSSProperties {
  return {
    padding: '0.5rem 1rem',
    background: 'var(--bg-red-tint)',
    border: '1px solid #fecaca',
    borderRadius: 4,
    color: 'var(--text-red-700)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 500,
    fontSize: '0.875rem',
    opacity: disabled ? 0.65 : 1,
  }
}

export function estSmallSecondaryButton(): CSSProperties {
  return {
    padding: '0.35rem 0.65rem',
    fontSize: '0.8125rem',
    fontWeight: 500,
    border: '1px solid var(--border-strong)',
    borderRadius: 4,
    background: 'var(--bg-muted)',
    color: 'var(--text-700)',
    cursor: 'pointer',
  }
}

export function estSmallPrimaryButton(disabled: boolean): CSSProperties {
  return {
    padding: '0.35rem 0.65rem',
    fontSize: '0.8125rem',
    fontWeight: 500,
    border: 'none',
    borderRadius: 4,
    background: disabled ? '#9ca3af' : '#3b82f6',
    color: 'white',
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}
