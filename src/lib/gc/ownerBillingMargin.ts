/**
 * GC mode, the real build, Owner Billing's O2b: what each job makes us, moved word for word from the GC mode
 * prototype (branch spike/gc-mode, `gcOwnerBillingMargin.ts`). Since O11b, general conditions count at their Pipeline
 * job's real spend when our number names one (`ownWorkCost.ts`).
 */
import { carriedAmount } from './bids'
import { generalConditionsCost, type GeneralConditionsCost, type OwnWorkCosts } from './ownWorkCost'
import { partnerById } from './lookups'
import { ownerContractWorthOf, ownerPayAppsSent, signedChangeOrders } from './ownerBilling'
import type { GcProject, GcState } from './types'

export interface TradeBuyout {
  packageId: string
  trade: string
  company: string | null
  /** What the customer signed for this trade. */
  signed: number
  /** What it costs us: the signed statement of work, else what we carry. */
  cost: number
  /** True when its statement of work is signed. */
  boughtOut: boolean
  /** Our own crew: at its price, its cost is on the Pipeline. */
  ownCrew: boolean
  /** Signed less cost: what buying it out saved (below zero: what it cost us over). */
  saved: number
}

export interface JobMargin {
  project: GcProject
  /** The price the customer signed for, with signed change orders. */
  price: number
  trades: TradeBuyout[]
  /** What buying out saved, added up. Below zero: over. */
  buyout: number
  changeOrders: { count: number; price: number; cost: number; margin: number }
  fee: number
  generalConditions: number
  /** General conditions' cost: their budget, or their Pipeline job's spend (O11b). */
  generalConditionsCost: GeneralConditionsCost
  /** Our own work's over (below zero) or under against its price and budget: today general conditions'. */
  ownWork: number
  /** Contingency in the price, not spent as far as the prototype knows. */
  contingency: number
  /** Fee, buyout, change orders' margin and our own work: what the job makes us, before contingency. */
  margin: number
  /** Margin over price, as a percent. */
  marginPct: number
  /** The share of the price billed so far, 0 to 1: what the last pay application says is done. */
  billedShare: number
  /**
   * The margin earned so far: the fee, buyout and change orders as billed, and our own work as real money where its
   * Pipeline job is read, what we billed for it less what it cost so far.
   */
  earned: number
}

/** What one job makes us. `own`: what the page read of our own work's Pipeline jobs; absent, at price and budget. */
export function jobMargin(state: GcState, project: GcProject, own?: OwnWorkCosts): JobMargin {
  const signed = ownerContractWorthOf(project)
  const trades: TradeBuyout[] = project.packages.map((pkg) => {
    const invite = pkg.invites.find((i) => i.id === pkg.awardedInviteId)
    const company = invite ? (partnerById(state, invite.partnerId)?.company ?? null) : null
    const signedFor = signed[pkg.id] ?? 0
    const boughtOut = pkg.sow?.status === 'signed'
    const ownCrew = Boolean(pkg.selfPerform)
    const cost = boughtOut && pkg.sow ? pkg.sow.price : ownCrew ? signedFor : (carriedAmount(pkg) ?? signedFor)
    return { packageId: pkg.id, trade: pkg.trade, company, signed: signedFor, cost, boughtOut, ownCrew, saved: signedFor - cost }
  })
  const cos = signedChangeOrders(project)
  const changeOrders = {
    count: cos.length,
    price: cos.reduce((t, c) => t + c.price, 0),
    cost: cos.reduce((t, c) => t + c.cost, 0),
    margin: cos.reduce((t, c) => t + (c.price - c.cost), 0),
  }
  const fee = signed.fee ?? 0
  const buyout = trades.reduce((t, x) => t + x.saved, 0)
  const price = Object.values(signed).reduce((t, n) => t + n, 0) + changeOrders.price
  const gc = generalConditionsCost({ ...project, generalConditions: signed.gc ?? 0 }, own)
  const ownWork = gc.budget - gc.counted
  const margin = fee + buyout + changeOrders.margin + ownWork
  const sent = ownerPayAppsSent(project)
  const last = sent[sent.length - 1]
  const billedShare = last && price > 0 ? Math.min(1, last.workToDate / price) : 0
  // Our own work, where its spend is read: what we billed for it so far less what it cost so far.
  const gcEarned = gc.spent !== null ? (last?.doneToDate.gc ?? 0) - gc.spent : 0
  return {
    project,
    price,
    trades,
    buyout,
    changeOrders,
    fee,
    generalConditions: signed.gc ?? 0,
    generalConditionsCost: gc,
    ownWork,
    contingency: signed.contingency ?? 0,
    margin,
    marginPct: price > 0 ? (margin / price) * 100 : 0,
    billedShare,
    earned: (fee + buyout + changeOrders.margin) * billedShare + gcEarned,
  }
}

/** Every job that is ours, and the sums across them. */
export function allJobsMargin(state: GcState, own?: OwnWorkCosts): { jobs: JobMargin[]; price: number; margin: number; earned: number; contingency: number; ownWork: number } {
  const jobs = state.projects.filter((p) => p.stage === 'buyout' || p.stage === 'building').map((p) => jobMargin(state, p, own))
  const sum = (f: (j: JobMargin) => number) => jobs.reduce((t, j) => t + f(j), 0)
  return { jobs, price: sum((j) => j.price), margin: sum((j) => j.margin), earned: sum((j) => j.earned), contingency: sum((j) => j.contingency), ownWork: sum((j) => j.ownWork) }
}
