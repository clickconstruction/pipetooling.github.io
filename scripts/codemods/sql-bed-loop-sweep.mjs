#!/usr/bin/env node
/**
 * SQL bed loop sweep (v2.6404, v2.6415).
 *
 * Every whole-schema bed applied the migrations with one `docker exec` per file: 1,068 calls through
 * one Docker daemon, 477 s with eight beds side by side against 236 s for one psql (v2.6404). Since
 * v2.6415 a leg migrates one container and starts most beds from a copy of it, which needs a bed's
 * whole start in one step it can skip. Mechanical and re-runnable (rebase rule: re-run this, never
 * hand-resolve its diff), from the old loop or v2.6404's form to the newest.
 *
 * The rewrites, on the `for f in supabase/migrations/*.sql` loop:
 *   - a bed that starts with the prod extras and then every migration, with nothing between, takes
 *     `pgtest_migrate` in place of both: the extras line goes, and the loop (or v2.6404's
 *     `pgtest_apply supabase/migrations/*.sql`) becomes that one call;
 *   - a bed with a local Postgres (PGTEST_PGBIN) keeps its loop for that way and takes
 *     pgtest_migrate for Docker, since a local run has no container to copy;
 *   - a loop that also runs a file again, or a seed before one, stays a loop and lists the files in
 *     their order, with its comments and conditions kept, and `pgtest_apply "${files[@]}"` follows
 *     it. Its extras stay where they are, and it never starts from a copy.
 *
 * Left alone: a bed already swept, and a bed outside scripts/sql-beds.txt, since CI never runs it to
 * prove the change. Refused and listed: a loop line this script does not know, and a step between the
 * extras and the migrations.
 *
 * Usage: node scripts/codemods/sql-bed-loop-sweep.mjs [--dry | --check]
 *   --dry    lists what it would rewrite, writes nothing
 *   --check  the same, and exits 1 when anything is left to rewrite or refused
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const CHECK = process.argv.includes('--check')
const DRY = CHECK || process.argv.includes('--dry')

const LOOP_OPEN = 'for f in supabase/migrations/*.sql; do'
const ON_FAIL = String.raw`>/dev/null 2>"\$ERR" \|\| \{ echo "FAILED [^"]*"; grep -E -A6 "ERROR\|FATAL" "\$ERR" \| head -20; exit 1; \}`
// One file through its own psql, with any indent and a `;;` when it ends a case arm.
const APPLY_LINE = new RegExp(String.raw`^(\s*)psql_as postgres -f - < (\S+) ${ON_FAIL}( ;;)?$`)
const PLAIN = `  psql_as postgres -f - < "$f" >/dev/null 2>"$ERR" || { echo "FAILED applying $f"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }`
const PIPED = `  apply "$f" | psql_as postgres -f - >/dev/null 2>"$ERR" || { echo "FAILED applying $f"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }`
const APPLY_ALL = 'pgtest_apply supabase/migrations/*.sql'
const EXTRAS = /^\s*psql_as supabase_admin -f - < "?supabase\/tests\/combined_copies\/00_prod_extras\.sql"? >\/dev\/null$/
// What may sit between a bed's extras and its migrations: lines that never touch the database.
const BETWEEN = new Set(['', 'apply() { cat "$1"; }', 'fi', 'if [ -n "${PGTEST_PGBIN:-}" ]; then', LOOP_OPEN, PIPED.trim(), 'done', 'else'])

const beds = readFileSync('scripts/sql-beds.txt', 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'))

const rewritten = []
const refused = []
const migrated = []
const listed = []
const noLoop = []

for (const bed of beds) {
  const file = `scripts/pgtest-${bed}.sh`
  if (!existsSync(file)) {
    refused.push(`${file}: listed, but there is no such file`)
    continue
  }
  const lines = readFileSync(file, 'utf8').split('\n')
  let changed = false

  // The old loop, as v2.6404 swept it. A loop that no longer runs psql itself is v2.6404's list.
  const open = lines.indexOf(LOOP_OPEN)
  if (open >= 0) {
    const close = lines.indexOf('done', open)
    const body = lines.slice(open + 1, close)
    let next = null
    if (body.length === 1 && body[0] === PLAIN) {
      next = [APPLY_ALL]
    } else if (body.length === 1 && body[0] === PIPED) {
      next = ['if [ -n "${PGTEST_PGBIN:-}" ]; then', `  ${LOOP_OPEN}`, `  ${PIPED}`, '  done', 'else', `  ${APPLY_ALL}`, 'fi']
    } else if (body.some((line) => line.includes('psql_as'))) {
      const mapped = body.map((line) => {
        const m = line.match(APPLY_LINE)
        return m ? `${m[1]}files+=(${m[2]})${m[3] ?? ''}` : line
      })
      const stray = mapped.filter((line) => line.includes('psql_as'))
      if (stray.length > 0) {
        refused.push(`${file}: a loop line this script does not know: ${stray[0].trim().slice(0, 80)}`)
        continue
      }
      next = ['files=()', LOOP_OPEN, ...mapped, 'done', 'pgtest_apply "${files[@]}"']
    }
    if (next) {
      lines.splice(open, close - open + 1, ...next)
      changed = true
    }
  }

  // The prod extras and then every migration, with nothing between, become pgtest_migrate.
  const at = lines.findIndex((line) => line.trim() === APPLY_ALL)
  if (at >= 0) {
    let ex = at - 1
    while (ex >= 0 && !EXTRAS.test(lines[ex])) {
      const line = lines[ex].trim()
      if (!line.startsWith('#') && !BETWEEN.has(line)) break
      ex -= 1
    }
    if (ex < 0 || !EXTRAS.test(lines[ex])) {
      refused.push(`${file}: a step between the prod extras and the migrations: ${(lines[ex] ?? '').trim().slice(0, 80)}`)
      continue
    }
    lines[at] = `${lines[at].match(/^\s*/)[0]}pgtest_migrate`
    lines.splice(ex, 1)
    changed = true
  }

  if (lines.some((line) => line.trim() === 'pgtest_migrate')) migrated.push(bed)
  else if (lines.includes('pgtest_apply "${files[@]}"')) listed.push(bed)
  else noLoop.push(bed)
  if (changed) {
    rewritten.push(file)
    if (!DRY) writeFileSync(file, lines.join('\n'))
  }
}

for (const file of rewritten) console.log(`${DRY ? 'would rewrite' : 'rewrote'} ${file}`)
for (const why of refused) console.log(`REFUSED ${why}`)
console.log(
  `${rewritten.length} rewritten, ${refused.length} refused. ${migrated.length} start with pgtest_migrate, ` +
    `${listed.length} list their own files, ${noLoop.length} with no such loop: ${noLoop.join(' ')}`,
)
if (refused.length > 0 || (CHECK && rewritten.length > 0)) process.exit(1)
