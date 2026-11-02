#!/usr/bin/env vite-node
/**
 * The index check from a terminal (punch list #240, v2.6364): what the Shared Drive holds against what `file_index`
 * holds, through `drive-link`'s `index_check` as the dev-login identity (`scripts/lib/paySession.ts`: the secret in
 * `.env.local`, never the service key from a laptop).
 *
 *   npx vite-node scripts/file-index-check.ts                  the counts, nothing written
 *   npx vite-node scripts/file-index-check.ts --list           and the first 25 files with no row, by name, so keep that
 *                                                              output on this computer
 *   npx vite-node scripts/file-index-check.ts --fill [--pause 1500]
 *                                                              index the files with no row through `index`, one file a
 *                                                              call, until none are left or a round gains nothing; writes
 *                                                              our table and never Drive, counts only
 *
 * One file a call because an edge function has about two seconds of CPU per request: a heavy PDF can stop that call and
 * no other, and its row keeps the stamp it was given before the read, so it is no longer a file with no row.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { signInAsOwner } from './lib/paySession'
import { addFillAnswer, addFillRefusal, checkWantsAPass, checkWords, emptyFill, fillContinues, fillWords, type IndexCheck } from '../supabase/functions/_shared/fileIndexCheckKernel'

/** How many files with no row a fill asks for each round, and the pause between its calls. */
const FILL_ROUND = 200
const FILL_PAUSE_MS = 1500

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type Asked = { ok: true; data: unknown } | { ok: false; status: number; words: string }

async function ask(supabase: SupabaseClient, body: Record<string, unknown>): Promise<Asked> {
  const r = await supabase.functions.invoke('drive-link', { body })
  if (!r.error) return { ok: true, data: r.data }
  const ctx = (r.error as { context?: Response }).context
  const status = ctx && typeof ctx.status === 'number' ? ctx.status : 0
  const said = ctx && typeof ctx.json === 'function' ? ((await ctx.json().catch(() => null)) as { error?: string } | null) : null
  return { ok: false, status, words: said?.error ?? (status ? `HTTP ${status}` : r.error.message) }
}

async function check(supabase: SupabaseClient, sample: number): Promise<IndexCheck> {
  const a = await ask(supabase, { action: 'index_check', sample })
  if (!a.ok) throw new Error(a.words)
  return a.data as IndexCheck
}

async function fill(supabase: SupabaseClient, pauseMs: number): Promise<void> {
  let tally = emptyFill()
  let rounds = 0
  let now = await check(supabase, FILL_ROUND)
  console.log(checkWords(now))
  while (now.missing.length > 0) {
    rounds += 1
    for (const m of now.missing) {
      const a = await ask(supabase, { action: 'index', driveFileId: m.id })
      // Who may ask does not change between files: a refusal of the asker stops the fill rather than repeating itself.
      if (!a.ok && (a.status === 401 || a.status === 403)) throw new Error(a.words)
      tally = a.ok ? addFillAnswer(tally, a.data) : addFillRefusal(tally, a.words)
      await sleep(pauseMs)
    }
    const before = now.filesWithNoRow
    now = await check(supabase, FILL_ROUND)
    console.log(`Round ${rounds}: ${fillWords(tally)} ${now.filesWithNoRow.toLocaleString('en-US')} files still have no row.`)
    if (!fillContinues(before, now.filesWithNoRow, rounds)) break
  }
  console.log(checkWords(now))
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const supabase = (await signInAsOwner()) as unknown as SupabaseClient
  const started = Date.now()
  if (argv.includes('--fill')) {
    const at = argv.indexOf('--pause')
    const pause = at >= 0 ? Number(argv[at + 1]) : FILL_PAUSE_MS
    await fill(supabase, Number.isFinite(pause) && pause >= 0 ? Math.min(pause, 60_000) : FILL_PAUSE_MS)
  } else {
    const c = await check(supabase, 25)
    console.log(checkWords(c))
    console.log(checkWantsAPass(c) ? 'The index wants a pass: --fill takes the files with no row, and the sweep takes a file changed since its row.' : 'Every file the Shared Drive lists has a current row.')
    if (argv.includes('--list')) for (const m of c.missing) console.log(`  ${m.modified ?? '-'}  ${m.mime}  ${m.name}`)
  }
  console.log(`(${Math.round((Date.now() - started) / 100) / 10} s)`)
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e))
  process.exit(1)
})
