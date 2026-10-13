import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DocsmitClient, DocsmitError, docsmitEnvOf } from '../_shared/docsmitClient.ts'
import { DOCSMIT_SECRET_NAMES, loadDocsmitConfig, type DocsmitSecretName, type MailConfigDb } from '../_shared/mailConfig.ts'

/**
 * mail-config (the Docsmit train, PR 9 — docs/DOCSMIT_LIEN_RUN_PLAN.md, "Managed from Developer settings"):
 * the dev's door to the connection's secrets, which live in Vault (migration 20261013160000). Dev only:
 * Bearer JWT, then role `dev` from `users`, not read-only.
 *
 *   { action: "status" }  → which secrets are set and where each comes from (vault | env | none), the email and
 *                           the base URL as values (neither is secret), which Docsmit (tracksmit | prod). Never a
 *                           password hash or a software id.
 *   { action: "set", email?, password_sha512?, software_id?, base_url? }
 *                         → each given value into Vault (a blank forgets it). The password arrives already hashed:
 *                           the browser takes the SHA-512, so the cleartext never leaves it.
 *   { action: "ping" }    → a token and GET /account/info with what is set: the account's name, the balance, the env.
 *
 * Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY. Gateway verify_jwt = false.
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

const SET_FIELDS: Array<{ field: string; name: DocsmitSecretName; shape?: RegExp; why?: string }> = [
  { field: 'email', name: 'DOCSMIT_EMAIL', shape: /^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/, why: 'an email address' },
  { field: 'password_sha512', name: 'DOCSMIT_PASSWORD_SHA512', shape: /^$|^[0-9a-f]{128}$/i, why: 'the SHA-512 of the password, 128 hex characters' },
  { field: 'software_id', name: 'DOCSMIT_SOFTWARE_ID' },
  { field: 'base_url', name: 'DOCSMIT_BASE_URL', shape: /^$|^https:\/\/secure\.(docsmit|tracksmit)\.com\/api\/v1\/?$/, why: 'https://secure.tracksmit.com/api/v1 or https://secure.docsmit.com/api/v1' },
]

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
    if (!jwt) return jsonResponse({ error: 'Unauthorized' }, 401)
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: authError } = await userClient.auth.getUser(jwt)
    if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401)

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
    const { data: roleRow } = await admin.from('users').select('role, read_only').eq('id', user.id).maybeSingle()
    const role = String((roleRow as { role?: string } | null)?.role ?? '')
    if (role !== 'dev' || (roleRow as { read_only?: boolean } | null)?.read_only) return jsonResponse({ error: 'Developers only' }, 403)
    const db = admin as unknown as MailConfigDb

    if (action === 'set') {
      const written: string[] = []
      const forgotten: string[] = []
      for (const f of SET_FIELDS) {
        const v = str(body[f.field], 400)
        if (v === undefined) continue
        if (f.shape && !f.shape.test(v)) return jsonResponse({ error: `${f.field} needs ${f.why}.` }, 400)
        const { data, error } = await db.rpc('mail_secret_set', { p_name: f.name.toLowerCase(), p_value: f.field === 'password_sha512' ? v.toLowerCase() : v })
        if (error) return jsonResponse({ error: `Could not keep ${f.field}: ${error.message}` }, 500)
        ;(data === true ? written : forgotten).push(f.field)
      }
      if (written.length === 0 && forgotten.length === 0) return jsonResponse({ error: 'Nothing to set: give email, password_sha512, software_id or base_url.' }, 400)
    }

    const { config, source } = await loadDocsmitConfig(db, (k) => Deno.env.get(k))
    const status = {
      set: Object.fromEntries(DOCSMIT_SECRET_NAMES.map((n) => [n, source[n] !== 'none'])),
      source,
      email: config?.email ?? null,
      base_url: config?.baseUrl ?? null,
      env: config ? docsmitEnvOf(config.baseUrl) : null,
      ready: !!config,
    }

    if (action === 'status' || action === 'set') return jsonResponse({ ok: true, ...status })

    if (action === 'ping') {
      if (!config) return jsonResponse({ ok: false, ...status, error: 'Docsmit is not set up: the email, the password hash and the software id are needed.' }, 409)
      const client = new DocsmitClient(config)
      const info = await client.accountInfo()
      return jsonResponse({ ok: true, ...status, account: { name: info.name, credit_balance: info.creditBalance } })
    }

    return jsonResponse({ error: `Unknown action: ${action || '(none)'}` }, 400)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('mail-config', message)
    return jsonResponse({ error: message }, e instanceof DocsmitError ? 502 : 500)
  }
})
