/**
 * GC mode — design spike: the money coming in and going out over the next weeks, across every job
 * that is ours (Owner Billing lane, owner's go-ahead 2026-10-03). Only what is already on the books
 * counts: the bills we sent the owners, the draws the trades asked for or we approved, and the
 * retainage on both sides. A bill we have not sent yet is not counted.
 *
 * The days: an owner's bill on their newest promise, else the day we expect it (`ownerPayDue`). A
 * trade's approved draw on its pay-by day (`drawPayDays`: within PAY_WITHIN_DAYS of approval). A
 * draw asked for and not approved yet counts as if we approve it today. A trade's retainage is paid
 * 10 days after the owner pays our final (`tradeRetainageOpensOn`); until then it has no day, like
 * the retainage the owner holds on us. Owner money already late is left out of the weeks unless
 * asked, since we cannot say when it comes.
 *
 * Its own file because it reads gcBuildingPay, which reads gcPortal. Import from `./gcModel`.
 */
import type { GcProject, GcState } from './gcTypes'
import { PAY_WITHIN_DAYS } from './gcPortal'
import { addDays, retainageHeldNow, tradeRetainageOpensOn } from './gcBuilding'
import { drawPayDays } from './gcBuildingPay'
import { mondayOf } from './gcBuildingSchedule'
import { partnerById } from './gcLookups'
import {
  allJobsMoney,
  appCertified,
  appOpen,
  nextOwnerBillDay,
  ownerAccount,
  ownerPayApp,
  ownerPayAppHasWork,
  ownerPayAppsSent,
  ownerPayDue,
} from './gcOwnerBilling'

/** How many weeks the forecast looks ahead, this week first. */
export const CASH_AHEAD_WEEKS = 6

/**
 * Why a move counts on its day. In: the owner's word, their usual days, past either, no day yet,
 * or the retainage they hold until the end. Out: the day we pay an approved draw by, a pay-by day
 * already gone, a draw counted as if we approve it today, or retainage waiting on the owner's.
 */
export type CashMoveWhy = 'promised' | 'expected' | 'late' | 'noDay' | 'atTheEnd' | 'payBy' | 'weAreLate' | 'ifApprovedToday' | 'retainage'

export interface CashMove {
  project: GcProject
  dir: 'in' | 'out'
  /** The owner, or the trade's company. */
  who: string
  /** The bill's or the draw's number. Null: retainage, or a made-up balance from before. */
  number: number | null
  final: boolean
  amount: number
  /** The day it counts. Null: no day yet. */
  on: string | null
  why: CashMoveWhy
  /** In: sent and still waiting on the architect to certify. */
  waitingOnArchitect: boolean
  /** Out: the day the trade asked for it. */
  askedOn: string | null
}

export interface CashWeek {
  /** The Monday it starts. */
  start: string
  /** The Sunday it ends. */
  end: string
  in: number
  out: number
  /** Where we stand at the end of the week across every job: paid in less paid out. */
  standing: number
  moves: CashMove[]
}

export interface CashAhead {
  /** Where we stand today: what `allJobsMoney` adds up. */
  standingNow: number
  weeks: CashWeek[]
  /** The week we stand lowest, when that is below where we stand today. */
  lowest: CashWeek | null
  /** Owner money past its day. It is in this week only when counted. */
  late: CashMove[]
  countLate: boolean
  /** Dated after the last week. */
  later: CashMove[]
  /** No day yet: retainage held until the end, or a bill with no day. */
  noDay: CashMove[]
  /** The bills we send on the next bill day, added up. Not counted until they go. */
  nextBills: { on: string; amount: number; jobs: number }
}

function oursProjects(state: GcState): GcProject[] {
  return state.projects.filter((p) => p.stage === 'buyout' || p.stage === 'building')
}

