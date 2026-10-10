/**
 * GC mode, the real build, the Board's B3: the rows the board reads, turned into the shapes the
 * Board's kernels read (`GcState`, `GcProject`, `Partner`, `Invite`, `SubBid`, `TradePromise`), so no
 * kernel changes when the data becomes real. The projects come from New project's mapper
 * (`projectRows.ts`); the companies, their asks, quotes, call log and promises from the company
 * record (B1, `20261008020000_gc_company_record.sql`).
 *
 * Read from the rows, never stored (BOARD_REAL_BUILD.md, decision 4): how many times a company was
 * asked and how many quotes it sent (every ask is here, so there is no history to add), the day an ask
 * was last chased (the newest office line on it), how many trades it won (the awards on its asks), and its
 * papers, from its own rows in person_contract_documents (B6-b-ii, `companyPapers`).
 */
import type { Json } from '../../types/database'
import { extractContactFromCustomer } from '../customerContactDisplay'
import { companyPapers, type CompanyPaperRow } from './companyPapers'
import { townFromAddress } from './map'
import type { GcProjectView } from './projectRows'
import type {
  AskContact,
  BidTab,
  DeclineReason,
  GcCustomer,
  GcLostWhy,
  GcProject,
  GcStage,
  GcState,
  Includes,
  Invite,
  InviteStatus,
  PaperKind,
  PaperSend,
  Partner,
  PartnerVetting,
  PlanQuestion,
  PortalMailGroup,
  PromiseKind,
  Sow,
  SovLine,
  SubBid,
  TheirSovLine,
  Town,
  TradePackage,
  TradePromise,
} from './types'

/** `gc_companies`: a trade partner company. */
export interface CompanyRow {
  id: string
  name: string
  trades: string[]
  contact_name: string
  phone: string
  email: string
  address: string
  max_miles: number | null
  license: string
  lang: string
  vetting_status: string | null
  vetting_limit: number | string | null
  vetting_decided_on: string | null
  vetting_decided_by: string | null
  vetting_note: string
  /** The kinds of email the main contact gets. Null or missing: every kind. */
  contact_gets?: string[] | null
}

/** `gc_invites`: one company asked to quote one trade. */
export interface InviteRow {
  id: string
  package_id: string
  company_id: string
  status: string
  invited_on: string
  declined_why: string | null
  decline_reason: string | null
  decline_note: string
  declined_on: string | null
  plugs: Record<string, number> | null
  exclusion_covers: Record<string, number> | null
  taken_alternates: string[] | null
  /** The revision the partner last opened on the portal; null until they open it. */
  seen_rev?: number | null
}

/** `gc_quotes`: a quote on an ask; the newest counts. */
export interface QuoteRow {
  id: string
  invite_id: string
  amount: number | string
  based_on_rev: number
  submitted_on: string
  includes: Record<string, Includes> | null
  note: string
  good_for_days: number | null
  alternates: { label: string; amount: number }[] | null
  quote_file: string
  exclusions: { name: string; said?: string; unitPrice?: { amount: number; unit: string } }[] | null
  /** The exclusion names they answered about (B5-b). Missing or null: none. */
  exclusions_answered?: string[] | null
  created_at: string
}

/** `gc_company_contacts`: the call log, a company's own line or one of an ask's. */
export interface ContactRow {
  id: string
  company_id: string
  invite_id: string | null
  contacted_on: string
  by_user_id: string | null
  by_name: string
  how: string
  note: string
  promised_by: string | null
  created_at: string
}

/** `gc_trade_promises` and `gc_trade_promise_moves`. */
export interface PromiseRow {
  id: string
  company_id: string
  kind: string
  project_id: string | null
  package_id: string | null
  what: string
  due_on: string
  made_on: string
  source: string
  kept_on: string | null
}
export interface PromiseMoveRow {
  promise_id: string
  was_due_on: string
  moved_on: string
  created_at: string
}

/** The Board's own dates on `gc_projects` (B1), by project id. */
export interface BoardDatesRow {
  our_bid_sent_on: string | null
  permit_on: string | null
  start_date: string | null
  owner_contract_sent_on: string | null
  owner_contract_signed_on?: string | null
  started_on: string | null
  lost_why: string | null
  won_by: string | null
  /** The day the job was closed (Building's U6c, `gc_close_job`). Null: still open. */
  closed_on?: string | null
}

