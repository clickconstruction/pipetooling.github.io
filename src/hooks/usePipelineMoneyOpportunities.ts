/**
 * Today's Money Opportunities, standalone (v2.2145): the same inputs the
 * Pipeline assembles for `PipelineMoneyOpportunities` — stats spine, AR
 * unallocated count, payment-chase summary, statement-round cards — fetched
 * here for hosts that aren't the Stages tab (Quickfill → Jobs Cleanup).
 * Every input is fail-soft: a missing RPC hides its card, nothing throws.
 * Gates mirror JobsStagesTab: AR card for dev/master/assistant-like/primary;
 * chase + rounds for the office roles (dev/master/assistant-like).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isAssistantLike } from '../lib/subcontractorLikeRole'
import { calendarYmdInAppTzFromIso } from '../utils/dateUtils'
import { fetchStagesHeaderStats } from '../lib/jobs/fetchStagesHeaderStats'
import type { StagesHeaderStats } from '../lib/jobs/stagesHeaderStats'
import type { StageRow } from '../lib/jobsStagesBoard'
import { buildPipelineMoneyMoves, type PipelineMove } from '../lib/jobs/pipelineOverview'
import { parsePaySpeedsRpc, parsePromisedPayDatesRpc, type PaySpeedData, type PromisedPayDate } from '../lib/jobs/billedExpectedPay'
import {
  buildPaymentChaseQueue,
  parseChaseTouchesRpc,
  summarizePaymentChase,
  type ChaseTouch,
  type PaymentChaseSummary,
} from '../lib/jobs/paymentChase'
import { buildGcReviewRollup } from '../lib/gcReviewRollup'
import { gcReviewWeekStartYmd, latestCertByGc, type GcReviewCertRow } from '../lib/jobs/gcReviewCertification'
import { listGcReviewCertifications } from '../lib/gcReviewCertifications'
import { buildStatementRound, deriveGcAccountMen, summarizeStatementRound, type RoundMarkRow } from '../lib/jobs/gcStatementRounds'
import { listGcStatementRoundMarks, listGcStatementSenders } from '../lib/gcStatementRoundIo'
import { useArBankUnallocatedCount } from './useArBankUnallocatedCount'
import type { PipelineGcRoundCards } from '../components/jobs/PipelineMoneyOpportunities'

export type PipelineMoneyOpportunitiesData = {
  loading: boolean
  error: string | null
  stats: StagesHeaderStats | null
  moves: PipelineMove[]
  chase: PaymentChaseSummary | null
  gcRound: PipelineGcRoundCards
  canOpenAr: boolean
  arUnallocatedCount: number | null
  /** How many cards the shared component will draw (moves + round cards + chase). */
  cardCount: number
  refetch: () => Promise<void>
}

export function usePipelineMoneyOpportunities(opts: {
  enabled: boolean
  authUserId: string | undefined
  authRole: string | null
}): PipelineMoneyOpportunitiesData {
  const { enabled, authUserId, authRole } = opts
  const canOpenAr =
    authRole === 'dev' || authRole === 'master_technician' || isAssistantLike(authRole) || authRole === 'primary'
  const isOffice = authRole === 'dev' || authRole === 'master_technician' || isAssistantLike(authRole)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<StagesHeaderStats | null>(null)
  const [leanBilledRows, setLeanBilledRows] = useState<StageRow[] | null>(null)
  const [paySpeeds, setPaySpeeds] = useState<PaySpeedData | null>(null)
  const [promises, setPromises] = useState<Record<string, PromisedPayDate> | null>(null)
  const [touches, setTouches] = useState<ChaseTouch[] | null>(null)
  const [certRows, setCertRows] = useState<GcReviewCertRow[]>([])
  const [marks, setMarks] = useState<RoundMarkRow[]>([])
  const [senders, setSenders] = useState<Map<string, string>>(new Map())

  const { count: arUnallocatedCount } = useArBankUnallocatedCount({
    enabled: enabled && canOpenAr && Boolean(authUserId),
    authUserId,
    authRole,
  })

  const load = useCallback(async () => {
    if (!enabled || !authUserId) return
    setLoading(true)
    setError(null)
    const res = await fetchStagesHeaderStats(null)
    if (res.ok) {
      setStats(res.stats)
      setLeanBilledRows(res.leanBilledRows)
    } else {
      setError(res.error)
    }
    setLoading(false)
    if (!isOffice) return
    // Glanceable extras — each fails soft (a not-yet-deployed RPC just hides its card).
    const weekStart = gcReviewWeekStartYmd()
    await Promise.all([
      supabase
        .rpc('get_billed_customer_pay_speeds' as never)
        .then(({ data }) => setPaySpeeds(parsePaySpeedsRpc(data as unknown)), () => {}),
      supabase
        .rpc('list_job_promised_pay_dates' as never)
        .then(({ data }) => setPromises(parsePromisedPayDatesRpc(data as unknown)), () => {}),
      supabase
        .rpc('list_payment_chase_touches' as never)
        .then(({ data }) => setTouches(parseChaseTouchesRpc(data as unknown)), () => {}),
      listGcReviewCertifications(weekStart).then(setCertRows, () => {}),
      listGcStatementRoundMarks(weekStart).then(setMarks, () => {}),
    ])
  }, [enabled, authUserId, isOffice])

  useEffect(() => {
    void load()
  }, [load])

  const rollup = useMemo(
    () => (isOffice && leanBilledRows ? buildGcReviewRollup(leanBilledRows, [], { groupBy: 'gc' }) : null),
    [isOffice, leanBilledRows],
  )
  const gcIds = useMemo(
    () => (rollup ? rollup.groups.flatMap((g) => (!g.isNoGc && g.gcId ? [g.gcId] : [])) : []),
    [rollup],
  )
  useEffect(() => {
    if (!isOffice || gcIds.length === 0) return
    let cancelled = false
    void listGcStatementSenders(gcIds).then((m) => {
      if (!cancelled) setSenders(m)
    }, () => {})
    return () => {
      cancelled = true
    }
  }, [isOffice, gcIds])

  const moves = useMemo(
    () => (stats ? buildPipelineMoneyMoves({ stats, arUnallocatedCount, canOpenAr }) : []),
    [stats, arUnallocatedCount, canOpenAr],
  )
  const chase = useMemo(() => {
    if (!isOffice || !leanBilledRows || touches == null) return null
    const today = calendarYmdInAppTzFromIso(new Date().toISOString())
    return summarizePaymentChase(buildPaymentChaseQueue(leanBilledRows, paySpeeds, promises, touches, today))
  }, [isOffice, leanBilledRows, paySpeeds, promises, touches])
  const gcRound = useMemo<PipelineGcRoundCards>(() => {
    if (!rollup || !leanBilledRows) return null
    const items = buildStatementRound({
      groups: rollup.groups,
      certsByGc: latestCertByGc(certRows),
      marks,
      senders,
      accountMen: deriveGcAccountMen(leanBilledRows),
    })
    const s = summarizeStatementRound(items, authUserId ?? null)
    return {
      held: s.held,
      ready: { count: s.readyForUser.length, total: s.readyForUser.reduce((t, i) => t + i.amount, 0) },
    }
  }, [rollup, leanBilledRows, certRows, marks, senders, authUserId])

  const cardCount =
    moves.length +
    (gcRound?.held && gcRound.held.count > 0 ? 1 : 0) +
    (gcRound?.ready && gcRound.ready.count > 0 ? 1 : 0) +
    (chase ? 1 : 0)

  return { loading, error, stats, moves, chase, gcRound, canOpenAr, arUnallocatedCount, cardCount, refetch: load }
}
