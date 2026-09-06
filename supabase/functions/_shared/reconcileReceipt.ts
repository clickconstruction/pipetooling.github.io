/**
 * Reconciliation receipt (journey map Tier 5 X4 / J33-F3, J33-N4, J33-N6; cluster C7).
 *
 * `mercury-reconcile` used to hand back numbers that died with the tab: zero writes, no
 * "did the books match the bank on Friday?" answer, and a green check that read as
 * "books equal bank" although the compare is presence-only, statement → books. This
 * kernel turns one run's result into a receipt that states its scope in words and is
 * persisted as one `mercury_reconcile_runs` row. Shared by the Deno function (writer)
 * and the client (reader) — no imports from either side.
 */

export const RECEIPT_EPSILON = 0.01

/** The slice of the run result the receipt needs (structural — both sides' types satisfy it). */
export type ReceiptInputMonth = { period: string; statementCount: number; presentCount: number; missingCount: number }
export type ReceiptInputAccount = {
  id: string
  name: string
  months: ReceiptInputMonth[]
  current: { delta: number | null }
}
export type ReceiptInput = { monthsBack: number; accounts: ReceiptInputAccount[] }

export type ReceiptAccount = {
  id: string
  name: string
  statementLines: number
  present: number
  missing: number
  monthsWithMissing: number
  /** YYYY-MM of the oldest / newest statement checked (null when the account had none). */
  oldestPeriod: string | null
  newestPeriod: string | null
  currentDelta: number | null
  currentStatus: 'ok' | 'drift' | 'unknown'
}

export type ReconcileReceipt = {
  monthsBack: number
  accountsChecked: number
  statementLines: number
  statementLinesPresent: number
  monthsWithMissing: number
  /** true = every account's live balance within $0.01 of expected; false = at least one off; null = none could be checked. */
  currentWithinEpsilon: boolean | null
  /** The scope sentence — what this run compared and what it did not. */
  scope: string
  accounts: ReceiptAccount[]
}

function currentStatus(delta: number | null): ReceiptAccount['currentStatus'] {
  if (delta === null || !Number.isFinite(delta)) return 'unknown'
  return Math.abs(delta) <= RECEIPT_EPSILON ? 'ok' : 'drift'
}

export function buildReconcileReceipt(input: ReceiptInput): ReconcileReceipt {
  const accounts: ReceiptAccount[] = input.accounts.map((a) => {
    const periods = a.months.map((m) => m.period).filter((p) => p && p.length >= 7).sort()
    const statementLines = a.months.reduce((s, m) => s + m.statementCount, 0)
    const present = a.months.reduce((s, m) => s + m.presentCount, 0)
    return {
      id: a.id,
      name: a.name,
      statementLines,
      present,
      missing: statementLines - present,
      monthsWithMissing: a.months.filter((m) => m.missingCount > 0).length,
      oldestPeriod: periods[0] ?? null,
      newestPeriod: periods[periods.length - 1] ?? null,
      currentDelta: a.current.delta,
      currentStatus: currentStatus(a.current.delta),
    }
  })
  const statementLines = accounts.reduce((s, a) => s + a.statementLines, 0)
  const statementLinesPresent = accounts.reduce((s, a) => s + a.present, 0)
  const monthsWithMissing = accounts.reduce((s, a) => s + a.monthsWithMissing, 0)
  const checked = accounts.filter((a) => a.currentStatus !== 'unknown')
  const currentWithinEpsilon = checked.length === 0 ? null : checked.every((a) => a.currentStatus === 'ok')
  const receipt: ReconcileReceipt = {
    monthsBack: input.monthsBack,
    accountsChecked: accounts.length,
    statementLines,
    statementLinesPresent,
    monthsWithMissing,
    currentWithinEpsilon,
    scope: '',
    accounts,
  }
  receipt.scope = reconcileScopeSentence(receipt)
  return receipt
}

/** "412 of 412 statement transactions present in the books across 2 accounts, Mar–Aug 2026; live balance within $0.01 on every account. Scope: presence only, statement → books — …" */
export function reconcileScopeSentence(r: ReconcileReceipt): string {
  const periods = r.accounts.flatMap((a) => [a.oldestPeriod, a.newestPeriod]).filter((p): p is string => !!p).sort()
  const span = periods.length === 0 ? `the last ${r.monthsBack} months` : periods[0] === periods[periods.length - 1] ? periods[0]! : `${periods[0]} – ${periods[periods.length - 1]}`
  const presence = `${r.statementLinesPresent.toLocaleString('en-US')} of ${r.statementLines.toLocaleString('en-US')} statement transaction${r.statementLines === 1 ? '' : 's'} present in the books across ${r.accountsChecked} account${r.accountsChecked === 1 ? '' : 's'}, ${span}`
  const missing = r.monthsWithMissing > 0 ? `; ${r.monthsWithMissing} month${r.monthsWithMissing === 1 ? '' : 's'} with something missing` : ''
  const live =
    r.currentWithinEpsilon === null
      ? '; live balance not checked'
      : r.currentWithinEpsilon
        ? '; live balance within $0.01 on every account'
        : `; live balance off on ${r.accounts.filter((a) => a.currentStatus === 'drift').length} account${r.accounts.filter((a) => a.currentStatus === 'drift').length === 1 ? '' : 's'}`
  return `${presence}${missing}${live}. Scope: presence only, statement → books — books-only rows and amount differences are not checked; manual transactions have no statement.`
}

/** One-line verdict for the run list. */
export function receiptVerdict(r: Pick<ReconcileReceipt, 'statementLines' | 'statementLinesPresent' | 'currentWithinEpsilon'>): { ok: boolean; label: string } {
  const allPresent = r.statementLines === r.statementLinesPresent
  const ok = allPresent && r.currentWithinEpsilon !== false
  const presence = `${r.statementLinesPresent.toLocaleString('en-US')} / ${r.statementLines.toLocaleString('en-US')} present`
  const live = r.currentWithinEpsilon === null ? '' : r.currentWithinEpsilon ? ' · balance ✓' : ' · balance off'
  return { ok, label: `${presence}${live}` }
}
