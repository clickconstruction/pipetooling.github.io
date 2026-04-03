import { fromDatetimeLocal, toDatetimeLocal } from '../utils/datetimeLocal'

/** Datetime-local string for the default clock-out row in ForceClockOutModal. */
export function defaultClockOutLocal(clockedInIso: string): string {
  const inMs = new Date(clockedInIso).getTime()
  const nowMs = Date.now()
  const outMs = Math.max(nowMs, inMs + 60_000)
  return toDatetimeLocal(new Date(outMs).toISOString())
}

/**
 * ISO timestamp for `clock_sessions.clocked_out_at` when force-closing with the same
 * default as ForceClockOutModal, clamped so the value is strictly after clock-in and not after `Date.now()`
 * (batch NCNS pre-close must satisfy the same rules as ForceClockOutModal submit).
 */
export function forceClockOutDefaultOutIso(clockedInAtIso: string): string {
  const inMs = new Date(clockedInAtIso).getTime()
  const nowMs = Date.now()
  const local = defaultClockOutLocal(clockedInAtIso)
  let outIso = fromDatetimeLocal(local)
  if (!outIso) outIso = new Date(nowMs).toISOString()
  let outMs = new Date(outIso).getTime()
  if (outMs > nowMs) {
    outMs = nowMs
    outIso = new Date(outMs).toISOString()
  }
  if (outMs <= inMs) {
    outMs = Math.min(nowMs, inMs + 60_000)
    if (outMs <= inMs) outMs = nowMs
    outIso = new Date(outMs).toISOString()
  }
  if (new Date(outIso).getTime() <= inMs) {
    outIso = new Date(Math.min(nowMs, inMs + 1)).toISOString()
  }
  return outIso
}
