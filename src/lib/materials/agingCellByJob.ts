/**
 * The aging-cell window by job (v2.5694): a cell's invoices grouped under their job, each job with its job-account
 * state in words, and the cell's split between what is on a job account (the property owner's debt) and what is not
 * (Click's). A job account belongs to one property at one house, so the state is the job's, not each invoice's.
 * Pure: the window passes each invoice's allocations and each (job, house) account row.
 *
 * Groups: one per (job, house) for the invoices on exactly one job; then the invoices split across jobs, the ones on
 * no job yet, and credit memos, each a group of its own, since none of them can sit on a job account as it stands.
 */
import type { JobSupplyHouseAccountRow } from './jobSupplyHouseAccounts'

/** What the window needs of an invoice. */
export interface AgingCellRowLike {
  id: string
  amount: number | null
  on_job_account: boolean | null
  supply_house_id: string
}

/** A job's job-account state at the invoice's house, as the window says it. */
export type AgingCellJobState =
  | { kind: 'loading' }
  | { kind: 'all_on' }
  | { kind: 'open'; account: JobSupplyHouseAccountRow }
  | { kind: 'requested'; account: JobSupplyHouseAccountRow }
  | { kind: 'not_needed'; account: JobSupplyHouseAccountRow }
  | { kind: 'none' }

export interface AgingCellJobGroup<R extends AgingCellRowLike> {
  jobId: string
  houseId: string
  rows: R[]
  total: number
  /** The part not on a job account. Groups are ordered by it, largest first. */
  offTotal: number
  onCount: number
  offCount: number
  state: AgingCellJobState
}

export interface AgingCellByJob<R extends AgingCellRowLike> {
  jobs: AgingCellJobGroup<R>[]
  split: R[]
  noJob: R[]
  credits: R[]
}

const amountOf = (r: AgingCellRowLike) => Number(r.amount ?? 0)
const isCredit = (r: AgingCellRowLike) => amountOf(r) < 0
const isOn = (r: AgingCellRowLike) => r.on_job_account === true

/**
 * Group a cell's rows by job. `accountOf` answers the (job, house) account row: null when checked and none on record,
 * undefined while still loading. Rows keep their order inside a group.
 */
export function groupAgingCellByJob<R extends AgingCellRowLike>(
  rows: readonly R[],
  allocationsOf: (invoiceId: string) => ReadonlyArray<{ job_id: string }>,
  accountOf: (jobId: string, houseId: string) => JobSupplyHouseAccountRow | null | undefined,
): AgingCellByJob<R> {
  const groups = new Map<string, { jobId: string; houseId: string; rows: R[] }>()
  const split: R[] = []
  const noJob: R[] = []
  const credits: R[] = []
  for (const r of rows) {
    if (isCredit(r)) {
      credits.push(r)
      continue
    }
    const allocations = allocationsOf(r.id)
    if (allocations.length === 0) {
      noJob.push(r)
      continue
    }
    if (allocations.length > 1) {
      split.push(r)
      continue
    }
    const jobId = allocations[0]!.job_id
    const key = `${jobId}:${r.supply_house_id}`
    let g = groups.get(key)
    if (!g) {
      g = { jobId, houseId: r.supply_house_id, rows: [] }
      groups.set(key, g)
    }
    g.rows.push(r)
  }
  const jobs = [...groups.values()].map((g): AgingCellJobGroup<R> => {
    const on = g.rows.filter(isOn)
    const off = g.rows.filter((r) => !isOn(r))
    return {
      jobId: g.jobId,
      houseId: g.houseId,
      rows: g.rows,
      total: g.rows.reduce((s, r) => s + amountOf(r), 0),
      offTotal: off.reduce((s, r) => s + amountOf(r), 0),
      onCount: on.length,
      offCount: off.length,
      state: jobStateOf(off.length, accountOf(g.jobId, g.houseId)),
    }
  })
  jobs.sort((a, b) => b.offTotal - a.offTotal || b.total - a.total || a.jobId.localeCompare(b.jobId))
  return { jobs, split, noJob, credits }
}

function jobStateOf(offCount: number, account: JobSupplyHouseAccountRow | null | undefined): AgingCellJobState {
  if (offCount === 0) return { kind: 'all_on' }
  if (account === undefined) return { kind: 'loading' }
  if (account?.status === 'open') return { kind: 'open', account }
  if (account?.status === 'requested') return { kind: 'requested', account }
  if (account?.status === 'not_needed') return { kind: 'not_needed', account }
  return { kind: 'none' }
}

