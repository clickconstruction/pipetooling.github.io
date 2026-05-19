import type { CSSProperties } from 'react'
import type { Database } from '../types/database'

export type ProjectStatus = Database['public']['Enums']['project_status']

const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  awaiting_start: 'Awaiting start',
  active: 'Active',
  on_hold: 'On hold',
  completed: 'Completed',
}

export function projectStatusLabel(status: ProjectStatus): string {
  return PROJECT_STATUS_LABELS[status]
}

const PROJECT_STATUS_PILL: Record<
  ProjectStatus,
  { background: string; color: string; border: string }
> = {
  awaiting_start: { background: '#f3f4f6', color: '#374151', border: '#d1d5db' },
  active: { background: '#dcfce7', color: '#166534', border: '#bbf7d0' },
  on_hold: { background: '#fef3c7', color: '#92400e', border: '#fde68a' },
  completed: { background: '#e0f2fe', color: '#075985', border: '#bae6fd' },
}

export function projectStatusPillStyle(status: ProjectStatus): CSSProperties {
  const c = PROJECT_STATUS_PILL[status]
  return {
    display: 'inline-block',
    padding: '0.1rem 0.45rem',
    borderRadius: 999,
    fontSize: '0.75rem',
    fontWeight: 500,
    background: c.background,
    color: c.color,
    border: `1px solid ${c.border}`,
    lineHeight: 1.4,
  }
}

export const PROJECT_STATUS_ORDER: readonly ProjectStatus[] = [
  'active',
  'awaiting_start',
  'on_hold',
  'completed',
]
