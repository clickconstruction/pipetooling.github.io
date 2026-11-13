/**
 * The job a Pay calendar press sits on (punch list #323, PR 4), so the window can set a
 * calendar for that job alone, or for its development's jobs. One shape for every door:
 * the board's rows, the job window's line and the Their paper sheet (punch list #341).
 */
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'

export type PayCalendarJob = {
  id: string
  /** The job in the board's words: "1412 · Larkfield retail shell". */
  label: string
  developmentId?: string | null
  developmentName?: string | null
}

export type PayCalendarJobInput = {
  id: string
  hcp_number?: string | null
  click_number?: string | null
  job_name?: string | null
  development_id?: string | null
  development?: { name: string | null } | null
}

export function payCalendarJobOf(j: PayCalendarJobInput): PayCalendarJob {
  return {
    id: j.id,
    label: `${effectiveJobLedgerNumber(j.hcp_number ?? null, j.click_number ?? null) || '—'} · ${(j.job_name ?? '').trim() || 'Job'}`,
    developmentId: j.development_id ?? null,
    developmentName: j.development?.name ?? null,
  }
}
