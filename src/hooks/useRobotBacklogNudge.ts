import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

import { supabase } from '../lib/supabase'
import { buildRobotBacklog, type RobotBacklog, type RobotBacklogBid, type RobotBacklogRequest } from '../lib/bids/robotBacklog'
import { plumbingServiceTypeIdOf } from '../lib/bids/robotQueue'
import { latestShadowRunByBidNumber } from '../lib/bids/robotLayer'
import type { ShadowRunRow } from '../lib/bids/shadowStory'
import { todayYmdInAppTz } from '../utils/dateUtils'
import { isRobotBid } from '../lib/bidBoardScope'
import { loadRobotBacklogDismissState, saveRobotBacklogDismissState, shouldShowRobotBacklog, type RobotBacklogDismissState } from '../lib/robotBacklogDismiss'

// bids.twin_source_bid_id / robot_requested_at and bid_price_matrix_requests predate the generated types.
// One users select (twin ids) is the price of agreeing with the board and the Console exactly.
const db = supabase as unknown as SupabaseClient
const SNOOZE_MS = 24 * 60 * 60 * 1000

/**
 * The robots' backlog for a dev's Dashboard (v2.3287): open human bids
 * (unsent, undecided, not a robot shell) run through the Console's queue
 * kernel, plus open price-matrix requests. Refetches on window focus like the
 * neighbouring nudges; null when disabled, loading, empty, snoozed, or
 * dismissed. Fail-soft: a checkout ahead of a column renders nothing.
 */
export function useRobotBacklogNudge(enabled: boolean, userId: string | null | undefined): {
  backlog: RobotBacklog | null
  snooze24h: () => void
  dismissUntilCountIncreases: () => void
} {
  const [raw, setRaw] = useState<RobotBacklog | null>(null)
  const [dismissState, setDismissState] = useState<RobotBacklogDismissState>({})

  useEffect(() => {
    if (!userId) {
      setDismissState({})
      return
    }
    setDismissState(loadRobotBacklogDismissState(userId))
  }, [userId])

  const load = useCallback(async () => {
    if (!enabled) {
      setRaw(null)
      return
    }
    try {
      // Human vs robot is the board's rule (bidBoardScope.isRobotBid): a bid whose estimator or
      // creator is a twin account. Older shells carry no twin_source_bid_id, so the link alone lies.
      // v2.5753: the one rule the dispatcher claims by also needs the Plumbing type, the shadow runs
      // (a voided run is not a robot on the bid) and the gate columns the rounds read.
      const [bids, shells, twins, requests, types, runs] = await Promise.all([
        db
          .from('bids')
          .select('id, bid_number, project_name, plans_link, service_type_id, bid_due_date, created_at, robot_requested_at, robot_requested_by, robot_opt_out, plans_robot_readable, working_board_archived_at, bid_date_sent, outcome, estimator_id, created_by')
          .is('bid_date_sent', null)
          .is('outcome', null)
          // v2.2133: adopted-into-a-package bids leave every list — the board's one server-side filter besides the trade pill.
          .is('adopted_into_bid_id', null)
          .limit(1000),
        db.from('bids').select('twin_source_bid_id').not('twin_source_bid_id', 'is', null).limit(2000),
        db.from('users').select('id').eq('is_digital_twin', true),
        db
          .from('bid_price_matrix_requests')
          .select('id, status, requested_at, claimed_at, heartbeat_at, bids(bid_number, project_name)')
          .in('status', ['queued', 'working', 'blocked'])
          .order('requested_at', { ascending: true })
          .limit(100),
        db.from('service_types').select('id, name'),
        db.rpc('list_shadow_runs'),
      ])
      if (bids.error || shells.error || twins.error) {
        setRaw(null)
        return
      }
      const twinUserIds = new Set(((twins.data ?? []) as Array<{ id: string }>).map((u) => u.id))
      const humanBids = ((bids.data ?? []) as Array<RobotBacklogBid & { estimator_id: string | null; created_by: string | null }>).filter((b) => !isRobotBid(b, twinUserIds))
      const shadowed = new Set(((shells.data ?? []) as Array<{ twin_source_bid_id: string | null }>).map((r) => r.twin_source_bid_id).filter((x): x is string => !!x))
      // The requests table may be unknown to an older schema cache — treat as no matrices, not as no card.
      const reqRows: RobotBacklogRequest[] = requests.error
        ? []
        : ((requests.data ?? []) as Array<Omit<RobotBacklogRequest, 'bid'> & { bids: RobotBacklogRequest['bid'] | Array<NonNullable<RobotBacklogRequest['bid']>> | null }>).map((r) => ({
            id: r.id,
            status: r.status,
            requested_at: r.requested_at,
            claimed_at: r.claimed_at,
            heartbeat_at: r.heartbeat_at,
            bid: Array.isArray(r.bids) ? (r.bids[0] ?? null) : r.bids,
          }))
      const plumbingServiceTypeId = types.error ? null : plumbingServiceTypeIdOf((types.data ?? []) as Array<{ id: string; name: string | null }>)
      const shadowRunByBidNumber = latestShadowRunByBidNumber(runs.error ? [] : ((runs.data ?? []) as ShadowRunRow[]))
      setRaw(buildRobotBacklog(humanBids, { plumbingServiceTypeId, shadowRunByBidNumber, twinExistsForBidId: (id) => shadowed.has(id), todayYmd: todayYmdInAppTz() }, reqRows, Date.now()))
    } catch {
      setRaw(null)
    }
  }, [enabled])

  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])

  const persist = (next: RobotBacklogDismissState) => {
    if (!userId) return
    saveRobotBacklogDismissState(userId, next)
    setDismissState(next)
  }
  const total = raw ? raw.bidsWaiting + raw.matricesOpen : 0
  const visible = Boolean(userId) && raw != null && shouldShowRobotBacklog(total, dismissState)

  return {
    backlog: visible ? raw : null,
    snooze24h: () => persist({ ...dismissState, snoozeUntil: Date.now() + SNOOZE_MS }),
    dismissUntilCountIncreases: () => persist({ ...dismissState, dismissedCount: total }),
  }
}
