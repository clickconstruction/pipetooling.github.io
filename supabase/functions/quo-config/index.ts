import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { REAL_ACCOUNT } from '../_shared/realAccount.ts'
import { loadQuoApiKey, quoGet, type QuoKeyDb } from '../_shared/quoKey.ts'

/**
 * quo-config (v2.5718, the Quo connection in Settings; the owner's ask of 2026-10-21: no terminal in setup): the
 * owner's and a dev's door to Quo's API key, which lives in Vault (migration 20261021020000), and to Quo's own lists,
 * so Settings → Phone and texts picks seats and numbers instead of typed ids. Owner or dev only: Bearer JWT, then the
 * role from `users` (`master_technician` or `dev`), a real account, not read-only.
 *
 *   { action: "status" }        → whether a key is held and where from (vault | env | none), its last four characters
 *                                 when Vault holds one, when it was saved and by whom. Never the key.
 *   { action: "set", key }      → the key into Vault with the caller's name (a blank forgets it); answers the status.
 *   { action: "directory" }     → GET /phone-numbers and GET /users from Quo's versioned API, every page, as Quo
 *                                 answers them: { numbers, members }. 409 without a key; 502 when Quo refuses.
 *
 * Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY; QUO_API_KEY as the fallback key while Vault
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

/** What a key must look like to be kept: one run of printable characters, no spaces, long enough to be a key. */
const KEY_SHAPE = /^[\x21-\x7e]{16,400}$/

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  let body: Record<string, unknown> = {}
  try { body = (await req.json()) as Record<string, unknown> } catch { body = {} }
  const action = str(body.action, 20) ?? ''

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !anonKey || !serviceKey) return jsonResponse({ error: 'Server misconfigured' }, 500)

    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!jwt) return jsonResponse({ error: 'Sign in first.' }, 401)
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: authError } = await userClient.auth.getUser(jwt)
    if (authError || !user) return jsonResponse({ error: 'Sign in first.' }, 401)

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
    const { data: who } = await admin.from('users').select('id, name, role, read_only').match(REAL_ACCOUNT).eq('id', user.id).maybeSingle()
    const row = who as { name?: string | null; role?: string; read_only?: boolean } | null
    const role = String(row?.role ?? '')
    if (!row || row.read_only || (role !== 'master_technician' && role !== 'dev')) return jsonResponse({ error: 'Only the owner or a dev sets the Quo connection.' }, 403)
    const db = admin as unknown as QuoKeyDb

    if (action === 'set') {
      const key = str(body.key, 400)
      if (key === undefined) return jsonResponse({ error: 'Give the key.' }, 400)
      if (key !== '' && !KEY_SHAPE.test(key)) return jsonResponse({ error: 'That does not look like a Quo key. Paste it again with no spaces.' }, 400)
      const { error } = await db.rpc('quo_secret_set', { p_value: key, p_saved_by: (row.name ?? '').trim() || user.email || user.id })
      if (error) return jsonResponse({ error: `Could not keep the key: ${error.message}` }, 500)
    }

    const { key, source } = await loadQuoApiKey(db, (k) => Deno.env.get(k))
    let savedAt: string | null = null
    let savedBy: string | null = null
    if (source === 'vault') {
      const { data } = await db.rpc('quo_secret_status')
      const s = (data && typeof data === 'object' ? data : {}) as { saved_at?: unknown; saved_by?: unknown }
      savedAt = typeof s.saved_at === 'string' ? s.saved_at : null
      savedBy = typeof s.saved_by === 'string' ? s.saved_by : null
    }
    const status = { set: key !== '', source, last4: source === 'vault' ? key.slice(-4) : null, saved_at: savedAt, saved_by: savedBy }

    if (action === 'status' || action === 'set') return jsonResponse({ ok: true, ...status })

    if (action === 'directory') {
      if (!key) return jsonResponse({ ok: false, ...status, error: 'No Quo key yet. Paste the key first.' }, 409)
      const numbers = await quoGet('/phone-numbers', key)
      if (!numbers.ok) return jsonResponse({ ok: false, ...status, error: `Quo did not give its numbers (${numbers.words}).` }, 502)
      const members = await quoGet('/users', key)
      if (!members.ok) return jsonResponse({ ok: false, ...status, error: `Quo did not give its people (${members.words}).` }, 502)
      return jsonResponse({ ok: true, ...status, numbers: numbers.items, members: members.items })
    }

    return jsonResponse({ error: `Unknown action: ${action || '(none)'}` }, 400)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('quo-config', message)
    return jsonResponse({ error: message }, 500)
  }
})
