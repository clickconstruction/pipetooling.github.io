/**
 * Messages, cut 9 (wave 1, helper 7): the top of Bill day → From the trades, for the money team. The money river (the
 * trades' draws by where they stand, flowing into the owner's number), the dates along the bottom, the ring that says
 * how many gates are clear, and Today's first three things. Lifted from the Messages prototype v1.178
 * (`billSummaryHtml`'s numbers) on branch spike/gc-mode, to-dos/gc-mode/messages/prototype.html. The owner's number is
 * Owner Billing's, never summed here: the forecast while the pay application is not built, the draft once it is.
 */
import { billingForecast } from '../billingForecast'
import { ownCrewWork } from '../building'
import { ownerPayApp, ownerPayAppsSent } from '../ownerBilling'
import type { GcProject, GcState } from '../types'
import { daysUntil, money, shortDate, weekdayDate } from '../words'
import { canItGo, type BillDayDates, type BillDayGate, type GateAct, type TradeDraw } from './trades'

export type RiverKey = 'notin' | 'back' | 'waiting' | 'approved'

export interface RiverSegment {
  key: RiverKey
  label: string
  amount: number
  count: number
  /** The amount's share of the river, 0 to 1. */
  share: number
  /** The legend's small line after the label: "due Oct 19", "4 days". Empty: nothing more to say. */
  words: string
  /** The hover: what the amount is and what it reads at. */
  tip: string
}

/** Where the owner's number came from: the forecast for this bill day, the draft as it stands, or the bill as it went. */
export type OwnerNumberFrom = 'forecast' | 'draft' | 'sent'

export interface OwnerNumber {
  amount: number
  from: OwnerNumberFrom
  /** Our own crew's work on this bill, from the draft, and its percent done. Null: no trade of ours on the job. */
  ours: { amount: number; pct: number; ref: string } | null
}

export interface BillRiver {
  /** The draws counted: every trade not said to send nothing, not closing out. */
  draws: number
  total: number
  segments: RiverSegment[]
  owner: OwnerNumber
}

const SEGMENTS: { key: RiverKey; label: string; reads: string }[] = [
  { key: 'notin', label: 'Not in', reads: 'What the schedule says each comes to by bill day, after retainage.' },
  { key: 'back', label: 'Sent back', reads: 'What each asked, after retainage.' },
  { key: 'waiting', label: 'Waiting on us', reads: 'What each asked, after retainage.' },
  { key: 'approved', label: 'Approved', reads: 'What we approved, after retainage and back-charges.' },
]

/**
 * The owner's number "as it stands". Once the bill for this bill day went, what it asked. On bill day and after, the
 * draft from the work in. Before, the forecast's month for this bill day, which carries the work to it by the schedule;
 * the draft when the forecast has no month.
 */
export function ownerNumber(state: GcState, project: GcProject, dates: BillDayDates): OwnerNumber {
  const draft = ownerPayApp(state, project)
  const self = project.packages.find((p) => p.selfPerform)
  const crew = self ? ownCrewWork(self) : null
  const ours = self && crew ? { amount: draft.lines.find((l) => l.id === self.id)?.thisMonth ?? 0, pct: crew.pct, ref: crew.ref } : null
  const sent = ownerPayAppsSent(project).find((a) => a.periodTo === dates.billDay)
  if (sent) return { amount: sent.due, from: 'sent', ours }
  if (state.today >= dates.billDay) return { amount: Math.max(0, draft.due), from: 'draft', ours }
  const month = billingForecast(state, project).months.find((m) => m.on === dates.billDay)
  return month ? { amount: month.bill, from: 'forecast', ours } : { amount: Math.max(0, draft.due), from: 'draft', ours }
}

/** The trades' draws as one river, by where they stand, and the owner's number it flows into. */
export function billRiver(state: GcState, project: GcProject, rows: TradeDraw[], dates: BillDayDates): BillRiver {
  const counted = rows.filter((r) => r.state !== 'closing' && !r.nothing)
  const amountOf = (r: TradeDraw): number => (r.state === 'notin' ? r.expected : r.state === 'approved' ? (r.approved ?? 0) : (r.asked ?? 0))
  const raw = SEGMENTS.map((s) => {
    const mine = counted.filter((r) => r.state === s.key)
    return { ...s, mine, amount: mine.reduce((t, r) => t + amountOf(r), 0) }
  }).filter((s) => s.mine.length > 0)
  const total = raw.reduce((t, s) => t + s.amount, 0)
  const oldest = (mine: TradeDraw[]) => mine.reduce<string | null>((o, r) => (r.since && (!o || r.since < o) ? r.since : o), null)
  const segments: RiverSegment[] = raw.map((s) => {
    const since = oldest(s.mine)
    const words = s.key === 'notin' ? `due ${shortDate(dates.cutoff)}` : s.key === 'waiting' && since ? `${daysUntil(state.today, since)} days` : ''
    const draws = `${s.mine.length} ${s.mine.length === 1 ? 'draw' : 'draws'}`
    return {
      key: s.key,
      label: s.label,
      amount: s.amount,
      count: s.mine.length,
      share: total === 0 ? 0 : s.amount / total,
      words,
      tip: `${s.label}|${money(s.amount)} across ${draws}. ${s.reads}|A press jumps to the section.`,
    }
  })
  return { draws: counted.length, total, segments, owner: ownerNumber(state, project, dates) }
}

