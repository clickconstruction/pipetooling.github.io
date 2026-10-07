/**
 * GC mode, the real build: a project's change orders and their days, moved word for word from the GC
 * mode prototype (branch spike/gc-mode, `gcOwnerBilling.ts`) by the schedule's PR 1a, which reads them.
 * Owner Billing's O2a added what of billing the customer reads only main today: the price by line, a sent
 * bill's money, when it is due, our waivers, the spread of our costs and fee, a change order's words. O2b
 * adds `ownerPayApp` and the rest, which read the Building lane's kernels.
 */
import type { ChangeOrder, GcCustomer, GcProject, GcState, OwnerPayAppSent, OwnerRetainageStep } from './types'
import { carriedAmount, proposalTotals } from './bids'
import { partnerById } from './lookups'
import { daysUntil } from './words'

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
  /** The bill day plus the owner's usual days to pay. Null when they have never paid us. */
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

/** The day we expect the owner to pay a pay application: the day the architect certified it (or it went) plus their usual days. */
export function ownerExpectPaidOn(state: GcState, project: GcProject, app: OwnerPayAppSent): string | null {
  const payDays = customerOf(state, project)?.payDays
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
