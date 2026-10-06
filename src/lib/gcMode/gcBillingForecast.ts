/**
 * GC mode design spike: the billing forecast follows the schedule, the Gantt's Phase 4 (G-97;
 * mock-up `to-dos/gc-mode/mockups/G-97.md`). What we expect to bill the customer each month as the
 * schedule stands today, and how a move changed it.
 *
 * One rule moves the work: each bar keeps the percent its trade reported, and the rest is spread
 * evenly over its days to its finish. By a bill day a bar is done that far; on or after its finish
 * it is done. One rule bills it: at each bill day the job is copied with every line at that
 * percent, and Owner Billing's own `ownerPayApp` (the draft's math) is run on the copy. So our
 * costs and fee following the trades, the retainage step and the floor of what was already billed
 * come out the same, and the bill counts as sent before the next month. No billing math is written
 * twice; nothing here writes the state.
 *
 * What the made-up data does not carry is a stated rule, never invented: work spreads evenly inside
 * a bar; the architect certifies a bill in full; stored materials count once they are in place;
 * the retainage comes with the final bill, on no day; a trade with no signed statement of work has
 * no customer dollars on its bars, and the part of the price no bar carries is said, not placed.
 *
 * Its own file, out of the barrel: the Bill the customer tab, the Money tab, the customer's portal
 * and the schedule's moves read it.
 */
import type { ChangeOrder, GcProject, GcState, OwnerPayAppSent, ScheduleActivity, ScheduleMove, TradePackage } from './gcTypes'
import { addDays } from './gcBuilding'
import { daysBetween, scheduleRows } from './gcBuildingSchedule'
import { changeOrderMoveOf, whereWorkIs } from './gcChangeOrderDays'
import { CUSTOMER_CHANGE_DAYS } from './gcCustomerSchedule'
import { nextOwnerBillDay, ownerPayApp, ownerPayAppsSent, ownerPayAppToSend, signedChangeOrders, spreadMarkup } from './gcOwnerBilling'
import { money, shortDate } from './gcWords'
import type { MovePlan } from './gcScheduleMoves'

/** A bar's percent done by a bill day: what it reported, and the rest spread evenly over its days to its finish. */
export function forecastPct(start: string, finish: string, nowPct: number, today: string, on: string): number {
  if (nowPct >= 100 || on >= finish) return 100
  // The work reported counts through today; what is left starts tomorrow, or on its start if later.
  const from = start > today ? start : addDays(today, 1)
  if (on < from) return Math.max(0, nowPct)
  return nowPct + ((100 - nowPct) * (daysBetween(from, on) + 1)) / (daysBetween(from, finish) + 1)
}

/** One bill day as the schedule stands. */
export interface ForecastMonth {
  /** The bill day. */
  on: string
  /** The work in place by then, in our price to the customer. */
  workToDate: number
  /** That work as a whole percent of the price. */
  pct: number
  /** What the customer holds by then. */
  retainage: number
  /** What that bill asks for. */
  bill: number
  /** The trades whose work it bills, our costs and fee spread in, the most first. */
  byTrade: { label: string; amount: number }[]
}

export interface BillingForecast {
  project: GcProject
  months: ForecastMonth[]
  /** What the customer holds once the last month is billed: it comes with the final bill, on no day. */
  heldAtEnd: number
  /** The draft as it stands: the next bill from the work reported so far. */
  draft: { on: string; due: number }
  /** The part of the price no bar carries: a trade with no signed statement of work, say. Under a dollar: 0. */
  unplaced: number
  /** Why there are no months: no schedule to read, or the work is all billed. Null: there are months. */
  none: 'noSchedule' | 'allBilled' | null
}

/** The jobs that are ours to bill: buying out or building, not closed. */
export function billedJobs(state: GcState): GcProject[] {
  return state.projects.filter((p) => (p.stage === 'buyout' || p.stage === 'building') && !p.closedOn)
}

