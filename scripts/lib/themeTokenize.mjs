/**
 * The theme check's kernel: the tables that map a raw colour to its CSS variable and the rewrite that applies
 * them. `scripts/theme-tokenize.mjs` is the command; this file reads no disk, so `src/lib/themeTokenize.test.ts`
 * can hold it to its cases.
 */

export const TEXT = {
  '#111827': 'var(--text-strong)',
  '#1a1a1a': 'var(--text-base)',
  '#374151': 'var(--text-700)',
  '#4b5563': 'var(--text-600)',
  '#6b7280': 'var(--text-muted)',
  '#9ca3af': 'var(--text-faint)',
  '#d1d5db': 'var(--text-faint-300)',
  '#0f172a': 'var(--text-slate-900)',
  '#475569': 'var(--text-slate-600)',
  // slate-700 text consolidated onto the slate-600 token: one shade apart in
  // light mode, and the token gives it a readable value on dark surfaces.
  '#334155': 'var(--text-slate-600)',
  '#64748b': 'var(--text-slate-500)',
  '#94a3b8': 'var(--text-slate-400)',
  '#2563eb': 'var(--text-link)',
  '#3b82f6': 'var(--text-blue-500)',
  '#1d4ed8': 'var(--text-blue-700)',
  '#dc2626': 'var(--text-red-600)',
  '#b91c1c': 'var(--text-red-700)',
  '#991b1b': 'var(--text-red-800)',
  '#059669': 'var(--text-green-600)',
  // green-700 words: the literal stayed dark on the dark surface, 2.93:1; the token reads #4ade80 there.
  '#15803d': 'var(--text-green-700)',
  '#b45309': 'var(--text-amber-700)',
  '#92400e': 'var(--text-amber-800)',
  '#78350f': 'var(--text-amber-900)',
  '#854d0e': 'var(--text-yellow-800)',
  '#c2410c': 'var(--text-orange-700)',
  '#9a3412': 'var(--text-orange-800)',
  '#1f2937': 'var(--text-gray-800)',
  '#1e40af': 'var(--text-blue-800)',
  '#166534': 'var(--text-green-800)',
  '#065f46': 'var(--text-emerald-800)',
  '#7f1d1d': 'var(--text-red-900)',
  '#0369a1': 'var(--text-sky-700)',
  '#075985': 'var(--text-sky-800)',
  '#6d28d9': 'var(--text-violet-700)',
  '#5b21b6': 'var(--text-violet-800)',
  '#3730a3': 'var(--text-indigo-800)',
}

export const BG = {
  '#fafafa': 'var(--bg-page)',
  '#ffffff': 'var(--surface)',
  '#fff': 'var(--surface)',
  '#fefdfb': 'var(--surface)',
  white: 'var(--surface)',
  '#f9fafb': 'var(--bg-subtle)',
  '#fafbfc': 'var(--bg-subtle)',
  '#fef08a': 'var(--bg-yellow-200)',
  '#bbf7d0': 'var(--bg-green-200)',
  '#f3f4f6': 'var(--bg-muted)',
  '#e5e7eb': 'var(--bg-200)',
  '#eff6ff': 'var(--bg-blue-tint)',
  '#f0f9ff': 'var(--bg-sky-tint)',
  '#fef2f2': 'var(--bg-red-tint)',
  '#fee2e2': 'var(--bg-red-100)',
  '#fecaca': 'var(--bg-red-200)',
  '#fffbeb': 'var(--bg-amber-tint)',
  '#fef3c7': 'var(--bg-amber-100)',
  '#fff7ed': 'var(--bg-orange-tint)',
  '#f0fdf4': 'var(--bg-green-tint)',
  '#dcfce7': 'var(--bg-green-100)',
  '#f8fafc': 'var(--bg-slate-tint)',
  '#f1f5f9': 'var(--bg-slate-100)',
  '#f5f5f5': 'var(--bg-neutral-100)',
  '#fdfaf3': 'var(--bg-cream)',
  '#fefce8': 'var(--bg-yellow-tint)',
  '#ffedd5': 'var(--bg-orange-100)',
  '#ecfdf5': 'var(--bg-emerald-tint)',
  '#d1fae5': 'var(--bg-emerald-100)',
  '#dbeafe': 'var(--bg-blue-200)',
  '#e0f2fe': 'var(--bg-sky-100)',
  '#fde68a': 'var(--bg-amber-200)',
  '#ede9fe': 'var(--bg-violet-100)',
  '#ddd6fe': 'var(--bg-violet-200)',
  '#e0e7ff': 'var(--bg-indigo-100)',
  '#c7d2fe': 'var(--bg-indigo-200)',
}

