import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ALLOWED_ROLES = new Set(['dev', 'master_technician'])
const MAX_NAME = 120

interface Body {
  action?: 'rename' | 'delete'
  accountId?: string
  name?: string
}

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
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceKey) return jsonResponse({ error: 'Server misconfigured: SUPABASE_SERVICE_ROLE_KEY' }, 500)

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
      return jsonResponse({ error: 'Forbidden — dev / master technician only' }, 403)
    }

    let body: Body
    try {
      body = await req.json()
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400)
    }

    const accountId = (body.accountId ?? '').trim()
    if (!accountId) return jsonResponse({ error: 'accountId is required' }, 400)
    if (body.action !== 'rename' && body.action !== 'delete') {
      return jsonResponse({ error: "action must be 'rename' or 'delete'" }, 400)
    }

    const admin = createClient(supabaseUrl, serviceKey)

    // Guard: only operate on a pure-manual synthetic account — never a real Mercury one.
    const { count: mercuryCount } = await admin
      .from('mercury_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('mercury_account_id', accountId)
      .eq('source', 'mercury')
    if ((mercuryCount ?? 0) > 0) {
      return jsonResponse({ error: 'That account is a real Mercury account — refused.' }, 400)
    }
    const { count: manualCount } = await admin
      .from('mercury_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('mercury_account_id', accountId)
      .eq('source', 'manual')
    if ((manualCount ?? 0) === 0) {
      return jsonResponse({ error: 'No manual account found for that id.' }, 404)
    }

    if (body.action === 'rename') {
      const name = (body.name ?? '').trim()
      if (name === '') return jsonResponse({ error: 'Name cannot be empty.' }, 400)
      if (name.length > MAX_NAME) return jsonResponse({ error: `Name must be ${MAX_NAME} characters or fewer.` }, 400)
      const { error: upErr } = await admin
        .from('mercury_account_nicknames')
        .upsert({ mercury_account_id: accountId, nickname: name }, { onConflict: 'mercury_account_id' })
      if (upErr) return jsonResponse({ error: `Rename failed: ${upErr.message}` }, 500)
      return jsonResponse({ ok: true, action: 'rename', accountId, name })
    }

    // delete: remove the account's manual transactions and the nickname. All
    // mercury_transactions FK relations are ON DELETE CASCADE (labels, attributions,
    // allocations, suggestions, notes, …) except jobs_ledger_payments (SET NULL), so
    // deleting the rows cleans up dependents automatically.
    const { error: delErr } = await admin
      .from('mercury_transactions')
      .delete()
      .eq('mercury_account_id', accountId)
      .eq('source', 'manual')
    if (delErr) return jsonResponse({ error: `Delete failed: ${delErr.message}` }, 500)
    await admin.from('mercury_account_nicknames').delete().eq('mercury_account_id', accountId)
    return jsonResponse({ ok: true, action: 'delete', accountId, deleted: manualCount ?? 0 })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500)
  }
})
