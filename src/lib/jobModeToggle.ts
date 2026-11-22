/**
 * Per-user, per-device toggle for the Dashboard Job Mode card — with a
 * role-level default (journey-map Tier-2 #26, J2-F2 / J24-F7).
 *
 * Before this kernel had a role input, an absent key meant OFF for everyone, so
 * every new or wiped phone hid the tech's best screen behind a gear-menu
 * checkbox. Now:
 *
 * - absent key ⇒ ON for sub-like roles (subcontractor, helpers), OFF otherwise;
 * - an explicit stored value always wins (the tech can turn a default-on off —
 *   which is why "off" is now stored as `'0'` instead of removing the key);
 * - roles that cannot use Job Mode at all (`canLeaveJobFieldReport` false) read
 *   OFF regardless of what the device has stored.
 * - under the new phone layout (`lib/phoneLayout/newPhoneLayout.ts`, a phone's width
 *   with the device's tick on) an absent key is ON for a master technician and a
 *   superintendent too: Job Mode is the phone's home for the people who lead a job.
 *   A stored value still wins, so a person who turned it off stays off, and the
 *   first-run card is not drawn where Job Mode is already on.
 *
 * Storage uses one key per user so a shared device with multiple accounts
 * doesn't leak the toggle. Mirrors the lightweight pattern from
 * `dashboardClockStripScopeStorage.ts`.
 */

import type { UserRole } from '../hooks/useAuth'
import { canLeaveJobFieldReport } from './canLeaveJobFieldReport'
import { isSubcontractorLikeRole } from './subcontractorLikeRole'

const PREFIX = 'dashboard_job_mode'
const CARD_DISMISSED_PREFIX = 'dashboard_job_mode_card_dismissed'

/** Same-tab change signal: `storage` events only fire in OTHER tabs, so the
 * gear-menu toggle dispatches this for hook instances in the same tab
 * (e.g. the Dashboard's) to re-read. */
export const JOB_MODE_CHANGED_EVENT = 'dashboard_job_mode_changed'

/** Where an ON came from — the telemetry `source` and the stored provenance. */
export type JobModeSource = 'default' | 'card' | 'gear'

/**
 * What the device remembers for this user: `'1'` = turned on from the gear
 * menu (also the pre-v2 legacy on-value), `'card'` = turned on from the
 * first-run Dashboard card, `'0'` = explicitly turned off, `null` = never
 * touched (the role default applies).
 */
export type JobModeStoredValue = '1' | 'card' | '0' | null

export function jobModeStorageKey(userId: string): string {
  return `${PREFIX}_${userId}`
}

export function jobModeCardDismissedKey(userId: string): string {
  return `${CARD_DISMISSED_PREFIX}_${userId}`
}

/**
 * What the rule reads beside the role and the stored value. `newPhoneLayout` is `useNewPhoneLayout().on`:
 * the device's tick AND a phone's width, so it is never true at a desk. Left out, the rule answers as it
 * answered before the new phone layout.
 */
export interface JobModeRuleOptions {
  newPhoneLayout?: boolean
}

/** The roles that start in Job Mode on a phone under the new phone layout, beside the sub-like roles who start in it everywhere. */
export const JOB_MODE_PHONE_HOME_ROLES: readonly UserRole[] = ['master_technician', 'superintendent']

/** Pure: whether Job Mode is this role's home on a phone under the new phone layout. */
export function isJobModePhoneHomeRole(role: UserRole | string | null | undefined): boolean {
  return role != null && (JOB_MODE_PHONE_HOME_ROLES as readonly string[]).includes(role)
}

/** Pure: the role-level default when the device has no stored value. */
export function jobModeDefaultForRole(role: UserRole | string | null | undefined, opts?: JobModeRuleOptions): boolean {
  if (isSubcontractorLikeRole(role as UserRole | null | undefined)) return true
  return opts?.newPhoneLayout === true && isJobModePhoneHomeRole(role)
}

