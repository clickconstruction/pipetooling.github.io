import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { formatDayLabel, formatMarkTime, isWorkdayYmd, addDaysYmd } from './markHistory'
import type { MarkOutcome } from './markOutcome'

/**
 * The round's close sheet (punch list #176, change 5). *Round done ✓ · Every group has been
 * looked at today* was true after a six-minute stamp pass and said nothing of what was still
 * open. The sheet reads the day's mark events, with the outcome each press wrote (change 1),
 * and says what is clean, what was worked and is still open, and what was handed up as a
 * question. The Dashboard's **The office's round** card draws a week of the same sheets
 * (`officeRoundWeek`), so the owner sees the round ran without opening Quickfill, and sees a
 * missed day as a hole. Nothing new on the server: the events are the record. Pure.
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

/** A missed round turns the card red from this many workdays in a row. Fewer are amber. */
export const ROUND_RED_FROM_WORKDAYS = 3
/** The workdays the card draws before today. */
export const ROUND_WEEK_PAST_DAYS = 5

export type RoundWeekCell = {
  ymd: string
  /**
   * `ran`: a station was marked that day. `missed`: a workday with no mark. `today`: today, whatever it holds.
   * `off`: today on a weekend with no mark, when no round is due.
   */
  kind: 'ran' | 'missed' | 'today' | 'off'
  /** Stations marked that day. */
  looked: number
  /** Whoever pressed most that day. */
  who: string | null
  /** The bar's height, 0 to 1: this day's stations against the most looked at on any day drawn. */
  fill: number
}

/** What a round left: today's once it has started, else the last one that ran among the days drawn. */
export type RoundWeekLeft = { ymd: string; today: boolean; at: string | null; open: RoundCloseLine[]; questions: RoundCloseLine[] }

export type OfficeRoundWeek = {
  /** The last `ROUND_WEEK_PAST_DAYS` workdays, oldest first, then today. */
  cells: RoundWeekCell[]
  phase: 'not-started' | 'started' | 'weekend'
  /** Workdays with no mark, counted back from the last workday. It stops at the days drawn. */
  missedInARow: number
  tone: 'quiet' | 'amber' | 'red' | 'green'
  left: RoundWeekLeft | null
}

/**
 * The Dashboard card as a week (punch list #424): one cell a workday, so a round is a thing a person sees and a
 * missed day is a hole, said once. The card had a red chip, a grey line and a sentence that each said the miss, and
 * never said what a round is. A round holds the stations due that day, each on its own rhythm (`round.ts`), so a day
 * has no fixed count to be measured against: a bar's height is that day against the fullest day drawn, and the
 * number under it is the fact. One missed workday is amber and `ROUND_RED_FROM_WORKDAYS` in a row are red, where one
 * was red before. Whether today's round is finished is Quickfill's to say: the card reads marks, not the queue.
 */
export function officeRoundWeek(events: ReadonlyArray<RoundCloseEvent>, todayYmd: string, label: (sectionId: string) => string): OfficeRoundWeek {
  const days: string[] = []
  let d = todayYmd
  for (let i = 0; i < ROUND_WEEK_PAST_DAYS; i++) {
    d = previousWorkdayYmd(d)
    days.unshift(d)
  }
  const past = days.map((ymd) => roundCloseSheet(events, ymd, label))
  const today = roundCloseSheet(events, todayYmd, label)
  const started = today.stations > 0
  const weekend = !isWorkdayYmd(todayYmd)
  const most = Math.max(today.stations, ...past.map((s) => s.stations))
  const fill = (n: number) => (most > 0 ? n / most : 0)
  const cells: RoundWeekCell[] = past.map((s) => ({ ymd: s.ymd, kind: s.stations > 0 ? 'ran' : 'missed', looked: s.stations, who: s.who, fill: fill(s.stations) }))
  cells.push({ ymd: todayYmd, kind: !started && weekend ? 'off' : 'today', looked: today.stations, who: today.who, fill: fill(today.stations) })
  let missedInARow = 0
  for (let i = past.length - 1; i >= 0 && past[i]!.stations === 0; i--) missedInARow++
  const last = started ? today : ([...past].reverse().find((s) => s.stations > 0) ?? null)
  const left = last ? { ymd: last.ymd, today: started, at: last.at, open: last.open, questions: last.questions } : null
  const tone = started ? 'green' : missedInARow >= ROUND_RED_FROM_WORKDAYS ? 'red' : missedInARow > 0 ? 'amber' : 'quiet'
  return { cells, phase: started ? 'started' : weekend ? 'weekend' : 'not-started', missedInARow, tone, left }
}