/** A company's vetting form (B1's `gc_company_vetting_forms`), as they wrote it. */
/** `gc_company_people`: someone else the company named, with the emails they get (B3-c). Removed people are not read. */
export interface PersonRow {
  id: string
  company_id: string
  name: string
  email: string
  role: string
  gets: string[]
}

export interface VettingFormRow {
  company_id: string
  license: string
  insurance: string
  years_in_business: number | null
  reference_list: string
  past_jobs: string
  sent_on: string
}

/** `gc_project_money` (B5): our number's three inputs on a project. Only the money team reads a row. */
export interface ProjectMoneyRow {
  project_id: string
  general_conditions: number | string
  contingency_pct: number | string
  fee_pct: number | string
}

/** `gc_bid_tabs` (B5): a trade's bid tab, shared with the companies that quoted. */
export interface BidTabShareRow {
  package_id: string
  shared_on: string
  show_names: boolean
}

/** `gc_bid_tab_views` (B5): a company that opened a shared tab in its portal (the Portal's P5e writes it). */
export interface BidTabViewRow {
  package_id: string
  company_id: string
  seen_on: string
}

/** `gc_sows` (B6-a): a trade's statement of work with the company awarded, drafted by `gc_award`. */
export interface SowRow {
  id: string
  package_id: string
  status: string
  price: number | string
  retainage_pct: number | string
  based_on_rev: number
  their_sov: TheirSovLine[] | null
  excluded: NonNullable<Sow['excluded']> | null
  sent_on: string | null
  signed_on: string | null
  accepted_on: string | null
}

/** `gc_sow_lines` (B6-a): a statement of work's line, on a scope item or on a change order. */
export interface SowLineRow {
  id: string
  sow_id: string
  position: number
  label: string
  amount: number | string
  scope_item_id: string | null
  change_order_id: string | null
}

/** `gc_paper_sends` (B6-b-i): one send of a paper to a company, written by `gc_send_paper` with its promise. */
export interface PaperSendRow {
  id: string
  company_id: string
  paper: string
  project_id: string | null
  package_id: string | null
  sent_on: string
  due_on: string
  note: string
  first: boolean
  draws: number[] | null
  created_at: string
}

export interface BoardRows {
  today: string
  projects: GcProjectView[]
  /** The Board's columns on each project, by project id. A project missing here reads as nothing set. */
  boardDates: Record<string, BoardDatesRow>
  /** The customers and architects the projects name, with the phone and email on their customer record. */
  customers: { id: string; name: string; contact?: string; contact_info?: Json | null }[]
  companies: CompanyRow[]
  invites: InviteRow[]
  quotes: QuoteRow[]
  contacts: ContactRow[]
  promises: PromiseRow[]
  promiseMoves: PromiseMoveRow[]
  /** Who decided a vetting, by user id, for its words. */
  userNames?: Record<string, string>
  /** The vetting forms that came in (B3-b). Missing: none read, so no company shows a form. */
  vettingForms?: VettingFormRow[]
  /** The people each company named (B3-c). Missing: none read, so each company is its main contact alone. */
  people?: PersonRow[]
  /** Points from the app's geocoded addresses, by the address as written. Missing: the towns stand in. */
  points?: Record<string, { lat: number; lng: number }>
  /**
   * Our number's inputs (B5-c), one row per project. Someone outside the money team reads none, so
   * each project's general conditions, contingency and fee read 0. Missing: none read.
   */
  money?: ProjectMoneyRow[]
  /** True when the reader is on the money team: the screens show the price. Missing or false: the trades alone. */
  moneyShown?: boolean
  /** The bid tabs shared (B5-d), and who opened each. Missing: none shared. */
  bidTabs?: BidTabShareRow[]
  bidTabViews?: BidTabViewRow[]
  /** The statements of work (B6-a) and their lines. Missing: none read, so no trade has one. */
  sows?: SowRow[]
  sowLines?: SowLineRow[]
  /**
   * The companies' own papers (B6-b-ii): their rows in person_contract_documents with a company_id. Missing: none
   * read, so every company reads as having none, as before B6-b.
   */
  papers?: CompanyPaperRow[]
  /** Every send of a paper (B6-b-i's gc_paper_sends), dev only while the Board is built. Missing: none read. */
  paperSends?: PaperSendRow[]
}

const num = (v: number | string | null | undefined): number => {
  const n = typeof v === 'string' ? Number(v) : v
  return n === null || n === undefined || Number.isNaN(n) ? 0 : n
}

