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
 *                                                              our table and never Drive, counts only. The sweep takes
 *                                                              them too since v2.6417, forty a run; this is for when you
 *                                                              cannot wait
 *   npx vite-node scripts/file-index-check.ts --rehome [--pause 500]
 *                                                              walk every row on no job or bid up to its home again, forty
 *                                                              rows a call, nothing read out of the files, counts only
 *
 * One file a call because an edge function has about two seconds of CPU per request: a heavy PDF can stop that call and
 * no other, and its row keeps the stamp it was given before the read, so it is no longer a file with no row.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { signInAsOwner } from './lib/paySession'
import { addFillAnswer, addFillRefusal, addRehomeAnswer, addRehomeRefusal, askAgainAfter, checkWantsAPass, checkWords, emptyFill, emptyRehome, fillContinues, fillWords, rehomeWords, type IndexCheck } from '../supabase/functions/_shared/fileIndexCheckKernel'

/** How many files with no row a fill asks for each round, and the pause between its calls. */
const FILL_ROUND = 200
const FILL_PAUSE_MS = 1500
/** How many more times the check is asked after a lost call, and the growing wait between. */
const CHECK_TRIES = 3
const CHECK_RETRY_MS = 5000
/** How many rows one call of `index_home` walks: the door's own cap. */
const REHOME_BATCH = 40

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type Asked = { ok: true; data: unknown } | { ok: false; status: number; words: string }

/** The sign-in, which does not refresh itself and lasts about an hour, so a fill outlives it: a 401 signs in again, once a call. */
type Session = { client: SupabaseClient }

const signIn = async (): Promise<SupabaseClient> => (await signInAsOwner()) as unknown as SupabaseClient

async function ask(session: Session, body: Record<string, unknown>, renewed = false): Promise<Asked> {
  const r = await session.client.functions.invoke('drive-link', { body })
  if (!r.error) return { ok: true, data: r.data }
  const ctx = (r.error as { context?: Response }).context
  const status = ctx && typeof ctx.status === 'number' ? ctx.status : 0
  if (status === 401 && !renewed) {
    session.client = await signIn()
    return ask(session, body, true)
  }
  const said = ctx && typeof ctx.json === 'function' ? ((await ctx.json().catch(() => null)) as { error?: string } | null) : null
  return { ok: false, status, words: said?.error ?? (status ? `HTTP ${status}` : r.error.message) }
}

/** The check, asked again when the signal or the platform failed: one lost call must not end a fill of hundreds of files. */
async function check(session: Session, sample: number): Promise<IndexCheck> {
  let a = await ask(session, { action: 'index_check', sample })
  for (let i = 1; i <= CHECK_TRIES && !a.ok && askAgainAfter(a.status); i++) {
    await sleep(CHECK_RETRY_MS * i)
    a = await ask(session, { action: 'index_check', sample })
  }
  if (!a.ok) throw new Error(a.words)
  return a.data as IndexCheck
}

async function fill(session: Session, pauseMs: number): Promise<void> {
  let tally = emptyFill()
  let rounds = 0
  let now = await check(session, FILL_ROUND)
  console.log(checkWords(now))
  while (now.missing.length > 0) {
    rounds += 1
    for (const m of now.missing) {
      const a = await ask(session, { action: 'index', driveFileId: m.id })
      // Who may ask does not change between files: a refusal that survives a fresh sign-in stops the fill rather than repeating itself.
      if (!a.ok && (a.status === 401 || a.status === 403)) throw new Error(a.words)
      tally = a.ok ? addFillAnswer(tally, a.data) : addFillRefusal(tally, a.words)
      await sleep(pauseMs)
    }
    const before = now.filesWithNoRow
    now = await check(session, FILL_ROUND)
    console.log(`Round ${rounds}: ${fillWords(tally)} ${now.filesWithNoRow.toLocaleString('en-US')} files still have no row.`)
    if (!fillContinues(before, now.filesWithNoRow, rounds)) break
  }
  console.log(checkWords(now))
}

/** Every row on no job or bid, read before any is walked, since walking one takes it out of the set. A thousand at a time: PostgREST's cap. */
async function rowsOnNothing(session: Session): Promise<string[]> {
  const ids: string[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await session.client.from('file_index').select('drive_file_id').is('jobs_ledger_id', null).is('bid_id', null).order('drive_file_id').range(from, from + 999)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as { drive_file_id: string }[]
    ids.push(...rows.map((r) => r.drive_file_id))
    if (rows.length < 1000) return ids
  }
}

async function rehome(session: Session, pauseMs: number): Promise<void> {
  const ids = await rowsOnNothing(session)
  console.log(`${ids.length.toLocaleString('en-US')} rows on no job or bid.`)
  let tally = emptyRehome()
  for (let i = 0; i < ids.length; i += REHOME_BATCH) {
    const batch = ids.slice(i, i + REHOME_BATCH)
    const a = await ask(session, { action: 'index_home', driveFileIds: batch })
    if (!a.ok && a.status === 403) throw new Error(a.words)
    tally = a.ok ? addRehomeAnswer(tally, batch.length, a.data) : addRehomeRefusal(tally, batch.length, a.words)
    await sleep(pauseMs)
  }
  console.log(rehomeWords(tally))
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const session: Session = { client: await signIn() }
  const started = Date.now()
  const at = argv.indexOf('--pause')
  const asked = at >= 0 ? Number(argv[at + 1]) : FILL_PAUSE_MS
  const pause = Number.isFinite(asked) && asked >= 0 ? Math.min(asked, 60_000) : FILL_PAUSE_MS
  if (argv.includes('--rehome')) {
    await rehome(session, pause)
  } else if (argv.includes('--fill')) {
    await fill(session, pause)
  } else {
    const c = await check(session, 25)
    console.log(checkWords(c))
    console.log(checkWantsAPass(c) ? 'The index wants a pass: the sweep takes a file with no row and a file changed since its row, forty a run; --fill takes the files with no row now, for when you cannot wait.' : 'Every file the Shared Drive lists has a current row.')
    if (argv.includes('--list')) for (const m of c.missing) console.log(`  ${m.modified ?? '-'}  ${m.mime}  ${m.name}`)
  }
  console.log(`(${Math.round((Date.now() - started) / 100) / 10} s)`)
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e))
  process.exit(1)
})
