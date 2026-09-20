import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { CATALOG_RPCS, CATALOG_TABLES } from './catalog.ts'
import { DENIED_TABLES, FILTER_OPS, ROWS_DEFAULT_LIMIT, ROWS_MAX_LIMIT, buildRowsQuery, buildRpcQuery, isSafeIdent, redactSecrets, replyText, searchNames } from '../_shared/devMcpDoor.ts'
import { mcpHandler, mcpText, type McpTool, type McpToolResult } from '../_shared/mcpJsonRpc.ts'
import { findBid, findCustomer, findJob, findPerson, getBid, getCustomer, getJob, type Reader, type Row, type RowsQuery } from '../_shared/devMcpComposites.ts'
import { todayYmdInAppTz } from '../_shared/appTimeZone.ts'

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

const SERVER_VERSION = '0.2.0'

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
  {
    name: 'find_job',
    description: "Find jobs by number ('J1032', '1032'), name or address — the app's own job search. Returns ids with the label the app shows. Use the id with get_job.",
    inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  },
  {
    name: 'find_bid',
    description: "Find bids by number ('b482'), project or customer — the app's own bid search. Returns ids with the label the app shows.",
    inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  },
  {
    name: 'find_customer',
    description: 'Find customers by name (active ones). Returns ids.',
    inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  },
  {
    name: 'find_person',
    description: 'Find people by name, as the rosters list them: active, human, not a sample account. Returns ids with role.',
    inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  },
  {
    name: 'get_job',
    description: "What the Job window shows for one job: the header, the money (profit = revenue − the four parts buckets − sub labor, and billed / open — computed by the Job window's own kernels), invoices and payments, the account strip, stages, hours, and recent activity. `job` is an id, or text that matches exactly one job. A part that could not be read says so in place.",
    inputSchema: { type: 'object', properties: { job: { type: 'string', description: "Job id, or a number like 'J1032'" } }, required: ['job'] },
  },
  {
    name: 'get_customer',
    description: "What the Customer hub shows: the profile, the money (lifetime value, open balance, aging, days-to-pay — the hub's own kernels), contacts, addresses, jobs, bids and estimates. `customer` is an id, or a name that matches exactly one customer.",
    inputSchema: { type: 'object', properties: { customer: { type: 'string' } }, required: ['customer'] },
  },
  {
    name: 'get_bid',
    description: "One bid's stored facts: the row, count rows, pricing assignments, versions, sends, the submission ledger and the account strip. The priced total on Bids → Pricing is computed in a client hook and is NOT restated here — the reply says so. `bid` is an id, or text that matches exactly one bid.",
    inputSchema: { type: 'object', properties: { bid: { type: 'string', description: "Bid id, or a number like 'b482'" } }, required: ['bid'] },
  },
  {
    name: 'view_as',
    description: "Run one read verb as someone else, to see what THEY see: `role` reads as that role's sample account (e.g. 'helpers', 'estimator', 'subcontractor'), `user` as a named person (id). The app's Imitate rule applies — a dev account is never a target. Both identities are logged. `verb` is any read verb of this server except view_as.",
    inputSchema: {
      type: 'object',
      properties: {
        role: { type: 'string', description: "A role with a sample account, e.g. 'helpers'" },
        user: { type: 'string', description: 'A user id (find_person)' },
        verb: { type: 'string', description: 'whoami, read_rows, call_read, find_*, get_job, get_customer, get_bid' },
        args: { type: 'object', description: "The inner verb's arguments" },
      },
      required: ['verb'],
    },
  },
]

const INSTRUCTIONS =
  "PipeTooling dev seat — read-only, and you read AS THE DEV whose key this is: RLS and every role check apply as in the app. Call whoami first. Find names with find_rpc / find_table / get_table (a generated catalog — never guess), then call_read (any RPC, over GET: the database itself refuses writes) or read_rows (any table or view, at most 200 rows). For the common questions use the named verbs — find_job / find_bid / find_customer / find_person, then get_job / get_customer / get_bid, whose money comes from the screens' own kernels. view_as runs any of these as a role's sample account or a named person. Secret columns (tokens, hashes, passwords) come back redacted. This is PRODUCTION data about real customers and employees: read what the task needs, and quote it sparingly."

type Admin = ReturnType<typeof createClient>
type ResolvedDev = { credentialId: string; userId: string; email: string; name: string | null }
type Identity = { userId: string; email: string; name: string | null; role: string }

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