/** The table's stage to the kernels': bidding is the prototype's pursuing; a closed job is a building one with its day. */
export function stageOf(stage: string): GcStage {
  return stage === 'buyout' ? 'buyout' : stage === 'building' || stage === 'closed' ? 'building' : 'pursuing'
}

const INVITE_STATUSES: InviteStatus[] = ['invited', 'opened', 'bid', 'declined']
const DECLINE_REASONS: DeclineReason[] = ['busy', 'far', 'size', 'scope', 'terms', 'other']
const LOST_WHYS: GcLostWhy[] = ['price', 'other_builder', 'project_died', 'no_bid', 'no_answer']
const PROMISE_KINDS: PromiseKind[] = ['insurance', 'w9', 'sow', 'start', 'submittals', 'delivery', 'payApp', 'punch', 'closeout', 'msa']
// gc_paper_sends_paper_known's five.
const PAPER_KINDS: PaperKind[] = ['msa', 'sow', 'insurance', 'w9', 'waiver']
const HOWS: AskContact['how'][] = ['call', 'text', 'email', 'nudge', 'portal']
const MAIL_GROUPS: PortalMailGroup[] = ['quotes', 'job', 'contracts', 'pay']

/** The kinds of email a row names, in the kernels' words; an unknown word is dropped. */
function mailGroups(gets: string[]): PortalMailGroup[] {
  return MAIL_GROUPS.filter((g) => gets.includes(g))
}

function pointOf(rows: BoardRows, address: string): Town | undefined {
  const p = address ? rows.points?.[address] : undefined
  return p ? { name: address, lat: p.lat, lng: p.lng } : undefined
}

/**
 * An ask's story, newest first, as the kernels read it (`Invite.contacts`). A company's own note is not
 * an ask's line, and neither is the office's note on an ask (`how` 'note', such as the line saying its
 * email waits): it is not a contact with the company, so it never reads as a call or a chase.
 */
function askContacts(lines: ContactRow[]): AskContact[] {
  return [...lines]
    .filter((c) => c.how !== 'note')
    .sort((a, b) => b.contacted_on.localeCompare(a.contacted_on) || b.created_at.localeCompare(a.created_at))
    .map((c) => ({
      on: c.contacted_on,
      by: c.by_name,
      how: HOWS.includes(c.how as AskContact['how']) ? (c.how as AskContact['how']) : 'call',
      note: c.note,
      ...(c.promised_by ? { promisedBy: c.promised_by } : {}),
    }))
}

/** The quote that counts on an ask: the newest. The office's own numbers sit on the ask. */
function quoteOf(invite: InviteRow, quotes: QuoteRow[]): SubBid | null {
  const newest = quotes.filter((q) => q.invite_id === invite.id).sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
  if (!newest) return null
  return {
    amount: num(newest.amount),
    basedOnRev: newest.based_on_rev,
    submittedOn: newest.submitted_on,
    includes: newest.includes ?? {},
    plugs: invite.plugs ?? {},
    note: newest.note,
    ...(newest.good_for_days !== null ? { goodForDays: newest.good_for_days } : {}),
    ...(newest.alternates && newest.alternates.length ? { alternates: newest.alternates } : {}),
    ...(newest.quote_file ? { quoteFile: newest.quote_file } : {}),
    ...(invite.taken_alternates && invite.taken_alternates.length ? { takenAlternates: invite.taken_alternates } : {}),
    ...(newest.exclusions ? { exclusions: newest.exclusions } : {}),
    ...(newest.exclusions_answered && newest.exclusions_answered.length ? { exclusionsAnswered: newest.exclusions_answered } : {}),
    ...(invite.exclusion_covers && Object.keys(invite.exclusion_covers).length ? { exclusionCovers: invite.exclusion_covers } : {}),
  }
}

/** One ask as the kernels read it. */
export function inviteFromRows(invite: InviteRow, quotes: QuoteRow[], contacts: ContactRow[]): Invite {
  const lines = contacts.filter((c) => c.invite_id === invite.id)
  const story = askContacts(lines)
  // The day the office last chased them: its newest line on the ask (decision 4, read not stored).
  const chased = story.find((c) => c.how !== 'portal')?.on
  const reason = DECLINE_REASONS.includes(invite.decline_reason as DeclineReason) ? (invite.decline_reason as DeclineReason) : null
  return {
    id: invite.id,
    partnerId: invite.company_id,
    status: INVITE_STATUSES.includes(invite.status as InviteStatus) ? (invite.status as InviteStatus) : 'invited',
    invitedOn: invite.invited_on,
    seenRev: invite.seen_rev ?? null,
    bid: quoteOf(invite, quotes),
    ...(chased ? { nudgedOn: chased } : {}),
    ...(invite.declined_why === 'wont' || invite.declined_why === 'cant' ? { declinedWhy: invite.declined_why } : {}),
    ...(reason ? { declineReason: { reason, note: invite.decline_note, on: invite.declined_on ?? invite.invited_on } } : {}),
    ...(story.length ? { contacts: story } : {}),
  }
}

