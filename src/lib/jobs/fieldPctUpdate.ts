/**
 * Field "% done" update rules (Dashboard My Schedule modal for subs/helpers).
 * The modal steps the percent with ±1/±5/±20 chips, previews the move from the
 * saved value, and saves through the set_job_pct_from_field RPC — which posts
 * the same "N% complete — <note>" thread note the Stages flows write, so the
 * day-delta layer (jobPctDayDelta.ts) and Job activity pick it up unchanged.
 */
import { effectivePctComplete } from './effectivePctComplete'

/** Stepper chips, render order. */
export const FIELD_PCT_STEPS = [-20, -5, -1, 1, 5, 20] as const

/** Clamp a stepped value into the 0–100 the RPC accepts. */
export function applyFieldPctStep(current: number, step: number): number {
  return Math.max(0, Math.min(100, Math.round(current + step)))
}

/**
 * The modal's starting value: the saved pct, or the same synthesized figure the
 * schedule cards show when it's null (100 for Paid in Full, else 0) — the
 * button and the modal must open on the number the card displays.
 *
 * effectivePctComplete's "never seed a % editor" rule targets blur-commit
 * inputs that would silently write the synthesized value back. This modal is
 * exempt by design: nothing saves without an explicit step + Save tap, and the
 * preview shows exactly what will be recorded ("0% → 20%").
 */
export function fieldPctStartValue(pct: number | null, status: string | null): number {
  return effectivePctComplete(pct, status)
}

/** "▲ 20" / "▼ 5" / "no change" plus the tone the preview line colors by. */
export function fieldPctDeltaLabel(base: number, next: number): {
  label: string
  tone: 'up' | 'down' | 'none'
} {
  const delta = next - base
  if (delta > 0) return { label: `▲ ${delta}`, tone: 'up' }
  if (delta < 0) return { label: `▼ ${-delta}`, tone: 'down' }
  return { label: 'no change', tone: 'none' }
}

/**
 * Whether a schedule block is over, in company-calendar terms: true once the
 * block's day is past, or it's today and the end time has passed. The card's
 * update button renders quiet (outline) all day and flips solid on completion
 * — crews who finish early can still report early.
 *
 * `nowYmd`/`nowHm` come from the caller pre-formatted in APP_CALENDAR_TZ
 * ("YYYY-MM-DD" / "HH:MM" 24h) so this stays pure. `timeEnd` is the block's
 * "HH:MM[:SS]" column; a missing/blank end never reads as ended.
 */
export function isScheduleBlockEnded(
  workDateYmd: string | null,
  timeEnd: string | null,
  nowYmd: string,
  nowHm: string,
): boolean {
  if (!workDateYmd) return false
  if (workDateYmd < nowYmd) return true
  if (workDateYmd > nowYmd) return false
  const end = (timeEnd ?? '').slice(0, 5)
  if (!/^\d{2}:\d{2}$/.test(end)) return false
  return end <= nowHm
}
