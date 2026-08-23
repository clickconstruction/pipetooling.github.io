/**
 * Quickfill → Jobs Cleanup (v2.2145): sub labor sheets that aren't attached
 * to a job. "Unlinked" = the sheet's typed `job_number` resolves to no job
 * (blank, or a number matching nothing by HCP / Click # / effective number —
 * the same rule Edit Sub Labor's Job field uses). A sheet whose number
 * resolves is linked, however long ago it was typed; nothing re-links here.
 * Paid sheets still count — unattached cost rolls up to no job either way.
 */
import { laborItemsSubtotal, type PeopleLaborJobItemLike } from '../peopleLaborJobItemLineCost'
import { resolveSubLaborJobByNumber, type SubLaborPickerJobSlice } from './subLaborJobPicker'

export type UnlinkedSubLaborSheetInput = {
  id: string
  assigned_to_name: string | null
  address: string | null
  job_number: string | null
  job_date: string | null
  labor_rate: number | null
  items?: PeopleLaborJobItemLike[] | null
  payments?: Array<{ amount: number | null }> | null
}

export type UnlinkedSubLaborRow = {
  id: string
  /** Contractor names joined for display (the sheet's delimiter is " | "). */
  contractor: string
  /** A typed number that matched no job; null when the sheet has no number at all. */
  typedNumber: string | null
  address: string
  /** YYYY-MM-DD or null. */
  dateYmd: string | null
  total: number
  paid: number
  backcharges: number
  due: number
}

const LABOR_ASSIGNED_DELIMITER = ' | '

export function buildUnlinkedSubLaborRows(
  sheets: readonly UnlinkedSubLaborSheetInput[],
  jobs: readonly SubLaborPickerJobSlice[],
): UnlinkedSubLaborRow[] {
  const out: UnlinkedSubLaborRow[] = []
  for (const s of sheets) {
    const typed = (s.job_number ?? '').trim()
    if (typed && resolveSubLaborJobByNumber(jobs, typed)) continue
    const fallbackRate = s.labor_rate ?? 0
    let total = laborItemsSubtotal(s.items ?? undefined, fallbackRate)
    const payments = s.payments ?? []
    const paid = payments.filter((p) => Number(p.amount ?? 0) >= 0).reduce((t, p) => t + Number(p.amount ?? 0), 0)
    const backcharges = payments.filter((p) => Number(p.amount ?? 0) < 0).reduce((t, p) => t + Math.abs(Number(p.amount ?? 0)), 0)
    if (total === 0 && (paid > 0 || backcharges > 0)) total = paid + backcharges
    out.push({
      id: s.id,
      contractor:
        (s.assigned_to_name ?? '')
          .split(LABOR_ASSIGNED_DELIMITER)
          .map((n) => n.trim())
          .filter(Boolean)
          .join(', ') || 'No contractor',
      typedNumber: typed || null,
      address: (s.address ?? '').trim(),
      dateYmd: (s.job_date ?? '').trim() || null,
      total,
      paid,
      backcharges,
      due: total - paid - backcharges,
    })
  }
  // Newest labor date first (undated last), then biggest dollars.
  out.sort((a, b) => {
    if (a.dateYmd && b.dateYmd && a.dateYmd !== b.dateYmd) return b.dateYmd.localeCompare(a.dateYmd)
    if (a.dateYmd && !b.dateYmd) return -1
    if (!a.dateYmd && b.dateYmd) return 1
    return b.total - a.total
  })
  return out
}

export function sumUnlinkedSubLabor(rows: readonly UnlinkedSubLaborRow[]): { total: number; due: number } {
  return rows.reduce((acc, r) => ({ total: acc.total + r.total, due: acc.due + Math.max(0, r.due) }), { total: 0, due: 0 })
}
