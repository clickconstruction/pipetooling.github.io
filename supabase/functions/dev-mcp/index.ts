import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { CATALOG_RPCS, CATALOG_TABLES } from './catalog.ts'
import { DENIED_TABLES, FILTER_OPS, ROWS_DEFAULT_LIMIT, ROWS_MAX_LIMIT, buildRowsQuery, buildRpcQuery, isSafeIdent, redactSecrets, replyText, searchNames } from '../_shared/devMcpDoor.ts'
import { mcpHandler, mcpText, type McpTool, type McpToolResult } from '../_shared/mcpJsonRpc.ts'

// dev-mcp (to-dos/mcp-servers.md, PR 4b; owner decisions 2026-09-20) — the MCP server a
// DEV's agent reads PipeTooling through. Public address: https://mcp.clicktooling.com/dev
// (the mcp-router Worker, a pass-through).
//
// It reads AS THE DEV, not as the service role. A key (X-Dev-Token, or Authorization:
// Bearer) resolves to a person in dev_mcp_credentials; the function mints that person's
// own session (generateLink + verifyOtp — no email is sent, nothing is stored) and calls
// the app's own API with it, GET ONLY. PostgREST runs GET in a read-only transaction, so
// the database refuses a write whatever an RPC is named, and RLS plus every auth.uid()
// role check apply exactly as on the screen. The service role is used for three things
// only: resolving the key, minting the session, writing the call log.
//
// catalog.ts is GENERATED from src/types/database.ts by scripts/build-dev-mcp-catalog.mjs
// — regenerate after gen-types, then redeploy.

const SERVER_VERSION = '0.1.0'

const TOOLS: McpTool[] = [
  {
    name: 'whoami',
    description: 'Who this key reads as (name, email, role) and the limits of the door. Call it first: every other verb sees exactly what this person sees in the app.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'find_rpc',
    description: "Search the app's RPCs (database functions) by name — every word must appear, e.g. 'job ledger' or 'crew day'. Returns up to 25 names with their arguments and return shape, from the generated catalog. Use it before call_read; never guess a name.",
    inputSchema: { type: 'object', properties: { text: { type: 'string', description: "Words from the name, e.g. 'search jobs'" } }, required: ['text'] },
  },
  {
    name: 'find_table',
    description: "Search tables and views by name — every word must appear, e.g. 'ledger payments'. Returns up to 25 names with their kind and column count. Then get_table for the columns.",
    inputSchema: { type: 'object', properties: { text: { type: 'string', description: "Words from the name, e.g. 'clock sessions'" } }, required: ['text'] },
  },
  {
    name: 'get_table',
    description: 'The columns and types of one table or view, from the generated catalog. Columns marked secret are redacted from every reply and cannot be filtered on.',
    inputSchema: { type: 'object', properties: { table: { type: 'string', description: 'Exact table or view name' } }, required: ['table'] },
  },
  {
    name: 'call_read',
    description: "Call any RPC as yourself, read-only. It goes over GET, which the database runs in a read-only transaction: an RPC that writes fails with 'cannot execute … in a read-only transaction' — that is the door working, not a bug; such an RPC is not a read. Arrays and objects are fine as args; omit an arg to take its SQL default. For a set-returning RPC, `limit` trims the rows.",
    inputSchema: {
      type: 'object',
      properties: {
        rpc: { type: 'string', description: 'Exact RPC name (find_rpc)' },
        args: { type: 'object', description: 'Named arguments, as find_rpc lists them' },
        limit: { type: 'number', description: `Rows to return from a set-returning RPC (1–${ROWS_MAX_LIMIT})` },
      },
      required: ['rpc'],
    },
  },
  {
    name: 'read_rows',
    description: `Read rows of a table or view as yourself — RLS applies, so an empty result can mean "not visible to you". PostgREST select syntax (embeds like 'id,job_name,customers(name)' work). Default ${ROWS_DEFAULT_LIMIT} rows, at most ${ROWS_MAX_LIMIT}.`,
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string', description: 'Exact table or view name (find_table)' },
        select: { type: 'string', description: "Columns, PostgREST syntax. Default '*'" },
        filters: {
          type: 'array',
          description: `[{ column, op, value }] — op is one of ${FILTER_OPS.join(', ')}; 'in' takes an array, 'is' takes null/true/false; like/ilike use * as the wildcard`,
          items: { type: 'object' },
        },
        order: { type: 'array', description: '[{ column, ascending? }]', items: { type: 'object' } },
        limit: { type: 'number', description: `1–${ROWS_MAX_LIMIT}, default ${ROWS_DEFAULT_LIMIT}` },
      },
      required: ['table'],
    },
  },
]

