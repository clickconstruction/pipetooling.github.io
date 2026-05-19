import type { CSSProperties } from 'react'

export const PROJECTS_PRIMARY_BLUE = '#2563eb'
export const PROJECTS_MUTED_GREY = '#6b7280'

export function projectsPrimaryButtonStyle(): CSSProperties {
  return {
    padding: '0.5rem 1rem',
    background: PROJECTS_PRIMARY_BLUE,
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontWeight: 500,
  }
}

export function projectsInlineLinkButtonStyle(): CSSProperties {
  return {
    background: 'none',
    border: 'none',
    padding: 0,
    color: PROJECTS_PRIMARY_BLUE,
    textDecoration: 'underline',
    cursor: 'pointer',
    font: 'inherit',
  }
}

export function projectsSecondaryLinkColor(): string {
  return PROJECTS_PRIMARY_BLUE
}
