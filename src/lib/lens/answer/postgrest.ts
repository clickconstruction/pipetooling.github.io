/**
 * The lens's PostgREST (punch list #194): answers the request the real supabase-js client built,
 * from the world's rows, the way PostgREST answers it from the database. Reads with filters,
 * embeds along the foreign keys (to-one, to-many, through a junction, `!inner`, spreads, counts),
 * orders, ranges and exact counts; writes (insert, upsert, update, delete) change the world's copy
 * only. An error has PostgREST's own shape and code, so every call site's error path is the one it
 * meets in production. Pure apart from the store it is handed.
 */
import { compareValues, keeps, parseLogical, parseParamFilter, readPath, type Cond, type Row } from './filters'
import type { LensRelation, LensSchema } from './lensSchemaTypes'
import { LensUnsupported } from './lensUnsupported'
import { outKey, parseSelect, type SelectNode } from './select'

export type { Row } from './filters'

export interface LensStore {
  /** The table's rows; a table the world holds nothing for answers no rows. */
  rows(table: string): Row[]
  set(table: string, rows: Row[]): void
}

export type RestCall = {
  method: string
  /** The table or view: the path after `/rest/v1/`. */
  table: string
  params: URLSearchParams
  header(name: string): string | null
  body: unknown
}

export type RestAnswer = { status: number; headers: Record<string, string>; body?: unknown }

export type RestContext = {
  schema: LensSchema
  store: LensStore
  /** The signed-in person is read-only (training mode): every write is refused as the database refuses it. */
  readOnly?: boolean
  now?: () => Date
  newId?: () => string
}

const JSON_TYPE = 'application/json; charset=utf-8'
const OBJECT_ACCEPT = 'application/vnd.pgrst.object+json'
const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'])

export function pgError(status: number, code: string, message: string, details: string | null = null, hint: string | null = null): RestAnswer {
  return { status, headers: { 'Content-Type': JSON_TYPE }, body: { code, message, details, hint } }
}

// ---------------------------------------------------------------------------
// The query: filters, orders and ranges, at the top and inside each embed
// ---------------------------------------------------------------------------

type OrderSpec = { col: string; embed?: string; desc: boolean; nulls?: 'first' | 'last' }

type Scope = { conds: Cond[]; order: OrderSpec[]; limit?: number; offset?: number; children: Map<string, Scope> }

const newScope = (): Scope => ({ conds: [], order: [], children: new Map() })

function scopeAt(root: Scope, path: readonly string[]): Scope {
  let s = root
  for (const seg of path) {
    let next = s.children.get(seg)
    if (!next) {
      next = newScope()
      s.children.set(seg, next)
    }
    s = next
  }
  return s
}

function parseOrder(raw: string): OrderSpec[] {
  return raw
    .split(',')
    .filter(Boolean)
    .map((item) => {
      const embedded = item.match(/^([^(]+)\(([^)]+)\)(.*)$/)
      const head = embedded ? `${embedded[2] ?? ''}${embedded[3] ?? ''}` : item
      const parts = head.split('.')
      const spec: OrderSpec = { col: (parts[0] ?? '').replace(/^"|"$/g, ''), desc: false }
      if (embedded) spec.embed = embedded[1]
      for (const p of parts.slice(1)) {
        if (p === 'desc') spec.desc = true
        else if (p === 'asc') spec.desc = false
        else if (p === 'nullsfirst') spec.nulls = 'first'
        else if (p === 'nullslast') spec.nulls = 'last'
      }
      return spec
    })
}

