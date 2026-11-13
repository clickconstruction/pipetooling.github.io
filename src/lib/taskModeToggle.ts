/**
 * Per-user, per-device toggle for Task Mode — the checklist-only lens: the day's tasks and nothing else.
 *
 * While on, Layout trims the nav to Checklist, redirects every other route
 * there, and the Checklist page shows only the Today + History tabs. Any role
 * may turn it on; it narrows what the device shows, never what RLS allows.
 *
 * Storage uses one key per user so a shared device with multiple accounts
 * doesn't leak the toggle. Mirrors `jobModeToggle.ts`.
 *
 * The mode was Farm Mode until v2.7050, named for the crew it was first built for. Three stored
 * names keep the old word on purpose: the saved key (`farm_mode_<user>`), so a device that has the
 * mode on keeps it on across the rename, the same-tab event, and the usage ledger's control, so the
 * old rows and the new ones count as one. Nobody reads any of the three on a screen.
 */

const PREFIX = 'farm_mode'

/** Same-tab change signal: `storage` events only fire in OTHER tabs, so the
 * gear-menu toggle dispatches this for hook instances in the same tab
 * (e.g. the Checklist page's) to re-read. */
export const TASK_MODE_CHANGED_EVENT = 'farm_mode_changed'

export function taskModeStorageKey(userId: string): string {
  return `${PREFIX}_${userId}`
}

/** The one page Task Mode shows. */
export const TASK_MODE_HOME = '/checklist'

/**
 * `ui_nav_clicks.control` for the on-page chip's Exit (journey-map Tier-2 #41):
 * before the chip, the only way out was knowing the toggle lives in the gear
 * menu, so nothing measured how often people got stuck in the mode.
 */
export const TASK_MODE_EXIT_CONTROL = 'farm_mode_exit'

/**
 * Where Task Mode lands a route it doesn't show — `null` when the path is
 * already the mode's page (no bounce). Pure; Layout's effect applies it.
 */
export function taskModeBounceTarget(pathname: string): string | null {
  const clean = pathname.replace(/\/+$/, '') || '/'
  return clean === TASK_MODE_HOME ? null : TASK_MODE_HOME
}

/** The chip's words. Short — it sits on a shared tablet, at the top of the daily list. */
export const TASK_MODE_CHIP_LABEL = 'Task Mode'
export const TASK_MODE_CHIP_EXIT_LABEL = 'Exit'
export const TASK_MODE_CHIP_TITLE =
  'Task Mode is on. This device shows only the checklist. Exit brings the full app back, the same as the gear menu.'

/**
 * The gear row's tip, and the phone dock's. It says what the mode is for before the press, since the
 * name alone does not say the rest of the app goes away.
 */
export function taskModeToggleTip(on: boolean): string {
  return on ? 'Turn Task Mode off. The full app comes back.' : 'Turn Task Mode on. This device shows only your checklist.'
}

export function readTaskModeEnabled(userId: string | null | undefined): boolean {
  if (!userId) return false
  try {
    if (typeof localStorage === 'undefined') return false
    return localStorage.getItem(taskModeStorageKey(userId)) === '1'
  } catch {
    return false
  }
}

export function writeTaskModeEnabled(userId: string | null | undefined, enabled: boolean): void {
  if (!userId) return
  try {
    if (typeof localStorage === 'undefined') return
    if (enabled) {
      localStorage.setItem(taskModeStorageKey(userId), '1')
    } else {
      localStorage.removeItem(taskModeStorageKey(userId))
    }
  } catch {
    // ignore
  }
}