async function sessionFor(admin: Admin, dev: { userId: string; email: string }): Promise<string> {
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

type CallLog = { verb: string; target?: string | null; args: Record<string, unknown>; status: 'ok' | 'error' | 'refused'; rowCount?: number | null; error?: string | null; asUserId?: string | null }

async function logCall(admin: Admin, dev: ResolvedDev, startedMs: number, log: CallLog): Promise<void> {
  try {
    await admin.from('dev_mcp_calls').insert({
      credential_id: dev.credentialId,
      user_id: dev.userId,
      as_user_id: log.asUserId ?? null,
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

type Outcome = { log: Omit<CallLog, 'verb' | 'args'>; text: string; isError?: boolean }
const ok = (payload: unknown, log: Partial<CallLog> = {}): Outcome => ({ log: { status: 'ok', ...log }, text: replyText(payload) })
const refused = (text: string, log: Partial<CallLog> = {}): Outcome => ({ log: { status: 'refused', error: text, ...log }, text, isError: true })

/** A `Reader` that GETs as one person. Every composite read goes through the same two checks the generic door makes. */
function readerAs(jwt: string): Reader {
  return {
    rpc: async (name, args = {}, limit) => {
      if (!isSafeIdent(name) || !CATALOG_RPCS[name]) throw new Error(`no RPC named "${name}" in the catalog`)
      const built = buildRpcQuery(args, limit)
      if (!built.ok) throw new Error(built.error)
      const res = await restGet(jwt, `rpc/${name}`, built.query)
      if (!res.ok) throw new Error(restError(res.status, res.body))
      return redactSecrets(res.body)
    },
    rows: async (table: string, query: RowsQuery) => {
      const entry = CATALOG_TABLES[table]
      if (!isSafeIdent(table) || !entry || DENIED_TABLES.has(table)) throw new Error(`"${table}" is not a readable table`)
      const built = buildRowsQuery(query, new Set(Object.keys(entry.columns)))
      if (!built.ok) throw new Error(built.error)
      const res = await restGet(jwt, table, built.query)
      if (!res.ok) throw new Error(restError(res.status, res.body))
      return (Array.isArray(res.body) ? redactSecrets(res.body) : []) as Row[]
    },
  }
}

const composite = (out: unknown, target: string): Outcome =>
  out && typeof out === 'object' && 'refused' in (out as object) ? refused(String((out as { refused: string }).refused), { target }) : ok(out, { target })

/** One read verb, as `who`. `jwt` is minted lazily: the catalog verbs never need a session. */
async function runVerb(who: Identity, jwt: () => Promise<string>, name: string, args: Record<string, unknown>): Promise<Outcome> {
  switch (name) {
    case 'whoami':
      return ok({
        reads_as: { name: who.name, email: who.email, role: who.role },
        door: { method: 'GET only — the database runs it in a read-only transaction', row_limit: ROWS_MAX_LIMIT, secrets: 'token / hash / password columns are redacted', never_read: [...DENIED_TABLES] },
        catalog: { tables_and_views: Object.keys(CATALOG_TABLES).length, rpcs: Object.keys(CATALOG_RPCS).length },
        server: `pipetooling-dev-mcp ${SERVER_VERSION}`,
      })

    case 'find_rpc': {
      const hits = searchNames(Object.keys(CATALOG_RPCS), String(args.text ?? ''))
      return ok({ matches: hits.map((n) => ({ rpc: n, signatures: CATALOG_RPCS[n] })), note: hits.length === 0 ? 'No RPC name contains every word — try fewer or different words.' : undefined }, { rowCount: hits.length })
    }

    case 'find_table': {
      const hits = searchNames(Object.keys(CATALOG_TABLES).filter((t) => !DENIED_TABLES.has(t)), String(args.text ?? ''))
      return ok({ matches: hits.map((n) => ({ table: n, kind: CATALOG_TABLES[n].kind, columns: Object.keys(CATALOG_TABLES[n].columns).length })) }, { rowCount: hits.length })
    }

    case 'get_table': {
      const table = String(args.table ?? '')
      const entry = CATALOG_TABLES[table]
      if (!entry || DENIED_TABLES.has(table)) return refused(`No table or view named "${table}" in the catalog — find_table searches names.`, { target: table })
      return ok({ table, kind: entry.kind, columns: entry.columns }, { target: table })
    }

    case 'call_read': {
      const rpc = String(args.rpc ?? '')
      if (!isSafeIdent(rpc) || !CATALOG_RPCS[rpc]) return refused(`No RPC named "${rpc}" in the catalog — find_rpc searches names.`, { target: rpc })
      const rpcArgs = (args.args && typeof args.args === 'object' && !Array.isArray(args.args) ? args.args : {}) as Record<string, unknown>
      const built = buildRpcQuery(rpcArgs, typeof args.limit === 'number' ? args.limit : undefined)
      if (!built.ok) return refused(built.error, { target: rpc })
      const res = await restGet(await jwt(), `rpc/${rpc}`, built.query)
      if (!res.ok) {
        const message = restError(res.status, res.body)
        return { log: { status: 'error', target: rpc, error: message }, text: message, isError: true }
      }
      return ok(redactSecrets(res.body), { target: rpc, rowCount: rowCountOf(res.body) })
    }

    case 'read_rows': {
      const table = String(args.table ?? '')
      const entry = CATALOG_TABLES[table]
      if (!isSafeIdent(table) || !entry) return refused(`No table or view named "${table}" in the catalog — find_table searches names.`, { target: table })
      if (DENIED_TABLES.has(table)) return refused(`"${table}" holds credentials and is never read through this server.`, { target: table })
      const built = buildRowsQuery({ select: args.select, filters: args.filters, order: args.order, limit: args.limit }, new Set(Object.keys(entry.columns)))
      if (!built.ok) return refused(built.error, { target: table })
      const res = await restGet(await jwt(), table, built.query)
      if (!res.ok) {
        const message = restError(res.status, res.body)
        return { log: { status: 'error', target: table, error: message }, text: message, isError: true }
      }
      const rows = rowCountOf(res.body)
      return ok({ rows, note: rows === 0 ? 'No rows — nothing matches, or RLS hides it from this reader.' : undefined, data: redactSecrets(res.body) }, { target: table, rowCount: rows })
    }

    case 'find_job':
      return ok(await findJob(readerAs(await jwt()), String(args.text ?? '')), { target: 'search_jobs_ledger' })
    case 'find_bid':
      return ok(await findBid(readerAs(await jwt()), String(args.text ?? '')), { target: 'search_bids_for_clock' })
    case 'find_customer':
      return ok(await findCustomer(readerAs(await jwt()), String(args.text ?? '')), { target: 'customers' })
    case 'find_person':
      return ok(await findPerson(readerAs(await jwt()), String(args.text ?? '')), { target: 'users' })
    case 'get_job':
      return composite(await getJob(readerAs(await jwt()), String(args.job ?? ''), todayYmdInAppTz()), 'jobs_ledger')
    case 'get_customer':
      return composite(await getCustomer(readerAs(await jwt()), String(args.customer ?? ''), todayYmdInAppTz()), 'customers')
    case 'get_bid':
      return composite(await getBid(readerAs(await jwt()), String(args.bid ?? '')), 'bids')

    default:
      return refused(`Unknown tool: ${name}`)
  }
}

/** view_as's target: a role's sample account, or a person by id. The app's Imitate rule holds — never a dev. */
async function resolveViewAsTarget(admin: Admin, args: Record<string, unknown>): Promise<Identity | { error: string }> {
  const role = typeof args.role === 'string' ? args.role.trim() : ''
  const user = typeof args.user === 'string' ? args.user.trim() : ''
  if (!!role === !!user) return { error: 'view_as needs exactly one of `role` (its sample account) or `user` (a user id).' }
  if (role && !/^[a-z_]+$/.test(role)) return { error: `"${role}" is not a role name.` }
  if (user && !/^[0-9a-f-]{36}$/i.test(user)) return { error: '`user` must be a user id — find_person resolves a name.' }
  const query = admin.from('users').select('id, email, name, role, archived_at, is_sample')
  const { data, error } = role ? await query.eq('role', role).eq('is_sample', true).is('archived_at', null).limit(1).maybeSingle() : await query.eq('id', user).maybeSingle()
  if (error) return { error: `Could not look up the target: ${error.message}` }
  const u = data as { id: string; email: string; name: string | null; role: string; archived_at: string | null } | null
  if (!u) return { error: role ? `No sample account for role "${role}" — create it on Settings → People & teams → Active accounts (View as).` : `No user ${user}.` }
  if (u.archived_at) return { error: 'That account is archived.' }
  if (u.role === 'dev') return { error: 'A dev account is never a view_as target (the same rule as Imitate).' }
  return { userId: u.id, email: u.email, name: u.name, role: u.role }
}

async function callTool(req: Request, name: string, args: Record<string, unknown>): Promise<McpToolResult> {
  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { autoRefreshToken: false, persistSession: false } })
  const dev = await resolveDev(admin, req)
  if ('error' in dev) return mcpText(`Auth failed: ${dev.error}`, true)
  const started = Date.now()
  const finish = async (out: Outcome, asUserId: string | null = null) => {
    await logCall(admin, dev, started, { verb: name, args, asUserId, ...out.log })
    return mcpText(out.text, out.isError === true)
  }

  try {
    if (name === 'view_as') {
      const verb = String(args.verb ?? '')
      if (!verb || verb === 'view_as') return finish(refused('view_as needs a `verb` — any read verb of this server except view_as.'))
      const target = await resolveViewAsTarget(admin, args)
      if ('error' in target) return finish(refused(target.error))
      const inner = (args.args && typeof args.args === 'object' && !Array.isArray(args.args) ? args.args : {}) as Record<string, unknown>
      const out = await runVerb(target, () => sessionFor(admin, target), verb, inner)
      return finish({ ...out, text: out.isError ? out.text : `// read as ${target.name ?? target.email} (${target.role})\n${out.text}`, log: { ...out.log, target: `${verb}${out.log.target ? `:${out.log.target}` : ''}` } }, target.userId)
    }
    const me: Identity = { userId: dev.userId, email: dev.email, name: dev.name, role: 'dev' }
    return finish(await runVerb(me, () => sessionFor(admin, me), name, args))
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return finish({ log: { status: 'error', error: message }, text: `Tool error: ${message}`, isError: true })
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