export function scopeFromParams(params: URLSearchParams): Scope {
  const root = newScope()
  for (const [key, value] of params) {
    if (RESERVED.has(key)) continue
    const segs = key.split('.')
    const tail = segs[segs.length - 1] ?? ''
    if (tail === 'or' || tail === 'and') {
      const neg = segs[segs.length - 2] === 'not'
      scopeAt(root, segs.slice(0, neg ? -2 : -1)).conds.push(parseLogical(tail, neg, value))
      continue
    }
    if (segs.length > 1 && (tail === 'order' || tail === 'limit' || tail === 'offset')) {
      const s = scopeAt(root, segs.slice(0, -1))
      if (tail === 'order') s.order = parseOrder(value)
      else if (tail === 'limit') s.limit = Number(value)
      else s.offset = Number(value)
      continue
    }
    scopeAt(root, segs.slice(0, -1)).conds.push(parseParamFilter(tail, value))
  }
  const order = params.get('order')
  if (order) root.order = parseOrder(order)
  const limit = params.get('limit')
  if (limit != null) root.limit = Number(limit)
  const offset = params.get('offset')
  if (offset != null) root.offset = Number(offset)
  return root
}

function sortRows(rows: Row[], specs: readonly OrderSpec[]): Row[] {
  if (specs.length === 0) return rows
  const val = (row: Row, s: OrderSpec): unknown => {
    if (!s.embed) return readPath(row, s.col, [])
    const e = row[s.embed]
    return e && typeof e === 'object' && !Array.isArray(e) ? (e as Row)[s.col] : null
  }
  return [...rows].sort((a, b) => {
    for (const s of specs) {
      const va = val(a, s)
      const vb = val(b, s)
      const nullsFirst = s.nulls ? s.nulls === 'first' : s.desc
      if (va == null && vb == null) continue
      if (va == null) return nullsFirst ? -1 : 1
      if (vb == null) return nullsFirst ? 1 : -1
      const c = compareValues(va, vb) ?? 0
      if (c !== 0) return s.desc ? -c : c
    }
    return 0
  })
}

function window(rows: Row[], scope: Scope, range: { from: number; to?: number } | null): { rows: Row[]; from: number } {
  let from = scope.offset ?? 0
  let count = scope.limit
  if (range) {
    from = range.from
    if (range.to != null) count = range.to - range.from + 1
  }
  return { rows: rows.slice(from, count == null ? undefined : from + count), from }
}

// ---------------------------------------------------------------------------
// Embeds: which rows of another table belong to a row of this one
// ---------------------------------------------------------------------------

type Link =
  | { kind: 'direct'; target: string; many: boolean; parentCols: string[]; childCols: string[] }
  | { kind: 'junction'; target: string; junction: string; toParent: LensRelation; toChild: LensRelation }

function relationsBetween(schema: LensSchema, from: string, to: string): Link[] {
  const out: Link[] = []
  for (const r of schema.tables[from]?.rel ?? []) {
    if (r.ref === to) out.push({ kind: 'direct', target: to, many: false, parentCols: r.columns, childCols: r.refColumns })
  }
  for (const r of schema.tables[to]?.rel ?? []) {
    if (r.ref === from && from !== to) out.push({ kind: 'direct', target: to, many: !r.one, parentCols: r.refColumns, childCols: r.columns })
  }
  return out
}

function hinted(schema: LensSchema, from: string, to: string, hint: string): Link[] {
  const out: Link[] = []
  for (const r of schema.tables[from]?.rel ?? []) {
    if (r.ref === to && (r.fk === hint || r.columns.includes(hint))) out.push({ kind: 'direct', target: to, many: false, parentCols: r.columns, childCols: r.refColumns })
  }
  for (const r of schema.tables[to]?.rel ?? []) {
    if (r.ref === from && (r.fk === hint || r.columns.includes(hint))) out.push({ kind: 'direct', target: to, many: !r.one, parentCols: r.refColumns, childCols: r.columns })
  }
  // A hint may also name the junction table of a many-to-many embed.
  const j = schema.tables[hint]
  if (j) {
    const toParent = j.rel.find((r) => r.ref === from)
    const toChild = j.rel.find((r) => r.ref === to && r !== toParent)
    if (toParent && toChild) out.push({ kind: 'junction', target: to, junction: hint, toParent, toChild })
  }
  return out
}

