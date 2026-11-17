import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { SetURLSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { callingLockCutoffIso } from '../../lib/prospects/callingLock'
import { lastCallByProspect, withCalledProspect, withLastCall, type CallInteractionType } from '../../lib/prospects/callLogState'
import { CALL_INTERACTION_TYPES, CALLING_ORDER_STORAGE_KEY, orderFollowUpProspects, readCallingOrderMode, type CallingOrderMode } from '../../lib/prospects/callingOrder'
import { runFromSearch } from '../../lib/prospects/callRun'
import { orderLeadsBySoonestBid, type ProspectJob } from '../../lib/prospects/gcLeadLane'
import { makeLatestOnly } from '../../lib/prospects/laneLoad'
import { urlKeyForKind, type ProspectKind } from '../../lib/prospects/prospectKinds'
import type { ProspectLastCall } from '../../lib/prospects/prospectListGrouping'
import { PROSPECT_COLUMNS, type Prospect } from '../../lib/prospects/prospectRow'
import type { StripRead } from '../../lib/prospects/stripState'
import { orderSubsDeck } from '../../lib/prospects/subsDeckOrder'
import type { RankRow } from '../../lib/prospects/subsRanks'
import { isZzTestProspect, withoutZzProspects } from '../../lib/prospects/zzProspects'

/**
 * The Prospects page's data: the lane's two caches (the deck and the list), the pointer to the card that is up,
 * the call-history sets that travel with them, the two loaders, and the calling order. Moved out of
 * `src/pages/Prospects.tsx` unchanged; this is the seam the tabs read through.
 *
 * - **The deck** is `followUpProspects` with `currentProspectIndex`; `currentProspect` is the card. The address
 *   names it as `?prospect_id=` (`updateUrlProspectId` writes it, an effect here follows it).
 * - **The list** is `prospectListProspects`: every row of the lane, for the Prospect List, the Board and Convert.
 * - **The Subs lane's two more:** `laneAllRows` (every row, for the path strip's counts) and `laneQueueAll` (the
 *   whole queue before the trade filter).
 * - **The loaders** read the lane the page is on (`kind`). The page decides when they run: its tab-keyed effects
 *   call them. Only the newest deck load paints (`makeLatestOnly`).
 *
 * The page's handlers still patch the caches themselves, through the setters handed back here.
 */
export function useProspectsData({
  kind,
  userId,
  hideZz,
  searchParams,
  setSearchParams,
  benchTrades,
  mergeJobs,
  loadLaneRanks,
  loadLaneExtras,
}: {
  kind: ProspectKind
  userId: string | null
  /** The ZZ rule for prospects: test rows are hidden from every role but dev. */
  hideZz: boolean
  searchParams: URLSearchParams
  setSearchParams: SetURLSearchParams
  /** The bench's trades, for By need. Undefined until read, null when the read failed. */
  benchTrades: StripRead<{ trade: string; dependable: number }[]>
  /** A lead's jobs, read beside both loaders on the Jobs to GC lane. */
  mergeJobs: (ids: string[]) => Promise<Record<string, ProspectJob[]>>
  /** The board's pins, for By rank. */
  loadLaneRanks: () => Promise<RankRow[]>
  /** The Board's extra facts, read after the list on the Subs lane. */
  loadLaneExtras: (ids: string[]) => Promise<void>
}) {
  const latestLoad = useRef(makeLatestOnly())
  const [laneQueueAll, setLaneQueueAll] = useState<Prospect[]>([])
  const [laneAllRows, setLaneAllRows] = useState<Prospect[]>([])
  const [answeredProspectIds, setAnsweredProspectIds] = useState<Set<string>>(() => new Set())
  const [laneCallRows, setLaneCallRows] = useState<{ prospect_id: string; interaction_type: string }[]>([])
  const [followUpProspects, setFollowUpProspects] = useState<Prospect[]>([])
  const [currentProspectIndex, setCurrentProspectIndex] = useState(0)
  const [followUpLoading, setFollowUpLoading] = useState(false)
  const [prospectListProspects, setProspectListProspects] = useState<Prospect[]>([])
  const [prospectListLoading, setProspectListLoading] = useState(false)
  const [prospectLastCallMap, setProspectLastCallMap] = useState<Record<string, ProspectLastCall>>({})
  // Calling order (v2.2301): 'coldest' (default) or never-called-first, per user.
  // The ref mirrors state so loadFollowUpProspects reads the current mode
  // without being recreated. calledProspectIds = prospects with any
  // didnt_answer/answered on record; drives ordering + the queue badges.
  const [callingOrderMode, setCallingOrderMode] = useState<CallingOrderMode>('coldest')
  const callingOrderModeRef = useRef<CallingOrderMode>('coldest')
  const [calledProspectIds, setCalledProspectIds] = useState<Set<string>>(() => new Set())

  async function loadFollowUpProspects() {
    if (!userId) return
    setFollowUpLoading(true)
    // Only the newest load paints (v2.5578): a kind change mid-load starts another, and the first must not land last.
    const load = latestLoad.current.start()
    const [{ data: locks }, { data: callRows }] = await Promise.all([
      // Only LIVE locks hide a prospect — a row older than the TTL is a closed
      // tab or a forgotten row, not a colleague on the phone (callingLock.ts).
      supabase
        .from('prospect_calling_locks')
        .select('prospect_id')
        .neq('user_id', userId)
        .gte('locked_at', callingLockCutoffIso(Date.now())),
      supabase.from('prospect_comments').select('prospect_id, interaction_type').in('interaction_type', [...CALL_INTERACTION_TYPES]),
    ])
    if (!latestLoad.current.isLatest(load)) return
    const callList = (callRows ?? []) as { prospect_id: string; interaction_type: string }[]
    const called = new Set(callList.map((r) => r.prospect_id))
    setCalledProspectIds(called)
    setAnsweredProspectIds(new Set(callList.filter((r) => r.interaction_type === 'answered').map((r) => r.prospect_id)))
    setLaneCallRows(callList)
    const lockedByOthers = (locks ?? []).map((r) => r.prospect_id)
    let query = supabase.from('prospects').select(PROSPECT_COLUMNS).eq('kind', kind)
    // The Subs lane's strip counts every exit too (v2.5807); the other lanes never load Not a fit.
    if (kind !== 'sub') query = query.or('prospect_fit_status.is.null,prospect_fit_status.neq.not_a_fit')
    if (lockedByOthers.length > 0) {
      query = query.not('id', 'in', `(${lockedByOthers.join(',')})`)
    }
    const { data, error } = await query
      .order('last_contact', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: true })
    if (!latestLoad.current.isLatest(load)) return
    if (error) {
      setFollowUpProspects([])
      setFollowUpLoading(false)
      return
    }
    const raw = withoutZzProspects((data ?? []) as Prospect[], hideZz)
    let prospects = orderFollowUpProspects(
      raw.filter((p) => p.prospect_fit_status !== 'not_a_fit' && p.prospect_fit_status !== 'cant_reach' && p.prospect_fit_status !== 'converted'),
      called,
      callingOrderModeRef.current,
    )
    if (kind === 'sub') {
      // The Subs lane (v2.5560): the whole queue feeds the strip's counts; the deck shows one trade
      // when the URL names it, and By need puts the biggest gap first.
      setLaneQueueAll(prospects)
      setLaneAllRows(raw)
      const runNow = runFromSearch(`?${searchParams.toString()}`)
      const mode = callingOrderModeRef.current
      // By rank reads the board's pins, and a run reads none: its ids are its order.
      const ranks = !runNow && mode === 'by_rank' ? await loadLaneRanks() : []
      if (!latestLoad.current.isLatest(load)) return
      prospects = orderSubsDeck(prospects, { run: runNow, trade: searchParams.get('trade'), mode, benchTrades: benchTrades ?? [], called, calls: callList, ranks })
    }
    if (kind === 'gc_lead') {
      // The Jobs to GC lane (v2.5561): each lead's jobs ride along, and Soonest bid orders on them.
      const jobs = await mergeJobs(prospects.map((p) => p.id))
      if (!latestLoad.current.isLatest(load)) return
      if (callingOrderModeRef.current === 'soonest_bid') prospects = orderLeadsBySoonestBid(prospects, jobs, called)
    }

    const prospectId = searchParams.get('prospect_id')
    let finalProspects = prospects
    let idx = prospectId ? prospects.findIndex((p) => p.id === prospectId) : -1

    if (prospectId && idx < 0) {
      const { data: single } = await supabase
        .from('prospects')
        .select(PROSPECT_COLUMNS)
        .eq('id', prospectId)
        .maybeSingle()
      if (!latestLoad.current.isLatest(load)) return
      const otherKind = single ? (single as Prospect).kind : null
      if (otherKind && otherKind !== kind) {
        // A link from elsewhere (Calendar's callbacks, v2.5563) to a prospect of another kind: its own lane opens it,
        // so the card's last press is that kind's.
        setSearchParams((p) => {
          const next = new URLSearchParams(p)
          if (otherKind === 'customer') next.delete('kind')
          else next.set('kind', urlKeyForKind(otherKind))
          return next
        }, { replace: true })
        setFollowUpLoading(false)
        return
      }
      if (single && !(hideZz && isZzTestProspect(single as Prospect))) {
        finalProspects = [single as Prospect, ...prospects]
        idx = 0
      }
    }

    setFollowUpProspects(finalProspects)
    setCurrentProspectIndex(idx >= 0 ? idx : 0)
    setFollowUpLoading(false)
  }

  async function loadProspectListProspects() {
    if (!userId) return
    setProspectListLoading(true)
    const [{ data, error }, { data: callRows }] = await Promise.all([
      supabase
        .from('prospects')
        .select(PROSPECT_COLUMNS)
        .eq('kind', kind),
      supabase
        .from('prospect_comments')
        .select('prospect_id, interaction_type, created_at')
        .in('interaction_type', [...CALL_INTERACTION_TYPES])
        .order('created_at', { ascending: false }),
    ])
    if (error) {
      setProspectListProspects([])
      setProspectListLoading(false)
      return
    }
    // Rows arrive newest-first, so the first row per prospect is its latest call.
    setProspectLastCallMap(lastCallByProspect((callRows ?? []) as { prospect_id: string; interaction_type: string; created_at: string | null }[]))
    const callList = (callRows ?? []) as { prospect_id: string; interaction_type: string }[]
    setAnsweredProspectIds(new Set(callList.filter((r) => r.interaction_type === 'answered').map((r) => r.prospect_id)))
    setLaneCallRows(callList)
    const rows = withoutZzProspects((data ?? []) as Prospect[], hideZz)
    setProspectListProspects(rows)
    setProspectListLoading(false)
    if (kind === 'gc_lead') void mergeJobs(rows.map((p) => p.id))
    if (kind === 'sub') void loadLaneExtras(rows.filter((p) => p.prospect_fit_status == null).map((p) => p.id))
  }

  const currentProspect = followUpProspects[currentProspectIndex] ?? null
  const currentProspectId = currentProspect?.id ?? null

  useEffect(() => {
    const prospectId = searchParams.get('prospect_id')
    if (prospectId && followUpProspects.length > 0) {
      const idx = followUpProspects.findIndex((p) => p.id === prospectId)
      if (idx >= 0) setCurrentProspectIndex(idx)
    }
  }, [searchParams.get('prospect_id'), followUpProspects])

  // Load the calling-order preference; reload the queue if it isn't the default
  // (the initial load already ran with 'coldest' via the ref).
  useEffect(() => {
    if (!userId) return
    let stored: string | null = null
    try {
      stored = localStorage.getItem(`${CALLING_ORDER_STORAGE_KEY}_${userId}`)
    } catch {
      /* private mode */
    }
    const mode = readCallingOrderMode(stored)
    if (mode !== callingOrderModeRef.current) {
      callingOrderModeRef.current = mode
      setCallingOrderMode(mode)
      void loadFollowUpProspects()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  /** Switch the calling order: remembered per user, and the queue reloads in it. False when the deck is already in that order. */
  function switchCallingOrder(mode: CallingOrderMode): boolean {
    if (mode === callingOrderModeRef.current) return false
    callingOrderModeRef.current = mode
    setCallingOrderMode(mode)
    if (userId) {
      try {
        localStorage.setItem(`${CALLING_ORDER_STORAGE_KEY}_${userId}`, mode)
      } catch {
        /* private mode */
      }
    }
    // Re-runs the query with the new order; the URL-synced prospect_id keeps
    // the current prospect selected across the reshuffle.
    void loadFollowUpProspects()
    return true
  }

  function updateUrlProspectId(id: string | null) {
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.set('tab', 'follow-up')
      if (id) next.set('prospect_id', id)
      else next.delete('prospect_id')
      return next
    })
  }

  // The called-ids set (never-called chip + queue order) and the Prospect
  // List's last-call map were only rebuilt on a full reload, so the chip
  // outlived the call that should have cleared it.
  function markCalledLocally(prospectId: string, type: CallInteractionType, nowIso: string) {
    setCalledProspectIds((prev) => withCalledProspect(prev, prospectId))
    setProspectLastCallMap((prev) => withLastCall<ProspectLastCall>(prev, prospectId, { interaction_type: type, created_at: nowIso }))
  }

  return {
    followUpProspects,
    setFollowUpProspects,
    currentProspectIndex,
    setCurrentProspectIndex,
    currentProspect,
    currentProspectId,
    followUpLoading,
    prospectListProspects,
    setProspectListProspects,
    prospectListLoading,
    prospectLastCallMap,
    laneAllRows,
    setLaneAllRows,
    laneQueueAll,
    answeredProspectIds,
    laneCallRows,
    calledProspectIds,
    callingOrderMode,
    loadFollowUpProspects,
    loadProspectListProspects,
    switchCallingOrder,
    updateUrlProspectId,
    markCalledLocally,
  }
}

export type ProspectsData = ReturnType<typeof useProspectsData>
export type ProspectsSetter<T> = Dispatch<SetStateAction<T>>
