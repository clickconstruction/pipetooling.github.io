import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { supabase } from '../lib/supabase'
import { loadBidScheduleForJob } from '../lib/aiaBidScheduleIo'
import { bringBidStagesLabel, bringBidStagesStanding, rowsWithBidStages, type BringStagesLine, type BringStagesStanding } from '../lib/bids/jobStagesFromBid'
import type { AwardBidBreakdown } from '../lib/jobs/awardBaseline'
import { isDiscountRow } from '../lib/jobs/discountLine'
import { readLineBudgetSettings } from '../lib/jobs/lineBudgetSettingsStore'
import type { FixtureRow } from '../lib/jobs/jobFormTypes'
import { formatErrorMessage } from '../utils/errorHandling'
import { useToastContext } from '../contexts/ToastContext'
import type { BidCarryAnswer, BidCarryAsk } from '../components/jobs/BidCarryWindow'

/**
 * A job that already exists, still on one line: the offer of its bid's stages (punch list #397,
 * PR 4). The Bill tab shows one link beside Multiple Segment Generator, or the reason it is held.
 *
 * `bringBidStagesStanding` decides. Its cheap half needs nothing but the form: a bid, an open job
 * and one priced line. Only a job that passes it is read: its lines as the database holds them
 * (the crew's percent and the trip are not in the form), a checklist answer or a stage window on
 * the line, and a pay application on the job. A read that fails offers nothing, since the offer
 * replaces a line and must never be made on a guess.
 */

type Facts = { key: string; lines: BringStagesLine[]; hasPayApplication: boolean; checklistLineIds: Set<string>; windowLineIds: Set<string> }

export type BringBidStages = {
  /** The link to draw, or null. */
  link: { label: string; onPress: () => void } | null
  /** Why the offer is held, with the door that still works, or null. */
  heldWords: string | null
  /** The window's open question, or null; the form draws it with `BidCarryWindow`. */
  ask: BidCarryAsk | null
  answer: (answer: BidCarryAnswer) => void
}

const priceOf = (f: FixtureRow) => (Number(f.count) || 0) * (Number(f.line_unit_price) || 0)

export function useBringBidStages(args: {
  /** The saved job's id; null on a New Job form, which asked its own question at the import. */
  jobId: string | null
  bidId: string | null
  status: string | null | undefined
  bidNumber: string | null | undefined
  fixtures: FixtureRow[]
  setFixtures: Dispatch<SetStateAction<FixtureRow[]>>
}): BringBidStages {
  const { jobId, bidId, status, bidNumber, fixtures, setFixtures } = args
  const { showToast } = useToastContext()
  const [facts, setFacts] = useState<Facts | null>(null)
  const [ask, setAsk] = useState<BidCarryAsk | null>(null)

  // The cheap half: nothing is read for a job with no bid, a closed job, or a job whose lines are already its stages.
  const priced = useMemo(() => fixtures.filter((f) => !isDiscountRow(f)), [fixtures])
  const open = status === 'waiting' || status === 'working'
  const line = jobId && bidId && open && priced.length === 1 && priceOf(priced[0]!) > 0 ? priced[0]! : null
  const key = line && jobId ? `${jobId}:${line.id}` : null

  useEffect(() => {
    if (!key || !jobId) {
      setFacts(null)
      return
    }
    let cancelled = false
    void (async () => {
      const [fx, answers, windows, payApps] = await Promise.all([
        supabase.from('jobs_ledger_fixtures').select('id, line_kind, invoice_id, progress_pct, progress_report_id, trip_id, budget_source').eq('job_id', jobId).limit(200),
        supabase.from('stage_checklist_answers').select('fixture_id').eq('job_id', jobId).limit(200),
        supabase.from('job_stage_windows').select('fixture_id').eq('job_id', jobId).limit(200),
        supabase.from('job_pay_applications').select('id').eq('job_id', jobId).is('deleted_at', null).limit(1),
      ])
      if (cancelled) return
      if (fx.error || answers.error || windows.error || payApps.error) {
        setFacts(null)
        return
      }
      setFacts({
        key,
        lines: (fx.data ?? []) as BringStagesLine[],
        hasPayApplication: (payApps.data ?? []).length > 0,
        checklistLineIds: new Set((answers.data ?? []).map((r) => r.fixture_id)),
        windowLineIds: new Set((windows.data ?? []).map((r) => r.fixture_id)),
      })
    })()
    return () => {
      cancelled = true
    }
  }, [key, jobId])

  const standing: BringStagesStanding = useMemo(() => {
    if (!line || !facts || facts.key !== key) return { state: 'none' }
    const read = bringBidStagesStanding({ bidId, status, lines: facts.lines, hasPayApplication: facts.hasPayApplication, checklistLineIds: facts.checklistLineIds, windowLineIds: facts.windowLineIds })
    // The saved line must be the one on the form: an unsaved edit that swapped the line offers nothing until it saves.
    if (read.state === 'ready' && read.lineId !== line.id) return { state: 'none' }
    return read
  }, [line, facts, key, bidId, status])

  const onPress = useCallback(async () => {
    if (!line || !bidId) return
    const priceUsd = priceOf(line)
    const [bidRes, breakdownRes, schedule] = await Promise.all([
      supabase.from('bids').select('id, bid_number, project_name, customers(customer_type)').eq('id', bidId).maybeSingle(),
      supabase.rpc('bid_estimate_breakdown', { p_bid_id: bidId }),
      loadBidScheduleForJob(bidId, priceUsd),
    ])
    if (bidRes.error || !bidRes.data) {
      showToast(`The bid did not read, so its stages were not offered. ${bidRes.error ? formatErrorMessage(bidRes.error) : 'It may have been deleted.'}`, 'error')
      return
    }
    const bid = bidRes.data as { bid_number: string | null; project_name: string | null; customers: { customer_type: string | null } | null }
    setAsk({
      mode: 'split',
      lineName: line.name,
      carryValue: priceUsd,
      agreedValue: null,
      bid: { bid_number: bid.bid_number, project_name: bid.project_name },
      gcName: null,
      schedule,
      // A breakdown that did not read leaves the lines on the company's split, marked assumed.
      breakdown: breakdownRes.error ? null : ((breakdownRes.data as unknown as AwardBidBreakdown | null) ?? null),
      customerType: bid.customers?.customer_type ?? null,
      settings: readLineBudgetSettings(),
    })
  }, [line, bidId, showToast])

  const answer = useCallback(
    (a: BidCarryAnswer) => {
      setAsk(null)
      if (a.choice !== 'stages' || !line) return
      const lineId = line.id
      const stageRows: FixtureRow[] = a.lines.map((l) => ({ id: crypto.randomUUID(), ...l }))
      setFixtures((prev) => [...rowsWithBidStages(prev, lineId, stageRows)])
    },
    [line, setFixtures],
  )

  return {
    link: standing.state === 'ready' ? { label: bringBidStagesLabel({ bid_number: bidNumber ?? null }), onPress: () => void onPress() } : null,
    heldWords: standing.state === 'held' ? standing.words : null,
    ask,
    answer,
  }
}
