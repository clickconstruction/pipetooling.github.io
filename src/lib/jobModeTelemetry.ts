/**
 * `job_mode_enabled{source}` telemetry (journey-map Tier-2 #26 — "nothing
 * instruments the tech's day today").
 *
 * One `ui_nav_clicks` row per session with control `job_mode_enabled` and
 * target `#default` / `#card` / `#gear`, written by whichever happens first:
 * the Dashboard's first render with Job Mode active (source = what the device
 * stored, see `jobModeActiveSource`), the first-run card tap (`card`), or the
 * gear-menu turn-on (`gear`). A sessionStorage guard keeps it to one row per
 * user per browser session so a tap followed by the Dashboard remount is not
 * counted twice. Fire-and-forget like every other nav click.
 */

import { recordNavClick } from './navClickTelemetry'
import type { JobModeSource } from './jobModeToggle'

export const JOB_MODE_ENABLED_CONTROL = 'job_mode_enabled'

const SESSION_PREFIX = 'job_mode_enabled_recorded'

function sessionKey(userId: string): string {
  return `${SESSION_PREFIX}_${userId}`
}

/** Pure-ish: has this session already recorded a `job_mode_enabled` row for the user? */
export function jobModeEnabledRecordedThisSession(userId: string | null | undefined): boolean {
  if (!userId) return true
  try {
    if (typeof sessionStorage === 'undefined') return false
    return sessionStorage.getItem(sessionKey(userId)) === '1'
  } catch {
    return false
  }
}

function markRecorded(userId: string): void {
  try {
    if (typeof sessionStorage === 'undefined') return
    sessionStorage.setItem(sessionKey(userId), '1')
  } catch {
    // ignore
  }
}

/**
 * Record `job_mode_enabled{source}` once per session. Returns true when a row
 * was written (useful in tests); false when skipped.
 */
export function recordJobModeEnabledOncePerSession(
  userId: string | null | undefined,
  role: string | null,
  source: JobModeSource,
): boolean {
  if (!userId) return false
  if (jobModeEnabledRecordedThisSession(userId)) return false
  markRecorded(userId)
  recordNavClick(userId, role, JOB_MODE_ENABLED_CONTROL, `#${source}`)
  return true
}