function junctions(schema: LensSchema, from: string, to: string): Link[] {
  const out: Link[] = []
  for (const [name, t] of Object.entries(schema.tables)) {
    if (name === from || name === to) continue
    const toParent = t.rel.filter((r) => r.ref === from)
    const toChild = t.rel.filter((r) => r.ref === to)
    if (toParent.length === 1 && toChild.length === 1 && toParent[0] && toChild[0]) out.push({ kind: 'junction', target: to, junction: name, toParent: toParent[0], toChild: toChild[0] })
  }
  return out
}

export class LensRestError extends Error {
  constructor(public answer: RestAnswer) {
    super(String((answer.body as { message?: string } | undefined)?.message ?? 'error'))
  }
}

function resolveLink(schema: LensSchema, from: string, node: Extract<SelectNode, { kind: 'embed' }>): Link {
  let target = node.name
  let links: Link[]
  if (!schema.tables[target]) {
    // Embedding by the key column's name: `customer_id(name)` follows that column's key.
    const viaColumn = (schema.tables[from]?.rel ?? []).filter((r) => r.columns.length === 1 && r.columns[0] === node.name)
    if (viaColumn.length === 1 && viaColumn[0]) {
      const r = viaColumn[0]
      return { kind: 'direct', target: r.ref, many: false, parentCols: r.columns, childCols: r.refColumns }
    }
    throw new LensRestError(pgError(400, 'PGRST200', `Could not find a relationship between '${from}' and '${node.name}' in the schema cache`))
  }
  links = node.hint ? hinted(schema, from, target, node.hint) : relationsBetween(schema, from, target)
  if (links.length === 0 && !node.hint) links = junctions(schema, from, target)
  if (links.length === 0) throw new LensRestError(pgError(400, 'PGRST200', `Could not find a relationship between '${from}' and '${target}' in the schema cache`))
  if (links.length > 1) {
    throw new LensRestError(pgError(300, 'PGRST201', `Could not embed because more than one relationship was found for '${from}' and '${target}'`, null, `Try changing '${target}' to one of the relationships, using its constraint name as a hint`))
  }
  target = links[0]!.target
  return links[0]!
}

function sameKey(a: unknown, b: unknown): boolean {
  return a != null && b != null && compareValues(a, b) === 0
}

function linkedRows(ctx: RestContext, link: Link, parent: Row): Row[] {
  if (link.kind === 'direct') {
    return ctx.store.rows(link.target).filter((c) => link.parentCols.every((pc, i) => sameKey(parent[pc], c[link.childCols[i] ?? ''])))
  }
  const via = ctx.store.rows(link.junction).filter((j) => link.toParent.columns.every((jc, i) => sameKey(j[jc], parent[link.toParent.refColumns[i] ?? ''])))
  return ctx.store.rows(link.target).filter((c) => via.some((j) => link.toChild.columns.every((jc, i) => sameKey(j[jc], c[link.toChild.refColumns[i] ?? '']))))
}

// ---------------------------------------------------------------------------
// Projection: the answer's shape, as `select` asked for it
// ---------------------------------------------------------------------------

function cast(v: unknown, to: string | undefined): unknown {
  if (!to || v == null) return v
  const t = to.toLowerCase()
  if (t === 'text' || t === 'varchar' || t === 'uuid') return typeof v === 'string' ? v : JSON.stringify(v)
  if (t === 'int' || t === 'int4' || t === 'int8' || t === 'integer' || t === 'bigint') return Math.trunc(Number(v))
  if (t === 'numeric' || t === 'float' || t === 'float8' || t === 'real' || t === 'double') return Number(v)
  if (t === 'bool' || t === 'boolean') return v === true || v === 'true' || v === 't'
  if (t === 'json' || t === 'jsonb') return typeof v === 'string' ? JSON.parse(v) : v
  if (t === 'date') return String(v).slice(0, 10)
  return v
}

type Embedded = { node: Extract<SelectNode, { kind: 'embed' }>; key: string; value: Row | Row[] | null }

function isCountOnly(node: Extract<SelectNode, { kind: 'embed' }>, ctx: RestContext, target: string): boolean {
  const only = node.children.length === 1 ? node.children[0] : undefined
  return Boolean(only && only.kind === 'col' && only.name === 'count' && !(ctx.schema.tables[target]?.columns ?? []).includes('count'))
}

