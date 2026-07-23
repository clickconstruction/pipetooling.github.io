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

/**
 * True when `query` matches a bid's number or its prefixed label.
 * Spaces are ignored, so "287", "BP287" and "bp 287" all match bid #287 with prefix BP.
 */
export function bidNumberMatchesQuery(
  bid: { bid_number?: string | null; service_type_id?: string | null },
  query: string,
  map: LedgerPrefixMap,
): boolean {
  const q = query.trim().toLowerCase().replace(/\s+/g, '')
  if (!q) return false
  const num = (bid.bid_number ?? '').trim().toLowerCase()
  if (!num) return false
  if (num.includes(q)) return true
  const label = `${resolveBidLedgerPrefix(bid.service_type_id, map)}${num}`.toLowerCase()
  return label.includes(q)
}

/**
 * Effective displayed job number: the HCP number when present, otherwise the
 * Click number ("C#"). HCP always wins. Returns '' when both are empty.
 */
export function effectiveJobLedgerNumber(
  hcpNumber: string | null | undefined,
  clickNumber: string | null | undefined,
): string {
  return (hcpNumber ?? '').trim() || (clickNumber ?? '').trim() || ''
}

export function formatJobLedgerNumberLabel(
  prefix: string,
  hcpNumber: string | null | undefined,
  clickNumber: string | null | undefined,
): string {
  const pref = (prefix ?? '').trim() || DEFAULT_JOB_LEDGER_PREFIX
  const n = effectiveJobLedgerNumber(hcpNumber, clickNumber) || '—'
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
  clickNumber: string | null | undefined,
): string {
  const num = formatJobLedgerNumberLabel(resolveJobLedgerPrefix(serviceTypeId, map), hcpNumber, clickNumber)
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
  clickNumber: string | null | undefined,
): string {
  const num = formatJobLedgerNumberLabel(resolveJobLedgerPrefix(serviceTypeId, map), hcpNumber, clickNumber)
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
  clickNumber: string | null | undefined,
): string {
  const num = formatJobLedgerNumberLabel(resolveJobLedgerPrefix(serviceTypeId, map), hcpNumber, clickNumber)
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
