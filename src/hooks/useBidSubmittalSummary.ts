import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

import { supabase } from '../lib/supabase'
import { asRevisionStatus } from '../lib/submittals/submittalRevision'
import type { BidSubmittalSummary } from '../lib/submittals/bidSubmittalSummary'

const db = supabase as unknown as SupabaseClient

/** The bid's newest revision, its room and the people, summarized for the chip (Submittals stage 4b). */
export function useBidSubmittalSummary(bidId: string): { loaded: boolean; summary: BidSubmittalSummary } {
  const [state, setState] = useState<{ loaded: boolean; summary: BidSubmittalSummary }>({ loaded: false, summary: null })
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { data: rev } = await db.from('bid_submittals').select('id, rev_number, status').eq('bid_id', bidId).order('rev_number', { ascending: false }).limit(1).maybeSingle()
        const r = rev as { id: string; rev_number: number; status: string } | null
        if (!r) {
          if (!cancelled) setState({ loaded: true, summary: null })
          return
        }
        const [{ data: room }, { data: items }] = await Promise.all([
          db.from('bid_submittal_rooms').select('id, status').eq('bid_id', bidId).maybeSingle(),
          db.from('bid_submittal_items').select('review_decision').eq('submittal_id', r.id),
        ])
        const rm = room as { id: string; status: string } | null
        let waitingOn: string[] = []
        if (rm) {
          const { data: people } = await db.from('bid_submittal_people').select('name, open_count, may_decide, closed_at').eq('room_id', rm.id)
          waitingOn = ((people ?? []) as Array<{ name: string; open_count: number; may_decide: boolean; closed_at: string | null }>).filter((p) => p.may_decide && !p.closed_at && p.open_count === 0).map((p) => p.name)
        }
        const sentBack = ((items ?? []) as Array<{ review_decision: string | null }>).filter((it) => it.review_decision === 'revise' || it.review_decision === 'rejected').length
        if (!cancelled) setState({ loaded: true, summary: { revNumber: r.rev_number, status: asRevisionStatus(r.status), roomStatus: rm ? (rm.status === 'closed' ? 'closed' : 'open') : null, waitingOn, sentBack } })
      } catch {
        if (!cancelled) setState({ loaded: true, summary: null })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bidId])
  return state
}
