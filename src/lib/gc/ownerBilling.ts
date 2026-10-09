/**
 * GC mode, the real build: a project's change orders and their days, moved word for word from the GC
 * mode prototype (branch spike/gc-mode, `gcOwnerBilling.ts`) by the schedule's PR 1a, which reads them.
 * Owner Billing's O2a added what of billing the customer reads only main today: the price by line, a sent
 * bill's money, when it is due, our waivers, the spread of our costs and fee, a change order's words. O2b
 * adds `ownerPayApp` and the rest, which read the Building lane's kernels.
 */
import type { ChangeOrder, GcCustomer, GcProject, GcState, OwnerPayAppSent, OwnerRetainageStep, TradePackage } from './types'
import { carriedAmount, proposalTotals } from './bids'
import { partnerById } from './lookups'
import { daysUntil, money, shortDate } from './words'
import type { PayAppLine, PayApplication } from './building'
import { changeOrderTradePct, ownCrewWork, retainageHeldNow, tradeCloseout } from './building'
import { GC_COMPANY } from './company'
import type { PayAppParties } from './payAppFile'

export function projectChangeOrders(project: GcProject): ChangeOrder[] {
  return project.changeOrders ?? []
}

export function signedChangeOrders(project: GcProject): ChangeOrder[] {
  return projectChangeOrders(project).filter((co) => co.status === 'signed')
}

/** The days a change order adds to the job. 0: none, or only said in its schedule words. */
export function changeOrderDays(co: ChangeOrder): number {
  return co.days ?? 0
}

/** The days the owner's signed change orders add to the contract time, added up. */
export function contractDaysAdded(project: GcProject): number {
  return signedChangeOrders(project).reduce((t, co) => t + changeOrderDays(co), 0)
}

/** We bill the owner once a month (the owner's call, 2026-10-02). The day of the month is my default. */
export const OWNER_BILL_DAY = 25

/** What the owner holds back from each bill when their customer record does not say. */
export const OWNER_RETAINAGE_DEFAULT_PCT = 10

export type OwnerLineKind = 'trade' | 'self' | 'generalConditions' | 'contingency' | 'fee' | 'changeOrder'

/** One line of the owner's bill: a trade, or one of our own costs. */
export interface OwnerLine {
  id: string
  label: string
  kind: OwnerLineKind
  /** What the line is worth in our price to the owner. */
  worth: number
  /** The work done on it so far, in dollars. */
  doneToDate: number
  /** The work done on it by the last pay application. 0 before the first one goes. */
  doneBefore: number
  /** The work done since the last pay application: done so far less done before. */
  thisMonth: number
  /** Where the line's progress comes from, in one sentence. */
  source: string
  /** The trade's own lines behind the number, when a statement of work has them. */
  detail: { label: string; pct: number; theySay?: number }[]
  /** Our own crew's percent done, on a trade we do ourselves, as Draws → Our own crew reports it. */
  crewPct?: number
  /** The change order this line bills, on a change order's line. */
  changeOrderId?: string
  /** Materials stored on site and not yet in place, in the owner's dollars (column F). Absent: none. */
  stored?: number
}

export interface OwnerPayApp {
  number: number
  /** The day it goes to the owner: the next bill day after the last one, or on or after today. */
  billOn: string
  /** The bill day plus the owner's usual days to pay, or the contract's while they have never paid us. Null: neither is known. */
  expectPaidOn: string | null
  lines: OwnerLine[]
  /** Our price to the owner: every line's worth, signed change orders included. */
  contract: number
  /** The price before change orders: what the owner contract was signed for. */
  originalContract: number
  /** What signed change orders added, less what they took out. */
  changeOrdersTotal: number
  doneToDate: number
  /** Materials stored on site, not yet in place, on every line (column F). Line 4 counts it with the work. */
  stored: number
  /** What was stored on the last pay application. */
  storedBefore: number
  /** 0 to 1: the share of the trades' work done. Our own costs and fee follow it. */
  tradeShare: number
  /** The owner's full percent. With a step, they hold less once the work is far enough along. */
  retainagePct: number
  /** The step we chose for this job, if any. */
  retainageStep?: OwnerRetainageStep
  /** What the owner holds back on the work done so far. */
  retainage: number
  /** What they held after the last pay application: this bill's retainage less this is what it adds to the holding. */
  retainageBefore: number
  /** What earlier pay applications asked the owner to pay, added up. */
  askedBefore: number
  /** What this bill asks the owner to pay now. */
  due: number
  /** What is still to bill, with what the owner holds. */
  leftToBill: number
  /** False until we press Start on Get started. */
  started: boolean
}

function customerOf(state: GcState, project: GcProject): GcCustomer | undefined {
  return state.customers.find((c) => c.id === project.customerId)
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days)).toISOString().slice(0, 10)
}

/** The next bill day on or after today. */
export function nextOwnerBillDay(today: string): string {
  const [y, m, d] = today.split('-').map(Number)
  const year = y ?? 1970
  const month = (m ?? 1) - 1 + ((d ?? 1) > OWNER_BILL_DAY ? 1 : 0)
  return new Date(Date.UTC(year, month, OWNER_BILL_DAY)).toISOString().slice(0, 10)
}

/** Our price to the owner by line as it stands today: what we carry for each trade, then our costs and fee. */
export function ownerContractWorthNow(project: GcProject): Record<string, number> {
  const totals = proposalTotals(project)
  return {
    ...Object.fromEntries(project.packages.map((pkg) => [pkg.id, carriedAmount(pkg) ?? 0])),
    gc: totals.generalConditions,
    contingency: totals.contingency,
    fee: totals.fee,
  }
}

/**
 * The owner's price by line: as they signed it once it is kept (owner, 2026-10-04), else what we
 * carry today. A trade that came after they signed is worth nothing on it: its change order bills it.
 */
export function ownerContractWorthOf(project: GcProject): Record<string, number> {
  return project.ownerContractWorth ?? ownerContractWorthNow(project)
}

/** The price the owner signed for, before change orders. */
export function ownerContractPrice(project: GcProject): number {
  return Object.values(ownerContractWorthOf(project)).reduce((t, n) => t + n, 0)
}

/** The pay applications we sent the owner on this project, oldest first. */
export function ownerPayAppsSent(project: GcProject): OwnerPayAppSent[] {
  return project.ownerBilling?.payApps ?? []
}

/** What the architect certified on a pay application. Null: waiting on them. The made-up history counts as certified as asked. */
export function appCertified(app: OwnerPayAppSent): number | null {
  return app.certified === undefined ? app.due : app.certified
}

