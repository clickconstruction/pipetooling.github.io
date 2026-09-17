/**
 * The Settings rail (v2.3539 — owner pick A from the 2026-09-16 header mock-ups): the page's
 * groups as one vertical list beside the setting, search on top, the last tabs you opened as
 * chips, and a plain note when the role hides tabs. Pure helpers; the component reads and writes
 * localStorage through a Storage-like object so this stays testable.
 */
import type { UserRole } from '../hooks/useAuth'
import { getZonedSettingsGroups, type SettingsGroupDef } from './settingsGroups'

export const SETTINGS_RECENT_TABS_KEY = 'settings_recent_tabs_v1'
export const SETTINGS_RECENT_MAX = 3

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

/** The last tabs opened on this device, newest first, only ids this role can see. */
export function readRecentTabs(storage: StorageLike | null | undefined, visible: readonly SettingsGroupDef[]): string[] {
  try {
    const raw = storage?.getItem(SETTINGS_RECENT_TABS_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    const ids = new Set(visible.map((g) => g.id))
    return parsed.filter((v): v is string => typeof v === 'string' && ids.has(v)).slice(0, SETTINGS_RECENT_MAX)
  } catch {
    return []
  }
}

/** Newest first, no duplicates, capped. Pure. */
export function pushRecentTab(recent: readonly string[], id: string, max = SETTINGS_RECENT_MAX): string[] {
  return [id, ...recent.filter((r) => r !== id)].slice(0, max)
}

export function rememberTab(storage: StorageLike | null | undefined, recent: readonly string[], id: string): string[] {
  const next = pushRecentTab(recent, id)
  try {
    storage?.setItem(SETTINGS_RECENT_TABS_KEY, JSON.stringify(next))
  } catch {
    /* private mode, blocked storage — the chips just do not persist */
  }
  return next
}

/** Where to land when the URL names no tab: the last one opened here, else the first the role sees. */
export function landingTab(visible: readonly SettingsGroupDef[], recent: readonly string[]): string | null {
  const first = visible[0]?.id ?? null
  const last = recent[0]
  return last && visible.some((g) => g.id === last) ? last : first
}

/** How many tabs a dev would see that this role does not — the honest replacement for "Your role: X". */
export function hiddenTabsCount(role: UserRole | null): number {
  if (role == null) return 0
  return Math.max(0, getZonedSettingsGroups('dev').length - getZonedSettingsGroups(role).length)
}

export function hiddenTabsNote(count: number): string | null {
  if (count <= 0) return null
  return `${count} more ${count === 1 ? 'tab is' : 'tabs are'} for masters and devs.`
}

/** The chips under search: recent tabs other than the one already open. */
export function recentChips(recent: readonly string[], activeId: string, visible: readonly SettingsGroupDef[]): SettingsGroupDef[] {
  return recent
    .filter((id) => id !== activeId)
    .map((id) => visible.find((g) => g.id === id))
    .filter((g): g is SettingsGroupDef => Boolean(g))
}
