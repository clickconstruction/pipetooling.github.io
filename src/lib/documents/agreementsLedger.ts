/**
 * Documents → Agreements (punch list #376): the rules that turn any kind of agreement into one line of one list.
 *
 * The app makes agreements in several places: a job's contract, a warranty in place of one, a GC's own paper, a signed
 * paper the office filed, a person's agreement (staff, a sub, a partner) and a sub work order. Each keeps its own table,
 * its own window and its own words for where it stands. This kernel reads one row shape, the `agreements_on_file` view's
 * (one branch per table, `security_invoker`, so each table's own row security decides what a reader sees), and answers
 * what a line says: its tag, its name, who it is with, the job, its state in that kind's own words, and its day. The
 * state's words come from the kernels that already hold them (`jobContractChips`, `theirPaperLine`,
 * `workOrderChipLabel`), so a line and the window it opens never disagree.
 *
 * Pure: no React, no supabase. The read is `agreementsLedgerIo.ts`; the tab is `DocumentsAgreementsTab.tsx`.
 */
import { formatWorkDateYmdFriendly, formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'
import { emptyWords, type EmptyWords } from '../emptyWords'
import { pluralNoun } from '../batchWords'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import { isGoogleDocsUrl } from '../jobs/jobContractDocument'
import { jobContractChips } from '../jobs/jobContractLifecycle'
import { theirPaperFromRow, theirPaperLine } from '../jobs/theirPaper'
import { buildJobWorkOrderCoverage, workOrderChipLabel } from '../subWorkOrders/workOrderCoverage'

/** The kinds the view answers. A kind the kernel does not know still draws, as a plain agreement. */
export type AgreementKind = 'job_contract' | 'job_warranty' | 'their_paper' | 'person_agreement' | 'partner_agreement' | 'work_order'

/** Where an agreement stands, the same three for every kind: out to be signed, signed, or over. */
export type AgreementState = 'waiting' | 'signed' | 'ended'

/** One row of `agreements_on_file`. `facts` holds the columns of the kind's own table that its words are made from. */
export interface AgreementRow {
  /** `<kind>:<source_id>`: one per line, and the second sort key. */
  id: string
  kind: string
  source_id: string
  state: string
  /** The template's, the document's or the paper's own name, or the work order's number; '' when it has none. */
  paper_name: string
  /** Who it is with: the customer, the GC, the person, the sub. */
  with_name: string
  job_id: string | null
  job_hcp_number: string | null
  job_click_number: string | null
  job_name: string | null
  job_address: string | null
  /** A signed paper filed over several jobs is one line: how many jobs it covers beyond the one named. */
  more_jobs: number
  person_id: string | null
  /** `people.kind` of a person's agreement: `sub` reads Sub, anything else Staff. */
  person_kind: string | null
  /** The moment the line sorts on. */
  at: string
  /** The day the line shows, in the company's calendar: the signed day, the sent day, or the day it ended. */
  at_day: string | null
  facts: Record<string, unknown> | null
}

export const AGREEMENTS_SELECT =
  'id, kind, source_id, state, paper_name, with_name, job_id, job_hcp_number, job_click_number, job_name, job_address, more_jobs, person_id, person_kind, at, at_day, facts'

/** Rows read per step; Show more reads the next step. */
export const AGREEMENTS_PAGE = 100

/** The tab is the office's: the four roles the tables' own policies let read a job contract and a person's agreement. */
export function canSeeAgreements(role: string | null | undefined): boolean {
  return role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'controller'
}

// ── The chips ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export type AgreementGroup = 'jobs' | 'warranty' | 'people' | 'partners' | 'orders'
export type KindPick = 'all' | AgreementGroup
export type StatePick = 'live' | AgreementState

/** Which kinds each chip asks the database for. */
export const AGREEMENT_GROUP_KINDS: Readonly<Record<AgreementGroup, ReadonlyArray<AgreementKind>>> = {
  jobs: ['job_contract', 'their_paper'],
  warranty: ['job_warranty'],
  people: ['person_agreement'],
  partners: ['partner_agreement'],
  orders: ['work_order'],
}

export const AGREEMENT_KIND_CHIPS: ReadonlyArray<{ key: KindPick; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'jobs', label: 'Job contracts' },
  { key: 'warranty', label: 'Warranties' },
  { key: 'people', label: 'Staff and subs' },
  { key: 'partners', label: 'Partners' },
  { key: 'orders', label: 'Work orders' },
]

/** The tab opens on `live`: sent and signed, so a voided paper stays out of the way until its chip is pressed. */
export const AGREEMENT_STATE_CHIPS: ReadonlyArray<{ key: StatePick; label: string }> = [
  { key: 'live', label: 'Sent and signed' },
  { key: 'waiting', label: 'Waiting on a signature' },
  { key: 'signed', label: 'Signed' },
  { key: 'ended', label: 'Voided or ended' },
]