/** What a pay application counts for on the bills after it (G702 line 7): its certificate, or what we asked while it waits. */
export function appClaimed(app: OwnerPayAppSent): number {
  return appCertified(app) ?? app.due
}

/** What the owner has paid on a pay application so far: every payment, a part payment included. */
export function appPaid(app: OwnerPayAppSent): number {
  if (app.payments && app.payments.length > 0) return app.payments.reduce((s, p) => s + p.amount, 0)
  return app.paidOn === null ? 0 : (app.paidAmount ?? appClaimed(app))
}

/** What is still open on a pay application: what it counts for, less what the owner paid. */
export function appOpen(app: OwnerPayAppSent): number {
  return app.paidOn !== null ? 0 : Math.max(0, appClaimed(app) - appPaid(app))
}

/**
 * What the owner holds on `done` of work against our price `contract`: their full percent, or with a
 * step, the full percent until the work is that far along, then the lower one (on the rest, or on
 * all of it).
 */
export function ownerRetainageOn(pct: number, step: OwnerRetainageStep | undefined, done: number, contract: number): number {
  if (!step || contract <= 0) return (done * pct) / 100
  const at = (contract * step.atPct) / 100
  if (done <= at + 0.005) return (done * pct) / 100
  return step.way === 'all' ? (done * step.toPct) / 100 : (at * pct) / 100 + ((done - at) * step.toPct) / 100
}

/** "10% until the end", or "10% until the work is 50% done, then 5% on the rest". */
export function ownerRetainageWords(pct: number, step: OwnerRetainageStep | undefined): string {
  if (!step) return `${pct}% of every bill until the end`
  const at = step.atPct === 50 ? 'half done' : `${step.atPct}% done`
  return `${pct}% until the work is ${at}, then ${step.toPct}% ${step.way === 'all' ? 'on all of it' : 'on the rest'}`
}

/** What a draft asks for beyond this month's work: what the architect left out of earlier certificates. */
export function ownerCarriedForward(app: OwnerPayApp): number {
  // This month's work, less what it adds to the holding (a drop in retainage gives some back):
  // anything the bill asks beyond that is what the architect left out before.
  const thisMonth = app.lines.reduce((t, l) => t + l.thisMonth, 0)
  const carried = app.due - (thisMonth + (app.stored - app.storedBefore) - (app.retainage - app.retainageBefore))
  return carried > 0.5 ? carried : 0
}

/** True when the draft asks for something: a dollar or more of new work. */
export function ownerPayAppHasWork(app: OwnerPayApp): boolean {
  return Math.round(app.due) > 0
}

/** The draft as it goes to the owner today: the record the reducer keeps. */
export function ownerPayAppToSend(app: OwnerPayApp, today: string): OwnerPayAppSent {
  return {
    number: app.number,
    periodTo: app.billOn,
    sentOn: today,
    doneToDate: Object.fromEntries(app.lines.map((l) => [l.id, l.doneToDate])),
    worthByLine: Object.fromEntries(app.lines.map((l) => [l.id, l.worth])),
    workToDate: app.doneToDate + app.stored,
    ...(app.stored > 0.005 ? { storedByLine: Object.fromEntries(app.lines.filter((l) => (l.stored ?? 0) > 0.005).map((l) => [l.id, l.stored ?? 0])) } : {}),
    retainagePct: app.retainagePct,
    retainage: app.retainage,
    ...(app.retainageStep ? { retainageStep: app.retainageStep } : {}),
    due: app.due,
    paidOn: null,
    certified: null,
    certifiedOn: null,
  }
}

/** Where we stand with the owner on one project, from the pay applications we sent. */
export interface OwnerAccount {
  /** The work billed so far: the last pay application's done so far. */
  billed: number
  /** What the owner holds on it until the end. */
  retainageHeld: number
  /** What our pay applications asked them to pay, added up: the architect's certificate where there is one. */
  asked: number
  paid: number
  /** Asked less paid. */
  owed: number
  /** Of what they owe: certified by the architect and not paid yet. */
  certifiedUnpaid: number
  /** Of what they owe: sent and waiting on the architect to certify. */
  waitingOnArchitect: number
}

/**
 * The owner's account on a project, read off the pay applications we sent. Null when none went.
 * The same three numbers the OwnerBilling record holds by hand (billed, paid, retainage held), so
 * the owner window could read these instead.
 */
export function ownerAccount(project: GcProject): OwnerAccount | null {
  const sent = ownerPayAppsSent(project)
  const last = sent[sent.length - 1]
  if (!last) return null
  const asked = sent.reduce((s, a) => s + appClaimed(a), 0)
  const paid = sent.reduce((s, a) => s + appPaid(a), 0)
  const unpaid = sent.filter((a) => a.paidOn === null)
  return {
    billed: last.workToDate,
    retainageHeld: last.retainage,
    asked,
    paid,
    owed: asked - paid,
    certifiedUnpaid: unpaid.reduce((s, a) => s + (appCertified(a) === null ? 0 : appOpen(a)), 0),
    waitingOnArchitect: unpaid.filter((a) => appCertified(a) === null).reduce((s, a) => s + a.due, 0),
  }
}

/**
 * The day we expect the owner to pay a pay application: the day the architect certified it (or it went) plus their
 * usual days, or, when they have never paid us, the contract's days to pay (O5d). Null: neither is known.
 */
export function ownerExpectPaidOn(state: GcState, project: GcProject, app: OwnerPayAppSent): string | null {
  const payDays = customerOf(state, project)?.payDays ?? project.ownerPayDays ?? null
  return payDays == null ? null : addDays(app.certifiedOn ?? app.sentOn, payDays)
}

/** One of our own waivers to the owner, on one pay application. */
export interface OurOwnerWaiver {
  payApp: number
  kind: 'conditional' | 'unconditional'
  /** On final payment: the waivers with our final pay application. Otherwise on progress payment. */
  final: boolean
  amount: number
  signedOn: string
}

/**
 * Our waivers to the owner: a conditional waiver on progress payment with each pay application
 * when it goes, and the unconditional one when we mark it paid. Newest first.
 */
