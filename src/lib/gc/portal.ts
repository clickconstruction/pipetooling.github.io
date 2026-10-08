/**
 * GC mode, the real build: the trade portal's own rules, moved word for word from the GC mode prototype (branch spike/gc-mode,
 * `gcPortal.ts`): the one the Building lane's U2 reads, and those whose callees are on main by the Portal lane's P0. The readers
 * that wait for other lanes' kernels follow (to-dos/gc-mode/PORTAL_REAL_BUILD.md, Kernels that move).
 */
import { addDays } from './building'
import { onSite } from './buildingLog'
import { GC_COMPANY } from './company'
import { currentRev, partnerById } from './lookups'
import { inSentence } from './plans'
import type { PortalKey, PortalLang } from './portalI18n'
import { pDate, pExclusion, pWeekday, pt } from './portalI18n'
import { INSURANCE_ASK_DAYS } from './promises'
import type { LookAheadState, ScheduleRow } from './schedule/schedule'
import { activityName, inspectionItems, lookAheadWeeks, markState, mondayOf, scheduleRows } from './schedule/schedule'
import type { LookAheadMark } from './schedule/types'
import type { BackCharge, BidAlternate, ChangeOrder, ChangeOrderReason, Draw, GcProject, GcState, Invite, Partner, PartnerPerson, PlanSet, PortalMailGroup, ProjectContact, QuoteExclusion, ScopeItem, Sow, SubBid, TradeChangeRequest, TradePackage, TradePromise } from './types'
import { daysUntil, money } from './words'

// ---------------------------------------------------------------------------------------------
// Your pay: every pay application on the company's jobs, when it was asked, approved and paid
// ---------------------------------------------------------------------------------------------

/** We pay an approved pay application within this many days (owner, 2026-10-03). Retainage keeps its own day. */
export const PAY_WITHIN_DAYS = 10

/** What the plans block tells one company on one ask. */
export interface PortalPlanNews {
  /** The newest set on the project. */
  latest: PlanSet | undefined
  /** They have not opened any set on this ask yet. */
  neverOpened: boolean
  /** A set came out after the one they last opened. */
  behind: boolean
  /** The sets since they last looked that change this trade, oldest first. Empty: nothing new for them. */
  forTrade: PlanSet[]
}

/**
 * A new set only matters to a company when it changes their trade. One that does not still asks
 * them to open it, so everyone prices on the same drawings, but it does not warn them.
 */
export function portalPlanNews(project: GcProject, pkg: TradePackage, invite: Invite): PortalPlanNews {
  const rev = currentRev(project)
  const seen = invite.seenRev
  return {
    latest: project.planSets.find((s) => s.rev === rev),
    neverOpened: seen === null,
    behind: seen === null || seen < rev,
    forTrade: seen === null ? [] : project.planSets.filter((s) => s.rev > seen && s.touches.includes(pkg.id)).sort((a, b) => a.rev - b.rev),
  }
}

/** One line of a company's paperwork: is it done, and what the chip beside it says. */
export interface PortalPaperLine {
  done: boolean
  words: string
}

/** Insurance this close to running out gets a warning: the chip turns amber, Needs you asks, an email goes out. */
export const COI_WARN_DAYS = INSURANCE_ASK_DAYS

export function portalInsurance(
  partner: Partner,
  today: string,
  lang: PortalLang = 'en',
): PortalPaperLine & { ranOut: boolean; soon: boolean; daysLeft: number | null } {
  if (partner.coiExpires === null) return { done: false, ranOut: false, soon: false, daysLeft: null, words: pt(lang, 'noneOnFile') }
  const left = daysUntil(partner.coiExpires, today)
  const date = pDate(lang, partner.coiExpires)
  if (left < 0) return { done: false, ranOut: true, soon: false, daysLeft: left, words: pt(lang, 'coiRanOut', { date }) }
  if (left <= COI_WARN_DAYS) {
    const words = left === 0 ? pt(lang, 'coiSoonToday') : left === 1 ? pt(lang, 'coiSoonTomorrow', { date }) : pt(lang, 'coiSoon', { date, n: left })
    return { done: true, ranOut: false, soon: true, daysLeft: left, words }
  }
  return { done: true, ranOut: false, soon: false, daysLeft: left, words: pt(lang, 'coiGoodTo', { date }) }
}

/** The scope lines of a bid the office marked "not clear": the company has to say in or out. */
export function unclearLines(pkg: TradePackage, invite: Invite): ScopeItem[] {
  const bid = invite.bid
  if (!bid) return []
  return pkg.scope.filter((item) => bid.includes[item.id] === 'unclear')
}

