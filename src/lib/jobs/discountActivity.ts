/**
 * The discount trail (v2.3256): what the job's activity ledger says when a
 * save changes a discount row. The form keeps the last PERSISTED snapshot;
 * after each successful billing-slice write it diffs the new snapshot
 * against it and logs one event per real change through
 * `log_job_discount_event` — never per keystroke, never on a save that
 * changed nothing about the discounts.
 */
import { derivedDiscountDollars, discountReadout, formatPct, isDiscountRow, type DiscountLineRow } from './discountLine'

export type DiscountSnapshotEntry = {
  /** The form row id — stable for the life of the open form. */
  id: string
  name: string
  pct: number | null
  dollars: number
  /** "all 3 work lines" / "Rough In, Top Out". */
  basis: string
}

export type DiscountActivityEventType = 'discount_added' | 'discount_changed' | 'discount_removed'

export type DiscountActivityEvent = {
  event_type: DiscountActivityEventType
  summary: string
  detail: Record<string, unknown>
}

const fmtUsd = (n: number): string => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Discount rows that carry money, as the ledger would describe them. */
export function discountSnapshot(rows: readonly DiscountLineRow[]): DiscountSnapshotEntry[] {
  const out: DiscountSnapshotEntry[] = []
  for (const r of rows) {
    if (!isDiscountRow(r)) continue
    const dollars = derivedDiscountDollars(rows, r)
    if (!(dollars > 0)) continue
    out.push({
      id: r.id,
      name: (r.name ?? '').trim() || 'Discount',
      pct: r.discount_pct != null && Number.isFinite(Number(r.discount_pct)) ? Number(r.discount_pct) : null,
      dollars,
      basis: discountReadout(rows, r).basis,
    })
  }
  return out
}

function label(e: DiscountSnapshotEntry): string {
  return e.pct != null ? `${e.name} (${formatPct(e.pct)}) −$${fmtUsd(e.dollars)}` : `${e.name} −$${fmtUsd(e.dollars)}`
}

function amountWord(e: DiscountSnapshotEntry): string {
  return e.pct != null ? `${formatPct(e.pct)} (−$${fmtUsd(e.dollars)})` : `−$${fmtUsd(e.dollars)}`
}

/** One event per discount that was added, changed (name, amount or basis) or removed between two persisted snapshots. */
export function diffDiscountSnapshots(prev: readonly DiscountSnapshotEntry[], next: readonly DiscountSnapshotEntry[]): DiscountActivityEvent[] {
  const before = new Map(prev.map((e) => [e.id, e]))
  const after = new Map(next.map((e) => [e.id, e]))
  const events: DiscountActivityEvent[] = []
  for (const e of next) {
    const was = before.get(e.id)
    if (!was) {
      events.push({
        event_type: 'discount_added',
        summary: `Discount added: ${label(e)} · ${e.basis}`,
        detail: { name: e.name, pct: e.pct, dollars: e.dollars, basis: e.basis },
      })
      continue
    }
    const changed = was.name !== e.name || was.pct !== e.pct || was.dollars !== e.dollars || was.basis !== e.basis
    if (!changed) continue
    const parts: string[] = []
    if (was.name !== e.name) parts.push(`${was.name} → ${e.name}`)
    if (was.pct !== e.pct || was.dollars !== e.dollars) parts.push(`${amountWord(was)} → ${amountWord(e)}`)
    if (was.basis !== e.basis) parts.push(`${was.basis} → ${e.basis}`)
    events.push({
      event_type: 'discount_changed',
      summary: `Discount changed: ${was.name === e.name ? e.name + ' ' : ''}${parts.join(' · ')}`,
      detail: { name: e.name, pct: e.pct, dollars: e.dollars, basis: e.basis, was: { name: was.name, pct: was.pct, dollars: was.dollars, basis: was.basis } },
    })
  }
  for (const e of prev) {
    if (after.has(e.id)) continue
    events.push({
      event_type: 'discount_removed',
      summary: `Discount removed: ${label(e)}`,
      detail: { name: e.name, pct: e.pct, dollars: e.dollars, basis: e.basis },
    })
  }
  return events
}