/** The day a change order's work is done by: the bar its days landed on, else its trade's bar, else the job's last finish. */
function changeOrderFinish(project: GcProject, co: ChangeOrder, activities: ScheduleActivity[], today: string): string {
  const lineId = changeOrderMoveOf(project, co)?.lineId ?? whereWorkIs(project, co, today)?.lineId
  const bar = lineId ? activities.find((a) => a.lineId === lineId) : undefined
  return bar?.finish ?? activities.reduce((last, a) => (a.finish > last ? a.finish : last), today)
}

/** The job's packages with every line at its percent by a bill day. */
function packagesAt(project: GcProject, activities: ScheduleActivity[], now: Map<string, number>, today: string, on: string): TradePackage[] {
  const pctOf = (lineId: string): number | null => {
    const a = activities.find((x) => x.lineId === lineId)
    return a ? forecastPct(a.start, a.finish, now.get(lineId) ?? 0, today, on) : null
  }
  const coFinish = new Map(signedChangeOrders(project).map((co) => [co.id, changeOrderFinish(project, co, activities, today)]))
  return project.packages.map((pkg) => {
    const self = pkg.selfPerform
    if (self) {
      const byLine: Record<string, number> = { ...(self.pctByLine ?? {}) }
      for (const item of pkg.scope) {
        const pct = pctOf(item.id)
        if (pct !== null) byLine[item.id] = pct
      }
      return { ...pkg, selfPerform: { ...self, pctByLine: byLine } }
    }
    const sow = pkg.sow
    if (!sow) return pkg
    const sov = sow.sov.map((line) => {
      const pct = pctOf(line.id)
      if (pct !== null) return { ...line, pctReported: pct }
      // A change order's line on their statement of work: done by the bar its days are on.
      const finish = line.changeOrderId ? coFinish.get(line.changeOrderId) : undefined
      return finish ? { ...line, pctReported: forecastPct(today, finish, line.pctReported, today, on) } : line
    })
    // A pay application sent back is settled by the next bill day; stored materials count once in place.
    const draws = sow.draws.map((d) => ({ ...d, lines: d.lines.map((l) => ({ ...l, stored: 0 })) }))
    return { ...pkg, sow: { ...sow, sov, sentBack: [], draws } }
  })
}

/** The state with one job swapped for its copy, on a given day. */
function withJob(state: GcState, project: GcProject, today: string): GcState {
  return { ...state, today, projects: state.projects.map((p) => (p.id === project.id ? project : p)) }
}

/** The job's copy with a bill counted as sent, so the next month starts from it. */
function withBillSent(project: GcProject, sent: OwnerPayAppSent): GcProject {
  const billing = project.ownerBilling ?? { billed: 0, paid: 0, retainageHeld: 0 }
  return { ...project, ownerBilling: { ...billing, payApps: [...ownerPayAppsSent(project), sent] } }
}

/**
 * What we expect to bill on each bill day as the schedule stands, from the draft's day until the
 * last bar is done. `activities`: dates to try instead of the schedule's own, a planned move's.
 */
