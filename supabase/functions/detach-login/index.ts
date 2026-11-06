import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DETACH_WORDS, detachRowRefusal, detachUserIdOf, type DetachCandidate } from '../_shared/detachLoginDoor.ts'
import { refuseArchivedCaller } from '../_shared/refuseArchivedCaller.ts'

/**
 * Remove a person's login (punch list #266, v2.6532): the auth account is deleted by the row's id, and the person stays.
 * `on_auth_user_deleted` (v2.6511) clears `users.login_attached_at`; nothing that points at the person moves. Dev only
 * (Bearer + users.role, like set-user-password). Body: { user_id }. Answers { success, user: { id, name, login_attached_at } }.
 * The way back is Attach a login on the desk, which lands on the same id.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '')
    if (!authHeader || !token) return json({ error: 'Unauthorized - No authorization header' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const {
      data: { user: authUser },
      error: authError,
    } = await caller.auth.getUser(token)
    if (authError || !authUser) return json({ error: 'Unauthorized - Invalid or expired session. Please sign out and sign in again.' }, 401)

    const { data: callerRow } = await caller.from('users').select('role').eq('id', authUser.id).single()
    if (!callerRow || callerRow.role !== 'dev') return json({ error: 'Forbidden - Only devs can remove a login' }, 403)

    const idOrRefusal = detachUserIdOf((await req.json()) as { user_id?: unknown })
    if ('error' in idOrRefusal) return json({ error: idOrRefusal.error }, idOrRefusal.status)
    const userId = idOrRefusal.userId

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKey) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured.' }, 500)
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const archivedRefusal = await refuseArchivedCaller(admin, authUser?.id, corsHeaders)
    if (archivedRefusal) return archivedRefusal

    const { data: row, error: rowError } = await admin.from('users').select('id, name, login_attached_at, is_sample, is_digital_twin').eq('id', userId).maybeSingle()
    if (rowError) return json({ error: `Could not read the person: ${rowError.message}` }, 500)
    const candidate = (row as DetachCandidate | null) ?? null
    const refusal = detachRowRefusal(candidate, authUser.id)
    if (refusal || !candidate) return json({ error: refusal?.error ?? 'No person with that id' }, refusal?.status ?? 404)

    // The auth account goes; the trigger on auth.users detaches the row. Push devices go with the account (their key).
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
    if (deleteError) return json({ error: `The login was not removed: ${deleteError.message}` }, 500)

    // Belt and braces: the trigger stamps the row; stamp it here too if it did not.
    const { data: after } = await admin.from('users').select('id, name, login_attached_at').eq('id', userId).maybeSingle()
    const a = after as { id: string; name: string | null; login_attached_at: string | null } | null
    if (a?.login_attached_at) await admin.from('users').update({ login_attached_at: null }).eq('id', userId)

    return json({ success: true, user: { id: userId, name: candidate.name, login_attached_at: null }, goes: DETACH_WORDS.goes, stays: DETACH_WORDS.stays })
  } catch (error) {
    console.error('Error in detach-login function:', error)
    return json({ error: (error as Error).message || 'Internal server error' }, 500)
  }
})
