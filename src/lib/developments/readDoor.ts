/**
 * Who reads a development how (punch list #208 PR 6, v2.6053). The office set (dev, the leaders, the
 * assistants, the controller, a primary) reads `jobs_ledger` and its children under its own
 * policies, so the page reads every table directly and draws the money. An estimator has no
 * `jobs_ledger` read, so the page takes the pieces from `list_development_overview`, a definer read
 * for the GC office team that carries no money column, and draws the site with no dollar anywhere:
 * the Money look is one line that says the office reads it, the two money tiles are gone, a row's
 * price and a job's figure are not drawn, and a job's number opens nothing (the Job window reads
 * `jobs_ledger` too). Pure: the page asks for the door once and hands it down.
 */
import type { UserRole } from '../../hooks/useAuth'
import { isStaffFullJobLedgerDetailRole } from '../jobDetailModalRole'
import type { CountKey } from './countCards'
import type { MemberBid, MemberJob } from './overview'

/** `office`: every table directly, with the money. `overview`: the pieces through the definer read, no money. */
export type DevelopmentDoor = 'office' | 'overview'

/** The door for a role: the roles with a `jobs_ledger` read (the Job window's own list) come in the office door; everyone else the overview. */
export function developmentDoorFor(role: UserRole | null | undefined): DevelopmentDoor {
  return isStaffFullJobLedgerDetailRole(role ?? null) ? 'office' : 'overview'
}

/** The tiles the head draws: the office's five, or the three with no dollar in them. */
export function countKeysFor(door: DevelopmentDoor): CountKey[] {
  return door === 'office' ? ['waiting', 'bids', 'jobs', 'bidUndecided', 'openOnBills'] : ['waiting', 'bids', 'jobs']
}

/** What the Money look says, and the strip's chip, when the reader has no money. */
export const OFFICE_READS_MONEY = 'The office reads the money on this site.'
export const OFFICE_READS_MONEY_CHIP = 'the office reads it'

/** The words under a job's number when a reader with no `jobs_ledger` read presses it. */
export function jobDoorClosedWords(jobLabel: string): string {
  return `${jobLabel} opens for the office and Dispatch. Its stage, crew, plans and history are on this page.`
}

export type OverviewStatusEvent = { id: string; job_id: string; changed_at: string; from_status: string | null; to_status: string; changed_by_user_id: string | null }

export type DevelopmentOverview = {
  bids: MemberBid[]
  jobs: MemberJob[]
  statusEvents: OverviewStatusEvent[]
  teamMembers: Array<{ job_id: string; user_id: string }>
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter(isRecord) : [])
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)

/** A bid as the page's kernels read it, every money column null: the read never carried one. */
function bidOf(r: Record<string, unknown>): MemberBid {
  return {
    id: String(r.id),
    notes: str(r.notes),
    bid_number: str(r.bid_number),
    project_name: str(r.project_name),
    address: str(r.address),
    customer_id: str(r.customer_id),
    estimator_id: str(r.estimator_id),
    account_manager_id: str(r.account_manager_id),
    development_id: str(r.development_id),
    outcome: str(r.outcome),
    outcome_at: str(r.outcome_at),
    bid_value: null,
    agreed_value: null,
    priced_revenue_usd: null,
    bid_date_sent: str(r.bid_date_sent),
    bid_due_date: str(r.bid_due_date),
    estimated_job_start_date: str(r.estimated_job_start_date),
    plans_link: str(r.plans_link),
    design_drawing_plan_date: str(r.design_drawing_plan_date),
    gc_contact_name: str(r.gc_contact_name),
    gc_contact_phone: str(r.gc_contact_phone),
    gc_contact_email: str(r.gc_contact_email),
    created_at: str(r.created_at),
    updated_at: str(r.updated_at),
    working_board_archived_at: str(r.working_board_archived_at),
    working_board_archived_by: str(r.working_board_archived_by),
    service_type_id: str(r.service_type_id),
    last_contact: str(r.last_contact),
  }
}

/** A job as the page's kernels read it, with no revenue, payments, bill date, percent or collections note. */
function jobOf(r: Record<string, unknown>): MemberJob {
  return {
    id: String(r.id),
    collections_note: null,
    hcp_number: str(r.hcp_number),
    click_number: str(r.click_number),
    job_name: str(r.job_name),
    job_address: str(r.job_address),
    customer_id: str(r.customer_id),
    customer_name: str(r.customer_name),
    gc_customer_id: str(r.gc_customer_id),
    development_id: str(r.development_id),
    bid_id: str(r.bid_id),
    status: str(r.status),
    revenue: null,
    payments_made: null,
    pct_complete: null,
    last_work_date: str(r.last_work_date),
    last_bill_date: null,
    job_plans_link: str(r.job_plans_link),
    created_at: str(r.created_at),
    updated_at: str(r.updated_at),
    service_type_id: str(r.service_type_id),
    account_manager_user_id: str(r.account_manager_user_id),
  }
}

/**
 * The definer read's answer as the page's kernels take it. A list that is missing reads as empty; a
 * row with no id is dropped; an answer that is not an object is a failure with its reason, so the
 * page's retry panel names it.
 */
export function parseDevelopmentOverview(raw: unknown): DevelopmentOverview {
  if (!isRecord(raw)) throw new Error('The site did not read: the overview came back empty.')
  const withId = (rows: Record<string, unknown>[]) => rows.filter((r) => typeof r.id === 'string' && r.id)
  return {
    bids: withId(list(raw.bids)).map(bidOf),
    jobs: withId(list(raw.jobs)).map(jobOf),
    statusEvents: withId(list(raw.status_events))
      .filter((r) => typeof r.job_id === 'string' && typeof r.changed_at === 'string' && typeof r.to_status === 'string')
      .map((r) => ({ id: String(r.id), job_id: String(r.job_id), changed_at: String(r.changed_at), from_status: str(r.from_status), to_status: String(r.to_status), changed_by_user_id: str(r.changed_by_user_id) })),
    teamMembers: list(raw.team_members)
      .filter((r) => typeof r.job_id === 'string' && typeof r.user_id === 'string')
      .map((r) => ({ job_id: String(r.job_id), user_id: String(r.user_id) })),
  }
}

/** A bid read directly with its money columns left out (the overview door's address search): the kernels see null. */
export function stripBidMoney<T extends Partial<MemberBid> & { id: string }>(bid: T): T & Pick<MemberBid, 'bid_value' | 'agreed_value' | 'priced_revenue_usd'> {
  return { ...bid, bid_value: null, agreed_value: null, priced_revenue_usd: null }
}
