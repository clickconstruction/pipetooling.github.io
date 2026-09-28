/**
 * The colour and weight of a step's name in the Workflow page's header strip:
 * green once finished, bold orange while in progress, red when rejected,
 * muted otherwise (pending, skipped, no status).
 *
 * `src/lib/projectsForecastColors.ts` mirrors these colours for the Forecast
 * bars — it keeps its own table on purpose, so change both together.
 */

import type { Database } from '../../types/database'

type StepStatus = Database['public']['Enums']['step_status']

export function getStepStatusStyle(status: StepStatus | null): { color: string; fontWeight: 'normal' | 'bold' } {
  if (status === 'completed' || status === 'approved') return { color: 'var(--text-green-600)', fontWeight: 'normal' }
  if (status === 'in_progress') return { color: '#E87600', fontWeight: 'bold' }
  if (status === 'rejected') return { color: 'var(--text-red-700)', fontWeight: 'normal' }
  return { color: 'var(--text-muted)', fontWeight: 'normal' }
}