export function billingForecast(state: GcState, project: GcProject, activities?: ScheduleActivity[]): BillingForecast {
  const draft = ownerPayApp(state, project)
  const base: BillingForecast = { project, months: [], heldAtEnd: draft.retainage, draft: { on: draft.billOn, due: Math.max(0, draft.due) }, unplaced: 0, none: null }
  if (draft.contract > 0 && draft.doneToDate >= draft.contract - 0.5) return { ...base, none: 'allBilled' }
  const acts = activities ?? project.schedule?.activities ?? []
  if (acts.length === 0) return { ...base, none: 'noSchedule' }
  const today = state.today
  // Each bar starts from what the bill counts today: a line we doubt starts from what we see.
  const now = new Map(scheduleRows(state, project).map((r) => [r.activity.lineId, r.actual]))
  const lastFinish = acts.reduce((last, a) => (a.finish > last ? a.finish : last), today)
  const coFinish = new Map(signedChangeOrders(project).map((co) => [co.id, changeOrderFinish(project, co, acts, today)]))
  const months: ForecastMonth[] = []
  let history = project
  let on = draft.billOn
  for (let i = 0; i < 60; i++) {
    const copy: GcProject = {
      ...history,
      packages: packagesAt(project, acts, now, today, on),
      // A change order the office reports by hand runs to the same finish as one a trade reports.
      changeOrders: (project.changeOrders ?? []).map((co) => {
        const finish = coFinish.get(co.id)
        return finish && co.status === 'signed' && co.tradeChange?.status !== 'signed' ? { ...co, pctDone: forecastPct(today, finish, co.pctDone, today, on) } : co
      }),
    }
    const app = ownerPayApp(withJob(state, copy, on), copy)
    const byTrade = spreadMarkup(app.lines)
      .filter((l) => l.thisMonth >= 1)
      .map((l) => ({ label: l.label, amount: l.thisMonth }))
      .sort((a, b) => b.amount - a.amount)
    months.push({ on, workToDate: app.doneToDate, pct: app.contract === 0 ? 0 : Math.round((app.doneToDate / app.contract) * 100), retainage: app.retainage, bill: Math.max(0, app.due), byTrade })
    if (on >= lastFinish || app.doneToDate >= app.contract - 0.5) {
      return { ...base, months, heldAtEnd: app.retainage, unplaced: app.contract - app.doneToDate >= 1 ? app.contract - app.doneToDate : 0 }
    }
    history = withBillSent(copy, ownerPayAppToSend(app, on))
    on = nextOwnerBillDay(addDays(on, 1))
  }
  return { ...base, months }
}

/** How a forecast moved: each bill day whose bill changed by a dollar or more, a new month included. Positive: more. */
export interface ForecastShift {
  on: string
  delta: number
}

export function forecastShifts(before: BillingForecast, after: BillingForecast): ForecastShift[] {
  const days = [...new Set([...before.months, ...after.months].map((m) => m.on))].sort()
  const billOn = (f: BillingForecast, on: string) => f.months.find((m) => m.on === on)?.bill ?? 0
  return days.map((on) => ({ on, delta: billOn(after, on) - billOn(before, on) })).filter((s) => Math.abs(s.delta) >= 1)
}

/** Money moved from one bill to another, when that is all that happened: the bill that lost it, the one that got it, and how much. */
function onePair(shifts: ForecastShift[]): { from: ForecastShift; to: ForecastShift } | null {
  if (shifts.length !== 2) return null
  const from = shifts.find((s) => s.delta < 0)
  const to = shifts.find((s) => s.delta > 0)
  return from && to && Math.abs(from.delta + to.delta) < 2 ? { from, to } : null
}

/**
 * The office's words for what a move does to the bills. `will`: before it is saved, "$6,601 of
 * the Oct 25 bill moves to Nov 25." `did`: on the move's row, "it moved $6,601 of the Oct 25 bill
 * to Nov 25." More than one pair: a sentence a bill. Null: it moves no money.
 */
export function shiftWords(shifts: ForecastShift[], when: 'will' | 'did'): string | null {
  if (shifts.length === 0) return null
  const pair = onePair(shifts)
  if (pair) {
    const amount = money(Math.abs(pair.from.delta))
    return when === 'will' ? `${amount} of the ${shortDate(pair.from.on)} bill moves to ${shortDate(pair.to.on)}.` : `it moved ${amount} of the ${shortDate(pair.from.on)} bill to ${shortDate(pair.to.on)}.`
  }
  return shifts.map((s) => `${shortDate(s.on)} ${when === 'will' ? 'goes' : 'went'} ${s.delta > 0 ? 'up' : 'down'} ${money(Math.abs(s.delta))}.`).join(' ')
}

/** "about $368,700": a forecast to the customer, to the hundred. */
export function aboutMoney(amount: number): string {
  return `about ${money(Math.round(amount / 100) * 100)}`
}

/** The customer's words for what this week's moves did to their bills. Null: nothing moved by $50 or more. */
export function customerShiftWords(shifts: ForecastShift[]): string | null {
  const shown = shifts.filter((s) => Math.round(Math.abs(s.delta) / 100) > 0)
  if (shown.length === 0) return null
  const pair = onePair(shifts)
  if (pair) return `This week's schedule moves shifted ${aboutMoney(Math.abs(pair.from.delta))} from your ${shortDate(pair.from.on)} bill to ${shortDate(pair.to.on)}.`
  return ['This week’s schedule moves changed your bills.', ...shown.map((s) => `${shortDate(s.on)} is ${aboutMoney(Math.abs(s.delta))} ${s.delta > 0 ? 'more' : 'less'}.`)].join(' ')
}

