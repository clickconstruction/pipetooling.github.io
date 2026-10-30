/**
 * Punch list #141 PR 4: who is off, read from the people's **Push me** hours (`pushHours.ts`), for the two surfaces that
 * show it to the office. The thread's pill (`WhoHasItPill`) says when whoever has the reply is off, and when every
 * office member is: a push to them waits for their hours, and the office hears at once (v2.6029). The Office hours
 * card's coverage line says, while the office is open around the clock, the hours at which nobody in the office is
 * pushed: the company's switch says the office is open, the people's hours say whether anyone is, and the line is where
 * the two meet, the owner's to act on. Pure, and not mirrored: nothing on the edge reads it.
 */
import type { OfficeHours } from './hasRule'
import { DAY_SHORT, daysWords, timeWords } from './officeHoursCard'
import { backAt, backWords, type PushHoursByUser } from './pushHours'

// ---------- the thread's pill ----------

/** Who is off on a thread: whoever has the reply, or the whole office when nobody has it. */
export type ThreadOff =
  | { kind: 'holder'; mine: boolean; name: string; until: string }
  | { kind: 'office'; until: string }

/**
 * Who is off on this thread at `now`, or null when nobody is. With a holder, the holder's hours decide. With nobody,
 * the office is off only while every member is, and it is back when the first of them is. A person with no row is
 * never off.
 */
export function threadOff(input: {
  holderId: string | null
  /** The holder's name as the pill prints it. */
  holderName: string | null
  mine: boolean
  /** The office team, the viewer among them. */
  officeIds: readonly string[]
  hours: PushHoursByUser
  now: string
}): ThreadOff | null {
  if (input.holderId) {
    const back = backAt(input.now, input.hours.get(input.holderId) ?? null)
    if (!back) return null
    return { kind: 'holder', mine: input.mine, name: input.holderName?.trim() || 'A teammate', until: backWords(back, input.now) }
  }
  const ids = [...new Set(input.officeIds)]
  if (ids.length === 0) return null
  let soonest: string | null = null
  for (const id of ids) {
    const back = backAt(input.now, input.hours.get(id) ?? null)
    if (!back) return null
    if (soonest === null || Date.parse(back) < Date.parse(soonest)) soonest = back
  }
  return { kind: 'office', until: backWords(soonest!, input.now) }
}

/** What the pill adds after its words: "off until 6 AM", or "the office is off until 6 AM". */
export function offPillWords(off: ThreadOff): string {
  return off.kind === 'office' ? `the office is off until ${off.until}` : `off until ${off.until}`
}

/** The pill's hover when someone is off. */
export function offPillTip(off: ThreadOff): string {
  if (off.kind === 'office') {
    return `Everyone in the office is off until ${off.until}. The reply waits on Needs a reply. Each of them sees it on their Dashboard at ${off.until}.`
  }
  if (off.mine) return `You are off until ${off.until}, so a push waits for you. The office hears at once. Your Dashboard lists what waited.`
  return `${off.name} has the replies and is off until ${off.until}. The office hears at once. ${off.name} sees what waited on their Dashboard at ${off.until}.`
}

// ---------- the Office hours card's coverage line ----------

/** Someone in the office, with their hours: null is any time. */
export interface CoverageMember {
  name: string
  hours: OfficeHours | null
}

/** A stretch of the week when nobody in the office is pushed, in minutes from Sunday midnight; an `end` past the week wraps into Sunday. */
export interface CoverageGap {
  start: number
  end: number
}

const DAY = 24 * 60
const WEEK = 7 * DAY
const HM = /^([01]?\d|2[0-3]):([0-5]\d)$/

