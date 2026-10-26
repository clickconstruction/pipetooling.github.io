import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { formatMarkTime, isWorkdayYmd, addDaysYmd } from './markHistory'
import type { MarkOutcome } from './markOutcome'

/**
 * The round's close sheet (punch list #176, change 5). *Round done ✓ · Every group has been
 * looked at today* was true after a six-minute stamp pass and said nothing of what was still
 * open. The sheet reads the day's mark events, with the outcome each press wrote (change 1),
 * and says what is clean, what was worked and is still open, and what was handed up as a
 * question. The same sheet is the Dashboard's **The office's round** card, so the owner knows
 * the round ran without opening Quickfill, and learns of a missed day the morning after.
 * Nothing new on the server: the events are the record. Pure.
 */
export type RoundCloseEvent = {
  section_id: string
  marked_at: string
  outstanding_count: number | null
  outcome?: MarkOutcome | string | null
  marked_by_name?: string | null
}

export type RoundCloseLine = { sectionId: string; label: string; count: number | null }

export type RoundCloseSheet = {
  /** The company day the sheet is for. */
  ymd: string
  /** The last mark's time, *9:51 AM*. */
  at: string | null
  /** The first mark's time. */
  startedAt: string | null
  /** Minutes from the first mark to the last. */
  minutes: number
  /** Whoever pressed most. */
  who: string | null
  /** Stations marked that day. */
  stations: number
  clean: RoundCloseLine[]
  /** Worked and still open, the biggest count first. */
  open: RoundCloseLine[]
  questions: RoundCloseLine[]
  /** Looks with no outcome (a station with no count, or a mark from before the outcome column). */
  looked: RoundCloseLine[]
}

function lastByStation(events: ReadonlyArray<RoundCloseEvent>): Map<string, RoundCloseEvent> {
  const out = new Map<string, RoundCloseEvent>()
  for (const e of [...events].sort((a, b) => a.marked_at.localeCompare(b.marked_at))) out.set(e.section_id, e)
  return out
}

