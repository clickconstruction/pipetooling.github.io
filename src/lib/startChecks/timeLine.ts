/**
 * Before we start (punch list #382, PR 11): the Schedule look on a line of time. One row a stage ahead: a bar for
 * our days in the stage's colour, a diamond on the day they say ready, a hollow diamond on each day they gave
 * before, a dotted line on the day we decide, a line on today, and the days they moved in red beside the row's marks,
 * never over one. Every place is a share of the span,
 * so a screen and a sheet of paper draw the same line. Each row also reads as one sentence, for a reader that
 * cannot see the line. Pure.
 */
import { addDays, byTrouble, countWords, daySpan, daysBetween, goNoGoDay, monthDay, movedDays, stageStanding, theirDay, type Light, type Site, type Stage } from './startChecks'

export type TimeLineRow = {
  id: string
  name: string
  /** The job's number, and its part of the site when the site has parts. */
  job: string
  light: Light
  /** Our days, as shares of the span from 0 to 100. Null while we have planned none. */
  bar: { from: number; to: number } | null
  /** The day they say ready now. */
  said: number | null
  /** Each day they gave before, oldest first. */
  before: number[]
  /** The day we decide. */
  decide: number | null
  moved: number
  /** Where the red *moved N days* is written, clear of every mark: after the last one, or before the first on a row that ends near the right edge. Null when nothing moved. */
  movedAt: { at: number; side: 'after' | 'before' } | null
  /** The row in words. */
  words: string
}
export type TimeLine = { first: string; last: string; today: number | null; ticks: Array<{ at: number; label: string }>; rows: TimeLineRow[] }

/** Past this share of the span a row's last mark leaves no room after it for the moved words, so they go before its first. */
export const TIME_LINE_MOVED_FLIPS_AT = 70

/** The shortest span a line is drawn over, so one short stage is not stretched across the page. */
export const TIME_LINE_MIN_DAYS = 21

export const TIME_LINE_WORDS = {
  show: 'Show it on a line of time',
  hide: 'Hide the line of time',
  legend: ['Our days', 'The day they say ready', 'A day they gave before', 'The day we decide', 'Today'],
  moved: (n: number) => `moved ${countWords(n, 'day', 'days')}`,
  print: 'Print the days they gave',
} as const

/** The stages ahead on one line, in the look's own order. Null when no stage ahead has a day to draw. */
export function timeLine(stages: readonly Stage[], site: Site, today: string): TimeLine | null {
  const ahead = byTrouble(stages, site, today)
  const days: string[] = []
  for (const s of ahead) {
    if (s.window) days.push(s.window[0], s.window[1])
    for (const d of s.theirDays) days.push(d.day)
    const decide = goNoGoDay(s, site)
    if (decide) days.push(decide)
  }
  if (!days.length) return null
  days.push(today)
  days.sort()
  let first = addDays(days[0] as string, -1)
  let last = addDays(days[days.length - 1] as string, 1)
  const short = TIME_LINE_MIN_DAYS - daysBetween(first, last)
  if (short > 0) last = addDays(last, short)
  // The line opens on a Monday, so the ticks fall on the same weekday down the page.
  first = addDays(first, -((new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7))
  const span = daysBetween(first, last)
  const at = (ymd: string): number => Math.round((daysBetween(first, ymd) / span) * 1000) / 10
  const step = Math.max(1, Math.ceil(span / 7 / 8)) * 7
  const ticks: TimeLine['ticks'] = []
  for (let d = first; d <= last; d = addDays(d, step)) ticks.push({ at: at(d), label: monthDay(d) })
  const rows = ahead.map((s): TimeLineRow => {
    const said = theirDay(s)
    const decide = goNoGoDay(s, site)
    const moved = movedDays(s)
    const job = [s.job, s.part].filter(Boolean).join(' · ')
    const words = [
      `${s.name}${job ? `, ${job}` : ''}: ${s.window ? daySpan(s.window[0], s.window[1]) : 'no days of ours yet'}.`,
      said ? `They say ready ${monthDay(said.day)}.` : 'They have given no day.',
      decide ? `We decide by ${monthDay(decide)}.` : '',
      moved ? `They have moved ${countWords(moved, 'day', 'days')}.` : '',
    ]
      .filter(Boolean)
      .join(' ')
    const bar = s.window ? { from: at(s.window[0]), to: at(addDays(s.window[1], 1)) } : null
    const marks = [...(bar ? [bar.from, bar.to] : []), ...s.theirDays.map((d) => at(d.day)), ...(decide ? [at(decide)] : [])]
    const lastMark = Math.max(...marks)
    return {
      id: s.id,
      name: s.name,
      job,
      light: stageStanding(s, site, today).light,
      bar,
      said: said ? at(said.day) : null,
      before: s.theirDays.slice(0, -1).map((d) => at(d.day)),
      decide: decide ? at(decide) : null,
      moved,
      movedAt: moved && marks.length ? (lastMark > TIME_LINE_MOVED_FLIPS_AT ? { at: Math.min(...marks), side: 'before' } : { at: lastMark, side: 'after' }) : null,
      words,
    }
  })
  return { first, last, today: at(today), ticks, rows }
}

// ---- the days they gave, on paper ------------------------------------------------------------------

/** One stage on the sheet: every day they gave for ready, oldest first, with who said it, how and when. */
export type MovedSheetStage = { id: string; name: string; job: string; ours: string; days: Array<{ ready: string; said: string; who: string; how: string; moved: number | null }>; moved: number }
export type MovedSheet = { stages: MovedSheetStage[]; total: number; line: string }

/** The record of the days they gave, for a sheet of paper: only the stages where they gave one. */
export function movedSheet(stages: readonly Stage[]): MovedSheet {
  const out: MovedSheetStage[] = []
  for (const s of stages) {
    if (!s.theirDays.length) continue
    out.push({
      id: s.id,
      name: s.name,
      job: [s.job, s.part].filter(Boolean).join(' · '),
      ours: s.window ? daySpan(s.window[0], s.window[1]) : 'no days yet',
      days: s.theirDays.map((d, i) => ({ ready: d.day, said: d.said, who: d.who, how: d.how, moved: i === 0 ? null : daysBetween((s.theirDays[i - 1] as { day: string }).day, d.day) })),
      moved: movedDays(s),
    })
  }
  const total = out.reduce((n, s) => n + s.moved, 0)
  const movedStages = out.filter((s) => s.moved > 0).length
  return { stages: out, total, line: total ? `${countWords(total, 'day', 'days')} moved across ${countWords(movedStages, 'stage', 'stages')}.` : 'No day has moved.' }
}