export function ourOwnerWaivers(project: GcProject): OurOwnerWaiver[] {
  const out: OurOwnerWaiver[] = []
  for (const app of ownerPayAppsSent(project)) {
    const final = app.final === true
    out.push({ payApp: app.number, kind: 'conditional', final, amount: app.due, signedOn: app.sentOn })
    // One unconditional waiver for each payment received, for what it paid.
    if (app.payments && app.payments.length > 0) {
      for (const p of app.payments) out.push({ payApp: app.number, kind: 'unconditional', final, amount: p.amount, signedOn: p.on })
    } else if (app.paidOn !== null) out.push({ payApp: app.number, kind: 'unconditional', final, amount: appPaid(app), signedOn: app.paidOn })
  }
  return out.reverse()
}

/** The owner has paid us the retainage they held. The Building lane's trade release waits for it (owner's call). */
export function ownerReleasedRetainage(project: GcProject): boolean {
  return ownerPayAppsSent(project).some((a) => a.final === true && a.paidOn !== null)
}

/** The lines that are our own costs and fee, not a trade. */
export const OUR_COST_LINE_IDS = ['gc', 'contingency', 'fee']

export type SpreadLine<L> = L & {
  /** The trade's own amount before our share was added: its worth in the price. */
  tradeWorth: number
  /** Our costs and fee carried on this line. */
  ourShare: number
}

/** The trade lines with our costs and fee spread into them. Our own lines drop out. */
export function spreadMarkup<L extends { id: string; worth: number; doneBefore: number; thisMonth: number; doneToDate: number }>(
  lines: L[],
): SpreadLine<L>[] {
  const ours = lines.filter((l) => OUR_COST_LINE_IDS.includes(l.id))
  // A change order's price already carries our fee: its line passes through as it is.
  const changes = lines.filter((l) => isChangeOrderLineId(l.id))
  const trades = lines.filter((l) => !OUR_COST_LINE_IDS.includes(l.id) && !isChangeOrderLineId(l.id))
  const total = (rows: L[], key: 'worth' | 'doneBefore' | 'doneToDate') => rows.reduce((s, l) => s + l[key], 0)
  const share = (l: L, key: 'worth' | 'doneBefore' | 'doneToDate') => {
    const t = total(trades, key)
    return t === 0 ? 0 : (total(ours, key) * l[key]) / t
  }
  return trades.map((l) => {
    const doneBefore = l.doneBefore + share(l, 'doneBefore')
    const doneToDate = l.doneToDate + share(l, 'doneToDate')
    const ourShare = share(l, 'worth')
    // Sharing out in proportion can leave a hair below zero on a line with no new work: it reads $0.
    const thisMonth = Math.abs(doneToDate - doneBefore) < 0.005 ? 0 : doneToDate - doneBefore
    return { ...l, worth: l.worth + ourShare, doneBefore, doneToDate, thisMonth, tradeWorth: l.worth, ourShare }
  })
    .concat(changes.map((l) => ({ ...l, tradeWorth: l.worth, ourShare: 0 })))
}

/** Our costs and fee as a share of the trades' price: 0.372 reads "37.2% on top". */
export function markupOnTop(lines: { id: string; worth: number }[]): number {
  const trades = lines.filter((l) => !OUR_COST_LINE_IDS.includes(l.id) && !isChangeOrderLineId(l.id)).reduce((s, l) => s + l.worth, 0)
  const ours = lines.filter((l) => OUR_COST_LINE_IDS.includes(l.id)).reduce((s, l) => s + l.worth, 0)
  return trades === 0 ? 0 : ours / trades
}

export const CHANGE_ORDER_REASON_WORDS: Record<ChangeOrder['reason'], string> = {
  owner: 'Customer directive',
  field: 'Field condition',
  plans: 'Plan revision',
}

/** Change-order lines on the bill are keyed by the change order's id, which starts "co-". */
export function isChangeOrderLineId(id: string): boolean {
  return id.startsWith('co-')
}

/** The contract's days to pay in Bill the customer's terms (O5d), or the ask to type them. */
export function ownerPayDaysWords(days: number | null | undefined): string {
  return days == null ? 'Type the contract\'s days to pay so a first bill can go late.' : `They pay within ${daysWords(days)} of the certificate, by the contract.`
}

/** "1 day", "5 days". */
export function daysWords(days: number): string {
  return `${days} ${days === 1 ? 'day' : 'days'}`
}

/** What a change order does to the schedule, in words: "adds 5 days to the job", or its own words. */
export function changeOrderScheduleWords(co: ChangeOrder): string {
  const days = changeOrderDays(co)
  if (days > 0) return `adds ${daysWords(days)} to the job`
  return co.schedule === 'none' ? 'no days added' : `schedule: ${co.schedule}`
}

/** The price a change order starts at: what it costs us plus the job's fee, in whole dollars. */
export function changeOrderPrice(project: GcProject, cost: number): number {
  return Math.round(cost * (1 + project.feePct / 100))
}

/** "Change order 2 · Hill Country Interiors" or "Change order 2 · our own work". */
export function changeOrderWho(state: GcState, project: GcProject, co: ChangeOrder): string {
  if (co.packageId === null) return 'our own work'
  const pkg = project.packages.find((p) => p.id === co.packageId)
  if (!pkg) return 'our own work'
  if (pkg.selfPerform) return `our own crew on ${pkg.trade}`
  const invite = pkg.invites.find((i) => i.id === pkg.awardedInviteId)
  const company = invite ? partnerById(state, invite.partnerId)?.company : undefined
  return company ? `${company} on ${pkg.trade}` : pkg.trade
}

export interface OwnerPayDue {
  /** The day it is due: their newest promise, or the day we expected it. Null: we cannot say yet. */
  on: string | null
  /** True when the day is their own word. */
  promised: boolean
  /** Days past that day, while it is not paid. 0: not late. */
  daysLate: number
  /** Earlier promises whose day passed with the bill not paid. */
  missed: number
}

export function ownerPayDue(state: GcState, project: GcProject, app: OwnerPayAppSent): OwnerPayDue {
  const promises = app.promises ?? []
  const newest = promises[promises.length - 1]
  const on = newest?.by ?? ownerExpectPaidOn(state, project, app)
  const unpaid = app.paidOn === null
  const daysLate = unpaid && on !== null ? Math.max(0, daysUntil(state.today, on)) : 0
  // An earlier promise counts as missed when its day passed before they gave the next one.
  const missed = promises.slice(0, -1).filter((p, i) => {
    const next = promises[i + 1]
    return next !== undefined && daysUntil(next.madeOn, p.by) > 0
  }).length
  return { on, promised: newest !== undefined, daysLate, missed }
}

