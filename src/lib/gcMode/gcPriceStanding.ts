/**
 * GC mode — design spike: where a bidding job's price stands, trade by trade (the owner's pick B,
 * 2026-10-04, built by the Building lane on the Board's row). The board's "so far, with holes" line
 * and its red coverage chip open one card from this: each trade by what happens next, and what the
 * price comes to once every trade is in. It only reads: the Board lane's `proposalTotals` stays
 * the price, and its counts follow the chip's rule (a guess, a carried quote missing a cost, or one
 * that ran out is not a real number).
 *
 * Import from `./gcModel`.
 */
import type { GcProject, GcState, Invite, TradePackage } from './gcTypes'
import { bidsIn, carriedAmount, carriedUncosted, isGuess, leveledTotal, proposalTotals, quoteRanOut } from './gcBids'
import { partnerById } from './gcLookups'
import { money, weekdayDate } from './gcWords'

/**
 * What happens next on a trade, in the card's order. The first four are holes (no number, $0 in
 * the price): quotes in and none carried; asked and waiting; nobody asked; our own bid not priced.
 * Then a number that is not real yet: a carried quote missing a cost, one that ran out, our guess.
 */
export type TradeStanding = 'pick' | 'waiting' | 'notAsked' | 'ownBid' | 'gap' | 'ranOut' | 'guess' | 'real'

export const STANDING_ORDER: TradeStanding[] = ['pick', 'waiting', 'notAsked', 'ownBid', 'gap', 'ranOut', 'guess', 'real']

const HOLES = new Set<TradeStanding>(['pick', 'waiting', 'notAsked', 'ownBid'])

export function isHole(standing: TradeStanding): boolean {
  return HOLES.has(standing)
}

export interface TradeStandingRow {
  pkg: TradePackage
  standing: TradeStanding
  /** What it counts as in the price now. Null: a hole, counted as $0. */
  carried: number | null
  /** The company whose quote is carried. Null: none, or our own crew or budget. */
  company: string | null
  /** A hole's estimate: the lowest good quote in, else our own bid's figure, else our budget. Null: not a hole. */
  estimate: number | null
  /** The lowest good quote in, ready to carry. Null: none in, or none that has not run out. */
  lowest: { invite: Invite; company: string; total: number } | null
  /** What happens next, in a sentence or three. Empty for a real number. */
  words: string
}

export interface PriceStanding {
  /** Every trade, in `STANDING_ORDER`, then in the project's order. */
  rows: TradeStandingRow[]
  counts: Record<TradeStanding, number>
  holes: number
  /** The price as the board shows it (`proposalTotals`). */
  soFar: number
  /** The price with every hole at its estimate, with general conditions, contingency and fee. */
  likely: number
  /** What the price so far is made of. */
  trades: number
  generalConditions: number
  /** Contingency and fee together. */
  markups: number
  contingencyPct: number
  feePct: number
}

function companyOf(state: GcState, invite: Invite): string {
  return partnerById(state, invite.partnerId)?.company ?? 'A company'
}

/** "Bexar Steel Erectors has not opened it." · "Tejas Power opened it and has not quoted." · "Comal Iron said no." */
function askedWords(state: GcState, invites: Invite[]): string {
  return invites
    .map((i) =>
      i.status === 'declined'
        ? `${companyOf(state, i)} said no.`
        : i.status === 'opened'
          ? `${companyOf(state, i)} opened it and has not quoted.`
          : `${companyOf(state, i)} has not opened it.`,
    )
    .join(' ')
}

