/**
 * GC mode — design spike. Billing the owner: the lines we bill the owner against, the work done on
 * each, and this month's pay application. It reads the work the trades report (the Building
 * lane's) and never writes it.
 *
 * The math is the AIA pay application's (G702 on top, G703 the lines), said in plain words: work
 * done so far, less what the owner holds, less what we billed before, is this bill.
 */
import type { GcCustomer, GcProject, GcState, OwnerPayAppSent, TradePackage } from './gcTypes'
import { carriedAmount, proposalTotals } from './gcBids'
import { partnerById } from './gcLookups'

/** We bill the owner once a month (the owner's call, 2026-10-02). The day of the month is my default. */
export const OWNER_BILL_DAY = 25

/** What the owner holds back from each bill when their customer record does not say. */
export const OWNER_RETAINAGE_DEFAULT_PCT = 10

export type OwnerLineKind = 'trade' | 'self' | 'generalConditions' | 'contingency' | 'fee'

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
  detail: { label: string; pct: number }[]
  /** Our own crew's percent done, on a trade we do ourselves. The office reports it here. */
  crewPct?: number
}

export interface OwnerPayApp {
  number: number
  /** The day it goes to the owner: the next bill day after the last one, or on or after today. */
  billOn: string
  /** The bill day plus the owner's usual days to pay. Null when they have never paid us. */
  expectPaidOn: string | null
  lines: OwnerLine[]
  /** Our price to the owner: every line's worth. */
  contract: number
  doneToDate: number
  /** 0 to 1: the share of the trades' work done. Our own costs and fee follow it. */
  tradeShare: number
  retainagePct: number
  /** What the owner holds back on the work done so far. */
  retainage: number
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

function tradeLine(state: GcState, pkg: TradePackage): OwnerLine {
  const worth = carriedAmount(pkg) ?? 0
  const base = { id: pkg.id, label: pkg.trade, worth, doneBefore: 0, detail: [] as OwnerLine['detail'] }
  if (pkg.selfPerform) {
    const pct = pkg.selfPerform.pctDone ?? 0
    const done = (worth * pct) / 100
    return {
      ...base,
      kind: 'self',
      doneToDate: done,
      thisMonth: done,
      crewPct: pct,
      source: pct > 0 ? `Our own crew reported ${pct}% done.` : 'Our own crew has not reported any work yet.',
    }
  }
  const invite = pkg.invites.find((i) => i.id === pkg.awardedInviteId)
  const company = invite ? (partnerById(state, invite.partnerId)?.company ?? 'The company') : null
  const sow = pkg.sow
  if (!company) return { ...base, kind: 'trade', doneToDate: 0, thisMonth: 0, source: 'Not awarded yet.' }
  if (!sow || sow.status !== 'signed') {
    return { ...base, kind: 'trade', doneToDate: 0, thisMonth: 0, source: `${company}. Their statement of work is not signed yet.` }
  }
  const done = sow.sov.reduce((s, l) => s + (l.amount * l.pctReported) / 100, 0)
  const pct = sow.price === 0 ? 0 : Math.round((done / sow.price) * 100)
  return {
    ...base,
    kind: 'trade',
    doneToDate: done,
    thisMonth: done,
    source: done > 0 ? `${company} reported ${pct}% done.` : `${company} has not reported any work yet.`,
    detail: sow.sov.map((l) => ({ label: l.label, pct: l.pctReported })),
  }
}

/** The pay applications we sent the owner on this project, oldest first. */
export function ownerPayAppsSent(project: GcProject): OwnerPayAppSent[] {
  return project.ownerBilling?.payApps ?? []
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
  const totals = proposalTotals(project)
  const sent = ownerPayAppsSent(project)
  const last = sent[sent.length - 1]
  const trades = project.packages.map((pkg) => tradeLine(state, pkg))
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
    follows('gc', 'General conditions', 'generalConditions', totals.generalConditions),
    follows('contingency', `Contingency ${project.contingencyPct}%`, 'contingency', totals.contingency),
    follows('fee', `Fee ${project.feePct}%`, 'fee', totals.fee),
  ].map((l) => {
    const doneBefore = last?.doneToDate[l.id] ?? 0
    const doneToDate = Math.max(l.doneToDate, doneBefore)
    return { ...l, doneBefore, doneToDate, thisMonth: doneToDate - doneBefore }
  })
  const contract = lines.reduce((s, l) => s + l.worth, 0)
  const doneToDate = lines.reduce((s, l) => s + l.doneToDate, 0)
  const retainagePct = customer?.retainagePct ?? OWNER_RETAINAGE_DEFAULT_PCT
  const retainage = (doneToDate * retainagePct) / 100
  const askedBefore = sent.reduce((s, a) => s + a.due, 0)
  const billOn = last ? nextOwnerBillDay(addDays(last.periodTo, 1)) : nextOwnerBillDay(state.today)
  return {
    number: sent.length + 1,
    billOn,
    expectPaidOn: customer?.payDays == null ? null : addDays(billOn, customer.payDays),
    lines,
    contract,
    doneToDate,
    tradeShare,
    retainagePct,
    retainage,
    askedBefore,
    due: doneToDate - retainage - askedBefore,
    leftToBill: contract - doneToDate + retainage,
    started: project.startedOn !== null,
  }
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
    workToDate: app.doneToDate,
    retainagePct: app.retainagePct,
    retainage: app.retainage,
    due: app.due,
    paidOn: null,
  }
}