/** The bills on a project that are late, the latest first. */
export function ownerLateBills(state: GcState, project: GcProject): { app: OwnerPayAppSent; due: OwnerPayDue; open: number }[] {
  return ownerPayAppsSent(project)
    .map((app) => ({ app, due: ownerPayDue(state, project, app), open: appOpen(app) }))
    .filter((b) => b.due.daysLate > 0 && b.open > 0.005)
    .sort((a, b) => b.due.daysLate - a.due.daysLate)
}

function tradeLine(state: GcState, pkg: TradePackage, worth: number): OwnerLine {
  const base = { id: pkg.id, label: pkg.trade, worth, doneBefore: 0, detail: [] as OwnerLine['detail'] }
  if (pkg.selfPerform) {
    // One number with the Building lane's Our own crew card: by stage once reported that way.
    const crew = ownCrewWork(pkg)
    const pct = crew?.pct ?? 0
    const done = crew && crew.worth > 0 ? (worth * crew.done) / crew.worth : 0
    return {
      ...base,
      kind: 'self',
      doneToDate: done,
      thisMonth: done,
      crewPct: pct,
      source: done > 0 ? `Our own crew reported ${pct}% done${crew?.byStage ? ', by stage' : ''}.` : 'Our own crew has not reported any work yet.',
      detail: crew?.byStage ? crew.stages.map((st) => ({ label: st.label, pct: st.pct })) : [],
    }
  }
  const invite = pkg.invites.find((i) => i.id === pkg.awardedInviteId)
  const company = invite ? (partnerById(state, invite.partnerId)?.company ?? 'The company') : null
  const sow = pkg.sow
  if (!company) return { ...base, kind: 'trade', doneToDate: 0, thisMonth: 0, source: 'Not awarded yet.' }
  if (!sow || sow.status !== 'signed') {
    return { ...base, kind: 'trade', doneToDate: 0, thisMonth: 0, source: `${company}. Their statement of work is not signed yet.` }
  }
  // A pay application we sent back is open until they resend it under the same number. Until
  // then the owner is billed what we see on the lines we doubt (owner's call, 2026-10-02).
  const weSee = new Map<string, number>()
  for (const back of sow.sentBack ?? []) {
    if (sow.draws.some((d) => d.number === back.draw.number)) continue
    for (const line of back.lines) weSee.set(line.sovId, Math.min(weSee.get(line.sovId) ?? 100, line.weSee))
  }
  const pctOf = (l: { id: string; pctReported: number }) => Math.min(l.pctReported, weSee.get(l.id) ?? 100)
  // A change order's line on their statement of work bills on the change order's own line, not here.
  const ownLines = sow.sov.filter((l) => l.changeOrderId === undefined)
  const reported = ownLines.reduce((s, l) => s + (l.amount * l.pctReported) / 100, 0)
  const done = ownLines.reduce((s, l) => s + (l.amount * pctOf(l)) / 100, 0)
  const pct = sow.price === 0 ? 0 : Math.round((done / sow.price) * 100)
  const reportedPct = sow.price === 0 ? 0 : Math.round((reported / sow.price) * 100)
  const doubted = Math.round(reported - done) > 0
  // The owner's line is worth what they signed for: it bills the trade's share done of that.
  const billed = sow.price === 0 ? 0 : (worth * done) / sow.price
  // Materials stored on site, from their newest pay application (Building lane, question 12): a
  // balance, not added up, and it moves into the work once it is in place.
  const newest = [...sow.draws].sort((a, b) => b.number - a.number)[0]
  const storedTrade = newest && !newest.final ? newest.lines.filter((l) => ownLines.some((o) => o.id === l.sovId)).reduce((s, l) => s + (l.stored ?? 0), 0) : 0
  const stored = sow.price === 0 ? 0 : (worth * storedTrade) / sow.price
  return {
    ...base,
    kind: 'trade',
    doneToDate: billed,
    thisMonth: billed,
    ...(stored > 0.005 ? { stored } : {}),
    source:
      (doubted
        ? `${company} reported ${reportedPct}%. We sent their pay application back, so this bills what we see: ${pct}%.`
        : done > 0
          ? `${company} reported ${pct}% done.`
          : `${company} has not reported any work yet.`) + (stored > 0.005 ? ` ${money(stored)} of materials are stored on site, not in place yet.` : ''),
    detail: ownLines.map((l) => (pctOf(l) < l.pctReported ? { label: l.label, pct: pctOf(l), theySay: l.pctReported } : { label: l.label, pct: l.pctReported })),
  }
}

/**
 * The next pay application to the owner, as a draft: what the bill would say if it went on the
 * next bill day with the work reported today. Each trade's line is the work its company reported.
 * General conditions, contingency and fee follow the share of the trades' work done, so the bill
 * comes to the same total whether the owner sees them as lines or spread into the trades. A line
 * starts from what the last pay application said and never goes below it.
 */
