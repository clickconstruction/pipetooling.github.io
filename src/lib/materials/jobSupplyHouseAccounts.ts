/**
 * Job accounts at the counter (v2.3423, PR 1 of the train): a supply house's
 * **job account** — the per-property account Ferguson, Reece or Moore opens
 * so a job's purchases land on their own statement — as a status on the job,
 * per house. Rows live in `job_supply_house_accounts`; no row means none yet.
 *
 * Pure: statuses, labels, the per-house roster (accounts beside the
 * evidence of buying — invoices allocated to a job at this house with no
 * account on record), and the per-job read the strip uses.
 */

// ---------- the house: does it expect one? ----------

export const JOB_ACCOUNT_POLICIES = ['expects', 'optional', 'none'] as const
export type JobAccountPolicy = (typeof JOB_ACCOUNT_POLICIES)[number]

export const JOB_ACCOUNT_POLICY_LABELS: Record<JobAccountPolicy, string> = {
  expects: 'Expects one per property',
  optional: 'Optional',
  none: 'None',
}

/** One-line meaning for the form's chips. */
export const JOB_ACCOUNT_POLICY_HINTS: Record<JobAccountPolicy, string> = {
  expects: 'The house opens a job account per property. Jobs that buy here with no account on record get a signal — on the job, at the PO code, and on the Dashboard.',
  optional: 'The house can open one; nothing signals when a job has none.',
  none: 'Never — insurers, online orders, payee-only vendors.',
}

export function isJobAccountPolicy(value: unknown): value is JobAccountPolicy {
  return typeof value === 'string' && (JOB_ACCOUNT_POLICIES as readonly string[]).includes(value)
}

/** The policy of a house row; a missing column (pre-push) reads as optional. */
export function jobAccountPolicyOf(row: { job_accounts?: string | null }): JobAccountPolicy {
  return isJobAccountPolicy(row.job_accounts) ? row.job_accounts : 'optional'
}

// ---------- the contact: who opens them ----------

export const SUPPLY_HOUSE_CONTACT_ROLES = ['price_requests', 'job_accounts', 'billing'] as const
export type SupplyHouseContactRole = (typeof SUPPLY_HOUSE_CONTACT_ROLES)[number]

export const SUPPLY_HOUSE_CONTACT_ROLE_LABELS: Record<SupplyHouseContactRole, string> = {
  price_requests: 'Price requests',
  job_accounts: 'Job accounts',
  billing: 'Billing',
}

export function isSupplyHouseContactRole(value: unknown): value is SupplyHouseContactRole {
  return typeof value === 'string' && (SUPPLY_HOUSE_CONTACT_ROLES as readonly string[]).includes(value)
}

/** A contact's role; a missing column (pre-push) reads as price requests. */
export function contactRoleOf(row: { role?: string | null }): SupplyHouseContactRole {
  return isSupplyHouseContactRole(row.role) ? row.role : 'price_requests'
}

export interface JobAccountRep {
  id: string
  name: string | null
  email: string
  phone: string | null
  label?: string | null
}

/** The rep to call about job accounts: the first `job_accounts` contact (input order), else null. */
export function jobAccountRepOf<C extends JobAccountRep & { role?: string | null; archived_at?: string | null }>(contacts: C[]): C | null {
  return contacts.find((c) => contactRoleOf(c) === 'job_accounts' && !c.archived_at) ?? null
}

export function repDisplayName(rep: Pick<JobAccountRep, 'name' | 'email' | 'label'>): string {
  return (rep.name ?? '').trim() || (rep.label ?? '').trim() || rep.email
}

// ---------- the record ----------

export const JOB_ACCOUNT_STATUSES = ['requested', 'open', 'not_needed'] as const
export type JobAccountStatus = (typeof JOB_ACCOUNT_STATUSES)[number]

export const JOB_ACCOUNT_OPENED_VIA = ['phone', 'packet', 'counter'] as const
export type JobAccountOpenedVia = (typeof JOB_ACCOUNT_OPENED_VIA)[number]

export const JOB_ACCOUNT_OPENED_VIA_LABELS: Record<JobAccountOpenedVia, string> = {
  phone: 'By phone',
  packet: 'The packet',
  counter: 'At the counter',
}

export function isJobAccountStatus(value: unknown): value is JobAccountStatus {
  return typeof value === 'string' && (JOB_ACCOUNT_STATUSES as readonly string[]).includes(value)
}

export function isJobAccountOpenedVia(value: unknown): value is JobAccountOpenedVia {
  return typeof value === 'string' && (JOB_ACCOUNT_OPENED_VIA as readonly string[]).includes(value)
}

/** A `job_supply_house_accounts` row as the app reads it. */
export interface JobSupplyHouseAccountRow {
  id: string
  job_id: string
  supply_house_id: string
  status: string
  account_ref: string
  opened_via: string | null
  rep_contact_id: string | null
  requested_by: string | null
  requested_at: string | null
  requested_from_counter: boolean
  opened_by: string | null
  opened_at: string | null
  note: string
}

export function jobAccountStatusLabel(status: JobAccountStatus): string {
  switch (status) {
    case 'requested': return 'requested'
    case 'open': return 'open'
    case 'not_needed': return 'not needed'
  }
}

/** "opened by phone", "opened with the packet", "opened at the counter", or just "opened". */
export function openedViaPhrase(via: string | null | undefined): string {
  switch (via) {
    case 'phone': return 'opened by phone'
    case 'packet': return 'opened with the packet'
    case 'counter': return 'opened at the counter'
    default: return 'opened'
  }
}

// ---------- the roster for one house ----------

