#!/usr/bin/env node
/**
 * CSS tokens that are never defined (v2.5444).
 *
 * The theme check (`theme-tokenize.mjs --check`) catches a raw neutral hex; it cannot see a `var(--name)` whose name no
 * stylesheet defines. Such a value is invalid when the page computes it, so the property falls back to `unset`: a
 * `background` paints nothing, a `border` or an `outline` draws nothing, and a `color` inherits whatever is around it.
 * `--bg-blue-50`, `--surface-muted` and 36 more names sat on main that way, in 289 places.
 *
 * A name is defined when a CSS file under src declares it (`--name:`), or when code sets it: a quoted name as a style
 * key (`'--name':`, `['--name' as string]:`), passed to `setProperty('--name', …)`, or held in a constant that is
 * (`const SCROLL_LOCK_TOP_VAR = '--scroll-lock-top'`). `--app-bottom-chrome` is set by Layout's style. A name merely quoted in code, such as a comment's `` `--surface-muted` ``, defines nothing. A name built in a
 * template (`var(--timeline-job-${i})`) is defined when any defined name starts with its fixed part. Every
 * `var(--name …)` in src/**\/*.{ts,tsx,css} is a use.
 *
 * `--fix` rewrites each use of an undefined name. A use with a fallback is what renders today, so the fallback takes its
 * place when it is a defined token, a keyword (`inherit`, `currentColor`, `transparent`) or a plain value (`500ms`): the
 * page looks the same. Otherwise the name becomes its twin from `TWIN`, the defined token of the same value or role. A
 * name with no twin is reported; add one to the table.
 *
 * `PENDING` holds names whose remaining uses wait for a second sweep that changes how a page looks, each with the rule
 * for which uses may wait. The check passes them, says how many are left, and fails once none is left, so the entry is
 * taken out with the last of them.
 *
 * Usage: node scripts/check-css-tokens.mjs [--fix]
 *   Exits 1 when a use names a token nothing defines (after --fix, when one has no twin).
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SRC = path.join(ROOT, 'src')
const FIX = process.argv.includes('--fix')

/** Each undefined name's defined twin: the token of the same value (Tailwind's scale) or the same role. */
const TWIN = {
  '--text': '--text-base',
  '--text-900': '--text-strong',
  '--text-800': '--text-gray-800',
  '--text-primary': '--text-base',
  '--text-soft': '--text-muted',
  '--text-blue-600': '--text-link',
  '--text-amber-600': '--text-amber-700',
  '--text-emerald-700': '--text-emerald-800',
  '--text-indigo-700': '--text-indigo-800',
  '--text-purple-700': '--text-violet-700',
  '--text-purple-800': '--text-violet-800',
  '--bg-blue-50': '--bg-blue-tint',
  '--bg-blue-100': '--bg-blue-200',
  '--bg-blue-soft': '--bg-blue-tint',
  '--bg-amber-50': '--bg-amber-tint',
  '--bg-green-50': '--bg-green-tint',
  '--bg-red-50': '--bg-red-tint',
  '--bg-purple-tint': '--bg-violet-100',
  '--bg-purple-100': '--bg-violet-100',
  '--bg-teal-tint': '--bg-emerald-tint',
  '--bg-400': '--border-400',
  '--surface-2': '--bg-subtle',
  '--surface-muted': '--bg-subtle',
  '--surface-raised': '--surface',
  '--surface-strong': '--bg-muted',
  '--surface-blue-50': '--bg-blue-tint',
  '--surface-indigo-50': '--bg-indigo-100',
  '--sunken': '--bg-muted',
  '--border-soft': '--border',
  '--border-subtle': '--border',
  '--border-stronger': '--border-strong',
  '--border-green-soft': '--border-green',
  '--border-green-300': '--border-green',
  '--border-amber-200': '--border-amber-soft',
  '--border-amber-strong': '--border-amber',
  '--border-blue-soft': '--border-blue',
  '--chrome-muted': '--chrome-text',
}

/**
 * A twin that depends on the property: a text colour used as a button's fill is a saturated action colour, which stays
 * literal (CLAUDE.md, theme tokens).
 */
const TWIN_BY_PROPERTY = {
  '--text-blue-600': { background: '#2563eb', backgroundColor: '#2563eb', 'background-color': '#2563eb' },
}

/** Names whose remaining uses wait for a second sweep, and which uses may wait. */
const PENDING = {
  // `color: var(--text)` inherits today, so most of it looks right by accident; mapping it to --text-base would turn a
  // chip that inherited white to the base colour. The second sweep maps it after a screenshot pass in daylight.
  '--text': {
    why: 'a text colour (color, fill or stroke, or a value with no property on its line); the second sweep maps it to --text-base after a screenshot pass',
    waits: (property) => !NOT_TEXT_COLOUR.test(property ?? ''),
  },
}

/** Properties a `var(--text)` must not wait on: they paint nothing today. */
const NOT_TEXT_COLOUR = /^(background|backgroundColor|background-color|border\w*|border-[\w-]+|outline\w*|outline-[\w-]+|boxShadow|box-shadow)$/

