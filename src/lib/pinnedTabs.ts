/**
 * Pin tab to dashboard: storage and config for pinned routes (and optional tab).
 * Used by Layout (Pin bar) and Dashboard (pinned links section).
 */

import { supabase } from './supabase'
import { parseDocumentsPageTabFromSearch } from './documentsPageTab'

export type PinnedItem = { path: string; label: string; tab?: string }

export const PINNABLE_PATHS = [
  '/dashboard',
  '/quickfill',
  '/customers',
  '/projects',
  '/people',
  '/jobs',
  '/banking',
  '/calendar',
  '/templates',
  '/materials',
  '/estimates',
  '/documents',
  '/duplicates',
  '/bids',
  '/checklist',
  '/settings',
] as const

export type PinnablePath = (typeof PINNABLE_PATHS)[number]

export const PATH_TO_LABEL: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/quickfill': 'Quickfill',
  '/customers': 'Customers',
  '/projects': 'Projects',
  '/people': 'People',
  '/jobs': 'Jobs',
  '/banking': 'Banking',
  '/calendar': 'Calendar',
  '/templates': 'Templates',
  '/materials': 'Materials',
  '/estimates': 'Estimates',
  '/documents': 'Documents',
  '/duplicates': 'Duplicates',
  '/bids': 'Bids',
  '/checklist': 'Checklist',
  '/settings': 'Settings',
}

/** Tab param values per path (for validation and storing tab when pinning). */
export const PATH_TABS: Record<string, readonly string[]> = {
  '/people': ['users', 'pay', 'hours'],
  '/jobs': ['labor', 'billing', 'sub_sheet_ledger', 'combined-labor', 'upcoming', 'teams-summary', 'billed'],
  '/bids': [
    'bid-board',
    'builder-review',
    'working',
    'counts',
    'takeoffs',
    'cost-estimate',
    'pricing',
    'cover-letter',
    'submission-followup',
    'rfi',
    'change-order',
    'lien-release',
  ],
  '/checklist': ['today', 'history', 'review', 'manage'],
  '/materials': ['price-book', 'assembly-book', 'templates-po', 'purchase-orders', 'supply-houses', 'po-generator'],
  '/documents': ['search', 'estimates', 'bid-proposals', 'jobs', 'supply-invoices', 'upload'],
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
    return parsed
      .filter(
        (x): x is PinnedItem =>
          typeof x === 'object' &&
          x !== null &&
          typeof (x as PinnedItem).path === 'string' &&
          typeof (x as PinnedItem).label === 'string'
      )
      .map((p) => {
        if (p.path === '/jobs' && p.tab === 'ledger') return { ...p, tab: 'billing' }
        if (p.path === '/documents' && p.tab === 'ledger') return { ...p, tab: 'estimates' }
        return p
      })
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
    const isDuplicate = error?.code === '23505' || error?.code === 23505 ||
      error?.message?.includes('user_pinned_tabs_user_path_tab_key') ||
      error?.message?.includes('duplicate key value violates unique constraint')
    if (isDuplicate) return { error: null } // already pinned
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

/** Get user IDs who have a pin for path+tab (e.g. Cost matrix). Devs only. */
export async function getUsersWithPin(path: string, tab: string): Promise<{ user_id: string }[]> {
  const { data, error } = await (supabase as any)
    .from('user_pinned_tabs')
    .select('user_id')
    .eq('path', path)
    .eq('tab', tab)
  if (error) return []
  return (data ?? []) as { user_id: string }[]
}

/** Delete a specific user's pin for path+tab. Returns { error }. Use tab=null for pins without a tab. */
export async function deletePinForUserPathAndTab(
  userId: string,
  path: string,
  tab: string | null
): Promise<{ error: Error | null }> {
  let query = (supabase as any).from('user_pinned_tabs').delete().eq('user_id', userId).eq('path', path)
  if (tab == null || tab === '') {
    query = query.is('tab', null)
  } else {
    query = query.eq('tab', tab)
  }
  const { error } = await query
  if (error) return { error: new Error(error.message) }
  window.dispatchEvent(new CustomEvent('pipetooling-pins-changed'))
  return { error: null }
}

/** Remove a pin for the current user from both localStorage and Supabase. */
export async function removePin(
  userId: string | undefined,
  item: PinnedItem
): Promise<{ error: Error | null }> {
  if (!userId || typeof window === 'undefined') return { error: null }
  const tabVal = item.tab ?? null
  // 1. Remove from localStorage
  const list = getPinned(userId)
  const next = list.filter((p) => !(p.path === item.path && (p.tab ?? null) === tabVal))
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(next))
  } catch {
    /* ignore */
  }
  // 2. Remove from Supabase
  const res = await deletePinForUserPathAndTab(userId, item.path, tabVal)
  window.dispatchEvent(new CustomEvent('pipetooling-pins-changed'))
  return res
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

