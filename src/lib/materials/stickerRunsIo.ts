/**
 * The reads and the one write behind Print blank stickers (punch list #329, PR 2, v2.7272). `mintStickerRun` calls
 * `mint_sticker_run` as the caller: the database numbers the run under a lock and makes the stickers, and a refusal
 * comes back in its own words (`SECURITY INVOKER`, so the gate judges the caller). The reads list a job's runs
 * with their stickers, and the site's boxes and blank named stickers for the Names field. Nothing here writes a sticker:
 * no client does (`docs/MATERIALS_ON_SITE_ARCHITECTURE.md`). The words are `stickerRun.ts`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { fetchAllRowsChunkedIn } from '../supabasePaging'
import type { SiteBox } from './boxName'
import { mintedRunOf, mintedStickerOf, mintStickerRunArgs, stickerRunOf, STICKER_MINT_FAILED, type MintedRun, type StickerRun, type StickerRunRequest, type StickerRowOfRun } from './stickerRun'

const db = supabase as unknown as SupabaseClient

/** One run of a job with its stickers, as the fold lists it. */
export type StickerRunWithStickers = { run: StickerRun; stickers: StickerRowOfRun[] }

/** The run minted, or a throw with the database's own words. An answer that is not a whole run throws too: nothing is printed from a run the window cannot read. */
export async function mintStickerRun(request: StickerRunRequest): Promise<MintedRun> {
  const { data, error } = await db.rpc('mint_sticker_run' as never, mintStickerRunArgs(request) as never)
  if (error) throw error
  const minted = mintedRunOf(data)
  if (!minted) throw new Error(STICKER_MINT_FAILED)
  return minted
}

type StickerRow = { id: string; run_id: string; number: number; code: string | null; box_name: string | null; container_id: string | null; lost_at: string | null }

/** A job's runs, newest first, each with its stickers in number order. Under the caller's own RLS: a sticker on a box of a job they cannot touch is left out. */
export async function fetchStickerRuns(jobId: string): Promise<StickerRunWithStickers[]> {
  const runsRead = await db.from('sticker_runs').select('id, job_id, sticker_count, first_number, last_number, copies, names, printed_by, printed_by_name, printed_at').eq('job_id', jobId).order('first_number', { ascending: false })
  if (runsRead.error) throw runsRead.error
  const runs = ((runsRead.data ?? []) as unknown[]).map(stickerRunOf).filter((r): r is StickerRun => r != null)
  if (runs.length === 0) return []
  const stickersRead = await db.from('box_stickers').select('id, run_id, number, code, box_name, container_id, lost_at').in('run_id', runs.map((r) => r.id)).order('number', { ascending: true })
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

/** What the Names field reads of a job's site before a run (section 10, v2.7391). */
export type SiteStickerNames = {
  /** Every box of the site the caller may read, live and retired: the next free name and the names that are boxes already. */
  boxes: SiteBox[]
  /** The names on the site's stickers that are on no box and not lost: a second run over them is held. */
  blankNames: string[]
}

/**
 * The site's boxes and its blank named stickers, under the caller's own RLS: the job's development, the development's
 * jobs (the one job when it is on none), their containers, their runs and those runs' named stickers still blank. The
 * same site `useSiteBoxNames` reads for the Add sheet. A throw is the caller's to say: the field then opens empty.
 */
export async function fetchSiteStickerNames(jobId: string): Promise<SiteStickerNames> {
  const jobRead = await db.from('jobs_ledger').select('development_id').eq('id', jobId).maybeSingle()
  if (jobRead.error) throw jobRead.error
  const siteId = (jobRead.data as { development_id: string | null } | null)?.development_id ?? null
  let jobIds = [jobId]
  if (siteId) {
    const siblings = await db.from('jobs_ledger').select('id').eq('development_id', siteId)
    if (siblings.error) throw siblings.error
    jobIds = [...new Set([jobId, ...((siblings.data ?? []) as Array<{ id: string }>).map((j) => j.id)])]
  }
  const boxesRead = await db.from('job_containers').select('id, job_id, label, kind, retired_at, created_at').in('job_id', jobIds).range(0, 1999)
  if (boxesRead.error) throw boxesRead.error
  const boxes = ((boxesRead.data ?? []) as Array<{ id: string; label: string; kind: string; retired_at: string | null; created_at: string }>).map((b) => ({ id: b.id, label: b.label, kind: b.kind, retiredAt: b.retired_at, createdAt: b.created_at }))
  const runsRead = await db.from('sticker_runs').select('id').in('job_id', jobIds).not('names', 'is', null)
  if (runsRead.error) throw runsRead.error
  const runIds = ((runsRead.data ?? []) as Array<{ id: string }>).map((r) => r.id)
  if (runIds.length === 0) return { boxes, blankNames: [] }
  // Paged, since a site's runs may hold more blank stickers than one read answers.
  const blankRows = await fetchAllRowsChunkedIn(runIds, (chunk, from, to) => db.from('box_stickers').select('box_name').in('run_id', chunk).not('box_name', 'is', null).is('container_id', null).is('lost_at', null).order('number').range(from, to), 'the site’s blank named stickers')
  const blankNames = [...new Set((blankRows as unknown as Array<{ box_name: string | null }>).map((r) => (r.box_name ?? '').trim().toUpperCase()).filter(Boolean))]
  return { boxes, blankNames }
}
