/**
 * Shared chrome styles for the Schedule Dispatch hub's panels and the
 * job-week grid: the toolbar buttons the Jobs and People panels both draw,
 * and the salary "(s)" suffix under a person's name.
 */
import type { CSSProperties } from 'react'

export const HUB_PEOPLE_TOOLBAR_BTN_H = 32

export const hubPeopleToolbarBtn: CSSProperties = {
  boxSizing: 'border-box',
  height: HUB_PEOPLE_TOOLBAR_BTN_H,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 0.75rem',
  border: '1px solid #2563eb',
  borderRadius: 4,
  background: 'var(--surface)',
  color: 'var(--text-link)',
  cursor: 'pointer',
  fontSize: '0.8125rem',
}

export const hubPeopleToolbarIconBtn: CSSProperties = {
  ...hubPeopleToolbarBtn,
  padding: '0 0.55rem',
  minWidth: HUB_PEOPLE_TOOLBAR_BTN_H,
  lineHeight: 1,
  fontWeight: 600,
  fontSize: '1rem',
}

export const hubPeopleSalarySuffix: CSSProperties = {
  display: 'block',
  fontSize: '0.68rem',
  color: 'var(--text-faint)',
  fontWeight: 400,
  lineHeight: 1.1,
}
