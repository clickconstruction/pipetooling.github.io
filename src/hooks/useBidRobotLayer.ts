/**
 * The Bids page's robot layer — what the robot icon, the two robot sheets, the envelope and
 * the Robots lenses read and write: the twin pairing, reference presence, shadow runs, the
 * robots' open questions, and the writes that answer one, ask for a robot bid, and put the
 * robot's measured moves on the bid's ledger.
 *
 * The Bids map's step 5 (`docs/BIDS_TABS_ARCHITECTURE.md` → Recommended extraction order):
 * moved out of `src/pages/Bids.tsx` verbatim. Its reductions are `lib/bids/robotLayer`
 * (tested). The page keeps the URL doors (`?robot=needs`, `?envelope=`) and hands in the
 * bids it loaded; `BidsRobotOverlays` draws the five windows this hook opens.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { supabase } from '../lib/supabase'
import type { BidWithBuilder } from '../types/bidWithBuilder'
import type { RobotOpenQuestion } from '../components/bids/RobotNeedsSheet'
import { ROBOT_AUDIT_ROLES } from '../lib/bids/bidAudits'
import { bestEffortGap, bestEffortGapNote } from '../lib/bids/bestEffort'
import { referenceWholeValue } from '../../supabase/functions/_shared/referenceWhole'
import { envelopeRefusal, envelopeRunFromShadow, isRevisionAfterReveal, robotReviewRevisionNote, type EnvelopeRun } from '../lib/bids/robotEnvelope'
import {
  BEST_EFFORT_GAP_NOTE_PREFIX,
  estimatorLaneQuestions,
  latestShadowRunByBidNumber,
  openRobotQuestionsByBidId,
  robotQuestionsWaitingCount,
  scoredShadowRunFor,
  sourceIdByTwinId,
  twinBidBySourceId as pairTwinBidsBySourceId,
  type OpenRobotQuestionRow,
} from '../lib/bids/robotLayer'
import { mirrorRunReviewable, type RobotMirrorRun } from '../lib/bids/robotMirror'
import { robotRowState, type RobotRowInput } from '../lib/bids/robotRowState'
import type { ShadowRunRow } from '../lib/bids/shadowStory'
import { BID_UPDATE_NOT_APPLIED_MESSAGE, bidUpdateRefused } from '../lib/bids/updateGuard'

export function useBidRobotLayer(input: {
  authUserId: string | null | undefined
  myRole: string | null
  /** Every bid the page loaded — the sheets read the live row from it. */
  bids: BidWithBuilder[]
  setBids: Dispatch<SetStateAction<BidWithBuilder[]>>
  /** The twins' own bids (partitioned out of `bids` by the page). */
  robotBids: BidWithBuilder[]
  serviceTypes: ReadonlyArray<{ id: string; name: string }>
  showToast: (message: string, type?: 'info' | 'warning' | 'error' | 'success') => void
}) {
  const { authUserId, myRole, bids, setBids, robotBids, serviceTypes, showToast } = input

  // Robot readiness (v2.2530): source bid id → its twin copy, for the board icon's
  // "robot bid exists" state. Pairing is stamped by twin-mcp at open time.
  const twinBidBySourceId = useMemo(() => pairTwinBidsBySourceId(robotBids), [robotBids])
  // v2.3222: the Robot Board mirrors OUR bids (one row per bid with a robot run); the lens
  // label carries that count, reported by the mirror once its runs load.
  const [robotMirrorCount, setRobotMirrorCount] = useState<number | null>(null)

  // v2.2547: counts/pricing presence for decided bids (grade badge inputs).
  const [referencePresence, setReferencePresence] = useState<ReadonlyMap<string, { hasCounts: boolean; hasPricing: boolean }>>(() => new Map())
  const [robotGradeBid, setRobotGradeBid] = useState<BidWithBuilder | null>(null)
  useEffect(() => {
    if (!authUserId) return
    let cancelled = false
    void (async () => {
      const { data } = await (supabase as unknown as import('@supabase/supabase-js').SupabaseClient).rpc('list_reference_presence')
      if (cancelled || !data) return
      setReferencePresence(new Map((data as Array<{ bid_id: string; has_counts: boolean; has_pricing: boolean }>).map((r) => [r.bid_id, { hasCounts: r.has_counts, hasPricing: r.has_pricing }])))
    })()
    return () => {
      cancelled = true
    }
  }, [authUserId])

  // v2.3200: the robot icon's two sheets — status (the robot is on it) and needs
  // (the robot is waiting on a person). One kernel input per row, built here.
  // Keep the id, not the row: the sheets read the LIVE row so a write (front of
  // the line, an answered question) shows in the open sheet without reopening it.
  const [robotStatusBidId, setRobotStatusBidId] = useState<string | null>(null)
  const [robotNeedsBidId, setRobotNeedsBidId] = useState<string | null>(null)
  const robotStatusBid = useMemo(() => (robotStatusBidId ? (bids.find((b) => b.id === robotStatusBidId) ?? null) : null), [bids, robotStatusBidId])
  const robotNeedsBid = useMemo(() => (robotNeedsBidId ? (bids.find((b) => b.id === robotNeedsBidId) ?? null) : null), [bids, robotNeedsBidId])
  const setRobotStatusBid = useCallback((bid: BidWithBuilder | null) => setRobotStatusBidId(bid?.id ?? null), [])
  const setRobotNeedsBid = useCallback((bid: BidWithBuilder | null) => setRobotNeedsBidId(bid?.id ?? null), [])
  // Shadow runs by reference bid number (list_shadow_runs never returns a sealed
  // total, so nothing here can anchor a number). Latest run per reference wins.
  const [shadowRunByBidNumber, setShadowRunByBidNumber] = useState<ReadonlyMap<string, ShadowRunRow>>(() => new Map())
  const [shadowRunsGen, setShadowRunsGen] = useState(0)
  useEffect(() => {
    if (!authUserId) return
    let cancelled = false
    void (async () => {
      try {
        const { data, error } = await (supabase as unknown as import('@supabase/supabase-js').SupabaseClient).rpc('list_shadow_runs')
        if (error || cancelled) return
        setShadowRunByBidNumber(latestShadowRunByBidNumber((data ?? []) as ShadowRunRow[]))
      } catch {
        // RLS-closed or RPC missing: rows fall back to queued / working from the twin pairing.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authUserId, shadowRunsGen])
  // Open estimator-audience questions the robots asked about a bid — the row's
  // "needs something" state. Same table the Audits tab answers from; fail-soft.
  const canAnswerRobotQuestions = (ROBOT_AUDIT_ROLES as readonly string[]).includes(myRole ?? '')
  const [openRobotQuestionRows, setOpenRobotQuestionRows] = useState<readonly OpenRobotQuestionRow[]>([])
  const loadRobotQuestions = useCallback(async () => {
    if (!canAnswerRobotQuestions) return
    try {
      // select('*') so choices / recommended (v2.3210) and kind (v2.3212) ride
      // along once their migrations land; before that they are simply absent.
      const { data, error } = await (supabase as unknown as import('@supabase/supabase-js').SupabaseClient)
        .from('twin_questions')
        .select('*')
        .eq('status', 'open')
        .not('about_bid_id', 'is', null)
        .order('created_at', { ascending: true })
        .limit(500)
      if (error) return
      setOpenRobotQuestionRows(estimatorLaneQuestions((data ?? []) as OpenRobotQuestionRow[]))
    } catch {
      // RLS-closed: no questions surface on the board.
    }
  }, [canAnswerRobotQuestions])
  // v2.3212: a plans ask filed on the robot's shell sits on the HUMAN bid (lib/bids/robotLayer).
  const openQuestionsByBidId = useMemo<ReadonlyMap<string, RobotOpenQuestion[]>>(
    () => openRobotQuestionsByBidId(openRobotQuestionRows, sourceIdByTwinId(robotBids)),
    [openRobotQuestionRows, robotBids],
  )
  useEffect(() => {
    void loadRobotQuestions()
  }, [loadRobotQuestions])
  const answerRobotQuestion = useCallback(async (questionId: string, text: string, opts?: { rerunBidId?: string }): Promise<boolean> => {
    const { data: rows, error } = await (supabase as unknown as import('@supabase/supabase-js').SupabaseClient)
      .from('twin_questions')
      .update({ status: 'answered', answer: text, answered_by: authUserId ?? null, answered_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', questionId)
      .eq('status', 'open')
      .select('id')
    if (error) {
      showToast(`Couldn't save the answer: ${error.message}`, 'error')
      return false
    }
    if ((rows ?? []).length === 0) {
      showToast('Already answered elsewhere — refreshing.', 'error')
      await loadRobotQuestions()
      return false
    }
    // v2.3223: "Attached — rerun" on a plans ask also puts the HUMAN bid at the
    // front of the next robot batch — the same stamp as the green robot icon —
    // so the fix is acted on, not just recorded. Best-effort: the answer is
    // already saved; a refused stamp is reported and the person can use the icon.
    let rerun: 'stamped' | 'refused' | null = null
    if (opts?.rerunBidId) {
      const patch = { robot_requested_at: new Date().toISOString(), robot_requested_by: authUserId ?? null }
      const { data: updRows, error: updErr } = await supabase.from('bids').update(patch).eq('id', opts.rerunBidId).select('id')
      if (updErr || bidUpdateRefused(updRows)) rerun = 'refused'
      else {
        rerun = 'stamped'
        setBids((prev) => prev.map((b) => (b.id === opts.rerunBidId ? { ...b, ...patch } : b)))
      }
    }
    showToast(
      rerun === 'stamped'
        ? 'Answer saved — the robot goes again, front of the line next batch.'
        : rerun === 'refused'
          ? 'Answer saved, but the rerun request did not stick — use the robot icon to move it up.'
          : 'Answer saved — the robot reads it on its next run.',
      rerun === 'refused' ? 'error' : 'success',
    )
    await loadRobotQuestions()
    return true
  }, [authUserId, loadRobotQuestions, setBids, showToast])
  const serviceTypeNameById = useMemo(() => new Map(serviceTypes.map((st) => [st.id, st.name])), [serviceTypes])
  const robotRowInputFor = useCallback(
    (bid: BidWithBuilder): RobotRowInput => ({
      bid,
      serviceTypeName: serviceTypeNameById.get(bid.service_type_id) ?? null,
      twinBidNumber: twinBidBySourceId.get(bid.id)?.bid_number ?? null,
      run: shadowRunByBidNumber.get((bid.bid_number ?? '').trim()) ?? null,
      openQuestions: openQuestionsByBidId.get(bid.id)?.length ?? 0,
      plansAsks: openQuestionsByBidId.get(bid.id)?.filter((q) => q.kind === 'plans').length ?? 0,
      presence: referencePresence.get(bid.id) ?? null,
    }),
    [serviceTypeNameById, twinBidBySourceId, shadowRunByBidNumber, openQuestionsByBidId, referencePresence],
  )
  // Scoreboard (v2.3221): the "Your part" strip reads the icon's own kernel, so
  // the strip and the row can never disagree; questions waiting on anyone are
  // the estimator lane minus plans asks (those sit on the bid as a need).
  const robotRowStateForScoreboard = useCallback(
    (bid: { id: string }) => {
      const row = bids.find((b) => b.id === bid.id)
      return row ? robotRowState(robotRowInputFor(row)) : { kind: 'none' as const, title: '' }
    },
    [bids, robotRowInputFor],
  )
  const robotQuestionsWaiting = useMemo(() => robotQuestionsWaitingCount(openRobotQuestionRows), [openRobotQuestionRows])
  /** v2.3225: the icon's state for a human bid — the Robot Board mirror lists live bids with no run from it. */
  const robotRowStateFor = useCallback((bid: BidWithBuilder) => robotRowState(robotRowInputFor(bid)), [robotRowInputFor])
  const [robotComparePair, setRobotComparePair] = useState<{ source: BidWithBuilder; twin: BidWithBuilder } | null>(null)

  // v2.3222: the robot's envelope, opened at send. The trigger scored the shadow the instant
  // the row saved with value + date, so a reveal after that save cannot move the score. Once
  // per bid per session; the bid's estimator (or a dev); never on a sealed run.
  const [robotEnvelope, setRobotEnvelope] = useState<{ bid: BidWithBuilder; run: EnvelopeRun } | null>(null)
  const envelopeOfferedRef = useRef<Set<string>>(new Set())
  // The Audits lens opens on this card (a mirror row's "Open audit", the envelope's "Full audit").
  const [focusAuditId, setFocusAuditId] = useState<string | null>(null)
  const bidsRef = useRef(bids)
  bidsRef.current = bids
  const offerRobotEnvelope = useCallback(
    async (bidId: string, opts?: { force?: boolean }) => {
      try {
        const { data: fresh } = await supabase
          .from('bids')
          .select('id, bid_number, estimator_id, bid_date_sent, bid_value, selected_bid_version_id, project_name')
          .eq('id', bidId)
          .maybeSingle()
        if (!fresh) return
        const number = (fresh.bid_number ?? '').trim()
        const untyped = supabase as unknown as import('@supabase/supabase-js').SupabaseClient
        // v2.3234: a recorded best effort opens the envelope before send (fail-soft: no table → no record).
        const bestEffort = await untyped.from('bid_best_efforts').select('value').eq('bid_id', bidId).maybeSingle().then((r) => (r.data as { value: number | string } | null)?.value ?? null, () => null)
        const { data: runs } = await untyped.rpc('list_shadow_runs')
        const run = scoredShadowRunFor((runs ?? []) as ShadowRunRow[], number)
        const refusal = envelopeRefusal({ ...fresh, best_effort_value: bestEffort }, { userId: authUserId ?? null, role: myRole }, run?.status ?? null, envelopeOfferedRef.current)
        if (refusal && !(opts?.force && (refusal === 'already-offered' || refusal === 'not-estimator'))) return
        if (!run) return
        envelopeOfferedRef.current.add(bidId)
        const row = bidsRef.current.find((b) => b.id === bidId)
        setRobotEnvelope({ bid: { ...(row ?? ({} as BidWithBuilder)), ...fresh } as BidWithBuilder, run: envelopeRunFromShadow(run) })
        setShadowRunsGen((g) => g + 1)
      } catch {
        // The envelope is a courtesy on top of a save that already succeeded — never an error.
      }
    },
    [authUserId, myRole],
  )
  // A Robot Board row's "Review now": the same envelope, on a scored or audited run whose audit still waits (sent bids only).
  const openEnvelopeFromMirror = useCallback((source: BidWithBuilder, run: RobotMirrorRun) => {
    // v2.3234: a run scored against the recorded best effort opens before send too.
    if (!(source.bid_date_sent || run.scoredAgainst === 'best_effort') || !mirrorRunReviewable(run)) return
    setRobotEnvelope({
      bid: source,
      run: { kind: run.kind, shellNumber: run.shellNumber, robotTotal: run.robotTotal, ourValue: run.ourValue, deltaPct: run.deltaPct, at: run.at || null, teacherName: run.teacherName, practice: run.practice, scoredAgainst: run.scoredAgainst ?? null },
    })
  }, [])
  // v2.3234: at send, the sent value against the recorded best effort — the robot's measured move on this bid, once, on the ledger.
  const noteBestEffortGap = useCallback(async (bidId: string) => {
    try {
      const untyped = supabase as unknown as import('@supabase/supabase-js').SupabaseClient
      const [{ data: be }, { data: fresh }] = await Promise.all([
        untyped.from('bid_best_efforts').select('value').eq('bid_id', bidId).maybeSingle(),
        supabase.from('bids').select('bid_number, bid_value, bid_date_sent, cover_letter_alt_texts').eq('id', bidId).maybeSingle(),
      ])
      if (!be || !fresh?.bid_date_sent) return
      // v2.4199: against the whole — the sent base plus the offered alternates' stamped add-ons.
      const gap = bestEffortGap((be as { value: number | string }).value, referenceWholeValue(fresh.bid_value, fresh.cover_letter_alt_texts))
      if (!gap) return
      const { count } = await supabase.from('bids_submission_entries').select('id', { count: 'exact', head: true }).eq('bid_id', bidId).like('notes', `${BEST_EFFORT_GAP_NOTE_PREFIX}%`)
      if ((count ?? 0) > 0) return
      const run = shadowRunByBidNumber.get((fresh.bid_number ?? '').trim()) ?? null
      await supabase.from('bids_submission_entries').insert({ bid_id: bidId, notes: bestEffortGapNote(gap, run?.locked_total != null ? Number(run.locked_total) : null), created_by: authUserId ?? null })
    } catch {
      // The note is the story; the send already succeeded.
    }
  }, [shadowRunByBidNumber, authUserId])
  // Bid value changed after the robot's number was in view: on the ledger by name (never contamination — the score stays as taken).
  const noteRobotReviewRevision = useCallback(
    async (bid: BidWithBuilder, nextValue: number | string | null | undefined) => {
      const run = shadowRunByBidNumber.get((bid.bid_number ?? '').trim()) ?? null
      if (!isRevisionAfterReveal({ wasSentBefore: !!bid.bid_date_sent, prevValue: bid.bid_value, nextValue, runStatus: run?.status ?? null })) return
      const text = robotReviewRevisionNote(bid.bid_value, nextValue ?? null, run?.locked_total != null ? Number(run.locked_total) : null)
      if (!text) return
      await supabase.from('bids_submission_entries').insert({ bid_id: bid.id, notes: text, created_by: authUserId ?? null })
    },
    [shadowRunByBidNumber, authUserId],
  )

  // v2.2542: yellow robot click requests a robot bid (green); green withdraws.
  // Optimistic local patch + DB write; the dev Queue lens reads the same columns.
  const toggleRobotRequest = useCallback(async (bid: BidWithBuilder) => {
    const requesting = !bid.robot_requested_at
    const patch = requesting
      ? { robot_requested_at: new Date().toISOString(), robot_requested_by: authUserId ?? null }
      : { robot_requested_at: null, robot_requested_by: null }
    setBids((prev) => prev.map((b) => (b.id === bid.id ? { ...b, ...patch } : b)))
    const { data: updRows, error: updErr } = await supabase.from('bids').update(patch).eq('id', bid.id).select('id')
    if (updErr || bidUpdateRefused(updRows)) {
      setBids((prev) =>
        prev.map((b) =>
          b.id === bid.id
            ? { ...b, robot_requested_at: bid.robot_requested_at, robot_requested_by: bid.robot_requested_by }
            : b,
        ),
      )
      showToast(updErr ? `Couldn't ${requesting ? 'request' : 'withdraw'} the robot bid: ${updErr.message}` : BID_UPDATE_NOT_APPLIED_MESSAGE, 'error')
      return
    }
    showToast(
      requesting ? 'Moved to the front of the next robot batch.' : 'Back in line with the other bids.',
      'success',
    )
  }, [authUserId, setBids, showToast])

  return {
    twinBidBySourceId,
    robotMirrorCount,
    setRobotMirrorCount,
    referencePresence,
    robotGradeBid,
    setRobotGradeBid,
    robotStatusBid,
    setRobotStatusBid,
    robotNeedsBid,
    setRobotNeedsBid,
    /** Opens the needs sheet by id — the `?robot=needs` door, before the row is in hand. */
    setRobotNeedsBidId,
    bumpShadowRuns: () => setShadowRunsGen((g) => g + 1),
    openQuestionsByBidId,
    answerRobotQuestion,
    robotRowInputFor,
    robotRowStateForScoreboard,
    robotQuestionsWaiting,
    robotRowStateFor,
    robotComparePair,
    setRobotComparePair,
    robotEnvelope,
    setRobotEnvelope,
    focusAuditId,
    setFocusAuditId,
    offerRobotEnvelope,
    openEnvelopeFromMirror,
    noteBestEffortGap,
    noteRobotReviewRevision,
    toggleRobotRequest,
  }
}

export type BidRobotLayer = ReturnType<typeof useBidRobotLayer>