/** Where we stand with the owner on one project, from the pay applications we sent. */
export interface OwnerAccount {
  /** The work billed so far: the last pay application's done so far. */
  billed: number
  /** What the owner holds on it until the end. */
  retainageHeld: number
  /** What our pay applications asked them to pay, added up. */
  asked: number
  paid: number
  /** Asked less paid. */
  owed: number
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
  const asked = sent.reduce((s, a) => s + a.due, 0)
  const paid = sent.filter((a) => a.paidOn !== null).reduce((s, a) => s + a.due, 0)
  return { billed: last.workToDate, retainageHeld: last.retainage, asked, paid, owed: asked - paid }
}

/** The day we expect the owner to pay a pay application: the day it went plus their usual days. */
export function ownerExpectPaidOn(state: GcState, project: GcProject, app: OwnerPayAppSent): string | null {
  const payDays = customerOf(state, project)?.payDays
  return payDays == null ? null : addDays(app.sentOn, payDays)
}

// ---------------------------------------------------------------------------------------------
// Lien waivers to the owner (owner's calls, 2026-10-02): ours and the trades' go with each pay
// application; ours is signed unconditional when we mark the bill paid; a trade's missing waiver
// is a warning, never a stop.
// ---------------------------------------------------------------------------------------------

/** One of our own waivers to the owner, on one pay application. */
export interface OurOwnerWaiver {
  payApp: number
  kind: 'conditional' | 'unconditional'
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
    out.push({ payApp: app.number, kind: 'conditional', amount: app.due, signedOn: app.sentOn })
    if (app.paidOn !== null) out.push({ payApp: app.number, kind: 'unconditional', amount: app.due, signedOn: app.paidOn })
  }
  return out.reverse()
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
      waivers: draws.map((d) => ({ draw: d.number, kind: d.waiver, amount: d.net, final: d.final === true })),
    })
  }
  return out
}

/** The trades on a bill whose waivers do not cover their work on it yet. */
export function missingTradeWaivers(checks: TradeWaiverCheck[]): TradeWaiverCheck[] {
  return checks.filter((c) => Math.round(c.missing) > 0)
}

/** One line of a sent pay application as the owner reads it: the same columns as the draft. */
export interface SentPayAppLine {
  id: string
  label: string
  worth: number
  doneBefore: number
  thisMonth: number
  doneToDate: number
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
  return ownerPayApp(state, project).lines.map((l) => {
    const doneToDate = app.doneToDate[l.id] ?? 0
    const doneBefore = before?.doneToDate[l.id] ?? 0
    return { id: l.id, label: l.label, worth: l.worth, doneBefore, thisMonth: doneToDate - doneBefore, doneToDate }
  })
}
