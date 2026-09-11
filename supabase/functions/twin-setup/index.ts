import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DESKTOP_KICKOFF, KICKOFF_CONNECTOR_PLACEHOLDER, PRICING_KICKOFF } from '../_shared/twinKickoffs.ts'

// twin-setup v1.0.0 — "Set up on this Mac" (Price Matrix PR 6, docs/PRICE_MATRIX_PLAN.md).
//
// The one-time setup for a robot on Claude Desktop used to be three hand steps: issue a
// key, paste it into a Terminal command, quit and reopen Desktop. This function collapses
// them to one click and one paste, and the key never touches a person:
//
//   mint   (staff session)  → a short one-time code (≈49 bits, 10 minutes, single use) for
//                             one twin. The app wraps it in a Terminal command.
//   redeem (no auth; the code IS the auth) → burns the code, mints the twin_credentials
//                             token server-side, and returns it with the connector URL and
//                             the kickoff text — the command writes the token into Claude
//                             Desktop's config, restarts Desktop, and puts the kickoff on the
//                             clipboard. The token is returned exactly once, to the machine
//                             that redeemed the code, over TLS.
//
// Who may mint for which twin: devs for any twin; the other estimating-staff roles only for
// a PRICING twin (twin_kind = 'pricer' — the seat that never bids). Key issuance is otherwise
// dev-only (twin_credentials RLS), and this keeps it that way for the bid robots.
// Rate limits: 10 codes per minter per 10 minutes; a miss on redeem costs 400 ms and says
// nothing about why.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CODE_TTL_MS = 10 * 60_000
const MINTS_PER_WINDOW = 10
const MINT_WINDOW_MS = 10 * 60_000
// Crockford-ish alphabet: no 0/O/1/I/L/U — a code read aloud or retyped survives.
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'
const CODE_LEN = 10
const STAFF_ROLES = ['dev', 'master_technician', 'assistant', 'controller', 'estimator']
const TWIN_EMAIL_RE = /^twin-[a-z_]+-\d+@twins\.pipetooling\.local$/

