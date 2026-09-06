/**
 * Stage windows (v2.2927): a job line item read as a stage of sub work, with
 * the span the office wants it done in. Pure helpers shared by the Subs tab,
 * the assembler prefill and (later) the sub's pick and the GC's ask.
 */

export type StageWindowLike = {
  id: string
  job_id: string
  fixture_id: string
  window_start: string | null
  window_end: string | null
  window_by: string | null
  note?: string | null
  /** v2.2933: offered to the GC; stages offered together share a bundle id. */
  offered_to_gc?: boolean | null
  bundle_id?: string | null
  /** v2.2934: the GC's ask and the office's answer. */
  asked_start?: string | null
  asked_end?: string | null
  asked_note?: string | null
  asked_at?: string | null
  answered_at?: string | null
  answer?: string | null
  answer_note?: string | null
}

export type StageWindowSpan = { start: string; end: string }

const YMD = /^\d{4}-\d{2}-\d{2}$/

/** `YYYY-MM-DD` → a UTC date at midnight (day math only, no TZ). */
function dayOf(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!))
}
function ymdOf(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Validate a span the office typed: both days present, well-formed, end not before start. */
export function stageWindowProblem(start: string, end: string): string | null {
  if (!YMD.test(start) || !YMD.test(end)) return 'Pick both days'
  if (end < start) return 'The end comes before the start'
  return null
}

/** Weekdays inside the span (Mon–Fri) — how many working days the window offers. */
export function stageWindowWeekdays(span: StageWindowSpan): number {
  let n = 0
  for (let d = dayOf(span.start); ymdOf(d) <= span.end; d.setUTCDate(d.getUTCDate() + 1)) {
    const w = d.getUTCDay()
    if (w !== 0 && w !== 6) n += 1
  }
  return n
}

/** Does `day` fall inside the span (inclusive)? */
export function dayInStageWindow(day: string, span: StageWindowSpan): boolean {
  return day >= span.start && day <= span.end
}

/** The span on a row, or null when either end is missing. */
export function stageWindowSpan(w: Pick<StageWindowLike, 'window_start' | 'window_end'> | null | undefined): StageWindowSpan | null {
  if (!w?.window_start || !w?.window_end) return null
  return { start: w.window_start, end: w.window_end }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function shortDay(ymd: string): string {
  const d = dayOf(ymd)
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`
}

/** "Sep 8 – Sep 19" (same day → "Sep 8"). */
export function stageWindowLabel(span: StageWindowSpan): string {
  return span.start === span.end ? shortDay(span.start) : `${shortDay(span.start)} – ${shortDay(span.end)}`
}

/** Who set it, in the row's words. */
export function stageWindowByLabel(by: string | null | undefined): string {
  return by === 'gc' ? 'as the GC asked' : 'set by the office'
}

/**
 * Where a window sits against today: `past` (ended), `open` (today inside),
 * `ahead` (starts later). Drives the row's tone.
 */
export function stageWindowPhase(span: StageWindowSpan, todayYmd: string): 'past' | 'open' | 'ahead' {
  if (span.end < todayYmd) return 'past'
  if (span.start > todayYmd) return 'ahead'
  return 'open'
}

/** The next weekday on or after `ymd` — a default start that never lands on a weekend. */
export function nextWeekdayOnOrAfter(ymd: string): string {
  const d = dayOf(ymd)
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1)
  return ymdOf(d)
}

/** `days` weekdays after `start` inclusive → the end day (a 2-day job starting Monday ends Tuesday). */
export function endAfterWeekdays(start: string, days: number): string {
  const d = dayOf(start)
  let left = Math.max(1, Math.floor(days)) - 1
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1)
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) left -= 1
  }
  return ymdOf(d)
}

/** A sensible default span when the office opens the editor: next Monday-ish, two weeks wide. */
export function defaultStageWindow(todayYmd: string): StageWindowSpan {
  const start = nextWeekdayOnOrAfter(todayYmd)
  return { start, end: endAfterWeekdays(start, 10) }
}
