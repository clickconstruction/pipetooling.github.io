#!/usr/bin/env node
/**
 * SQL bed loop sweep (v2.6404).
 *
 * Every whole-schema bed applied the migrations with one `docker exec` per file: 1,068 calls through
 * one Docker daemon, 477 s with eight beds side by side against 236 s for one psql. This moves each
 * bed in scripts/sql-beds.txt to `pgtest_apply` (scripts/pgtest-pull.sh). Mechanical and re-runnable
 * (rebase rule: re-run this, never hand-resolve its diff).
 *
 * The rewrites, on the `for f in supabase/migrations/*.sql` loop:
 *   - the loop that only applies each file becomes `pgtest_apply supabase/migrations/*.sql`;
 *   - a loop that also runs a file again, or a seed before one, stays a loop and lists the files in
 *     their order, with its comments and conditions kept, and `pgtest_apply "${files[@]}"` follows it;
 *   - a bed with a local Postgres (PGTEST_PGBIN) keeps its loop for that way and takes pgtest_apply
 *     for Docker, since a local run has no container to copy into.
 *
 * Left alone: a loop already swept, and a bed outside scripts/sql-beds.txt, since CI never runs it to
 * prove the change. Refused and listed: a loop line this script does not know.
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

const beds = readFileSync('scripts/sql-beds.txt', 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'))

const rewritten = []
const refused = []
const swept = []
const noLoop = []

for (const bed of beds) {
  const file = `scripts/pgtest-${bed}.sh`
  if (!existsSync(file)) {
    refused.push(`${file}: listed, but there is no such file`)
    continue
  }
  const lines = readFileSync(file, 'utf8').split('\n')
  if (lines.some((line) => line.trim().startsWith('pgtest_apply '))) {
    swept.push(bed)
    continue
  }
  const open = lines.indexOf(LOOP_OPEN)
  if (open < 0) {
    noLoop.push(bed)
    continue
  }
  const close = lines.indexOf('done', open)
  const body = lines.slice(open + 1, close)

  let next = null
  if (body.length === 1 && body[0] === PLAIN) {
    next = ['pgtest_apply supabase/migrations/*.sql']
  } else if (body.length === 1 && body[0] === PIPED) {
    next = ['if [ -n "${PGTEST_PGBIN:-}" ]; then', `  ${LOOP_OPEN}`, `  ${PIPED}`, '  done', 'else', '  pgtest_apply supabase/migrations/*.sql', 'fi']
  } else {
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
  rewritten.push(file)
  if (!DRY) {
    lines.splice(open, close - open + 1, ...next)
    writeFileSync(file, lines.join('\n'))
  }
}

for (const file of rewritten) console.log(`${DRY ? 'would rewrite' : 'rewrote'} ${file}`)
for (const why of refused) console.log(`REFUSED ${why}`)
console.log(
  `${rewritten.length} rewritten, ${refused.length} refused, ${swept.length} already swept, ` +
    `${noLoop.length} with no such loop: ${noLoop.join(' ')}`,
)
if (refused.length > 0 || (CHECK && rewritten.length > 0)) process.exit(1)
