#!/usr/bin/env node
/**
 * The fourth lock of the seal behind the Away note (punch list #256, PR 7, v2.6572): an edge function that reads the
 * caller (`auth.getUser`) and switches to the service role (`SUPABASE_SERVICE_ROLE_KEY`) queries as nobody, so the
 * database's gate and fences see no archived caller to refuse. Such a function must call `refuseArchivedCaller` or
 * `isArchivedCaller` from `_shared/refuseArchivedCaller.ts`. This lists every function that does not, and exits 1 when
 * any is left; the sweep that adds the call to each (PR 7b, a mechanical sweep that merges alone) wires it into ci.yml.
 *
 *   node scripts/check-edge-archived-guard.mjs [functions-dir]    (default supabase/functions)
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const dir = resolve(process.argv[2] ?? 'supabase/functions')
const slugs = readdirSync(dir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.'))
  .filter((e) => existsSync(join(dir, e.name, 'index.ts')))
  .map((e) => e.name)
  .sort()

// A comment line never counts: the rule reads code.
const code = (text) => text.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')

export function guardFindings(files) {
  const out = []
  for (const { slug, text } of files) {
    const body = code(text)
    const readsCaller = /\.auth\.getUser\(/.test(body)
    const serviceRole = /SUPABASE_SERVICE_ROLE_KEY/.test(body)
    const guarded = /\b(refuseArchivedCaller|isArchivedCaller)\(/.test(body)
    if (readsCaller && serviceRole && !guarded) out.push(slug)
  }
  return out
}

const files = slugs.map((slug) => ({ slug, text: readFileSync(join(dir, slug, 'index.ts'), 'utf8') }))
const unguarded = guardFindings(files)
if (unguarded.length) {
  console.error(
    `\nEDGE FUNCTIONS WITHOUT THE ARCHIVED GUARD: ${unguarded.length} of ${slugs.length} read the caller and switch to the service role ` +
      'without calling refuseArchivedCaller or isArchivedCaller (supabase/functions/_shared/refuseArchivedCaller.ts):\n' +
      unguarded.map((s) => `  ${s}`).join('\n') +
      '\n\nCall the guard right after the caller is read, before the service role does anything for them.\n',
  )
  process.exit(1)
}
console.log(`archived-guard check OK: every function that reads the caller and switches to the service role calls the guard (${slugs.length} functions).`)