/** Each embed's rows for one parent row, filtered and shaped; `null` when an `!inner` embed found nothing. */
function embedsFor(ctx: RestContext, table: string, row: Row, nodes: readonly SelectNode[], scope: Scope): Embedded[] | null {
  const out: Embedded[] = []
  for (const node of nodes) {
    if (node.kind !== 'embed') continue
    const link = resolveLink(ctx.schema, table, node)
    const key = node.alias ?? node.name
    const child = scope.children.get(key) ?? scope.children.get(node.name) ?? newScope()
    let rows = linkedRows(ctx, link, row).filter((c) => keeps(child.conds, c))
    const many = link.kind === 'junction' || link.many
    if (isCountOnly(node, ctx, link.target)) {
      out.push({ node, key, value: [{ count: rows.length }] })
      continue
    }
    const shaped: Row[] = []
    for (const c of rows) {
      const inner = embedsFor(ctx, link.target, c, node.children, child)
      if (inner === null) continue
      shaped.push(project(ctx, link.target, c, node.children, inner))
    }
    rows = sortRows(shaped, child.order)
    if (many) rows = window(rows, child, null).rows
    if (node.inner && rows.length === 0) return null
    out.push({ node, key, value: many ? rows : (rows[0] ?? null) })
  }
  return out
}