/** Pure: normalise whatever is in storage to the three values we understand. */
export function parseJobModeStoredValue(raw: string | null | undefined): JobModeStoredValue {
  if (raw === '1' || raw === 'card' || raw === '0') return raw
  return null
}

/**
 * Pure kernel: is Job Mode on for this role given what the device stored?
 * Stored value wins; absent ⇒ role default; ineligible roles ⇒ always off.
 */
export function isJobModeEnabled(
  role: UserRole | string | null | undefined,
  storedValue: JobModeStoredValue | string | null | undefined,
  opts?: JobModeRuleOptions,
): boolean {
  if (!canLeaveJobFieldReport(role)) return false
  const stored = parseJobModeStoredValue(storedValue)
  if (stored === '1' || stored === 'card') return true
  if (stored === '0') return false
  return jobModeDefaultForRole(role, opts)
}

/** Pure: which `source` an active Job Mode should report for this device state. */
export function jobModeActiveSource(storedValue: JobModeStoredValue | string | null | undefined): JobModeSource {
  const stored = parseJobModeStoredValue(storedValue)
  if (stored === 'card') return 'card'
  if (stored === '1') return 'gear'
  return 'default'
}

/**
 * Pure: should the Dashboard show the one-time "Working in the field? Turn on
 * Job Mode" card? Only for roles that CAN use Job Mode but default off and also
 * plausibly work in the field — master_technician and superintendent. Never for
 * sub-like roles (already on by default) and never for office roles. Never where
 * Job Mode is on by default for the role (the new phone layout): the card offers
 * what the person already has, and it would be drawn behind Show full dashboard.
 */
export function showJobModeFirstRunCard(
  role: UserRole | string | null | undefined,
  storedValue: JobModeStoredValue | string | null | undefined,
  dismissed: boolean,
  opts?: JobModeRuleOptions,
): boolean {
  if (dismissed) return false
  if (role !== 'master_technician' && role !== 'superintendent') return false
  if (!canLeaveJobFieldReport(role)) return false
  if (jobModeDefaultForRole(role, opts)) return false
  return parseJobModeStoredValue(storedValue) === null
}

export function readJobModeStoredValue(userId: string | null | undefined): JobModeStoredValue {
  if (!userId) return null
  try {
    if (typeof localStorage === 'undefined') return null
    return parseJobModeStoredValue(localStorage.getItem(jobModeStorageKey(userId)))
  } catch {
    return null
  }
}

export function readJobModeEnabled(
  userId: string | null | undefined,
  role: UserRole | string | null | undefined,
  opts?: JobModeRuleOptions,
): boolean {
  if (!userId) return false
  return isJobModeEnabled(role, readJobModeStoredValue(userId), opts)
}

/**
 * Persist the toggle. `enabled: false` is stored as `'0'` (not removed) so a
 * sub-like user's explicit "off" survives the role default. `source` records
 * which door turned it on (defaults to the gear menu).
 */
export function writeJobModeEnabled(
  userId: string | null | undefined,
  enabled: boolean,
  source: Exclude<JobModeSource, 'default'> = 'gear',
): void {
  if (!userId) return
  try {
    if (typeof localStorage === 'undefined') return
    if (enabled) {
      localStorage.setItem(jobModeStorageKey(userId), source === 'card' ? 'card' : '1')
    } else {
      localStorage.setItem(jobModeStorageKey(userId), '0')
    }
  } catch {
    // ignore
  }
}

export function readJobModeCardDismissed(userId: string | null | undefined): boolean {
  if (!userId) return false
  try {
    if (typeof localStorage === 'undefined') return false
    return localStorage.getItem(jobModeCardDismissedKey(userId)) === '1'
  } catch {
    return false
  }
}

export function writeJobModeCardDismissed(userId: string | null | undefined): void {
  if (!userId) return
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(jobModeCardDismissedKey(userId), '1')
  } catch {
    // ignore
  }
}