/** What a planned move does to the bills: the forecast with its dates against the forecast now. */
export function planBillingShift(state: GcState, project: GcProject, plan: Pick<MovePlan, 'activities'>): ForecastShift[] {
  return forecastShifts(billingForecast(state, project), billingForecast(state, project, plan.activities))
}

/** The lines a move changed, each with its dates before and after. */
function moveLines(move: ScheduleMove): { lineId: string; from: { start: string; finish: string }; to: { start: string; finish: string } }[] {
  return [{ lineId: move.lineId, from: move.from, to: move.to }, ...move.pushed]
}

/** The activities with a move's lines put back, when every one still sits where it left them. Null: something moved since. */
function withoutMove(activities: ScheduleActivity[], move: ScheduleMove): ScheduleActivity[] | null {
  const lines = moveLines(move)
  const sits = lines.every((l) => {
    const a = activities.find((x) => x.lineId === l.lineId)
    return a !== undefined && a.start === l.to.start && a.finish === l.to.finish
  })
  if (!sits) return null
  return activities.map((a) => {
    const l = lines.find((x) => x.lineId === a.lineId)
    return l ? { ...a, start: l.from.start, finish: l.from.finish } : a
  })
}

/** What a standing move did to the bills, read by putting its dates back. Null: undone, or a bar it touched has moved since. */
export function moveBillingShift(state: GcState, project: GcProject, move: ScheduleMove): ForecastShift[] | null {
  const activities = project.schedule?.activities ?? []
  if (move.undoneOn) return null
  const before = withoutMove(activities, move)
  return before ? forecastShifts(billingForecast(state, project, before), billingForecast(state, project)) : null
}

/** What this week's standing moves did to the bills (the customer's What changed window): each put back, newest first. */
export function weekBillingShift(state: GcState, project: GcProject): ForecastShift[] {
  const activities = project.schedule?.activities ?? []
  let before = activities
  for (const move of project.schedule?.moves ?? []) {
    if (move.undoneOn || daysBetween(move.on, state.today) > CUSTOMER_CHANGE_DAYS) continue
    before = withoutMove(before, move) ?? before
  }
  return before === activities ? [] : forecastShifts(billingForecast(state, project, before), billingForecast(state, project))
}

/** The months across every job that is ours: each bill day's total and its jobs. */
export interface BillingByMonth {
  months: { on: string; total: number; jobs: { project: GcProject; bill: number }[] }[]
  /** What the customers hold until the final bills, every job's together. */
  heldAtEnd: number
  /** Jobs with work left to bill and no schedule to read. */
  noSchedule: GcProject[]
  /** Jobs whose price is not all on their bars, and how much is not. */
  unplaced: { project: GcProject; amount: number }[]
}

export function billingByMonth(state: GcState): BillingByMonth {
  const forecasts = billedJobs(state).map((project) => billingForecast(state, project))
  const days = [...new Set(forecasts.flatMap((f) => f.months.map((m) => m.on)))].sort()
  return {
    months: days.map((on) => {
      const jobs = forecasts.flatMap((f) => {
        const bill = f.months.find((m) => m.on === on)?.bill ?? 0
        return bill >= 1 ? [{ project: f.project, bill }] : []
      })
      return { on, total: jobs.reduce((t, j) => t + j.bill, 0), jobs }
    }),
    heldAtEnd: forecasts.filter((f) => f.none !== 'noSchedule').reduce((t, f) => t + f.heldAtEnd, 0),
    noSchedule: forecasts.filter((f) => f.none === 'noSchedule').map((f) => f.project),
    unplaced: forecasts.filter((f) => f.unplaced >= 1).map((f) => ({ project: f.project, amount: f.unplaced })),
  }
}
