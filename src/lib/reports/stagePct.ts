/**
 * The percent by stage with a precise number (punch list #189, PR 5a; the owner's word of
 * 2026-10-26: *make it easy for a user to specifically offer how far along things are*). One
 * control stands on every stage row of a field report and of the My Schedule stepper, and alone
 * for the job on a one-stage job: four quick picks at 48 px, a −5 and a +5 at 56 px around the
 * number, and the number itself typed on the phone's keypad. The steps and the clamps live here;
 * `StagePctControl` only draws what they return. Pure.
 */

/** A −5 / +5 press moves the number by this much. */
export const STAGE_PCT_STEP = 5

/** The quick picks on a stage row, in order; 100 reads as Done ✓. */
export const STAGE_QUICK_PICKS: readonly number[] = [25, 50, 75, 100]

/** A quick pick stands at least this tall: a thumb's press (the mock-up's 48 px). */
export const STAGE_QUICK_PICK_MIN_HEIGHT = 48
/** The −5 and +5 stand at least this tall: the two presses a tech makes most. */
export const STAGE_STEP_MIN_HEIGHT = 56

/** The control's words, one source for the rows, the sheet and the guides. */
export const STAGE_PCT_WORDS = {
  question: 'How far along is each stage?',
  notStarted: 'not started',
  done: 'Done ✓',
  minus: '−5',
  plus: '+5',
  typeHint: 'Tap the number to type one.',
  notNow: 'Not now',
} as const

/** 0..100, whole. */
export function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

/** The number after a −5 or +5 press: stepped and clamped, so 98 + 5 is 100 and 3 − 5 is 0. */
export function stepPct(current: number, delta: number): number {
  return clampPct(clampPct(current) + delta)
}

/**
 * The number a tech typed: digits only, clamped; null for nothing typed (a cleared box keeps the
 * row where it was). "45%" and " 45 " both read 45; "abc" reads null.
 */
export function typedPct(raw: string): number | null {
  const digits = raw.replace(/[^0-9]/g, '')
  if (!digits) return null
  return clampPct(Number.parseInt(digits, 10))
}

/** A quick pick's words: the number, or Done ✓ at 100. */
export function quickPickLabel(pct: number): string {
  return pct >= 100 ? STAGE_PCT_WORDS.done : String(pct)
}

/**
 * The Save press names what it writes: *Save · job 36%*, and the photos riding with it once the
 * camera lands (PR 5b): *Save · job 36% · 2 photos*. A report type that files no percent (a Note,
 * a Walk) names none, so `jobPct` is null there: *Save report*, *Save report · 1 photo* (v2.6126).
 */
export function saveWords(input: { jobPct: number | null; photos?: number }): string {
  const parts = [input.jobPct == null ? 'Save report' : `Save · job ${clampPct(input.jobPct)}%`]
  const n = input.photos ?? 0
  if (n === 1) parts.push('1 photo')
  else if (n > 1) parts.push(`${n} photos`)
  return parts.join(' · ')
}
