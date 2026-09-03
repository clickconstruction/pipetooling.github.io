#!/usr/bin/env node
/**
 * Time-zone hygiene (see docs/TIME_AND_ZONES.md). Fails on:
 *   1. 'America/Chicago' literals outside the two definition files — import APP_CALENDAR_TZ.
 *   2. (v2.2703) "today" taken from the UTC clock: `new Date().toISOString().slice(0, 10)` (and
 *      the substring/split spellings). That is tomorrow's date every evening after 7 PM Central.
 *      Use todayYmdInAppTz() from src/utils/dateUtils.ts or _shared/appTimeZone.ts.
 *      Lines that only stamp a download filename are skipped automatically (download/filename/
 *      .csv/.json/.xlsx on the line); anything else deliberate takes a `// tz-ok: <why>` waiver.
 *   3. (v2.2703) end-of-day built as `<ymd> + 'T23:59:59Z'` — that is 7 PM Central. Use
 *      endOfYmdInAppTzMs() or compare civil dates.
 *   4. (v2.2703) CURRENT_DATE in a migration newer than 20260903190000 — the session zone is UTC;
 *      use public.app_today(). Waive a deliberate read-side use with `-- tz-ok: <why>`.
 * Test files are exempt from 2–3 (they pin the bug class on purpose).
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

const UTC_TODAY_RE = /new Date\(\)\.toISOString\(\)\.(?:slice|substring)\(0, ?10\)|new Date\(\)\.toISOString\(\)\.split\(['"]T['"]\)\[0\]/
const UTC_END_OF_DAY_RE = /(?:\$\{[^}]*\}|\+ ?['"])T23:59:59/
const FILENAME_RE = /download|[Ff]ilename|\.csv|\.json|\.xlsx/
const WAIVER_RE = /tz-ok:/
const CURRENT_DATE_CUTOFF = '20260903190000'

const offenders = []
const utcToday = []
const utcEndOfDay = []
for (const file of files) {
  if (ALLOWLIST.has(file)) continue
  const txt = fs.readFileSync(file, 'utf8')
  if (RE.test(txt)) offenders.push(path.relative(ROOT, file))
  if (/\.test\.tsx?$/.test(file)) continue
  txt.split('\n').forEach((line, i) => {
    if (WAIVER_RE.test(line)) return
    if (UTC_TODAY_RE.test(line) && !FILENAME_RE.test(line)) utcToday.push(`${path.relative(ROOT, file)}:${i + 1}`)
    if (UTC_END_OF_DAY_RE.test(line)) utcEndOfDay.push(`${path.relative(ROOT, file)}:${i + 1}`)
  })
}

const sqlCurrentDate = []
const migDir = path.join(ROOT, 'supabase', 'migrations')
if (fs.existsSync(migDir)) {
  for (const name of fs.readdirSync(migDir)) {
    if (!name.endsWith('.sql') || name.slice(0, 14) <= CURRENT_DATE_CUTOFF) continue
    fs.readFileSync(path.join(migDir, name), 'utf8').split('\n').forEach((line, i) => {
      if (/CURRENT_DATE/.test(line) && !WAIVER_RE.test(line) && !/^\s*--/.test(line)) sqlCurrentDate.push(`supabase/migrations/${name}:${i + 1}`)
    })
  }
}

let failed = false
if (offenders.length > 0) {
  failed = true
  console.error('Disallowed America/Chicago string literal in:\n  ' + offenders.join('\n  '))
  console.error('\nImport APP_CALENDAR_TZ from src/utils/dateUtils.ts (web) or supabase/functions/_shared/appTimeZone.ts (Edge).')
}
if (utcToday.length > 0) {
  failed = true
  console.error('\n"Today" taken from the UTC clock (tomorrow\'s date every evening after 7 PM Central):\n  ' + utcToday.join('\n  '))
  console.error('\nUse todayYmdInAppTz() from src/utils/dateUtils.ts (web) or supabase/functions/_shared/appTimeZone.ts (Edge); a filename stamp may carry `// tz-ok: filename stamp`.')
}
if (utcEndOfDay.length > 0) {
  failed = true
  console.error('\nEnd of day built as <ymd> + \'T23:59:59Z\' (that is 7 PM Central):\n  ' + utcEndOfDay.join('\n  '))
  console.error('\nUse endOfYmdInAppTzMs(ymd) from src/utils/dateUtils.ts, or compare civil dates against todayYmdInAppTz().')
}
if (sqlCurrentDate.length > 0) {
  failed = true
  console.error('\nCURRENT_DATE in a migration newer than ' + CURRENT_DATE_CUTOFF + ' (the session zone is UTC):\n  ' + sqlCurrentDate.join('\n  '))
  console.error('\nUse public.app_today(); waive a deliberate read-side comparison with `-- tz-ok: <why>`.')
}
if (failed) process.exit(1)
