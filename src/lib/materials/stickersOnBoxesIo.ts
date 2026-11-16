/**
 * The one write behind These are on boxes (punch list #329, design section 10, PR 10). `placeStickerRange` calls
 * `place_sticker_range` as the caller: the function puts the site's blank stickers of the names handed on their
 * boxes through `place_sticker`, once a sticker, so the gate, the box rule and every policy judge the caller as they
 * do for one scan, and a refusal of the whole call comes back in the database's own words. It is never queued: like
 * a scan's placing, it needs signal, since only the database can say which stickers are still blank. The read the
 * form counts from is `fetchSiteStickerNames` (`stickerRunsIo.ts`). The words are `stickersOnBoxes.ts`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { ON_BOXES_UNREAD_ANSWER, onBoxesAnswerOf, placeStickerRangeArgs, type OnBoxesAnswer, type OnBoxesRequest } from './stickersOnBoxes'

const db = supabase as unknown as SupabaseClient

/** The answer read back, or a throw with the database's own words. */
export async function placeStickerRange(request: OnBoxesRequest): Promise<OnBoxesAnswer> {
  const { data, error } = await db.rpc('place_sticker_range' as never, placeStickerRangeArgs(request) as never)
  if (error) throw error
  const answer = onBoxesAnswerOf(data)
  if (!answer) throw new Error(ON_BOXES_UNREAD_ANSWER)
  return answer
}
