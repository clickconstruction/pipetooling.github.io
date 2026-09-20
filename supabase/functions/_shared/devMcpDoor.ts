// dev-mcp's read door (v2.3640, to-dos/mcp-servers.md PR 4b) — the pure half: what a
// call may name, how it becomes a PostgREST GET, and what never leaves the server.
//
// The door is GET-only by construction: PostgREST runs GET in a read-only transaction,
// so the database refuses a write whatever an RPC is called. This kernel adds the rest:
// identifiers are checked against the generated catalog by the caller, a handful of
// tables are never read, and bearer secrets are redacted from every reply — an agent's
// transcript is not a place for a portal token, even a dev's.
// Pure: no env, no network. Tests: src/lib/devMcp/devMcpDoor.test.ts.

export const ROWS_DEFAULT_LIMIT = 50
export const ROWS_MAX_LIMIT = 200
export const QUERY_MAX_CHARS = 6000
export const REPLY_MAX_CHARS = 80_000
export const REDACTED = '‹redacted›'

/** Tables whose whole point is a secret; never read through the door. */
export const DENIED_TABLES: ReadonlySet<string> = new Set([
  'dev_mcp_credentials',
  'inspection_portal_credentials',
  'push_subscriptions',
  'twin_credentials',
  'twin_setup_codes',
])

export const FILTER_OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in'] as const
export type FilterOp = (typeof FILTER_OPS)[number]
export type RowFilter = { column: string; op: FilterOp; value: unknown }
export type RowOrder = { column: string; ascending?: boolean }

const IDENT_RE = /^[a-z_][a-z0-9_]*$/
const SELECT_RE = /^[A-Za-z0-9_,.*():!>\s-]+$/
// token, secret, password, api_key, *_hash — as a whole name or a suffix; `…_token_expires_at` is a date, not a secret.
const SECRET_KEY_RE = /(^|_)(token|secret|password|api_key|hash)$/i
// Web-push key material: not secret-shaped by name, secret by content.
const SECRET_EXACT: ReadonlySet<string> = new Set(['auth', 'p256dh'])

export function isSafeIdent(s: unknown): s is string {
  return typeof s === 'string' && s.length <= 63 && IDENT_RE.test(s)
}

export function isSecretKey(key: string): boolean {
  return SECRET_KEY_RE.test(key) || SECRET_EXACT.has(key.toLowerCase())
}

/** Replace the value of every secret-named key, at any depth. Nulls stay null (absence is not a secret). */
export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isSecretKey(k) && v != null ? REDACTED : redactSecrets(v)
    }
    return out
  }
  return value
}

function pgArrayLiteral(items: unknown[]): string {
  const cell = (v: unknown): string => {
    if (v == null) return 'NULL'
    if (Array.isArray(v)) return pgArrayLiteral(v)
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  }
  return `{${items.map(cell).join(',')}}`
}

export type BuiltQuery = { ok: true; query: string } | { ok: false; error: string }

/**
 * RPC args → the query string of `GET /rest/v1/rpc/<name>`. Scalars pass as text, arrays
 * as a Postgres array literal, objects as JSON (Postgres casts text to json/jsonb). A
 * null or undefined arg is omitted — GET cannot carry one, and the SQL default applies.
 */
export function buildRpcQuery(args: Record<string, unknown>, limit?: number): BuiltQuery {
  const params = new URLSearchParams()
  for (const [name, value] of Object.entries(args)) {
    if (!isSafeIdent(name)) return { ok: false, error: `arg "${name}" is not a valid argument name` }
    if (value == null) continue
    if (Array.isArray(value)) params.set(name, pgArrayLiteral(value))
    else if (typeof value === 'object') params.set(name, JSON.stringify(value))
    else params.set(name, String(value))
  }
  if (limit != null) params.set('limit', String(clampLimit(limit)))
  return capped(params.toString())
}

export function clampLimit(limit: unknown): number {
  const n = typeof limit === 'number' && Number.isFinite(limit) ? Math.floor(limit) : ROWS_DEFAULT_LIMIT
  return Math.min(ROWS_MAX_LIMIT, Math.max(1, n))
}