const INSTRUCTIONS =
  "PipeTooling dev seat — read-only, and you read AS THE DEV whose key this is: RLS and every role check apply as in the app. Call whoami first. Find names with find_rpc / find_table / get_table (a generated catalog — never guess), then call_read (any RPC, over GET: the database itself refuses writes) or read_rows (any table or view, at most 200 rows). Secret columns (tokens, hashes, passwords) come back redacted. This is PRODUCTION data about real customers and employees: read what the task needs, and quote it sparingly."

type Admin = ReturnType<typeof createClient>
type ResolvedDev = { credentialId: string; userId: string; email: string; name: string | null }

function env(name: string): string {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`${name} not configured`)
  return v
}

async function sha256Hex(s: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function presentedToken(req: Request): string | null {
  const header = req.headers.get('X-Dev-Token')?.trim()
  if (header) return header
  const auth = req.headers.get('Authorization')?.trim() ?? ''
  const m = auth.match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : null
}

async function resolveDev(admin: Admin, req: Request): Promise<ResolvedDev | { error: string }> {
  const token = presentedToken(req)
  if (!token) return { error: 'Missing X-Dev-Token (or Authorization: Bearer) — this server needs your dev key (Settings → Your account → Dev MCP keys).' }
  const { data: cred, error } = await admin.from('dev_mcp_credentials').select('id, user_id, revoked_at').eq('token_hash', await sha256Hex(token)).maybeSingle()
  if (error) return { error: `Key lookup failed: ${error.message}` }
  const row = cred as { id: string; user_id: string; revoked_at: string | null } | null
  if (!row || row.revoked_at) return { error: 'Unknown or revoked dev key.' }
  // Re-checked on every call: a demoted or archived dev's keys stop working on their own.
  const { data: user } = await admin.from('users').select('id, email, name, role, archived_at, is_digital_twin').eq('id', row.user_id).maybeSingle()
  const u = user as { id: string; email: string; name: string | null; role: string; archived_at: string | null; is_digital_twin: boolean | null } | null
  if (!u || u.role !== 'dev' || u.archived_at || u.is_digital_twin) return { error: 'This key belongs to an account that is not an active dev.' }
  admin.from('dev_mcp_credentials').update({ last_used_at: new Date().toISOString() }).eq('id', row.id).then(() => undefined, () => undefined)
  return { credentialId: row.id, userId: u.id, email: u.email, name: u.name }
}

// One session per person per warm instance; minted again a minute before it expires.
const sessions = new Map<string, { jwt: string; expiresAtMs: number }>()

async function sessionFor(admin: Admin, dev: ResolvedDev): Promise<string> {
  const cached = sessions.get(dev.userId)
  if (cached && cached.expiresAtMs - Date.now() > 60_000) return cached.jwt
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email: dev.email })
  const tokenHash = link?.properties?.hashed_token
  if (linkErr || !tokenHash) throw new Error(`could not mint your session: ${linkErr?.message ?? 'no token returned'}`)
  const anon = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: verified, error: verifyErr } = await anon.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash })
  const session = verified?.session
  if (verifyErr || !session?.access_token) throw new Error(`could not verify your session: ${verifyErr?.message ?? 'no session returned'}`)
  sessions.set(dev.userId, { jwt: session.access_token, expiresAtMs: (session.expires_at ?? 0) * 1000 })
  return session.access_token
}