export const BORDER = {
  '#e5e7eb': 'var(--border)',
  // slate-200/300 borders consolidated onto the gray-200/300 border tokens: the
  // light values differ by only a few units (imperceptible on a border) and this
  // gives them proper dark values instead of staying light in dark mode.
  '#e2e8f0': 'var(--border)',
  // gray-100/slate-100 hairline borders also consolidate onto --border: as
  // near-white lines they glare on dark surfaces, and at 1px the light-mode
  // difference from gray-200 is imperceptible.
  '#f3f4f6': 'var(--border)',
  '#f1f5f9': 'var(--border)',
  '#d1d5db': 'var(--border-strong)',
  '#cbd5e1': 'var(--border-strong)',
  '#9ca3af': 'var(--border-400)',
  '#fdba74': 'var(--border-orange)',
  '#bfdbfe': 'var(--border-blue)',
  '#bbf7d0': 'var(--border-green)',
  // green-300 borders consolidated onto the green-200 border token: one shade
  // apart at 1px, and the token gives them a proper dark value.
  '#86efac': 'var(--border-green)',
  '#fcd34d': 'var(--border-amber)',
  '#fde68a': 'var(--border-amber-soft)',
  '#fca5a5': 'var(--border-red)',
  '#bae6fd': 'var(--border-sky)',
  '#a5b4fc': 'var(--border-indigo)',
  '#c7d2fe': 'var(--border-indigo-soft)',
  '#c4b5fd': 'var(--border-violet)',
}

export const TEXT_PROPS = /^(color|caretColor|WebkitTextFillColor)$/
export const BG_PROPS = /^(background|backgroundColor)$/
export const BORDER_PROPS = /^(border|borderTop|borderRight|borderBottom|borderLeft|borderColor|borderTopColor|borderRightColor|borderBottomColor|borderLeftColor|outline|outlineColor)$/

export function tableFor(prop) {
  if (TEXT_PROPS.test(prop)) return TEXT
  if (BG_PROPS.test(prop)) return BG
  if (BORDER_PROPS.test(prop)) return BORDER
  return null
}

