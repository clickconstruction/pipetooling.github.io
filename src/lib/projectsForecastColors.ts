/**
 * Projects → Forecast: stage bar color palette.
 *
 * Maps a `project_workflow_steps.status` (plus the synthetic `'unscheduled'` colorKey emitted
 * by `projectsForecastStageResolver`) onto the swatch the Gantt timeline renders. The status
 * colors mirror `getStepStatusStyle` from [`src/pages/Workflow.tsx`](src/pages/Workflow.tsx)
 * so a stage that looks orange (in progress) on Workflow looks orange in the Forecast bar.
 *
 * The `'unscheduled'` colorKey is reserved for stages with no expected dates and no actual
 * dates — see resolver doc for the rule. It renders as a dashed, dimmed 1-day bar so the user
 * immediately notices that the date is inferred.
 *
 * Skipped stages also get a strikethrough text decoration so the label is unmistakable even
 * when the muted swatch is hard to distinguish from `pending`.
 */

import type { Database } from '../types/database'

export type ForecastStageStatus = Database['public']['Enums']['step_status']

export type ForecastBarColorKey = ForecastStageStatus | 'unscheduled'

export type ForecastBarSwatch = {
  background: string
  borderColor: string
  borderStyle: 'solid' | 'dashed'
  textColor: string
  textDecoration: 'none' | 'line-through'
  /** Optional inline pattern (e.g. a diagonal stripe) for the swatch. Not used today but
   * leaving the field in the type makes follow-ups simple. */
  pattern?: string
}

const SWATCHES: Record<ForecastBarColorKey, ForecastBarSwatch> = {
  pending: {
    background: '#e2e8f0',
    borderColor: '#94a3b8',
    borderStyle: 'solid',
    textColor: '#1f2937',
    textDecoration: 'none',
  },
  in_progress: {
    background: '#fed7aa',
    borderColor: '#E87600',
    borderStyle: 'solid',
    textColor: '#7c2d12',
    textDecoration: 'none',
  },
  completed: {
    background: 'var(--bg-green-200)',
    borderColor: '#059669',
    borderStyle: 'solid',
    textColor: '#064e3b',
    textDecoration: 'none',
  },
  approved: {
    background: 'var(--bg-green-200)',
    borderColor: '#059669',
    borderStyle: 'solid',
    textColor: '#064e3b',
    textDecoration: 'none',
  },
  rejected: {
    background: 'var(--bg-red-200)',
    borderColor: '#b91c1c',
    borderStyle: 'solid',
    textColor: '#7f1d1d',
    textDecoration: 'none',
  },
  skipped: {
    background: 'var(--bg-slate-100)',
    borderColor: 'var(--border-strong)',
    borderStyle: 'solid',
    textColor: '#94a3b8',
    textDecoration: 'line-through',
  },
  unscheduled: {
    background: 'var(--bg-slate-100)',
    borderColor: 'var(--border-400)',
    borderStyle: 'dashed',
    textColor: '#6b7280',
    textDecoration: 'none',
  },
}

export function forecastBarSwatch(colorKey: ForecastBarColorKey): ForecastBarSwatch {
  return SWATCHES[colorKey] ?? SWATCHES.pending
}

export function forecastStageColorKey(
  status: ForecastStageStatus | null,
  isUnscheduled: boolean,
): ForecastBarColorKey {
  // `skipped` is an explicit user signal (the stage isn't happening) — it should win over
  // the inferred `unscheduled` look so the muted strikethrough swatch is shown even when
  // there are no dates on the row.
  if (status === 'skipped') return 'skipped'
  if (isUnscheduled) return 'unscheduled'
  if (status == null) return 'pending'
  return status
}
