import type { Database } from '../../types/database'

/**
 * Tracking for sent demand letters (v2.2640): rows in `job_demand_letters`.
 * The deadline watch — a sent, unvoided letter whose named deadline has passed
 * while the covered bill lines still carry an open balance — feeds the Needs
 * You card. Pure logic; callers fetch rows and the payments-by-invoice map.
 */

export type JobDemandLetterRow = Database['public']['Tables']['job_demand_letters']['Row']

/** Live (non-voided) letters, newest first. */
export function liveDemandLetters(rows: JobDemandLetterRow[]): JobDemandLetterRow[] {
  return rows.filter((r) => r.voided_at == null).slice().sort((a, b) => b.created_at.localeCompare(a.created_at))
}

/** Open remaining across the letter's covered lines, from an applied-payments map. */
export function demandLetterOpenRemaining(
  row: Pick<JobDemandLetterRow, 'amount' | 'invoice_ids'>,
  invoiceAmountById: ReadonlyMap<string, number>,
  appliedByInvoiceId: ReadonlyMap<string, number>,
): number {
  const ids = row.invoice_ids ?? []
  if (ids.length === 0) return Number(row.amount ?? 0)
  let open = 0
  for (const id of ids) {
    const amt = invoiceAmountById.get(id)
    if (amt === undefined) continue
    open += Math.max(0, amt - (appliedByInvoiceId.get(id) ?? 0))
  }
  return open
}

/**
 * Letters past their deadline with money still open. A letter with no
 * recorded deadline never nags; a letter whose lines have since been paid
 * clears silently.
 */
export function demandLettersOverdue(
  rows: JobDemandLetterRow[],
  invoiceAmountById: ReadonlyMap<string, number>,
  appliedByInvoiceId: ReadonlyMap<string, number>,
  todayYmd: string,
): { count: number; total: number; jobIds: string[] } {
  let count = 0
  let total = 0
  const jobIds = new Set<string>()
  for (const r of liveDemandLetters(rows)) {
    if (!r.sent_at || !r.deadline_date) continue
    if (r.deadline_date >= todayYmd) continue
    const open = demandLetterOpenRemaining(r, invoiceAmountById, appliedByInvoiceId)
    if (open <= 0) continue
    count += 1
    total += open
    jobIds.add(r.job_id)
  }
  return { count, total, jobIds: [...jobIds] }
}
