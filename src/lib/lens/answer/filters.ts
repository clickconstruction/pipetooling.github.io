/**
 * PostgREST's filters, read and judged the way Postgres judges them (punch list #194): `col=op.value`
 * and `col=not.op.value`, the logical trees `or=(...)` / `and=(...)` / `not.or=(...)` with nesting,
 * JSON paths on the column, and SQL's three-valued logic, so `neq` on a null value drops the row as
 * Postgres does. Pure.
 */
import { LensUnsupported } from './lensUnsupported'
import { splitTop, type JsonStep } from './select'

export type Row = Record<string, unknown>

export type Cond =
  | { kind: 'cmp'; col: string; path: JsonStep[]; op: string; neg: boolean; value: string }
  | { kind: 'and' | 'or'; neg: boolean; items: Cond[] }

const OPS = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'match', 'imatch', 'is', 'isdistinct', 'in', 'cs', 'cd', 'ov', 'fts', 'plfts', 'phfts', 'wfts'])

function colAndPath(raw: string): { col: string; path: JsonStep[] } {
  const parts = raw.split(/(->>|->)/)
  const path: JsonStep[] = []
  for (let i = 1; i < parts.length; i += 2) path.push({ op: parts[i] as '->' | '->>', key: (parts[i + 1] ?? '').replace(/^"|"$/g, '') })
  return { col: (parts[0] ?? '').replace(/^"|"$/g, ''), path }
}

/** `op.value` or `not.op.value`, with the op's modifiers refused. */
function opAndValue(raw: string): { op: string; neg: boolean; value: string } {
  let rest = raw
  let neg = false
  if (rest.startsWith('not.')) {
    neg = true
    rest = rest.slice(4)
  }
  const dot = rest.indexOf('.')
  const op = dot < 0 ? rest : rest.slice(0, dot)
  if (op.includes('(')) throw new LensUnsupported(`the "${op}" filter modifier`)
  if (!OPS.has(op)) throw new LensUnsupported(`the "${op}" filter`)
  return { op, neg, value: dot < 0 ? '' : rest.slice(dot + 1) }
}

/** A query parameter's filter: the key is the column, the value `op.value`. */
export function parseParamFilter(key: string, raw: string): Cond {
  return { kind: 'cmp', ...colAndPath(key), ...opAndValue(raw) }
}

/** A logical parameter's value, `(item,item,...)`, where each item is `col.op.value` or a nested tree. */
export function parseLogical(kind: 'and' | 'or', neg: boolean, raw: string): Cond {
  const body = raw.trim()
  if (!body.startsWith('(') || !body.endsWith(')')) throw new LensUnsupported(`a logical filter "${raw}"`)
  return { kind, neg, items: splitTop(body.slice(1, -1)).filter((s) => s.length > 0).map(parseLogicalItem) }
}

function parseLogicalItem(item: string): Cond {
  const m = item.match(/^(not\.)?(and|or)(\(.*\))$/)
  if (m) return parseLogical(m[2] as 'and' | 'or', Boolean(m[1]), m[3] ?? '')
  // col.op.value, col.not.op.value — the column may carry a JSON path but no dot of its own.
  const dot = item.indexOf('.')
  if (dot < 0) throw new LensUnsupported(`a logical filter item "${item}"`)
  return { kind: 'cmp', ...colAndPath(item.slice(0, dot)), ...opAndValue(item.slice(dot + 1)) }
}

// ---------------------------------------------------------------------------
// Judging a row
// ---------------------------------------------------------------------------

type Tri = boolean | null

export function readPath(row: Row, col: string, path: readonly JsonStep[]): unknown {
  let v: unknown = row[col]
  for (const step of path) {
    if (v == null) return null
    let obj = v
    if (typeof obj === 'string') {
      try {
        obj = JSON.parse(obj)
      } catch {
        return null
      }
    }
    const next = Array.isArray(obj) && /^-?\d+$/.test(step.key) ? obj[Number(step.key)] : (obj as Record<string, unknown>)[step.key]
    v = step.op === '->>' ? (next == null ? null : typeof next === 'string' ? next : JSON.stringify(next)) : next
  }
  return v
}

function unquote(s: string): string {
  return s.length >= 2 && s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1).replace(/\\(.)/g, '$1') : s
}

/** `(a,b,"c,d")` → ['a', 'b', 'c,d']. */
export function parseList(raw: string): string[] {
  const t = raw.trim()
  const body = t.startsWith('(') && t.endsWith(')') ? t.slice(1, -1) : t
  return body === '' ? [] : splitTop(body).map((s) => unquote(s.trim()))
}

/** A Postgres array literal `{a,b}` or a JSON array, for cs / cd / ov. */
function parseArrayish(raw: string): unknown[] | Record<string, unknown> {
  const t = raw.trim()
  if (t.startsWith('[') || (t.startsWith('{') && t.includes(':'))) {
    try {
      return JSON.parse(t) as unknown[] | Record<string, unknown>
    } catch {
      throw new LensUnsupported(`a containment value "${raw}"`)
    }
  }
  if (t.startsWith('{') && t.endsWith('}')) return t.slice(1, -1) === '' ? [] : splitTop(t.slice(1, -1)).map((s) => unquote(s.trim()))
  return parseList(t)
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}/

