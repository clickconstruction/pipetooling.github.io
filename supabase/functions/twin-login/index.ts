import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Digital twins Phase E1 (docs/DIGITAL_TWINS_PLAN.md): mint a magic-link session for a
// TWIN account so a cloud-hosted harness can sign into the deployed app. Two auth paths:
//
//   A. Master secret (owner/ops): X-Twin-Login-Secret matches TWIN_LOGIN_SECRET —
//      may mint any twin. Rotating it is the fleet-wide kill switch.
//   B. Per-twin token (partners/external harnesses): X-Twin-Token, sha256-matched against
//      twin_credentials (revoked_at null). The token IS the identity — it can only ever
//      mint ITS twin's sessions; revoking the row cuts off one partner.
//
// Shared hard guards on the resolved account (a leaked credential can never produce a
// session as a real person):
//   * email matches the fleet pattern twin-<role>-<n>@twins.pipetooling.local
//   * public.users.is_digital_twin = true
//   * role = 'estimator' (the estimator-only program)
// Rate limit: max 6 mints per twin per minute (counted via twin_runs) → 429.
// Every successful mint logs to the function log + a twin_runs row.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-twin-login-secret, x-twin-token',
}

const TWIN_EMAIL_RE = /^twin-[a-z_]+-\d+@twins\.pipetooling\.local$/
const MINTS_PER_MINUTE = 6

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKey) {
      return jsonResponse({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, 500)
    }
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { email, redirectTo, run } = (await req.json()) as { email?: string; redirectTo?: string; run?: string }
    const cleanEmail = (email ?? '').trim().toLowerCase()

    // ── Auth: master secret OR per-twin token ────────────────────────────────
    const masterSecret = Deno.env.get('TWIN_LOGIN_SECRET')
    const presentedSecret = req.headers.get('X-Twin-Login-Secret')
    const presentedToken = req.headers.get('X-Twin-Token')

    let tokenTwinUserId: string | null = null
    let credentialId: string | null = null
    if (masterSecret && presentedSecret === masterSecret) {
      // ops path — email selects the twin
      if (!TWIN_EMAIL_RE.test(cleanEmail)) {
        return jsonResponse({ error: 'Not a twin account email' }, 400)
      }
    } else if (presentedToken) {
      const hash = await sha256Hex(presentedToken.trim())
      const { data: cred, error: credErr } = await adminClient
        .from('twin_credentials')
        .select('id, twin_user_id, revoked_at')
        .eq('token_hash', hash)
        .maybeSingle()
      if (credErr) return jsonResponse({ error: `Credential lookup failed: ${credErr.message}` }, 500)
      if (!cred || cred.revoked_at) return jsonResponse({ error: 'Unauthorized - unknown or revoked twin token' }, 401)
      tokenTwinUserId = cred.twin_user_id
      credentialId = cred.id
    } else {
      return jsonResponse({ error: 'Unauthorized - invalid or missing twin login secret' }, 401)
    }

    // ── Resolve + guard the twin account ─────────────────────────────────────
    const userQuery = adminClient.from('users').select('id, email, role, is_digital_twin')
    const { data: userRow, error: userErr } = tokenTwinUserId
      ? await userQuery.eq('id', tokenTwinUserId).maybeSingle()
      : await userQuery.eq('email', cleanEmail).maybeSingle()
    if (userErr) return jsonResponse({ error: `User lookup failed: ${userErr.message}` }, 500)
    if (!userRow) return jsonResponse({ error: 'Twin account not found' }, 404)
    if (!TWIN_EMAIL_RE.test((userRow.email ?? '').toLowerCase())) {
      return jsonResponse({ error: 'Not a twin account email' }, 400)
    }
    if (tokenTwinUserId && cleanEmail && cleanEmail !== (userRow.email ?? '').toLowerCase()) {
      return jsonResponse({ error: 'Token does not belong to that twin' }, 403)
    }
    if (userRow.is_digital_twin !== true) {
      return jsonResponse({ error: 'Account is not flagged as a digital twin' }, 403)
    }
    if (userRow.role !== 'estimator') {
      return jsonResponse({ error: 'Twin logins are estimator-only for now' }, 403)
    }

    // ── Rate limit: mints per twin per minute (via twin_runs) ────────────────
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString()
    const { count: recentMints } = await adminClient
      .from('twin_runs')
      .select('id', { count: 'exact', head: true })
      .eq('twin_user_id', userRow.id)
      .gte('started_at', oneMinuteAgo)
    if ((recentMints ?? 0) >= MINTS_PER_MINUTE) {
      return jsonResponse({ error: `Rate limited: max ${MINTS_PER_MINUTE} mints per minute per twin`, retry_after_seconds: 60 }, 429)
    }

    // ── Mint ─────────────────────────────────────────────────────────────────
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: userRow.email!,
      options: { redirectTo: redirectTo || undefined },
    })
    if (linkError || !linkData) {
      return jsonResponse({ error: `Failed to generate magic link: ${linkError?.message || 'unknown error'}` }, 500)
    }

    console.log(`twin-login mint: ${userRow.email} via=${credentialId ? 'token' : 'master'} run=${run ?? '-'} redirect=${redirectTo ?? '-'}`)
    try {
      await adminClient.from('twin_runs').insert({
        twin_user_id: userRow.id,
        mission: run ?? 'twin-login',
        notes: `mint via=${credentialId ? `token:${credentialId}` : 'master'} redirect=${redirectTo ?? '-'}`,
      })
      if (credentialId) {
        await adminClient.from('twin_credentials').update({ last_used_at: new Date().toISOString() }).eq('id', credentialId)
      }
    } catch (_) {
      /* ledger insert is fail-soft */
    }

    return jsonResponse({ success: true, action_link: linkData.properties.action_link }, 200)
  } catch (error) {
    console.error('Error in twin-login function:', error)
    return jsonResponse({ error: (error as Error)?.message || 'Internal server error' }, 500)
  }
})
