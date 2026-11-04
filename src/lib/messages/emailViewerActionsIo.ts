/**
 * Messages, the email viewer's action row (v2.6509): what its presses read and write. *Start a bid* is the New lane's
 * *Bid it?* door, so it borrows that card's io whole (`newLaneCardIo.ts`: the customer made and named, then
 * `start_bid_from_message`). *Put it on a bid…* ties the line through the Tied to row's own writer (`tieMessage`, the
 * one the thread window's picker calls) and then writes one line on the bid's log through `bid_log_message_in`, the
 * owner's helper (the log's insert policy admits fewer roles than may tie a line). Its picker searches the open bids
 * alone: on the board, not adopted into another, not lost, by name or number.
 */
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { supabaseNewLaneCardIo, type NewLaneCardIo } from '../followUp/newLaneCardIo'
import { bidTile, type BidTileRow, type JobTile } from './jobTiles'
import { jobKey } from './jobKeys'
import { tieMessage } from './messagesIo'

export interface EmailViewerIo extends Pick<NewLaneCardIo, 'loadKnown' | 'name' | 'makeCustomerRecord' | 'startBid'> {
  /** The open bids a name or a number may be: on the board, not adopted into another bid, not lost. */
  searchOpenBids(words: string): Promise<JobTile[]>
  /** Ties the line to the bid (the Tied to row's own writer), then writes the words on the bid's log. */
  putOnBid(messageId: string, bidId: string, words: string): Promise<void>
}

const BID_COLS = 'id, bid_number, project_name, bid_due_date, bid_date_sent, outcome'

export function supabaseEmailViewerIo(): EmailViewerIo {
  const card = supabaseNewLaneCardIo()
  return {
    loadKnown: (row) => card.loadKnown(row),
    name: (contactId, guess) => card.name(contactId, guess),
    makeCustomerRecord: (contactId, make, by, todayYmd) => card.makeCustomerRecord(contactId, make, by, todayYmd),
    startBid: (messageId, bid) => card.startBid(messageId, bid),
    async searchOpenBids(words) {
      const q = words.trim()
      if (q.length < 2) return []
      const like = `%${q.replace(/[%_,()]/g, ' ')}%`
      const got = await supabase
        .from('bids')
        .select(BID_COLS)
        .or(`project_name.ilike.${like},bid_number.ilike.${like}`)
        .is('working_board_archived_at', null)
        .is('adopted_into_bid_id', null)
        .or('outcome.is.null,outcome.neq.lost')
        .order('created_at', { ascending: false })
        .limit(12)
      checkSupabaseError(got, 'find the bids')
      const today = calendarYmdInAppTzFromIso(new Date().toISOString())
      return ((got.data ?? []) as BidTileRow[]).map((row) => bidTile(row, today))
    },
    async putOnBid(messageId, bidId, words) {
      await tieMessage(messageId, jobKey({ kind: 'bid', id: bidId }))
      // Not in the generated types until the push and the chore(types) PR that follows it.
      const logged = await supabase.rpc('bid_log_message_in' as never, { p_bid_id: bidId, p_message_id: messageId, p_words: words } as never)
      checkSupabaseError(logged, 'write it on the bid’s history')
    },
  }
}
