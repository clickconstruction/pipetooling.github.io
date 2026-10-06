/**
 * The People spine sweep (punch list #29) holds: every edge function that looks a sender or a
 * recipient up in `users` takes the one rule, `REAL_ACCOUNT` from
 * `supabase/functions/_shared/realAccount.ts`, instead of a hand-written `.eq('is_sample', false)`
 * that let digital twins through. A new hand-written copy fails here; `node
 * scripts/sweep-real-account.mjs` rewrites it. A bad import path would only show after a deploy,
 * as the function failing to boot, so every import of the rule is resolved here first.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../../..')
const FUNCTIONS = join(ROOT, 'supabase/functions')
const RULE_FILE = join(FUNCTIONS, '_shared/realAccount.ts')

/** Files that read `is_sample` on purpose (the script's `LEFT_ALONE`; the last test keeps the two lists equal). */
const LEFT_ALONE = [
  'supabase/functions/create-user/index.ts',
  'supabase/functions/_shared/rosterRow.ts',
  'supabase/functions/_shared/devMcpComposites.ts',
]
const LEFT_ALONE_DIRS = ['supabase/functions/dev-mcp/']

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return walk(p)
    return e.isFile() && p.endsWith('.ts') ? [p] : []
  })
}

const files = walk(FUNCTIONS)
  .map((abs) => ({ path: relative(ROOT, abs).split(sep).join('/'), abs, src: readFileSync(abs, 'utf8') }))
  .sort((a, b) => a.path.localeCompare(b.path))
const swept = files.filter((f) => !LEFT_ALONE.includes(f.path) && !LEFT_ALONE_DIRS.some((d) => f.path.startsWith(d)))

describe('the real-account rule in the edge functions', () => {
  it('has no hand-written sample filter left outside the files that read it on purpose', () => {
    const left = swept.filter((f) => /\.eq\(\s*'is_sample'\s*,\s*false\s*\)/.test(f.src)).map((f) => f.path)
    expect(left, 'run node scripts/sweep-real-account.mjs').toEqual([])
  })

  it('is used by the functions that look a sender or a recipient up', () => {
    const using = swept.filter((f) => f.src.includes('.match(REAL_ACCOUNT)')).map((f) => f.path)
    expect(using.length).toBeGreaterThanOrEqual(17)
    for (const p of ['supabase/functions/send-bid-pricing-package/index.ts', 'supabase/functions/send-rfq-email/index.ts', 'supabase/functions/weekly-money-email-dispatch/index.ts']) {
      expect(using, p).toContain(p)
    }
  })

  it('is imported from a path that exists, by every file that uses it', () => {
    for (const f of swept.filter((x) => x.abs !== RULE_FILE && x.src.includes('REAL_ACCOUNT'))) {
      const m = /import\s*\{[^}]*\bREAL_ACCOUNT\b[^}]*\}\s*from\s*'([^']+)'/.exec(f.src)
      expect(m, `${f.path} imports REAL_ACCOUNT`).not.toBeNull()
      const target = resolve(dirname(f.abs), m![1]!)
      expect(target, `${f.path} imports the shared rule`).toBe(RULE_FILE)
      expect(existsSync(target)).toBe(true)
    }
  })

  it('says a real account is neither a sample nor a twin', () => {
    expect(readFileSync(RULE_FILE, 'utf8')).toMatch(/export const REAL_ACCOUNT = \{ is_sample: false, is_digital_twin: false \} as const/)
  })

  it('leaves alone the same files the sweep script leaves alone', () => {
    const script = readFileSync(join(ROOT, 'scripts/sweep-real-account.mjs'), 'utf8')
    const block = /export const LEFT_ALONE = \[([\s\S]*?)\]/.exec(script)
    expect(block).not.toBeNull()
    expect([...block![1]!.matchAll(/'([^']+)'/g)].map((m) => m[1])).toEqual(LEFT_ALONE)
    expect(script).toContain(`const LEFT_ALONE_DIRS = ['${LEFT_ALONE_DIRS[0]}']`)
  })
})
