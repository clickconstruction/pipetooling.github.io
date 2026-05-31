#!/usr/bin/env node
/**
 * Fails if 'America/Chicago' or "America/Chicago" appears outside allowlisted definition files.
 * See docs/TIME_AND_ZONES.md
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const ALLOWLIST = new Set(
  ['src/utils/dateUtils.ts', 'supabase/functions/_shared/appTimeZone.ts'].map((p) =>
    path.normalize(path.join(ROOT, p)),
  ),
)

const RE = /['"]America\/Chicago['"]/

function walkTs(dir, out) {
  if (!fs.existsSync(dir)) return
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === 'dist') continue
      walkTs(p, out)
    } else if (ent.isFile() && (p.endsWith('.ts') || p.endsWith('.tsx'))) {
      out.push(path.normalize(p))
    }
  }
}

const files = []
for (const base of ['src', path.join('supabase', 'functions')]) {
  walkTs(path.join(ROOT, base), files)
}

const offenders = []
for (const file of files) {
  if (ALLOWLIST.has(file)) continue
  const txt = fs.readFileSync(file, 'utf8')
  if (RE.test(txt)) offenders.push(path.relative(ROOT, file))
}

if (offenders.length > 0) {
  console.error('Disallowed America/Chicago string literal in:\n  ' + offenders.join('\n  '))
  console.error('\nImport APP_CALENDAR_TZ from src/utils/dateUtils.ts (web) or supabase/functions/_shared/appTimeZone.ts (Edge).')
  process.exit(1)
}
