import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

import { supabase } from '../lib/supabase'
import { summarizeSubmittalNudge, type NudgeBid, type NudgeItem, type NudgePerson, type NudgeRevision, type NudgeRoom, type NudgeView, type NudgeWindow, type SubmittalNudge } from '../lib/submittals/submittalNeedsYou'

// The stage 4 tables are hand-typed until the regen chore; the untyped client keeps a checkout ahead of the push honest.
const db = supabase as unknown as SupabaseClient

/**
 * The Dashboard's four Submittals cards (stage 4b): won bids with no submittal started,
 * shared rooms nobody opened, rows sent back with no resubmit, and lead times past the
 * job's stage window. Reads the last 120 days of won bids plus every room and revision
 * the caller can see (RLS scopes them to the office and the estimators). Null when the
 * hook is off, still loading, or a table is not there yet.
 */
export function useSubmittalsNudge(enabled: boolean): { nudge: SubmittalNudge | null; reload: () => void } {
  const [nudge, setNudge] = useState<SubmittalNudge | null>(null)
  const [nonce, setNonce] = useState(0)

  const load = useCallback(async () => {
    if (!enabled) {
      setNudge(null)
      return
    }
    try {
      const since = new Date(Date.now() - 120 * 86_400_000).toISOString()
      const [{ data: wonRows }, { data: revRows }, { data: roomRows }] = await Promise.all([
        db.from('bids').select('id, bid_number, project_name, outcome, outcome_at').eq('outcome', 'won').gte('outcome_at', since).order('outcome_at', { ascending: false }).limit(200),
        db.from('bid_submittals').select('id, bid_id, rev_number, shared_at, status').order('rev_number', { ascending: false }).limit(1000),
        db.from('bid_submittal_rooms').select('id, bid_id, shared_at, status'),
      ])
      const revisions = ((revRows ?? []) as Array<{ id: string; bid_id: string; rev_number: number; shared_at: string | null; status: string }>).map<NudgeRevision>((r) => ({ id: r.id, bidId: r.bid_id, revNumber: r.rev_number, sharedAt: r.shared_at, status: r.status }))
      const roomList = (roomRows ?? []) as Array<{ id: string; bid_id: string; shared_at: string | null; status: string }>
      const rooms = roomList.map<NudgeRoom>((r) => ({ bidId: r.bid_id, sharedAt: r.shared_at, status: r.status }))
      const roomBid = new Map(roomList.map((r) => [r.id, r.bid_id]))
      // Every bid in play: the won ones, plus any with a room or a revision (labels come from a second read).
      const bidIds = new Set<string>([...((wonRows ?? []) as Array<{ id: string }>).map((b) => b.id), ...revisions.map((r) => r.bidId), ...rooms.map((r) => r.bidId)])
      const [{ data: bidRows }, { data: jobRows }, { data: viewRows }, { data: peopleRows }] = await Promise.all([
        bidIds.size ? db.from('bids').select('id, bid_number, project_name, outcome, outcome_at').in('id', [...bidIds]) : Promise.resolve({ data: [] }),
        bidIds.size ? db.from('jobs_ledger').select('id, bid_id').in('bid_id', [...bidIds]) : Promise.resolve({ data: [] }),
        roomList.length ? db.from('bid_submittal_events').select('room_id, occurred_at').eq('event_type', 'view').in('room_id', roomList.map((r) => r.id)).order('occurred_at', { ascending: false }).limit(2000) : Promise.resolve({ data: [] }),
        roomList.length ? db.from('bid_submittal_people').select('room_id, name, open_count, may_decide, closed_at').in('room_id', roomList.map((r) => r.id)) : Promise.resolve({ data: [] }),
      ])
      const jobByBid = new Map<string, string>()
      for (const j of (jobRows ?? []) as Array<{ id: string; bid_id: string | null }>) if (j.bid_id && !jobByBid.has(j.bid_id)) jobByBid.set(j.bid_id, j.id)
      const bids = ((bidRows ?? []) as Array<{ id: string; bid_number: string | null; project_name: string | null; outcome: string | null; outcome_at: string | null }>).map<NudgeBid>((b) => ({
        bidId: b.id,
        bidLabel: [b.bid_number ? `B${b.bid_number}` : '', b.project_name ?? ''].filter(Boolean).join(' ') || 'a bid',
        outcome: b.outcome,
        outcomeAt: b.outcome_at,
        jobId: jobByBid.get(b.id) ?? null,
      }))
      const views = ((viewRows ?? []) as Array<{ room_id: string; occurred_at: string }>).map<NudgeView>((v) => ({ bidId: roomBid.get(v.room_id) ?? '', occurredAt: v.occurred_at }))
      const people = ((peopleRows ?? []) as Array<{ room_id: string; name: string; open_count: number; may_decide: boolean; closed_at: string | null }>).map<NudgePerson>((p) => ({ bidId: roomBid.get(p.room_id) ?? '', name: p.name, openCount: p.open_count, mayDecide: p.may_decide, closed: !!p.closed_at }))
      // Items only for each bid's newest revision (shared or not) — what the cards read.
      const newest = new Map<string, NudgeRevision>()
      for (const r of revisions) {
        const cur = newest.get(r.bidId)
        if (!cur || r.revNumber > cur.revNumber) newest.set(r.bidId, r)
      }
      const sharedNewest = new Map<string, NudgeRevision>()
      for (const r of revisions) {
        if (!r.sharedAt) continue
        const cur = sharedNewest.get(r.bidId)
        if (!cur || r.revNumber > cur.revNumber) sharedNewest.set(r.bidId, r)
      }
      const itemRevIds = [...new Set([...newest.values(), ...sharedNewest.values()].map((r) => r.id))]
      const jobIds = [...new Set([...jobByBid.values()])]
      const [{ data: itemRows }, { data: windowRows }] = await Promise.all([
        itemRevIds.length ? db.from('bid_submittal_items').select('submittal_id, tag, review_decision, lead_time_days').in('submittal_id', itemRevIds) : Promise.resolve({ data: [] }),
        jobIds.length ? db.from('job_stage_windows').select('job_id, window_end, fixture_id').in('job_id', jobIds).not('window_end', 'is', null) : Promise.resolve({ data: [] }),
      ])
      const items = ((itemRows ?? []) as Array<{ submittal_id: string; tag: string; review_decision: string | null; lead_time_days: number | null }>).map<NudgeItem>((it) => ({ submittalId: it.submittal_id, tag: it.tag, reviewDecision: it.review_decision, leadTimeDays: it.lead_time_days }))
      const windows = ((windowRows ?? []) as Array<{ job_id: string; window_end: string | null }>).filter((w) => w.window_end).map<NudgeWindow>((w) => ({ jobId: w.job_id, windowEndYmd: (w.window_end as string).slice(0, 10), label: null }))
      setNudge(summarizeSubmittalNudge({ bids, revisions, rooms, views, people, items, windows }, new Date()))
    } catch {
      setNudge(null)
    }
  }, [enabled])

  useEffect(() => {
    void load()
  }, [load, nonce])

  return { nudge, reload: () => setNonce((n) => n + 1) }
}
