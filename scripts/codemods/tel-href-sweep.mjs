#!/usr/bin/env node
/**
 * The `tel:` sweep (v2.3571 — Customer Waiting residual, "shared call button sweep").
 *
 * Every hand-rolled `tel:` link in the app dialed through its own sanitizer — five of them:
 * `.replace(/[^+\d]/g, '')`, `.replace(/[^\d+]/g, '')`, `.replace(/[^0-9+]/g, '')`,
 * `encodeURIComponent(...)`, and none at all. This rewrites each `href` to read
 * `telHrefFor(<the phone expression>)` from `src/lib/phoneContact.ts` — one reading, the one
 * `CallPhoneButton` already uses — and leaves the anchor's text and style alone.
 *
 * Mechanical and re-runnable (CLAUDE.md: on a rebase conflict, re-run this on the new main
 * instead of hand-resolving). Idempotent: a file with no `tel:${…}` template is untouched.
 *
 * Skipped on purpose: `CallPhoneButton` / `phoneContact` (the source), tests, and hrefs that
 * read a `.telHref` field (`fieldDispatchPhone`'s `+1…` digits are already one reading).
 *
 * Usage: node scripts/codemods/tel-href-sweep.mjs [--dry]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { relative, dirname, posix } from 'node:path'
import { globSync } from 'glob'

const DRY = process.argv.includes('--dry')
const SKIP = new Set(['src/components/CallPhoneButton.tsx', 'src/lib/phoneContact.ts'])

/** `X.replace(/[^+\d]/g, '')` / `encodeURIComponent(X)` / `esc(X)` -> X; anything else as is. */
function unwrap(expr) {
  const e = expr.trim()
  let m = /^(.+)\.replace\(\/\[\^[^\]]*\]\/g,\s*''\)$/.exec(e)
  if (m) return m[1]
  m = /^encodeURIComponent\((.+)\)$/.exec(e)
  if (m) return m[1]
  m = /^esc\((.+)\)$/.exec(e)
  if (m) return m[1]
  return e
}

function importPathFor(file) {
  const rel = posix.relative(posix.dirname(file.split('\\').join('/')), 'src/lib/phoneContact')
  return rel.startsWith('.') ? rel : `./${rel}`
}

function addImport(src, file) {
  if (/from '[^']*\/phoneContact'/.test(src)) {
    // Already imports something from the kernel — extend that import.
    return src.replace(/import \{([^}]*)\} from '([^']*\/phoneContact)'/, (all, names, path) =>
      names.includes('telHrefFor') ? all : `import {${names.trimEnd()}, telHrefFor } from '${path}'`,
    )
  }
  const lines = src.split('\n')
  let last = -1
  for (let i = 0; i < lines.length; i++) if (/^import .*from '[^']+'$/.test(lines[i]) || /^import '[^']+'$/.test(lines[i])) last = i
  lines.splice(last + 1, 0, `import { telHrefFor } from '${importPathFor(file)}'`)
  return lines.join('\n')
}

let filesChanged = 0
let sites = 0
for (const file of globSync('src/**/*.{ts,tsx}', { ignore: ['**/*.test.*', '**/*.d.ts'] })) {
  if (SKIP.has(file)) continue
  const src = readFileSync(file, 'utf8')
  let count = 0
  // JSX: href={`tel:${EXPR}`}
  let out = src.replace(/href=\{`tel:\$\{([^`]*?)\}`\}/g, (all, expr) => {
    if (expr.trim().endsWith('.telHref')) return all
    count++
    return `href={telHrefFor(${unwrap(expr)})}`
  })
  // HTML builders: href="tel:${EXPR}"
  out = out.replace(/href="tel:\$\{([^`"]*?)\}"/g, (all, expr) => {
    if (expr.trim().endsWith('.telHref')) return all
    count++
    return `href="\${telHrefFor(${unwrap(expr)})}"`
  })
  if (count === 0) continue
  out = addImport(out, file)
  filesChanged++
  sites += count
  console.log(`${DRY ? '[dry] ' : ''}${file}: ${count} link${count === 1 ? '' : 's'}`)
  if (!DRY) writeFileSync(file, out)
}
console.log(`${DRY ? '[dry] ' : ''}${sites} link(s) in ${filesChanged} file(s) -> telHrefFor`)
