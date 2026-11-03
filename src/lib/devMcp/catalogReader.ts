import { CATALOG_RPCS, CATALOG_TABLES } from '../../../supabase/functions/dev-mcp/catalog'
import { buildRowsQuery, buildRpcQuery, rpcArgNames, type RowFilter } from '../../../supabase/functions/_shared/devMcpDoor'
import type { Reader, Row, RowsQuery } from '../../../supabase/functions/_shared/devMcpComposites'

/**
 * The fake reader the dev-mcp composite tests run against (v2.3646; its own file since the person file's verb): it
 * refuses what the real door would refuse — an RPC or table that is not in the generated catalog, an argument the RPC
 * does not take, a filter / order / plain select column the table does not have, a result filter on a column the RPC
 * does not answer with — so a composite that names a column the table lacks fails in CI, not live. Whatever a
 * composite asks for here, dev-mcp will accept live. A result filter is also applied, as PostgREST applies it.
 */

/** The columns of a set-returning RPC's answer as the catalog writes it (`{ a: string b: number }[]`); null when it cannot tell. */
export function rpcResultColumns(returns: string): Set<string> | null {
  const m = /^\{ (.*) \}\[\]$/.exec(returns)
  if (!m || returns.includes('…')) return null
  let top = m[1]!
  while (/\{[^{}]*\}/.test(top)) top = top.replace(/\{[^{}]*\}/g, '')
  return new Set([...top.matchAll(/([a-z_][a-z0-9_]*)\??:/g)].map((x) => x[1]!))
}

/** The rows a result filter keeps (the ops the composites use; any other is refused, so a test cannot pass by accident). */
function filtered(rows: unknown, filters: readonly RowFilter[]): unknown {
  if (!Array.isArray(rows)) return rows
  return filters.reduce<Row[]>((kept, f) => {
    if (f.op === 'eq') return kept.filter((r) => r[f.column] === f.value)
    if (f.op === 'in') return kept.filter((r) => (f.value as unknown[]).includes(r[f.column]))
    throw new Error(`catalogReader: no "${f.op}" on an RPC result`)
  }, rows as Row[])
}

/** Top-level plain columns of a PostgREST select (embeds and aliases are skipped — the API checks those). */
export function plainColumns(select: string): string[] {
  const out: string[] = []
  let depth = 0
  let token = ''
  for (const ch of `${select},`) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      const t = token.trim()
      if (t && t !== '*' && !/[(:!]/.test(t)) out.push(t)
      token = ''
    } else token += ch
  }
  return out
}

export type CatalogReaderData = { rpc?: Record<string, unknown>; rows?: Record<string, Row[]> }

export function catalogReader(data: CatalogReaderData): Reader & { asked: string[] } {
  const asked: string[] = []
  return {
    asked,
    rpc: async (name, args = {}, limit, filters) => {
      asked.push(`rpc:${name}`)
      const sigs = CATALOG_RPCS[name]
      if (!sigs) throw new Error(`rpc ${name} is not in the catalog`)
      const known = rpcArgNames(sigs)
      for (const a of Object.keys(args)) if (!known.has(a)) throw new Error(`rpc ${name} has no argument ${a}`)
      const built = buildRpcQuery(args, limit, filters?.length ? { filters, argNames: known } : undefined)
      if (!built.ok) throw new Error(built.error)
      if (!filters?.length) return data.rpc?.[name] ?? []
      for (const f of filters) {
        const columns = sigs.map((s) => rpcResultColumns(s.returns))
        if (columns.some((c) => c == null)) throw new Error(`rpc ${name}: the catalog does not say what it answers with, so a filter on ${f.column} cannot be checked`)
        if (!columns.some((c) => c!.has(f.column))) throw new Error(`rpc ${name} answers with no column ${f.column} (filter)`)
      }
      return filtered(data.rpc?.[name] ?? [], filters)
    },
    rows: async (table: string, query: RowsQuery) => {
      asked.push(`rows:${table}`)
      const entry = CATALOG_TABLES[table]
      if (!entry) throw new Error(`table ${table} is not in the catalog`)
      const columns = new Set(Object.keys(entry.columns))
      const built = buildRowsQuery(query, columns)
      if (!built.ok) throw new Error(`${table}: ${built.error}`)
      for (const c of plainColumns(query.select ?? '*')) if (!columns.has(c)) throw new Error(`${table} has no column ${c} (select)`)
      return data.rows?.[table] ?? []
    },
  }
}

/** Every `{ error }` part in a reply, by path — a composite's fail-soft parts, which a test expects empty. */
export function noErrors(value: unknown): string[] {
  const found: string[] = []
  const walk = (v: unknown, path: string) => {
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`))
    else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>
      if (typeof o.error === 'string' && Object.keys(o).length === 1) found.push(`${path}: ${o.error}`)
      for (const [k, x] of Object.entries(o)) walk(x, `${path}.${k}`)
    }
  }
  walk(value, '$')
  return found
}
