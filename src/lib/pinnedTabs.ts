/**
 * Pin tab to dashboard: storage and config for pinned routes (and optional tab).
 * Used by Layout (Pin bar) and Dashboard (pinned links section).
 */

import { supabase } from './supabase'

export type PinnedItem = { path: string; label: string; tab?: string }

export const PINNABLE_PATHS = [
  '/dashboard',
  '/customers',
  '/projects',
  '/people',
  '/jobs',
  '/calendar',
  '/templates',
  '/materials',
  '/duplicates',
  '/bids',
  '/checklist',
  '/settings',
] as const

export type PinnablePath = (typeof PINNABLE_PATHS)[number]

export const PATH_TO_LABEL: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/customers': 'Customers',
  '/projects': 'Projects',
  '/people': 'People',
  '/jobs': 'Jobs',
  '/calendar': 'Calendar',
  '/templates': 'Templates',
  '/materials': 'Materials',
  '/duplicates': 'Duplicates',
  '/bids': 'Bids',
  '/checklist': 'Checklist',
  '/settings': 'Settings',
}

/** Tab param values per path (for validation and storing tab when pinning). */
export const PATH_TABS: Record<string, readonly string[]> = {
  '/people': ['users', 'pay', 'hours'],
  '/jobs': ['labor', 'ledger', 'sub_sheet_ledger', 'upcoming', 'teams-summary'],
  '/bids': [
    'bid-board',
    'builder-review',
    'counts',
    'takeoffs',
    'cost-estimate',
    'pricing',
    'cover-letter',
    'submission-followup',
  ],
  '/checklist': ['today', 'history', 'manage', 'checklists'],
  '/materials': ['price-book', 'assembly-book', 'templates-po', 'purchase-orders'],
}

export function getStorageKey(userId: string): string {
  return `pipetooling_pinned_${userId}`
}

export function getPinned(userId: string | undefined): PinnedItem[] {
  if (!userId || typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(getStorageKey(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (x): x is PinnedItem =>
        typeof x === 'object' &&
        x !== null &&
        typeof (x as PinnedItem).path === 'string' &&
        typeof (x as PinnedItem).label === 'string'
    )
  } catch {
    return []
  }
}

export function isPinned(
  userId: string | undefined,
  path: string,
  tab: string | null | undefined
): boolean {
  const list = getPinned(userId)
  return list.some((p) => p.path === path && (p.tab ?? null) === (tab ?? null))
}

export function togglePinned(
  userId: string | undefined,
  path: string,
  label: string,
  tab: string | null | undefined
): PinnedItem[] {
  if (!userId || typeof window === 'undefined') return []
  const key = getStorageKey(userId)
  const list = getPinned(userId)
  const tabVal = tab ?? undefined
  const existing = list.findIndex((p) => p.path === path && (p.tab ?? undefined) === tabVal)
  let next: PinnedItem[]
  if (existing >= 0) {
    next = list.filter((_, i) => i !== existing)
  } else {
    next = [...list, { path, label, ...(tabVal ? { tab: tabVal } : {}) }]
  }
  try {
    localStorage.setItem(key, JSON.stringify(next))
    window.dispatchEvent(new CustomEvent('pipetooling-pins-changed'))
  } catch {
    // ignore
  }
  return next
}

export function clearPinned(userId: string | undefined): void {
  if (!userId || typeof window === 'undefined') return
  try {
    localStorage.removeItem(getStorageKey(userId))
    window.dispatchEvent(new CustomEvent('pipetooling-pins-changed'))
  } catch {
    // ignore
  }
}

type UserPinnedTabRow = { path: string; label: string; tab: string | null }

/** Pins stored for a user in Supabase (e.g. added by dev via "Pin for"). */
export async function getPinnedForUserFromSupabase(userId: string): Promise<PinnedItem[]> {
  const { data, error } = await (supabase as any)
    .from('user_pinned_tabs')
    .select('path, label, tab')
    .eq('user_id', userId)
    .order('path')
  if (error) return []
  return ((data ?? []) as UserPinnedTabRow[]).map((row) => ({
    path: row.path,
    label: row.label,
    ...(row.tab ? { tab: row.tab } : {}),
  }))
}

/** Insert a pin for a user in Supabase (e.g. dev "Pin for"). Returns error if insert failed. Duplicate (already pinned) is treated as success. */
export async function addPinForUser(
  targetUserId: string,
  item: PinnedItem
): Promise<{ error: Error | null }> {
  const { error } = await (supabase as any).from('user_pinned_tabs').insert({
    user_id: targetUserId,
    path: item.path,
    label: item.label,
    tab: item.tab ?? null,
  })
  if (error) {
    if (error?.code === '23505') return { error: null } // unique violation = already pinned
    return { error: new Error(error.message) }
  }
  window.dispatchEvent(new CustomEvent('pipetooling-pins-changed'))
  return { error: null }
}

/** Delete all pins for a user from Supabase (used with Clear all page pins). */
export async function clearPinnedInSupabase(userId: string): Promise<void> {
  await (supabase as any).from('user_pinned_tabs').delete().eq('user_id', userId)
  window.dispatchEvent(new CustomEvent('pipetooling-pins-changed'))
}

/** Delete all pins for a given path+tab (e.g. Cost matrix). Devs only. Returns { count, error }. */
export async function deletePinForPathAndTab(
  path: string,
  tab: string
): Promise<{ count: number; error: Error | null }> {
  const { data, error } = await (supabase as any)
    .from('user_pinned_tabs')
    .delete()
    .eq('path', path)
    .eq('tab', tab)
    .select('id')
  if (error) return { count: 0, error: new Error(error.message) }
  window.dispatchEvent(new CustomEvent('pipetooling-pins-changed'))
  return { count: (data ?? []).length, error: null }
}

export function pathToLabel(path: string): string {
  return PATH_TO_LABEL[path] ?? (path.slice(1) || 'Dashboard')
}

/** Returns valid tab for this path from search (or undefined if none). */
export function getTabFromPath(path: string, search: string): string | undefined {
  const allowed = PATH_TABS[path]
  if (!allowed) return undefined
  const tab = new URLSearchParams(search).get('tab')
  if (!tab) return undefined
  return allowed.includes(tab) ? tab : undefined
}