/** Order two values the way the column's type would: numbers as numbers, timestamps as instants. */
export function compareValues(a: unknown, raw: unknown): number | null {
  if (a == null || raw == null) return null
  if (typeof a === 'number') {
    const b = typeof raw === 'number' ? raw : Number(raw)
    return Number.isNaN(b) ? null : a === b ? 0 : a < b ? -1 : 1
  }
  if (typeof a === 'boolean') {
    const b = typeof raw === 'boolean' ? raw : raw === 'true' || raw === 't'
    return a === b ? 0 : a ? 1 : -1
  }
  const sa = typeof a === 'string' ? a : JSON.stringify(a)
  const sb = typeof raw === 'string' ? raw : JSON.stringify(raw)
  if (ISO_DAY.test(sa) && ISO_DAY.test(sb) && (sa.length > 10 || sb.length > 10)) {
    const ta = Date.parse(sa)
    const tb = Date.parse(sb)
    if (!Number.isNaN(ta) && !Number.isNaN(tb)) return ta === tb ? 0 : ta < tb ? -1 : 1
  }
  return sa === sb ? 0 : sa < sb ? -1 : 1
}

function likeToRegExp(pattern: string, flags: string): RegExp {
  let src = ''
  for (const c of pattern) {
    if (c === '*' || c === '%') src += '.*'
    else if (c === '_') src += '.'
    else src += c.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${src}$`, flags + 's')
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || (a && typeof a === 'object')) return JSON.stringify(a) === JSON.stringify(b)
  return compareValues(a, b) === 0
}

function contains(container: unknown, part: unknown): boolean {
  if (Array.isArray(part)) {
    if (!Array.isArray(container)) return false
    return part.every((p) => container.some((c) => (p && typeof p === 'object' ? contains(c, p) : sameValue(c, p))))
  }
  if (part && typeof part === 'object') {
    if (!container || typeof container !== 'object' || Array.isArray(container)) return false
    return Object.entries(part as Record<string, unknown>).every(([k, v]) => {
      const c = (container as Record<string, unknown>)[k]
      return v && typeof v === 'object' ? contains(c, v) : sameValue(c, v)
    })
  }
  return sameValue(container, part)
}

function judgeCmp(c: Extract<Cond, { kind: 'cmp' }>, row: Row): Tri {
  let v = readPath(row, c.col, c.path)
  if (typeof v === 'string' && (c.op === 'cs' || c.op === 'cd' || c.op === 'ov') && /^[[{]/.test(v)) {
    try {
      v = JSON.parse(v)
    } catch {
      /* a text column that only looks like JSON */
    }
  }
  const raw = c.value
  switch (c.op) {
    case 'is': {
      const want = raw.toLowerCase()
      if (want === 'null') return v == null
      if (want === 'true') return v === true
      if (want === 'false') return v === false
      if (want === 'unknown') return v == null
      throw new LensUnsupported(`is.${raw}`)
    }
    case 'isdistinct':
      return v == null ? unquote(raw) !== 'null' : compareValues(v, unquote(raw)) !== 0
  }
  if (v == null) return null
  switch (c.op) {
    case 'eq':
      return compareValues(v, unquote(raw)) === 0
    case 'neq':
      return compareValues(v, unquote(raw)) !== 0
    case 'gt': {
      const r = compareValues(v, unquote(raw))
      return r == null ? null : r > 0
    }
    case 'gte': {
      const r = compareValues(v, unquote(raw))
      return r == null ? null : r >= 0
    }
    case 'lt': {
      const r = compareValues(v, unquote(raw))
      return r == null ? null : r < 0
    }
    case 'lte': {
      const r = compareValues(v, unquote(raw))
      return r == null ? null : r <= 0
    }
    case 'like':
      return likeToRegExp(unquote(raw), '').test(String(v))
    case 'ilike':
      return likeToRegExp(unquote(raw), 'i').test(String(v))
    case 'match':
      return new RegExp(unquote(raw)).test(String(v))
    case 'imatch':
      return new RegExp(unquote(raw), 'i').test(String(v))
    case 'in':
      return parseList(raw).some((x) => compareValues(v, x) === 0)
    case 'cs':
      return contains(v, parseArrayish(raw))
    case 'cd': {
      const outer = parseArrayish(raw)
      return Array.isArray(v) && Array.isArray(outer) ? v.every((x) => outer.some((o) => sameValue(x, o))) : contains(outer, v)
    }
    case 'ov': {
      const other = parseArrayish(raw)
      return Array.isArray(v) && Array.isArray(other) ? v.some((x) => other.some((o) => sameValue(x, o))) : false
    }
    case 'fts':
    case 'plfts':
    case 'phfts':
    case 'wfts': {
      // An approximation of a text search: every word of the query appears in the text.
      const query = unquote(raw.replace(/^\([^)]*\)/, ''))
      const words = query.toLowerCase().split(/[\s&|!:'()<>-]+/).filter(Boolean)
      const hay = String(v).toLowerCase()
      return words.every((w) => hay.includes(w))
    }
  }
  throw new LensUnsupported(`the "${c.op}" filter`)
}

export function judge(c: Cond, row: Row): Tri {
  let r: Tri
  if (c.kind === 'cmp') r = judgeCmp(c, row)
  else if (c.kind === 'and') {
    r = true
    for (const item of c.items) {
      const x = judge(item, row)
      if (x === false) {
        r = false
        break
      }
      if (x === null) r = null
    }
  } else {
    r = false
    for (const item of c.items) {
      const x = judge(item, row)
      if (x === true) {
        r = true
        break
      }
      if (x === null) r = null
    }
  }
  if (c.neg) return r === null ? null : !r
  return r
}

/** WHERE keeps a row only when every condition is true; unknown drops it. */
export function keeps(conds: readonly Cond[], row: Row): boolean {
  return conds.every((c) => judge(c, row) === true)
}