/** Every move of money on the books across the jobs that are ours, in and out, each with its day. */
export function cashMoves(state: GcState): CashMove[] {
  const today = state.today
  const moves: CashMove[] = []
  const base = { waitingOnArchitect: false, askedOn: null, final: false }
  for (const project of oursProjects(state)) {
    // In, from the owner.
    const account = ownerAccount(project)
    for (const app of ownerPayAppsSent(project)) {
      const open = appOpen(app)
      if (app.paidOn !== null || open <= 0.005) continue
      const due = ownerPayDue(state, project, app)
      const why: CashMoveWhy = due.on === null ? 'noDay' : due.daysLate > 0 ? 'late' : due.promised ? 'promised' : 'expected'
      moves.push({ ...base, project, dir: 'in', who: project.owner, number: app.number, final: app.final === true, amount: open, on: due.on, why, waitingOnArchitect: appCertified(app) === null })
    }
    const made = project.ownerBilling
    const held = account ? account.retainageHeld : (made?.retainageHeld ?? 0)
    if (held > 0.005) moves.push({ ...base, project, dir: 'in', who: project.owner, number: null, amount: held, on: null, why: 'atTheEnd' })
    if (!account && made) {
      const owed = made.billed - made.retainageHeld - made.paid
      if (owed > 0.005) moves.push({ ...base, project, dir: 'in', who: project.owner, number: null, amount: owed, on: null, why: 'noDay' })
    }

    // Out, to the trades.
    const opens = tradeRetainageOpensOn(project)
    const notBefore = (day: string) => (day < today ? today : day)
    for (const pkg of project.packages) {
      const sow = pkg.sow
      if (pkg.selfPerform || !sow || sow.status !== 'signed') continue
      const invite = pkg.invites.find((i) => i.id === pkg.awardedInviteId)
      const who = (invite ? partnerById(state, invite.partnerId)?.company : undefined) ?? pkg.trade
      const trade = { ...base, project, dir: 'out' as const, who }
      for (const draw of sow.draws) {
        if (draw.status === 'paid') continue
        const final = draw.final === true
        const common = { ...trade, number: draw.number, final, amount: draw.net, askedOn: draw.requestedOn }
        if (draw.status === 'approved') {
          const payBy = drawPayDays(project, pkg, draw, today).payBy ?? today
          moves.push({ ...common, on: notBefore(payBy), why: payBy < today ? 'weAreLate' : 'payBy' })
        } else if (!final) {
          moves.push({ ...common, on: addDays(today, PAY_WITHIN_DAYS), why: 'ifApprovedToday' })
        } else {
          moves.push({ ...common, on: opens ? notBefore(opens) : null, why: 'retainage' })
        }
      }
      // Retainage we hold that the trade has not asked for yet.
      const asking = sow.draws.some((d) => d.final && d.status !== 'paid')
      const holding = retainageHeldNow(sow)
      if (!asking && holding > 0.005) moves.push({ ...trade, number: null, final: true, amount: holding, on: opens ? notBefore(opens) : null, why: 'retainage' })
    }
  }
  return moves
}

/**
 * The next weeks across every job: what comes in and goes out each week, and where we stand at the
 * end of it, starting from where we stand today. With countLate, owner money already late counts
 * this week, as if they pay it now.
 */
export function cashAhead(state: GcState, opts: { countLate?: boolean; weeks?: number } = {}): CashAhead {
  const countLate = opts.countLate === true
  const today = state.today
  const standingNow = allJobsMoney(state).totals.net
  const moves = cashMoves(state)
  const first = mondayOf(today)
  const weeks: CashWeek[] = Array.from({ length: opts.weeks ?? CASH_AHEAD_WEEKS }, (_, i) => {
    const start = addDays(first, i * 7)
    return { start, end: addDays(start, 6), in: 0, out: 0, standing: 0, moves: [] }
  })
  const lastDay = weeks[weeks.length - 1]?.end ?? today
  const late: CashMove[] = []
  const later: CashMove[] = []
  const noDay: CashMove[] = []
  for (const move of moves) {
    if (move.why === 'late') late.push(move)
    const on = move.why === 'late' ? (countLate ? today : null) : move.on
    if (move.why === 'late' && on === null) continue
    if (on === null) {
      noDay.push(move)
      continue
    }
    if (on > lastDay) {
      later.push(move)
      continue
    }
    const week = weeks.find((w) => on <= w.end) ?? weeks[0]
    if (!week) continue
    week.moves.push(move)
    if (move.dir === 'in') week.in += move.amount
    else week.out += move.amount
  }
  let standing = standingNow
  for (const week of weeks) {
    standing += week.in - week.out
    week.standing = standing
    week.moves.sort((a, b) => (a.why === 'late' ? today : (a.on ?? '')).localeCompare(b.why === 'late' ? today : (b.on ?? '')) || (a.dir === b.dir ? 0 : a.dir === 'in' ? -1 : 1))
  }
  const byDay = (a: CashMove, b: CashMove) => (a.on ?? '').localeCompare(b.on ?? '')
  later.sort(byDay)
  const lowestWeek = weeks.reduce<CashWeek | null>((low, w) => (low === null || w.standing < low.standing ? w : low), null)
  const lowest = lowestWeek && lowestWeek.standing < standingNow - 0.005 ? lowestWeek : null

  const billOn = nextOwnerBillDay(today)
  const drafts = oursProjects(state)
    .map((project) => ownerPayApp(state, project))
    .filter((app) => ownerPayAppHasWork(app) && app.due > 0.005)
  const nextBills = { on: billOn, amount: drafts.reduce((t, app) => t + app.due, 0), jobs: drafts.length }

  return { standingNow, weeks, lowest, late, countLate, later, noDay, nextBills }
}