export function ownerPayApp(state: GcState, project: GcProject): OwnerPayApp {
  const customer = customerOf(state, project)
  const signed = ownerContractWorthOf(project)
  const sent = ownerPayAppsSent(project)
  const last = sent[sent.length - 1]
  const trades = project.packages.map((pkg) => tradeLine(state, pkg, signed[pkg.id] ?? 0))
  const tradeWorth = trades.reduce((s, l) => s + l.worth, 0)
  const tradeDone = trades.reduce((s, l) => s + l.doneToDate, 0)
  const tradeShare = tradeWorth === 0 ? 0 : tradeDone / tradeWorth
  const sharePct = Math.round(tradeShare * 100)
  const follows = (id: string, label: string, kind: OwnerLineKind, worth: number): OwnerLine => ({
    id,
    label,
    kind,
    worth,
    doneToDate: worth * tradeShare,
    doneBefore: 0,
    thisMonth: worth * tradeShare,
    source: `Follows the trades, which are ${sharePct}% done.`,
    detail: [],
  })
  const lines: OwnerLine[] = [
    ...trades,
    follows('gc', 'General conditions', 'generalConditions', signed.gc ?? 0),
    follows('contingency', `Contingency ${project.contingencyPct}%`, 'contingency', signed.contingency ?? 0),
    follows('fee', `Fee ${project.feePct}%`, 'fee', signed.fee ?? 0),
    // A time extension (G-141) has no price and no work: no line.
    ...signedChangeOrders(project)
      .filter((co) => !co.daysOnChart)
      .map((co) => changeOrderLine(state, project, co)),
  ].map((l) => {
    const doneBefore = last?.doneToDate[l.id] ?? 0
    const doneToDate = Math.max(l.doneToDate, doneBefore)
    return { ...l, doneBefore, doneToDate, thisMonth: doneToDate - doneBefore }
  })
  const contract = lines.reduce((s, l) => s + l.worth, 0)
  const changeOrdersTotal = lines.filter((l) => l.kind === 'changeOrder').reduce((s, l) => s + l.worth, 0)
  const doneToDate = lines.reduce((s, l) => s + l.doneToDate, 0)
  const stored = lines.reduce((s, l) => s + (l.stored ?? 0), 0)
  const storedBefore = Object.values(last?.storedByLine ?? {}).reduce((s, n) => s + n, 0)
  const retainagePct = customer?.retainagePct ?? OWNER_RETAINAGE_DEFAULT_PCT
  const retainageStep = project.ownerRetainageStep
  // The owner holds back on the work and on what is stored, as the 702's line 5 has it.
  const retainage = ownerRetainageOn(retainagePct, retainageStep, doneToDate + stored, contract)
  // Earlier certificates, not what we asked: what the architect cut comes back on this bill.
  const askedBefore = sent.reduce((s, a) => s + appClaimed(a), 0)
  const billOn = last ? nextOwnerBillDay(addDays(last.periodTo, 1)) : nextOwnerBillDay(state.today)
  // Their usual days, or the contract's while they have never paid us (O5d's rule, O6b-1's forecast).
  const payDays = customer?.payDays ?? project.ownerPayDays ?? null
  return {
    number: sent.length + 1,
    billOn,
    expectPaidOn: payDays == null ? null : addDays(billOn, payDays),
    lines,
    contract,
    originalContract: contract - changeOrdersTotal,
    changeOrdersTotal,
    doneToDate,
    stored,
    storedBefore,
    tradeShare,
    retainagePct,
    ...(retainageStep ? { retainageStep } : {}),
    retainage,
    retainageBefore: last?.retainage ?? 0,
    askedBefore,
    due: doneToDate + stored - retainage - askedBefore,
    leftToBill: contract - doneToDate - stored + retainage,
    started: project.startedOn !== null,
  }
}

/** One trade's waivers against the work of theirs we billed the owner. */
export interface TradeWaiverCheck {
  packageId: string
  trade: string
  company: string
  /** Their work on our bills so far. */
  billed: number
  /** Their work their unconditional waivers cover: draws we paid and they waived. */
  unconditional: number
  /** Their work only a conditional waiver covers so far: draws asked for, not yet waived for good. */
  conditional: number
  /** Their work on our bills with no waiver from them yet. */
  missing: number
  /** Draws we paid whose unconditional waiver they still owe: only the conditional one is in. */
  owedUnconditional: { draw: number; amount: number; final: boolean }[]
  /** Each draw's waiver, oldest first: the papers the owner gets. */
  waivers: { draw: number; kind: 'conditional' | 'unconditional'; amount: number; final: boolean }[]
}

/**
 * The trades' waivers behind our bills: for each trade with work on them, how much of that work
 * their waivers cover. A draw's waiver covers the work it asked for; the amount it names is what
 * they are paid. `billedByLine` is done so far by owner line: the draft's, or a sent bill's.
 */
export function tradeWaiverChecks(state: GcState, project: GcProject, billedByLine: Record<string, number>): TradeWaiverCheck[] {
  const out: TradeWaiverCheck[] = []
  for (const pkg of project.packages) {
    const billed = billedByLine[pkg.id] ?? 0
    const sow = pkg.sow
    const invite = pkg.invites.find((i) => i.id === pkg.awardedInviteId)
    const partner = invite ? partnerById(state, invite.partnerId) : undefined
    if (pkg.selfPerform || billed <= 0 || !sow || !partner) continue
    const draws = sow.draws
    const covered = draws.reduce((s, d) => s + d.gross, 0)
    const unconditional = draws.filter((d) => d.waiver === 'unconditional').reduce((s, d) => s + d.gross, 0)
    out.push({
      packageId: pkg.id,
      trade: pkg.trade,
      company: partner.company,
      billed,
      unconditional: Math.min(billed, unconditional),
      conditional: Math.max(0, Math.min(billed, covered) - unconditional),
      missing: Math.max(0, billed - covered),
      owedUnconditional: draws
        .filter((d) => d.status === 'paid' && d.waiver === 'conditional')
        .map((d) => ({ draw: d.number, amount: d.net, final: d.final === true })),
      waivers: draws.map((d) => ({ draw: d.number, kind: d.waiver, amount: d.net, final: d.final === true })),
    })
  }
  return out
}

/** The trades on a bill whose waivers do not cover their work on it yet. */
export function missingTradeWaivers(checks: TradeWaiverCheck[]): TradeWaiverCheck[] {
  return checks.filter((c) => Math.round(c.missing) > 0)
}

/** The trades we paid that still owe an unconditional waiver on a draw. */
export function tradesOwingUnconditional(checks: TradeWaiverCheck[]): TradeWaiverCheck[] {
  return checks.filter((c) => c.owedUnconditional.length > 0)
}

/** "draw 1", "draws 1 and 2", "the final draw": the draws a trade still owes an unconditional waiver on. */
export function owedDrawWords(owed: TradeWaiverCheck['owedUnconditional']): string {
  const progress = owed.filter((o) => !o.final).map((o) => String(o.draw))
  const parts: string[] = []
  if (progress.length === 1) parts.push(`draw ${progress[0]}`)
  else if (progress.length > 1) parts.push(`draws ${progress.slice(0, -1).join(', ')} and ${progress[progress.length - 1]}`)
  if (owed.some((o) => o.final)) parts.push('the final draw')
  return parts.join(' and ')
}

/** One line of a sent pay application as the owner reads it: the same columns as the draft. */
export interface SentPayAppLine {
  id: string
  label: string
  worth: number
  doneBefore: number
  thisMonth: number
  doneToDate: number
  /** Materials stored on site on the line when it went. */
  stored?: number
}

/**
 * A sent pay application's lines, every one (owner's call: the owner sees each line). Done so far
 * is what it said when it went; done before is what the one before it said. Labels and worth are
 * today's lines.
 */