/** The cell's answer: what is on a job account and what is not. Credit memos are in neither. */
export function agingCellAccountSplit(rows: readonly AgingCellRowLike[]): {
  onAmount: number
  onCount: number
  offAmount: number
  offCount: number
} {
  let onAmount = 0
  let onCount = 0
  let offAmount = 0
  let offCount = 0
  for (const r of rows) {
    if (isCredit(r)) continue
    if (isOn(r)) {
      onAmount += amountOf(r)
      onCount += 1
    } else {
      offAmount += amountOf(r)
      offCount += 1
    }
  }
  return { onAmount, onCount, offAmount, offCount }
}

export type AgingCellStateTone = 'on' | 'open' | 'warn' | 'muted' | 'loading'

/** The words a job's heading wears, and their tone. */
export function agingCellJobStateWords(state: AgingCellJobState, houseName: string): { label: string; tone: AgingCellStateTone } {
  switch (state.kind) {
    case 'all_on':
      return { label: 'On the job account ✓', tone: 'on' }
    case 'open':
      return { label: `Job account open${state.account.account_ref.trim() ? ` · ref ${state.account.account_ref.trim()}` : ''}`, tone: 'open' }
    case 'requested': {
      const day = shortDay(state.account.requested_at)
      return { label: day ? `Job account asked for ${day}` : 'Job account asked for', tone: 'warn' }
    }
    case 'not_needed':
      return { label: 'No job account needed', tone: 'muted' }
    case 'none':
      return { label: `No job account at ${houseName}`, tone: 'warn' }
    case 'loading':
      return { label: 'Checking the job account…', tone: 'loading' }
  }
}

/** "10/2" from an ISO timestamp or date; null when there is none. */
function shortDay(iso: string | null): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  return m ? `${Number(m[2])}/${Number(m[3])}` : null
}

/**
 * The line under the split: how the cell's jobs stand at the house. One house's cell names it; the every-house
 * footer cell says "at the house" instead.
 */
export function agingCellJobsLine(jobs: ReadonlyArray<{ state: AgingCellJobState }>, houseName: string | null): string {
  const n = jobs.length
  if (n === 0) return ''
  const at = houseName ? `at ${houseName}` : 'at the house'
  const count = (kind: AgingCellJobState['kind']) => jobs.filter((j) => j.state.kind === kind).length
  const none = count('none')
  const jobsWord = n === 1 ? '1 job' : `${n} jobs`
  if (count('all_on') === n) return n === 1 ? 'The job’s charges here are on its job account.' : `${jobsWord}. Every one’s charges here are on its job account.`
  if (none === n) return n === 1 ? `1 job. It has no job account ${at} yet.` : `${jobsWord}. None has a job account ${at} yet.`
  const parts: string[] = []
  const add = (k: number, words: string) => {
    if (k > 0) parts.push(`${k} ${words}`)
  }
  add(count('all_on'), 'all on a job account')
  add(count('open'), 'with an account open')
  add(count('requested'), 'with an account asked for')
  add(none, `with no job account ${at} yet`)
  add(count('not_needed'), 'marked not needed')
  return `${jobsWord}: ${parts.join(', ')}.`
}

/**
 * The aging cell window's standing words: a heading and three status lines. None is an empty list, so they are
 * named here, beside the window's other words, and not drawn as empty states.
 */
export const AGING_CELL_NO_JOB_HEADING = 'No job yet'

/** The move modal, when the job has no account on record at the house. */
export function agingMoveNoAccountLine(repName: string | null | undefined): string {
  return `No job account on record for this job — ask ${repName?.trim() || 'the house'} to open one on the same call.`
}

/** The move request's preview: what the email says about the account when none is open. */
export const AGING_MOVE_EMAIL_NO_ACCOUNT = 'No account on this job yet — please open one with it.'

/** The move modal, when the house has no job-accounts rep the request could be emailed to. */
export function agingMoveNoRepLine(houseName: string): string {
  return `No job-accounts rep with an email on file for ${houseName} — add one on the house, or call.`
}

/** The teal "of which on a job account" words, on an aging cell and on a flagged bill's chip. */
export const JOB_ACCOUNT_LINE_TITLE = "Of this, on the house's job account — the owner's debt to collect on, not Click's. The cell keeps the house's total."

/**
 * A DATE-only column (YYYY-MM-DD) as the reader's locale writes it. `new Date('2026-07-10')` parses as UTC midnight,
 * which is the PREVIOUS day in US time zones, so the day is parsed at local noon. Anything else is handed to `Date`
 * as it came, and words that are no date at all come back as they were.
 */
export function formatYmdLocal(ymd: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? new Date(ymd + 'T12:00:00') : new Date(ymd)
  return Number.isNaN(d.getTime()) ? ymd : d.toLocaleDateString()
}