/** A company's vetting as the kernels read it. Null in the table: a company we know, approved. */
function vettingOf(c: CompanyRow, names: Record<string, string>, form: VettingFormRow | undefined): PartnerVetting | undefined {
  if (c.vetting_status !== 'new' && c.vetting_status !== 'approved' && c.vetting_status !== 'declined') return undefined
  const limit = c.vetting_limit === null ? null : num(c.vetting_limit)
  return {
    status: c.vetting_status,
    ...(limit !== null ? { limit } : {}),
    ...(c.vetting_decided_on ? { decidedOn: c.vetting_decided_on } : {}),
    ...(c.vetting_decided_by ? { decidedBy: names[c.vetting_decided_by] ?? 'Someone on our team' } : {}),
    ...(c.vetting_note ? { note: c.vetting_note } : {}),
    ...(form ? { form: { license: form.license, insurance: form.insurance, yearsInBusiness: form.years_in_business ?? 0, references: form.reference_list, pastJobs: form.past_jobs, sentOn: form.sent_on } } : {}),
  }
}

/**
 * A company as the kernels read it. Its counts come from its asks and the awards on them (`awarded`, the asks that
 * won a trade); its papers from its own rows (`companyPapers`).
 */
export function partnerFromRows(
  c: CompanyRow,
  invites: InviteRow[],
  quotes: QuoteRow[],
  rows: Pick<BoardRows, 'points' | 'userNames' | 'vettingForms' | 'people' | 'papers'> & { contacts?: ContactRow[]; awarded?: ReadonlySet<string> },
): Partner {
  const asks = invites.filter((i) => i.company_id === c.id)
  const quoted = new Set(quotes.map((q) => q.invite_id))
  const basePoint = pointOf(rows as BoardRows, c.address)
  const vetting = vettingOf(c, rows.userNames ?? {}, rows.vettingForms?.find((f) => f.company_id === c.id))
  const people = (rows.people ?? []).filter((p) => p.company_id === c.id).map((p) => ({ id: p.id, name: p.name, email: p.email, role: p.role, gets: mailGroups(p.gets) }))
  // The company's own call log, newest first (`Partner.contacts`, the schedule's call list reads it): its lines on no ask. An ask's are on `Invite.contacts`.
  const own = (rows.contacts ?? [])
    .filter((x) => x.company_id === c.id && x.invite_id === null)
    .sort((a, b) => b.contacted_on.localeCompare(a.contacted_on) || b.created_at.localeCompare(a.created_at))
    .map((x) => ({ on: x.contacted_on, by: x.by_name, note: x.note }))
  return {
    id: c.id,
    company: c.name,
    contact: c.contact_name,
    trades: c.trades,
    // The town in their address stands in for the drive until the app's point for it is read (`basePoint`).
    base: c.address ? (townFromAddress(c.address) ?? c.address) : null,
    ...(basePoint ? { basePoint } : {}),
    maxMiles: c.max_miles,
    ...companyPapers(rows.papers ?? [], c.id),
    invited: asks.length,
    bids: asks.filter((i) => quoted.has(i.id)).length,
    won: asks.filter((i) => rows.awarded?.has(i.id)).length,
    promisesMade: 0,
    promisesKept: 0,
    ...(c.address ? { address: c.address } : {}),
    ...(c.license ? { license: c.license } : {}),
    ...(vetting ? { vetting } : {}),
    ...(c.phone ? { phone: c.phone } : {}),
    ...(c.email ? { email: c.email } : {}),
    ...(people.length ? { people } : {}),
    ...(own.length ? { contacts: own } : {}),
    ...(c.contact_gets ? { contactGets: mailGroups(c.contact_gets) } : {}),
  }
}

