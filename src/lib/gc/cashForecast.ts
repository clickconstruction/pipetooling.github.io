/**
 * GC mode, the real build, Owner Billing's O2b: the cash weeks that follow the bars (G-140), moved word for word from the GC mode
 * prototype (branch spike/gc-mode, `gcCashForecast.ts`).
 */
import { billingForecast, sovLinePctAt } from './billingForecast'
import { addDays, drawLinesOf, drawMoney, payApplication } from './building'
import { partnerById } from './lookups'
import { nextOwnerBillDay, ownerPayApp, ownerPayAppHasWork } from './ownerBilling'
import type { CashAhead, CashMove } from './ownerBillingAhead'
import { PAY_WITHIN_DAYS } from './portal'
import type { GcProject, GcState, SovLine, Sow } from './types'
import { money, shortDate } from './words'

/** How the cash weeks read the work not on the books yet: as the schedule has it, or held at what was reported. */
export type CashBars = 'schedule' | 'reported'

/** What we see done on a line: what they reported, or less on a line of a pay application we sent back and they have not sent again. */
export function seenPct(sow: Sow, line: Pick<SovLine, 'id' | 'pctReported'>): number {
  let seen = line.pctReported
  for (const back of sow.sentBack ?? []) {
    if (sow.draws.some((d) => d.number === back.draw.number)) continue
    const doubted = back.lines.find((l) => l.sovId === line.id)
    if (doubted) seen = Math.min(seen, doubted.weSee)
  }
  return seen
}

const base = { waitingOnArchitect: false, askedOn: null, final: false, expected: true } as const

/** The day a customer's bill is paid: the bill day plus their usual days to pay. Null: they have never paid us. */
function paidOn(state: GcState, project: GcProject, billOn: string): string | null {
  const days = state.customers.find((c) => c.id === project.customerId)?.payDays
  return days == null ? null : addDays(billOn, days)
}

/** Our bills not sent yet, each on the day it should be paid: the schedule's months, or the draft as reported. */
export function expectedBills(state: GcState, project: GcProject, bars: CashBars): CashMove[] {
  const draft = ownerPayApp(state, project)
  const asDraft: CashMove[] =
    ownerPayAppHasWork(draft) && draft.due > 0.005
      ? [{ ...base, project, dir: 'in', who: project.owner, number: draft.number, amount: draft.due, on: draft.expectPaidOn, why: 'nextBill', billOn: draft.billOn }]
      : []
  if (bars === 'reported') return asDraft
  const forecast = billingForecast(state, project)
  if (forecast.none === 'noSchedule') return asDraft
  return forecast.months
    .filter((m) => Math.round(m.bill) > 0)
    .map((m, k) => ({ ...base, project, dir: 'in' as const, who: project.owner, number: draft.number + k, amount: m.bill, on: paidOn(state, project, m.on), why: 'nextBill' as const, billOn: m.on, fromBars: true as const }))
}

/**
 * Each trade's draws not asked for yet, each paid 10 days after the bill day it is asked by: its
 * work at each bill day through its own pay application. As reported: one draw, for the work
 * reported and not drawn. On a job with no months to read, the same.
 */
