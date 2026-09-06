import { ageLabel } from './ageState'

/**
 * Past this, a stopwatch stops being a stopwatch (journey-map Tier-2 #40 /
 * C60, J3-4): "Waiting 282:59:39" is a number nobody reads; "12 days" is. The
 * live count-up stays for the one place someone is actually watching the clock
 * — the field's Collect Payment modal, which passes `liveCountUp: true`.
 */
export const HUMANIZE_ELAPSED_AFTER_MS = 48 * 3_600_000

export type ElapsedFormatOptions = {
  /** Keep `h:mm:ss` forever (the modal a tech is standing in front of). Default: humanize past 48 h. */
  liveCountUp?: boolean
}

/** Count-up duration: `m:ss` under one hour, else `h:mm:ss`; from 48 h, "2 days" … unless `liveCountUp`. */
export function formatElapsedCountUp(elapsedMs: number, opts: ElapsedFormatOptions = {}): string {
  if (!opts.liveCountUp && elapsedMs >= HUMANIZE_ELAPSED_AFTER_MS) {
    return ageLabel(Math.floor(elapsedMs / 86_400_000), '').trimEnd()
  }
  const s = Math.floor(elapsedMs / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }
  return `${m}:${String(sec).padStart(2, '0')}`
}

/** Elapsed since `certified_at` ISO; `—` if missing or invalid. */
export function formatWaitingLabelFromCertifiedAt(
  nowMs: number,
  certifiedAt: string | null | undefined,
  opts: ElapsedFormatOptions = {},
): string {
  if (certifiedAt == null || certifiedAt === '') return '—'
  const t = Date.parse(certifiedAt)
  if (Number.isNaN(t)) return '—'
  return formatElapsedCountUp(Math.max(0, nowMs - t), opts)
}