/** One send of a paper as the kernels read it (`PaperSend`). */
export function paperSendFromRow(s: PaperSendRow): PaperSend {
  return {
    id: s.id,
    partnerId: s.company_id,
    paper: PAPER_KINDS.includes(s.paper as PaperKind) ? (s.paper as PaperKind) : 'msa',
    ...(s.project_id ? { projectId: s.project_id } : {}),
    ...(s.package_id ? { packageId: s.package_id } : {}),
    on: s.sent_on,
    by: s.due_on,
    note: s.note,
    first: s.first,
    ...(s.draws?.length ? { draws: s.draws } : {}),
  }
}

/** A promise as the kernels read it, its earlier days newest first. */
export function promiseFromRows(p: PromiseRow, moves: PromiseMoveRow[]): TradePromise {
  const moved = moves
    .filter((m) => m.promise_id === p.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((m) => ({ by: m.was_due_on, on: m.moved_on }))
  return {
    id: p.id,
    partnerId: p.company_id,
    kind: PROMISE_KINDS.includes(p.kind as PromiseKind) ? (p.kind as PromiseKind) : 'insurance',
    ...(p.project_id ? { projectId: p.project_id } : {}),
    ...(p.package_id ? { packageId: p.package_id } : {}),
    what: p.what,
    by: p.due_on,
    madeOn: p.made_on,
    from: p.source === 'trade' ? 'trade' : 'office',
    ...(moved.length ? { moved } : {}),
    ...(p.kept_on ? { keptOn: p.kept_on } : {}),
  }
}

/** One project as the board's kernels read it. */
export function boardProjectFromView(view: GcProjectView, rows: BoardRows, invitesByPackage: Map<string, Invite[]>): GcProject {
  const dates = rows.boardDates[view.id]
  // Our number's inputs (B5-c): none for someone outside the money team, so they read 0.
  const money = rows.money?.find((m) => m.project_id === view.id)
  const name = (id: string | null) => (id ? (rows.customers.find((c) => c.id === id)?.name ?? '') : '')
  const lostWhy = LOST_WHYS.includes(dates?.lost_why as GcLostWhy) ? (dates?.lost_why as GcLostWhy) : null
  const point = pointOf(rows, view.address)
  const packages: TradePackage[] = view.trades.map((t) => ({
    id: t.id,
    trade: t.trade,
    bidTab: bidTabOf(rows, t.id),
    scope: t.scope.map((s) => ({ id: s.id, label: s.label })),
    budget: t.budget,
    // Our own trade's number is its Trades mode bid; until the board reads that bid, our budget stands in, not priced.
    selfPerform: t.ours ? { ref: t.ownBidId ?? '', value: t.budget, note: 'Our own crew.', priced: false } : null,
    invites: invitesByPackage.get(t.id) ?? [],
    // What we carry (B5): our own trade, the quote on an ask, our budget, or nothing yet. An award carries
    // the ask it went to (B6-a), as the prototype's award does.
    carried: t.ours ? 'self' : (t.awardedInviteId ?? t.carriedInviteId ?? (t.carryBudget ? 'plug' : null)),
    awardedInviteId: t.awardedInviteId ?? null,
    ...(t.awardedBy ? { awardedBy: rows.userNames?.[t.awardedBy] ?? 'Someone on our team' } : {}),
    ...(t.awardedOn ? { awardedOn: t.awardedOn } : {}),
    sow: sowOf(rows, t.id),
    ...(t.excludes.length ? { excludes: t.excludes } : {}),
  }))
  const questions: PlanQuestion[] = view.questions.map((q) => ({
    id: q.id,
    packageId: q.packageId ?? '',
    partnerId: '',
    text: q.text,
    askedOn: q.askedOn,
    answeredOn: q.answeredOn,
    answer: q.answer || null,
    ...(q.sheets.length ? { sheets: q.sheets } : {}),
    ...(q.sentToArchitectOn ? { sentToArchitectOn: q.sentToArchitectOn } : {}),
  }))
  return {
    id: view.id,
    name: view.name,
    address: view.address,
    town: townFromAddress(view.address) ?? '',
    ...(point ? { point } : {}),
    ourBidSentOn: dates?.our_bid_sent_on ?? null,
    ownerContractSignedOn: dates?.owner_contract_signed_on ?? null,
    ...(dates?.owner_contract_sent_on ? { ownerContractSentOn: dates.owner_contract_sent_on } : {}),
    permitOn: dates?.permit_on ?? null,
    startDate: dates?.start_date ?? null,
    startedOn: dates?.started_on ?? null,
    customerId: view.customerId,
    owner: name(view.customerId),
    customerRole: view.customerRole,
    ownerBilling: null,
    architectId: view.architectId ?? '',
    architect: name(view.architectId),
    questions,
    stage: stageOf(view.stage),
    bidDue: view.bidDue,
    sizeNote: view.sizeNote,
    planSets: view.planSets.map((s) => ({ rev: s.rev, label: s.label, issuedOn: s.issuedOn, touches: [] })),
    packages,
    generalConditions: num(money?.general_conditions),
    contingencyPct: num(money?.contingency_pct),
    feePct: num(money?.fee_pct),
    lostOn: view.lostOn,
    lostWhy,
    wonBy: dates?.won_by ?? null,
    ...(dates?.closed_on ? { closedOn: dates.closed_on } : {}),
  }
}

/**
 * A trade's statement of work (B6-a) as the kernels read it. Each line's id is its scope item's
 * (`SovLine.id`), or the line's own on a change order's line. Nothing is reported or billed until
 * Building's draws (U6). A cancelled one reads as none.
 */
function sowOf(rows: BoardRows, packageId: string): Sow | null {
  const row = rows.sows?.find((s) => s.package_id === packageId)
  if (!row || (row.status !== 'draft' && row.status !== 'sent' && row.status !== 'signed')) return null
  const sov: SovLine[] = (rows.sowLines ?? [])
    .filter((l) => l.sow_id === row.id)
    .sort((a, b) => a.position - b.position)
    .map((l) => ({
      id: l.scope_item_id ?? l.id,
      label: l.label,
      amount: num(l.amount),
      pctReported: 0,
      pctBilled: 0,
      ...(l.change_order_id ? { changeOrderId: l.change_order_id } : {}),
    }))
  return {
    status: row.status,
    price: num(row.price),
    retainagePct: num(row.retainage_pct),
    basedOnRev: row.based_on_rev,
    sov,
    signedOn: row.signed_on,
    draws: [],
    ...(row.accepted_on ? { acceptedOn: row.accepted_on } : {}),
    ...(row.sent_on ? { sentOn: row.sent_on } : {}),
    ...(row.their_sov && row.their_sov.length ? { theirSov: row.their_sov } : {}),
    ...(row.excluded && row.excluded.length ? { excluded: row.excluded } : {}),
  }
}

/** A trade's shared bid tab (B5-d): its day, whether names show, and the companies that opened it. Null: not shared. */
function bidTabOf(rows: BoardRows, packageId: string): BidTab | null {
  const tab = rows.bidTabs?.find((t) => t.package_id === packageId)
  if (!tab) return null
  const seenBy = (rows.bidTabViews ?? []).filter((v) => v.package_id === packageId).map((v) => v.company_id)
  return { sharedOn: tab.shared_on, showNames: tab.show_names, seenBy }
}

/** Everything the board reads, as the Board's kernels read it. */
export function boardStateFromRows(rows: BoardRows): GcState {
  const invitesByPackage = new Map<string, Invite[]>()
  for (const i of rows.invites) {
    const list = invitesByPackage.get(i.package_id) ?? []
    list.push(inviteFromRows(i, rows.quotes, rows.contacts))
    invitesByPackage.set(i.package_id, list)
  }
  // The asks that won a trade (B6-a's award), for each company's won count.
  const awarded = new Set(rows.projects.flatMap((p) => p.trades.map((t) => t.awardedInviteId).filter((id): id is string => Boolean(id))))
  // Phone and email from the customer record (the schedule's 7c-ii), for the call list's Call. No call log is kept for a customer yet.
  const customers: GcCustomer[] = rows.customers.map((c) => ({ id: c.id, name: c.name, contact: c.contact ?? '', ...extractContactFromCustomer({ contact_info: c.contact_info ?? null }), payDays: null, portalOn: false, retainagePct: null, address: '', contacts: [] }))
  return {
    today: rows.today,
    customers,
    projects: rows.projects.map((p) => boardProjectFromView(p, rows, invitesByPackage)),
    partners: rows.companies.map((c) => partnerFromRows(c, rows.invites, rows.quotes, { ...rows, awarded })),
    tradePromises: rows.promises.map((p) => promiseFromRows(p, rows.promiseMoves)),
    // Oldest first, as the kernels read them (paperSendsFor, paperStep's history).
    ...(rows.paperSends
      ? { paperSends: [...rows.paperSends].sort((a, b) => a.sent_on.localeCompare(b.sent_on) || a.created_at.localeCompare(b.created_at)).map(paperSendFromRow) }
      : {}),
  }
}