export function sentPayAppLines(state: GcState, project: GcProject, number: number): SentPayAppLine[] {
  const sent = ownerPayAppsSent(project)
  const app = sent.find((a) => a.number === number)
  const before = sent.find((a) => a.number === number - 1)
  if (!app) return []
  // Only the lines the bill had when it went: a change order signed later is not on it.
  return ownerPayApp(state, project)
    .lines.filter((l) => l.id in app.doneToDate)
    .map((l) => {
      const doneToDate = app.doneToDate[l.id] ?? 0
      const doneBefore = before?.doneToDate[l.id] ?? 0
      const stored = app.storedByLine?.[l.id] ?? 0
      return { id: l.id, label: l.label, worth: app.worthByLine?.[l.id] ?? l.worth, doneBefore, thisMonth: doneToDate - doneBefore, doneToDate, ...(stored > 0 ? { stored } : {}) }
    })
}

/** Every line billed: our last progress pay application billed the whole price, and nothing new waits. */
export function ownerAllBilled(state: GcState, project: GcProject): boolean {
  const app = ownerPayApp(state, project)
  const lastProgress = [...ownerPayAppsSent(project)].reverse().find((a) => !a.final)
  return lastProgress !== undefined && Math.round(app.contract - lastProgress.workToDate) <= 0 && !ownerPayAppHasWork(app)
}

export type OwnerCloseoutKey = 'billed' | 'trades' | 'accepted' | 'finalApp' | 'certified' | 'paid'

export interface OwnerCloseoutStep {
  key: OwnerCloseoutKey
  label: string
  /** Who moves it: our office, the trades from their portals, the architect, or the owner from theirs. */
  who: 'office' | 'trades' | 'architect' | 'owner'
  done: boolean
  detail: string
}

export interface OwnerCloseout {
  steps: OwnerCloseoutStep[]
  /** The first step not done. Null once the owner has paid us everything. */
  next: OwnerCloseoutStep | null
  closed: boolean
  /** What the owner holds on us right now. */
  held: number
  /** Our final pay application, once it went. */
  final: OwnerPayAppSent | null
  /** The trades that have not sent their final pay application yet, each with what still stands in the way. */
  tradesWaiting: { packageId: string; company: string; why: string }[]
  /** May the owner accept the work now? */
  canAccept: boolean
  /** May our final pay application go now? */
  canSendFinal: boolean
}

/**
 * Our closeout with the owner, in order: every line billed, every trade's final pay application
 * (with its conditional waiver on final payment), the owner accepts the work, our final pay
 * application for what they hold (with our conditional waiver on final payment), and they pay it
 * (which signs our unconditional waiver on final payment).
 */
export function ownerCloseout(state: GcState, project: GcProject): OwnerCloseout {
  const sent = ownerPayAppsSent(project)
  const final = sent.find((a) => a.final) ?? null
  const lastProgress = [...sent].reverse().find((a) => !a.final) ?? null
  const contract = ownerPayApp(state, project).contract
  const billed = ownerAllBilled(state, project)
  const held = final ? (final.paidOn ? 0 : final.due) : (lastProgress?.retainage ?? 0)
  const tradesWaiting: OwnerCloseout['tradesWaiting'] = []
  let trades = 0
  for (const pkg of project.packages) {
    if (pkg.selfPerform) continue
    trades += 1
    const invite = pkg.invites.find((i) => i.id === pkg.awardedInviteId)
    const company = (invite ? partnerById(state, invite.partnerId)?.company : undefined) ?? pkg.trade
    if (!pkg.sow || pkg.sow.status !== 'signed') {
      tradesWaiting.push({ packageId: pkg.id, company, why: `${pkg.trade} has no signed statement of work.` })
      continue
    }
    const c = tradeCloseout(pkg.sow)
    if (c.finalDraw) continue
    const why: Record<string, string> = {
      billed: `${company} has not billed every line yet.`,
      accepted: `We have not accepted ${company}’s work yet.`,
      warranty: `${company} still owes its warranty letter.`,
      finalApp: `${company} has not sent it yet.`,
    }
    tradesWaiting.push({ packageId: pkg.id, company, why: why[c.next?.key ?? 'finalApp'] ?? why.finalApp ?? '' })
  }
  const tradesDone = tradesWaiting.length === 0
  const acceptedOn = project.ownerBilling?.acceptedOn ?? null
  const billedPct = contract === 0 || !lastProgress ? 0 : Math.round((lastProgress.workToDate / contract) * 100)
  const steps: OwnerCloseoutStep[] = [
    {
      key: 'billed',
      label: 'Every line billed',
      who: 'office',
      done: billed,
      detail: billed && lastProgress
        ? `Pay application ${lastProgress.number} billed all ${money(contract)}.`
        : `${billedPct}% billed so far.`,
    },
    {
      key: 'trades',
      label: 'Every trade’s final pay application',
      who: 'trades',
      done: tradesDone,
      detail: tradesDone
        ? 'Every trade has asked for its retainage, with its conditional waiver on final payment.'
        : `${trades - tradesWaiting.length} of ${trades} trades have sent theirs. ${tradesWaiting.map((w) => w.why).join(' ')}`,
    },
    {
      key: 'accepted',
      label: 'The customer accepts the work',
      who: 'owner',
      done: acceptedOn !== null,
      detail: acceptedOn ? `Accepted ${shortDate(acceptedOn)}.` : 'They walk the job and accept it.',
    },
    {
      key: 'finalApp',
      label: 'Our final pay application',
      who: 'office',
      done: final !== null,
      detail: final
        ? `Sent ${shortDate(final.sentOn)} for ${money(final.due)}, with our conditional waiver on final payment.`
        : `It asks for the ${money(held)} they hold.`,
    },
    {
      key: 'certified',
      label: 'The architect certifies it',
      who: 'architect',
      done: final !== null && appCertified(final) !== null,
      detail:
        final && appCertified(final) !== null
          ? `${project.architect} certified ${money(appCertified(final) ?? 0)}${final.certifiedOn ? ` ${shortDate(final.certifiedOn)}` : ''}.`
          : final
            ? `Waiting on ${project.architect}.`
            : 'Waits for our final pay application.',
    },
    {
      key: 'paid',
      label: 'The customer pays it',
      who: 'owner',
      done: final?.paidOn != null,
      detail: final?.paidOn
        ? `Paid ${shortDate(final.paidOn)}. Our unconditional waiver on final payment is signed.`
        : final && appCertified(final) !== null
          ? 'Waiting on them.'
          : 'Waits for the architect’s certificate.',
    },
  ]
  const next = steps.find((st) => !st.done) ?? null
  return {
    steps,
    next,
    closed: next === null,
    held,
    final,
    tradesWaiting,
    canAccept: billed && acceptedOn === null,
    canSendFinal: billed && tradesDone && acceptedOn !== null && final === null && held > 0,
  }
}