/** A year from a day: the date a new certificate is good to, until they change it. */
export function aYearFrom(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${Number(y) + 1}-${m}-${m === '02' && d === '29' ? '28' : d}`
}

/**
 * Where one ask stands for the company: still bidding, their job, gone to another company, or
 * passed. Closed: we lost the project itself (Board lane's markLost), so nothing is built through us.
 */
export type PortalAskKind = 'bidding' | 'job' | 'lost' | 'passed' | 'closed'

/** The money on one job, as the company sees it. */
export interface PortalJobMoney {
  /** The contract to date: the statement of work plus the change orders signed into it. */
  price: number
  /** How much of the work they reported done, weighted by each line's amount. 0 to 100. */
  donePct: number
  paid: number
  /** Held back until the end of the job. */
  held: number
  /** Approved, payment on the way. */
  coming: number
  /** Asked for, the office is looking at it. */
  reviewing: number
}

export interface PortalTodo {
  key: string
  /** The project to open. Null: company paperwork, done on the home itself. */
  projectId: string | null
  text: string
  /** red: late or holding up work. amber: due within a week, or new. plain: when they can. */
  tone: 'red' | 'amber' | 'plain'
  /** The day it is due by, for the order. */
  by: string | null
  /** Where on the project page it lands: a block's data-portal-anchor. None: the top. */
  anchor?: string
}

/**
 * What a company reads once we lost the project (owner, 2026-10-03): why, in one line, then what it
 * means for them. Never the price and never who won. A project that died says so; every other
 * reason is the plain truth that we did not win it.
 */
export function portalClosedWords(project: GcProject, sentNumber: boolean, lang: PortalLang = 'en'): { why: string; next: string } {
  const gc = GC_COMPANY.shortName
  return {
    why: pt(lang, project.lostWhy === 'project_died' ? 'closedDied' : 'closedLost', { gc }),
    next: pt(lang, sentNumber ? 'closedThanksQuote' : 'closedNoNumber'),
  }
}

/**
 * What a trade's number leaves out, and who does it instead (the New Project lane's "Not in this
 * trade" list, `TradePackage.excludes`): "Gas piping (HVAC does it)". The office promises each
 * company sees it when it quotes (owner, 2026-10-04: on the bid form and the invitation). Empty on
 * older projects and on a trade with nothing listed. What the office typed stays as typed.
 */
/** Who does excluded work, inside a sentence: Click for "us", "the owner", or a trade (lower case in English, HVAC kept; as typed in Spanish). */
function exclusionWho(by: string, lang: PortalLang): string {
  return by === 'us' ? GC_COMPANY.shortName : by === 'the owner' ? pt(lang, 'byOwner') : lang === 'es' ? by : inSentence(by)
}

export function portalLeavesOut(pkg: TradePackage, lang: PortalLang = 'en'): string[] {
  return (pkg.excludes ?? [])
    .filter((x) => x.label.trim() !== '')
    .map((x) => {
      const what = x.label.trim()
      const by = x.by.trim()
      if (!by) return what
      return pt(lang, 'leavesOutLine', { what, who: exclusionWho(by, lang) })
    })
}

/**
 * The days our superintendent's daily log has the company on site for this job (owner, 2026-10-04;
 * the Building lane's `onSite`), counted from the log's first day, which the line names so it is
 * never more than the log can say: "Our daily log has you on site 6 days since Mon Sep 21, the
 * last on Thu Oct 1." Null on a job with no log yet, so nothing shows.
 */
export function portalOnSite(project: GcProject, pkg: TradePackage, today: string, lang: PortalLang = 'en'): string | null {
  const first = (project.dailyLogs ?? [])
    .map((l) => l.date)
    .filter((d) => d <= today)
    .sort()[0]
  if (!first) return null
  const { days } = onSite(project, pkg.id, first, today)
  const since = pWeekday(lang, first)
  const last = days[days.length - 1]
  if (!last) return pt(lang, 'onSiteNone', { since })
  return pt(lang, days.length === 1 ? 'onSite1' : 'onSiteN', { n: days.length, since, date: pWeekday(lang, last) })
}

/**
 * Where a company we did not know stands with us (owner, 2026-10-04, question 3): anyone can quote,
 * and we pick a quote only once the office approves the company. `known`: a company with no
 * vetting record, so the portal says nothing.
 */
export type PortalVettingState = 'known' | 'send' | 'checking' | 'approved' | 'declined'

/** One date a company gave us, as its portal shows it, with what it is for and where it stands. */
export interface PortalPromiseRow {
  p: TradePromise
  /** What it is, in the portal's language: "The renewed insurance certificate". What the office typed stays as typed. */
  what: string
  /** The job and trade it is for. Null: about the company itself. */
  where: string | null
  words: string
  tone: 'red' | 'amber' | 'plain'
  plural: boolean
  /** Where the day came from: the company gave it (in its portal or by phone), or the office asked for it when it sent a paper. */
  source: 'said' | 'asked'
  /** "You gave this day" or "Click asked for this day". */
  sourceWords: string
}

/** Where a paper opens: the agreement read-only, a pay application's window, or the job page. */
export type PortalPaperOpen = { kind: 'msa' } | { kind: 'payApp'; projectId: string; packageId: string; drawId: string } | { kind: 'project'; projectId: string }

export interface PortalPaper {
  key: string
  title: string
  /** "signed Jun 12", "sent Oct 2 · paid Oct 9". */
  words: string
  /** For the order, newest first. Null: no day kept (a W-9 on file). */
  on: string | null
  open: PortalPaperOpen | null
}

export interface PortalPreBid {
  on: string
  at: string
  mandatory: boolean
  /** Who came is recorded. */
  held: boolean
  came: boolean
  /** Held, required, and the company did not come. */
  missed: boolean
  /** "Run by Marsh & Vale Architects." */
  host: string
  /** "Tue Oct 6 at 10 AM, at the site." */
  when: string
  /** Whether coming is required to quote. */
  rule: string
  /** Before: bring your questions. After: you came, you missed a required one, or the minutes are coming. */
  after: string
}

/** A quote's exclusions in a sentence's words: "rock excavation ($38 per cy if it comes up) and sales tax". */
export function portalExclusionWords(list: QuoteExclusion[], lang: PortalLang = 'en'): string {
  const words = list.map((e) => {
    const name = pExclusion(lang, e.name)
    const what = lang === 'es' ? name.charAt(0).toLowerCase() + name.slice(1) : inSentence(name)
    return e.unitPrice ? pt(lang, 'exUnitWords', { what, amount: money(e.unitPrice.amount), unit: e.unitPrice.unit }) : what
  })
  if (words.length <= 1) return words[0] ?? ''
  return `${words.slice(0, -1).join(', ')}${pt(lang, 'and')}${words[words.length - 1]}`
}

/** "What you will not do" on a statement of work: "Rock excavation, $38 per cy if it comes up", "Testing and inspections (the owner does it)". */
export function portalSowExcluded(sow: Sow, lang: PortalLang = 'en'): string[] {
  return (sow.excluded ?? []).map((x) => {
    const what = pExclusion(lang, x.name)
    if (x.unitPrice) return pt(lang, 'sowNotUnit', { what, amount: money(x.unitPrice.amount), unit: x.unitPrice.unit })
    return x.by ? pt(lang, 'leavesOutLine', { what, who: exclusionWho(x.by, lang) }) : what
  })
}

/**
 * The link we send a company. One per company, and it is the key: no password. Made up here from
 * the company's id; the real one is a long random token, like the sub portal's.
 */
export function portalLink(partnerId: string): string {
  let h = 2166136261
  for (const c of partnerId) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0
  const token = h.toString(36).toUpperCase().padStart(7, '0').slice(0, 7)
  return `clicktooling.com/t/${token}`
}

/** One message we sent a company: an email (email only for now, owner 2026-10-03). */
export interface PortalMessage {
  key: string
  on: string
  kind: 'invite' | 'nudge' | 'plans' | 'bidTab' | 'msa' | 'sow' | 'start' | 'less' | 'change' | 'paid' | 'answer' | 'coi' | 'closed' | 'vetted' | 'preBid' | 'changeAsk' | 'backCharge' | 'dates' | 'startSoon'
  /** Null: about the company, not one project (the master agreement). */
  projectId: string | null
  subject: string
  /** The email, one paragraph a line. */
  lines: string[]
  /** What the number should cover, for an invitation. */
  scope?: string[]
  /** What the number leaves out and who does it, for an invitation. */
  leavesOut?: string[]
  /** The kind of email it is, for who at the company gets it (owner, 2026-10-05). */
  group?: PortalMailGroup
  /** Who at the company it went to, by name, the main contact first. */
  to?: string[]
}

export const PORTAL_MAIL_GROUPS: PortalMailGroup[] = ['quotes', 'job', 'contracts', 'pay']

/** The kinds the main contact gets: every kind unless the company changed it. */
export function contactGets(partner: Partner): PortalMailGroup[] {
  return partner.contactGets ?? PORTAL_MAIL_GROUPS
}

/** Whether every kind of email still goes to someone, with these picks. */
export function everyMailGroupCovered(main: PortalMailGroup[], people: PartnerPerson[]): boolean {
  return PORTAL_MAIL_GROUPS.every((g) => main.includes(g) || people.some((p) => p.gets.includes(g)))
}

/** Who gets one kind of email: the main contact when it has it, then each person ticked for it. Never empty. */
export function mailRecipients(partner: Partner, group: PortalMailGroup): { name: string; email: string | null; main: boolean }[] {
  const main = { name: partner.contact, email: partner.email ?? null, main: true }
  const others = (partner.people ?? []).filter((p) => p.gets.includes(group)).map((p) => ({ name: p.name, email: p.email, main: false }))
  const to = [...(contactGets(partner).includes(group) ? [main] : []), ...others]
  return to.length > 0 ? to : [main]
}

const KIND_GROUP: Record<PortalMessage['kind'], PortalMailGroup> = {
  dates: 'job',
  startSoon: 'job',
  invite: 'quotes',
  nudge: 'quotes',
  bidTab: 'quotes',
  closed: 'quotes',
  preBid: 'quotes',
  plans: 'quotes',
  answer: 'quotes',
  start: 'job',
  msa: 'contracts',
  sow: 'contracts',
  change: 'contracts',
  changeAsk: 'contracts',
  vetted: 'contracts',
  paid: 'pay',
  less: 'pay',
  coi: 'pay',
  backCharge: 'pay',
}

/**
 * The kind of email a message is. Plans and answers on a job that is ours go to the job's people,
 * not the estimator's. The office's paper sends say by their paper: a contract, or pay and papers.
 */
export function portalMailGroup(state: GcState, m: PortalMessage): PortalMailGroup {
  const send = m.key.startsWith('send:') ? (state.paperSends ?? []).find((x) => `send:${x.id}` === m.key) : undefined
  if (send) return send.paper === 'msa' || send.paper === 'sow' ? 'contracts' : 'pay'
  const project = m.projectId ? state.projects.find((p) => p.id === m.projectId) : undefined
  if ((m.kind === 'plans' || m.kind === 'answer') && project && project.stage !== 'pursuing') return 'job'
  return KIND_GROUP[m.kind]
}

/**
 * A company that has never been in its portal: no visit on record, and nothing it did there.
 * Its home opens with a welcome until it presses Got it.
 */
export function portalFirstVisit(state: GcState, partnerId: string): boolean {
  const partner = partnerById(state, partnerId)
  if (!partner || partner.portalOpenedOn || partner.msa === 'signed') return false
  for (const project of state.projects) {
    for (const pkg of project.packages) {
      for (const i of pkg.invites) {
        if (i.partnerId !== partnerId) continue
        if (i.seenRev !== null || i.bid || (i.contacts ?? []).some((c) => c.how === 'portal')) return false
      }
    }
  }
  return true
}

/** One scope line on the bid form, with the sheets it reads from and what changed on them. */
export interface PortalLine {
  item: ScopeItem
  /** The sheets the office set for the line, shown beside it. Empty for a line that stands for the whole trade. */
  sheets: string[]
  /**
   * The office set no sheet for the line, so it reads every sheet of its trade (owner, 2026-10-02).
   * A sheet only guessed from the line's words is not set (owner, 2026-10-03: show only the sheets
   * the office set).
   */
  wholeTrade: boolean
  /** The sheets it reads that a set newer than the company's number changed. */
  changed: string[]
  /** The sheets it read that a newer set took out: shown struck through, never opened. */
  gone: string[]
  /** The sections of the project manual the office set for the line, with their titles now. */
  specs: PortalSpec[]
  /** Those sets, by name. */
  by: string[]
}

/** One section a line reads, as the company sees it beside the line (owner, 2026-10-04). */
export interface PortalSpec {
  id: string
  /** Its title in the newest set, or as it was when a set took it out. Empty when the manual does not have it. */
  title: string
  /** A set newer than the company's number revised it. */
  changed: boolean
  /** A newer set took it out of the manual. */
  gone: boolean
}

/** The choices for how long a number holds, in days. */
export const GOOD_FOR_DAYS = [15, 30, 60, 90]

/** The last day a number holds. Null when the company did not say. */
export function bidGoodUntil(bid: SubBid): string | null {
  return bid.goodForDays ? addDays(bid.submittedOn, bid.goodForDays) : null
}

/** "LED high bays adds $4,200", "Owner buys the fixtures takes off $12,000". */
export function alternateWords(alt: BidAlternate, lang: PortalLang = 'en'): string {
  return pt(lang, alt.amount >= 0 ? 'altAdds' : 'altTakesOff', { label: alt.label, amount: money(Math.abs(alt.amount)) })
}

/** Which week, as the company reads it. Last week shows only while something in it is unmarked. */
export type PortalWeekWhen = 'last' | 'this' | 'next' | 'later'

export interface PortalLookAheadItem {
  row: ScheduleRow
  mark: LookAheadMark | null
  state: LookAheadState
  /** The company can mark it: last week or this week, and our superintendent has not verified it. */
  canMark: boolean
}

export interface PortalLookAheadWeek {
  weekOf: string
  when: PortalWeekWhen
  items: PortalLookAheadItem[]
}

/** From Friday on, this week's marks are due (owner: "at the week's end"). */
const MARK_FROM_WEEKDAY = 5

function isOurs(partnerId: string, row: ScheduleRow): boolean {
  const invite = row.pkg.invites.find((i) => i.id === row.pkg.awardedInviteId)
  return invite?.partnerId === partnerId
}

/**
 * One company's look-ahead on one project: last week while anything in it is unmarked, then
 * this week and the next two (the Building lane's lookAheadWeeks, three weeks in all).
 */
export function portalLookAhead(state: GcState, partnerId: string, project: GcProject): PortalLookAheadWeek[] {
  // Only on a job being built: a schedule drawn while buying out asks nothing of anyone yet.
  if (!project.schedule || project.stage !== 'building') return []
  const rows = scheduleRows(state, project).filter((r) => isOurs(partnerId, r))
  if (rows.length === 0) return []
  const marks = project.schedule.lookAhead
  const thisWeek = mondayOf(state.today)
  const lastWeek = addDays(thisWeek, -7)
  const lastItems = rows
    .filter((r) => r.activity.start <= addDays(lastWeek, 6) && r.activity.finish >= lastWeek)
    .map((row) => {
      const mark = marks.find((m) => m.weekOf === lastWeek && m.lineId === row.activity.lineId) ?? null
      return { row, mark, state: markState(mark), canMark: !mark?.verifiedOn }
    })
  const weeks: PortalLookAheadWeek[] = []
  if (lastItems.some((i) => i.mark === null)) weeks.push({ weekOf: lastWeek, when: 'last', items: lastItems })
  lookAheadWeeks(project, rows, state.today).forEach((w, i) => {
    weeks.push({
      weekOf: w.weekOf,
      when: i === 0 ? 'this' : i === 1 ? 'next' : 'later',
      items: w.items.map((it) => ({ ...it, canMark: i === 0 && !it.mark?.verifiedOn })),
    })
  })
  return weeks
}

/** The look-ahead marks a company owes: last week's still unmarked, and this week's once it is Friday. */
export function lookAheadOwed(state: GcState, partnerId: string, project: GcProject): { late: number; thisWeek: number } {
  const weeks = portalLookAhead(state, partnerId, project)
  const unmarked = (when: PortalWeekWhen) => weeks.find((w) => w.when === when)?.items.filter((i) => i.mark === null).length ?? 0
  const day = new Date(`${state.today}T00:00:00Z`).getUTCDay()
  const weekEnd = day === 0 || day >= MARK_FROM_WEEKDAY
  return { late: unmarked('last'), thisWeek: weekEnd ? unmarked('this') : 0 }
}

export type PortalPayState = 'checking' | 'approved' | 'late' | 'paid'

export interface PortalPayRow {
  project: GcProject
  pkg: TradePackage
  draw: Draw
  state: PortalPayState
  /** Approved and not paid yet: the day it should arrive by. */
  payBy: string | null
}

export interface PortalPayJob {
  project: GcProject
  pkg: TradePackage
  /** The contract to date: the statement of work plus signed change orders. */
  contract: number
  paid: number
  /** Held back now, until the end of the job. */
  held: number
  leftToBill: number
  /** When the held money comes back: paid back on a day, can be paid from a day, or after acceptance. */
  heldBack: { state: 'returned' | 'on' | 'after'; on: string | null }
}

/**
 * Who a company calls about one job: once the job is ours, the superintendent on site first, then
 * the project manager; while we bid, the project manager. Pay and paperwork is the company's own.
 */
export function portalContacts(project: GcProject): { team: ProjectContact[]; bidding: boolean } {
  const bidding = project.stage === 'pursuing'
  const team = project.team ?? []
  const order = (c: ProjectContact) => (c.role === 'superintendent' ? 0 : 1)
  return {
    bidding,
    team: bidding ? team.filter((c) => c.role === 'projectManager') : [...team].sort((a, b) => order(a) - order(b)),
  }
}

/**
 * Where a trade's change request stands: asked and not answered, turned down, or the change order
 * the office made of it, from its draft to the trade's signature on its statement of work.
 */
export type ChangeRequestState = 'asked' | 'drafting' | 'withCustomer' | 'customerNo' | 'customerYes' | 'toSign' | 'signed' | 'turnedDown'

export function changeRequestState(project: GcProject, request: TradeChangeRequest): { state: ChangeRequestState; co: ChangeOrder | null } {
  if (request.turnedDown) return { state: 'turnedDown', co: null }
  const co = request.changeOrderId ? ((project.changeOrders ?? []).find((c) => c.id === request.changeOrderId) ?? null) : null
  if (!co) return { state: 'asked', co: null }
  if (co.status === 'draft') return { state: 'drafting', co }
  if (co.status === 'sent') return { state: 'withCustomer', co }
  if (co.status === 'declined') return { state: 'customerNo', co }
  if (!co.tradeChange) return { state: 'customerYes', co }
  return { state: co.tradeChange.status === 'sent' ? 'toSign' : 'signed', co }
}

/** The change requests the office has not answered yet, oldest first: what the office's list reads. */
export function openChangeRequests(project: GcProject): TradeChangeRequest[] {
  return (project.changeRequests ?? []).filter((r) => changeRequestState(project, r).state === 'asked')
}

/** Whether a company can ask for a change on a trade: its statement of work is signed, on a job that is ours. */
export function portalCanAskChange(project: GcProject, pkg: TradePackage, partnerId: string): boolean {
  const awarded = pkg.invites.find((i) => i.id === pkg.awardedInviteId)
  return project.stage !== 'pursuing' && !pkg.selfPerform && pkg.sow?.status === 'signed' && awarded?.partnerId === partnerId
}

/** The reasons a company picks from, in its words; the same three a change order to the customer carries. */
export const PORTAL_CHANGE_WHY: { reason: ChangeOrderReason; key: PortalKey }[] = [
  { reason: 'field', key: 'crWhyField' },
  { reason: 'owner', key: 'crWhyOwner' },
  { reason: 'plans', key: 'crWhyPlans' },
]

export interface PortalChangeRow {
  request: TradeChangeRequest
  state: ChangeRequestState
  /** Why, in the company's words. */
  why: string
  /** "You asked $14,820 · sent Sep 30 · +2 working days" */
  asked: string
  chip: string
  tone: 'grey' | 'blue' | 'amber' | 'green' | 'red'
  /** Where it stands, in the company's words. */
  words: string
}

const CHANGE_CHIP: Record<ChangeRequestState, { key: PortalKey; tone: PortalChangeRow['tone'] }> = {
  asked: { key: 'crChipAsked', tone: 'grey' },
  drafting: { key: 'crChipDrafting', tone: 'blue' },
  withCustomer: { key: 'crChipWithCustomer', tone: 'blue' },
  customerNo: { key: 'crChipCustomerNo', tone: 'red' },
  customerYes: { key: 'crChipCustomerYes', tone: 'green' },
  toSign: { key: 'crChipToSign', tone: 'amber' },
  signed: { key: 'crChipSigned', tone: 'green' },
  turnedDown: { key: 'crChipTurnedDown', tone: 'red' },
}

/**
 * The changes a company asked for on one trade of a job, newest first, in its language. Its part is
 * what the change order pays it (its cost to us), never our price to the customer.
 */
export function portalChangeRequests(project: GcProject, pkg: TradePackage, partnerId: string, lang: PortalLang = 'en'): PortalChangeRow[] {
  const gc = GC_COMPANY.shortName
  return (project.changeRequests ?? [])
    .filter((r) => r.packageId === pkg.id && r.partnerId === partnerId)
    .map((request) => {
      const { state, co } = changeRequestState(project, request)
      const n = co?.number ?? 0
      const part = co ? money(co.cost) : ''
      const days = request.days === 1 ? pt(lang, 'crDays1') : request.days > 1 ? pt(lang, 'crDaysN', { n: request.days }) : ''
      const asked = [pt(lang, 'crAsked', { amount: money(request.amount), date: pDate(lang, request.askedOn) }), days].filter(Boolean).join(' · ')
      const words =
        state === 'turnedDown'
          ? pt(lang, 'crStTurnedDown', { gc, date: pDate(lang, request.turnedDown?.on ?? null), note: request.turnedDown?.note ?? '' })
          : state === 'asked'
            ? pt(lang, 'crStAsked', { gc })
            : state === 'drafting'
              ? pt(lang, 'crStDrafting', { gc })
              : state === 'withCustomer'
                ? pt(lang, 'crStWithCustomer', { gc, n, date: pDate(lang, co?.sentOn ?? null), part })
                : state === 'customerNo'
                  ? pt(lang, 'crStCustomerNo', { gc, n, date: pDate(lang, co?.answeredOn ?? null) })
                  : state === 'customerYes'
                    ? pt(lang, 'crStCustomerYes', { gc, n, date: pDate(lang, co?.answeredOn ?? null), part })
                    : state === 'toSign'
                      ? pt(lang, 'crStToSign', { n, part })
                      : pt(lang, 'crStSigned', { n, date: pDate(lang, co?.tradeChange?.signedOn ?? null), part })
      const why = pt(lang, PORTAL_CHANGE_WHY.find((w) => w.reason === request.reason)?.key ?? 'crWhyField')
      const chip = CHANGE_CHIP[state]
      return { request, state, why, asked, chip: pt(lang, chip.key), tone: chip.tone, words }
    })
    .reverse()
}

/** Days a company has to agree to a back-charge or dispute it. After them, one with no answer can come off a draw. */
export const BACK_CHARGE_ANSWER_DAYS = 5

/** Where a back-charge stands. noAnswer: its answer day went by with no answer. */
export type BackChargeState = 'open' | 'noAnswer' | 'agreed' | 'disputed' | 'kept' | 'dropped' | 'taken'

export function backChargeState(charge: BackCharge, today: string): BackChargeState {
  if (charge.taken) return 'taken'
  if (charge.status === 'open') return today > charge.answerBy ? 'noAnswer' : 'open'
  return charge.status
}

/** Whether the office can take it off a draw now: agreed, kept after a dispute, or never answered. */
export function backChargeCanTake(charge: BackCharge, today: string): boolean {
  const st = backChargeState(charge, today)
  return st === 'agreed' || st === 'kept' || st === 'noAnswer'
}

/** The draws a back-charge can come off: approved, not paid yet, and paying at least the charge. */
export function backChargeDraws(sow: Sow, charge: BackCharge): Draw[] {
  return sow.draws.filter((d) => d.status === 'approved' && d.net >= charge.amount - 0.005)
}

/** Every back-charge on a trade's work the office still has to act on, oldest first: disputed, or ready to take. */
export function backChargesToAct(sow: Sow, today: string): BackCharge[] {
  return (sow.backCharges ?? []).filter((c) => backChargeState(c, today) === 'disputed' || backChargeCanTake(c, today))
}

/** A note as a sentence: ends with a stop, so the words after it read. */
function asSentence(text: string): string {
  const t = text.trim()
  return t === '' || /[.!?]$/.test(t) ? t : `${t}.`
}

export interface PortalBackChargeRow {
  charge: BackCharge
  state: BackChargeState
  /** "$850 · sent Sep 30" */
  line: string
  chip: string
  tone: 'grey' | 'amber' | 'red' | 'green'
  /** Where it stands, in the company's words. */
  words: string
  /** Its own reason, when it disputed. */
  theirReason: string | null
  /** It can still agree or dispute it. */
  canAnswer: boolean
}

const BACK_CHARGE_CHIP: Record<BackChargeState, { key: PortalKey; tone: PortalBackChargeRow['tone'] }> = {
  open: { key: 'bcChipOpen', tone: 'amber' },
  noAnswer: { key: 'bcChipNoAnswer', tone: 'red' },
  agreed: { key: 'bcChipAgreed', tone: 'grey' },
  disputed: { key: 'bcChipDisputed', tone: 'amber' },
  kept: { key: 'bcChipKept', tone: 'red' },
  dropped: { key: 'bcChipDropped', tone: 'green' },
  taken: { key: 'bcChipTaken', tone: 'grey' },
}

/** The charges on a company's work on one trade of a job, newest first, in its language. */
export function portalBackCharges(project: GcProject, pkg: TradePackage, partnerId: string, today: string, lang: PortalLang = 'en'): PortalBackChargeRow[] {
  const awarded = pkg.invites.find((i) => i.id === pkg.awardedInviteId)
  const sow = pkg.sow
  // Only on a job that is ours, to the company on the work.
  if (!sow || project.stage === 'pursuing' || awarded?.partnerId !== partnerId) return []
  const gc = GC_COMPANY.shortName
  return (sow.backCharges ?? [])
    .map((charge) => {
      const state = backChargeState(charge, today)
      const draw = charge.taken ? sow.draws.find((d) => d.id === charge.taken?.drawId) : undefined
      const n = draw?.number ?? 0
      const chip = BACK_CHARGE_CHIP[state]
      const by = pDate(lang, charge.answerBy)
      const settledNote = asSentence(charge.settled?.note ?? '')
      const words =
        state === 'open'
          ? pt(lang, 'bcStOpen', { date: by })
          : state === 'noAnswer'
            ? pt(lang, 'bcStNoAnswer', { date: by })
            : state === 'agreed'
              ? pt(lang, 'bcStAgreed', { date: pDate(lang, charge.answer?.on ?? null) })
              : state === 'disputed'
                ? pt(lang, 'bcStDisputed', { gc, date: pDate(lang, charge.answer?.on ?? null) })
                : state === 'kept'
                  ? pt(lang, 'bcStKept', { gc, date: pDate(lang, charge.settled?.on ?? null), note: settledNote })
                  : state === 'dropped'
                    ? pt(lang, 'bcStDropped', { gc, date: pDate(lang, charge.settled?.on ?? null), note: settledNote })
                    : pt(lang, 'bcStTaken', { n, date: pDate(lang, charge.taken?.on ?? null) })
      return {
        charge,
        state,
        line: pt(lang, 'bcLine', { amount: money(charge.amount), date: pDate(lang, charge.sentOn) }),
        chip: pt(lang, chip.key, { date: by, gc, n }),
        tone: chip.tone,
        words,
        theirReason: charge.status !== 'agreed' && charge.answer?.note ? pt(lang, 'bcYourReason', { note: charge.answer.note }) : null,
        canAnswer: state === 'open' || state === 'noAnswer',
      }
    })
    .reverse()
}

/** How many weeks Your weeks shows: this week and the next three. */
export const PORTAL_WEEKS_AHEAD = 4

export interface PortalWeekItem {
  project: GcProject
  row: ScheduleRow
  /** "Plumbing · Trim" */
  name: string
  /** The days of it in this week, Monday to Friday: "Mon Oct 12 to Fri Oct 16". */
  days: string
  from: string
  /** Its company's first day on that job falls on this activity, this week. */
  firstOnJob: boolean
  /** It finishes this week. */
  finishes: boolean
}

export interface PortalWeek {
  weekOf: string
  when: 'this' | 'next' | 'later'
  title: string
  items: PortalWeekItem[]
  /** Inspections on its jobs this week, not passed yet: "Fair Oaks Shops, Building D · Rough-in inspection, Tue Oct 6". */
  inspections: { project: GcProject; words: string }[]
  /** Days two or more of its jobs have its work, in words. */
  overlaps: string[]
}

function isWeekday(day: string): boolean {
  const d = new Date(`${day}T00:00:00Z`).getUTCDay()
  return d >= 1 && d <= 5
}

function spanWords(lang: PortalLang, from: string, to: string): string {
  return from === to ? pt(lang, 'wkOn', { day: pWeekday(lang, from) }) : pt(lang, 'wkSpan', { from: pWeekday(lang, from), to: pWeekday(lang, to) })
}

/**
 * One company's work on every job of ours with a schedule, this week and the next three: each
 * activity of its trades not done yet, the days of it in each week, its first day on a job, the
 * inspections on its jobs, and the days two of its jobs want it at once. Empty: no work scheduled.
 */
export function portalWeeks(state: GcState, partnerId: string, lang: PortalLang = 'en'): PortalWeek[] {
  const jobs = state.projects
    .filter((p) => p.stage !== 'pursuing' && p.schedule)
    .map((project) => ({ project, rows: scheduleRows(state, project).filter((r) => isOurs(partnerId, r) && r.actual < 100) }))
    .filter((j) => j.rows.length > 0)
  if (jobs.length === 0) return []
  const gc = GC_COMPANY.shortName
  const first = mondayOf(state.today)
  return Array.from({ length: PORTAL_WEEKS_AHEAD }, (_, i) => {
    const weekOf = addDays(first, i * 7)
    const friday = addDays(weekOf, 4)
    const sunday = addDays(weekOf, 6)
    const items: PortalWeekItem[] = []
    const onDay = new Map<string, Set<string>>()
    const inspections: PortalWeek['inspections'] = []
    for (const { project, rows } of jobs) {
      const firstDay = [...scheduleRows(state, project).filter((r) => isOurs(partnerId, r)).map((r) => r.activity.start)].sort()[0]
      for (const row of rows) {
        const { start, finish } = row.activity
        const from = start > weekOf ? start : weekOf
        const to = finish < friday ? finish : friday
        if (from > to) continue
        for (let d = from; d <= to; d = addDays(d, 1)) {
          if (!isWeekday(d)) continue
          onDay.set(d, new Set([...(onDay.get(d) ?? []), project.id]))
        }
        items.push({ project, row, name: activityName(row), days: spanWords(lang, from, to), from, firstOnJob: start === firstDay && start >= weekOf, finishes: finish <= sunday })
      }
      for (const insp of inspectionItems(project, state.today)) {
        const on = insp.activity.start
        if (on < weekOf || on > sunday || insp.activity.inspection?.passedOn) continue
        inspections.push({ project, words: `${project.name} · ${insp.label}, ${pWeekday(lang, on)}` })
      }
    }
    items.sort((a, b) => a.from.localeCompare(b.from) || a.project.name.localeCompare(b.project.name))
    // Runs of days with the same two or more jobs.
    const overlaps: string[] = []
    let run: { from: string; to: string; ids: string } | null = null
    const flush = () => {
      if (!run) return
      const names = run.ids.split('|').map((id) => state.projects.find((p) => p.id === id)?.name ?? id)
      overlaps.push(pt(lang, 'wkOverlap', { jobs: names.join(pt(lang, 'and')), days: spanWords(lang, run.from, run.to), gc }))
      run = null
    }
    for (let d = weekOf; d <= friday; d = addDays(d, 1)) {
      const ids = [...(onDay.get(d) ?? [])].sort()
      if (ids.length < 2) {
        flush()
        continue
      }
      const key = ids.join('|')
      if (run && run.ids === key) run.to = d
      else {
        flush()
        run = { from: d, to: d, ids: key }
      }
    }
    flush()
    const date = pDate(lang, weekOf)
    const when: PortalWeek['when'] = i === 0 ? 'this' : i === 1 ? 'next' : 'later'
    const title = pt(lang, when === 'this' ? 'wkThis' : when === 'next' ? 'wkNext' : 'wkOf', { date })
    return { weekOf, when, title, items, inspections, overlaps }
  })
}
