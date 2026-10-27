import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { REAL_ACCOUNT } from '../_shared/realAccount.ts'
import { MODEL_KEY_SHAPE, isModelProvider, loadModelKey, type ModelKeyDb } from '../_shared/modelKey.ts'

/**
 * model-config (punch list #186, v2.5916, the Model keys card in Settings): the owner's and a dev's door to a language
 * model's API key, which lives in Vault (migration 20261026220000, one secret per provider), so the drafts the app
 * offers (`report-draft`) have a key without a terminal. Owner or dev only: Bearer JWT, then the role from `users`
 * (`master_technician` or `dev`), a real account, not read-only. On the shape of `quo-config`.
 *
 *   { action: "status", provider }      → whether a key is held and where from (vault | env | none), its last four
 *                                         characters when Vault holds one, when it was saved and by whom. Never the key.
 *   { action: "set", provider, key }    → the key into Vault with the caller's name (a blank forgets it); answers the status.
 *   { action: "forget", provider }      → the secret gone; answers the status.
 *
 * Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY; ANTHROPIC_API_KEY as the fallback key while Vault
 * holds none. Gateway verify_jwt = false.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function str(v: unknown, max = 300): string | undefined {
  return typeof v === 'string' ? v.trim().slice(0, max) : undefined
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  let body: Record<string, unknown> = {}
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    body = {}
  }
  const action = str(body.action, 20) ?? ''
  const provider = str(body.provider, 40) ?? 'anthropic'
  if (!isModelProvider(provider)) return jsonResponse({ error: `Unknown provider: ${provider}` }, 400)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !anonKey || !serviceKey) return jsonResponse({ error: 'Server misconfigured' }, 500)

    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!jwt) return jsonResponse({ error: 'Sign in first.' }, 401)
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser(jwt)
    if (authError || !user) return jsonResponse({ error: 'Sign in first.' }, 401)

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
    const { data: who } = await admin.from('users').select('id, name, role, read_only').match(REAL_ACCOUNT).eq('id', user.id).maybeSingle()
    const row = who as { name?: string | null; role?: string; read_only?: boolean } | null
    const role = String(row?.role ?? '')
    if (!row || row.read_only || (role !== 'master_technician' && role !== 'dev')) return jsonResponse({ error: 'Only the owner or a dev sets the model keys.' }, 403)
    const db = admin as unknown as ModelKeyDb

    if (action === 'set' || action === 'forget') {
      const key = action === 'forget' ? '' : str(body.key, 400)
      if (key === undefined) return jsonResponse({ error: 'Give the key.' }, 400)
      if (key !== '' && !MODEL_KEY_SHAPE.test(key)) return jsonResponse({ error: 'That does not look like an API key. Paste it again with no spaces.' }, 400)
      const { error } = await db.rpc('model_secret_set', { p_provider: provider, p_value: key, p_saved_by: (row.name ?? '').trim() || user.email || user.id })
      if (error) return jsonResponse({ error: `Could not keep the key: ${error.message}` }, 500)
    }

    const { key, source } = await loadModelKey(db, (k) => Deno.env.get(k), provider)
    let savedAt: string | null = null
    let savedBy: string | null = null
    if (source === 'vault') {
      const { data } = await db.rpc('model_secret_status', { p_provider: provider })
      const s = (data && typeof data === 'object' ? data : {}) as { saved_at?: unknown; saved_by?: unknown }
      savedAt = typeof s.saved_at === 'string' ? s.saved_at : null
      savedBy = typeof s.saved_by === 'string' ? s.saved_by : null
    }
    const status = { provider, set: key !== '', source, last4: source === 'vault' ? key.slice(-4) : null, saved_at: savedAt, saved_by: savedBy }

    if (action === 'status' || action === 'set' || action === 'forget') return jsonResponse({ ok: true, ...status })
    return jsonResponse({ error: `Unknown action: ${action || '(none)'}` }, 400)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('model-config', message)
    return jsonResponse({ error: message }, 500)
  }
})
