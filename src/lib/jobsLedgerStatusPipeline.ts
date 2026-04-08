export const JOBS_LEDGER_STATUS_PIPELINE = ['working', 'ready_to_bill', 'billed', 'paid'] as const

export type JobsLedgerPipelineStatus = (typeof JOBS_LEDGER_STATUS_PIPELINE)[number]

const LABELS: Record<JobsLedgerPipelineStatus, string> = {
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