function rowOf(state: GcState, project: GcProject, pkg: TradePackage): TradeStandingRow {
  const today = state.today
  const amount = carriedAmount(pkg)
  const carriedInvite = pkg.invites.find((i) => i.id === (pkg.awardedInviteId ?? pkg.carried)) ?? null
  const good = bidsIn(pkg)
    .filter((i) => !(i.bid && quoteRanOut(i.bid, today)))
    .map((invite) => ({ invite, company: companyOf(state, invite), total: leveledTotal(pkg, invite) }))
    .filter((x): x is { invite: Invite; company: string; total: number } => x.total !== null)
    .sort((a, b) => a.total - b.total)
  const lowest = good[0] ?? null
  const unanswered = pkg.invites.filter((i) => !i.bid)
  const base = { pkg, carried: amount, company: carriedInvite ? companyOf(state, carriedInvite) : null, lowest }

  if (amount === null) {
    if (pkg.selfPerform) {
      const guess = pkg.selfPerform.value > 0 ? pkg.selfPerform.value : pkg.budget
      return { ...base, standing: 'ownBid', estimate: guess, lowest: null, words: 'Our own bid is not priced yet. Our figure so far is shown.' }
    }
    if (lowest) {
      const next = good[1]
      const words = [
        `${lowest.company} is lowest of ${good.length}.`,
        next ? `${next.company} is ${money(next.total)}.` : '',
        askedWords(
          state,
          unanswered.filter((i) => i.status !== 'declined'),
        ),
      ]
      return { ...base, standing: 'pick', estimate: lowest.total, words: words.filter(Boolean).join(' ') }
    }
    const waiting = unanswered.filter((i) => i.status !== 'declined')
    const due = project.bidDue ? ` Quotes are due ${weekdayDate(project.bidDue)}.` : ''
    if (waiting.length > 0) {
      // Waiting first, then who said no.
      const ordered = [...waiting, ...pkg.invites.filter((i) => i.status === 'declined')]
      return { ...base, standing: 'waiting', estimate: pkg.budget, words: `${askedWords(state, ordered)}${due} Our budget is shown.` }
    }
    const said = askedWords(state, pkg.invites)
    return {
      ...base,
      standing: 'notAsked',
      estimate: pkg.budget,
      words: pkg.invites.length === 0 ? 'No company asked yet. Our budget is shown.' : `${said} Nobody else is asked yet. Our budget is shown.`,
    }
  }
  const uncosted = carriedUncosted(pkg)
  if (uncosted.length > 0) {
    const names = uncosted.map((s) => s.label.toLowerCase())
    const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
    return { ...base, standing: 'gap', estimate: null, words: `${base.company ?? 'The quote'} leaves out ${list}. No cost set yet, so ${names.length === 1 ? 'it counts' : 'they count'} as $0.` }
  }
  if (!pkg.sow && carriedInvite?.bid && quoteRanOut(carriedInvite.bid, today)) {
    return { ...base, standing: 'ranOut', estimate: null, words: `${base.company}'s quote ran out. Ask them to send it again.` }
  }
  if (isGuess(pkg)) {
    return {
      ...base,
      standing: 'guess',
      estimate: null,
      words: lowest ? `Carrying our budget. ${lowest.company} quoted ${money(lowest.total)}.` : 'Carrying our budget. No quote is in yet.',
    }
  }
  return { ...base, standing: 'real', estimate: null, words: '' }
}

/** Where a job's price stands, trade by trade, and what it comes to once every trade is in. */
export function priceStanding(state: GcState, project: GcProject): PriceStanding {
  const totals = proposalTotals(project)
  const all = project.packages.map((pkg) => rowOf(state, project, pkg))
  const rows = STANDING_ORDER.flatMap((st) => all.filter((r) => r.standing === st))
  const counts = Object.fromEntries(STANDING_ORDER.map((st) => [st, all.filter((r) => r.standing === st).length])) as Record<TradeStanding, number>
  const holes = all.filter((r) => isHole(r.standing))
  const cost = totals.trades + holes.reduce((t, r) => t + (r.estimate ?? 0), 0) + project.generalConditions
  const contingency = (cost * project.contingencyPct) / 100
  const likely = cost + contingency + ((cost + contingency) * project.feePct) / 100
  return {
    rows,
    counts,
    holes: holes.length,
    soFar: totals.price,
    likely,
    trades: totals.trades,
    generalConditions: totals.generalConditions,
    markups: totals.contingency + totals.fee,
    contingencyPct: project.contingencyPct,
    feePct: project.feePct,
  }
}

/** "about $1.42M", "about $395,800": rounded so it reads as the estimate it is. */
export function aboutMoney(n: number): string {
  if (n >= 1_000_000) return `about $${(Math.round(n / 10_000) / 100).toFixed(2)}M`
  return `about ${money(Math.round(n / 100) * 100)}`
}