/** The sheet for one company day, from that day's events (any order). `label` names a station; an unknown id is named by its id. */
export function roundCloseSheet(events: ReadonlyArray<RoundCloseEvent>, ymd: string, label: (sectionId: string) => string): RoundCloseSheet {
  const day = events.filter((e) => calendarYmdInAppTzFromIso(e.marked_at) === ymd)
  const sorted = [...day].sort((a, b) => a.marked_at.localeCompare(b.marked_at))
  const first = sorted[0] ?? null
  const last = sorted[sorted.length - 1] ?? null
  const who = (() => {
    const counts = new Map<string, number>()
    for (const e of day) {
      const n = (e.marked_by_name ?? '').trim()
      if (n) counts.set(n, (counts.get(n) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null
  })()
  const clean: RoundCloseLine[] = []
  const open: RoundCloseLine[] = []
  const questions: RoundCloseLine[] = []
  const looked: RoundCloseLine[] = []
  for (const [sectionId, e] of lastByStation(day)) {
    const line = { sectionId, label: label(sectionId), count: e.outstanding_count }
    if (e.outcome === 'question') questions.push(line)
    else if (e.outcome === 'worked' || (e.outcome == null && typeof e.outstanding_count === 'number' && e.outstanding_count > 0)) open.push(line)
    else if (e.outcome === 'done' || (e.outcome == null && e.outstanding_count === 0)) clean.push(line)
    else looked.push(line)
  }
  open.sort((a, b) => (b.count ?? 0) - (a.count ?? 0) || a.label.localeCompare(b.label))
  const minutes = first && last ? Math.max(0, Math.round((Date.parse(last.marked_at) - Date.parse(first.marked_at)) / 60_000)) : 0
  return {
    ymd,
    at: last ? formatMarkTime(last.marked_at) : null,
    startedAt: first ? formatMarkTime(first.marked_at) : null,
    minutes,
    who,
    stations: clean.length + open.length + questions.length + looked.length,
    clean,
    open,
    questions,
    looked,
  }
}

/** The sheet's title: *Round done · 9:51 AM · 23 stations*. */
export function roundCloseTitle(sheet: RoundCloseSheet): string {
  return `Round done · ${sheet.at ?? ''} · ${sheet.stations} ${sheet.stations === 1 ? 'station' : 'stations'}`.replace(' ·  ·', ' ·')
}

/** The line under the title: *11 clean · 8 worked and still open · 2 questions for the owner · 1 looked*. */
export function roundCloseSummary(sheet: RoundCloseSheet): string {
  const parts: string[] = []
  parts.push(`${sheet.clean.length} clean`)
  if (sheet.open.length) parts.push(`${sheet.open.length} worked and still open`)
  if (sheet.questions.length) parts.push(`${sheet.questions.length} ${sheet.questions.length === 1 ? 'question' : 'questions'} for the owner`)
  if (sheet.looked.length) parts.push(`${sheet.looked.length} looked`)
  return parts.join(' · ')
}

/** The previous workday before `ymd`. */
export function previousWorkdayYmd(ymd: string): string {
  let d = addDaysYmd(ymd, -1)
  while (!isWorkdayYmd(d)) d = addDaysYmd(d, -1)
  return d
}

export type OfficeRoundState =
  | { kind: 'today'; sheet: RoundCloseSheet }
  | { kind: 'not-yet'; previous: RoundCloseSheet | null; previousYmd: string; weekend: boolean }
  | { kind: 'missed'; previousYmd: string; lastSheet: RoundCloseSheet | null; lastYmd: string | null }

/**
 * The Dashboard card's state: the round ran today (its sheet); no round yet today, with the
 * previous workday's sheet; or the previous workday had no marks at all (`missed`), with the
 * last day that had any. On a weekend with no marks the card reads *not yet* against Friday.
 */
export function officeRoundState(events: ReadonlyArray<RoundCloseEvent>, todayYmd: string, label: (sectionId: string) => string): OfficeRoundState {
  const today = roundCloseSheet(events, todayYmd, label)
  if (today.stations > 0) return { kind: 'today', sheet: today }
  const previousYmd = previousWorkdayYmd(todayYmd)
  const previous = roundCloseSheet(events, previousYmd, label)
  // On a Saturday or a Sunday no round is due (v2.5868): the card says the last one, not that one has not started.
  if (previous.stations > 0) return { kind: 'not-yet', previous, previousYmd, weekend: !isWorkdayYmd(todayYmd) }
  // The previous workday had no marks: find the last day that did.
  const days = [...new Set(events.map((e) => calendarYmdInAppTzFromIso(e.marked_at)).filter((d) => d && d < previousYmd))].sort()
  const lastYmd = days[days.length - 1] ?? null
  const lastSheet = lastYmd ? roundCloseSheet(events, lastYmd, label) : null
  // A weekend after a Friday with no marks still reads missed; a weekday with no round yet, against a marked Friday, reads not yet above.
  return { kind: 'missed', previousYmd, lastSheet, lastYmd }
}

/** *Today 9:51 AM · Dana · 8 still open · 2 questions* and the like, for the card's head. */
export function officeRoundHeadline(state: OfficeRoundState, dayLabel: (ymd: string) => string): string {
  if (state.kind === 'today') {
    const s = state.sheet
    const parts = [`Today ${s.at ?? ''}`.trim()]
    if (s.who) parts.push(s.who)
    parts.push(`${s.stations} ${s.stations === 1 ? 'station' : 'stations'}`)
    if (s.open.length) parts.push(`${s.open.length} still open`)
    if (s.questions.length) parts.push(`${s.questions.length} ${s.questions.length === 1 ? 'question' : 'questions'}`)
    return parts.join(' · ')
  }
  if (state.kind === 'not-yet') {
    const p = state.previous
    if (!p) return state.weekend ? '' : 'No round yet today'
    const last = `${dayLabel(state.previousYmd)} ${p.at ?? ''} · ${p.stations} stations · ${p.open.length} still open`
    return state.weekend ? `Last round ${last}` : `No round yet today · ${last}`
  }
  // The card's chip already says *No round Thursday*; the headline adds the last round that did run, or nothing.
  return state.lastSheet && state.lastYmd ? `Last round ${dayLabel(state.lastYmd)} ${state.lastSheet.at ?? ''} · ${state.lastSheet.stations} stations` : ''
}
