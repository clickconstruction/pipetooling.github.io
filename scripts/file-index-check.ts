#!/usr/bin/env vite-node
/**
 * The index check from a terminal (punch list #240, v2.6364): what the Shared Drive holds against what `file_index`
 * holds, through `drive-link`'s `index_check` as the dev-login identity (`scripts/lib/paySession.ts`: the secret in
 * `.env.local`, never the service key from a laptop). Prints the counts in one line and, with --list, the first files
 * with no row (their names, so keep that output on this computer). A read: nothing is written.
 *
 *   npx vite-node scripts/file-index-check.ts            the counts
 *   npx vite-node scripts/file-index-check.ts --list     the counts and up to 25 files with no row
 */
import { signInAsOwner } from './lib/paySession'
import { checkWantsAPass, checkWords, type IndexCheck } from '../supabase/functions/_shared/fileIndexCheckKernel'

async function main(): Promise<void> {
  const supabase = await signInAsOwner()
  const started = Date.now()
  const r = await supabase.functions.invoke('drive-link', { body: { action: 'index_check' } })
  if (r.error) {
    const ctx = (r.error as { context?: Response }).context
    const body = ctx && typeof ctx.json === 'function' ? ((await ctx.json().catch(() => null)) as { error?: string } | null) : null
    throw new Error(body?.error ?? r.error.message)
  }
  const c = r.data as IndexCheck
  console.log(checkWords(c))
  console.log(checkWantsAPass(c) ? 'The index wants a pass: run scripts/file-index-backfill.mjs for the homes, or wait for the sweep.' : 'The index is whole.')
  if (process.argv.includes('--list')) for (const m of c.missing ?? []) console.log(`  ${m.modified ?? '-'}  ${m.mime}  ${m.name}`)
  console.log(`(${Math.round((Date.now() - started) / 100) / 10} s)`)
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e))
  process.exit(1)
})