/** The only way this server reads business data: a GET against the app's own API, as the dev. */
async function restGet(jwt: string, path: string, query: string): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await fetch(`${env('SUPABASE_URL')}/rest/v1/${path}${query ? `?${query}` : ''}`, {
    method: 'GET',
    headers: { apikey: env('SUPABASE_ANON_KEY'), Authorization: `Bearer ${jwt}`, Accept: 'application/json' },
  })
  const text = await res.text()
  let body: unknown = text
  try {
    body = text ? JSON.parse(text) : null
  } catch { /* a non-JSON reply is reported as text */ }
  return { ok: res.ok, status: res.status, body }
}

type CallLog = { verb: string; target?: string | null; args: Record<string, unknown>; status: 'ok' | 'error' | 'refused'; rowCount?: number | null; error?: string | null }

async function logCall(admin: Admin, dev: ResolvedDev, startedMs: number, log: CallLog): Promise<void> {
  try {
    await admin.from('dev_mcp_calls').insert({
      credential_id: dev.credentialId,
      user_id: dev.userId,
      verb: log.verb,
      target: log.target ?? null,
      args: loggableArgs(log.args),
      status: log.status,
      row_count: log.rowCount ?? null,
      duration_ms: Date.now() - startedMs,
      error: log.error ? log.error.slice(0, 1000) : null,
    })
  } catch { /* the log never fails a read */ }
}

/** Args as logged: whole when small, else a marked preview — the log is for tracing, not replay. */
function loggableArgs(args: Record<string, unknown>): Record<string, unknown> {
  const text = JSON.stringify(args ?? {})
  return text.length <= 4000 ? (args ?? {}) : { truncated: true, preview: text.slice(0, 3900) }
}

function rowCountOf(body: unknown): number | null {
  return Array.isArray(body) ? body.length : body == null ? 0 : 1
}

function restError(status: number, body: unknown): string {
  const b = body as { message?: string; code?: string; hint?: string; details?: string } | null
  const msg = b && typeof b === 'object' ? [b.message, b.details, b.hint].filter(Boolean).join(' — ') : String(body)
  const readOnly = b && typeof b === 'object' && (b.code === '25006' || /read-only transaction/i.test(b.message ?? ''))
  return readOnly
    ? `Refused by the database: this RPC writes, and the door is read-only (${msg}).`
    : `The app's API answered ${status}${b && typeof b === 'object' && b.code ? ` (${b.code})` : ''}: ${msg}`
}

