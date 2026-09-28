/**
 * The Bid Board's scope — the People | Robots split of the bids the page loaded, the sent
 * counts every pill and lens header reads, and the board's job chips: the J#### links, the
 * budget chips, the job-account strips, and linking a job to a bid.
 *
 * The Bids map's step 6 (`docs/BIDS_TABS_ARCHITECTURE.md` → Recommended extraction order):
 * moved out of `src/pages/Bids.tsx` verbatim. The page keeps the loaders (the bids, the twin
 * user ids) and hands them in.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useConfirmDialog } from '../contexts/ConfirmDialogContext'
import { partitionBidsByScope } from '../lib/bidBoardScope'
import { countBidsMissingAccounts } from '../lib/bids/bidBoardJobAccounts'
import { canSeeBidBoardJobLinks, indexJobsByBidId, type BidBoardJobLink } from '../lib/bids/bidBoardJobLinks'
import { bidSentCounts, type BidSentScope } from '../lib/bids/bidSentCounts'
import { JOB_CREATED_FROM_BID_EVENT } from '../lib/bids/wonMomentActions'
import type { BidWithBuilder } from '../types/bidWithBuilder'
import { useBidBoardBudgetChips } from './useBidBoardBudgetChips'
import { useBidBoardJobAccountStrips } from './useBidBoardJobAccountStrips'
import type { useBidGcPackets } from './useBidGcPackets'

export function useBidBoardScope(input: {
  /** Every bid the page loaded. */
  bids: BidWithBuilder[]
  /** Ids of users flagged `is_digital_twin` — their bids are the Robots side. */
  twinUserIds: ReadonlySet<string>
  /** The trade pill's trade; `''` when it is cleared (every trade). */
  selectedServiceTypeId: string
  serviceTypes: ReadonlyArray<{ id: string; name: string }>
  gcPacketsByBid: ReturnType<typeof useBidGcPackets>['packetsByBid']
  myRole: string | null
  showToast: (message: string, type?: 'info' | 'warning' | 'error' | 'success') => void
}) {
  const { bids, twinUserIds, selectedServiceTypeId, serviceTypes, gcPacketsByBid, myRole, showToast } = input

  /** People|Robots split of the board (v2.2500) — one predicate, every rollup follows. */
  const { people: peopleBids, robots: robotBids } = useMemo(
    () => partitionBidsByScope(bids, twinUserIds),
    [bids, twinUserIds],
  )
  /**
   * Tier-2 #20 (decision 8): the scope every number on this page lives in — the trade pill's
   * trade, or every trade when the pill is cleared — and the ONE count kernel the Bid Board
   * pills, the Followup lens headers and the "need a reason" chip all read (per BID; GC
   * packets are the secondary figure). The Dashboard card reads the same kernel with `all`.
   */
  const sentScope = useMemo<BidSentScope>(
    () =>
      selectedServiceTypeId
        ? { kind: 'trade', tradeId: selectedServiceTypeId, tradeName: serviceTypes.find((st) => st.id === selectedServiceTypeId)?.name ?? null }
        : { kind: 'all' },
    [selectedServiceTypeId, serviceTypes],
  )
  const sentCounts = useMemo(() => bidSentCounts(peopleBids, { scope: sentScope, packetsByBid: gcPacketsByBid }), [peopleBids, sentScope, gcPacketsByBid])
  /** Lost bids in this trade with no structured loss reason yet — the Why we lost queue size (kernel: per bid). */
  const lostBidsNeedingReasonCount = sentCounts.lostNeedingReason

  // v2.2741: J#### chips on the board — only for roles that can open Jobs (estimators can't).
  const [jobsByBidId, setJobsByBidId] = useState<Map<string, BidBoardJobLink>>(() => new Map())
  const boardBidIdsKey = useMemo(() => [...peopleBids, ...robotBids].map((b) => b.id).sort().join(','), [peopleBids, robotBids])
  // Tier-1 #8: a job just opened from a bid → refetch the index so the J#### chip appears without a reload.
  const [jobsByBidGen, setJobsByBidGen] = useState(0)
  // Won-row chips (v2.3302): the value-matched job and the estimate's state, for the board's job-link roles.
  const bidBoardBudgetChips = useBidBoardBudgetChips([...peopleBids, ...robotBids], canSeeBidBoardJobLinks(myRole), jobsByBidGen)
  // Job accounts (v2.3520 / PR 1b): ONE `list_bid_job_account_strip` read for every won or started bid on the
  // page — the board's chips and header count, the Followup control's count, and the Job accounts lens all
  // read it. (The job-created trigger moves a bid to Started the moment its job opens, so both outcomes.)
  const jobAccountBidIds = useMemo(
    () => [...peopleBids, ...robotBids].filter((b) => b.outcome === 'won' || b.outcome === 'started_or_complete').map((b) => b.id),
    [peopleBids, robotBids],
  )
  const jobAccountStrips = useBidBoardJobAccountStrips(jobAccountBidIds, jobAccountBidIds.length > 0)
  const jobAccountsMissingCount = useMemo(
    () => (jobAccountStrips.loaded ? countBidsMissingAccounts(jobAccountBidIds, jobAccountStrips.byBid) : 0),
    [jobAccountStrips.loaded, jobAccountStrips.byBid, jobAccountBidIds],
  )
  const confirmDialog = useConfirmDialog()
  const linkJobToBidFromBoard = useCallback(
    async (args: { jobId: string; bidId: string; jobLabel: string; bidLabel: string }): Promise<boolean> => {
      const ok = await confirmDialog({
        message: `Link ${args.jobLabel} to ${args.bidLabel}? The job is stamped with the bid and the bid's estimate becomes the job's budget (the bid reads Started). Nothing else changes.`,
        confirmLabel: 'Link',
      })
      if (!ok) return false
      const { error } = await supabase.rpc('snapshot_job_budget_from_bid', { p_job_id: args.jobId, p_bid_id: args.bidId })
      if (error) {
        showToast(`Could not link: ${error.message}`, 'error')
        return false
      }
      showToast(`${args.jobLabel} linked to ${args.bidLabel} — its budget is the bid's estimate.`, 'success')
      window.dispatchEvent(new CustomEvent(JOB_CREATED_FROM_BID_EVENT, { detail: { bidId: args.bidId, jobId: args.jobId } }))
      return true
    },
    [confirmDialog, showToast],
  )
  useEffect(() => {
    const bump = () => setJobsByBidGen((n) => n + 1)
    window.addEventListener(JOB_CREATED_FROM_BID_EVENT, bump)
    return () => window.removeEventListener(JOB_CREATED_FROM_BID_EVENT, bump)
  }, [])
  useEffect(() => {
    void jobsByBidGen
    if (!canSeeBidBoardJobLinks(myRole) || !boardBidIdsKey) {
      setJobsByBidId(new Map())
      return
    }
    let cancelled = false
    const ids = boardBidIdsKey.split(',')
    void (async () => {
      const out: Array<{ id: string; hcp_number: string | null; bid_id: string | null; created_at: string | null }> = []
      for (let i = 0; i < ids.length; i += 200) {
        const { data } = await supabase.from('jobs_ledger').select('id, hcp_number, bid_id, created_at').in('bid_id', ids.slice(i, i + 200))
        if (data) out.push(...(data as typeof out))
      }
      if (!cancelled) setJobsByBidId(indexJobsByBidId(out))
    })()
    return () => {
      cancelled = true
    }
  }, [myRole, boardBidIdsKey, jobsByBidGen])

  return {
    peopleBids,
    robotBids,
    sentScope,
    sentCounts,
    lostBidsNeedingReasonCount,
    jobsByBidId,
    bidBoardBudgetChips,
    jobAccountStrips,
    jobAccountsMissingCount,
    linkJobToBidFromBoard,
  }
}
