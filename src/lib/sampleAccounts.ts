/**
 * Sample accounts (View as, v2.3606) — one real login per imitable role, hidden from every human
 * surface. Since v2.3705 (People spine PR 6) their home is Settings → System → Digital twins &
 * samples, beside the other fixture accounts; this is the one writer (create-user with
 * `is_sample`), lifted out of the Active Accounts hook so the panel there stays a people tool.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import { missingSampleRoles, sampleAccountPassword, sampleEmailForRole, sampleNameForRole, type SampleAccountRow } from './viewAs'

export async function createMissingSampleAccounts(
  supabase: SupabaseClient<Database>,
  users: ReadonlyArray<SampleAccountRow>,
): Promise<{ made: string[]; failed: Array<{ role: string; error: string }> }> {
  const roles = missingSampleRoles(users)
  const made: string[] = []
  const failed: Array<{ role: string; error: string }> = []
  for (const role of roles) {
    const { data, error: eFn } = await supabase.functions.invoke('create-user', {
      body: { email: sampleEmailForRole(role), password: sampleAccountPassword(), role, name: sampleNameForRole(role), is_sample: true },
    })
    const bodyErr = (data as { error?: string } | null)?.error
    if (eFn || bodyErr) failed.push({ role, error: bodyErr ?? eFn?.message ?? 'failed' })
    else made.push(role)
  }
  return { made, failed }
}
