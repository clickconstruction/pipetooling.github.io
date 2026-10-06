#!/usr/bin/env node
/**
 * The People spine sweep (punch list #29): every edge function that looks a sender or a recipient
 * up in `users` with a hand-written `.eq('is_sample', false)` takes the one rule instead,
 * `.match(REAL_ACCOUNT)` from `supabase/functions/_shared/realAccount.ts`, which also keeps
 * digital twins out. A following `.eq('is_digital_twin', false)` is folded into it.
 *
 *   node scripts/sweep-real-account.mjs          rewrite, and list the files changed
 *   node scripts/sweep-real-account.mjs --check  change nothing; exit 1 if a file would change
 *
 * Idempotent: a second run changes nothing. On a rebase conflict in a swept file, take main's
 * version of the file and run this again (CLAUDE.md: the script is the source of truth).
 * `src/lib/people/realAccountSweep.test.ts` holds the result.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'

const FUNCTIONS = 'supabase/functions'
const RULE_FILE = join(FUNCTIONS, '_shared', 'realAccount.ts')

/**
 * Files that read `is_sample` on purpose and are left alone. The same list is in
 * src/lib/people/realAccountSweep.test.ts; change both together.
 */
export const LEFT_ALONE = [
  'supabase/functions/create-user/index.ts', // writes the flag
  'supabase/functions/_shared/rosterRow.ts', // fixture accounts get no roster row (v2.3701)
  'supabase/functions/_shared/devMcpComposites.ts', // dev-mcp's View-as reads the sample accounts
]
const LEFT_ALONE_DIRS = ['supabase/functions/dev-mcp/']

const HAND_RULE = /\.eq\(\s*'is_sample'\s*,\s*false\s*\)(\s*\.eq\(\s*'is_digital_twin'\s*,\s*false\s*\))?/g
const IMPORTS = /^import\s[\s\S]*?\sfrom\s+['"][^'"]+['"];?[ \t]*$/gm

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return walk(p)
    return e.isFile() && p.endsWith('.ts') ? [p] : []
  })
}

function importPath(file) {
  const rel = relative(dirname(file), RULE_FILE).split(sep).join('/')
  return rel.startsWith('.') ? rel : `./${rel}`
}

/** The file with the rule applied, or the same text when there is nothing to do. */
export function sweepSource(file, src) {
  if (!HAND_RULE.test(src)) return src
  HAND_RULE.lastIndex = 0
  let out = src.replace(HAND_RULE, '.match(REAL_ACCOUNT)')
  if (!/\bimport\s*\{[^}]*\bREAL_ACCOUNT\b[^}]*\}\s*from\s*['"][^'"]*realAccount\.ts['"]/.test(out)) {
    const line = `import { REAL_ACCOUNT } from '${importPath(file)}'`
    const last = [...out.matchAll(IMPORTS)].pop()
    if (!last) throw new Error(`${file}: no import block to add the rule's import after`)
    const at = last.index + last[0].length
    out = `${out.slice(0, at)}\n${line}${out.slice(at)}`
  }
  return out
}

const check = process.argv.includes('--check')
const changed = []
for (const file of walk(FUNCTIONS).sort()) {
  const posix = file.split(sep).join('/')
  if (LEFT_ALONE.includes(posix) || LEFT_ALONE_DIRS.some((d) => posix.startsWith(d))) continue
  const src = readFileSync(file, 'utf8')
  const out = sweepSource(posix, src)
  if (out === src) continue
  changed.push(posix)
  if (!check) writeFileSync(file, out)
}
if (changed.length === 0) console.log('sweep-real-account: nothing to change')
else console.log(`sweep-real-account: ${check ? 'would change' : 'changed'} ${changed.length} file(s)\n  ${changed.join('\n  ')}`)
if (check && changed.length > 0) process.exit(1)
