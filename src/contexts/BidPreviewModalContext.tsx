import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { BidPreviewModal, type BidPreviewTabUrl } from '../components/bids/BidPreviewModal'
import { fetchBidForPreview } from '../lib/fetchBidForPreview'
import { isSubmissionBidStaleForThreshold } from '../lib/submissionFollowupStale'
import type { Database } from '../types/database'
import type { BidWithBuilder } from '../types/bidWithBuilder'

export const OPEN_BID_EDIT_QUERY = 'openBidEdit'

type CustomerContactRow = Database['public']['Tables']['customer_contacts']['Row']

export type SubmissionFollowupStaleOverlayPayload = {
  thresholdDays: number
  lastContactFromEntries: Record<string, string>
  customerContacts: CustomerContactRow[]
}

export type BidPreviewModalContextValue = {
  openBidPreview: (bidId: string) => void
  openBidPreviewFromBid: (bid: BidWithBuilder) => void
  closeBidPreview: () => void
  isOpen: boolean
  setSubmissionFollowupStaleOverlay: (payload: SubmissionFollowupStaleOverlayPayload | null) => void
}

type OpenState =
  | { kind: 'closed' }
  | {
      kind: 'open'
      bid: BidWithBuilder | null
      loading: boolean
      error: string | null
    }

const BidPreviewModalContext = createContext<BidPreviewModalContextValue | null>(null)

let bidPreviewModalInstanceSeed = 0

export function BidPreviewModalProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [openState, setOpenState] = useState<OpenState>({ kind: 'closed' })
  const [instanceKey, setInstanceKey] = useState(0)
  const [submissionFollowupStaleOverlay, setSubmissionFollowupStaleOverlay] =
    useState<SubmissionFollowupStaleOverlayPayload | null>(null)

  const closeBidPreview = useCallback(() => {
    setOpenState({ kind: 'closed' })
  }, [])

  const openBidPreviewFromBid = useCallback((bid: BidWithBuilder) => {
    bidPreviewModalInstanceSeed += 1
    setInstanceKey(bidPreviewModalInstanceSeed)
    setOpenState({
      kind: 'open',
      bid,
      loading: false,
      error: null,
    })
  }, [])

  const openBidPreview = useCallback((bidId: string) => {
    bidPreviewModalInstanceSeed += 1
    setInstanceKey(bidPreviewModalInstanceSeed)
    setOpenState({
      kind: 'open',
      bid: null,
      loading: true,
      error: null,
    })
    void (async () => {
      const { bid, error } = await fetchBidForPreview(bidId)
      setOpenState((s) => {
        if (s.kind !== 'open' || !s.loading) return s
        return {
          kind: 'open',
          bid,
          loading: false,
          error,
        }
      })
    })()
  }, [])

  const onNavigateToBidsTab = useCallback(
    (tab: BidPreviewTabUrl, bidId: string) => {
      const q = new URLSearchParams()
      q.set('tab', tab)
      q.set('bidId', bidId)
      navigate(`/bids?${q.toString()}`)
      closeBidPreview()
    },
    [navigate, closeBidPreview]
  )

  const onRequestEditBid = useCallback(
    (bidId: string) => {
      const q = new URLSearchParams()
      q.set('bidId', bidId)
      q.set(OPEN_BID_EDIT_QUERY, '1')
      navigate(`/bids?${q.toString()}`)
      closeBidPreview()
    },
    [navigate, closeBidPreview]
  )

  const refreshPreviewBidFromNotes = useCallback(() => {
    setOpenState((s) => {
      if (s.kind !== 'open' || !s.bid?.id) return s
      const id = s.bid.id
      void (async () => {
        const { bid: fresh, error: fetchErr } = await fetchBidForPreview(id)
        setOpenState((cur) => {
          if (cur.kind !== 'open' || cur.bid?.id !== id) return cur
          if (fetchErr) return { ...cur, error: fetchErr }
          return { ...cur, bid: fresh ?? cur.bid, error: null }
        })
      })()
      return s
    })
  }, [])

  const value = useMemo<BidPreviewModalContextValue>(
    () => ({
      openBidPreview,
      openBidPreviewFromBid,
      closeBidPreview,
      isOpen: openState.kind === 'open',
      setSubmissionFollowupStaleOverlay,
    }),
    [
      openBidPreview,
      openBidPreviewFromBid,
      closeBidPreview,
      openState.kind,
      setSubmissionFollowupStaleOverlay,
    ],
  )

  const staleNoUpdateHighlight =
    openState.kind === 'open' &&
    openState.bid != null &&
    submissionFollowupStaleOverlay != null &&
    isSubmissionBidStaleForThreshold(
      openState.bid,
      submissionFollowupStaleOverlay.lastContactFromEntries,
      submissionFollowupStaleOverlay.customerContacts,
      submissionFollowupStaleOverlay.thresholdDays,
    )

  return (
    <BidPreviewModalContext.Provider value={value}>
      {children}
      {openState.kind === 'open' ? (
        <BidPreviewModal
          key={instanceKey}
          bid={openState.bid}
          loading={openState.loading}
          error={openState.error}
          onClose={closeBidPreview}
          onNavigateToBidsTab={onNavigateToBidsTab}
          onRequestEditBid={onRequestEditBid}
          onNotesMutated={refreshPreviewBidFromNotes}
          onNotesMutatedCustomer={refreshPreviewBidFromNotes}
          staleNoUpdateHighlight={staleNoUpdateHighlight}
        />
      ) : null}
    </BidPreviewModalContext.Provider>
  )
}

export function useBidPreview(): BidPreviewModalContextValue | null {
  return useContext(BidPreviewModalContext)
}
