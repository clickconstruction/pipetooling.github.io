/**
 * The fourth lock of the seal behind the Away note (punch list #256, PR 7, v2.6572). A teammate who left may, in PR 8,
 * sign in to one screen; the database refuses every request from an archived caller (the pre-request gate and the
 * archived_fence policies of migration *_archived_seal), but a function that switches to the service role queries as
 * nobody, so the database sees no caller to refuse. Such a function reads the caller (auth.getUser) and then calls this
 * first: an archived account gets a 403 in the gate's own words, and the function does nothing else for it.
 * `scripts/check-edge-archived-guard.mjs` fails a function that reads the caller and switches to the service role
 * without calling it. Archived accounts are banned at sign-in until PR 8, so this refuses nobody until then.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const ARCHIVED_CALLER_WORDS = 'This account is archived. The Away note is the one page it may read.'

/** True when the account is archived (public.users.archived_at set), read as the service role; a read that fails reads as archived, so a doubt never opens the door. */
export async function isArchivedCaller(admin: SupabaseClient, userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false
  const { data, error } = await admin.from('users').select('archived_at').eq('id', userId).maybeSingle()
  if (error) return true
  return !!(data as { archived_at: string | null } | null)?.archived_at
}

/** The 403 to return when the caller is archived, or null to carry on. `headers` carries the function's CORS headers. */
export async function refuseArchivedCaller(admin: SupabaseClient, userId: string | null | undefined, headers: Record<string, string> = {}): Promise<Response | null> {
  if (!(await isArchivedCaller(admin, userId))) return null
  return new Response(JSON.stringify({ error: ARCHIVED_CALLER_WORDS, code: 'archived_caller' }), { status: 403, headers: { ...headers, 'Content-Type': 'application/json' } })
}
