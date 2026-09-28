/**
 * The Bids page's URL router and everything a link to a bid does: `?tab=` to the open tab
 * (through the role gates of `lib/bids/bidsTabAccess`), `?tab=…&bidId=` to the row, card or
 * workflow tab the link names, the ring a landing leaves, the retry once a bid that was not
 * in hand arrives, `?new=true`, and `?openBidEdit=1`.
 *
 * The Bids map's step 7 (`docs/BIDS_TABS_ARCHITECTURE.md` → Recommended extraction order):
 * moved out of `src/pages/Bids.tsx` verbatim, effects in the order they ran. The page keeps
 * the tab, the selections and the form; it hands in their setters and the two doors into the
 * Bid window. `Bids.render.test.tsx` walks every `?tab=` key for every role and follows a
 * link to a bid through this hook.
 */
import { useCallback, useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { OPEN_BID_EDIT_QUERY } from '../contexts/BidPreviewModalContext'
import { supabase } from '../lib/supabase'
import { isBidEligibleForWorkingBoard } from '../lib/workingBoardArchiveEligibility'
import { isRobotBid } from '../lib/bidBoardScope'
import { bidTradeToSwitchTo } from '../lib/bids/bidTradeSwitch'
import { isBidWorkflowTab, isBidsTabKey, resolveBidsTabRoute, type BidsTabKey } from '../lib/bids/bidsTabAccess'
import { readSharedBidId } from '../lib/bids/sharedBidPointer'
import { dropDayBookDoorParams } from '../lib/people/dayBookDoor'
import { getSubmissionSectionKey, type SubmissionSectionKey } from '../lib/bids/submissionSections'
import type { RoleGateDecision, RoleGateSurface } from '../lib/roleGate'
import type { BidWithBuilder } from '../types/bidWithBuilder'
import { useDeepLinkHighlight } from './useDeepLinkHighlight'

type SectionOpen = Record<SubmissionSectionKey, boolean>

export function useBidsDeepLinks(input: {
  /** Every bid the page loaded (the trade on screen, or every trade on By builder). */
  bids: BidWithBuilder[]
  /** How many trades have loaded — a bid is only looked for under another trade once they have. */
  serviceTypeCount: number
  selectedServiceTypeId: string
  setSelectedServiceTypeId: (id: string) => void
  myRole: string | null
  authUserId: string | null | undefined
  twinUserIds: ReadonlySet<string>
  /** True while a workflow tab already has its bid — the remembered pointer is not restored over it. */
  hasSelectedBid: boolean
  showToast: (message: string, type?: 'info' | 'warning' | 'error' | 'success') => void
  roleGateBounce: (surface: RoleGateSurface, from: string) => RoleGateDecision
  setActiveTab: (tab: BidsTabKey) => void
  setSharedBid: (bid: BidWithBuilder | null) => void
  setSelectedBidForSubmission: (bid: BidWithBuilder | null) => void
  setSubmissionSectionOpen: Dispatch<SetStateAction<SectionOpen>>
  setBidBoardSectionOpen: Dispatch<SetStateAction<SectionOpen>>
  submissionSummaryCardRef: RefObject<HTMLDivElement>
  openNewBid: () => void
  openEditBid: (bid: BidWithBuilder) => void
}) {
  const {
    bids,
    serviceTypeCount,
    selectedServiceTypeId,
    setSelectedServiceTypeId,
    myRole,
    authUserId,
    twinUserIds,
    hasSelectedBid,
    showToast,
    roleGateBounce,
    setActiveTab,
    setSharedBid,
    setSelectedBidForSubmission,
    setSubmissionSectionOpen,
    setBidBoardSectionOpen,
    submissionSummaryCardRef,
    openNewBid,
    openEditBid,
  } = input
  const location = useLocation()
  const navigate = useNavigate()
  const [, setSearchParams] = useSearchParams()

  // The ring a deep link leaves on its row (hooks/useDeepLinkHighlight).
  const { id: bidBoardDeepLinkHighlightId, gen: bidBoardDeepLinkHighlightGen, flash: flashBidBoardRow } = useDeepLinkHighlight()
  const bidBoardPendingScrollBidIdRef = useRef<string | null>(null)
  const submissionFollowupPendingDeepLinkBidIdRef = useRef<string | null>(null)
  const openBidEditHandledRef = useRef<string | null>(null)
  const [workingBoardDeepLinkBidId, setWorkingBoardDeepLinkBidId] = useState<string | null>(null)
  const workingBoardPendingDeepLinkBidIdRef = useRef<string | null>(null)
  const workingDeepLinkAppliedBidIdRef = useRef<string | null>(null)
  const onWorkingBoardDeepLinkHandled = useCallback(() => {
    setWorkingBoardDeepLinkBidId(null)
  }, [])

  const consumeBidIdParam = useCallback(() => {
    setSearchParams((p) => {
      if (!p.has('bidId')) return p
      const next = new URLSearchParams(p)
      next.delete('bidId')
      return next
    }, { replace: true })
  }, [setSearchParams])

  const applyBidBoardDeepLinkToBid = useCallback((bid: BidWithBuilder) => {
    bidBoardPendingScrollBidIdRef.current = null
    // v2.2500: a twin's bid lives on the Robot Board — land the deep link where the row is.
    const robot = isRobotBid(bid, twinUserIds)
    setActiveTab(robot ? 'robot-board' : 'bid-board')
    const sectionKey = getSubmissionSectionKey(bid) ?? 'pending'
    // v2.3222: the Robot Board mirror opens its own sections around the ringed row.
    if (!robot) setBidBoardSectionOpen((prev) => ({ ...prev, [sectionKey]: true }))
    flashBidBoardRow(bid.id)
    window.setTimeout(() => {
      document.getElementById(`bid-board-row-${bid.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 150)
    // Write the landing tab into the URL along with the bidId cleanup: the URL-sync
    // effect re-runs on every searchParams change and snaps activeTab back to ?tab= —
    // with only the React state set, a robot landing flashed and bounced back to the
    // board named in the URL (v2.2533 fix).
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.delete('bidId')
      if (next.has('tab')) next.set('tab', robot ? 'robot-board' : 'bid-board')
      return next
    }, { replace: true })
  }, [setSearchParams, twinUserIds, flashBidBoardRow, setActiveTab, setBidBoardSectionOpen])

  const applySubmissionFollowupDeepLinkToBid = useCallback((bid: BidWithBuilder) => {
    submissionFollowupPendingDeepLinkBidIdRef.current = null
    setSelectedBidForSubmission(bid)
    setActiveTab('submission-followup')
    const sectionKey = getSubmissionSectionKey(bid) ?? 'pending'
    setSubmissionSectionOpen((prev) => ({ ...prev, [sectionKey]: true }))
    setTimeout(() => {
      submissionSummaryCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 150)
    consumeBidIdParam()
  }, [consumeBidIdParam, setActiveTab, setSelectedBidForSubmission, setSubmissionSectionOpen, submissionSummaryCardRef])

  const { id: builderReviewDeepLinkHighlightCustomerId, gen: builderReviewDeepLinkHighlightGen, flash: flashBuilderCard } = useDeepLinkHighlight()
  const builderReviewPendingDeepLinkBidIdRef = useRef<string | null>(null)
  const builderReviewDeepLinkAppliedBidIdRef = useRef<string | null>(null)

  // v2.1387 (Followup merge): jump from a status-lens row to that builder's
  // card on the By-builder lens — same highlight plumbing as the bid deep link.
  const openBuilderLensForCustomer = useCallback(
    (customerId: string) => {
      setActiveTab('builder-review')
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'builder-review')
        return next
      })
      flashBuilderCard(customerId)
    },
    [setSearchParams, flashBuilderCard, setActiveTab]
  )

  const applyBuilderReviewDeepLinkFromBid = useCallback(
    (bid: BidWithBuilder) => {
      builderReviewPendingDeepLinkBidIdRef.current = null
      setActiveTab('builder-review')
      // Consume up front so the no-customer and already-applied branches never replay either.
      consumeBidIdParam()
      if (builderReviewDeepLinkAppliedBidIdRef.current === bid.id) {
        return
      }
      if (!bid.customer_id) {
        showToast('This bid is not linked to a customer. Builder Review lists customers.', 'info')
        return
      }
      const customerId = bid.customer_id
      // The search-clear, card-expand, and scroll-into-view are handled by
      // BidsBuilderReviewTab's effect keyed on the highlight gen/customer props.
      flashBuilderCard(customerId)
      builderReviewDeepLinkAppliedBidIdRef.current = bid.id
    },
    [showToast, consumeBidIdParam, flashBuilderCard, setActiveTab]
  )


  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('new') === 'true') {
      openNewBid()
      navigate('/bids', { replace: true })
      return
    }
    const bidId = params.get('bidId')
    // Aliases and role gates are one decision (lib/bids/bidsTabAccess): a renamed slug
    // (cost-estimate → labor, robot-shadows → robot-board) is written back into the URL.
    const route = resolveBidsTabRoute(params.get('tab'), myRole)
    const tab = route.tab
    if (route.aliased && tab) {
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', tab)
        return next
      }, { replace: true })
    }
    if (tab !== 'bid-board' || !bidId) {
      bidBoardPendingScrollBidIdRef.current = null
    }
    if (tab !== 'submission-followup' || !bidId) {
      submissionFollowupPendingDeepLinkBidIdRef.current = null
    }
    if (tab !== 'builder-review' || !bidId) {
      builderReviewPendingDeepLinkBidIdRef.current = null
      builderReviewDeepLinkAppliedBidIdRef.current = null
    }
    if (tab !== 'working' || !bidId) {
      workingBoardPendingDeepLinkBidIdRef.current = null
      workingDeepLinkAppliedBidIdRef.current = null
      setWorkingBoardDeepLinkBidId(null)
    }
    if (route.bounce) {
      // A tab the role may not open lands on the Bid board. The office tabs a primary or a
      // superintendent followed a link to say so first (v2.2882, C25 J10-F12); the dev-only
      // robot lenses, Day book and Bid Costs rewrite without a word.
      if (route.bounce === 'announced') roleGateBounce('bids-office-tab', `/bids?tab=${tab}`)
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'bid-board')
        // A Day book link someone may not open: its week and person do not ride along to the board.
        dropDayBookDoorParams(next)
        return next
      }, { replace: true })
      setActiveTab('bid-board')
      return
    }
    if (tab === 'builder-review') {
      setActiveTab('builder-review')
      if (!bidId) return
      const brBid = bids.find((b) => b.id === bidId)
      if (brBid) {
        applyBuilderReviewDeepLinkFromBid(brBid)
      } else {
        builderReviewPendingDeepLinkBidIdRef.current = bidId
      }
      return
    }
    if (bidId && tab === 'bid-board') {
      const bid = bids.find((b) => b.id === bidId)
      if (bid) {
        applyBidBoardDeepLinkToBid(bid)
      } else {
        bidBoardPendingScrollBidIdRef.current = bidId
        if (serviceTypeCount > 0) {
          void bidTradeToSwitchTo(supabase, bidId, selectedServiceTypeId).then((tradeId) => {
            if (tradeId) setSelectedServiceTypeId(tradeId)
          })
        }
      }
      return
    }
    if (bidId && tab === 'submission-followup') {
      const bid = bids.find((b) => b.id === bidId)
      if (bid) {
        applySubmissionFollowupDeepLinkToBid(bid)
      } else {
        submissionFollowupPendingDeepLinkBidIdRef.current = bidId
        setActiveTab('submission-followup')
        if (serviceTypeCount > 0) {
          // Bid not in current list - may be different service type; fetch and switch
          void bidTradeToSwitchTo(supabase, bidId, selectedServiceTypeId).then((tradeId) => {
            if (tradeId) setSelectedServiceTypeId(tradeId)
          })
        }
      }
      return
    }
    if (bidId && tab === 'working') {
      setActiveTab('working')
      if (!authUserId) {
        workingBoardPendingDeepLinkBidIdRef.current = null
        setWorkingBoardDeepLinkBidId(null)
        return
      }
      const wBid = bids.find((b) => b.id === bidId)
      if (!wBid) {
        workingBoardPendingDeepLinkBidIdRef.current = bidId
        if (serviceTypeCount > 0) {
          void bidTradeToSwitchTo(supabase, bidId, selectedServiceTypeId).then((tradeId) => {
            if (tradeId) setSelectedServiceTypeId(tradeId)
          })
        }
        return
      }
      workingBoardPendingDeepLinkBidIdRef.current = null
      consumeBidIdParam()
      if (wBid.working_board_archived_at) {
        if (workingDeepLinkAppliedBidIdRef.current !== bidId) {
          showToast(
            'This bid is archived on your Working board. Open Bid Board → Archived to restore.',
            'info'
          )
          workingDeepLinkAppliedBidIdRef.current = bidId
        }
        return
      }
      if (!isBidEligibleForWorkingBoard(wBid, authUserId)) {
        if (workingDeepLinkAppliedBidIdRef.current !== bidId) {
          showToast(
            'This bid is not on your Working board. Working shows unsent bids where you are Estimator or Account Man.',
            'info'
          )
          workingDeepLinkAppliedBidIdRef.current = bidId
        }
        return
      }
      if (workingDeepLinkAppliedBidIdRef.current === wBid.id) {
        return
      }
      workingDeepLinkAppliedBidIdRef.current = wBid.id
      setWorkingBoardDeepLinkBidId(wBid.id)
      return
    }
    if (!bidId && isBidWorkflowTab(tab) && !hasSelectedBid) {
      // J11-F2/N2: a workflow tab with no bidId (a tab click stripped it, then a refresh) — restore
      // the pointer this browser tab remembered. The URL stays as it is; nothing is re-added.
      const rememberedId = readSharedBidId()
      const remembered = rememberedId ? bids.find((b) => b.id === rememberedId) : null
      if (remembered) setSharedBid(remembered)
    }
    if (bidId && isBidWorkflowTab(tab)) {
      const bid = bids.find((b) => b.id === bidId)
      if (bid) {
        setSharedBid(bid)
        setActiveTab(tab)
      } else if (serviceTypeCount > 0) {
        void bidTradeToSwitchTo(supabase, bidId, selectedServiceTypeId).then((tradeId) => {
          if (tradeId) setSelectedServiceTypeId(tradeId)
        })
      }
      return
    }
    if (isBidsTabKey(tab)) {
      setActiveTab(tab)
    } else if (!params.get('tab')) {
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'bid-board')
        return next
      }, { replace: true })
    }
  }, [
    location.search,
    bids,
    serviceTypeCount,
    selectedServiceTypeId,
    myRole,
    authUserId,
    applyBidBoardDeepLinkToBid,
    applySubmissionFollowupDeepLinkToBid,
    applyBuilderReviewDeepLinkFromBid,
    showToast,
  ])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const deepBidId = params.get('bidId')
    const deepTab = params.get('tab')
    if (deepTab !== 'bid-board' || !deepBidId) return
    if (bidBoardPendingScrollBidIdRef.current !== deepBidId) return
    const pendingBid = bids.find((b) => b.id === deepBidId)
    if (!pendingBid) return
    applyBidBoardDeepLinkToBid(pendingBid)
  }, [bids, location.search, applyBidBoardDeepLinkToBid, roleGateBounce])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const deepBidId = params.get('bidId')
    const deepTab = params.get('tab')
    if (deepTab !== 'submission-followup' || !deepBidId) return
    if (submissionFollowupPendingDeepLinkBidIdRef.current !== deepBidId) return
    const pendingBid = bids.find((b) => b.id === deepBidId)
    if (!pendingBid) return
    applySubmissionFollowupDeepLinkToBid(pendingBid)
  }, [bids, location.search, applySubmissionFollowupDeepLinkToBid])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const pendingBrBidId = params.get('bidId')
    const pendingBrTab = params.get('tab')
    if (pendingBrTab !== 'builder-review' || !pendingBrBidId) return
    if (builderReviewPendingDeepLinkBidIdRef.current !== pendingBrBidId) return
    const pendingBrBid = bids.find((b) => b.id === pendingBrBidId)
    if (!pendingBrBid) return
    applyBuilderReviewDeepLinkFromBid(pendingBrBid)
  }, [bids, location.search, applyBuilderReviewDeepLinkFromBid])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const pendingW = params.get('bidId')
    const pendingWTab = params.get('tab')
    if (pendingWTab !== 'working' || !pendingW || !authUserId) return
    if (workingBoardPendingDeepLinkBidIdRef.current !== pendingW) return
    const pendingWBid = bids.find((b) => b.id === pendingW)
    if (!pendingWBid) return
    workingBoardPendingDeepLinkBidIdRef.current = null
    if (pendingWBid.working_board_archived_at) {
      if (workingDeepLinkAppliedBidIdRef.current !== pendingW) {
        showToast(
          'This bid is archived on your Working board. Open Bid Board → Archived to restore.',
          'info'
        )
        workingDeepLinkAppliedBidIdRef.current = pendingW
      }
      return
    }
    if (!isBidEligibleForWorkingBoard(pendingWBid, authUserId)) {
      if (workingDeepLinkAppliedBidIdRef.current !== pendingW) {
        showToast(
          'This bid is not on your Working board. Working shows unsent bids where you are Estimator or Account Man.',
          'info'
        )
        workingDeepLinkAppliedBidIdRef.current = pendingW
      }
      return
    }
    if (workingDeepLinkAppliedBidIdRef.current === pendingWBid.id) return
    workingDeepLinkAppliedBidIdRef.current = pendingWBid.id
    setWorkingBoardDeepLinkBidId(pendingWBid.id)
  }, [bids, location.search, authUserId, showToast])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get(OPEN_BID_EDIT_QUERY) !== '1') {
      openBidEditHandledRef.current = null
      return
    }
    const bidId = params.get('bidId')
    if (!bidId) return

    const bidRow = bids.find((b) => b.id === bidId)
    if (!bidRow) {
      if (serviceTypeCount > 0) {
        void bidTradeToSwitchTo(supabase, bidId, selectedServiceTypeId).then((tradeId) => {
          if (tradeId) setSelectedServiceTypeId(tradeId)
        })
      }
      return
    }

    if (openBidEditHandledRef.current === bidId) return
    openBidEditHandledRef.current = bidId
    openEditBid(bidRow)
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.delete(OPEN_BID_EDIT_QUERY)
      if (!next.get('tab')) next.set('tab', 'bid-board')
      return next
    }, { replace: true })
  }, [location.search, bids, serviceTypeCount, selectedServiceTypeId, setSearchParams])

  return {
    bidBoardDeepLinkHighlightId,
    bidBoardDeepLinkHighlightGen,
    builderReviewDeepLinkHighlightCustomerId,
    builderReviewDeepLinkHighlightGen,
    workingBoardDeepLinkBidId,
    onWorkingBoardDeepLinkHandled,
    applyBidBoardDeepLinkToBid,
    applyBuilderReviewDeepLinkFromBid,
    openBuilderLensForCustomer,
  }
}
