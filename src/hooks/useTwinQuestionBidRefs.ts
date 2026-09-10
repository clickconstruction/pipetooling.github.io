import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

import { supabase } from '../lib/supabase'
import { bidNumbersAcross, indexSourceBids, unresolvedSourceIds, type BidPairingRow, type SourceBidRef } from '../lib/bids/twinQuestionBidRefs'

export type TwinQuestionBidRefs = {
  /** bid_number → id, for every number the questions mention. */
  bidIdByNumber: Readonly<Record<string, string>>
  /** id → bid_number, for a row's own `about_bid_id`. */
  bidNumberById: Readonly<Record<string, string>>
  /** Twin bid id → the human bid it pairs with (`twin_source_bid_id`), for the "ours b214" link. */
  sourceByBidId: Readonly<Record<string, SourceBidRef>>
}

const EMPTY: TwinQuestionBidRefs = { bidIdByNumber: {}, bidNumberById: {}, sourceByBidId: {} }

// bids.twin_source_bid_id reaches src/types/database.ts only with the post-push
// gen-types run (BidsAuditsTab pattern); until then this untyped view keeps strict mode honest.
const refDb = supabase as unknown as SupabaseClient

/**
 * One lookup of every bid a set of robot questions refers to — the numbers in
 * the text (v2.3174), each row's `about_bid_id`, and the human bid a ZZ shell
 * pairs with (v2.3187). Standing rulings (Bids → Audits) and the twin-questions
 * card on Settings → Digital twins read the same rows, so they resolve the same
 * links through this one hook instead of two copies that drift. Fail-soft: an
 * unresolved reference renders as plain text.
 */
export function useTwinQuestionBidRefs(questions: ReadonlyArray<{ question: string; about_bid_id: string | null }>): TwinQuestionBidRefs {
  const [refs, setRefs] = useState<TwinQuestionBidRefs>(EMPTY)
  useEffect(() => {
    const numbers = bidNumbersAcross(questions.map((q) => q.question))
    const aboutIds = [...new Set(questions.map((q) => q.about_bid_id).filter((id): id is string => !!id))]
    if (numbers.length === 0 && aboutIds.length === 0) return
    let cancelled = false
    ;(async () => {
      try {
        const [byNumber, byId] = await Promise.all([
          numbers.length > 0 ? refDb.from('bids').select('id, bid_number, twin_source_bid_id').in('bid_number', numbers) : Promise.resolve({ data: [] }),
          aboutIds.length > 0 ? refDb.from('bids').select('id, bid_number, twin_source_bid_id').in('id', aboutIds) : Promise.resolve({ data: [] }),
        ])
        if (cancelled) return
        const rows: BidPairingRow[] = [...((byNumber.data ?? []) as BidPairingRow[]), ...((byId.data ?? []) as BidPairingRow[])]
        const bidIdByNumber: Record<string, string> = {}
        const bidNumberById: Record<string, string> = {}
        for (const b of rows) {
          if (!b.bid_number) continue
          bidIdByNumber[b.bid_number] = b.id
          bidNumberById[b.id] = b.bid_number
        }
        // The robot names its own ZZ Twin copy; its source (the human bid) is one
        // more lookup, only for pairings whose number isn't already in hand.
        const missing = unresolvedSourceIds(rows)
        const sources = missing.length > 0 ? await refDb.from('bids').select('id, bid_number').in('id', missing) : { data: [] }
        if (cancelled) return
        setRefs({ bidIdByNumber, bidNumberById, sourceByBidId: indexSourceBids([...rows, ...((sources.data ?? []) as BidPairingRow[])]) })
      } catch {
        // Unresolved references render as plain text.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [questions])
  return refs
}
