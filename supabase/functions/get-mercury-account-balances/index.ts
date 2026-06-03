import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MERCURY_BASE = 'https://api.mercury.com/api/v1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Roles that can view Banking (and therefore the Balance Sheet cash line).
const ALLOWED_ROLES = new Set(['dev', 'master_technician', 'assistant'])

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

    const mRes = await fetch(`${MERCURY_BASE}/accounts`, {
      headers: { Authorization: `Bearer ${mercuryKey}`, Accept: 'application/json' },
    })
    if (!mRes.ok) {
      const text = await mRes.text().catch(() => '')
      return jsonResponse({ error: `Mercury accounts fetch failed (${mRes.status})`, detail: text.slice(0, 300) }, 502)
    }
    const data = (await mRes.json()) as { accounts?: Array<Record<string, unknown>> }
    const accounts = (data.accounts ?? [])
      .filter((a) => a.status !== 'archived')
      .map((a) => ({
        id: a.id as string,
        name: a.name as string,
        kind: (a.kind as string | undefined) ?? null,
        currentBalance: Number(a.currentBalance ?? 0),
        availableBalance: Number(a.availableBalance ?? 0),
      }))
    const totalCurrentBalance = accounts.reduce((s, a) => s + (Number.isFinite(a.currentBalance) ? a.currentBalance : 0), 0)
    const totalAvailableBalance = accounts.reduce((s, a) => s + (Number.isFinite(a.availableBalance) ? a.availableBalance : 0), 0)

    return jsonResponse({ ok: true, accounts, totalCurrentBalance, totalAvailableBalance })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500)
  }
})