/** Our final pay application as it goes today: every line done, nothing held, it asks for the rest. */
export function ownerFinalPayAppToSend(state: GcState, project: GcProject, today: string): OwnerPayAppSent {
  const app = ownerPayApp(state, project)
  return { ...ownerPayAppToSend(app, today), periodTo: today, retainage: 0, due: app.doneToDate - app.askedBefore, final: true }
}

/**
 * How far a change order's work is, for the owner's bill: the trade's report on its line once the
 * trade has signed the change (owner's call, 2026-10-03), the percent set on Bill the owner before
 * that, and for our own work.
 */
export function changeOrderPct(project: GcProject, co: ChangeOrder): { pct: number; fromTrade: boolean } {
  const trade = changeOrderTradePct(project, co)
  return trade === null ? { pct: co.pctDone, fromTrade: false } : { pct: trade, fromTrade: true }
}

function changeOrderLine(state: GcState, project: GcProject, co: ChangeOrder): OwnerLine {
  const { pct, fromTrade } = changeOrderPct(project, co)
  const done = (co.price * pct) / 100
  const who = changeOrderWho(state, project, co).replace(/ on .*$/, '')
  return {
    id: co.id,
    label: `Change order ${co.number}`,
    kind: 'changeOrder',
    worth: co.price,
    doneToDate: done,
    doneBefore: 0,
    thisMonth: done,
    source: `${co.description.trim().replace(/[.\s]+$/, '')}.${co.answeredOn ? ` Signed ${shortDate(co.answeredOn)}.` : ''}${fromTrade ? ` ${who.charAt(0).toUpperCase()}${who.slice(1)} reported ${pct}% done.` : ''}`,
    detail: [],
    changeOrderId: co.id,
  }
}

export interface OwnerPayAppForm {
  app: PayApplication
  /** The bill day it is for. */
  periodTo: string
  /** The day it went. Null on the draft. */
  sentOn: string | null
  /** The day the owner contract was signed. */
  contractDate: string | null
  /** The signed change orders on it: line 2 is their sum. */
  changeOrders: { number: number; description: string; price: number }[]
  /** The architect's certificate: the amount, the day, why less. Null amount: not certified yet. */
  certificate: { amount: number | null; on: string | null; note: string }
  /** Line 5's words when the retainage drops partway ("10% until the work is half done, then 5% on the rest"). Null: a plain percent. */
  retainageWords: string | null
}

/**
 * Who and what our pay application is for, beside its numbers: the owner, us, the architect, the
 * dates, and the change orders on it with whether each was signed since the last bill. For the
 * Excel and PDF (`gcPayAppFile.ts`, question 12).
 */
export function ownerPayAppParties(state: GcState, project: GcProject, form: OwnerPayAppForm): PayAppParties {
  const customer = customerOf(state, project)
  const before = ownerPayAppsSent(project)
    .filter((a) => a.number < form.app.number)
    .reduce((last, a) => (a.periodTo > last ? a.periodTo : last), '')
  const thisPeriod = (on: string | null) => on !== null && on > before && on <= form.periodTo
  const signed = new Map(signedChangeOrders(project).map((co) => [co.number, co]))
  return {
    project: project.name,
    applicationNo: form.app.final ? `${form.app.number}, final` : String(form.app.number),
    periodTo: form.periodTo,
    sentOn: form.sentOn,
    contractDate: form.contractDate,
    to: { name: project.owner, address: customer?.address ?? '' },
    propertyOwner: project.propertyOwner ?? null,
    from: { name: GC_COMPANY.name, address: GC_COMPANY.address },
    architect: project.architect || null,
    changeOrders: form.changeOrders.map((c) => ({ amount: c.price, thisPeriod: thisPeriod(signed.get(c.number)?.answeredOn ?? null) })),
    retainageWords: form.retainageWords,
  }
}

/** Our pay application number `which` as the form, or the next one as a draft. Null: no such bill. */
export function ownerPayAppForm(state: GcState, project: GcProject, which: number | 'draft'): OwnerPayAppForm | null {
  const sent = ownerPayAppsSent(project)
  const draft = ownerPayApp(state, project)
  const record = which === 'draft' ? null : (sent.find((a) => a.number === which) ?? null)
  if (which !== 'draft' && !record) return null
  const final = record?.final === true
  const retainagePct = record ? record.retainagePct : draft.retainagePct
  const step = record ? record.retainageStep : draft.retainageStep
  const rows = spreadMarkup(record ? sentPayAppLines(state, project, record.number) : draft.lines)
  // With a step, each line holds its share of what the owner holds on the whole.
  const work = rows.reduce((s, l) => s + l.doneToDate + (l.stored ?? 0), 0)
  const rate = step && work > 0 ? (record ? record.retainage : draft.retainage) / work : retainagePct / 100
  const lines: PayAppLine[] = rows.map((l, i) => ({
    item: i + 1,
    sovId: l.id,
    label: l.label,
    scheduled: l.worth,
    fromPrevious: l.doneBefore,
    thisPeriod: l.thisMonth,
    stored: l.stored ?? 0,
    toDate: l.doneToDate + (l.stored ?? 0),
    pct: l.worth === 0 ? 0 : Math.round(((l.doneToDate + (l.stored ?? 0)) / l.worth) * 100),
    // A line done in full can land a hair under zero from the spread's arithmetic: it reads $0.
    balance: Math.abs(l.worth - l.doneToDate - (l.stored ?? 0)) < 0.005 ? 0 : l.worth - l.doneToDate - (l.stored ?? 0),
    retainage: final ? 0 : step ? (l.doneToDate + (l.stored ?? 0)) * rate : ((l.doneToDate + (l.stored ?? 0)) * retainagePct) / 100,
  }))
  const sum = (key: 'scheduled' | 'fromPrevious' | 'thisPeriod' | 'stored' | 'toDate' | 'balance' | 'retainage') => lines.reduce((s, l) => s + l[key], 0)
  const scheduled = sum('scheduled')
  const toDate = sum('toDate')
  const changeOrders = lines.filter((l) => isChangeOrderLineId(l.sovId)).reduce((s, l) => s + l.scheduled, 0)
  const retainage = record ? record.retainage : draft.retainage
  const earned = toDate - retainage
  const previous = record ? sent.filter((a) => a.number < record.number).reduce((s, a) => s + appClaimed(a), 0) : draft.askedBefore
  const signed = new Map(signedChangeOrders(project).map((co) => [co.id, co]))
  return {
    app: {
      number: record?.number ?? draft.number,
      final,
      lines,
      totals: {
        scheduled,
        fromPrevious: sum('fromPrevious'),
        thisPeriod: sum('thisPeriod'),
        stored: sum('stored'),
        toDate,
        pct: scheduled === 0 ? 0 : Math.round((toDate / scheduled) * 100),
        balance: sum('balance'),
        retainage: sum('retainage'),
      },
      summary: {
        originalSum: scheduled - changeOrders,
        changeOrders,
        sumToDate: scheduled,
        completedToDate: toDate,
        retainagePct,
        retainage,
        earnedLessRetainage: earned,
        previousCertificates: previous,
        currentDue: record ? record.due : draft.due,
        balanceToFinish: scheduled - earned,
      },
    },
    periodTo: record?.periodTo ?? draft.billOn,
    sentOn: record?.sentOn ?? null,
    contractDate: project.ownerContractSignedOn,
    certificate: {
      amount: record ? appCertified(record) : null,
      on: record?.certifiedOn ?? null,
      note: record?.certifiedNote ?? '',
    },
    retainageWords: step ? ownerRetainageWords(retainagePct, step) : null,
    changeOrders: lines
      .filter((l) => isChangeOrderLineId(l.sovId))
      .flatMap((l) => {
        const co = signed.get(l.sovId)
        return co ? [{ number: co.number, description: co.description, price: co.price }] : []
      }),
  }
}