const SUBCONTRACTOR_PATHS = new Set(['/', '/dashboard', '/calendar', '/checklist', '/settings', '/tally'])
const PRIMARY_PATHS = new Set([
  '/dashboard',
  '/materials',
  '/estimates',
  '/documents',
  '/jobs',
  '/bids',
  '/calendar',
  '/checklist',
  '/settings',
  '/tally',
])
const SUPERINTENDENT_PATHS = new Set([
  '/dashboard',
  '/projects',
  '/workflows',
  '/jobs',
  '/bids',
  '/materials',
  '/estimates',
  '/documents',
  '/calendar',
  '/checklist',
  '/settings',
  '/tally',
])

function getAllowedPathsForRole(role: string | null, estimatorProspectsAccess?: boolean): Set<string> | null {
  if (role === 'subcontractor' || role === 'helpers') return SUBCONTRACTOR_PATHS
  if (role === 'estimator') {
    return new Set([
      '/dashboard',
      '/materials',
      '/estimates',
      '/documents',
      '/bids',
      '/customers',
      ...(estimatorProspectsAccess ? ['/prospects'] : []),
      '/calendar',
      '/checklist',
      '/people',
      '/settings',
      '/tally',
    ])
  }
  if (role === 'primary' || role === null) return PRIMARY_PATHS
  if (role === 'superintendent') return SUPERINTENDENT_PATHS
  return null
}

/** Filter pins by role (same logic as Dashboard). */
export function filterPinnedByRole(pins: PinnedItem[], role: string | null, estimatorProspectsAccess?: boolean): PinnedItem[] {
  const allowed = getAllowedPathsForRole(role, estimatorProspectsAccess)
  if (!allowed) return pins
  return pins.filter((p) => allowed.has(p.path))
}

/** Get merged (local + Supabase) and filtered pins for a user. Matches Dashboard pinsToShow logic. */
export async function getMergedFilteredPins(
  userId: string | undefined,
  role: string | null,
  estimatorProspectsAccess?: boolean
): Promise<PinnedItem[]> {
  if (!userId) return []
  const local = getPinned(userId)
  const fromDb = await getPinnedForUserFromSupabase(userId)
  const seen = new Set<string>()
  const merged: PinnedItem[] = []
  for (const p of [...local, ...fromDb]) {
    const key = p.path + '|' + (p.tab ?? '')
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(p)
  }
  const filtered = filterPinnedByRole(merged, role, estimatorProspectsAccess)
    .filter((p) => p.path !== '/dashboard' && p.path !== '/')
    .filter((p) => !(p.path === '/materials' && p.tab === 'external-team'))
  return filtered
}

/** Returns valid tab for this path from search (or undefined if none). */
export function getTabFromPath(path: string, search: string): string | undefined {
  if (path === '/documents') {
    const q = search.trim().replace(/^\?/, '').trim()
    if (q === '') return undefined
    const v = parseDocumentsPageTabFromSearch(search)
    const allowedDocs = PATH_TABS['/documents'] ?? []
    return allowedDocs.includes(v) ? v : undefined
  }
  const allowed = PATH_TABS[path]
  if (!allowed) return undefined
  const tab = new URLSearchParams(search).get('tab')
  if (!tab) return undefined
  return allowed.includes(tab) ? tab : undefined
}
