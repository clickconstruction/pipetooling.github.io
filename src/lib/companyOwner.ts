import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

/** app_settings key: the account every new customer / project / job / estimate / prospect is stamped with (one company, v2.2972). */
export const COMPANY_OWNER_USER_ID_KEY = 'company_owner_user_id'
/** Legacy org-wide fallback (v2.1532) — still honoured when the company owner row is unset. */
export const JOB_OWNER_OVERRIDE_DEFAULT_KEY = 'job_owner_override_default'

export type CompanyOwnerSettingRow = { key: string; value_text: string | null }
export type CompanyOwnerCandidate = { id: string; role: string; archived_at?: string | null }

/**
 * Pure: the company owner account id. The settings row wins; else the legacy
 * job_owner_override_default; else the single live master account; else the
 * signed-in user (so a fresh environment with no masters still saves rows).
 * Mirrors SQL `company_owner_user_id()` (20260906190000).
 */
export function chooseCompanyOwnerUserId(
  rows: ReadonlyArray<CompanyOwnerSettingRow>,
  masters: ReadonlyArray<CompanyOwnerCandidate>,
  authUserId: string,
): string {
  const setting = rows.find((r) => r.key === COMPANY_OWNER_USER_ID_KEY)?.value_text?.trim()
  if (setting) return setting
  const legacy = rows.find((r) => r.key === JOB_OWNER_OVERRIDE_DEFAULT_KEY)?.value_text?.trim()
  if (legacy) return legacy
  const live = masters.filter((m) => m.role === 'master_technician' && !m.archived_at)
  if (live.length === 1) return live[0]!.id
  return authUserId
}

let cache: { value: string; at: number; authUserId: string } | null = null
const CACHE_MS = 60_000

/** Forget the cached owner (Settings saves a new one). */
export function invalidateCompanyOwnerCache(): void {
  cache = null
}

/**
 * The company owner account for new rows. One round-trip per minute per session;
 * every read failure falls back to the signed-in user rather than throwing.
 */
export async function resolveCompanyOwnerUserId(
  client: SupabaseClient<Database>,
  authUserId: string,
): Promise<string> {
  if (cache && cache.authUserId === authUserId && Date.now() - cache.at < CACHE_MS) return cache.value
  let rows: CompanyOwnerSettingRow[] = []
  try {
    const { data } = await client
      .from('app_settings')
      .select('key, value_text')
      .in('key', [COMPANY_OWNER_USER_ID_KEY, JOB_OWNER_OVERRIDE_DEFAULT_KEY])
    rows = (data ?? []) as CompanyOwnerSettingRow[]
  } catch {
    rows = []
  }
  let masters: CompanyOwnerCandidate[] = []
  if (!rows.some((r) => r.value_text?.trim())) {
    try {
      const { data } = await client.from('users').select('id, role, archived_at').eq('role', 'master_technician')
      masters = (data ?? []) as CompanyOwnerCandidate[]
    } catch {
      masters = []
    }
  }
  const value = chooseCompanyOwnerUserId(rows, masters, authUserId)
  cache = { value, at: Date.now(), authUserId }
  return value
}
