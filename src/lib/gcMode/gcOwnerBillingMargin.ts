/**
 * GC mode — design spike: what each job makes us (owner's go-ahead 2026-10-05). The price the
 * customer signed for, line by line (`ownerContractWorthOf`), against what the work costs us: each
 * trade bought out at its signed statement of work (a trade not bought out yet at what we carry),
 * signed change orders at their cost, general conditions at their budget. What is left is ours:
 * the fee, what buying out saved, and the change orders' margin. Contingency not spent is shown
 * apart, since the prototype does not track what it was spent on. Our own crew counts at its
 * price; its real cost is on its Pipeline job.
 *
 * For the owner and the controller only, like the rest of the app's money. Import from `./gcModel`.
 */
import type { GcProject, GcState } from './gcTypes'
import { carriedAmount } from './gcBids'
import { partnerById } from './gcLookups'
import { ownerContractWorthOf, ownerPayAppsSent, signedChangeOrders } from './gcOwnerBilling'

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
  /** Contingency in the price, not spent as far as the prototype knows. */
  contingency: number
  /** Fee, buyout and change orders' margin: what the job makes us, before contingency. */
  margin: number
  /** Margin over price, as a percent. */
  marginPct: number
  /** The share of the price billed so far, 0 to 1: what the last pay application says is done. */
  billedShare: number
  /** The margin earned so far, as billed. */
  earned: number
}

/** What one job makes us. */
export function jobMargin(state: GcState, project: GcProject): JobMargin {
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
  const margin = fee + buyout + changeOrders.margin
  const sent = ownerPayAppsSent(project)
  const last = sent[sent.length - 1]
  const billedShare = last && price > 0 ? Math.min(1, last.workToDate / price) : 0
  return {
    project,
    price,
    trades,
    buyout,
    changeOrders,
    fee,
    generalConditions: signed.gc ?? 0,
    contingency: signed.contingency ?? 0,
    margin,
    marginPct: price > 0 ? (margin / price) * 100 : 0,
    billedShare,
    earned: margin * billedShare,
  }
}

/** Every job that is ours, and the sums across them. */
export function allJobsMargin(state: GcState): { jobs: JobMargin[]; price: number; margin: number; earned: number; contingency: number } {
  const jobs = state.projects.filter((p) => p.stage === 'buyout' || p.stage === 'building').map((p) => jobMargin(state, p))
  const sum = (f: (j: JobMargin) => number) => jobs.reduce((t, j) => t + f(j), 0)
  return { jobs, price: sum((j) => j.price), margin: sum((j) => j.margin), earned: sum((j) => j.earned), contingency: sum((j) => j.contingency) }
}
