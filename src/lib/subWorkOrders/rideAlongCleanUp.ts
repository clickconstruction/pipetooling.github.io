/**
 * Taking the teammates off a sub's sheet (punch list #346; Taunya's yes of 2026-11-15).
 *
 * A teammate landed on a sub's sheet because picking a job in the sheet form ticked that job's whole team. The name
 * does nothing for what is paid: the sheet is the sub's, whole. It does two other things. The teammate's own screens
 * list the sheet. And People → Review and the Team Summary book a sheet's cost in equal shares to every name on it
 * (`laborJobShareOfMatchedPerson`, the owner's call of 2026-10-09), so a teammate's panel carries a share of a sheet
 * that paid them nothing.
 *
 * This plans the clean-up: each sheet keeps its one sub and loses the other names. No amount, payment, date or job
 * changes, and the plan says so with a sum. The shares do change: the sheet's whole cost becomes the sub's, and the
 * plan says how much leaves the teammates' panels.
 *
 * Ready: a sheet with exactly one roster sub who has a roster row, and one or more teammates beside them.
 * Held, with the reason and its door: a sheet with two subs (someone has to say whose it is first), and a sheet whose
 * sub has no roster row (the save rebuilds the sheet's people from its names, and a name the roster cannot find would
 * leave the sheet tied to nobody).
 * Not listed at all: a sheet with one name, and a sheet with teammates and no sub (that one is a teammate's own, or
 * shared, and belongs to the band).
 *
 * The save is one write per sheet: `assigned_to_name` becomes the sub's name, and the database's own trigger
 * (`sync_people_labor_job_assignees`) rebuilds the sheet's people from it.
 *
 * Pure: no React, no Supabase.
 */
import { batchOutcomeWords, batchWords, type BatchOutcome, type BatchWords } from '../batchWords'
import type { SheetParties } from './sheetParties'

export type RideAlongSheetInput = {
  id: string
  /** The sheet as the Pay view names it: its job, else its address. */
  label: string
  /** The sheet's day, `YYYY-MM-DD`, or ''. */
  day: string
  parties: SheetParties
  /** What the sheet comes to and what is still open on it. Neither changes. */
  total: number
  open: number
}

export type RideAlongRow = {
  sheetId: string
  label: string
  day: string
  sub: { id: string; name: string }
  /** The teammates that come off. */
  takeOff: string[]
  total: number
  open: number
  /** What `assigned_to_name` becomes. */
  nextAssignedToName: string
}

export type RideAlongHeld = {
  sheetId: string
  label: string
  day: string
  names: string
  why: string
  /** Where the hold is lifted: the band's *Whose is it…*, or the sheet's own form. */
  door: 'whose' | 'sheet'
}

