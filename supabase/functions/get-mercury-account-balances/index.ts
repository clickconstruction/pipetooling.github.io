import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// The read itself is shared with the weekly sheet since v2.5883 (`_shared/mercuryAccounts.ts`).
import { fetchMercuryAccounts } from '../_shared/mercuryAccounts.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Roles that can view Banking (and therefore the Balance Sheet cash line).
// Mirrors public.is_banking_staff() (20260911183606, v2.3305): controller and above —
// dev, master_technician, controller. Plain assistants lost Banking on 2026-09-11.
const ALLOWED_ROLES = new Set(['dev', 'master_technician', 'controller'])

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!
    const mercuryKey = Deno.env.get('MERCURY_API_KEY')
    if (!mercuryKey?.trim()) return jsonResponse({ error: 'Server misconfigured: MERCURY_API_KEY' }, 500)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'Missing authorization' }, 401)
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const userClient = createClient(supabaseUrl, supabaseAnon, { global: { headers: { Authorization: authHeader } } })
    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser(token)
    if (authErr || !user) return jsonResponse({ error: 'Invalid session' }, 401)
    const { data: userRow, error: roleErr } = await userClient.from('users').select('role').eq('id', user.id).maybeSingle()
    const role = (userRow as { role?: string } | null)?.role
    if (roleErr || !role || !ALLOWED_ROLES.has(role)) {
      return jsonResponse({ error: 'Forbidden — Banking access required' }, 403)
    }

    const r = await fetchMercuryAccounts(mercuryKey)
    if (!r.ok) return jsonResponse({ error: r.error, detail: r.detail }, 502)
    return jsonResponse({ ok: true, accounts: r.accounts, totalCurrentBalance: r.totalCurrentBalance, totalAvailableBalance: r.totalAvailableBalance })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500)
  }
})