/** Replace mapped literals inside one quoted style value ('#hex' or '1px solid #hex'). */
export function rewriteValue(value, table) {
  const direct = table[value.toLowerCase()]
  if (direct) return direct
  // shorthand like '1px solid #e5e7eb' / '2px dashed #d1d5db'
  return value.replace(/#[0-9a-fA-F]{3,6}\b/g, (hex) => table[hex.toLowerCase()] ?? hex)
}


// prop: '...'
const STYLE_LITERAL = /([A-Za-z]+)(\s*:\s*)('([^']*)')/g
// prop: cond ? '...' : '...', a quoted string on both sides and all on one line (the first pattern, kept as it was)
const TERNARY_TAIL = /([A-Za-z]+)(\s*:\s*[^,\n{}]*?\?\s*)('([^']*)')(\s*:\s*)('([^']*)')/g
const PROP_START = /([A-Za-z]+)\s*:/g

/**
 * Read one style value from just after its `prop:` to the comma, brace or line end that closes it, and return the
 * single-quoted strings that stand as a branch of a ternary or as a `??` fallback: the string follows a `?` or a
 * ternary's `:`, and what follows it is the next `:` or the value's end. A string the condition compares against
 * (`kind === 'white' ? …`) or one handed to a call (`tint('#eff6ff')`) is not a branch and is left alone. The value
 * runs on to the next line only when a line ends on `?`, `:` or an open bracket, or the next begins with `?` or `:`.
 * A template string or a comment inside the value ends the read with nothing: those need a person.
 */
export function ternaryBranches(src, from) {
  const stack = [] // true for a grouping paren, false for a call, an index or an object
  const found = []
  let last = '' // the last character that was not white space
  let colons = 0 // ternaries opened and not yet answered by their `:`
  const close = (ch) => {
    const q = found[found.length - 1]
    if (q && q.after === undefined) q.after = ch
  }
  let i = from
  for (; i < src.length; i++) {
    const ch = src[i]
    if (ch === ' ' || ch === '\t' || ch === '\r') continue
    if (ch === '\n') {
      const next = /\S/.exec(src.slice(i + 1, i + 400))?.[0]
      if (stack.length > 0 || last === '' || last === '?' || last === ':' || next === '?' || next === ':') continue
      break
    }
    if (ch === '`') return []
    if (ch === '/' && (src[i + 1] === '/' || src[i + 1] === '*')) return []
    if (ch === "'" || ch === '"') {
      let j = i + 1
      while (j < src.length && src[j] !== ch && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1
      if (src[j] !== ch) return []
      close(ch)
      if (ch === "'" && stack.every(Boolean) && (last === '?' || (last === ':' && colons > 0))) {
        found.push({ start: i, end: j + 1, value: src.slice(i + 1, j), after: undefined })
      }
      if (last === ':' && colons > 0) colons--
      last = ch
      i = j
      continue
    }
    if (stack.length === 0 && (ch === ',' || ch === '}' || ch === ')' || ch === ']' || ch === ';')) break
    if (ch === '(' || ch === '[' || ch === '{') {
      if (last === ':' && colons > 0) colons--
      stack.push(ch === '(' && !/[\w)\]'"]/.test(last))
      close(ch)
    } else if (ch === ')' || ch === ']' || ch === '}') {
      const grouping = stack.pop()
      close(grouping ? '' : ch)
    } else {
      // `?.` is a chain and `?:` never follows a value here, so a lone `?` after a value opens a ternary
      if (ch === '?' && src[i + 1] !== '.' && src[i + 1] !== '?' && last !== '?' && stack.every(Boolean)) colons++
      else if (last === ':' && colons > 0 && ch !== ':') colons--
      close(ch)
    }
    last = ch
  }
  close('')
  return found.filter((q) => q.after === '' || q.after === ':')
}

/** Every `prop: …` whose value holds a ternary or a `??` fallback: its quoted branches go through the prop's table. */
function rewriteTernaries(src) {
  const edits = []
  PROP_START.lastIndex = 0
  for (let m = PROP_START.exec(src); m; m = PROP_START.exec(src)) {
    const table = tableFor(m[1])
    if (!table) continue
    for (const q of ternaryBranches(src, PROP_START.lastIndex)) {
      const next = rewriteValue(q.value, table)
      if (next !== q.value) edits.push({ start: q.start, end: q.end, text: `'${next}'` })
      // a branch is never read again as a prop of its own (`cond ? color : '#fff'`)
      if (q.end > PROP_START.lastIndex) PROP_START.lastIndex = q.end
    }
  }
  let out = ''
  let at = 0
  for (const e of edits) {
    out += src.slice(at, e.start) + e.text
    at = e.end
  }
  return { out: out + src.slice(at), count: edits.length }
}

export function processSource(src) {
  let count = 0
  let out = src.replace(TERNARY_TAIL, (m, prop, pre, q1, v1, mid, q2, v2) => {
    const table = tableFor(prop)
    if (!table) return m
    const n1 = rewriteValue(v1, table)
    const n2 = rewriteValue(v2, table)
    if (n1 !== v1) count++
    if (n2 !== v2) count++
    return `${prop}${pre}'${n1}'${mid}'${n2}'`
  })
  // The same ternary with anything else on its other side (`open ? '#f0f9ff' : undefined`), nested, or over lines.
  const wide = rewriteTernaries(out)
  out = wide.out
  count += wide.count
  out = out.replace(STYLE_LITERAL, (m, prop, sep, quoted, value) => {
    const table = tableFor(prop)
    if (!table) return m
    const next = rewriteValue(value, table)
    if (next === value) return m
    count++
    return `${prop}${sep}'${next}'`
  })
  return { out, count }
}