/** The kinds a kind chip asks for, or null for every kind. */
export function kindsOfPick(pick: KindPick): ReadonlyArray<string> | null {
  return pick === 'all' ? null : AGREEMENT_GROUP_KINDS[pick]
}

/** The states a state chip asks for. */
export function statesOfPick(pick: StatePick): ReadonlyArray<AgreementState> {
  return pick === 'live' ? ['waiting', 'signed'] : [pick]
}

/** The group a row's tag is coloured by; an unknown kind sits with the job contracts. */
export function agreementGroup(kind: string): AgreementGroup {
  for (const [group, kinds] of Object.entries(AGREEMENT_GROUP_KINDS) as Array<[AgreementGroup, ReadonlyArray<string>]>) {
    if (kinds.includes(kind)) return group
  }
  return 'jobs'
}

/** A tag's pair per group, theme tokens only, the way Sent copies colours its kinds. */
export const AGREEMENT_GROUP_COLORS: Readonly<Record<AgreementGroup, { background: string; color: string }>> = {
  jobs: { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)' },
  warranty: { background: 'var(--bg-green-tint)', color: 'var(--text-green-800)' },
  people: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' },
  partners: { background: 'var(--bg-violet-tint)', color: 'var(--text-violet-700)' },
  orders: { background: 'var(--bg-muted)', color: 'var(--text-muted)' },
}

