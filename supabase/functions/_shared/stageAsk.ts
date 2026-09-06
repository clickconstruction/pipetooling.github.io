/**
 * The GC's ask (v2.2934). Pure — tested from src/lib/subs/stageAsk.test.ts.
 * The GC asks for a span on an offered stage; the office accepts it or
 * answers with its own span and a why; a new window that no longer fits the
 * sub's pick becomes a change request the sub answers from their portal.
 */

export type StageAskWindow = {
  window_start: string | null
  window_end: string | null
  asked_start: string | null
  asked_end: string | null
  asked_note: string | null
  asked_at: string | null
  answered_at: string | null
  answer: string | null
  answer_note: string | null
}

export type AskState = 'none' | 'open' | 'accepted' | 'proposed'

const YMD = /^\d{4}-\d{2}-\d{2}$/
const span = (a: string | null | undefined, b: string | null | undefined) => {
  const s = (a ?? '').trim(), e = (b ?? '').trim() || s
  return YMD.test(s) && YMD.test(e) && e >= s ? { start: s, end: e } : null
}

export function askState(w: StageAskWindow): AskState {
  if (!w.asked_at || !span(w.asked_start, w.asked_end)) return 'none'
  if (!w.answered_at) return 'open'
  return w.answer === 'accepted' ? 'accepted' : 'proposed'
}

/** Validate a GC ask: well-formed, end after start, not behind today, at most 120 days wide. */
export function askProblem(start: string, end: string, todayYmd: string): string | null {
  if (!YMD.test(start) || !YMD.test(end)) return 'Pick both days.'
  if (end < start) return 'The end comes before the start.'
  if (end < todayYmd) return 'Those days are already behind us.'
  const days = (Date.parse(end) - Date.parse(start)) / 86_400_000
  if (days > 120) return 'Ask for a span under four months.'
  return null
}

export type AskAnswer = { kind: 'accept' } | { kind: 'propose'; start: string; end: string; note: string }

/** The patch the office writes on the window(s) when answering. */
export function answerPatch(w: StageAskWindow, a: AskAnswer, nowIso: string): Record<string, unknown> {
  if (a.kind === 'accept') {
    const asked = span(w.asked_start, w.asked_end)
    return { window_start: asked?.start ?? w.window_start, window_end: asked?.end ?? w.window_end, window_by: 'gc', answered_at: nowIso, answer: 'accepted', answer_note: null }
  }
  return { window_start: a.start, window_end: a.end, window_by: 'office', answered_at: nowIso, answer: 'proposed', answer_note: a.note.trim() || null }
}

/** Does the sub's pick still sit inside the new window? A pick outside becomes a change request. */
export function pickStillFits(pick: { start: string; end: string } | null, window: { start: string; end: string } | null): boolean {
  if (!pick || !window) return true
  return pick.start >= window.start && pick.end <= window.end
}

/** The GC's line under a stage while an ask is in flight or answered. */
export function askLine(w: StageAskWindow, fmt: (ymd: string) => string): string | null {
  const st = askState(w)
  if (st === 'none') return null
  const asked = span(w.asked_start, w.asked_end)!
  const rng = (s: { start: string; end: string }) => (s.start === s.end ? fmt(s.start) : `${fmt(s.start)} – ${fmt(s.end)}`)
  if (st === 'open') return `You asked for ${rng(asked)} · waiting on the office`
  if (st === 'accepted') return `You asked for ${rng(asked)} · accepted`
  const win = span(w.window_start, w.window_end)
  return `You asked for ${rng(asked)} · the office answered ${win ? rng(win) : 'with other dates'}${w.answer_note ? ` — ${w.answer_note}` : ''}`
}
