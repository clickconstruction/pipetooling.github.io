/**
 * Sub picks (v2.2928): the sub chooses a start inside the span the office
 * offered. Pure day math shared by the submit function (the gate) and the
 * portal (the calendar) — no Deno, no DOM, no dates in local time. Tested from
 * src/lib/subPortal/subPick.test.ts.
 */

export type PickSpan = { start: string; end: string }

const YMD = /^\d{4}-\d{2}-\d{2}$/

function dayOf(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!))
}
function ymdOf(d: Date): string {
  return d.toISOString().slice(0, 10)
}
export function isWeekendYmd(ymd: string): boolean {
  const w = dayOf(ymd).getUTCDay()
  return w === 0 || w === 6
}
export function addDays(ymd: string, n: number): string {
  const d = dayOf(ymd)
  d.setUTCDate(d.getUTCDate() + n)
  return ymdOf(d)
}

/** `workDays` weekdays starting on `start` (inclusive) → the last day. Weekends are skipped. */
export function pickEndFromStart(start: string, workDays: number | null | undefined): string {
  const days = Math.max(1, Math.floor(Number(workDays) || 1))
  const d = dayOf(start)
  let left = days - 1
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1)
    const w = d.getUTCDay()
    if (w !== 0 && w !== 6) left -= 1
  }
  return ymdOf(d)
}

/**
 * The span a sub may pick inside: the stage's window when the order carries
 * one, else the span the office typed on the order. Null = nothing to pick
 * against (an undated order — the old "sign, we'll call you" flow).
 */
export function pickWindowFor(input: {
  window_start?: string | null
  window_end?: string | null
  proposed_start?: string | null
  proposed_end?: string | null
}): PickSpan | null {
  const ws = (input.window_start ?? '').trim(), we = (input.window_end ?? '').trim()
  if (YMD.test(ws) && YMD.test(we) && we >= ws) return { start: ws, end: we }
  const ps = (input.proposed_start ?? '').trim(), pe = (input.proposed_end ?? '').trim()
  if (YMD.test(ps) && YMD.test(pe) && pe >= ps) return { start: ps, end: pe }
  return null
}

export type PickVerdict =
  | { ok: true; start: string; end: string }
  | { ok: false; reason: 'malformed' | 'order' | 'weekend' | 'past' | 'outside' }

/**
 * Is this pick allowed? Well-formed, end not before start, a weekday start,
 * not behind today, and (when there is a window) inside it. Pure.
 */
export function evaluatePick(args: { window: PickSpan | null; start: string; end: string; todayYmd: string }): PickVerdict {
  const { window, start, end, todayYmd } = args
  if (!YMD.test(start) || !YMD.test(end)) return { ok: false, reason: 'malformed' }
  if (end < start) return { ok: false, reason: 'order' }
  if (isWeekendYmd(start)) return { ok: false, reason: 'weekend' }
  if (start < todayYmd) return { ok: false, reason: 'past' }
  if (window && (start < window.start || end > window.end)) return { ok: false, reason: 'outside' }
  return { ok: true, start, end }
}

/** The last day a sub may move their own pick: the day before it starts. */
export function pickChangeDeadline(pickedStart: string): string {
  return addDays(pickedStart, -1)
}
export function canChangePick(pickedStart: string | null | undefined, todayYmd: string): boolean {
  if (!pickedStart || !YMD.test(pickedStart)) return false
  return todayYmd <= pickChangeDeadline(pickedStart)
}

/** Weekdays a window offers as start days for a job of `workDays` (the end must fit too). */
export function pickableStarts(window: PickSpan, workDays: number | null | undefined, todayYmd: string): string[] {
  const out: string[] = []
  for (let d = window.start; d <= window.end; d = addDays(d, 1)) {
    if (isWeekendYmd(d) || d < todayYmd) continue
    if (pickEndFromStart(d, workDays) > window.end) break
    out.push(d)
  }
  return out
}

/** The office's words for a refused pick. */
export function pickProblemMessage(reason: Exclude<PickVerdict, { ok: true }>['reason']): string {
  switch (reason) {
    case 'outside':
      return "Those days fall outside the window we offered. Pick a start inside it, or tell us you can't do any of these days."
    case 'past':
      return 'That start day is already behind us. Pick a day from today on.'
    case 'weekend':
      return 'Pick a weekday to start.'
    case 'order':
      return 'The end comes before the start.'
    default:
      return 'Pick a start day.'
  }
}
