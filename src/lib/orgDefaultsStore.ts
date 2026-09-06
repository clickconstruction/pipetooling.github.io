import { supabase } from './supabase'
import { ORG_DEFAULT_EVERYONE, ORG_DEFAULT_ROLE_GROUPS, type OrgDefaultKey, type OrgDefaultRoleGroup, type OrgDefaultRow } from './orgDefaults'

/**
 * Session cache of `org_defaults` (T5-08): one read per session, shared by every consumer;
 * writes (Settings → Defaults) refresh it and notify subscribers. A missing table reads as
 * "no rows" so the fallbacks apply until the migration is pushed.
 */

let rows: OrgDefaultRow[] | null = null
let loading: Promise<OrgDefaultRow[]> | null = null
const listeners = new Set<(rows: OrgDefaultRow[]) => void>()

export function getOrgDefaultRowsSync(): OrgDefaultRow[] | null {
  return rows
}

export function loadOrgDefaults(force = false): Promise<OrgDefaultRow[]> {
  if (rows && !force) return Promise.resolve(rows)
  if (loading && !force) return loading
  loading = (async () => {
    const { data, error } = await supabase.from('org_defaults').select('key, role, value')
    const next = error ? [] : ((data ?? []) as OrgDefaultRow[])
    rows = next
    loading = null
    for (const l of listeners) l(next)
    return next
  })()
  return loading
}

export function subscribeOrgDefaults(listener: (rows: OrgDefaultRow[]) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Write one group's rows (or the org-wide row); '' deletes. Refreshes the cache. */
export async function saveOrgDefault(
  key: OrgDefaultKey,
  target: OrgDefaultRoleGroup | typeof ORG_DEFAULT_EVERYONE,
  value: string,
  updatedBy: string | null,
): Promise<string | null> {
  const roles = target === ORG_DEFAULT_EVERYONE ? [ORG_DEFAULT_EVERYONE] : ORG_DEFAULT_ROLE_GROUPS[target].roles
  const res = value
    ? await supabase.from('org_defaults').upsert(roles.map((role) => ({ key, role, value, updated_by: updatedBy })), { onConflict: 'key,role' })
    : await supabase.from('org_defaults').delete().eq('key', key).in('role', roles)
  if (res.error) return res.error.message
  await loadOrgDefaults(true)
  return null
}

/** Test seam. */
export function resetOrgDefaultsCacheForTests(): void {
  rows = null
  loading = null
  listeners.clear()
}
