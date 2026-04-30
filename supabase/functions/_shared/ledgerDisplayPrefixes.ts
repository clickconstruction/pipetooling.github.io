/** Mirrors app `ledgerDisplayPrefixes`: null/blank DB prefix → J / B. */

export const DEFAULT_JOB_LEDGER_PREFIX = 'J'
export const DEFAULT_BID_LEDGER_PREFIX = 'B'

export function formatJobLedgerNumberLabel(prefix: string | null | undefined, hcpNumber: string | null | undefined): string {
  const pref = (prefix ?? '').trim() || DEFAULT_JOB_LEDGER_PREFIX
  const n = (hcpNumber ?? '').trim() || '—'
  return `${pref}${n}`
}

export function formatBidLedgerNumberLabel(prefix: string | null | undefined, bidNumber: string | null | undefined): string {
  const pref = (prefix ?? '').trim() || DEFAULT_BID_LEDGER_PREFIX
  const n = (bidNumber ?? '').trim() || '—'
  return `${pref}${n}`
}