type TwinKind = 'estimator' | 'pricer'
type TwinUser = { id: string; email: string; role: string; is_digital_twin: boolean; twin_kind: string | null; archived_at?: string | null }

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function randomHex(bytes: number): string {
  const a = new Uint8Array(bytes)
  crypto.getRandomValues(a)
  return Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** K7Q2-M9XD-4T — ten symbols from a 30-letter alphabet, rejection-sampled so every symbol is uniform. */
function randomCode(): string {
  const out: string[] = []
  const buf = new Uint8Array(CODE_LEN * 2)
  while (out.length < CODE_LEN) {
    crypto.getRandomValues(buf)
    for (const b of buf) {
      if (b >= 240) continue // 240 = 8 × 30: drop the tail so b % 30 is unbiased
      out.push(CODE_ALPHABET[b % CODE_ALPHABET.length]!)
      if (out.length === CODE_LEN) break
    }
  }
  const s = out.join('')
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`
}

/** What a person might type back: dashes and spaces dropped, upper-cased, the confusable letters mapped. */
export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1')
}

function kindOf(u: Pick<TwinUser, 'twin_kind'>): TwinKind {
  return u.twin_kind === 'pricer' ? 'pricer' : 'estimator'
}

function connectorUrlFor(supabaseUrl: string): string {
  return `${supabaseUrl.trim().replace(/\/+$/, '')}/functions/v1/twin-mcp`
}

function kickoffFor(kind: TwinKind, connectorUrl: string): string {
  const doc = kind === 'pricer' ? PRICING_KICKOFF : DESKTOP_KICKOFF
  return doc.split(KICKOFF_CONNECTOR_PLACEHOLDER).join(connectorUrl)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKey) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, 500)
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const connectorUrl = connectorUrlFor(Deno.env.get('TWIN_MCP_PUBLIC_URL') ?? supabaseUrl)

    let body: Record<string, unknown> = {}
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return json({ error: 'JSON body required' }, 400)
    }
    const action = typeof body.action === 'string' ? body.action : ''

    // ── mint ────────────────────────────────────────────────────────────────
    if (action === 'mint') {
      const auth = req.headers.get('Authorization') ?? ''
      if (!auth.startsWith('Bearer ')) return json({ error: 'Sign in first' }, 401)
      const anon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
      const { data: u } = await anon.auth.getUser()
      if (!u?.user) return json({ error: 'Sign in first' }, 401)
      const { data: me } = await admin.from('users').select('id, role, name').eq('id', u.user.id).maybeSingle()
      if (!me || !STAFF_ROLES.includes(me.role as string)) return json({ error: 'Estimating staff only' }, 403)
      const isDev = me.role === 'dev'

      // Resolve the twin: an explicit id, or "the pricing twin" / "the estimator twin" (lowest seat).
      const twinUserId = typeof body.twin_user_id === 'string' ? body.twin_user_id : ''
      const wantKind: TwinKind | null = body.kind === 'pricer' ? 'pricer' : body.kind === 'estimator' ? 'estimator' : null
      let twin: TwinUser | null = null
      if (twinUserId) {
        const { data } = await admin.from('users').select('id, email, role, is_digital_twin, twin_kind, archived_at').eq('id', twinUserId).maybeSingle()
        twin = (data as TwinUser | null) ?? null
      } else if (wantKind) {
        const { data } = await admin.from('users').select('id, email, role, is_digital_twin, twin_kind, archived_at').eq('is_digital_twin', true).is('archived_at', null).order('email')
        const rows = ((data ?? []) as TwinUser[]).filter((r) => TWIN_EMAIL_RE.test((r.email ?? '').toLowerCase()) && kindOf(r) === wantKind && r.role === 'estimator')
        twin = rows[0] ?? null
        if (!twin) return json({ error: wantKind === 'pricer' ? 'No pricing twin minted yet — a dev mints one at Settings → Digital twins.' : 'No estimator twin minted yet.' }, 404)
      } else {
        return json({ error: 'twin_user_id or kind required' }, 400)
      }
      if (!twin || twin.is_digital_twin !== true || twin.role !== 'estimator' || !TWIN_EMAIL_RE.test((twin.email ?? '').toLowerCase()) || twin.archived_at) {
        return json({ error: 'Not an eligible twin account' }, 404)
      }
      const kind = kindOf(twin)
      if (!isDev && kind !== 'pricer') return json({ error: 'Only a dev can set up a bid robot; the pricing robot is open to estimating staff.' }, 403)

      // Rate limit: codes minted by this person in the window.
      const since = new Date(Date.now() - MINT_WINDOW_MS).toISOString()
      const { count } = await admin.from('twin_setup_codes').select('id', { count: 'exact', head: true }).eq('created_by', me.id).gte('created_at', since)
      if ((count ?? 0) >= MINTS_PER_WINDOW) return json({ error: `Rate limited: ${MINTS_PER_WINDOW} setup codes per 10 minutes`, retry_after_seconds: 600 }, 429)

      const label = (typeof body.label === 'string' ? body.label : '').trim().slice(0, 80) || `${(me.name as string | null) ?? 'someone'}'s Mac`
      const code = randomCode()
      const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString()
      const { error: insErr } = await admin.from('twin_setup_codes').insert({
        twin_user_id: twin.id,
        code_hash: await sha256Hex(normalizeCode(code)),
        label,
        created_by: me.id,
        expires_at: expiresAt,
      })
      if (insErr) return json({ error: `Could not mint a setup code: ${insErr.message}` }, 500)
      return json({
        code,
        expires_at: expiresAt,
        twin_email: twin.email,
        twin_kind: kind,
        label,
        setup_url: `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/twin-setup`,
        connector_url: connectorUrl,
      })
    }

    // ── redeem ──────────────────────────────────────────────────────────────
    if (action === 'redeem') {
      const raw = typeof body.code === 'string' ? body.code : ''
      const norm = normalizeCode(raw)
      if (norm.length !== CODE_LEN) {
        await sleep(400)
        return json({ error: 'That setup code is not valid. Press "Set up on this Mac" again for a fresh one.' }, 404)
      }
      const hash = await sha256Hex(norm)
      const nowIso = new Date().toISOString()
      // The claim: a conditional UPDATE is the lock — two Macs redeeming the same code race
      // here and exactly one wins the row.
      const { data: claimed, error: claimErr } = await admin
        .from('twin_setup_codes')
        .update({ redeemed_at: nowIso, redeemed_from: (typeof body.machine === 'string' ? body.machine : '').slice(0, 120) || null })
        .eq('code_hash', hash)
        .is('redeemed_at', null)
        .gt('expires_at', nowIso)
        .select('id, twin_user_id, label, created_by')
        .maybeSingle()
      if (claimErr) return json({ error: `Redeem failed: ${claimErr.message}` }, 500)
      if (!claimed) {
        await sleep(400)
        return json({ error: 'That setup code is not valid, was already used, or has expired (they last 10 minutes). Press "Set up on this Mac" again for a fresh one.' }, 404)
      }

      const { data: twinRow } = await admin.from('users').select('id, email, role, is_digital_twin, twin_kind, archived_at').eq('id', claimed.twin_user_id).maybeSingle()
      const twin = (twinRow as TwinUser | null) ?? null
      if (!twin || twin.is_digital_twin !== true || twin.role !== 'estimator' || twin.archived_at) {
        return json({ error: 'The robot account behind this code is no longer eligible. Ask a dev.' }, 403)
      }
      const kind = kindOf(twin)

      // Mint the key server-side — the same shape the Settings page mints by hand.
      const token = randomHex(32)
      const { data: cred, error: credErr } = await admin
        .from('twin_credentials')
        .insert({ twin_user_id: twin.id, token_hash: await sha256Hex(token), label: claimed.label || 'Set up on this Mac', created_by: claimed.created_by })
        .select('id')
        .single()
      if (credErr || !cred) return json({ error: `Could not mint the key: ${credErr?.message ?? 'unknown'}. Press "Set up on this Mac" again.` }, 500)
      await admin.from('twin_setup_codes').update({ credential_id: cred.id }).eq('id', claimed.id)
      await admin.from('twin_runs').insert({
        twin_user_id: twin.id,
        mission: 'setup',
        notes: `key "${claimed.label}" set up on ${(typeof body.machine === 'string' && body.machine) || 'a Mac'} via setup code (credential ${cred.id})`,
        ended_at: nowIso,
      })

      return json({
        token,
        twin_email: twin.email,
        twin_kind: kind,
        label: claimed.label,
        connector_url: connectorUrl,
        kickoff: kickoffFor(kind, connectorUrl),
        check_call: kind === 'pricer' ? 'call get_pricing_guide on twin-mcp' : 'call get_brief on twin-mcp',
      })
    }

    return json({ error: `Unknown action ${JSON.stringify(action)} — mint or redeem` }, 400)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
