import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callCtManageUser } from '../_shared/ctBridge.ts'

// CT↔PT user bridge, PT-side proxy (v2.2435). The app's ONLY door to CountTooling's
// manage-user function: verifies the caller is a signed-in PT dev, then forwards an
// allowlisted verb with the bridge secret (which never reaches the browser). Call sites:
// twin mint + CT-seat retry (DigitalTwinsPanel), "Create CountTooling seat" + backfill
// (Active Accounts), and the weekly drift audit's roster pull. archive-user/restore-user
// forward deactivate/reactivate server-side via _shared/ctBridge.ts instead of here.
// Every act is logged to the function log (no audit table in v1 — locked decision).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ALLOWED_VERBS = new Set(['create', 'deactivate', 'reactivate', 'set_twin_flag', 'update_email', 'lookup', 'roster'])

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'POST only' }, 405)
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'Unauthorized - No authorization header' }, 401)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !authUser) return jsonResponse({ error: 'Unauthorized - Invalid or expired session' }, 401)

    const { data: userData, error: userError } = await supabase.from('users').select('role, email').eq('id', authUser.id).single()
    if (userError || userData?.role !== 'dev') return jsonResponse({ error: 'Forbidden - devs only' }, 403)

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body || typeof body.verb !== 'string' || !ALLOWED_VERBS.has(body.verb)) {
      return jsonResponse({ error: 'Unknown or missing verb' }, 400)
    }

    console.log(`ct-bridge: ${userData.email} → ${body.verb} ${JSON.stringify({ ...body, verb: undefined })?.slice(0, 200)}`)
    const { status, json } = await callCtManageUser(body)
    return jsonResponse(json, status)
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500)
  }
})
