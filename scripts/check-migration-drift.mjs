#!/usr/bin/env node
/**
 * Migration drift check: the remote migration ledger (supabase_migrations.schema_migrations on
 * the linked project) must stay 1:1 with supabase/migrations/*.sql. Drift broke `db push` for
 * weeks (reconciled 2026-07-04: 19 renumbered versions, 5 unledgered applied migrations, 1
 * orphan applied from a never-merged branch, 1 version collision between parallel branches).
 *
 * - Remote version with no local file          -> FAIL (db push refuses; renumber/orphan drift)
 * - Duplicate version across two local files   -> FAIL (one silently loses; collision gotcha)
 * - Local file not applied remotely (pending)  -> warn on pushes, FAIL when STRICT_PENDING=1
 *   (the daily cron sets it: on main every migration should be pushed right after merge)
 *
 * Uses `supabase migration list` for the remote side, so auth follows the CLI: a local
 * `supabase login` session, or SUPABASE_ACCESS_TOKEN + `supabase link` in CI.
 */

import { readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const MIGRATIONS_DIR = 'supabase/migrations'
const STRICT_PENDING = !!process.env.STRICT_PENDING

function repoVersions() {
  const seen = new Map()
  const dupes = []
  for (const f of readdirSync(MIGRATIONS_DIR).sort()) {
    const m = /^(\d{14})_.+\.sql$/.exec(f)
    if (!m) continue
    if (seen.has(m[1])) dupes.push(`${m[1]}: ${seen.get(m[1])} AND ${f}`)
    seen.set(m[1], f)
  }
  return { versions: seen, dupes }
}

function remoteVersions() {
  let raw
  try {
    raw = execFileSync('npx', ['--yes', 'supabase', 'migration', 'list'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    const stderr = (e.stderr ?? '').toString().slice(0, 500)
    console.error(
      'check-migration-drift: `supabase migration list` failed.\n' +
        (stderr ? `${stderr}\n` : '') +
        'Auth: run `npx supabase login` locally, or in CI set SUPABASE_ACCESS_TOKEN and run ' +
        '`npx supabase link --project-ref <ref>` first.',
    )
    process.exit(1)
  }
  const versions = new Set()
  // Newer CLI versions emit JSON when stdout is not a TTY:
  //   {"migrations":[{"local":"20260619120000","remote":"20260619120000","time":"..."}, ...]}
  // Older ones print a table: "   20260619120000 | 20260619120000 | 2026-06-19 12:00:00"
  // with either side blank for local-only / remote-only versions.
  try {
    const parsed = JSON.parse(raw)
    for (const row of parsed.migrations ?? []) {
      if (row.remote) versions.add(row.remote)
    }
  } catch {
    for (const line of raw.split('\n')) {
      const m = /^\s*(\d{14})?\s*\|\s*(\d{14})?\s*\|/.exec(line)
      if (m && m[2]) versions.add(m[2])
    }
  }
  if (versions.size === 0) {
    console.error('check-migration-drift: parsed 0 remote versions — `migration list` output format changed?')
    process.exit(1)
  }
  return versions
}

const { versions: repo, dupes } = repoVersions()
const remote = remoteVersions()

const remoteOnly = [...remote].filter((v) => !repo.has(v)).sort()
const pending = [...repo.keys()].filter((v) => !remote.has(v)).sort()

let failed = false

if (dupes.length > 0) {
  failed = true
  console.error(
    `\nMIGRATION DRIFT: duplicate version number(s) across local files (one will be skipped):\n` +
      dupes.map((d) => `  - ${d}`).join('\n'),
  )
}

if (remoteOnly.length > 0) {
  failed = true
  console.error(
    `\nMIGRATION DRIFT: ${remoteOnly.length} remote ledger version(s) have no file in ${MIGRATIONS_DIR}/ — db push will refuse:\n` +
      remoteOnly.map((v) => `  - ${v}`).join('\n') +
      '\n\nUsual cause: a migration applied via MCP apply_migration (server-timestamp version) or from an' +
      '\nunmerged branch. Reconcile per docs in CLAUDE.md / the supabase-deploy-model notes: either recover' +
      '\nthe file under that exact version, or rename the ledger row to the repo version it duplicates.\n',
  )
}

if (pending.length > 0) {
  const lines =
    `${pending.length} local migration(s) not applied to the remote ledger:\n` +
    pending.map((v) => `  - ${repo.get(v)}`).join('\n') +
    '\n\nApply with: npx supabase db push\n'
  if (STRICT_PENDING) {
    failed = true
    console.error(`\nMIGRATION DRIFT (strict): ${lines}`)
  } else {
    console.warn(`\nwarning: ${lines}`)
  }
}

if (failed) process.exit(1)

console.log(
  `migration drift check OK: ${repo.size} local file(s), ${remote.size} remote version(s)` +
    (pending.length > 0 ? `, ${pending.length} pending (push soon)` : ', fully applied') +
    '.',
)