/** A state chip's pair per tone: the contract chips' own colours (`jobContractChipColors`). */
export const AGREEMENT_STATE_COLORS: Readonly<Record<AgreementState, { background: string; color: string }>> = {
  waiting: { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' },
  signed: { background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' },
  ended: { background: 'var(--bg-red-100)', color: 'var(--text-red-700)' },
}

/** *Waiting on a signature · 3*: the chip carries the count when something waits, and the words alone when nothing does. */
export function waitingChipLabel(label: string, waiting: number | null): string {
  return waiting != null && waiting > 0 ? `${label} · ${waiting}` : label
}

// ── The find box ──────────────────────────────────────────────────────────────────────────────────────────────────────

export interface AgreementsQuery {
  kind: KindPick
  state: StatePick
  typed: string
  limit: number
}

/**
 * What was typed, as the words the database must each find in a row's `find_text`: lower case, letters, digits and a
 * few marks only, five words at most. Fewer than two characters asks nothing.
 */
export function agreementFindWords(typed: string): string[] {
  const q = typed
    .toLowerCase()
    .replace(/[^a-z0-9 @._#'&-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
  if (q.length < 2) return []
  return q.split(' ').filter(Boolean).slice(0, 5)
}

/** Whether a chip or the box narrows the list, for the empty state's words. The default state chip does not. */
export function agreementsNarrowed(q: Pick<AgreementsQuery, 'kind' | 'state' | 'typed'>): boolean {
  return q.kind !== 'all' || q.state !== 'live' || agreementFindWords(q.typed).length > 0
}

/** Where the empty list's press goes: the Pipeline, where a contract is sent to sign. */
export const AGREEMENTS_EMPTY_PAGE = { label: 'Pipeline', to: '/jobs?tab=stages', tail: 'is where a contract is sent to sign.' } as const

/**
 * The empty list's words: nothing matches the search (*Clear the search*), nothing matches the chips (*Clear the
 * filters*), or nothing is on file at all, which names the page that fills it. The tab adds the press.
 */
export function agreementsEmptyWords(q: Pick<AgreementsQuery, 'kind' | 'state' | 'typed'>): EmptyWords {
  if (!agreementsNarrowed(q)) return emptyWords({ kind: 'data', noun: 'agreements', page: { label: AGREEMENTS_EMPTY_PAGE.label, tail: AGREEMENTS_EMPTY_PAGE.tail } })
  const query = agreementFindWords(q.typed).length > 0 ? q.typed.trim() : ''
  return emptyWords({ kind: 'filter', noun: 'agreements', query })
}

/** *1 agreement*, *13 agreements*. */
export function agreementCountWords(n: number): string {
  return `${n} ${pluralNoun('agreement', n)}`
}

// ── A line ────────────────────────────────────────────────────────────────────────────────────────────────────────────

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function fact(row: Pick<AgreementRow, 'facts'>, key: string): unknown {
  return row.facts && typeof row.facts === 'object' ? row.facts[key] : undefined
}

function stateOf(row: Pick<AgreementRow, 'state'>): AgreementState {
  return row.state === 'waiting' || row.state === 'signed' ? row.state : 'ended'
}

/** The tag on a line: the exact kind in a word or two, in its group's colours. */
export function agreementTag(row: Pick<AgreementRow, 'kind' | 'person_kind'>): { words: string; group: AgreementGroup } {
  const group = agreementGroup(row.kind)
  switch (row.kind) {
    case 'job_contract':
      return { words: 'Contract', group }
    case 'job_warranty':
      return { words: 'Warranty', group }
    case 'their_paper':
      return { words: 'Their paper', group }
    case 'person_agreement':
      return { words: row.person_kind === 'sub' ? 'Sub' : 'Staff', group }
    case 'partner_agreement':
      return { words: 'Partner', group }
    case 'work_order':
      return { words: 'Work order', group }
    default:
      return { words: 'Agreement', group }
  }
}

/** Whether a job contract row is a signed paper the office filed, not one signed through the link. */
function filedPaper(row: Pick<AgreementRow, 'kind' | 'facts'>): boolean {
  return row.kind !== 'their_paper' && (fact(row, 'signer_mode') === 'paper' || fact(row, 'co_signer_mode') === 'paper')
}

/**
 * The name a line is pressed by: the paper's own name when it has one. A filed paper with no name reads *Signed paper ·
 * Google Doc*, *· scan* or alone, as the Customer page's Agreements card names it; anything else falls back to its kind.
 */
export function agreementName(row: Pick<AgreementRow, 'kind' | 'paper_name' | 'facts'>): string {
  const name = str(row.paper_name)
  if (name) return name
  if (filedPaper(row)) {
    const url = str(fact(row, 'signed_document_url'))
    if (url) return isGoogleDocsUrl(url) ? 'Signed paper · Google Doc' : 'Signed paper · link'
    return fact(row, 'has_upload') === true ? 'Signed paper · scan' : 'Signed paper'
  }
  switch (row.kind) {
    case 'job_contract':
      return 'Contract'
    case 'job_warranty':
      return 'Warranty'
    case 'their_paper':
      return 'Their paper'
    case 'work_order':
      return 'Work order'
    default:
      return 'Agreement'
  }
}

/** The job a line names: *J2418 · Pierce kitchen repipe*, the number alone, the name alone, or null with no job. */
export function agreementJobTitle(row: Pick<AgreementRow, 'job_id' | 'job_hcp_number' | 'job_click_number' | 'job_name'>): string | null {
  const num = effectiveJobLedgerNumber(row.job_hcp_number, row.job_click_number)
  const name = str(row.job_name)
  if (!num && !name) return null
  if (!num) return name
  return name ? `J${num} · ${name}` : `J${num}`
}

/** What follows the job on the sub line: *and 2 more jobs* for a paper over several, else the job's address. */
export function agreementJobTail(row: Pick<AgreementRow, 'more_jobs' | 'job_address'>): string {
  const more = Number(row.more_jobs) || 0
  if (more > 0) return `and ${more} more ${pluralNoun('job', more)}`
  return str(row.job_address)
}

/**
 * The state chip: the tone every kind shares and the words that kind's own window uses. `todayYmd` is the company's
 * day, for a work order's offer that ran out.
 */
export function agreementStateChip(row: Pick<AgreementRow, 'kind' | 'state' | 'facts'>, todayYmd: string): { words: string; tone: AgreementState } {
  const tone = stateOf(row)
  const facts = row.facts ?? {}
  if (row.kind === 'job_contract' || row.kind === 'job_warranty' || row.kind === 'their_paper') {
    const status = str(fact(row, 'status'))
    const voided = fact(row, 'voided_at') != null || status === 'voided'
    if (row.kind === 'their_paper' && !voided) {
      const rec = theirPaperFromRow({ ...(facts as Record<string, never>), id: '', job_id: '', status })
      return { words: theirPaperLine(rec).replace(/^Their paper · /, ''), tone }
    }
    const chip = jobContractChips({
      ...(facts as Record<string, never>),
      status,
      voided_at: (fact(row, 'voided_at') as string | null | undefined) ?? null,
      signer_mode: (fact(row, 'signer_mode') as string | null | undefined) ?? null,
      send_count: Number(fact(row, 'send_count')) || 0,
      view_count: Number(fact(row, 'view_count')) || 0,
      sent_channel: (fact(row, 'sent_channel') as string | null | undefined) ?? null,
    })[0]
    return { words: chip?.label ?? status, tone }
  }
  if (row.kind === 'person_agreement' || row.kind === 'partner_agreement') {
    if (fact(row, 'replaced') === true) return { words: 'replaced by a newer one', tone }
    if (tone === 'signed') return { words: 'signed ✓', tone }
    return { words: fact(row, 'signer_last_viewed_at') != null ? 'viewed, not signed' : 'never opened', tone }
  }
  if (row.kind === 'work_order') {
    const status = str(fact(row, 'status'))
    if (status === 'cancelled') return { words: 'Cancelled', tone }
    const coverage = buildJobWorkOrderCoverage(
      [
        {
          id: '',
          status,
          amount: null,
          display_name: '',
          job_id: null,
          labor_job_id: null,
          step_id: null,
          record_id: null,
          offered_at: (fact(row, 'offered_at') as string | null | undefined) ?? null,
          offer_expires_at: (fact(row, 'offer_expires_at') as string | null | undefined) ?? null,
          signed_at: (fact(row, 'signed_at') as string | null | undefined) ?? null,
          accepted_at: (fact(row, 'accepted_at') as string | null | undefined) ?? null,
          declined_at: (fact(row, 'declined_at') as string | null | undefined) ?? null,
          decline_reason: null,
          created_at: '',
        },
      ],
      todayYmd,
    )
    return { words: workOrderChipLabel(coverage), tone }
  }
  return { words: tone === 'waiting' ? 'waiting on a signature' : tone === 'signed' ? 'signed ✓' : 'ended', tone }
}

/** The verb before the day: what happened on it. */
function dayVerb(row: Pick<AgreementRow, 'kind' | 'state' | 'facts'>): string {
  const tone = stateOf(row)
  if (tone === 'signed') return 'Signed'
  if (tone === 'waiting') return 'Sent'
  const status = str(fact(row, 'status'))
  if (row.kind === 'work_order') return status === 'declined' ? 'Declined' : status === 'cancelled' ? 'Cancelled' : 'Expired'
  if (fact(row, 'replaced') === true) return 'Signed'
  return 'Voided'
}

/** *Signed Nov 14*, *Sent Nov 16*, *Voided Oct 15*, with the year once it is not this one; '' with no day. */
export function agreementDayWords(row: Pick<AgreementRow, 'kind' | 'state' | 'facts' | 'at_day'>, todayYmd: string): string {
  const ymd = str(row.at_day)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ''
  const day = ymd.slice(0, 4) === todayYmd.slice(0, 4) ? formatWorkDateYmdMonthDayShort(ymd) : formatWorkDateYmdFriendly(ymd)
  return `${dayVerb(row)} ${day}`
}

// ── The list ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const

export interface AgreementMonthGroup<T> {
  /** `YYYY-MM`, or '' for rows with no day. */
  ym: string
  label: string
  rows: T[]
}

/** The rows under one band per month, in the order given (newest first): *November 2026*, then *No date* last if any. */
export function agreementMonthGroups<T extends Pick<AgreementRow, 'at_day'>>(rows: ReadonlyArray<T>): AgreementMonthGroup<T>[] {
  const out: AgreementMonthGroup<T>[] = []
  for (const row of rows) {
    const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(str(row.at_day))
    const month = m ? Number(m[2]) : 0
    const ym = m && month >= 1 && month <= 12 ? `${m[1]}-${m[2]}` : ''
    const last = out[out.length - 1]
    if (last && last.ym === ym) {
      last.rows.push(row)
      continue
    }
    out.push({ ym, label: ym ? `${MONTHS[month - 1]} ${ym.slice(0, 4)}` : 'No date', rows: [row] })
  }
  return out
}

// ── What a press opens ────────────────────────────────────────────────────────────────────────────────────────────────

/** Each kind keeps the window it has: the tab builds no viewer of its own. */
export type AgreementDoor =
  /** The Contract window on that record, or its preview while it is unsigned: what the Jobs tab's line opens. */
  | { kind: 'contract'; jobId: string; recordId: string; signed: boolean }
  /** The signed record window People → Contracts uses. */
  | { kind: 'person-signed'; documentId: string }
  /** People → Contracts on that paper, where it is sent again. */
  | { kind: 'people-contracts'; to: string }
  /** The work order window on that job. */
  | { kind: 'work-order'; jobId: string; commitmentId: string }
  | { kind: 'none' }

export function agreementDoor(row: Pick<AgreementRow, 'kind' | 'source_id' | 'state' | 'job_id' | 'facts'>): AgreementDoor {
  if (row.kind === 'job_contract' || row.kind === 'job_warranty' || row.kind === 'their_paper') {
    if (!row.job_id) return { kind: 'none' }
    return { kind: 'contract', jobId: row.job_id, recordId: row.source_id, signed: fact(row, 'signed_at') != null }
  }
  if (row.kind === 'person_agreement' || row.kind === 'partner_agreement') {
    if (str(fact(row, 'status')) === 'signed') return { kind: 'person-signed', documentId: row.source_id }
    return { kind: 'people-contracts', to: `/people?tab=contracts&doc=${encodeURIComponent(row.source_id)}` }
  }
  if (row.kind === 'work_order') {
    return row.job_id ? { kind: 'work-order', jobId: row.job_id, commitmentId: row.source_id } : { kind: 'none' }
  }
  return { kind: 'none' }
}
