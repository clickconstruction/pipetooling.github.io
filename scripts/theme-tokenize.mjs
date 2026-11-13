#!/usr/bin/env node
/**
 * Dark-mode token codemod: rewrites inline-style color literals onto the CSS
 * custom properties declared in src/index.css (light values are identical to
 * the hexes they replace, so light mode is pixel-for-pixel unchanged).
 *
 * Property-aware: the same hex maps differently as text vs background vs
 * border, keyed off the style property that holds the value. Saturated
 * action backgrounds (blue/green/red buttons) are intentionally left alone —
 * they read fine on dark surfaces. The tables and the rewrite live in
 * scripts/lib/themeTokenize.mjs (tests: src/lib/themeTokenize.test.ts).
 *
 * A ternary is read whatever its other side is (v2.7149): `open ? '#f0f9ff'
 * : undefined`, nested, over several lines, and a `??` fallback.
 *
 * Usage: node scripts/theme-tokenize.mjs <file-or-dir> [...more]
 * Prints per-file replacement counts and, at the end, any mapped hexes left
 * behind (a colour inside a template string, held in a const or handed to a
 * call needs a manual pass).
 *
 * --check: dry-run guard for CI — writes nothing, exits 1 if any file
 * contains a literal the codemod would rewrite (i.e. someone added a raw
 * neutral hex instead of a token). Run as:
 *   node scripts/theme-tokenize.mjs --check src
 */
import fs from 'node:fs'
import path from 'node:path'
import { TEXT, BG, BORDER, processSource } from './lib/themeTokenize.mjs'

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