function minutesOf(hm: string): number | null {
  const m = HM.exec(hm.trim())
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

/**
 * When nobody in the office is pushed, over a week. Empty when anyone is pushed any time, or around the clock, or
 * when there is nobody to read, so the line draws only for a gap every member shares.
 */
export function coverageGaps(members: ReadonlyArray<CoverageMember>): CoverageGap[] {
  if (members.length === 0) return []
  const on: Array<[number, number]> = []
  for (const m of members) {
    if (!m.hours || m.hours.always) return []
    const opens = minutesOf(m.hours.opens)
    const closes = minutesOf(m.hours.closes)
    // A row the kernel could not read is any time (`parsePushHours`), so it never makes a gap.
    if (opens === null || closes === null || opens >= closes) return []
    for (const d of m.hours.days) on.push([d * DAY + opens, d * DAY + closes])
  }
  if (on.length === 0) return []
  on.sort((a, b) => a[0] - b[0])
  const merged: Array<[number, number]> = []
  for (const [s, e] of on) {
    const last = merged[merged.length - 1]
    if (last && s <= last[1]) last[1] = Math.max(last[1], e)
    else merged.push([s, e])
  }
  const gaps: CoverageGap[] = []
  let cursor = 0
  for (const [s, e] of merged) {
    if (s > cursor) gaps.push({ start: cursor, end: s })
    cursor = Math.max(cursor, e)
  }
  if (cursor < WEEK) gaps.push({ start: cursor, end: WEEK })
  // The week wraps: a gap that runs to Saturday midnight joins the one that starts Sunday midnight.
  if (gaps.length >= 2 && gaps[0]!.start === 0 && gaps[gaps.length - 1]!.end === WEEK) {
    const first = gaps.shift()!
    gaps[gaps.length - 1]!.end = WEEK + first.end
  }
  return gaps
}

/** "8 PM", "7:30 AM": a clock from minutes into a day. */
function clock(m: number): string {
  const inDay = ((m % DAY) + DAY) % DAY
  return timeWords(`${String(Math.floor(inDay / 60)).padStart(2, '0')}:${String(inDay % 60).padStart(2, '0')}`).replace(':00 ', ' ')
}

/** "Fri 8 PM": a day and a clock from minutes into the week, wrapping past Saturday. */
function dayClock(m: number): string {
  return `${DAY_SHORT[Math.floor(m / DAY) % 7]} ${clock(m)}`
}

/** "Rosa, Evan and Taunya are all off then.", "Rosa and Evan are both off then.", "Rosa is off then." */
export function offThenWords(names: readonly string[]): string {
  const first = names.map((n) => n.trim().split(/\s+/)[0] ?? '').filter(Boolean)
  if (first.length === 0) return ''
  if (first.length === 1) return `${first[0]} is off then.`
  if (first.length === 2) return `${first[0]} and ${first[1]} are both off then.`
  if (first.length > 6) return `All ${first.length} of the office are off then.`
  return `${first.slice(0, -1).join(', ')} and ${first[first.length - 1]} are all off then.`
}

/** `daysWords` capitalises its first word for the office card's own line; mid-sentence it drops the capital. */
const onDays = (days: readonly number[]): string => ` on ${daysWords(days).replace(/^Every day$/, 'every day')}`

/**
 * The coverage line, or null with no gap: *Nobody hears a reply from 11 PM to 6 AM. Rosa, Evan and Taunya are all off
 * then.* One sentence per shape of gap: a gap at the same clock every day reads once, *from 8 PM to 6 AM*; on some
 * days it names them, *from 8 PM to 6 AM on Mon to Thu*; a gap of a day or more names its ends, *from Fri 8 PM to Mon
 * 6 AM*, the weekend off.
 */
export function coverageLine(gaps: readonly CoverageGap[], names: readonly string[]): string | null {
  if (gaps.length === 0) return null
  const sameClock = new Map<string, { start: number; length: number; days: number[] }>()
  const long: CoverageGap[] = []
  for (const g of gaps) {
    const length = g.end - g.start
    if (length >= DAY) {
      long.push(g)
      continue
    }
    const key = `${g.start % DAY}:${length}`
    const got = sameClock.get(key) ?? { start: g.start % DAY, length, days: [] }
    got.days.push(Math.floor(g.start / DAY) % 7)
    sameClock.set(key, got)
  }
  const sentences: string[] = []
  for (const g of sameClock.values()) {
    const when = `from ${clock(g.start)} to ${clock(g.start + g.length)}`
    sentences.push(`Nobody hears a reply ${when}${g.days.length === 7 ? '' : onDays(g.days)}.`)
  }
  for (const g of long) sentences.push(`Nobody hears a reply from ${dayClock(g.start)} to ${dayClock(g.end)}.`)
  const who = offThenWords(names)
  if (who) sentences.push(who)
  return sentences.join(' ')
}