function weekdayShort(ymd: string): string {
  return formatDayLabel(ymd).split(',')[0] ?? ymd
}

/** A cell's head: *Mon 9*, *Today*, or the weekday on a weekend with no round due. */
export function roundCellDay(cell: Pick<RoundWeekCell, 'ymd' | 'kind'>): string {
  if (cell.kind === 'today') return 'Today'
  if (cell.kind === 'off') return weekdayShort(cell.ymd)
  return `${weekdayShort(cell.ymd)} ${Number(cell.ymd.slice(8, 10))}`
}

/** The fixed words of the card. Every value beside them is drawn apart, in bold. */
export const ROUND_WEEK_WORDS = {
  /** The one line that says what a round is. */
  what: 'each workday on Quickfill',
  missed: 'missed',
  noneDue: 'none due',
  open: 'open',
  clean: 'clean',
  leftToday: 'Left open',
  start: 'Start the round',
  quickfill: 'Open Quickfill',
} as const

/** What a cell says in full, for a reader that cannot see the bar. */
export function roundCellTitle(cell: RoundWeekCell): string {
  const day = cell.kind === 'today' ? 'Today' : formatDayLabel(cell.ymd)
  if (cell.kind === 'missed') return `${day}: no round ran.`
  if (cell.kind === 'off') return `${day}: no round is due.`
  const stations = `${cell.looked} ${cell.looked === 1 ? 'station' : 'stations'} looked at`
  return `${day}: ${stations}${cell.who ? `, mostly by ${cell.who}` : ''}.`
}

/** The words before what a round left: *Left open* for today's, *Mon left* for an earlier one. */
export function roundLeftLabel(left: Pick<RoundWeekLeft, 'ymd' | 'today'>): string {
  return left.today ? ROUND_WEEK_WORDS.leftToday : `${weekdayShort(left.ymd)} left`
}

/**
 * The card's one press. Before today's first mark it starts the round, on the station `roundStartStation` picks.
 * Once a station is marked, or on a weekend that owes no round, it opens Quickfill and claims nothing.
 */
export function roundWeekPress(week: Pick<OfficeRoundWeek, 'phase' | 'missedInARow'>): 'start' | 'quickfill' {
  if (week.phase === 'started') return 'quickfill'
  if (week.phase === 'weekend' && week.missedInARow === 0) return 'quickfill'
  return 'start'
}

export type RoundStart = { sectionId: string; label: string; lastYmd: string | null }

/**
 * The station today's round starts on (the health rule, 2026-11-01): of the stations marked at all in
 * the events read, the one marked longest ago, the round's order breaking a tie; with no mark on any,
 * the first station. The card names it and its press opens it, so a missed round ends in a press, not
 * in *The stations wait on Quickfill.* `stations` is the round's list in order, personal ones left out.
 */
export function roundStartStation(events: ReadonlyArray<RoundCloseEvent>, stations: ReadonlyArray<{ sectionId: string; label: string }>): RoundStart | null {
  const first = stations[0]
  if (!first) return null
  const lastYmd = new Map<string, string>()
  for (const e of events) {
    const d = calendarYmdInAppTzFromIso(e.marked_at)
    if (!d) continue
    const cur = lastYmd.get(e.section_id)
    if (!cur || d > cur) lastYmd.set(e.section_id, d)
  }
  let best: RoundStart | null = null
  for (const s of stations) {
    const d = lastYmd.get(s.sectionId)
    if (!d) continue
    if (!best || d < (best.lastYmd ?? '')) best = { sectionId: s.sectionId, label: s.label, lastYmd: d }
  }
  return best ?? { sectionId: first.sectionId, label: first.label, lastYmd: null }
}
