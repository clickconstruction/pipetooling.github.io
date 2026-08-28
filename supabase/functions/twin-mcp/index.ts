import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { BRIEF, DIRECTORY, HARNESS, MISSIONS } from './briefs.ts'

// Digital twins MCP server (docs/DIGITAL_TWINS_PLAN.md; owner-approved 2026-08-28).
// A minimal, dependency-free Model Context Protocol server over streamable HTTP
// (stateless JSON-RPC POST; GET → 405, no SSE — permitted by the MCP spec) so ANY
// MCP-capable agent (Claude, Grok/xAI, GPT, …) can hold a twin seat without a browser
// harness of its own for the setup steps. The WORK still happens in the app UI — this
// server mints sessions and carries documents; it exposes no business data.
//
// Auth: every tools/call requires the per-twin token (X-Twin-Token header, or
// Authorization: Bearer <token>) — the same credential twin-login v2 accepts, resolved
// against twin_credentials (sha256). initialize / tools/list are open metadata.
// mint_session passes the token THROUGH to twin-login so the four account guards, the
// 6/min rate limit, and the twin_runs mint log all stay single-sourced there.
//
// briefs.ts is GENERATED from docs/twins/* by scripts/build-twin-mcp-briefs.mjs —
// regenerate + redeploy after editing the docs. Missions carry only the verbatim
// mission text (never the scorer's verification).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-twin-token, mcp-session-id, mcp-protocol-version',
}

const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']