export interface TradeCash {
  packageId: string
  trade: string
  company: string
  /** What we paid them, retainage released included. */
  paid: number
  /** Draws we approved and have not paid yet. */
  approved: number
  /** Draws they asked for that wait on us. */
  asked: number
  /** What we hold of theirs until the end. */
  held: number
}

export interface ProjectCash {
  /** From the owner. owed counts what waits on the architect, also shown on its own. */
  in: { paid: number; owed: number; held: number; waitingOnArchitect: number }
  /** To the trades, added up. */
  out: { paid: number; approved: number; asked: number; held: number }
  byTrade: TradeCash[]
  /** Paid in less paid out. Below zero: we are carrying the job. */
  net: number
  /** The trades our own crew does: paid through payroll, so not counted here. */
  ownCrew: string[]
}

export function projectCash(state: GcState, project: GcProject): ProjectCash {
  const account = ownerAccount(project)
  const made = project.ownerBilling
  const interestPaid = (made?.interestBills ?? []).filter((b) => b.paidOn !== null).reduce((t, b) => t + b.amount, 0)
  const owner = account
    ? { paid: account.paid + interestPaid, owed: account.owed, held: account.retainageHeld, waitingOnArchitect: account.waitingOnArchitect }
    : made
      ? { paid: made.paid, owed: made.billed - made.retainageHeld - made.paid, held: made.retainageHeld, waitingOnArchitect: 0 }
      : { paid: 0, owed: 0, held: 0, waitingOnArchitect: 0 }
  const byTrade: TradeCash[] = []
  for (const pkg of project.packages) {
    const sow = pkg.sow
    if (pkg.selfPerform || !sow || sow.status !== 'signed') continue
    const invite = pkg.invites.find((i) => i.id === pkg.awardedInviteId)
    const company = (invite ? partnerById(state, invite.partnerId)?.company : undefined) ?? pkg.trade
    const net = (status: 'requested' | 'approved' | 'paid') => sow.draws.filter((d) => d.status === status).reduce((t, d) => t + d.net, 0)
    byTrade.push({ packageId: pkg.id, trade: pkg.trade, company, paid: net('paid'), approved: net('approved'), asked: net('requested'), held: retainageHeldNow(sow) })
  }
  const total = (key: 'paid' | 'approved' | 'asked' | 'held') => byTrade.reduce((t, r) => t + r[key], 0)
  const out = { paid: total('paid'), approved: total('approved'), asked: total('asked'), held: total('held') }
  return {
    in: owner,
    out,
    byTrade,
    net: owner.paid - out.paid,
    ownCrew: project.packages.filter((p) => p.selfPerform).map((p) => p.trade),
  }
}

export interface JobMoney {
  project: GcProject
  cash: ProjectCash
  /** The trades' draws that wait on us: approved and not paid, or asked for. */
  tradesWaiting: number
}

/** One bill with money open on it, for the who-owes-us list. */
export interface OwedBill {
  project: GcProject
  app: OwnerPayAppSent
  open: number
  due: OwnerPayDue
  /** Sent, and the architect has not certified it yet. */
  waitingOnArchitect: boolean
}

export interface AllJobsMoney {
  jobs: JobMoney[]
  totals: { paidIn: number; paidOut: number; net: number; owed: number; ownerHolds: number; weHold: number; tradesWaiting: number }
  /** Late first (most days late), then waiting on the architect, then the rest, biggest first. */
  owed: OwedBill[]
}

export function allJobsMoney(state: GcState): AllJobsMoney {
  const ours = state.projects.filter((p) => p.stage === 'buyout' || p.stage === 'building')
  const jobs: JobMoney[] = ours.map((project) => {
    const cash = projectCash(state, project)
    return { project, cash, tradesWaiting: cash.out.approved + cash.out.asked }
  })
  const owed: OwedBill[] = ours.flatMap((project) =>
    ownerPayAppsSent(project)
      .filter((app) => app.paidOn === null && appOpen(app) > 0.005)
      .map((app) => ({ project, app, open: appOpen(app), due: ownerPayDue(state, project, app), waitingOnArchitect: appCertified(app) === null })),
  )
  const rank = (b: OwedBill) => (b.due.daysLate > 0 ? 0 : b.waitingOnArchitect ? 2 : 1)
  owed.sort((a, b) => rank(a) - rank(b) || b.due.daysLate - a.due.daysLate || b.open - a.open)
  const sum = (f: (j: JobMoney) => number) => jobs.reduce((t, j) => t + f(j), 0)
  const paidIn = sum((j) => j.cash.in.paid)
  const paidOut = sum((j) => j.cash.out.paid)
  return {
    jobs,
    totals: {
      paidIn,
      paidOut,
      net: paidIn - paidOut,
      owed: sum((j) => j.cash.in.owed),
      ownerHolds: sum((j) => j.cash.in.held),
      weHold: sum((j) => j.cash.out.held),
      tradesWaiting: sum((j) => j.tradesWaiting),
    },
    owed,
  }
}
