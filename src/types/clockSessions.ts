import type { LedgerPrefixMap } from '../lib/ledgerDisplayPrefixes'
import {
  formatBidLedgerShortLine,
  formatBidLedgerSummaryLine,
  formatJobLedgerShortLine,
  formatJobLedgerSummaryLine,
  formatBidLedgerNumberLabel,
  formatJobLedgerNumberLabel,
  resolveBidLedgerPrefix,
  resolveJobLedgerPrefix,
} from '../lib/ledgerDisplayPrefixes'

/** Dashboard "Currently In" row when schedule implies on-shift but no open `clock_sessions` row yet. */
export type SyntheticSalaryStripSession = {
  kind: 'synthetic_salary'
  id: string
  user_id: string
  clocked_in_at: string
  clocked_out_at: null
  work_date: string
  notes: string
  job_ledger_id: null
  bid_id: null
  approved_at: null
  rejected_at: null
  revoked_at: null
  users: { name: string | null } | null
  jobs_ledger: null
  bids: null
}

export type DashboardStripSession = ClockSessionRow | SyntheticSalaryStripSession

export function isSyntheticSalaryStripSession(s: DashboardStripSession): s is SyntheticSalaryStripSession {
  return (s as SyntheticSalaryStripSession).kind === 'synthetic_salary'
}

/** Muted “(s)” in Currently In when row is schedule-driven (synthetic or real salary_schedule session). */
export function shouldShowSalaryStripNameSuffix(s: DashboardStripSession): boolean {
  if (isSyntheticSalaryStripSession(s)) return true
  return (s as ClockSessionRow).origin === 'salary_schedule'
}

export type ClockSessionRow = {
  id: string
  user_id: string
  clocked_in_at: string
  clocked_out_at: string | null
  work_date: string
  notes: string
  /** user_punch | salary_schedule */
  origin?: string
  salary_segment_index?: number | null
  /** Split/cluster RPCs from indexed salary_schedule → user_punch; salary_sync may clock out at block end */
  salary_split_derived?: boolean | null
  job_ledger_id: string | null
  bid_id: string | null
  clock_in_lat: number | null
  clock_in_lng: number | null
  clock_out_lat: number | null
  clock_out_lng: number | null
  /** gps | ip — null for legacy rows or punches without coordinates */
  clock_in_location_source: string | null
  clock_out_location_source: string | null
  approved_at: string | null
  approved_by: string | null
  rejected_at: string | null
  rejected_by: string | null
  revoked_at: string | null
  revoked_by: string | null
  users: { name: string | null } | null
  approved_by_user: { name: string | null } | null
  rejected_by_user: { name: string | null } | null
  revoked_by_user: { name: string | null } | null
  jobs_ledger: {
    hcp_number: string | null
    job_name: string | null
    job_address: string | null
    service_type_id?: string | null
  } | null
  bids: {
    bid_number: string | null
    project_name: string | null
    address: string | null
    service_type_id?: string | null
    customers: { name: string | null } | null
  } | null
}

export type ClockSessionJobBidEmbeds = Pick<ClockSessionRow, 'jobs_ledger' | 'bids'>

/** Two-line label for Session actions modal: HCP · name, then address (or bid equivalent). */
export function formatClockSessionJobOrBidModalLinesFromEmbeds(
  embeds: ClockSessionJobBidEmbeds,
  prefixMap: LedgerPrefixMap,
): { line1: string; line2: string | null } | null {
  if (embeds.jobs_ledger) {
    const jl = embeds.jobs_ledger
    const st = jl.service_type_id ?? null
    const name = (jl.job_name || '—').trim()
    const addr = (jl.job_address || '').trim()
    const num = formatJobLedgerNumberLabel(resolveJobLedgerPrefix(st, prefixMap), jl.hcp_number)
    return {
      line1: `${num} · ${name}`,
      line2: addr.length > 0 ? addr : null,
    }
  }
  if (embeds.bids) {
    const b = embeds.bids
    const st = b.service_type_id ?? null
    const pn = (b.project_name || '—').trim()
    const addr = (b.address || b.customers?.name || '').trim()
    const num = formatBidLedgerNumberLabel(resolveBidLedgerPrefix(st, prefixMap), b.bid_number)
    return {
      line1: `${num} · ${pn}`,
      line2: addr.length > 0 ? addr : null,
    }
  }
  return null
}

/** Full job/bid one-line label from embedded rows only. */
export function formatClockSessionJobOrBidLabelFromEmbeds(
  embeds: ClockSessionJobBidEmbeds,
  prefixMap: LedgerPrefixMap,
): string | null {
  if (embeds.jobs_ledger) {
    const jl = embeds.jobs_ledger
    return formatJobLedgerSummaryLine(
      prefixMap,
      jl.service_type_id ?? null,
      jl.hcp_number,
      jl.job_name,
      jl.job_address,
    )
  }
  if (embeds.bids) {
    const b = embeds.bids
    return formatBidLedgerSummaryLine(
      prefixMap,
      b.service_type_id ?? null,
      b.bid_number,
      b.project_name,
      b.address || b.customers?.name,
    )
  }
  return null
}

/** Short label for dense tables (e.g. clock strip). */
export function shortJobOrBidLabelFromEmbeds(embeds: ClockSessionJobBidEmbeds, prefixMap: LedgerPrefixMap): string | null {
  if (embeds.jobs_ledger) {
    const jl = embeds.jobs_ledger
    return formatJobLedgerShortLine(prefixMap, jl.service_type_id ?? null, jl.hcp_number, jl.job_name)
  }
  if (embeds.bids) {
    const b = embeds.bids
    return formatBidLedgerShortLine(prefixMap, b.service_type_id ?? null, b.bid_number, b.project_name)
  }
  return null
}

/** Job or bid one-line label for display; null if neither is linked. */
export function formatClockSessionJobOrBidLabel(s: ClockSessionRow, prefixMap: LedgerPrefixMap): string | null {
  return formatClockSessionJobOrBidLabelFromEmbeds(s, prefixMap)
}