function filterValue(op: FilterOp, value: unknown): string | null {
  if (op === 'is') {
    const v = value === null ? 'null' : String(value)
    return ['null', 'true', 'false'].includes(v) ? v : null
  }
  if (op === 'in') {
    if (!Array.isArray(value) || value.length === 0) return null
    return `(${value.map((v) => `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',')})`
  }
  if (value == null || typeof value === 'object') return null
  return String(value)
}

/**
 * A table read → the query string of `GET /rest/v1/<table>`. `columns` is the table's
 * catalog entry: every filter and order column must be one of them, and a filter on a
 * secret column is refused (a redacted column must not become an oracle).
 */
export function buildRowsQuery(
  input: { select?: unknown; filters?: unknown; order?: unknown; limit?: unknown },
  columns: ReadonlySet<string>,
): BuiltQuery {
  const params = new URLSearchParams()
  const select = input.select == null || input.select === '' ? '*' : input.select
  if (typeof select !== 'string' || !SELECT_RE.test(select)) return { ok: false, error: 'select must be a PostgREST column list (letters, digits, _ , . * ( ) : ! > -)' }
  // An embed reaches a related table by its name or by a constraint name that contains it
  // (`users?select=*,push_subscriptions(*)`), so a denied table is refused anywhere in the select.
  const lowered = select.toLowerCase()
  for (const denied of DENIED_TABLES) {
    if (lowered.includes(denied)) return { ok: false, error: `"${denied}" holds credentials and is never read through this server, embeds included` }
  }
  params.set('select', select.replace(/\s+/g, ''))

  const filters = input.filters == null ? [] : input.filters
  if (!Array.isArray(filters)) return { ok: false, error: 'filters must be an array of { column, op, value }' }
  for (const raw of filters) {
    const f = raw as Partial<RowFilter>
    if (!isSafeIdent(f.column) || !columns.has(f.column)) return { ok: false, error: `filter column "${String(f.column)}" is not a column of this table` }
    if (isSecretKey(f.column)) return { ok: false, error: `"${f.column}" is a secret column — it is redacted from replies and cannot be filtered on` }
    if (!FILTER_OPS.includes(f.op as FilterOp)) return { ok: false, error: `filter op "${String(f.op)}" is not one of ${FILTER_OPS.join(', ')}` }
    const v = filterValue(f.op as FilterOp, f.value)
    if (v == null) return { ok: false, error: `filter on "${f.column}": "${f.op}" cannot take that value (is → null/true/false; in → a non-empty array; the rest → a scalar)` }
    params.append(f.column, `${f.op}.${v}`)
  }

  const order = input.order == null ? [] : input.order
  if (!Array.isArray(order)) return { ok: false, error: 'order must be an array of { column, ascending? }' }
  const parts: string[] = []
  for (const raw of order) {
    const o = raw as Partial<RowOrder>
    if (!isSafeIdent(o.column) || !columns.has(o.column)) return { ok: false, error: `order column "${String(o.column)}" is not a column of this table` }
    parts.push(`${o.column}.${o.ascending === false ? 'desc' : 'asc'}`)
  }
  if (parts.length > 0) params.set('order', parts.join(','))
  params.set('limit', String(clampLimit(input.limit)))
  return capped(params.toString())
}

function capped(query: string): BuiltQuery {
  if (query.length > QUERY_MAX_CHARS) return { ok: false, error: `the request is ${query.length} characters as a URL (limit ${QUERY_MAX_CHARS}) — pass fewer ids per call` }
  return { ok: true, query }
}

/** Names containing every whitespace-separated term, exact match first, then shortest. */
export function searchNames(names: Iterable<string>, text: string, max = 25): string[] {
  const terms = text.toLowerCase().split(/[\s,]+/).filter(Boolean)
  if (terms.length === 0) return []
  const exact = text.trim().toLowerCase()
  return [...names]
    .filter((n) => terms.every((t) => n.includes(t)))
    .sort((a, b) => Number(b === exact) - Number(a === exact) || a.length - b.length || a.localeCompare(b))
    .slice(0, max)
}

/** A reply the agent can afford: JSON, cut at REPLY_MAX_CHARS with a plain-words tail. */
export function replyText(payload: unknown): string {
  const text = JSON.stringify(payload, null, 1)
  if (text.length <= REPLY_MAX_CHARS) return text
  return `${text.slice(0, REPLY_MAX_CHARS)}\n… cut at ${REPLY_MAX_CHARS} of ${text.length} characters — narrow the select, add filters, or lower the limit.`
}