/** The river's heading: "The trades' draws · 6 · $172,400 as it stands". */
export function riverHeading(river: BillRiver): string {
  return `The trades' draws · ${river.draws} · ${money(river.total)} as it stands`
}

/** The small line under the owner's number. */
export function ownerWords(river: BillRiver): string {
  const parts = [`the trades ${money(river.total)}`]
  if (river.owner.ours) parts.push(`our crew ${money(river.owner.ours.amount)}`)
  return parts.join(' · ')
}

export interface BillMark {
  key: 'today' | 'tradesBy' | 'walk' | 'billDay' | 'ownerPays'
  label: string
  on: string
  /** 'now' on today; 'hot' on Trades by while a trade is not in, before the day and after it. */
  tone: 'now' | 'hot' | ''
  /** ", past", ", today", ", in 9 days" after the date, for the hover. */
  when: string
}

/** The dates under the river, in the order they come, today among them. Evenly spaced on the page: the order is what matters. */
export function billMarks(dates: BillDayDates, today: string, rows: TradeDraw[]): BillMark[] {
  const notIn = rows.some((r) => r.state === 'notin' && !r.nothing)
  const marks: Omit<BillMark, 'when'>[] = [
    { key: 'today', label: 'Today', on: today, tone: 'now' },
    { key: 'tradesBy', label: 'Trades by', on: dates.cutoff, tone: notIn ? 'hot' : '' },
    { key: 'walk', label: 'Walk by', on: dates.checkBy, tone: '' },
    { key: 'billDay', label: 'Bill day', on: dates.billDay, tone: '' },
    ...(dates.ownerPaysBy ? [{ key: 'ownerPays' as const, label: 'Owner pays', on: dates.ownerPaysBy, tone: '' as const }] : []),
  ]
  return marks
    .map((m, at) => ({ m, at }))
    .sort((a, b) => a.m.on.localeCompare(b.m.on) || a.at - b.at)
    .map(({ m }) => {
      const d = daysUntil(m.on, today)
      return { ...m, when: m.key === 'today' ? '' : d < 0 ? ', past' : d === 0 ? ', today' : `, in ${d} ${d === 1 ? 'day' : 'days'}` }
    })
}

/** A mark's hover: "Trades by|Mon Oct 19, in 17 days.|Evenly spaced; the order is what matters." */
export function markTip(m: BillMark): string {
  return `${m.label}|${weekdayDate(m.on)}${m.when}.|Evenly spaced. The order is what matters.`
}

export interface TodayItem {
  key: BillDayGate['key']
  /** Red, orange, blue: first, second, third. */
  dot: 'r' | 'o' | 'b'
  words: string
  acts: GateAct[]
}

/** Today: the first three gates still open, each with its own presses; or the line that says it can go. */
export function billToday(gates: BillDayGate[], today: string, billDay: string): { items: TodayItem[]; clear: string | null } {
  const dots: TodayItem['dot'][] = ['r', 'o', 'b']
  const items = gates
    .filter((g) => !g.ok)
    .slice(0, 3)
    .map((g, i) => ({ key: g.key, dot: dots[i] ?? 'b', words: g.short || g.text, acts: g.acts }))
  return { items, clear: items.length ? null : `Every gate is clear. ${today >= billDay ? 'Send it.' : 'It goes on bill day.'}` }
}

/** The ring: "3 of 7", its share as a whole percent, and "Can it go? Not yet." */
export function billRing(gates: BillDayGate[]): { words: string; count: string; pct: number; open: string } {
  const go = canItGo(gates)
  return { words: go.words, count: `${go.ok} of ${go.of}`, pct: go.of === 0 ? 0 : Math.round((100 * go.ok) / go.of), open: go.openWords }
}