const KEYWORD = /^(inherit|initial|unset|revert|currentColor|transparent|none)$/
const PLAIN_VALUE = /^-?[\d.]+(ms|s|px|rem|em|%|deg)?$/

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|css)$/.test(entry.name)) out.push(p)
  }
  return out
}

/** Every `var(` in the text with its name, its fallback and its extent; nested ones too. */
function usesIn(text) {
  const out = []
  for (let at = text.indexOf('var('); at >= 0; at = text.indexOf('var(', at + 4)) {
    const head = /^var\(\s*(--[A-Za-z0-9_-]+)(\$\{)?/.exec(text.slice(at, at + 120))
    if (!head) continue
    let depth = 0
    let end = -1
    let comma = -1
    for (let i = at + 3; i < text.length; i++) {
      const ch = text[i]
      if (ch === '(') depth++
      else if (ch === ')') {
        depth--
        if (depth === 0) {
          end = i + 1
          break
        }
      } else if (ch === ',' && depth === 1 && comma < 0) comma = i
      else if (ch === '\n' && depth > 0 && i - at > 400) break
    }
    if (end < 0) continue
    out.push({
      start: at,
      end,
      name: head[1],
      prefix: Boolean(head[2]),
      fallback: comma > 0 ? text.slice(comma + 1, end - 1).trim() : null,
    })
  }
  return out
}

/** The CSS property a value at `index` belongs to: the nearest `name:` or JSX `name=` before it on its line. */
function propertyAt(text, index) {
  const lineStart = text.lastIndexOf('\n', index - 1) + 1
  const before = text.slice(lineStart, index)
  let property = null
  for (const m of before.matchAll(/([A-Za-z][A-Za-z-]*)\s*(?::(?!:)|=(?![=>]))/g)) {
    if (before[m.index - 1] === '=' || before[m.index - 1] === '!') continue
    property = m[1]
  }
  return property
}

const files = walk(SRC)
const texts = new Map(files.map((f) => [f, readFileSync(f, 'utf8')]))

const defined = new Set()
for (const [file, text] of texts) {
  if (file.endsWith('.css')) for (const m of text.matchAll(/(?<![\w-])(--[A-Za-z0-9_-]+)\s*:/g)) defined.add(m[1])
  else {
    for (const m of text.matchAll(/(['"`])(--[A-Za-z0-9_-]+)\1(?:\s+as\s+\w+)?\s*\]?\s*:/g)) defined.add(m[2])
    for (const m of text.matchAll(/setProperty\(\s*(['"`])(--[A-Za-z0-9_-]+)\1/g)) defined.add(m[2])
    for (const m of text.matchAll(/=\s*(['"`])(--[A-Za-z0-9_-]+)\1/g)) defined.add(m[2])
  }
}
const isDefined = (use) => (use.prefix ? [...defined].some((d) => d.startsWith(use.name)) : defined.has(use.name))

/** What a use of an undefined name becomes under --fix, or null when it has no twin. */
function replacement(use, property) {
  const fb = use.fallback
  if (fb) {
    const inner = usesIn(fb)[0]
    if (inner && inner.start === 0 && inner.end === fb.length && isDefined(inner)) return fb
    if (KEYWORD.test(fb) || PLAIN_VALUE.test(fb)) return fb
  }
  const literal = TWIN_BY_PROPERTY[use.name]?.[property ?? '']
  if (literal) return literal
  const twin = TWIN[use.name]
  return twin ? `var(${twin})` : null
}

const offenders = []
const pending = new Map()
let fixed = 0
for (const [file, text] of texts) {
  const rel = path.relative(ROOT, file)
  const edits = []
  for (const use of usesIn(text)) {
    if (isDefined(use)) continue
    const property = propertyAt(text, use.start)
    const line = text.slice(0, use.start).split('\n').length
    const wait = PENDING[use.name]
    if (wait && wait.waits(property)) {
      pending.set(use.name, (pending.get(use.name) ?? 0) + 1)
      continue
    }
    const to = replacement(use, property)
    if (FIX && to && !edits.some((e) => use.start < e.end && use.end > e.start)) edits.push({ start: use.start, end: use.end, to })
    else if (!(FIX && to)) offenders.push(`${rel}:${line}  ${use.name}${property ? ` (${property})` : ''}  → ${to ?? 'no twin: add one to TWIN'}`)
  }
  if (edits.length) {
    let out = text
    for (const e of [...edits].sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.to + out.slice(e.end)
    writeFileSync(file, out)
    fixed += edits.length
  }
}

for (const name of Object.keys(PENDING)) {
  if (!pending.has(name)) offenders.push(`scripts/check-css-tokens.mjs  PENDING holds ${name}, and no use of it waits any more: take it out`)
}

if (FIX) console.log(`css tokens: rewrote ${fixed} use${fixed === 1 ? '' : 's'} of names nothing defines.`)
for (const [name, n] of pending) console.log(`css tokens: ${n} use${n === 1 ? '' : 's'} of ${name} wait for the second sweep (${PENDING[name].why}).`)
if (offenders.length) {
  console.error(`css tokens: ${offenders.length} use${offenders.length === 1 ? '' : 's'} of a name no CSS defines:`)
  for (const o of offenders) console.error(`  ${o}`)
  process.exit(1)
}
console.log('css tokens OK: every var(--name) under src names a token a stylesheet or the code defines.')
