export const JOBS_LEDGER_STATUS_PIPELINE = ['waiting', 'working', 'ready_to_bill', 'billed', 'paid'] as const

export type JobsLedgerPipelineStatus = (typeof JOBS_LEDGER_STATUS_PIPELINE)[number]

const LABELS: Record<JobsLedgerPipelineStatus, string> = {
  waiting: 'Waiting',
  working: 'Working',
  ready_to_bill: 'Ready to bill',
  billed: 'Billed',
  paid: 'Paid',
}

export function normalizeJobsLedgerStatus(raw: string | null | undefined): JobsLedgerPipelineStatus | null {
  const k = raw?.trim().toLowerCase()
  if (!k) return null
  for (const s of JOBS_LEDGER_STATUS_PIPELINE) {
    if (s === k) return s
  }
  return null
}

export function labelJobsLedgerStatus(key: JobsLedgerPipelineStatus): string {
  return LABELS[key]
}

/** Dashboard (subcontractor cards): Stages board–aligned copy for `jobs_ledger.status`. */
const DASHBOARD_STATUS_LABELS: Record<JobsLedgerPipelineStatus, string> = {
  waiting: 'Waiting',
  working: 'Working',
  ready_to_bill: 'Ready to Bill',
  billed: 'Billed Awaiting Payment',
  paid: 'Paid',
}

export function labelJobsLedgerStatusForDashboard(raw: string | null | undefined): string {
  const k = normalizeJobsLedgerStatus(raw)
  if (!k) return '—'
  return DASHBOARD_STATUS_LABELS[k] ?? '—'
}

/** Projects-card job chips: one saturated dot color per pipeline stage. */
const STATUS_DOT_COLORS: Record<JobsLedgerPipelineStatus, string> = {
  waiting: '#f59e0b',
  working: '#3b82f6',
  ready_to_bill: '#14b8a6',
  billed: '#f97316',
  paid: '#22c55e',
}

export function jobsLedgerStatusDotColor(raw: string | null | undefined): string {
  const k = normalizeJobsLedgerStatus(raw)
  return k ? STATUS_DOT_COLORS[k] : '#9ca3af'
}
