/**
 * Banking → User review → a cell's ledger → *Apply to 12* / *Unassign 12 shown*, after the press
 * (punch list #184, sweep A, PR 2). The run already went on past a row that failed, but the toast
 * said only *3 of 5 updated*; now each row that did not update stays named in the window with the
 * reason, and *Try the 2 again ▸* runs the same press on just those rows.
 */
import { batchOutcomeWords, countedLabel, type BatchOutcome } from '../batchWords'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'

/** A ledger row the bulk press could not update, and why. */
export type LedgerAssignFailure = { txId: string; label: string; why: string }

/** The last bulk press's failures and the value it set, so Try again sets the same one. */
export type LedgerAssignRun = { value: string; failures: LedgerAssignFailure[] }

function usd(amount: number): string {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function shortDay(iso: string | null): string {
  if (!iso) return 'no date'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'no date'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: APP_CALENDAR_TZ })
}

/** How a row is named in the list: *Vance Hardware · Oct 3, 2026 · -$123.45*. */
export function ledgerRowLabel(r: { counterparty_name: string | null; posted_at: string | null; amount: number | null }): string {
  return `${r.counterparty_name?.trim() || 'No counterparty'} · ${shortDay(r.posted_at)} · ${usd(Number.isFinite(r.amount) ? (r.amount as number) : 0)}`
}

/** The toast and the head over the rows that did not update. */
export function ledgerBulkWords(done: number, failed: number): BatchOutcome {
  return batchOutcomeWords({ verb: 'update', past: 'updated', done, failed, noun: 'transaction' })
}

/** The door over the list: *Try the 2 again ▸*, *Try it again ▸* for one. */
export function ledgerRetryLabel(failed: number): string {
  return failed === 1 ? 'Try it again ▸' : `${countedLabel('Try the', failed)} again ▸`
}

/** The failures that still name a row on screen: a row the parent no longer lists has left the cell. */
export function ledgerFailuresShown(run: LedgerAssignRun | null, rowIds: ReadonlySet<string>): LedgerAssignFailure[] {
  if (!run) return []
  return run.failures.filter((f) => rowIds.has(f.txId))
}
