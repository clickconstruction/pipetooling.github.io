import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Digital twins Phase E1 (docs/DIGITAL_TWINS_PLAN.md): mint a magic-link session for a
// TWIN account so a cloud-hosted harness can sign into the deployed app. dev-login's
// sibling with four hard guards — a leaked TWIN_LOGIN_SECRET can only ever produce a
// session as a flagged, estimator-role twin account, never a real person:
//   1. X-Twin-Login-Secret must match TWIN_LOGIN_SECRET (its own secret; rotating it is
//      the fleet-wide kill switch).
//   2. The email must match the fleet pattern twin-<role>-<n>@twins.pipetooling.local.
//   3. public.users for that account must have is_digital_twin = true.
//   4. Its role must be 'estimator' (the estimator-only program).
// Every mint is logged to the function log (twin_runs ledger insert is fail-soft until
// the E2 migration lands).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-twin-login-secret',
}

const TWIN_EMAIL_RE = /^twin-[a-z_]+-\d+@twins\.pipetooling\.local$/

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const secret = req.headers.get('X-Twin-Login-Secret')
    const expectedSecret = Deno.env.get('TWIN_LOGIN_SECRET')
    if (!expectedSecret || secret !== expectedSecret) {
      return jsonResponse({ error: 'Unauthorized - invalid or missing twin login secret' }, 401)
    }

    const { email, redirectTo, run } = (await req.json()) as { email?: string; redirectTo?: string; run?: string }
    const cleanEmail = (email ?? '').trim().toLowerCase()
    if (!TWIN_EMAIL_RE.test(cleanEmail)) {
      return jsonResponse({ error: 'Not a twin account email' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKey) {
      return jsonResponse({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, 500)
    }
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: userRow, error: userErr } = await adminClient
      .from('users')
      .select('id, role, is_digital_twin')
      .eq('email', cleanEmail)
      .maybeSingle()
    if (userErr) {
      return jsonResponse({ error: `User lookup failed: ${userErr.message}` }, 500)
    }
    if (!userRow) {
      return jsonResponse({ error: 'Twin account not found' }, 404)
    }
    if (userRow.is_digital_twin !== true) {
      return jsonResponse({ error: 'Account is not flagged as a digital twin' }, 403)
    }
    if (userRow.role !== 'estimator') {
      return jsonResponse({ error: 'Twin logins are estimator-only for now' }, 403)
    }

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: cleanEmail,
      options: { redirectTo: redirectTo || undefined },
    })
    if (linkError || !linkData) {
      return jsonResponse({ error: `Failed to generate magic link: ${linkError?.message || 'unknown error'}` }, 500)
    }

    console.log(`twin-login mint: ${cleanEmail} run=${run ?? '-'} redirect=${redirectTo ?? '-'}`)
    // twin_runs ledger (E2) — fail-soft until the table exists.
    try {
      await adminClient.from('twin_runs').insert({ twin_user_id: userRow.id, mission: run ?? 'twin-login', notes: `mint redirect=${redirectTo ?? '-'}` })
    } catch (_) {
      /* ledger not deployed yet */
    }

    return jsonResponse({ success: true, action_link: linkData.properties.action_link }, 200)
  } catch (error) {
    console.error('Error in twin-login function:', error)
    return jsonResponse({ error: (error as Error)?.message || 'Internal server error' }, 500)
  }
})
