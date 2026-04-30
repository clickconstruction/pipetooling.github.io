/**
 * Per–service-type display prefixes for jobs (HCP) and bids (bid #).
 * DB columns `ledger_job_prefix` / `ledger_bid_prefix` on `service_types`; null/blank → J / B.
 */

export type LedgerPrefixEntry = { job: string; bid: string }
export type LedgerPrefixMap = Record<string, LedgerPrefixEntry>

export const DEFAULT_JOB_LEDGER_PREFIX = 'J'
export const DEFAULT_BID_LEDGER_PREFIX = 'B'

export function buildLedgerPrefixMap(
  rows: readonly { id: string; ledger_job_prefix?: string | null; ledger_bid_prefix?: string | null }[],
): LedgerPrefixMap {
  const m: LedgerPrefixMap = {}
  for (const r of rows) {
    const jp = (r.ledger_job_prefix ?? '').trim()
    const bp = (r.ledger_bid_prefix ?? '').trim()
    m[r.id] = {
      job: jp || DEFAULT_JOB_LEDGER_PREFIX,
      bid: bp || DEFAULT_BID_LEDGER_PREFIX,
    }
  }
  return m
}

export function resolveJobLedgerPrefix(serviceTypeId: string | null | undefined, map: LedgerPrefixMap): string {
  if (!serviceTypeId) return DEFAULT_JOB_LEDGER_PREFIX
  return map[serviceTypeId]?.job ?? DEFAULT_JOB_LEDGER_PREFIX
}

export function resolveBidLedgerPrefix(serviceTypeId: string | null | undefined, map: LedgerPrefixMap): string {
  if (!serviceTypeId) return DEFAULT_BID_LEDGER_PREFIX
  return map[serviceTypeId]?.bid ?? DEFAULT_BID_LEDGER_PREFIX
}

export function formatJobLedgerNumberLabel(prefix: string, hcpNumber: string | null | undefined): string {
  const pref = (prefix ?? '').trim() || DEFAULT_JOB_LEDGER_PREFIX
  const n = (hcpNumber ?? '').trim() || '—'
  return `${pref}${n}`
}

export function formatBidLedgerNumberLabel(prefix: string, bidNumber: string | null | undefined): string {
  const pref = (prefix ?? '').trim() || DEFAULT_BID_LEDGER_PREFIX
  const n = (bidNumber ?? '').trim() || '—'
  return `${pref}${n}`
}

/** "JP523 · Mission Hills - 123 Main" */
export function formatJobLedgerSummaryLine(
  map: LedgerPrefixMap,
  serviceTypeId: string | null | undefined,
  hcpNumber: string | null | undefined,
  jobName: string | null | undefined,
  jobAddress: string | null | undefined,
): string {
  const num = formatJobLedgerNumberLabel(resolveJobLedgerPrefix(serviceTypeId, map), hcpNumber)
  const name = (jobName ?? '').trim() || '—'
  const addr = (jobAddress ?? '').trim() || '—'
  return `${num} · ${name} - ${addr}`
}

/** "BP12 · Project - address" */
export function formatBidLedgerSummaryLine(
  map: LedgerPrefixMap,
  serviceTypeId: string | null | undefined,
  bidNumber: string | null | undefined,
  projectName: string | null | undefined,
  addressOrCustomer: string | null | undefined,
): string {
  const num = formatBidLedgerNumberLabel(resolveBidLedgerPrefix(serviceTypeId, map), bidNumber)
  const pn = (projectName ?? '').trim() || '—'
  const ad = (addressOrCustomer ?? '').trim() || '—'
  return `${num} · ${pn} - ${ad}`
}

/** "JP523 · Mission Hills" (no address) */
export function formatJobLedgerShortLine(
  map: LedgerPrefixMap,
  serviceTypeId: string | null | undefined,
  hcpNumber: string | null | undefined,
  jobName: string | null | undefined,
): string {
  const num = formatJobLedgerNumberLabel(resolveJobLedgerPrefix(serviceTypeId, map), hcpNumber)
  const name = (jobName ?? '').trim() || '—'
  return `${num} · ${name}`
}

/** "BP12 · Project" */
export function formatBidLedgerShortLine(
  map: LedgerPrefixMap,
  serviceTypeId: string | null | undefined,
  bidNumber: string | null | undefined,
  projectName: string | null | undefined,
): string {
  const num = formatBidLedgerNumberLabel(resolveBidLedgerPrefix(serviceTypeId, map), bidNumber)
  const pn = (projectName ?? '').trim() || '—'
  return `${num} · ${pn}`
}

/** Document-style "JP523 | Mission Hills" */
export function formatJobLedgerDocTitle(
  map: LedgerPrefixMap,
  serviceTypeId: string | null | undefined,
  hcpNumber: string | null | undefined,
  jobName: string | null | undefined,
): string {
  const num = formatJobLedgerNumberLabel(resolveJobLedgerPrefix(serviceTypeId, map), hcpNumber)
  const jn = (jobName ?? '').trim() || '—'
  return `${num} | ${jn}`
}

export function formatBidLedgerDocTitle(
  map: LedgerPrefixMap,
  serviceTypeId: string | null | undefined,
  bidNumber: string | null | undefined,
  titleBase: string,
): string {
  const num = formatBidLedgerNumberLabel(resolveBidLedgerPrefix(serviceTypeId, map), bidNumber)
  return `${num} | ${titleBase}`
}
