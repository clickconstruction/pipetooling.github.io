import type { UserRole } from '../hooks/useAuth'
import { canOpenPunchList, PUNCH_LIST_PATH } from './todos/punchListAccess'

/**
 * The Settings rail's doors (v2.4041, Job Parts Tally joined in v2.4061): the gear-menu items
 * that moved into Settings — **Job Parts Tally** (everyone, the page), **View as…** (dev only,
 * opens the panel) and **Punch list** (dev + master, the page) — drawn as a row of chips under
 * the rail's search box, on every tab, desktop and phone. They are doors, not tabs: each keeps
 * its own gate and behaviour. A door with a `to` is a link to that page; the one without opens
 * the View as panel, which `/settings#view-as` also opens from the address bar.
 * `canOpenPunchList` stays the one place that decides the Punch list's door.
 */
export type SettingsRailDoor = { id: 'tally' | 'view-as' | 'punch-list'; label: string; title: string; to?: string }

export const SETTINGS_VIEW_AS_HASH = '#view-as'
export const TALLY_PATH = '/tally'

export function settingsRailDoors(role: UserRole | null | undefined, opts: { impersonating: boolean }): SettingsRailDoor[] {
  if (role == null) return []
  const doors: SettingsRailDoor[] = [{ id: 'tally', label: 'Job Parts Tally', title: 'Job Parts Tally — sort card purchases to jobs and post the parts', to: TALLY_PATH }]
  if (role === 'dev' && !opts.impersonating) {
    doors.push({ id: 'view-as', label: 'View as…', title: "View this page as a role's sample account or as a person — the real session; Exit brings you back here" })
  }
  if (canOpenPunchList(role)) {
    doors.push({ id: 'punch-list', label: 'Punch list', title: 'Punch list — the to-do board, rendered from the repo', to: PUNCH_LIST_PATH })
  }
  return doors
}

/** `#view-as` (any case, with or without the `#`): the address-bar door to the View as panel. */
export function isSettingsViewAsHash(hash: string | null | undefined): boolean {
  return (hash ?? '').replace(/^#/, '').toLowerCase() === 'view-as'
}
