/**
 * PostgREST's `select=` grammar, read the way PostgREST reads it (punch list #194): columns, `*`,
 * aliases (`alias:col`), casts (`col::text`), JSON paths (`col->a->>b`), embeds (`rel(...)`,
 * `alias:rel!hint!inner(...)`), spreads (`...rel(...)`) and a count (`count()`, or `rel(count)`).
 * Pure.
 */
import { LensUnsupported } from './lensUnsupported'

export type JsonStep = { op: '->' | '->>'; key: string }

export type SelectNode =
  | { kind: 'star' }
  | { kind: 'col'; name: string; alias?: string; path: JsonStep[]; cast?: string }
  | { kind: 'count'; alias?: string }
  | { kind: 'embed'; name: string; alias?: string; hint?: string; inner: boolean; spread: boolean; children: SelectNode[] }

/** Split on commas that sit outside parentheses and double quotes. */
export function splitTop(text: string, sep = ','): string[] {
  const out: string[] = []
  let depth = 0
  let quoted = false
  let cur = ''
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"' && text[i - 1] !== '\\') quoted = !quoted
    if (!quoted) {
      if (c === '(') depth++
      else if (c === ')') depth--
      else if (c === sep && depth === 0) {
        out.push(cur)
        cur = ''
        continue
      }
    }
    cur += c
  }
  if (cur.length > 0 || out.length > 0) out.push(cur)
  return out
}

function unquote(s: string): string {
  const t = s.trim()
  return t.length >= 2 && t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t
}

export function parseSelect(raw: string | null | undefined): SelectNode[] {
  const text = (raw ?? '*').replace(/\s+/g, '')
  if (text === '') return [{ kind: 'star' }]
  return splitTop(text).filter((p) => p.length > 0).map(parseItem)
}

function parseItem(item: string): SelectNode {
  if (item === '*') return { kind: 'star' }
  let rest = item
  let spread = false
  if (rest.startsWith('...')) {
    spread = true
    rest = rest.slice(3)
  }
  // An alias is the part before the first ':' that is not a cast's '::'.
  let alias: string | undefined
  const colon = rest.search(/(?<!:):(?!:)/)
  const paren = rest.indexOf('(')
  if (colon > 0 && (paren < 0 || colon < paren)) {
    alias = unquote(rest.slice(0, colon))
    rest = rest.slice(colon + 1)
  }
  const open = rest.indexOf('(')
  if (open >= 0) {
    if (!rest.endsWith(')')) throw new LensUnsupported(`select item "${item}"`)
    const head = rest.slice(0, open)
    const inside = rest.slice(open + 1, -1)
    if (head === 'count' && inside === '') return { kind: 'count', alias }
    if (/\.(sum|avg|min|max|count)$/.test(head)) throw new LensUnsupported(`an aggregate in select ("${item}")`)
    const [name, ...marks] = head.split('!')
    let hint: string | undefined
    let inner = false
    for (const m of marks) {
      if (m === 'inner') inner = true
      else if (m === 'left') inner = false
      else hint = m
    }
    const children = inside === '' ? [] : splitTop(inside).filter((p) => p.length > 0).map(parseItem)
    return { kind: 'embed', name: unquote(name ?? ''), alias, hint, inner, spread, children }
  }
  if (spread) throw new LensUnsupported(`a spread without an embed ("${item}")`)
  let cast: string | undefined
  const castAt = rest.indexOf('::')
  if (castAt >= 0) {
    cast = rest.slice(castAt + 2)
    rest = rest.slice(0, castAt)
  }
  const parts = rest.split(/(->>|->)/)
  const name = unquote(parts[0] ?? '')
  const path: JsonStep[] = []
  for (let i = 1; i < parts.length; i += 2) path.push({ op: parts[i] as '->' | '->>', key: unquote(parts[i + 1] ?? '') })
  return { kind: 'col', name, alias, path, cast }
}

/** The key a column node lands on in the answer, as PostgREST names it. */
export function outKey(node: Extract<SelectNode, { kind: 'col' }>): string {
  if (node.alias) return node.alias
  const last = node.path[node.path.length - 1]
  if (last) return last.key
  return node.name
}
