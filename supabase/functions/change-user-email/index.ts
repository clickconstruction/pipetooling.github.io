import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkSignInEmail, exactIlikePattern } from '../_shared/signInEmailChange.ts'

/**
 * Account on the desk, PR C (v2.4344): change the email someone signs in with.
 *
 * Before this, the Active Accounts window's Edit wrote `public.users.email` only. The login
 * (`auth.users.email`) kept the old address, so the app showed one email and the person signed
 * in with another, and a sign-in email went to an address with no login behind it. This moves
 * both together: the login first (confirmed, so no confirmation email is sent), then the app's
 * copy, then the account's own roster row where it still held the old address. If the app's
 * copy cannot be written the login is put back, so the two never disagree.
 *
 * Dev only (Bearer + users.role, like set-user-password). Body: { user_id, email }.
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
    if (!callerRow || callerRow.role !== 'dev') return json({ error: 'Forbidden - Only devs can change a sign-in email' }, 403)

    const { user_id, email } = (await req.json()) as { user_id?: string; email?: string }
    if (!user_id || typeof email !== 'string') return json({ error: 'Missing required fields: user_id and email' }, 400)

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKey) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured.' }, 500)
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: target, error: targetError } = await admin.from('users').select('id, email').eq('id', user_id).maybeSingle()
    if (targetError) return json({ error: targetError.message }, 500)
    if (!target) return json({ error: 'No account with that id' }, 404)

    const check = checkSignInEmail(target.email, email)
    if (!check.ok) return json({ error: check.error }, 400)
    if (check.unchanged) return json({ success: true, unchanged: true, email: check.email })

    const { data: clash, error: clashError } = await admin.from('users').select('id, name').ilike('email', exactIlikePattern(check.email)).neq('id', user_id).limit(1)
    if (clashError) return json({ error: clashError.message }, 500)
    if (clash && clash.length > 0) return json({ error: `${clash[0].name ?? 'Another account'} already signs in with ${check.email}.` }, 409)

    const previous = target.email
    const { error: loginError } = await admin.auth.admin.updateUserById(user_id, { email: check.email, email_confirm: true })
    if (loginError) return json({ error: `The login did not change: ${loginError.message}` }, 400)

    const { error: rowError } = await admin.from('users').update({ email: check.email }).eq('id', user_id)
    if (rowError) {
      // Put the login back so the app and the login keep agreeing.
      if (previous) await admin.auth.admin.updateUserById(user_id, { email: previous, email_confirm: true })
      return json({ error: `Nothing changed: ${rowError.message}` }, 500)
    }

    // The account's own roster row, only where it still held the old address.
    let rosterRowsUpdated = 0
    if (previous) {
      const { data: moved } = await admin
        .from('people')
        .update({ email: check.email })
        .eq('account_user_id', user_id)
        .ilike('email', exactIlikePattern(previous))
        .select('id')
      rosterRowsUpdated = moved?.length ?? 0
    }

    return json({ success: true, email: check.email, previous, rosterRowsUpdated })
  } catch (error) {
    console.error('Error in change-user-email function:', error)
    return json({ error: (error as Error).message || 'Internal server error' }, 500)
  }
})