const TOOLS = [
  {
    name: 'mint_session',
    description:
      "Mint a signed-in session for YOUR twin on the deployed apps: PipeTooling (default) or CountTooling (app: 'counttooling' — the PDF-takeoff tool where estimating starts). Returns an action_link — navigate a browser to it and you are signed in (single-use; sessions expire after hours, re-mint then). One credential covers both apps. Rate limit 6/minute across both.",
    inputSchema: {
      type: 'object',
      properties: {
        app: { type: 'string', enum: ['pipetooling', 'counttooling'], description: "Which app to sign into (default 'pipetooling')" },
        redirectTo: { type: 'string', description: 'Where to land, e.g. https://pipetooling.com/bids (or a counttooling.com URL with app: counttooling)' },
        run: { type: 'string', description: 'Mission id or label for the fleet ledger, e.g. M1' },
      },
    },
  },
  {
    name: 'get_brief',
    description: 'Your role brief (docs/twins/estimator.md) — read this first: identity, map, permissions, core loops, vocabulary, guardrails.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_directory',
    description: 'The app directory (docs/twins/APP_DIRECTORY.md) — every route, a task→URL index, per-role nav.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_harness_guide',
    description: 'The harness kit (docs/twins/TWIN_HARNESS.md) — auth, session semantics, rules of engagement, safety rungs.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_mission',
    description: 'One mission, verbatim (M1, M2, M3). You receive only the mission text — scoring is done independently.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Mission id, e.g. M1' } },
      required: ['id'],
    },
  },
  {
    name: 'submit_report',
    description: 'File your mission report (answer, evidence, stumbles). Lands in the twin_runs fleet ledger attributed to your twin.',
    inputSchema: {
      type: 'object',
      properties: {
        mission: { type: 'string', description: 'Mission id, e.g. M1' },
        report: { type: 'string', description: 'Your full report text' },
      },
      required: ['mission', 'report'],
    },
  },
]

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
function rpcResult(id: unknown, result: unknown) {
  return { jsonrpc: '2.0', id, result }
}
function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: '2.0', id, error: { code, message } }
}
function textContent(text: string, isError = false) {
  return { content: [{ type: 'text', text }], isError }
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function presentedToken(req: Request): string | null {
  const direct = req.headers.get('X-Twin-Token')
  if (direct) return direct.trim()
  const auth = req.headers.get('Authorization')
  if (auth?.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim()
  return null
}

async function resolveTwin(req: Request): Promise<{ twinUserId: string; email: string; credId: string } | { error: string; status: number }> {
  const token = presentedToken(req)
  if (!token) return { error: 'Missing X-Twin-Token (or Authorization: Bearer) — this MCP server requires your per-twin token.', status: 401 }
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!serviceRoleKey) return { error: 'Server not configured', status: 500 }
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const hash = await sha256Hex(token)
  const { data: cred, error } = await admin.from('twin_credentials').select('id, twin_user_id, revoked_at').eq('token_hash', hash).maybeSingle()
  if (error) return { error: `Credential lookup failed: ${error.message}`, status: 500 }
  if (!cred || cred.revoked_at) return { error: 'Unknown or revoked twin token', status: 401 }
  const { data: user } = await admin.from('users').select('email, is_digital_twin, role').eq('id', cred.twin_user_id).maybeSingle()
  if (!user || user.is_digital_twin !== true || user.role !== 'estimator') return { error: 'Twin account not eligible', status: 403 }
  return { twinUserId: cred.twin_user_id, email: user.email as string, credId: cred.id as string }
}

async function callTool(req: Request, name: string, args: Record<string, unknown>) {
  // Docs tools work with a valid token too, but auth is required for every call.
  const twin = await resolveTwin(req)
  if ('error' in twin) return textContent(`Auth failed: ${twin.error}`, true)

  switch (name) {
    case 'get_brief':
      return textContent(BRIEF)
    case 'get_directory':
      return textContent(DIRECTORY)
    case 'get_harness_guide':
      return textContent(HARNESS || 'Harness guide not bundled in this deploy — ask the operator to regenerate briefs.ts.')
    case 'get_mission': {
      const m = MISSIONS[String(args.id ?? '').toUpperCase()]
      if (!m) return textContent(`Unknown mission id. Available: ${Object.keys(MISSIONS).join(', ')}`, true)
      return textContent(`# ${m.title}\nPrerequisites: ${m.prerequisites}\n\nMISSION (verbatim):\n${m.text}`)
    }
    case 'mint_session': {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const app = String(args.app ?? 'pipetooling')
      if (app === 'counttooling') {
        // Two-app companion (v2.2439): this server holds CountTooling's twin secret, so
        // one per-twin credential covers both apps (locked decision — CT per-twin
        // credential parity stays deferred). PT's twin-login isn't in this path, so its
        // guards don't run — re-apply the essentials here: the twin was already
        // resolved+eligibility-checked above, and the 6/min rate limit is enforced
        // against the shared twin_runs ledger before minting.
        const ctUrl = Deno.env.get('CT_TWIN_LOGIN_URL')
        const ctSecret = Deno.env.get('COUNTTOOLING_TWIN_LOGIN_SECRET')
        if (!ctUrl || !ctSecret) return textContent('CountTooling minting is not configured on this server (CT_TWIN_LOGIN_URL / COUNTTOOLING_TWIN_LOGIN_SECRET)', true)
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
        const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString()
        const { count } = await admin
          .from('twin_runs')
          .select('id', { count: 'exact', head: true })
          .eq('twin_user_id', twin.twinUserId)
          .gte('started_at', oneMinuteAgo)
        if ((count ?? 0) >= 6) return textContent('Rate limited: max 6 mints per minute per twin (across both apps). Wait a minute and retry.', true)
        const ctEmail = twin.email.replace('@twins.pipetooling.local', '@twins.counttooling.local')
        const redirectTo = (args.redirectTo as string) || 'https://counttooling.com'
        const res = await fetch(ctUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Twin-Login-Secret': ctSecret },
          body: JSON.stringify({ email: ctEmail, redirectTo, run: (args.run as string) || 'mcp-mint' }),
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) return textContent(`CountTooling mint failed (${res.status}): ${body.error ?? 'unknown'}`, true)
        try {
          await admin.from('twin_runs').insert({
            twin_user_id: twin.twinUserId,
            mission: (args.run as string) || 'mcp-mint',
            notes: `mint via=token:${twin.credId} app=counttooling redirect=${redirectTo}`,
          })
        } catch (_) { /* ledger best-effort */ }
        return textContent(
          `Signed-in CountTooling session minted for ${ctEmail}.\naction_link (single-use — navigate a browser to it):\n${body.action_link}`,
        )
      }
      const res = await fetch(`${supabaseUrl}/functions/v1/twin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Twin-Token': presentedToken(req)! },
        body: JSON.stringify({ redirectTo: (args.redirectTo as string) || 'https://pipetooling.com/bids', run: (args.run as string) || 'mcp-mint' }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) return textContent(`Mint failed (${res.status}): ${body.error ?? 'unknown'}`, true)
      return textContent(
        `Signed-in session minted for ${twin.email}.\naction_link (single-use — navigate a browser to it):\n${body.action_link}`,
      )
    }
    case 'submit_report': {
      const mission = String(args.mission ?? '').trim() || 'unlabeled'
      const report = String(args.report ?? '').trim()
      if (!report) return textContent('Empty report', true)
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { error } = await admin.from('twin_runs').insert({
        twin_user_id: twin.twinUserId,
        mission: `report:${mission}`,
        notes: report.slice(0, 8000),
        ended_at: new Date().toISOString(),
      })
      if (error) return textContent(`Report not saved: ${error.message}`, true)
      return textContent(`Report filed for ${mission} — it is in the fleet ledger, attributed to ${twin.email}.`)
    }
    default:
      return textContent(`Unknown tool: ${name}`, true)
  }
}

async function handleRpc(req: Request, msg: { jsonrpc?: string; id?: unknown; method?: string; params?: Record<string, unknown> }) {
  const { id, method, params } = msg
  switch (method) {
    case 'initialize': {
      const requested = (params?.protocolVersion as string) ?? PROTOCOL_VERSIONS[0]
      const version = PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0]
      return rpcResult(id, {
        protocolVersion: version,
        capabilities: { tools: {} },
        serverInfo: { name: 'pipetooling-twin-mcp', version: '1.0.0' },
        instructions:
          "PipeTooling digital-twin seat (estimator-only). Call get_brief first, then get_directory; mint_session gives you a signed-in browser link to the real apps — PipeTooling by default, CountTooling (the PDF-takeoff tool) with app: 'counttooling'. The work happens there. Every call needs your per-twin token (X-Twin-Token or Bearer).",
      })
    }
    case 'ping':
      return rpcResult(id, {})
    case 'tools/list':
      return rpcResult(id, { tools: TOOLS })
    case 'tools/call': {
      const name = params?.name as string
      const args = (params?.arguments as Record<string, unknown>) ?? {}
      try {
        const result = await callTool(req, name, args)
        return rpcResult(id, result)
      } catch (e) {
        return rpcResult(id, textContent(`Tool error: ${String(e)}`, true))
      }
    }
    default:
      if (method?.startsWith('notifications/')) return null // notifications get no response
      return rpcError(id, -32601, `Method not found: ${method}`)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method === 'GET') {
    // No server-initiated stream — spec-permitted for stateless servers.
    return new Response('twin-mcp: MCP streamable-HTTP endpoint. POST JSON-RPC here.', { status: 405, headers: corsHeaders })
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json(rpcError(null, -32700, 'Parse error'), 400)
  }

  if (Array.isArray(body)) {
    const responses = []
    for (const msg of body) {
      const r = await handleRpc(req, msg)
      if (r) responses.push(r)
    }
    return responses.length > 0 ? json(responses) : new Response(null, { status: 202, headers: corsHeaders })
  }

  const response = await handleRpc(req, body as Record<string, unknown>)
  return response ? json(response) : new Response(null, { status: 202, headers: corsHeaders })
})
