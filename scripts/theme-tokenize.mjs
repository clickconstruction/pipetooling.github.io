#!/usr/bin/env node
/**
 * Dark-mode token codemod: rewrites inline-style color literals onto the CSS
 * custom properties declared in src/index.css (light values are identical to
 * the hexes they replace, so light mode is pixel-for-pixel unchanged).
 *
 * Property-aware: the same hex maps differently as text vs background vs
 * border, keyed off the style property name on the same line. Saturated
 * action backgrounds (blue/green/red buttons) are intentionally left alone —
 * they read fine on dark surfaces.
 *
 * Usage: node scripts/theme-tokenize.mjs <file-or-dir> [...more]
 * Prints per-file replacement counts and, at the end, any mapped hexes left
 * behind (ternaries and computed styles need a manual pass).
 *
 * --check: dry-run guard for CI — writes nothing, exits 1 if any file
 * contains a literal the codemod would rewrite (i.e. someone added a raw
 * neutral hex instead of a token). Run as:
 *   node scripts/theme-tokenize.mjs --check src
 */
import fs from 'node:fs'
import path from 'node:path'

const TEXT = {
  '#111827': 'var(--text-strong)',
  '#1a1a1a': 'var(--text-base)',
  '#374151': 'var(--text-700)',
  '#4b5563': 'var(--text-600)',
  '#6b7280': 'var(--text-muted)',
  '#9ca3af': 'var(--text-faint)',
  '#d1d5db': 'var(--text-faint-300)',
  '#0f172a': 'var(--text-slate-900)',
  '#475569': 'var(--text-slate-600)',
  '#64748b': 'var(--text-slate-500)',
  '#94a3b8': 'var(--text-slate-400)',
  '#2563eb': 'var(--text-link)',
  '#3b82f6': 'var(--text-blue-500)',
  '#1d4ed8': 'var(--text-blue-700)',
  '#dc2626': 'var(--text-red-600)',
  '#b91c1c': 'var(--text-red-700)',
  '#991b1b': 'var(--text-red-800)',
  '#059669': 'var(--text-green-600)',
  '#b45309': 'var(--text-amber-700)',
  '#92400e': 'var(--text-amber-800)',
}

const BG = {
  '#fafafa': 'var(--bg-page)',
  '#ffffff': 'var(--surface)',
  '#fff': 'var(--surface)',
  white: 'var(--surface)',
  '#f9fafb': 'var(--bg-subtle)',
  '#f3f4f6': 'var(--bg-muted)',
  '#e5e7eb': 'var(--bg-200)',
  '#eff6ff': 'var(--bg-blue-tint)',
  '#f0f9ff': 'var(--bg-sky-tint)',
  '#fef2f2': 'var(--bg-red-tint)',
  '#fee2e2': 'var(--bg-red-100)',
  '#fecaca': 'var(--bg-red-200)',
  '#fffbeb': 'var(--bg-amber-tint)',
  '#fef3c7': 'var(--bg-amber-100)',
  '#f0fdf4': 'var(--bg-green-tint)',
  '#dcfce7': 'var(--bg-green-100)',
  '#f8fafc': 'var(--bg-slate-tint)',
  '#f1f5f9': 'var(--bg-slate-100)',
}

const BORDER = {
  '#e5e7eb': 'var(--border)',
  '#d1d5db': 'var(--border-strong)',
  '#9ca3af': 'var(--border-400)',
}

const TEXT_PROPS = /^(color|caretColor|WebkitTextFillColor)$/
const BG_PROPS = /^(background|backgroundColor)$/
const BORDER_PROPS = /^(border|borderTop|borderRight|borderBottom|borderLeft|borderColor|borderTopColor|borderRightColor|borderBottomColor|borderLeftColor|outline|outlineColor)$/

function tableFor(prop) {
  if (TEXT_PROPS.test(prop)) return TEXT
  if (BG_PROPS.test(prop)) return BG
  if (BORDER_PROPS.test(prop)) return BORDER
  return null
}

/** Replace mapped literals inside one quoted style value ('#hex' or '1px solid #hex'). */
function rewriteValue(value, table) {
  const direct = table[value.toLowerCase()]
  if (direct) return direct
  // shorthand like '1px solid #e5e7eb' / '2px dashed #d1d5db'
  return value.replace(/#[0-9a-fA-F]{3,6}\b/g, (hex) => table[hex.toLowerCase()] ?? hex)
}

// prop: '...'  — including both branches of simple same-line ternaries
const STYLE_LITERAL = /([A-Za-z]+)(\s*:\s*)('([^']*)')/g
const TERNARY_TAIL = /([A-Za-z]+)(\s*:\s*[^,\n{}]*?\?\s*)('([^']*)')(\s*:\s*)('([^']*)')/g

function processSource(src) {
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

function* walk(target) {
  const stat = fs.statSync(target)
  if (stat.isFile()) {
    if (/\.(tsx|ts)$/.test(target) && !target.endsWith('.test.ts')) yield target
    return
  }
  for (const entry of fs.readdirSync(target)) {
    yield* walk(path.join(target, entry))
  }
}

const MAPPED_HEXES = new Set(
  [...Object.keys(TEXT), ...Object.keys(BG), ...Object.keys(BORDER)].filter((k) => k.startsWith('#'))
)

const args = process.argv.slice(2)
const checkMode = args.includes('--check')
const targets = args.filter((a) => a !== '--check')

let totalReplaced = 0
const leftovers = []
const violations = []
for (const arg of targets) {
  for (const file of walk(arg)) {
    const src = fs.readFileSync(file, 'utf8')
    const { out, count } = processSource(src)
    if (count > 0) {
      if (checkMode) {
        violations.push(`${file}: ${count} raw color literal(s) the theme codemod would rewrite`)
      } else {
        fs.writeFileSync(file, out)
        totalReplaced += count
        console.log(`${file}: ${count} replaced`)
      }
    }
    const remaining = (out.match(/#[0-9a-fA-F]{6}\b/g) ?? []).filter((h) => MAPPED_HEXES.has(h.toLowerCase()))
    if (remaining.length > 0) leftovers.push(`${file}: ${remaining.length} mapped hex(es) left (manual pass)`)
  }
}

if (checkMode) {
  if (violations.length > 0) {
    console.error('theme token check FAILED — use the CSS variables from src/index.css instead of raw hexes:')
    console.error(violations.join('\n'))
    console.error('\nFix automatically with: node scripts/theme-tokenize.mjs <file>')
    process.exit(1)
  }
  console.log('theme token check OK: no raw neutral color literals in inline styles.')
  process.exit(0)
}

console.log(`\ntotal: ${totalReplaced} replacements`)
if (leftovers.length > 0) console.log(leftovers.join('\n'))