function project(ctx: RestContext, table: string, row: Row, nodes: readonly SelectNode[], embeds: readonly Embedded[]): Row {
  const out: Row = {}
  const columns = ctx.schema.tables[table]?.columns
  for (const node of nodes) {
    if (node.kind === 'star') {
      if (columns) for (const c of columns) out[c] = row[c] ?? null
      for (const [k, v] of Object.entries(row)) if (!(k in out)) out[k] = v
    } else if (node.kind === 'col') {
      if (columns && !columns.includes(node.name) && !(node.name in row)) {
        throw new LensRestError(pgError(400, '42703', `column ${table}.${node.name} does not exist`))
      }
      out[outKey(node)] = cast(readPath(row, node.name, node.path), node.cast)
    } else if (node.kind === 'embed') {
      const e = embeds.find((x) => x.node === node)
      if (!e) continue
      if (node.spread) {
        if (e.value && !Array.isArray(e.value)) Object.assign(out, e.value)
        else if (Array.isArray(e.value)) throw new LensUnsupported(`a spread of a to-many embed ("${node.name}")`)
      } else out[e.key] = e.value
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// The request
// ---------------------------------------------------------------------------

function preferOf(call: RestCall): Map<string, string> {
  const out = new Map<string, string>()
  for (const part of (call.header('prefer') ?? '').split(',')) {
    const [k, v] = part.trim().split('=')
    if (k) out.set(k.trim(), (v ?? '').trim())
  }
  return out
}

function rangeOf(call: RestCall): { from: number; to?: number } | null {
  const m = (call.header('range') ?? '').match(/^(\d+)-(\d*)$/)
  if (!m) return null
  return { from: Number(m[1]), to: m[2] ? Number(m[2]) : undefined }
}

function contentRange(from: number, n: number, total: number | null): string {
  const span = n > 0 ? `${from}-${from + n - 1}` : '*'
  return `${span}/${total ?? '*'}`
}

function checkColumns(ctx: RestContext, table: string, conds: readonly Cond[]) {
  const columns = ctx.schema.tables[table]?.columns
  if (!columns) return
  for (const c of conds) {
    if (c.kind === 'cmp') {
      if (!columns.includes(c.col)) throw new LensRestError(pgError(400, '42703', `column ${table}.${c.col} does not exist`))
    } else checkColumns(ctx, table, c.items)
  }
}

/** Shape a set of rows as the request asks: filters, embeds, order, range, select, count, one object. */
function answerRows(ctx: RestContext, call: RestCall, table: string | null, source: Row[], status = 200): RestAnswer {
  const nodes = parseSelect(call.params.get('select'))
  const scope = scopeFromParams(call.params)
  if (table) checkColumns(ctx, table, scope.conds)
  const prefer = preferOf(call)
  // An aggregate count over the whole result: `select=count()`.
  if (nodes.length === 1 && nodes[0]?.kind === 'count') {
    const n = source.filter((r) => keeps(scope.conds, r)).length
    return finish(call, prefer, [{ [nodes[0].alias ?? 'count']: n }], 0, 1, status)
  }
  const kept: { row: Row; embeds: Embedded[] }[] = []
  for (const row of source) {
    if (!keeps(scope.conds, row)) continue
    const embeds = table ? embedsFor(ctx, table, row, nodes, scope) : []
    if (embeds === null) continue
    kept.push({ row, embeds })
  }
  // Order on the stored row, or on a to-one embed's column.
  const projected = kept.map(({ row, embeds }) => ({ row, out: table ? project(ctx, table, row, nodes, embeds) : projectLoose(row, nodes) }))
  const ordered = scope.order.length === 0 ? projected : sortPairs(projected, scope.order)
  const total = ordered.length
  const { rows, from } = window(ordered.map((p) => p.out), scope, rangeOf(call))
  return finish(call, prefer, rows, from, total, status)
}

function sortPairs(pairs: { row: Row; out: Row }[], specs: readonly OrderSpec[]): { row: Row; out: Row }[] {
  const merged = pairs.map((p) => ({ ...p, key: { ...p.row, ...p.out } }))
  const sorted = sortRows(merged.map((m) => m.key), specs)
  const byKey = new Map(merged.map((m) => [m.key, m]))
  return sorted.map((k) => byKey.get(k)!).map(({ row, out }) => ({ row, out }))
}

/** An RPC's rows have no table behind them: columns are whatever the rows hold. */
function projectLoose(row: Row, nodes: readonly SelectNode[]): Row {
  if (nodes.every((n) => n.kind === 'star')) return { ...row }
  const out: Row = {}
  for (const node of nodes) {
    if (node.kind === 'star') Object.assign(out, row)
    else if (node.kind === 'col') out[outKey(node)] = cast(readPath(row, node.name, node.path), node.cast)
    else if (node.kind === 'embed') throw new LensUnsupported(`an embed on an RPC's rows ("${node.name}")`)
  }
  return out
}

function finish(call: RestCall, prefer: Map<string, string>, rows: Row[], from: number, total: number, status: number): RestAnswer {
  const counted = prefer.has('count') ? total : null
  const headers: Record<string, string> = { 'Content-Type': JSON_TYPE, 'Content-Range': contentRange(from, rows.length, counted) }
  if (call.method === 'HEAD') return { status, headers }
  if ((call.header('accept') ?? '').includes(OBJECT_ACCEPT)) {
    if (rows.length !== 1) {
      return pgError(406, 'PGRST116', 'JSON object requested, multiple (or no) rows returned', `The result contains ${rows.length} rows`)
    }
    return { status, headers, body: rows[0] }
  }
  return { status, headers, body: rows }
}

function defaultsFor(ctx: RestContext, table: string): Row {
  const now = (ctx.now ?? (() => new Date()))().toISOString()
  const out: Row = {}
  for (const c of ctx.schema.tables[table]?.columns ?? []) out[c] = null
  if ('id' in out) out.id = (ctx.newId ?? (() => crypto.randomUUID()))()
  for (const c of ['created_at', 'updated_at', 'inserted_at']) if (c in out) out[c] = now
  return out
}

const READ_ONLY = (): RestAnswer => pgError(400, 'P0001', 'Read-only (training) mode: changes are blocked.')

function write(ctx: RestContext, call: RestCall): RestAnswer {
  const table = call.table
  if (ctx.readOnly) return READ_ONLY()
  const prefer = preferOf(call)
  const wantRows = prefer.get('return') === 'representation'
  const all = [...ctx.store.rows(table)]
  let touched: Row[] = []
  if (call.method === 'POST') {
    const items = (Array.isArray(call.body) ? call.body : [call.body]).filter((x): x is Row => Boolean(x) && typeof x === 'object')
    const only = call.params.get('columns')?.split(',').map((s) => s.replace(/"/g, '').trim())
    const conflict = (call.params.get('on_conflict') ?? 'id').split(',').map((s) => s.trim())
    const resolution = prefer.get('resolution')
    for (const raw of items) {
      const item: Row = only ? Object.fromEntries(Object.entries(raw).filter(([k]) => only.includes(k))) : raw
      const existing = all.find((r) => conflict.every((c) => item[c] != null && sameKey(r[c], item[c])))
      if (existing) {
        if (resolution === 'ignore-duplicates') continue
        if (resolution === 'merge-duplicates') {
          Object.assign(existing, item)
          if ('updated_at' in existing && !('updated_at' in item)) existing.updated_at = (ctx.now ?? (() => new Date()))().toISOString()
          touched.push(existing)
          continue
        }
        return pgError(409, '23505', `duplicate key value violates unique constraint "${table}_pkey"`)
      }
      const row = { ...defaultsFor(ctx, table), ...item }
      all.push(row)
      touched.push(row)
    }
    ctx.store.set(table, all)
    return writeAnswer(ctx, call, prefer, touched, wantRows, 201)
  }
  const scope = scopeFromParams(call.params)
  checkColumns(ctx, table, scope.conds)
  if (call.method === 'PATCH') {
    const patch = (call.body && typeof call.body === 'object' ? call.body : {}) as Row
    touched = all.filter((r) => keeps(scope.conds, r))
    for (const r of touched) {
      Object.assign(r, patch)
      if ('updated_at' in r && !('updated_at' in patch)) r.updated_at = (ctx.now ?? (() => new Date()))().toISOString()
    }
    ctx.store.set(table, all)
    return writeAnswer(ctx, call, prefer, touched, wantRows, wantRows ? 200 : 204)
  }
  if (call.method === 'DELETE') {
    touched = all.filter((r) => keeps(scope.conds, r))
    ctx.store.set(table, all.filter((r) => !touched.includes(r)))
    return writeAnswer(ctx, call, prefer, touched, wantRows, wantRows ? 200 : 204)
  }
  return pgError(405, 'PGRST117', `Unsupported HTTP method: ${call.method}`)
}

function writeAnswer(ctx: RestContext, call: RestCall, prefer: Map<string, string>, rows: Row[], wantRows: boolean, status: number): RestAnswer {
  if (!wantRows) {
    const headers: Record<string, string> = { 'Content-Range': contentRange(0, rows.length, prefer.has('count') ? rows.length : null) }
    return { status, headers }
  }
  // The rows come back through `select`, with no filters: the filters chose the rows written.
  const nodes = parseSelect(call.params.get('select'))
  const out = rows.map((r) => {
    const embeds = embedsFor(ctx, call.table, r, nodes, newScope()) ?? []
    return project(ctx, call.table, r, nodes, embeds)
  })
  return finish({ ...call, method: 'GET' }, prefer, out, 0, out.length, status)
}

/** Answer one call to a table or view. */
export function answerTable(ctx: RestContext, call: RestCall): RestAnswer {
  try {
    if (!ctx.schema.tables[call.table]) {
      return pgError(404, 'PGRST205', `Could not find the table 'public.${call.table}' in the schema cache`)
    }
    if (call.method === 'GET' || call.method === 'HEAD') return answerRows(ctx, call, call.table, ctx.store.rows(call.table))
    return write(ctx, call)
  } catch (e) {
    if (e instanceof LensRestError) return e.answer
    throw e
  }
}

/** Shape an RPC's set of rows as the request asks (`.rpc(...).eq(...).order(...)` filters the result). */
export function answerRpcRows(ctx: RestContext, call: RestCall, rows: Row[]): RestAnswer {
  try {
    return answerRows(ctx, call, null, rows)
  } catch (e) {
    if (e instanceof LensRestError) return e.answer
    throw e
  }
}