export type RideAlongCleanUp = { ready: RideAlongRow[]; held: RideAlongHeld[] }

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const list = (names: readonly string[]) => (names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`)

/** The sheets that carry a teammate beside a sub, sorted oldest first, ready ones and held ones apart. */
export function rideAlongCleanUp(sheets: readonly RideAlongSheetInput[]): RideAlongCleanUp {
  const ready: RideAlongRow[] = []
  const held: RideAlongHeld[] = []
  for (const s of sheets) {
    const p = s.parties
    if (p.crew || p.teammates.length === 0) continue
    const takeOff = p.teammates.map((t) => t.name).filter(Boolean)
    const names = [...p.contractors, ...p.teammates].map((x) => x.name).filter(Boolean).join(', ')
    if (p.contractors.length > 1) {
      held.push({ sheetId: s.id, label: s.label, day: s.day, names, why: `It names ${p.contractors.length === 2 ? 'two' : p.contractors.length} subs. Say whose it is first.`, door: 'whose' })
      continue
    }
    const sub = p.contractors[0]
    if (!sub || !sub.id || !sub.name.trim()) {
      held.push({ sheetId: s.id, label: s.label, day: s.day, names, why: `${sub?.name.trim() || 'Its sub'} has no roster row, so the sheet cannot be tied to them. Fix the name on the sheet first.`, door: 'sheet' })
      continue
    }
    ready.push({ sheetId: s.id, label: s.label, day: s.day, sub: { id: sub.id, name: sub.name.trim() }, takeOff, total: s.total, open: s.open, nextAssignedToName: sub.name.trim() })
  }
  const byDay = (a: { day: string; label: string }, b: { day: string; label: string }) => a.day.localeCompare(b.day) || a.label.localeCompare(b.label)
  return { ready: ready.sort(byDay), held: held.sort(byDay) }
}

/** One row's line: who keeps the sheet and who comes off. */
export function rideAlongRowWords(r: RideAlongRow): string {
  return `${r.sub.name} keeps it. ${list(r.takeOff)} ${r.takeOff.length === 1 ? 'comes' : 'come'} off.`
}

export type RideAlongPlan = {
  rows: RideAlongRow[]
  /** The button and the line under it, from `batchWords`. */
  words: BatchWords
  /** What the press does, in one line. */
  effect: string
  /** The sum that shows no money moves: what is open on the picked sheets, before and after. */
  sumWords: string
  /** Sheet cost that leaves the teammates' panels on People → Review and the Team Summary, by sheet totals. */
  reviewMoved: number
  /** What that does, in one line. '' when nothing is picked. */
  reviewWords: string
  /** Distinct teammates that come off the picked sheets. */
  teammates: string[]
}

/** The plan for the sheets ticked. A hold on one sheet never stops the rest. */
export function rideAlongPlan(cleanUp: RideAlongCleanUp, picked: ReadonlySet<string>): RideAlongPlan {
  const rows = cleanUp.ready.filter((r) => picked.has(r.sheetId))
  const teammates = [...new Set(rows.flatMap((r) => r.takeOff))]
  const subs = [...new Set(rows.map((r) => r.sub.name))]
  const open = rows.reduce((n, r) => n + r.open, 0)
  const words = batchWords({ verb: 'Take teammates off', ready: rows.length, held: cleanUp.held.length, heldWhy: { one: 'needs a look first', many: 'need a look first' }, noun: 'sheet' })
  const effect =
    rows.length === 0
      ? ''
      : `${rows.length === 1 ? 'The sheet stays' : `The ${rows.length} sheets stay`} ${subs.length === 1 ? `${subs[0]}'s` : `with ${subs.length === 2 ? 'their two subs' : `their ${subs.length} subs`}`}. ${list(teammates)} ${teammates.length === 1 ? 'is' : 'are'} no longer named on ${rows.length === 1 ? 'it' : 'them'}, so ${rows.length === 1 ? 'it leaves' : 'they leave'} ${teammates.length === 1 ? 'that person’s' : 'those people’s'} own lists.`
  const sumWords = rows.length === 0 ? '' : `No amount, payment or date changes. ${money(open)} is open on ${rows.length === 1 ? 'it' : 'them'} before, and ${money(open)} after.`
  // Review and the Team Summary split a sheet evenly between its names: with the sub and n teammates, n of n + 1 parts
  // sit on the teammates today.
  const reviewMoved = Math.round(rows.reduce((n, r) => n + (r.total * r.takeOff.length) / (r.takeOff.length + 1), 0) * 100) / 100
  const reviewWords =
    rows.length === 0
      ? ''
      : `People → Review and the Team Summary split a sheet's cost evenly between its names. After this ${rows.length === 1 ? "the sheet's whole cost is its sub's" : "each sheet's whole cost is its sub's"}, so ${money(reviewMoved)} of sheet cost leaves the teammates' panels.`
  return { rows, words, effect, sumWords, teammates, reviewMoved, reviewWords }
}

export type RideAlongFailure = { row: RideAlongRow; reason: string }

/** After the run: what took, and the head over the rows that did not. */
export function rideAlongOutcomeWords(done: number, failed: number): BatchOutcome {
  return batchOutcomeWords({ verb: 'change', past: 'changed', done, failed, noun: 'sheet' })
}

/** The line that offers the clean-up on People → Subs. '' when there is nothing to clean. */
export function rideAlongOfferWords(cleanUp: RideAlongCleanUp): string {
  const n = cleanUp.ready.length + cleanUp.held.length
  if (n === 0) return ''
  return `${n} ${n === 1 ? "sub's sheet also names a teammate" : "subs' sheets also name a teammate"}. The teammate is not paid from ${n === 1 ? 'it' : 'them'}.`
}