export function expectedDraws(state: GcState, project: GcProject, bars: CashBars): CashMove[] {
  const forecast = bars === 'schedule' ? billingForecast(state, project) : null
  // Following the bars needs months to read; otherwise each line stays at what we see, as before.
  const follow = forecast !== null && forecast.months.length > 0
  const days = follow ? forecast.months.map((m) => m.on) : [nextOwnerBillDay(state.today)]
  const activities = project.schedule?.activities ?? []
  const moves: CashMove[] = []
  for (const pkg of project.packages) {
    const sow = pkg.sow
    if (pkg.selfPerform || !sow || sow.status !== 'signed') continue
    const invite = pkg.invites.find((i) => i.id === pkg.awardedInviteId)
    const who = (invite ? partnerById(state, invite.partnerId)?.company : undefined) ?? pkg.trade
    let drawn = sow
    for (const on of days) {
      // Each line at what we see, carried forward by its bar to the bill day as the schedule stands.
      const toPct = Object.fromEntries(sow.sov.map((l) => [l.id, (follow ? sovLinePctAt(project, activities, l, seenPct(sow, l), state.today, on) : null) ?? seenPct(sow, l)]))
      const number = drawn.draws.length + 1
      const app = payApplication(drawn, number, toPct)
      const { gross, retainage, net } = drawMoney(drawn, app)
      if (net >= 1) moves.push({ ...base, project, dir: 'out', who, number, amount: net, on: addDays(on, PAY_WITHIN_DAYS), why: 'nextDraw', billOn: on, ...(follow ? { fromBars: true as const } : {}) })
      // The draw counts as made, so the next month starts from it.
      drawn = { ...drawn, draws: [...drawn.draws, { id: `${pkg.id}-expected-${number}`, number, requestedOn: on, gross, retainage, net, status: 'paid', waiver: 'conditional', lines: drawLinesOf(app) }] }
    }
  }
  return moves
}

/**
 * What following the bars changed, beside the same weeks as reported: "As the schedule stands,
 * $205,920 more goes to the trades in these weeks." and "The bills it expects bring $380,624 more,
 * all of it after these weeks." Empty: the schedule changes nothing.
 */
export function barsChangeWords(schedule: CashAhead, reported: CashAhead): string[] {
  const inWeeks = (a: CashAhead, dir: 'in' | 'out') => a.weeks.flatMap((w) => w.moves).filter((m) => m.expected && m.dir === dir).reduce((t, m) => t + m.amount, 0)
  const words: string[] = []
  const out = inWeeks(schedule, 'out') - inWeeks(reported, 'out')
  if (Math.abs(out) >= 1) words.push(`As the schedule stands, ${money(Math.abs(out))} ${out > 0 ? 'more' : 'less'} goes to the trades in these weeks.`)
  const allIn = schedule.expected.in - reported.expected.in
  const weeksIn = inWeeks(schedule, 'in') - inWeeks(reported, 'in')
  if (Math.abs(allIn) >= 1) {
    const where = Math.abs(weeksIn) < 1 ? 'all of it after these weeks' : Math.abs(allIn - weeksIn) < 1 ? 'all of it in these weeks' : `${money(Math.abs(weeksIn))} of it in these weeks`
    words.push(`The bills it expects bring ${money(Math.abs(allIn))} ${allIn > 0 ? 'more' : 'less'}, ${where}.`)
  }
  return words
}

/** The money going out that makes the lowest week: "Summit Roofing $118,800 and Cool Breeze Mechanical $84,240 are most of it." Null: no dip. */
export function lowestWeekWords(ahead: CashAhead): string | null {
  const week = ahead.lowest
  if (!week || week.out < 1) return null
  const outs = week.moves.filter((m) => m.dir === 'out').sort((a, b) => b.amount - a.amount)
  const top: CashMove[] = []
  for (const m of outs) {
    if (top.length === 3 || top.reduce((t, x) => t + x.amount, 0) >= week.out / 2) break
    top.push(m)
  }
  if (top.length === 0) return null
  const names = top.map((m) => `${m.who} ${money(m.amount)}`)
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return top.length === outs.length ? `${list} ${top.length === 1 ? 'is' : 'are'} what goes out that week.` : `${list} ${top.length === 1 ? 'is' : 'are'} most of it.`
}

/** The last bill day the expected bills reach, for the note: "through Dec 25". Null: none expected. */
export function expectedThrough(ahead: CashAhead): string | null {
  const days = [...ahead.weeks.flatMap((w) => w.moves), ...ahead.later, ...ahead.noDay].filter((m) => m.expected && m.dir === 'in' && m.billOn).map((m) => m.billOn as string)
  return days.length === 0 ? null : days.reduce((a, b) => (b > a ? b : a))
}

/** "Oct 25": a bill day, for a row's words. */
export function billDayWords(move: CashMove): string {
  return move.billOn ? shortDate(move.billOn) : 'the bill day'
}
