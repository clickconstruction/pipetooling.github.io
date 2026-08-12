/**
 * Dashboard AR modal line items (v2.1595, mockup-approved "Variant B").
 *
 * Invoices don't store their own lines — bills are composed from the job's
 * Specific Work fixtures (`jobs_ledger_fixtures`, see docs/BILLING_FLOWS.md
 * "Bill composition"). The AR drill-down shows each row's job fixtures behind
 * an "N line items" chip. Billable rule matches every bill builder: non-empty
 * name AND count × unit > 0.
 */

export type ArFixtureRow = {
  job_id: string
  name: string | null
  count: number | null
  line_unit_price: number | null
  sequence_order: number | null
}

export type ArLineItem = {
  /** "Water heater 50 gal ×2" — count suffix only when above 1. */
  label: string
  /** Extended dollars: count × line_unit_price. */
  amount: number
}

/** Group billable fixture lines by job, in sequence order (unsequenced last, then by name). */
export function buildArLineItemsByJob(rows: ArFixtureRow[]): Map<string, ArLineItem[]> {
  const sorted = [...rows].sort((a, b) => {
    const sa = a.sequence_order ?? Number.MAX_SAFE_INTEGER
    const sb = b.sequence_order ?? Number.MAX_SAFE_INTEGER
    if (sa !== sb) return sa - sb
    return (a.name ?? '').localeCompare(b.name ?? '')
  })
  const byJob = new Map<string, ArLineItem[]>()
  for (const r of sorted) {
    const name = (r.name ?? '').trim()
    const count = Number(r.count ?? 0)
    const unit = Number(r.line_unit_price ?? 0)
    const amount = count * unit
    if (!name || !(amount > 0)) continue
    const label = count > 1 ? `${name} ×${count}` : name
    const list = byJob.get(r.job_id)
    if (list) list.push({ label, amount })
    else byJob.set(r.job_id, [{ label, amount }])
  }
  return byJob
}
