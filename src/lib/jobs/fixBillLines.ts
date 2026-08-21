import type { StageRow } from '../jobsStagesBoard'
import { billedStageRowHasNoBillLine, stageRowBilledRemainingAmount } from './invoiceBilling'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'

/**
 * "Fix bill lines" one-sitting modal — pure list builder. The worklist is the
 * Billed section's no-bill-line shells (v2.1931's cohort): billed jobs whose
 * open money rides on no billed invoice line. One item per job, biggest open
 * dollars first — fixing the top of the list moves the most money into the
 * aging/chase/forecast machinery per click.
 */

export type FixBillLineItem = {
  jobId: string
  /** "964 PLUM · Pondhill demo" */
  label: string
  customerName: string | null
  open: number
}

export function buildFixBillLineItems(rows: StageRow[]): FixBillLineItem[] {
  const items: FixBillLineItem[] = []
  for (const r of rows) {
    if (r.kind !== 'job') continue
    const open = stageRowBilledRemainingAmount(r)
    if (open <= 0 || !billedStageRowHasNoBillLine(r)) continue
    const number = effectiveJobLedgerNumber(r.job.hcp_number, r.job.click_number) || '—'
    const name = (r.job.job_name ?? '').trim()
    items.push({
      jobId: r.job.id,
      label: name ? `${number} · ${name}` : number,
      customerName: (r.job.customer_name ?? '').trim() || null,
      open,
    })
  }
  return items.sort((a, b) => b.open - a.open)
}
