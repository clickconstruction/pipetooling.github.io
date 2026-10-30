/**
 * Punch list #217, office-11: the Office hours card's coverage line drawn. Under *The office is open around the
 * clock*, the line says the hours nobody in the office is pushed, *Nobody hears a reply from 11 PM to 6 AM. Rosa, Cora
 * and Max are all off then.*, and the card drew none of the hours it was read from, so the owner could not see whose
 * hours nearly cover the gap, or which one change would close it. The grid: one row per office person with their
 * Push me hours as a bar on a midnight-to-midnight axis, the stretch no row covers a red hatched column through all
 * of them with its times, and a gap of a day or more, the weekend, as a chip. The days are grouped: every day the same
 * hours draws once, labelled; days that differ each get their own panel. A press on a row opens that person's Push me
 * hours: Settings → Your account for oneself, the person's desk for another, since only they can set their hours.
 * The line stays under the grid as its caption. Pure over `coverageGaps` (`whoIsOff.ts`).
 */
import { daysWords, timeWords } from './officeHoursCard'
import { coverageGaps, dayClock, type CoverageMember } from './whoIsOff'

const DAY = 24 * 60
const HM = /^([01]?\d|2[0-3]):([0-5]\d)$/

function minutesOf(hm: string): number | null {
  const m = HM.exec(hm.trim())
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

/** "6 AM", "7:30 AM", "midnight" at either end of the day. */
export function axisClock(m: number): string {
  if (m <= 0 || m >= DAY) return 'midnight'
  return timeWords(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`).replace(':00 ', ' ')
}

/** A person's hours on one day, in minutes from midnight. */
export interface CoverageBar {
  start: number
  end: number
  /** "6 AM to 11 PM" */
  words: string
}

/** Where a press on the row goes, and what it says. */
export interface CoverageDoor {
  to: string
  words: string
}

export interface CoverageRow {
  id: string | null
  name: string
  /** The first name, the row's label. */
  short: string
  mine: boolean
  /** The bar on this day, or null when the person is off all day. */
  bar: CoverageBar | null
  /** Null for a person the viewer cannot open: no id came with the row. */
  door: CoverageDoor | null
}

/** A stretch of the day no row covers. */
export interface CoverageColumn {
  start: number
  end: number
  /** "to 6 AM", "from 11 PM", "1 PM to 2 PM" */
  words: string
}

/** One drawing of a day: the days that share it, the rows, and the uncovered stretches. */
export interface CoveragePanel {
  /** "Every day", "Mon to Fri", "Sat and Sun" */
  label: string
  days: number[]
  rows: CoverageRow[]
  gaps: CoverageColumn[]
}

export interface CoverageTick {
  at: number
  words: string
}

export interface CoverageGrid {
  panels: CoveragePanel[]
  ticks: CoverageTick[]
  /** The stretches of a day or more, the weekend: "Fri 8 PM to Mon 6 AM". */
  long: string[]
}

/** The axis's marks: midnight, 6 AM, noon, 6 PM, midnight. */
export const COVERAGE_TICKS: readonly CoverageTick[] = [
  { at: 0, words: 'midnight' },
  { at: 6 * 60, words: '6 AM' },
  { at: 12 * 60, words: 'noon' },
  { at: 18 * 60, words: '6 PM' },
  { at: DAY, words: 'midnight' },
]

/** Where the Push me hours are set: one's own on Your account, another's by them alone, so their desk. */
export const PUSH_HOURS_DOOR = '/settings?tab=settings-account#settings-push-hours'

const firstName = (name: string): string => name.trim().split(/\s+/)[0] || name.trim()

/** The row's door: your own hours, or the person's desk, where their number is. */
export function coverageDoor(row: { id: string | null; short: string; mine: boolean }, here = '/settings?tab=settings-phone-texts'): CoverageDoor | null {
  if (row.mine) return { to: PUSH_HOURS_DOOR, words: 'You: open your Push me hours.' }
  if (!row.id) return null
  return { to: `${here}&person=u:${row.id}`, words: `${row.short}: open their desk. Only ${row.short} can set their hours.` }
}

function columnWords(start: number, end: number): string {
  if (start <= 0 && end >= DAY) return 'all day'
  if (start <= 0) return `to ${axisClock(end)}`
  if (end >= DAY) return `from ${axisClock(start)}`
  return `${axisClock(start)} to ${axisClock(end)}`
}

/** The stretches of [0, DAY] no bar covers. */
function uncovered(bars: readonly CoverageBar[]): CoverageColumn[] {
  const sorted = [...bars].sort((a, b) => a.start - b.start)
  const out: CoverageColumn[] = []
  let cursor = 0
  for (const b of sorted) {
    if (b.start > cursor) out.push({ start: cursor, end: b.start, words: columnWords(cursor, b.start) })
    cursor = Math.max(cursor, b.end)
  }
  if (cursor < DAY) out.push({ start: cursor, end: DAY, words: columnWords(cursor, DAY) })
  return out
}

/**
 * The grid, or null when there is nothing to draw: no gap, which is when the line is null too. A day nobody covers
 * at all is no panel; the chip for its stretch says it.
 */
export function coverageGrid(members: ReadonlyArray<CoverageMember>, meId: string | null = null, here?: string): CoverageGrid | null {
  const gaps = coverageGaps(members)
  if (gaps.length === 0) return null
  const bar = (m: CoverageMember, day: number): CoverageBar | null => {
    if (!m.hours || !m.hours.days.includes(day)) return null
    const start = minutesOf(m.hours.opens)
    const end = minutesOf(m.hours.closes)
    if (start === null || end === null || start >= end) return null
    return { start, end, words: `${axisClock(start)} to ${axisClock(end)}` }
  }
  const signature = (day: number): string => members.map((m) => bar(m, day)).map((b) => (b ? `${b.start}-${b.end}` : 'off')).join('|')
  const groups = new Map<string, number[]>()
  for (let day = 0; day < 7; day++) {
    const key = signature(day)
    groups.set(key, [...(groups.get(key) ?? []), day])
  }
  const panels: CoveragePanel[] = []
  for (const days of groups.values()) {
    const day = days[0]!
    const rows: CoverageRow[] = members.map((m) => {
      const short = firstName(m.name)
      const id = m.id ?? null
      const mine = !!meId && id === meId
      return { id, name: m.name, short, mine, bar: bar(m, day), door: coverageDoor({ id, short, mine }, here) }
    })
    if (rows.every((r) => r.bar === null)) continue
    panels.push({ label: daysWords(days), days, rows, gaps: uncovered(rows.flatMap((r) => (r.bar ? [r.bar] : []))) })
  }
  // The panels in the week's order: Sunday's panel first, as `daysWords` names them.
  panels.sort((a, b) => a.days[0]! - b.days[0]!)
  const long = gaps.filter((g) => g.end - g.start >= DAY).map((g) => `${dayClock(g.start)} to ${dayClock(g.end)}`)
  return { panels, ticks: [...COVERAGE_TICKS], long }
}
