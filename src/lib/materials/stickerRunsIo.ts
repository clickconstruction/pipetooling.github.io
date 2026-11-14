/**
 * The reads and the one write behind Print blank stickers (punch list #329, PR 2, v2.7272). `mintStickerRun` calls
 * `mint_sticker_run` as the caller: the database numbers the run under a lock and makes the stickers, and a refusal
 * comes back in its own words (`SECURITY INVOKER`, so the gate judges the caller). The two reads list a job's runs
 * with their stickers, and the newest number any run the caller can see reached. Nothing here writes a sticker:
 * no client does (`docs/MATERIALS_ON_SITE_ARCHITECTURE.md`). The words are `stickerRun.ts`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { mintedRunOf, mintedStickerOf, stickerRunOf, STICKER_MINT_FAILED, type MintedRun, type StickerRun, type StickerRunRequest, type StickerRowOfRun } from './stickerRun'

const db = supabase as unknown as SupabaseClient

/** One run of a job with its stickers, as the fold lists it. */
export type StickerRunWithStickers = { run: StickerRun; stickers: StickerRowOfRun[] }

/** The run minted, or a throw with the database's own words. An answer that is not a whole run throws too: nothing is printed from a run the window cannot read. */
export async function mintStickerRun(request: StickerRunRequest): Promise<MintedRun> {
  const { data, error } = await db.rpc('mint_sticker_run' as never, { p_job_id: request.jobId, p_count: request.count, p_copies: request.copies } as never)
  if (error) throw error
  const minted = mintedRunOf(data)
  if (!minted) throw new Error(STICKER_MINT_FAILED)
  return minted
}

type StickerRow = { id: string; run_id: string; number: number; code: string | null; container_id: string | null; lost_at: string | null }

/** A job's runs, newest first, each with its stickers in number order. Under the caller's own RLS: a sticker on a box of a job they cannot touch is left out. */
export async function fetchStickerRuns(jobId: string): Promise<StickerRunWithStickers[]> {
  const runsRead = await db.from('sticker_runs').select('id, job_id, sticker_count, first_number, last_number, copies, printed_by, printed_by_name, printed_at').eq('job_id', jobId).order('first_number', { ascending: false })
  if (runsRead.error) throw runsRead.error
  const runs = ((runsRead.data ?? []) as unknown[]).map(stickerRunOf).filter((r): r is StickerRun => r != null)
  if (runs.length === 0) return []
  const stickersRead = await db.from('box_stickers').select('id, run_id, number, code, container_id, lost_at').in('run_id', runs.map((r) => r.id)).order('number', { ascending: true })
  if (stickersRead.error) throw stickersRead.error
  const byRun = new Map<string, StickerRowOfRun[]>()
  for (const raw of (stickersRead.data ?? []) as StickerRow[]) {
    const minted = mintedStickerOf(raw)
    if (!minted) continue
    const list = byRun.get(raw.run_id) ?? []
    list.push({ ...minted, containerId: raw.container_id, lostAt: raw.lost_at })
    byRun.set(raw.run_id, list)
  }
  return runs.map((run) => ({ run, stickers: byRun.get(run.id) ?? [] }))
}

/** The last number of the newest run the caller can see, or null when none: the window's *The last run ended at 0100.* A run on a job out of their reach is not counted, so the line reads as far as they can see. */
export async function fetchLastStickerNumber(): Promise<number | null> {
  const { data, error } = await db.from('sticker_runs').select('last_number').not('last_number', 'is', null).order('last_number', { ascending: false }).limit(1)
  if (error) throw error
  const row = ((data ?? []) as Array<{ last_number: number | null }>)[0]
  return typeof row?.last_number === 'number' ? row.last_number : null
}