export interface RosterInvoiceInput {
  id: string
  amount: number
  is_paid: boolean
  job_allocations?: Array<{ job_id: string; pct: number }>
}

export type HouseRosterKind = 'requested' | 'bought_no_account' | 'open' | 'not_needed'

export interface HouseRosterRow {
  jobId: string
  kind: HouseRosterKind
  /** The account row when one exists (every kind but bought_no_account). */
  account: JobSupplyHouseAccountRow | null
  /** Invoices allocated to this job at this house (all, paid or not). */
  invoiceCount: number
  /** Dollars of those invoices allocated to this job (amount × pct / 100). */
  allocatedTotal: number
  /** The unpaid share of allocatedTotal. */
  unpaidTotal: number
}

const KIND_ORDER: Record<HouseRosterKind, number> = { requested: 0, bought_no_account: 1, open: 2, not_needed: 3 }

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * The roster of a house's job accounts: every job with an account row, plus
 * every job that bought here (an invoice allocated to it) with no row — the
 * evidence case the office should decide. Requested first (someone is
 * waiting), then bought-with-no-account, then open, then not needed; within a
 * kind, biggest unpaid dollars first, then most recent.
 */
export function buildHouseJobAccountRoster(
  houseId: string,
  accounts: JobSupplyHouseAccountRow[],
  invoices: RosterInvoiceInput[],
): HouseRosterRow[] {
  const byJob = new Map<string, HouseRosterRow>()
  const ensure = (jobId: string): HouseRosterRow => {
    let row = byJob.get(jobId)
    if (!row) {
      row = { jobId, kind: 'bought_no_account', account: null, invoiceCount: 0, allocatedTotal: 0, unpaidTotal: 0 }
      byJob.set(jobId, row)
    }
    return row
  }
  for (const a of accounts) {
    if (a.supply_house_id !== houseId) continue
    const row = ensure(a.job_id)
    row.account = a
    row.kind = a.status === 'open' ? 'open' : a.status === 'not_needed' ? 'not_needed' : 'requested'
  }
  for (const inv of invoices) {
    for (const alloc of inv.job_allocations ?? []) {
      const pct = Number(alloc.pct)
      if (!Number.isFinite(pct) || pct <= 0) continue
      const share = (Number(inv.amount) || 0) * pct / 100
      const row = ensure(alloc.job_id)
      row.invoiceCount += 1
      row.allocatedTotal = round2(row.allocatedTotal + share)
      if (!inv.is_paid) row.unpaidTotal = round2(row.unpaidTotal + share)
    }
  }
  return [...byJob.values()].sort((a, b) => {
    const k = KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
    if (k !== 0) return k
    if (b.unpaidTotal !== a.unpaidTotal) return b.unpaidTotal - a.unpaidTotal
    const ta = a.account?.requested_at ?? a.account?.opened_at ?? ''
    const tb = b.account?.requested_at ?? b.account?.opened_at ?? ''
    return ta < tb ? 1 : ta > tb ? -1 : a.jobId.localeCompare(b.jobId)
  })
}

export interface HouseRosterCounts {
  requested: number
  boughtNoAccount: number
  open: number
  notNeeded: number
}

export function countHouseRoster(rows: HouseRosterRow[]): HouseRosterCounts {
  const c: HouseRosterCounts = { requested: 0, boughtNoAccount: 0, open: 0, notNeeded: 0 }
  for (const r of rows) {
    if (r.kind === 'requested') c.requested += 1
    else if (r.kind === 'bought_no_account') c.boughtNoAccount += 1
    else if (r.kind === 'open') c.open += 1
    else c.notNeeded += 1
  }
  return c
}

/** The roster's header line: "6 open · 1 requested · 2 bought with no account" (zero parts dropped; "none yet" when all are). */
export function houseRosterSummary(counts: HouseRosterCounts): string {
  const parts: string[] = []
  if (counts.open > 0) parts.push(`${counts.open} open`)
  if (counts.requested > 0) parts.push(`${counts.requested} requested`)
  if (counts.boughtNoAccount > 0) parts.push(`${counts.boughtNoAccount} bought with no account`)
  if (counts.notNeeded > 0) parts.push(`${counts.notNeeded} not needed`)
  return parts.length > 0 ? parts.join(' · ') : 'none yet'
}

// ---------- the per-job read (the strip, PR 2) ----------

export type JobHouseAccountState = 'open' | 'requested' | 'not_needed' | 'none'

export interface JobHouseAccountView {
  houseId: string
  houseName: string
  state: JobHouseAccountState
  account: JobSupplyHouseAccountRow | null
}

/**
 * One entry per house that expects job accounts, in the given house order,
 * plus any other house the job already has a row at (so an optional house's
 * open account still shows). `none` for expecting houses with no row.
 */
export function jobAccountsForJob(
  jobId: string,
  houses: Array<{ id: string; name: string; job_accounts?: string | null }>,
  accounts: JobSupplyHouseAccountRow[],
): JobHouseAccountView[] {
  const rowsByHouse = new Map<string, JobSupplyHouseAccountRow>()
  for (const a of accounts) if (a.job_id === jobId) rowsByHouse.set(a.supply_house_id, a)
  const out: JobHouseAccountView[] = []
  for (const h of houses) {
    const row = rowsByHouse.get(h.id) ?? null
    const expects = jobAccountPolicyOf(h) === 'expects'
    if (!row && !expects) continue
    const state: JobHouseAccountState = !row ? 'none' : row.status === 'open' ? 'open' : row.status === 'not_needed' ? 'not_needed' : 'requested'
    out.push({ houseId: h.id, houseName: h.name, state, account: row })
  }
  return out
}
