import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { BRIEF, DIRECTORY, HARNESS, CT_GUIDE, PLACEMENT_GUIDE, MISSIONS } from './briefs.ts'

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
    name: 'get_ct_guide',
    description: 'Completing a bid\'s takeoff in CountTooling — your access, the plans→import→review→counts loop, the import contract, and the hard limits. Read before any CountTooling work.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_placement_guide',
    description: 'The takeoff placement protocol set (docs/twins/PLACEMENT.md + CALIBRATION.md + EXTRACTOR.md) — doorway calibration, counters-first placement, line tracing, registration/snap/density gates, branch sweeps, keyed-note census, printed-total reconciliation. Read before placing or tracing anything.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_mission',
    description: 'One mission, verbatim (M1–M5). You receive only the mission text — scoring is done independently.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Mission id, e.g. M1' } },
      required: ['id'],
    },
  },
  {
    name: 'get_assignments',
    description:
      "Bids where YOUR twin is the assigned estimator — your work queue (assignment is the grant: being the estimator is both the permission and the job). Returns bid number, project, GC, due date, status, and which pipeline links are present.",
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_plan_brief',
    description:
      "The plan substrate for one of your assigned bids: the machine-readable read of the plan set (sheet inventory, fixture schedule, note flags, scale calibrations, reconciliation, scope & risk read). Default returns the rollup brief; full=true returns every per-sheet record. Schema: docs/twins/SUBSTRATE.md.",
    inputSchema: {
      type: 'object',
      properties: {
        bid: { type: 'string', description: "Bid number (e.g. 'b403' or 'BP403') or bid uuid" },
        full: { type: 'boolean', description: 'true = full per-sheet substrate, not just the rollup (large)' },
      },
      required: ['bid'],
    },
  },
  {
    name: 'get_work_state',
    description:
      "One composite read of where a bid stands in the pipeline — your resume after any interruption: bid facts, which links are stamped (Drive/plans/CountTooling), substrate version present, counts rows, and the recent bid-note audit ledger. Reconstruct 'where was I, what's next' from this plus the brief.",
    inputSchema: {
      type: 'object',
      properties: { bid: { type: 'string', description: "Bid number (e.g. 'b403') or bid uuid" } },
      required: ['bid'],
    },
  },
  {
    name: 'ask_question',
    description:
      "Park a question for the owner/operator instead of stalling — the INTERNAL lane (RFIs to the GC are the external lane, drafted in the app's RFI tab). Optionally tied to a bid. Answers arrive asynchronously: pull them next run with get_answers. Asking is always better than guessing.",
    inputSchema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'The question, self-contained (a human reads it cold)' },
        bid: { type: 'string', description: "Optional bid it concerns (e.g. 'b403' or uuid)" },
        mission: { type: 'string', description: 'Optional mission/run label' },
      },
      required: ['question'],
    },
  },
  {
    name: 'get_answers',
    description:
      'Your questions and their answers (newest first) — check this at the START of every run; an answered question may unblock parked work. Promoted questions carry the RFI number they became.',
    inputSchema: { type: 'object', properties: { open_only: { type: 'boolean', description: 'true = only unanswered' } } },
  },
  {
    name: 'heartbeat',
    description:
      "Tell the fleet console what you're doing right now: current bid, pipeline stage, and state (working|blocked|done). Send one when you start, when you block (pair it with ask_question), and when you finish. Cheap; send freely.",
    inputSchema: {
      type: 'object',
      properties: {
        bid: { type: 'string', description: "Bid (e.g. 'b403' or uuid), if the work is bid-scoped" },
        stage: { type: 'string', description: "Pipeline stage, e.g. 'STG-3 takeoff'" },
        state: { type: 'string', enum: ['working', 'blocked', 'done'] },
        note: { type: 'string', description: 'One line of detail' },
      },
      required: ['stage', 'state'],
    },
  },
  {
    name: 'file_plans',
    description:
      "File the plans in Google Drive for one of your bids (pipeline STG-1): creates/reuses the job folder in the shared jobs folder, optionally uploads the plan set from a URL, stamps drive_link/plans_link on the bid, and writes the audit note. Idempotent.",
    inputSchema: {
      type: 'object',
      properties: {
        bid: { type: 'string', description: "Bid (e.g. 'b403' or uuid) — must be yours (assigned/created)" },
        plans_url: { type: 'string', description: 'Optional URL of the plan-set PDF to fetch into the folder' },
        plans_file_name: { type: 'string', description: 'Optional file name for the uploaded plans' },
      },
      required: ['bid'],
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
  {
    name: 'open_backtest',
    description:
      "Open a blind backtest of a human reference bid (pipeline STG-0): creates a 'ZZ Twin <PROJECT> (backtest)' bid owned by and assigned to YOUR twin, copying ONLY the reference's logistics (project name, address, customer, service type, distance, plans link) — never its counts, pricing, value, or outcome, so the blind protocol is structural. Idempotent per reference. Stamps the STG-0 ledger note. Returns a blind-safe reference_grade (A=full scorecard .. D=census-only, X=no plans) computed from field PRESENCE only; quality flags (round value, weak-loss category, staleness) are unseal-time. The reference stays sealed until your STG-6 scorecard stamp.",
    inputSchema: {
      type: 'object',
      properties: {
        reference_bid: { type: 'string', description: "The human bid to re-estimate blind (e.g. 'b370' or uuid)" },
        due_in_days: { type: 'number', description: 'Optional due date offset for the twin bid (default 7)' },
      },
      required: ['reference_bid'],
    },
  },
  {
    name: 'add_bid_note',
    description:
      "Write one entry to a bid's audit ledger — the pipeline's flight recorder ('[pipeline STG-N] …' stamps, scorecards, run logs). Only on bids you created or are the assigned estimator for. Notes never move the follow-up clock.",
    inputSchema: {
      type: 'object',
      properties: {
        bid: { type: 'string', description: "Bid (e.g. 'b406' or uuid) — must be yours (assigned/created)" },
        note: { type: 'string', description: 'The ledger entry text (max 8000 chars)' },
      },
      required: ['bid', 'note'],
    },
  },
  {
    name: 'ct_finish_takeoff',
    description:
      'One-call STG-3 finisher: server-side mints YOUR CountTooling session, imports the takeoff (import-takeoff, idempotent by name), marks the project review-ready, mints a view link, stamps count_tooling_link on the bid, and opens the bid_audits row. The bid number is stamped as external_ref automatically and the plan set rides via plan-fetch — no browser, no scripts. Only on bids you created or are assigned to.',
    inputSchema: {
      type: 'object',
      properties: {
        bid: { type: 'string', description: "Your bid (e.g. 'b410' or uuid) — becomes external_ref and the plan-fetch source" },
        name: { type: 'string', description: 'CT project name (re-import with the same name replaces)' },
        note: { type: 'string', description: 'Optional provenance note stored in the takeoff data' },
        takeoff: { type: 'object', description: 'takeoff.json v1 (counters, lineTypes, pages) — TAKEOFF_IMPORT.md contract' },
        view_name: { type: 'string', description: "Optional view-link label (default '<bid> audit view')" },
        skip_pdf: { type: 'boolean', description: 'Skip the plan-fetch PDF leg (default false)' },
      },
      required: ['bid', 'name', 'takeoff'],
    },
  },
  {
    name: 'get_shadow_queue',
    description:
      'Fleet Phase 1 (shadow bidding): live human bids eligible for a shadow estimate — created recently, plans present, NOT yet sent (so the shadow is blind by nature), not a ZZ bid, not already shadowed. HUMAN-REQUESTED bids (the green robot icon on the Bid Board) come FIRST, oldest ask on top, and bypass the lookback window — work those before the rest. Returns logistics only. Pick one and open_shadow it.',
    inputSchema: {
      type: 'object',
      properties: { days: { type: 'number', description: 'Lookback window in days (default 14)' } },
    },
  },
  {
    name: 'open_shadow',
    description:
      "Open a shadow estimate of a LIVE bid (fleet Phase 1): creates a 'ZZ Shadow <PROJECT>' bid owned by YOUR twin with logistics only, and registers the twin_shadow_runs row. Refused if the reference has already been sent (that would be a backtest — use open_backtest). Idempotent per reference. Estimate it exactly like a backtest, then lock_shadow your total BEFORE the human number exists.",
    inputSchema: {
      type: 'object',
      properties: {
        reference_bid: { type: 'string', description: "The live bid to shadow (e.g. 'b420' or uuid)" },
        axis: { type: 'string', description: "Axis classification for the confidence scoreboard, e.g. 'restaurant-ti', 'warehouse', 'small-ti'" },
      },
      required: ['reference_bid'],
    },
  },
  {
    name: 'lock_shadow',
    description:
      'Lock your shadow total (fleet Phase 1): records the blind total on the twin_shadow_runs row and stamps the ledger. Must happen BEFORE the reference bid is sent; refused after. Scoring is automatic later via score_shadows.',
    inputSchema: {
      type: 'object',
      properties: {
        bid: { type: 'string', description: "Your ZZ Shadow bid (e.g. 'b418' or uuid)" },
        total: { type: 'number', description: 'The locked blind total in dollars' },
      },
      required: ['bid', 'total'],
    },
  },
  {
    name: 'score_shadows',
    description:
      "Score every locked shadow whose reference has since been SENT (bid_value + date present): computes delta vs the human number, marks the run scored, and stamps scorecard notes on both bids. Call at the start of any run — it is the auto-scorecard. Returns the runs scored plus per-axis rolling stats (the confidence scoreboard data).",
    inputSchema: { type: 'object', properties: {} },
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
    case 'get_ct_guide':
      return textContent(CT_GUIDE || 'CountTooling guide not bundled in this deploy — ask the operator to regenerate briefs.ts.')
    case 'get_placement_guide':
      return textContent(PLACEMENT_GUIDE || 'Placement guide not bundled in this deploy — ask the operator to regenerate briefs.ts.')
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
        // CT-4 per-twin credential parity: mirror this token's hash to CT (idempotent,
        // best-effort — needs the manage-user bridge), then mint with the PER-TWIN token.
        // Fall back to the shared fleet secret only if CT doesn't know the token yet.
        const rawToken = presentedToken(req)!
        const bridgeUrl = Deno.env.get('CT_MANAGE_USER_URL')
        const bridgeSecret = Deno.env.get('CT_MANAGE_USER_SECRET')
        if (bridgeUrl && bridgeSecret) {
          try {
            await fetch(bridgeUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Bridge-Secret': bridgeSecret },
              body: JSON.stringify({ verb: 'set_twin_credential', email: ctEmail, token_hash: await sha256Hex(rawToken) }),
            })
          } catch (_) { /* sync best-effort; the secret fallback below still mints */ }
        }
        let res = await fetch(ctUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Twin-Token': rawToken },
          body: JSON.stringify({ email: ctEmail, redirectTo, run: (args.run as string) || 'mcp-mint' }),
        })
        if (res.status === 401) {
          console.log('[twin-mcp] CT per-twin mint refused; falling back to fleet secret')
          res = await fetch(ctUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Twin-Login-Secret': ctSecret },
            body: JSON.stringify({ email: ctEmail, redirectTo, run: (args.run as string) || 'mcp-mint' }),
          })
        }
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
        body: JSON.stringify({ redirectTo: (args.redirectTo as string) || (Deno.env.get('APP_ORIGIN')?.trim() || 'https://pipetooling.com').replace(/\/+$/, '') + '/bids', run: (args.run as string) || 'mcp-mint' }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) return textContent(`Mint failed (${res.status}): ${body.error ?? 'unknown'}`, true)
      return textContent(
        `Signed-in session minted for ${twin.email}.\naction_link (single-use — navigate a browser to it):\n${body.action_link}`,
      )
    }
    case 'ask_question': {
      const q = String(args.question ?? '').trim()
      if (!q) return textContent('Empty question', true)
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      let aboutBidId: string | null = null
      const bidRef = String(args.bid ?? '').trim()
      if (bidRef) {
        const uuidRe = /^[0-9a-f-]{36}$/i
        const { data: b } = await (uuidRe.test(bidRef)
          ? admin.from('bids').select('id').eq('id', bidRef).maybeSingle()
          : admin.from('bids').select('id').eq('bid_number', bidRef.replace(/^(bp|b)/i, '')).maybeSingle())
        aboutBidId = (b as { id: string } | null)?.id ?? null
      }
      const { data: row, error } = await admin
        .from('twin_questions')
        .insert({ twin_user_id: twin.twinUserId, about_bid_id: aboutBidId, mission: (args.mission as string) ?? null, question: q })
        .select('id')
        .single()
      if (error) return textContent(`Question not saved: ${error.message}`, true)
      return textContent(`Question parked (id ${(row as { id: string }).id.slice(0, 8)}). A human answers in the fleet console; pull answers with get_answers on your next run. Keep working what you can.`)
    }
    case 'get_answers': {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      let sel = admin
        .from('twin_questions')
        .select('id, about_bid_id, mission, question, status, answer, answered_at, promoted_rfi_id, created_at')
        .eq('twin_user_id', twin.twinUserId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (args.open_only === true) sel = sel.eq('status', 'open')
      const { data, error } = await sel
      if (error) return textContent(`Lookup failed: ${error.message}`, true)
      if (!data?.length) return textContent(args.open_only === true ? 'No open questions.' : 'No questions yet — ask_question parks one.')
      return textContent(JSON.stringify({ questions: data }, null, 2))
    }
    case 'heartbeat': {
      const stage = String(args.stage ?? '').trim()
      const state = String(args.state ?? '').trim()
      if (!stage || !['working', 'blocked', 'done'].includes(state)) return textContent("heartbeat needs stage + state in {working|blocked|done}", true)
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      let bidId: string | null = null
      const bidRef = String(args.bid ?? '').trim()
      if (bidRef) {
        const uuidRe = /^[0-9a-f-]{36}$/i
        const { data: b } = await (uuidRe.test(bidRef)
          ? admin.from('bids').select('id').eq('id', bidRef).maybeSingle()
          : admin.from('bids').select('id').eq('bid_number', bidRef.replace(/^(bp|b)/i, '')).maybeSingle())
        bidId = (b as { id: string } | null)?.id ?? null
      }
      const { error } = await admin.from('twin_runs').insert({
        twin_user_id: twin.twinUserId,
        mission: 'heartbeat',
        bid_id: bidId,
        stage,
        state,
        notes: `heartbeat stage=${stage} state=${state}${args.note ? ` ${String(args.note).slice(0, 400)}` : ''}`,
        ended_at: state === 'done' ? new Date().toISOString() : null,
      })
      if (error) return textContent(`Heartbeat not recorded: ${error.message}`, true)
      return textContent('Heartbeat recorded.')
    }
    case 'get_assignments': {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { data: bids, error } = await admin
        .from('bids')
        .select('id, bid_number, project_name, bid_due_date, bid_date_sent, outcome, address, drive_link, plans_link, count_tooling_plans_link, customers(name)')
        .eq('estimator_id', twin.twinUserId)
        .order('bid_due_date', { ascending: true, nullsFirst: false })
        .limit(50)
      if (error) return textContent(`Lookup failed: ${error.message}`, true)
      if (!bids?.length) return textContent('No bids are currently assigned to you (estimator = your twin). Ask the operator, or check get_brief for the mission flow.')
      const rows = bids.map((b: Record<string, unknown>) => ({
        bid: b.bid_number ? `b${b.bid_number}` : b.id,
        bid_id: b.id,
        project: b.project_name,
        gc: (b.customers as { name?: string } | null)?.name ?? null,
        due: b.bid_due_date,
        sent: b.bid_date_sent,
        outcome: b.outcome ?? 'open',
        address: b.address,
        links: { drive: !!b.drive_link, plans: !!b.plans_link, counttooling: !!b.count_tooling_plans_link },
      }))
      return textContent(JSON.stringify({ assignments: rows }, null, 2))
    }
    case 'get_plan_brief':
    case 'get_work_state': {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const ref = String(args.bid ?? '').trim()
      if (!ref) return textContent('Missing bid (bid number like b403, or uuid)', true)
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      let q = admin
        .from('bids')
        .select('id, bid_number, project_name, bid_due_date, bid_due_time, bid_date_sent, outcome, bid_value, address, drive_link, plans_link, count_tooling_plans_link, itb_links, estimator_id, created_by, last_contact, customers(name)')
      q = uuidRe.test(ref) ? q.eq('id', ref) : q.eq('bid_number', ref.replace(/^(bp|b)/i, ''))
      const { data: bid, error } = await q.maybeSingle()
      if (error) return textContent(`Bid lookup failed: ${error.message}`, true)
      if (!bid) return textContent(`No bid found for "${ref}"`, true)
      // Assignment is the grant: these reads serve only the twin's own bids.
      if (bid.estimator_id !== twin.twinUserId && bid.created_by !== twin.twinUserId) {
        return textContent(`Bid ${ref} is not assigned to you (estimator) and was not created by you — get_assignments lists your queue.`, true)
      }
      const { data: sub } = await admin
        .from('bids_plan_substrates')
        .select('version, substrate, created_at')
        .eq('bid_id', bid.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (name === 'get_plan_brief') {
        if (!sub) return textContent(`No plan substrate is attached to bid ${ref} yet. The extractor (or operator) attaches one at pipeline stage 2 — see get_brief.`, true)
        const s = sub.substrate as Record<string, unknown>
        const payload = args.full === true
          ? s
          : {
              substrate_version: s.substrate_version,
              generated_at: s.generated_at,
              supersedes: s.supersedes,
              source: s.source,
              bid: s.bid,
              rollup: s.rollup,
              note: 'Rollup only — pass full: true for every per-sheet record (schedules, notes, crops).',
            }
        return textContent(JSON.stringify(payload, null, 2))
      }
      // get_work_state
      const countFor = async (table: string) => {
        const { count } = await admin.from(table).select('id', { count: 'exact', head: true }).eq('bid_id', bid.id)
        return count ?? 0
      }
      const [countRowsCount, exactMappings, roughLines, laborEstimates, priceBookCopies, openQuestions] = await Promise.all([
        countFor('bids_count_rows'),
        countFor('bids_takeoff_template_mappings'),
        countFor('bids_takeoff_rough_part_lines'),
        countFor('cost_estimates'),
        countFor('price_book_versions'),
        admin.from('twin_questions').select('id', { count: 'exact', head: true }).eq('twin_user_id', twin.twinUserId).eq('about_bid_id', bid.id).eq('status', 'open').then((r) => r.count ?? 0),
      ])
      const { data: rfiRows } = await admin.from('bids_rfis').select('rfi_number, status').eq('bid_id', bid.id).order('rfi_number')
      const { data: hb } = await admin
        .from('twin_runs')
        .select('stage, state, notes, started_at')
        .eq('twin_user_id', twin.twinUserId)
        .eq('mission', 'heartbeat')
        .eq('bid_id', bid.id)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      const { data: entries } = await admin
        .from('bids_submission_entries')
        .select('occurred_at, contact_method, notes')
        .eq('bid_id', bid.id)
        .order('occurred_at', { ascending: false })
        .limit(10)
      const state = {
        bid: {
          bid: bid.bid_number ? `b${bid.bid_number}` : bid.id,
          bid_id: bid.id,
          project: bid.project_name,
          gc: (bid.customers as { name?: string } | null)?.name ?? null,
          due: bid.bid_due_date,
          sent: bid.bid_date_sent,
          outcome: bid.outcome ?? 'open',
          bid_value: bid.bid_value,
          last_contact: bid.last_contact,
          address: bid.address,
        },
        links: {
          drive: bid.drive_link ?? null,
          plans: bid.plans_link ?? null,
          counttooling: bid.count_tooling_plans_link ?? null,
          itb: bid.itb_links ?? null,
        },
        substrate: sub ? { version: (sub.substrate as Record<string, unknown>).substrate_version, attached_at: sub.created_at } : null,
        counts_rows: countRowsCount,
        middle: {
          takeoff_exact_mappings: exactMappings,
          takeoff_rough_part_lines: roughLines,
          labor_estimates: laborEstimates,
          price_book_copies: priceBookCopies,
        },
        rfis: (rfiRows ?? []).map((r: Record<string, unknown>) => ({ n: r.rfi_number, status: r.status })),
        open_questions_here: openQuestions,
        latest_heartbeat: hb ? { at: hb.started_at, stage: hb.stage, state: hb.state } : null,
        audit_ledger_tail: (entries ?? []).map((e: Record<string, unknown>) => ({
          at: e.occurred_at, method: e.contact_method ?? 'note', note: String(e.notes ?? '').slice(0, 300),
        })),
        // CT-3 (Wave 3.6 closure): the twin's CountTooling projects with review state —
        // 'changes' + review_note is the reviewer sending the takeoff BACK; fix and
        // re-mark ready. Fetched over the CT bridge; degrades to an error note, never a throw.
        ct_takeoff: await (async () => {
          try {
            const ctUrl = Deno.env.get('CT_MANAGE_USER_URL')
            const ctSecret = Deno.env.get('CT_MANAGE_USER_SECRET')
            if (!ctUrl || !ctSecret) return { error: 'CT bridge not configured' }
            const ctEmail = twin.email.replace('@twins.pipetooling.local', '@twins.counttooling.local')
            const r = await fetch(ctUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Bridge-Secret': ctSecret },
              body: JSON.stringify({ verb: 'twin_projects', email: ctEmail }),
            })
            const body = await r.json()
            if (!r.ok) return { error: `CT bridge ${r.status}: ${body?.error ?? 'unknown'}` }
            const projects = body.projects ?? []
            // Notes-ledger loop (2026-08-30): pull the note ledger of the most
            // recently touched project — open RFIs are questions still waiting,
            // answered ones carry the reviewer's answer (read before re-asking).
            let rfis: unknown = null
            const newest = projects[0]
            if (newest?.id) {
              try {
                const rr = await fetch(ctUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'X-Bridge-Secret': ctSecret },
                  body: JSON.stringify({ verb: 'twin_rfis', email: ctEmail, project_id: newest.id }),
                })
                const rb = await rr.json()
                rfis = rr.ok ? rb : { error: `twin_rfis ${rr.status}: ${rb?.error ?? 'unknown'}` }
              } catch (e) {
                rfis = { error: String(e instanceof Error ? e.message : e) }
              }
            }
            return { projects, notes_ledger: rfis }
          } catch (e) {
            return { error: String(e instanceof Error ? e.message : e) }
          }
        })(),
      }
      return textContent(JSON.stringify(state, null, 2))
    }
    case 'file_plans': {
      // Thin pass-through to drive-intake — the token re-authenticates there and the
      // assignment check runs server-side; this keeps Drive logic single-sourced.
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const res = await fetch(`${supabaseUrl}/functions/v1/drive-intake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Twin-Token': presentedToken(req)! },
        body: JSON.stringify({ bid: args.bid, plans_url: args.plans_url, plans_file_name: args.plans_file_name }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) return textContent(`file_plans failed (${res.status}): ${body.error ?? 'unknown'}`, true)
      return textContent(JSON.stringify(body, null, 2))
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
    case 'open_backtest': {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const ref = String(args.reference_bid ?? '').trim()
      if (!ref) return textContent('Missing reference_bid (bid number like b370, or uuid)', true)
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      // Logistics fields ONLY — the blind protocol is structural: counts, pricing,
      // bid_value, and outcome are never selected here and never reach the caller.
      let rq = admin.from('bids').select('id, bid_number, project_name, address, customer_id, service_type_id, distance_from_office, plans_link, gc_builder_id')
      rq = uuidRe.test(ref) ? rq.eq('id', ref) : rq.eq('bid_number', ref.replace(/^(bp|b)/i, ''))
      const { data: refBid, error: refErr } = await rq.maybeSingle()
      if (refErr) return textContent(`Reference lookup failed: ${refErr.message}`, true)
      if (!refBid) return textContent(`No bid found for "${ref}"`, true)
      // Reference data-grade (v2.2545) — PRESENCE booleans only, blind-safe: says
      // whether a scorecard will be possible, never what the sealed fields hold.
      // Quality flags (round value, weak-loss category, staleness) are unseal-time
      // only — see FEEDBACK_LOOP.md "Reference grading".
      const [{ count: countRows }, { count: pricingRows }, { data: presence }] = await Promise.all([
        admin.from('bids_count_rows').select('id', { count: 'exact', head: true }).eq('bid_id', refBid.id),
        admin.from('bid_pricing_assignments').select('id', { count: 'exact', head: true }).eq('bid_id', refBid.id),
        admin.from('bids').select('id').eq('id', refBid.id).not('bid_value', 'is', null).maybeSingle(),
      ])
      const hasPlans = !!String(refBid.plans_link ?? '').trim()
      const hasValue = !!presence
      const hasCounts = (countRows ?? 0) > 0
      const hasPricing = (pricingRows ?? 0) > 0
      const referenceGrade = !hasPlans ? 'X' : hasValue && hasCounts && hasPricing ? 'A' : hasValue ? 'B' : hasCounts ? 'C' : 'D'
      const gradeNote = referenceGrade === 'A' ? 'full scorecard possible'
        : referenceGrade === 'B' ? 'dollar-level scorecard only (no reference takeoff rows)'
        : referenceGrade === 'C' ? 'quantity scorecard only (no reliable reference value)'
        : referenceGrade === 'D' ? 'census reps only — no scorecard'
        : 'no plans — not backtestable'
      const ztName = `ZZ Twin ${String(refBid.project_name ?? 'UNKNOWN').toUpperCase()} (backtest)`
      const { data: existing } = await admin
        .from('bids').select('id, bid_number').eq('created_by', twin.twinUserId).eq('project_name', ztName).maybeSingle()
      if (existing) {
        return textContent(JSON.stringify({ ok: true, reused: true, bid: `b${existing.bid_number}`, bid_id: existing.id, name: ztName, reference_grade: referenceGrade, grade_note: gradeNote }, null, 2))
      }
      const dueDays = Number(args.due_in_days ?? 7)
      const due = new Date(Date.now() + (Number.isFinite(dueDays) && dueDays > 0 ? dueDays : 7) * 86400_000).toISOString().slice(0, 10)
      const { data: created, error: insErr } = await admin
        .from('bids')
        .insert({
          project_name: ztName,
          address: refBid.address,
          customer_id: refBid.customer_id,
          service_type_id: refBid.service_type_id,
          distance_from_office: refBid.distance_from_office,
          plans_link: refBid.plans_link,
          gc_builder_id: refBid.gc_builder_id,
          bid_due_date: due,
          created_by: twin.twinUserId,
          estimator_id: twin.twinUserId,
          // v2.2530: pair the twin copy with its human source — drives the Bid
          // Board robot-readiness icon's "robot bid exists" state.
          twin_source_bid_id: refBid.id,
          notes: `Blind backtest of b${refBid.bid_number}. Reference sealed until the STG-6 scorecard stamp. Opened via twin-mcp open_backtest.`,
        })
        .select('id, bid_number')
        .single()
      if (insErr) return textContent(`Backtest bid not created: ${insErr.message}`, true)
      await admin.from('bids_submission_entries').insert({
        bid_id: created.id,
        notes: `[pipeline STG-0] Blind backtest of b${refBid.bid_number} (${refBid.project_name}) opened via twin-mcp open_backtest by ${twin.email}. Logistics copied (address, customer, service type, distance ${refBid.distance_from_office ?? '?'} mi, plans link); reference counts/pricing/outcome SEALED until STG-6.`,
      }).then(() => {}, () => {})
      return textContent(JSON.stringify({
        ok: true, reused: false, bid: `b${created.bid_number}`, bid_id: created.id, name: ztName,
        reference_grade: referenceGrade, grade_note: gradeNote,
        logistics: { address: refBid.address, distance_from_office: refBid.distance_from_office, plans_link: !!refBid.plans_link, due },
        next: 'file_plans if plans_link is empty; then substrate (STG-2), takeoff (STG-3), counts+books (STG-5), scorecard (STG-6) — compute quality flags (round value, weak-loss, stale) at unseal and stamp grade+flags on the scorecard; gate denominators take A/B gate-eligible refs only.',
      }, null, 2))
    }
    case 'add_bid_note': {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const ref = String(args.bid ?? '').trim()
      const note = String(args.note ?? '').trim()
      if (!ref || !note) return textContent('add_bid_note needs bid + note', true)
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      let q = admin.from('bids').select('id, bid_number, estimator_id, created_by')
      q = uuidRe.test(ref) ? q.eq('id', ref) : q.eq('bid_number', ref.replace(/^(bp|b)/i, ''))
      const { data: bid, error } = await q.maybeSingle()
      if (error) return textContent(`Bid lookup failed: ${error.message}`, true)
      if (!bid) return textContent(`No bid found for "${ref}"`, true)
      if (bid.estimator_id !== twin.twinUserId && bid.created_by !== twin.twinUserId) {
        return textContent(`Bid ${ref} is not yours (assigned/created) — notes land only on your own bids.`, true)
      }
      const { error: insErr } = await admin.from('bids_submission_entries').insert({ bid_id: bid.id, notes: note.slice(0, 8000) })
      if (insErr) return textContent(`Note not saved: ${insErr.message}`, true)
      return textContent(`Note recorded on b${bid.bid_number} (${note.length > 120 ? note.slice(0, 120) + '…' : note})`)
    }
    case 'ct_finish_takeoff': {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      // 0. Fence: the bid must be the twin's own (assigned/created), same rule as add_bid_note.
      const ref = String(args.bid ?? '').trim()
      const projName = String(args.name ?? '').trim()
      const takeoff = args.takeoff
      if (!ref || !projName || !takeoff || typeof takeoff !== 'object') {
        return textContent('ct_finish_takeoff needs bid + name + takeoff (v1 object)', true)
      }
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      let bq = admin.from('bids').select('id, bid_number, estimator_id, created_by')
      bq = uuidRe.test(ref) ? bq.eq('id', ref) : bq.eq('bid_number', ref.replace(/^(bp|b)/i, ''))
      const { data: bid, error: bidErr } = await bq.maybeSingle()
      if (bidErr) return textContent(`Bid lookup failed: ${bidErr.message}`, true)
      if (!bid) return textContent(`No bid found for "${ref}"`, true)
      if (bid.estimator_id !== twin.twinUserId && bid.created_by !== twin.twinUserId) {
        return textContent(`Bid ${ref} is not yours (assigned/created) — takeoffs land only on your own bids.`, true)
      }
      const bidTag = `b${bid.bid_number}`

      // 1. Mint a CT session server-side: per-twin token first, fleet secret fallback
      //    (same path as mint_session), then walk the magic link ourselves — the verify
      //    redirect's fragment carries the access_token, no browser required.
      const ctLoginUrl = Deno.env.get('CT_TWIN_LOGIN_URL')
      const ctSecret = Deno.env.get('COUNTTOOLING_TWIN_LOGIN_SECRET')
      if (!ctLoginUrl) return textContent('CT_TWIN_LOGIN_URL not configured on this server', true)
      const ctBase = new URL(ctLoginUrl).origin
      // CT publishable anon key (ships in the CT client's config.js — public by design).
      const CT_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhycXh2ZnlkbXZ0dndodmVmbXFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzODM0NTMsImV4cCI6MjA4Nzk1OTQ1M30.dqn8DwO-dc0z2GwunCfEo5VO8lPRUGaN6ruzAm33HSs'
      const ctEmail = twin.email.replace('@twins.pipetooling.local', '@twins.counttooling.local')
      const rawToken = presentedToken(req)!
      let mintRes = await fetch(ctLoginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Twin-Token': rawToken },
        body: JSON.stringify({ email: ctEmail, redirectTo: 'https://counttooling.com', run: `ct-finish:${bidTag}` }),
      })
      if (mintRes.status === 401 && ctSecret) {
        mintRes = await fetch(ctLoginUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Twin-Login-Secret': ctSecret },
          body: JSON.stringify({ email: ctEmail, redirectTo: 'https://counttooling.com', run: `ct-finish:${bidTag}` }),
        })
      }
      const mintBody = await mintRes.json().catch(() => ({}))
      if (!mintRes.ok || !mintBody.action_link) {
        return textContent(`CT mint failed (${mintRes.status}): ${mintBody.error ?? 'unknown'}`, true)
      }
      const verifyRes = await fetch(mintBody.action_link, { redirect: 'manual' })
      const loc = verifyRes.headers.get('location') ?? ''
      const jwtMatch = loc.match(/access_token=([^&]+)/)
      if (!jwtMatch) return textContent(`CT verify did not yield a session (status ${verifyRes.status}) — link may be expired`, true)
      const ctJwt = jwtMatch[1]

      // 2. Import the takeoff. external_ref is ALWAYS the bid tag (bid-stamp doctrine);
      //    the plan set rides via plan-fetch with the caller's own token.
      const importBody: Record<string, unknown> = {
        name: projName,
        note: String(args.note ?? '').slice(0, 400) || `twin-mcp ct_finish_takeoff for ${bidTag}`,
        external_ref: bidTag,
        takeoff,
      }
      if (args.skip_pdf !== true) {
        // Default: the bid's own plan set via plan-fetch. pdf_url overrides for the
        // oversized-set fallback (a compressed copy staged elsewhere) — https only.
        const pdfOverride = String(args.pdf_url ?? '').trim()
        if (pdfOverride && !/^https:\/\//.test(pdfOverride)) return textContent('pdf_url must be https', true)
        importBody.pdf_url = pdfOverride || `${supabaseUrl}/functions/v1/plan-fetch?bid=${bidTag}`
        importBody.pdf_headers = pdfOverride ? undefined : { 'X-Twin-Token': rawToken }
      }
      const impRes = await fetch(`${ctBase}/functions/v1/import-takeoff`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ctJwt}`, apikey: CT_ANON, 'Content-Type': 'application/json' },
        body: JSON.stringify(importBody),
      })
      const impBody = await impRes.json().catch(() => ({}))
      if (!impRes.ok || !impBody.project_id) {
        return textContent(`import-takeoff failed (${impRes.status}): ${JSON.stringify(impBody).slice(0, 600)}`, true)
      }
      const projectId = impBody.project_id as string

      // 3. Review-ready + view link (best-effort loud: failures reported, marks kept).
      const rpcHeaders = { Authorization: `Bearer ${ctJwt}`, apikey: CT_ANON, 'Content-Type': 'application/json' }
      const readyRes = await fetch(`${ctBase}/rest/v1/rpc/set_project_review_status`, {
        method: 'POST', headers: rpcHeaders,
        body: JSON.stringify({ p_project_id: projectId, p_status: 'ready' }),
      })
      const linkRes = await fetch(`${ctBase}/rest/v1/rpc/create_view_link`, {
        method: 'POST', headers: rpcHeaders,
        body: JSON.stringify({ p_project_id: projectId, p_name: String(args.view_name ?? '').trim() || `${bidTag} audit view` }),
      })
      const linkBody = await linkRes.json().catch(() => ({}))
      const viewUrl = linkBody?.token ? `https://counttooling.com/app/?t=${linkBody.token}` : null

      // 4. PT side: stamp count_tooling_link + open the audit row (idempotent).
      if (viewUrl) {
        await admin.from('bids').update({ count_tooling_link: viewUrl }).eq('id', bid.id).then(() => {}, () => {})
        const { data: existingAudit } = await admin.from('bid_audits').select('id').eq('bid_id', bid.id).maybeSingle()
        if (!existingAudit) {
          await admin.from('bid_audits').insert({
            bid_id: bid.id, ct_project_id: projectId, ct_view_url: viewUrl,
            status: 'pending', created_by: twin.twinUserId,
          }).then(() => {}, () => {})
        }
      }
      await admin.from('twin_runs').insert({
        twin_user_id: twin.twinUserId,
        mission: `ct-finish:${bidTag}`,
        notes: `project=${projectId} markers=${impBody.counter_count ?? '?'} pdf=${impBody.pdf ? (impBody.pdf.ok ? 'ok' : 'FAIL') : 'skipped'} view=${viewUrl ?? 'none'}`,
        ended_at: new Date().toISOString(),
      }).then(() => {}, () => {})

      return textContent(JSON.stringify({
        ok: true, bid: bidTag, project_id: projectId, replaced: !!impBody.replaced,
        counter_count: impBody.counter_count ?? null, line_count: impBody.line_count ?? null,
        pdf: impBody.pdf ?? null, review_ready: readyRes.ok, view_url: viewUrl,
        audit: viewUrl ? 'bid_audits row ensured + count_tooling_link stamped' : 'view link failed — audit row not created',
      }, null, 2))
    }
    case 'get_shadow_queue': {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const days = Number(args.days ?? 14)
      const since = new Date(Date.now() - (Number.isFinite(days) && days > 0 ? days : 14) * 86400_000).toISOString()
      // Logistics only — pricing fields don't exist yet on eligible bids by definition
      // (bid_date_sent IS NULL is the blindness guarantee), and are never selected anyway.
      const QUEUE_COLS = 'id, bid_number, project_name, address, distance_from_office, bid_due_date, plans_link, created_at, robot_requested_at, robot_requested_by'
      // v2.2543: human-requested bids (the green robot icon) come first and bypass
      // the lookback window — a person's ask shouldn't age out of the queue.
      const [recentRes, requestedRes] = await Promise.all([
        admin
          .from('bids')
          .select(QUEUE_COLS)
          .is('bid_date_sent', null)
          .not('plans_link', 'is', null)
          .gte('created_at', since)
          .not('project_name', 'ilike', 'ZZ %')
          .order('created_at', { ascending: false })
          .limit(25),
        admin
          .from('bids')
          .select(QUEUE_COLS)
          .is('bid_date_sent', null)
          .not('plans_link', 'is', null)
          .not('robot_requested_at', 'is', null)
          .not('project_name', 'ilike', 'ZZ %')
          .order('robot_requested_at', { ascending: true })
          .limit(25),
      ])
      if (recentRes.error) return textContent(`Queue lookup failed: ${recentRes.error.message}`, true)
      if (requestedRes.error) return textContent(`Queue lookup failed: ${requestedRes.error.message}`, true)
      const { data: shadowed } = await admin.from('twin_shadow_runs').select('reference_bid_id')
      const taken = new Set((shadowed ?? []).map((r: { reference_bid_id: string }) => r.reference_bid_id))
      type QueueRow = { id: string; bid_number: string; project_name: string | null; address: string | null; distance_from_office: number | null; bid_due_date: string | null; plans_link: string | null; created_at: string | null; robot_requested_at: string | null; robot_requested_by: string | null }
      const eligible = (rows: QueueRow[] | null) => (rows ?? []).filter((b) => !taken.has(b.id) && String(b.plans_link ?? '').trim() !== '')
      const requested = eligible(requestedRes.data as QueueRow[] | null)
      const requestedIds = new Set(requested.map((b) => b.id))
      const rest = eligible(recentRes.data as QueueRow[] | null).filter((b) => !requestedIds.has(b.id))
      const requesterIds = [...new Set(requested.map((b) => b.robot_requested_by).filter((x): x is string => !!x))]
      const { data: requesters } = requesterIds.length
        ? await admin.from('users').select('id, name').in('id', requesterIds)
        : { data: [] as Array<{ id: string; name: string | null }> }
      const nameById = new Map((requesters ?? []).map((u: { id: string; name: string | null }) => [u.id, u.name]))
      const toEntry = (b: QueueRow) => ({
        bid: `b${b.bid_number}`,
        project: b.project_name,
        address: b.address,
        miles: b.distance_from_office,
        due: b.bid_due_date,
        created: b.created_at,
        ...(b.robot_requested_at
          ? { requested: true, requested_at: b.robot_requested_at, requested_by: (b.robot_requested_by && nameById.get(b.robot_requested_by)) || null }
          : {}),
      })
      const queue = [...requested.map(toEntry), ...rest.map(toEntry)]
      return textContent(JSON.stringify({ eligible: queue.length, requested: requested.length, queue, next: 'open_shadow(reference_bid, axis) on one — requested entries first. Then estimate exactly like a backtest and lock_shadow before the human number exists.' }, null, 2))
    }
    case 'open_shadow': {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const ref = String(args.reference_bid ?? '').trim()
      if (!ref) return textContent('Missing reference_bid', true)
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      let rq = admin.from('bids').select('id, bid_number, project_name, address, customer_id, service_type_id, distance_from_office, plans_link, gc_builder_id, bid_due_date, bid_date_sent')
      rq = uuidRe.test(ref) ? rq.eq('id', ref) : rq.eq('bid_number', ref.replace(/^(bp|b)/i, ''))
      const { data: refBid, error: refErr } = await rq.maybeSingle()
      if (refErr) return textContent(`Reference lookup failed: ${refErr.message}`, true)
      if (!refBid) return textContent(`No bid found for "${ref}"`, true)
      if (refBid.bid_date_sent) {
        return textContent(`b${refBid.bid_number} has already been SENT — a shadow would not be blind. Use open_backtest instead.`, true)
      }
      const { data: existingRun } = await admin.from('twin_shadow_runs').select('id, shadow_bid_id, status').eq('reference_bid_id', refBid.id).maybeSingle()
      if (existingRun) {
        const { data: sb } = await admin.from('bids').select('bid_number').eq('id', existingRun.shadow_bid_id).maybeSingle()
        return textContent(JSON.stringify({ ok: true, reused: true, shadow_bid: `b${sb?.bid_number}`, status: existingRun.status }, null, 2))
      }
      const ztName = `ZZ Shadow ${String(refBid.project_name ?? 'UNKNOWN').toUpperCase()}`
      const { data: created, error: insErr } = await admin
        .from('bids')
        .insert({
          project_name: ztName,
          address: refBid.address,
          customer_id: refBid.customer_id,
          service_type_id: refBid.service_type_id,
          distance_from_office: refBid.distance_from_office,
          plans_link: refBid.plans_link,
          gc_builder_id: refBid.gc_builder_id,
          bid_due_date: refBid.bid_due_date,
          // v2.2543: pair the shadow with its live source so the Bid Board's
          // robot icon turns colorful the moment the shadow opens.
          twin_source_bid_id: refBid.id,
          created_by: twin.twinUserId,
          estimator_id: twin.twinUserId,
          notes: `Shadow estimate of live bid b${refBid.bid_number} (fleet Phase 1). Blind by nature — opened before the human number exists. Opened via twin-mcp open_shadow.`,
        })
        .select('id, bid_number')
        .single()
      if (insErr) return textContent(`Shadow bid not created: ${insErr.message}`, true)
      const { error: runErr } = await admin.from('twin_shadow_runs').insert({
        shadow_bid_id: created.id, reference_bid_id: refBid.id, twin_user_id: twin.twinUserId,
        axis: String(args.axis ?? '').trim() || null,
      })
      if (runErr) return textContent(`Shadow run not registered: ${runErr.message}`, true)
      await admin.from('bids_submission_entries').insert({
        bid_id: created.id,
        notes: `[shadow STG-0] Shadow of live b${refBid.bid_number} (${refBid.project_name}) opened by ${twin.email}. Axis: ${String(args.axis ?? '') || 'unclassified'}. Lock the blind total with lock_shadow BEFORE the human bid is sent; score_shadows finishes the loop automatically.`,
      }).then(() => {}, () => {})
      return textContent(JSON.stringify({
        ok: true, reused: false, shadow_bid: `b${created.bid_number}`, shadow_bid_id: created.id,
        reference: `b${refBid.bid_number}`, axis: String(args.axis ?? '') || null,
        next: 'Estimate like a backtest (census -> counts -> pricing), then lock_shadow(bid, total).',
      }, null, 2))
    }
    case 'lock_shadow': {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const ref = String(args.bid ?? '').trim()
      const total = Number(args.total)
      if (!ref || !Number.isFinite(total) || total <= 0) return textContent('lock_shadow needs bid + positive total', true)
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      let bq = admin.from('bids').select('id, bid_number')
      bq = uuidRe.test(ref) ? bq.eq('id', ref) : bq.eq('bid_number', ref.replace(/^(bp|b)/i, ''))
      const { data: bid } = await bq.maybeSingle()
      if (!bid) return textContent(`No bid found for "${ref}"`, true)
      const { data: run, error: runErr } = await admin.from('twin_shadow_runs')
        .select('id, status, reference_bid_id, twin_user_id').eq('shadow_bid_id', bid.id).maybeSingle()
      if (runErr || !run) return textContent(`No shadow run for b${bid.bid_number}`, true)
      if (run.twin_user_id !== twin.twinUserId) return textContent('Not your shadow run', true)
      if (run.status === 'scored') return textContent('Run already scored — locking refused', true)
      const { data: refBid } = await admin.from('bids').select('bid_number, bid_date_sent').eq('id', run.reference_bid_id).maybeSingle()
      if (refBid?.bid_date_sent) {
        return textContent(`Reference b${refBid.bid_number} was SENT before you locked — this run is contaminated. Marking nothing; flag it in the ledger and drop the run.`, true)
      }
      const { error } = await admin.from('twin_shadow_runs')
        .update({ status: 'locked', locked_total: total, locked_at: new Date().toISOString() })
        .eq('id', run.id)
      if (error) return textContent(`Lock failed: ${error.message}`, true)
      await admin.from('bids_submission_entries').insert({
        bid_id: bid.id,
        notes: `[shadow LOCK] Blind total $${total.toLocaleString()} locked at ${new Date().toISOString()} — before the human number exists. Scoring is automatic when the reference is sent.`,
      }).then(() => {}, () => {})
      return textContent(JSON.stringify({ ok: true, shadow_bid: `b${bid.bid_number}`, locked_total: total, status: 'locked' }, null, 2))
    }
    case 'score_shadows': {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { data: locked, error } = await admin.from('twin_shadow_runs')
        .select('id, shadow_bid_id, reference_bid_id, axis, locked_total').eq('status', 'locked')
      if (error) return textContent(`Lookup failed: ${error.message}`, true)
      const scored: Array<Record<string, unknown>> = []
      for (const run of locked ?? []) {
        const { data: refBid } = await admin.from('bids')
          .select('bid_number, project_name, bid_value, bid_date_sent, outcome').eq('id', run.reference_bid_id).maybeSingle()
        if (!refBid?.bid_date_sent || refBid.bid_value == null) continue
        const refVal = Number(refBid.bid_value)
        const delta = refVal > 0 ? ((Number(run.locked_total) - refVal) / refVal) * 100 : null
        await admin.from('twin_shadow_runs').update({
          status: 'scored', reference_value: refVal,
          delta_pct: delta == null ? null : Math.round(delta * 10) / 10,
          scored_at: new Date().toISOString(),
        }).eq('id', run.id)
        const { data: sb } = await admin.from('bids').select('bid_number').eq('id', run.shadow_bid_id).maybeSingle()
        const line = `[shadow SCORECARD] Twin locked $${Number(run.locked_total).toLocaleString()} (blind, pre-send) vs human $${refVal.toLocaleString()} = ${delta == null ? 'n/a' : (delta > 0 ? '+' : '') + (Math.round(delta * 10) / 10) + '%'} — axis ${run.axis ?? 'unclassified'}, reference b${refBid.bid_number} (${refBid.project_name}).`
        await admin.from('bids_submission_entries').insert({ bid_id: run.shadow_bid_id, notes: line }).then(() => {}, () => {})
        await admin.from('bids_submission_entries').insert({ bid_id: run.reference_bid_id, notes: line }).then(() => {}, () => {})
        scored.push({ shadow_bid: `b${sb?.bid_number}`, reference: `b${refBid.bid_number}`, axis: run.axis, locked: run.locked_total, human: refVal, delta_pct: delta == null ? null : Math.round(delta * 10) / 10 })
      }
      // Confidence scoreboard: rolling per-axis stats over all scored runs.
      const { data: allScored } = await admin.from('twin_shadow_runs')
        .select('axis, delta_pct, scored_at').eq('status', 'scored').order('scored_at', { ascending: false })
      const byAxis: Record<string, number[]> = {}
      for (const r of allScored ?? []) (byAxis[r.axis ?? 'unclassified'] ??= []).push(Number(r.delta_pct))
      const scoreboard = Object.entries(byAxis).map(([axis, deltas]) => ({
        axis, runs: deltas.length,
        mean_abs_pct: Math.round((deltas.reduce((s, d) => s + Math.abs(d), 0) / deltas.length) * 10) / 10,
        last5_in_8pct: deltas.slice(0, 5).filter((d) => Math.abs(d) <= 8).length,
        gate_b_met: deltas.length >= 5 && deltas.slice(0, 5).every((d) => Math.abs(d) <= 8),
      }))
      return textContent(JSON.stringify({ newly_scored: scored, scoreboard }, null, 2))
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
        serverInfo: { name: 'pipetooling-twin-mcp', version: '1.3.2' },
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