async function callTool(req: Request, name: string, args: Record<string, unknown>): Promise<McpToolResult> {
  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { autoRefreshToken: false, persistSession: false } })
  const dev = await resolveDev(admin, req)
  if ('error' in dev) return mcpText(`Auth failed: ${dev.error}`, true)
  const started = Date.now()
  const done = async (log: Omit<CallLog, 'verb' | 'args'>, text: string, isError = false) => {
    await logCall(admin, dev, started, { verb: name, args, ...log })
    return mcpText(text, isError)
  }

  switch (name) {
    case 'whoami':
      return done({ status: 'ok' }, replyText({
        reads_as: { name: dev.name, email: dev.email, role: 'dev' },
        door: { method: 'GET only — the database runs it in a read-only transaction', row_limit: ROWS_MAX_LIMIT, secrets: 'token / hash / password columns are redacted', never_read: [...DENIED_TABLES] },
        catalog: { tables_and_views: Object.keys(CATALOG_TABLES).length, rpcs: Object.keys(CATALOG_RPCS).length },
        server: `pipetooling-dev-mcp ${SERVER_VERSION}`,
      }))

    case 'find_rpc': {
      const hits = searchNames(Object.keys(CATALOG_RPCS), String(args.text ?? ''))
      return done({ status: 'ok', rowCount: hits.length }, replyText({ matches: hits.map((n) => ({ rpc: n, signatures: CATALOG_RPCS[n] })), note: hits.length === 0 ? 'No RPC name contains every word — try fewer or different words.' : undefined }))
    }

    case 'find_table': {
      const hits = searchNames(Object.keys(CATALOG_TABLES).filter((t) => !DENIED_TABLES.has(t)), String(args.text ?? ''))
      return done({ status: 'ok', rowCount: hits.length }, replyText({ matches: hits.map((n) => ({ table: n, kind: CATALOG_TABLES[n].kind, columns: Object.keys(CATALOG_TABLES[n].columns).length })) }))
    }

    case 'get_table': {
      const table = String(args.table ?? '')
      const entry = CATALOG_TABLES[table]
      if (!entry || DENIED_TABLES.has(table)) return done({ status: 'refused', target: table, error: 'unknown table' }, `No table or view named "${table}" in the catalog — find_table searches names.`, true)
      return done({ status: 'ok', target: table }, replyText({ table, kind: entry.kind, columns: entry.columns }))
    }

    case 'call_read': {
      const rpc = String(args.rpc ?? '')
      if (!isSafeIdent(rpc) || !CATALOG_RPCS[rpc]) return done({ status: 'refused', target: rpc, error: 'unknown rpc' }, `No RPC named "${rpc}" in the catalog — find_rpc searches names.`, true)
      const rpcArgs = (args.args && typeof args.args === 'object' && !Array.isArray(args.args) ? args.args : {}) as Record<string, unknown>
      const built = buildRpcQuery(rpcArgs, typeof args.limit === 'number' ? args.limit : undefined)
      if (!built.ok) return done({ status: 'refused', target: rpc, error: built.error }, built.error, true)
      const res = await restGet(await sessionFor(admin, dev), `rpc/${rpc}`, built.query)
      if (!res.ok) {
        const message = restError(res.status, res.body)
        return done({ status: 'error', target: rpc, error: message }, message, true)
      }
      return done({ status: 'ok', target: rpc, rowCount: rowCountOf(res.body) }, replyText(redactSecrets(res.body)))
    }

    case 'read_rows': {
      const table = String(args.table ?? '')
      const entry = CATALOG_TABLES[table]
      if (!isSafeIdent(table) || !entry) return done({ status: 'refused', target: table, error: 'unknown table' }, `No table or view named "${table}" in the catalog — find_table searches names.`, true)
      if (DENIED_TABLES.has(table)) return done({ status: 'refused', target: table, error: 'denied table' }, `"${table}" holds credentials and is never read through this server.`, true)
      const built = buildRowsQuery({ select: args.select, filters: args.filters, order: args.order, limit: args.limit }, new Set(Object.keys(entry.columns)))
      if (!built.ok) return done({ status: 'refused', target: table, error: built.error }, built.error, true)
      const res = await restGet(await sessionFor(admin, dev), table, built.query)
      if (!res.ok) {
        const message = restError(res.status, res.body)
        return done({ status: 'error', target: table, error: message }, message, true)
      }
      const rows = rowCountOf(res.body)
      return done({ status: 'ok', target: table, rowCount: rows }, replyText({ rows, note: rows === 0 ? 'No rows — nothing matches, or RLS hides it from you.' : undefined, data: redactSecrets(res.body) }))
    }

    default:
      return done({ status: 'refused', error: 'unknown tool' }, `Unknown tool: ${name}`, true)
  }
}

serve(mcpHandler({
  name: 'pipetooling-dev-mcp',
  version: SERVER_VERSION,
  instructions: INSTRUCTIONS,
  tools: TOOLS,
  authHeaders: ['x-dev-token'],
  callTool,
}))
