import type { UserRole } from '../hooks/useAuth'
import { canOpenPunchList } from './todos/punchListAccess'

/**
 * The Settings rail's doors (v2.4041): the two gear-menu items that moved into Settings —
 * **View as…** (dev only, opens the panel) and **Punch list** (dev + master, opens the page) —
 * drawn as a row of chips under the rail's search box, on every tab, desktop and phone. They
 * are doors, not tabs: each keeps its own gate and behaviour, and `/settings#view-as` opens
 * the panel from the address bar. `canOpenPunchList` stays the one place that decides the
 * Punch list's door.
 */
export type SettingsRailDoor = { id: 'view-as' | 'punch-list'; label: string; title: string }

export const SETTINGS_VIEW_AS_HASH = '#view-as'

export function settingsRailDoors(role: UserRole | null | undefined, opts: { impersonating: boolean }): SettingsRailDoor[] {
  const doors: SettingsRailDoor[] = []
  if (role === 'dev' && !opts.impersonating) {
    doors.push({ id: 'view-as', label: 'View as…', title: "View this page as a role's sample account or as a person — the real session; Exit brings you back here" })
  }
  if (canOpenPunchList(role)) {
    doors.push({ id: 'punch-list', label: 'Punch list', title: 'Punch list — the to-do board, rendered from the repo' })
  }
  return doors
}

/** `#view-as` (any case, with or without the `#`): the address-bar door to the View as panel. */
export function isSettingsViewAsHash(hash: string | null | undefined): boolean {
  return (hash ?? '').replace(/^#/, '').toLowerCase() === 'view-as'
}
