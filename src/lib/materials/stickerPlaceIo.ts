/**
 * The reads and the one write behind the first scan (punch list #329, PR 3, v2.7298). `placeSticker` calls
 * `place_sticker` as the caller: a blank sticker onto a known box, or onto a new box made in the same transaction;
 * `SECURITY INVOKER`, so the gate and every policy judge the caller, and a refusal comes back in the database's own
 * words. It is never queued in the outbox: two phones may hold the same blank sticker, and only the database can say
 * who was first, so the press waits for signal. The reads: the stickers on a set of boxes (the number beside a
 * box's name), and one sticker by its number for Scan a label. The words are `stickerPlace.ts`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { fetchAllRowsChunkedIn } from '../supabasePaging'
import { PLACE_UNREAD_WORDS, placeAnswerOf, placeStickerArgs, type PlaceAnswer, type PlaceRequest } from './stickerPlace'
import type { StickerCountRow } from './stickers'

const db = supabase as unknown as SupabaseClient

/** The answer read back, or a throw with the database's own words. */
export async function placeSticker(request: PlaceRequest): Promise<PlaceAnswer> {
  const { data, error } = await db.rpc('place_sticker' as never, placeStickerArgs(request) as never)
  if (error) throw error
  const answer = placeAnswerOf(data)
  if (!answer) throw new Error(PLACE_UNREAD_WORDS)
  return answer
}

export type StickerOnBoxRow = StickerCountRow & { id: string; code: string | null; /** The name printed on the sticker (section 10); null on a numbered one. */ boxName: string | null }

type RawRow = { id: string; number: number; code: string | null; box_name: string | null; container_id: string | null; lost_at: string | null }

/** The stickers on the boxes handed in, under the caller's own RLS; chunked, since a site may hold hundreds of boxes. */
export async function fetchStickersOnBoxes(containerIds: ReadonlyArray<string>): Promise<StickerOnBoxRow[]> {
  const ids = [...new Set(containerIds)]
  if (ids.length === 0) return []
  const rows = await fetchAllRowsChunkedIn(ids, (chunk, from, to) => db.from('box_stickers').select('id, number, code, box_name, container_id, lost_at').in('container_id', chunk).order('number').range(from, to), 'stickers on boxes', { parallel: 4 })
  return (rows as unknown as RawRow[]).map((r) => ({ id: r.id, number: r.number, code: r.code, boxName: r.box_name ? r.box_name.trim().toUpperCase() : null, containerId: r.container_id, lostAt: r.lost_at }))
}

/** One sticker by its printed number, as far as the caller may read: on a box of their job, or blank on a run printed for one. Null when none answers. */
export async function fetchStickerByNumber(number: number): Promise<{ id: string; code: string } | null> {
  const { data, error } = await db.from('box_stickers').select('id, code').eq('number', number).limit(1)
  if (error) throw error
  const row = ((data ?? []) as Array<{ id: string; code: string | null }>)[0]
  return row?.code ? { id: row.id, code: row.code } : null
}
