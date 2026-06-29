import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { Bid } from '../../types/bids'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import type { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import type { useBidPreview } from '../../contexts/BidPreviewModalContext'
import { resolveBidLedgerPrefix, formatBidLedgerNumberLabel } from '../../lib/ledgerDisplayPrefixes'
import { compareBidsForBidBoardDueDate } from '../../lib/compareBidsForBidBoardDueDate'
import { shouldShowEmptyBidValueAlert } from '../../lib/bidBoardEmptyBidValueAlert'
import { fetchBidBoardNotesUnreadCounts } from '../../lib/bidBoardNotesUnreadCounts'
import { upsertBidNotesReadWatermark } from '../../lib/userBidNotesReadState'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { formatAddressWithoutZip } from '../../lib/bids/bidContactInfo'
import { addressLines } from '../../lib/bidDocuments/htmlDoc'
import { formatBidValueShort, formatShortDate, formatDateYYMMDDParts } from '../../lib/bids/bidFormatting'
import { getSubmissionSectionKey, type SubmissionSectionKey } from '../../lib/bids/submissionSections'
import { computeBidBoardStaffOutcomeStatsByRole } from '../../lib/bids/bidBoardStaffOutcomes'
import { buildBidBoardWeeklySentSummaries } from '../../lib/bidBoardWeeklySentStats'
import { BidBoardNotesExpandIcon } from '../icons/BidBoardNotesExpandIcon'
import { BidBoardNotesPanel, type BidBoardNotesTab } from './BidBoardNotesPanel'
import { BidBoardLostSummaryModal } from './BidBoardLostSummaryModal'
import { BidWorkingBoardArchivedModal } from './BidWorkingBoardArchivedModal'
import { BidBoardBidNumberMark } from './BidBoardBidNumberMark'
import { BidBoardEstimatingHealthSection } from './BidBoardEstimatingHealthSection'

type BidBoardSectionOpenState = {
  unsent: boolean
  pending: boolean
  won: boolean
  startedOrComplete: boolean
  lost: boolean
}

type BidsBidBoardTabProps = {
  bids: BidWithBuilder[]
  authUser: { id: string } | null
  isDev: boolean
  ledgerPrefixMap: ReturnType<typeof useLedgerPrefixMap>
  bidPreview: ReturnType<typeof useBidPreview> | null
  sectionOpen: BidBoardSectionOpenState
  onSectionOpenChange: React.Dispatch<React.SetStateAction<BidBoardSectionOpenState>>
  deepLinkHighlightId: string | null
  deepLinkHighlightGen: number
  onEditBid: (bid: BidWithBuilder, opts?: { focus?: 'projectName' | 'gcBuilder' | 'bidValue' }) => void
  onOpenGcBuilderOrCustomer: (bid: BidWithBuilder) => void
  onLastContactClick: (bid: BidWithBuilder) => void
  onOpenCounts: (bid: BidWithBuilder) => void
  onError: (msg: string | null) => void
  onReloadBids: () => void
  onReloadCustomerContacts: () => void
  onOpenEvaluateChecklist: () => void
  lostSummaryModalOpen: boolean
  lostSummaryInitialStaffTab: string | null
  onOpenLostSummary: () => void
  onCloseLostSummary: () => void
  showLostModalLabor: boolean
  onSaveLossReason: (bidId: string, lossReason: string) => Promise<void>
  workingBoardArchivedBids: BidWithBuilder[]
}

const BID_BOARD_UNSENT_SECTION_LABEL = 'Unsent / Working Bids'

const BID_BOARD_SECTION_CONFIG = [
  { key: 'unsent' as const, label: BID_BOARD_UNSENT_SECTION_LABEL },
  { key: 'pending' as const, label: 'Not yet won or lost' },
  { key: 'won' as const, label: 'Won' },
  { key: 'startedOrComplete' as const, label: 'Started or Complete' },
  { key: 'lost' as const, label: 'Lost' },
] as const

export function BidsBidBoardTab({
  bids,
  authUser,
  isDev,
  ledgerPrefixMap,
  bidPreview,
  sectionOpen,
  onSectionOpenChange,
  deepLinkHighlightId,
  deepLinkHighlightGen,
  onEditBid,
  onOpenGcBuilderOrCustomer,
  onLastContactClick,
  onOpenCounts,
  onError,
  onReloadBids,
  onReloadCustomerContacts,
  onOpenEvaluateChecklist,
  lostSummaryModalOpen,
  lostSummaryInitialStaffTab,
  onOpenLostSummary,
  onCloseLostSummary,
  showLostModalLabor,
  onSaveLossReason,
  workingBoardArchivedBids,
}: BidsBidBoardTabProps) {
  const [bidBoardSearchQuery, setBidBoardSearchQuery] = useState('')
  const [expandedBidBoardBidId, setExpandedBidBoardBidId] = useState<string | null>(null)
  const [bidBoardNotesTab, setBidBoardNotesTab] = useState<BidBoardNotesTab>('all')
  const [bidBoardNotesUnreadByBidId, setBidBoardNotesUnreadByBidId] = useState<Record<string, number>>({})
  const [workingBoardArchivedModalOpen, setWorkingBoardArchivedModalOpen] = useState(false)
  const bidBoardUnreadFetchSeqRef = useRef(0)
  const bidsForBoardUnreadRef = useRef(bids)
  bidsForBoardUnreadRef.current = bids

  const filteredBidsForBidBoard = bidBoardSearchQuery.trim()
    ? bids.filter(
        (b) =>
          (b.project_name?.toLowerCase().includes(bidBoardSearchQuery.toLowerCase()) ?? false) ||
          ((b as { bid_number?: string | null }).bid_number?.toLowerCase().includes(bidBoardSearchQuery.toLowerCase()) ?? false) ||
          (b.address?.toLowerCase().includes(bidBoardSearchQuery.toLowerCase()) ?? false) ||
          (b.customers?.name?.toLowerCase().includes(bidBoardSearchQuery.toLowerCase()) ?? false) ||
          (b.bids_gc_builders?.name?.toLowerCase().includes(bidBoardSearchQuery.toLowerCase()) ?? false)
      )
    : bids

  const bidBoardBuckets = useMemo(() => {
    const buckets: Record<SubmissionSectionKey, BidWithBuilder[]> = {
      unsent: [],
      pending: [],
      won: [],
      startedOrComplete: [],
      lost: [],
    }
    const sortedForBoard = [...filteredBidsForBidBoard].sort(compareBidsForBidBoardDueDate)
    for (const bid of sortedForBoard) {
      const k = getSubmissionSectionKey(bid)
      if (!k) continue
      if (k === 'unsent' && bid.working_board_archived_at) continue
      buckets[k].push(bid)
    }
    return buckets
  }, [filteredBidsForBidBoard])

  const lostBidsMissingLossReasonCount = useMemo(() => {
    return bidBoardBuckets.lost.filter(
      (b) => !((b as { loss_reason?: string | null }).loss_reason ?? '').trim(),
    ).length
  }, [bidBoardBuckets.lost])

  const bidBoardStaffOutcomeByRole = useMemo(
    () => computeBidBoardStaffOutcomeStatsByRole(filteredBidsForBidBoard),
    [filteredBidsForBidBoard]
  )

  const bidBoardWeeklySentSummaries = useMemo(
    () => buildBidBoardWeeklySentSummaries(filteredBidsForBidBoard),
    [filteredBidsForBidBoard]
  )

  function toggleBidBoardSection(key: 'unsent' | 'pending' | 'won' | 'startedOrComplete' | 'lost') {
    onSectionOpenChange((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  useEffect(() => {
    if (!expandedBidBoardBidId) return
    const id = requestAnimationFrame(() => {
      document.getElementById(`bid-board-notes-${expandedBidBoardBidId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
    return () => cancelAnimationFrame(id)
  }, [expandedBidBoardBidId])

  useEffect(() => {
    if (!expandedBidBoardBidId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpandedBidBoardBidId(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [expandedBidBoardBidId])

  useEffect(() => {
    if (expandedBidBoardBidId) setBidBoardNotesTab('all')
  }, [expandedBidBoardBidId])

  useEffect(() => {
    if (!authUser?.id || bids.length === 0) {
      bidBoardUnreadFetchSeqRef.current += 1
      setBidBoardNotesUnreadByBidId({})
      return
    }
    const seq = ++bidBoardUnreadFetchSeqRef.current
    let cancelled = false
    const payload = bids.map((b) => ({ id: b.id, customer_id: b.customer_id ?? null }))
    void fetchBidBoardNotesUnreadCounts(authUser.id, payload)
      .then((map) => {
        if (!cancelled && seq === bidBoardUnreadFetchSeqRef.current) setBidBoardNotesUnreadByBidId(map)
      })
      .catch(() => {
        if (!cancelled && seq === bidBoardUnreadFetchSeqRef.current) setBidBoardNotesUnreadByBidId({})
      })
    return () => {
      cancelled = true
    }
  }, [bids, authUser?.id])

  useEffect(() => {
    if (!expandedBidBoardBidId || !authUser?.id) return
    const bidId = expandedBidBoardBidId
    let cancelled = false
    void (async () => {
      try {
        await upsertBidNotesReadWatermark(authUser.id, bidId)
      } catch {
        return
      }
      if (cancelled) return
      setBidBoardNotesUnreadByBidId((prev) => ({ ...prev, [bidId]: 0 }))
      const payload = bidsForBoardUnreadRef.current.map((b) => ({ id: b.id, customer_id: b.customer_id ?? null }))
      const seq = ++bidBoardUnreadFetchSeqRef.current
      try {
        const map = await fetchBidBoardNotesUnreadCounts(authUser.id, payload)
        if (!cancelled && seq === bidBoardUnreadFetchSeqRef.current) setBidBoardNotesUnreadByBidId(map)
      } catch {
        if (!cancelled && seq === bidBoardUnreadFetchSeqRef.current) {
          setBidBoardNotesUnreadByBidId((prev) => ({ ...prev, [bidId]: 0 }))
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [expandedBidBoardBidId, authUser?.id])

  const bidBoardTableHead = (
    <thead style={{ background: '#f9fafb' }}>
      <tr>
        <th style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb', width: '2rem' }} title="Notes" aria-label="Notes" />
        <th style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Bid #</th>
        <th style={{ padding: 0, textAlign: 'center', borderBottom: '1px solid #e5e7eb', fontSize: '0.6875rem', lineHeight: 1.25 }}>Project<br />Folder</th>
        <th style={{ padding: 0, textAlign: 'center', borderBottom: '1px solid #e5e7eb', fontSize: '0.6875rem', lineHeight: 1.25 }}>Job<br />Plans</th>
        <th style={{ padding: 0, textAlign: 'center', borderBottom: '1px solid #e5e7eb', fontSize: '0.6875rem', lineHeight: 1.25 }}>Count<br />Tool</th>
        <th style={{ padding: 0, textAlign: 'center', borderBottom: '1px solid #e5e7eb', fontSize: '0.6875rem', lineHeight: 1.25 }}>Bid<br />Send</th>
        <th
          style={{
            padding: '0.0625rem',
            textAlign: 'center',
            borderBottom: '1px solid #e5e7eb',
            fontSize: '0.6875rem',
            lineHeight: 1.25,
          }}
          title="GC or builder and project name"
          aria-label="GC or builder and project name"
        >
          GC/Builder<br />Project Name
        </th>
        <th style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb', fontSize: '0.6875rem', lineHeight: 1.25 }}>Address</th>
        <th
          style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb', fontSize: '0.6875rem', lineHeight: 1.25 }}
          title="Account manager and estimator"
          aria-label="Account manager and estimator"
        >
          Account Man<br />Estimator
        </th>
        <th style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb', fontSize: '0.6875rem', lineHeight: 1.25 }}>Bid</th>
        <th style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb', fontSize: '0.6875rem', lineHeight: 1.25 }}>Due<br />Date</th>
        <th style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb', fontSize: '0.6875rem', lineHeight: 1.25 }}>Distance<br />to Office</th>
        <th style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb', fontSize: '0.6875rem', lineHeight: 1.25 }}>Last<br />Contact</th>
        <th
          style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}
          title="Open counts, edit bid"
          aria-label="Open counts, edit bid"
        />
      </tr>
    </thead>
  )

  function renderBidBoardTableRow(bid: BidWithBuilder) {
    const notesExpanded = expandedBidBoardBidId === bid.id
    const notesUnreadRaw = bidBoardNotesUnreadByBidId[bid.id] ?? 0
    const notesUnreadBadgeText = notesUnreadRaw > 9 ? '9+' : notesUnreadRaw > 0 ? String(notesUnreadRaw) : null
    const notesUnreadTitleSuffix = notesUnreadRaw > 0 ? ` (${notesUnreadRaw} unread)` : ''
    const notesUnreadAriaSuffix = notesUnreadRaw > 0 ? `, ${notesUnreadRaw} unread` : ''
    return (
      <Fragment key={bid.id}>
        <tr
          id={`bid-board-row-${bid.id}`}
          data-deeplink-gen={bid.id === deepLinkHighlightId ? deepLinkHighlightGen : undefined}
          style={{
            borderBottom: '1px solid #e5e7eb',
            ...(bid.id === deepLinkHighlightId
              ? {
                  backgroundColor: '#fffbeb',
                  outline: '2px solid #d97706',
                  outlineOffset: -2,
                  transition: 'background-color 0.25s ease, outline-color 0.25s ease',
                }
              : {}),
          }}
        >
          <td style={{ padding: '0.0625rem', textAlign: 'center', verticalAlign: 'middle' }}>
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <button
                type="button"
                onClick={() => setExpandedBidBoardBidId((cur) => (cur === bid.id ? null : bid.id))}
                aria-expanded={notesExpanded}
                aria-controls={`bid-board-notes-${bid.id}`}
                title={
                  notesExpanded
                    ? 'Hide bid and customer notes'
                    : `Show bid and customer notes${notesUnreadTitleSuffix}`
                }
                aria-label={
                  notesExpanded
                    ? 'Hide bid and customer notes'
                    : `Show bid and customer notes${notesUnreadAriaSuffix}`
                }
                style={{
                  padding: '0.125rem 0.25rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#6b7280',
                  lineHeight: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BidBoardNotesExpandIcon expanded={notesExpanded} />
              </button>
              {notesUnreadBadgeText != null ? (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    minWidth: '0.875rem',
                    height: '0.875rem',
                    padding: notesUnreadRaw > 9 ? '0 3px' : 0,
                    borderRadius: 999,
                    background: '#ef4444',
                    color: '#fff',
                    fontSize: '0.5625rem',
                    fontWeight: 700,
                    lineHeight: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                    boxSizing: 'content-box',
                  }}
                >
                  {notesUnreadBadgeText}
                </span>
              ) : null}
            </span>
          </td>
        <td style={{ padding: '0.0625rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
          {(() => {
            const num = (bid as { bid_number?: string | null }).bid_number?.trim()
            if (!num) return '-'
            const pref = resolveBidLedgerPrefix((bid as Bid).service_type_id, ledgerPrefixMap)
            const label = formatBidLedgerNumberLabel(pref, num)
            if (!bidPreview) return <BidBoardBidNumberMark bidPrefix={pref} bidNumber={num} />
            const a11y = `Preview bid ${label}`
            return (
              <button
                type="button"
                onClick={() => bidPreview.openBidPreviewFromBid(bid)}
                title={a11y}
                aria-label={a11y}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: '#3b82f6',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  font: 'inherit',
                }}
              >
                <BidBoardBidNumberMark bidPrefix={pref} bidNumber={num} />
              </button>
            )
          })()}
        </td>
        <td style={{ padding: 0, textAlign: 'center' }}>
          {bid.drive_link ? (
            <a href={bid.drive_link} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openInExternalBrowser(bid.drive_link!) }} style={{ color: '#3b82f6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={20} height={20} fill="currentColor">
                <path d="M129.5 464L179.5 304L558.9 304L508.9 464L129.5 464zM320.2 512L509 512C530 512 548.6 498.4 554.8 478.3L604.8 318.3C614.5 287.4 591.4 256 559 256L179.6 256C158.6 256 140 269.6 133.8 289.7L112.2 358.4L112.2 160C112.2 151.2 119.4 144 128.2 144L266.9 144C270.4 144 273.7 145.1 276.5 147.2L314.9 176C328.7 186.4 345.6 192 362.9 192L480.2 192C489 192 496.2 199.2 496.2 208L544.2 208C544.2 172.7 515.5 144 480.2 144L362.9 144C356 144 349.2 141.8 343.7 137.6L305.3 108.8C294.2 100.5 280.8 96 266.9 96L128.2 96C92.9 96 64.2 124.7 64.2 160L64.2 448C64.2 483.3 92.9 512 128.2 512L320.2 512z"/>
              </svg>
            </a>
          ) : (
            '-'
          )}
        </td>
        <td style={{ padding: 0, textAlign: 'center' }}>
          {bid.plans_link ? (
            <a href={bid.plans_link} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openInExternalBrowser(bid.plans_link!) }} style={{ color: '#3b82f6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={20} height={20} fill="currentColor">
                <path d="M304 112L192 112C183.2 112 176 119.2 176 128L176 512C176 520.8 183.2 528 192 528L448 528C456.8 528 464 520.8 464 512L464 272L376 272C336.2 272 304 239.8 304 200L304 112zM444.1 224L352 131.9L352 200C352 213.3 362.7 224 376 224L444.1 224zM128 128C128 92.7 156.7 64 192 64L325.5 64C342.5 64 358.8 70.7 370.8 82.7L493.3 205.3C505.3 217.3 512 233.6 512 250.6L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 128zM387.4 496L252.6 496C236.8 496 224 483.2 224 467.4C224 461 226.1 454.9 230 449.8L297.6 362.9C303 356 311.3 352 320 352C328.7 352 337 356 342.4 362.9L410 449.9C413.9 454.9 416 461.1 416 467.5C416 483.3 403.2 496.1 387.4 496.1zM240 288C257.7 288 272 302.3 272 320C272 337.7 257.7 352 240 352C222.3 352 208 337.7 208 320C208 302.3 222.3 288 240 288z"/>
              </svg>
            </a>
          ) : (
            '-'
          )}
        </td>
        <td style={{ padding: 0, textAlign: 'center' }} title="CountTooling Plans">
          {bid.count_tooling_plans_link ? (
            <a href={bid.count_tooling_plans_link} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openInExternalBrowser(bid.count_tooling_plans_link!) }} style={{ color: '#3b82f6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={20} height={20} fill="currentColor">
                <path d="M192 112L304 112L304 200C304 239.8 336.2 272 376 272L464 272L464 512C464 520.8 456.8 528 448 528L192 528C183.2 528 176 520.8 176 512L176 128C176 119.2 183.2 112 192 112zM352 131.9L444.1 224L376 224C362.7 224 352 213.3 352 200L352 131.9zM192 64C156.7 64 128 92.7 128 128L128 512C128 547.3 156.7 576 192 576L448 576C483.3 576 512 547.3 512 512L512 250.5C512 233.5 505.3 217.2 493.3 205.2L370.7 82.7C358.7 70.7 342.5 64 325.5 64L192 64zM298.2 359.6C306.8 349.5 305.7 334.4 295.6 325.8C285.5 317.2 270.4 318.3 261.8 328.4L213.8 384.4C206.1 393.4 206.1 406.6 213.8 415.6L261.8 471.6C270.4 481.7 285.6 482.8 295.6 474.2C305.6 465.6 306.8 450.4 298.2 440.4L263.6 400L298.2 359.6zM378.2 328.4C369.6 318.3 354.4 317.2 344.4 325.8C334.4 334.4 333.2 349.6 341.8 359.6L376.4 400L341.8 440.4C333.2 450.5 334.3 465.6 344.4 474.2C354.5 482.8 369.6 481.7 378.2 471.6L426.2 415.6C433.9 406.6 433.9 393.4 426.2 384.4L378.2 328.4z"/>
              </svg>
            </a>
          ) : (
            '-'
          )}
        </td>
        <td style={{ padding: 0, textAlign: 'center' }} title="Bid Submission">
          {bid.bid_submission_link ? (
            <a href={bid.bid_submission_link} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openInExternalBrowser(bid.bid_submission_link!) }} style={{ color: '#3b82f6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={20} height={20} fill="currentColor">
                <path d="M240 112L128 112C119.2 112 112 119.2 112 128L112 512C112 520.8 119.2 528 128 528L208 528L208 576L128 576C92.7 576 64 547.3 64 512L64 128C64 92.7 92.7 64 128 64L261.5 64C278.5 64 294.8 70.7 306.8 82.7L429.3 205.3C441.3 217.3 448 233.6 448 250.6L448 400.1L400 400.1L400 272.1L312 272.1C272.2 272.1 240 239.9 240 200.1L240 112.1zM380.1 224L288 131.9L288 200C288 213.3 298.7 224 312 224L380.1 224zM272 444L304 444C337.1 444 364 470.9 364 504C364 537.1 337.1 564 304 564L292 564L292 592C292 603 283 612 272 612C261 612 252 603 252 592L252 464C252 453 261 444 272 444zM304 524C315 524 324 515 324 504C324 493 315 484 304 484L292 484L292 524L304 524zM400 444L432 444C460.7 444 484 467.3 484 496L484 560C484 588.7 460.7 612 432 612L400 612C389 612 380 603 380 592L380 464C380 453 389 444 400 444zM432 572C438.6 572 444 566.6 444 560L444 496C444 489.4 438.6 484 432 484L420 484L420 572L432 572zM508 464C508 453 517 444 528 444L576 444C587 444 596 453 596 464C596 475 587 484 576 484L548 484L548 508L576 508C587 508 596 517 596 528C596 539 587 548 576 548L548 548L548 592C548 603 539 612 528 612C517 612 508 603 508 592L508 464z"/>
              </svg>
            </a>
          ) : (
            '-'
          )}
        </td>
        <td
          style={{
            padding: '0.0625rem',
            maxWidth: 200,
            whiteSpace: 'normal',
            wordBreak: 'break-word',
            textAlign: 'center',
            fontSize: '0.75rem',
            lineHeight: 1.35,
            verticalAlign: 'middle',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
            {(bid.customers || bid.bids_gc_builders) ? (
              <button
                type="button"
                onClick={() => onOpenGcBuilderOrCustomer(bid)}
                style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: 0, textDecoration: 'none', font: 'inherit' }}
              >
                {bid.customers?.name ?? bid.bids_gc_builders?.name ?? '—'}
              </button>
            ) : (
              '-'
            )}
            <span>{bid.project_name ?? '-'}</span>
          </div>
        </td>
        <td
          style={{
            padding: '0.0625rem',
            maxWidth: 200,
            whiteSpace: 'normal',
            wordBreak: 'break-word',
            textAlign: 'center',
            fontSize: '0.75rem',
            lineHeight: 1.35,
          }}
          title={bid.address ?? ''}
        >
          {bid.address ? (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(bid.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#3b82f6' }}
            >
              {(() => {
                const formatted = formatAddressWithoutZip(bid.address)
                const lines = addressLines(formatted)
                if (lines.length <= 1) return formatted
                return <>{lines[0]}<br />{lines[1]}</>
              })()}
            </a>
          ) : (
            '-'
          )}
        </td>
        <td
          style={{
            padding: '0.0625rem',
            textAlign: 'center',
            fontSize: '0.6875rem',
            lineHeight: 1.35,
            wordBreak: 'break-word',
            verticalAlign: 'middle',
          }}
        >
          {(() => {
            const amRaw = bid.account_manager
            const amNorm = amRaw == null ? null : Array.isArray(amRaw) ? amRaw[0] ?? null : amRaw
            const estRaw = bid.estimator
            const estNorm = estRaw == null ? null : Array.isArray(estRaw) ? estRaw[0] ?? null : estRaw
            const amLine = amNorm ? (amNorm.name || amNorm.email) : '—'
            const estLine = estNorm ? (estNorm.name || estNorm.email) : '—'
            const isSelfAm = Boolean(authUser?.id && amNorm?.id === authUser.id)
            const isSelfEst = Boolean(authUser?.id && estNorm?.id === authUser.id)
            const selfLineStyle = {
              backgroundColor: '#111827',
              color: '#ffffff',
              padding: '0.125rem 0.35rem',
              borderRadius: 4,
              display: 'inline-block' as const,
              maxWidth: '100%',
              textAlign: 'center' as const,
              boxSizing: 'border-box' as const,
            }
            return (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                <span title={isSelfAm ? 'You' : undefined} style={isSelfAm ? selfLineStyle : undefined}>
                  {amLine}
                </span>
                <span title={isSelfEst ? 'You' : undefined} style={isSelfEst ? selfLineStyle : undefined}>
                  {estLine}
                </span>
              </div>
            )
          })()}
        </td>
        <td style={{ padding: '0.0625rem', textAlign: 'center', fontSize: '0.6875rem', lineHeight: 1.35 }}>
          {shouldShowEmptyBidValueAlert(bid) ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onEditBid(bid, { focus: 'bidValue' })
              }}
              title="Bid sent without a value. Click to edit and add a bid value."
              aria-label="Bid sent without a value. Click to edit and add a bid value."
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 18,
                height: 18,
                padding: 0,
                border: 'none',
                background: '#dc2626',
                color: '#fff',
                borderRadius: 999,
                cursor: 'pointer',
                fontSize: '0.6875rem',
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              <span aria-hidden>$</span>
            </button>
          ) : (
            formatBidValueShort(bid.bid_value != null ? Number(bid.bid_value) : null)
          )}
        </td>
        <td style={{ padding: '0.0625rem', textAlign: 'center', fontSize: '0.6875rem', lineHeight: 1.35 }}>
          {(() => {
            const parts = formatDateYYMMDDParts(bid.bid_due_date)
            return parts ? (
              <div style={{ lineHeight: 1.25 }}>
                <div>{parts.date}</div>
                <div>{parts.bracket}</div>
              </div>
            ) : '—'
          })()}
        </td>
        <td style={{ padding: '0.0625rem', textAlign: 'center', fontSize: '0.6875rem', lineHeight: 1.35 }}>
          {bid.distance_from_office != null && bid.distance_from_office !== ''
            ? `${Number.isNaN(Number(bid.distance_from_office)) ? bid.distance_from_office : Math.round(Number(bid.distance_from_office))}mi`
            : '—'}
        </td>
        <td style={{ padding: '0.0625rem', textAlign: 'center', fontSize: '0.6875rem', lineHeight: 1.35 }}>
          <button
            type="button"
            onClick={() => onLastContactClick(bid)}
            style={{
              background: 'none',
              border: 'none',
              color: '#3b82f6',
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'none',
              font: 'inherit',
            }}
          >
            {bid.last_contact ? (() => {
              const s = formatShortDate(bid.last_contact)
              const spaceIdx = s.indexOf(' ')
              if (spaceIdx < 0) return s
              return <>{s.slice(0, spaceIdx)}<br />{s.slice(spaceIdx + 1)}</>
            })() : '+'}
          </button>
        </td>
        <td style={{ padding: '0.0625rem', textAlign: 'center', verticalAlign: 'middle' }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.25rem',
            }}
          >
            <button
              type="button"
              onClick={() => onOpenCounts(bid)}
              title="Open in Counts"
              style={{ padding: 0, background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#3b82f6' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#6b7280' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={20} height={20} fill="currentColor" aria-hidden>
                <path d="M348 62.7C330.7 52.7 309.3 52.7 292 62.7L207.8 111.3C190.5 121.3 179.8 139.8 179.8 159.8L179.8 261.7L91.5 312.7C74.2 322.7 63.5 341.2 63.5 361.2L63.5 458.5C63.5 478.5 74.2 497 91.5 507L175.8 555.6C193.1 565.6 214.5 565.6 231.8 555.6L320.1 504.6L408.4 555.6C425.7 565.6 447.1 565.6 464.4 555.6L548.5 507C565.8 497 576.5 478.5 576.5 458.5L576.5 361.2C576.5 341.2 565.8 322.7 548.5 312.7L460.2 261.7L460.2 159.8C460.2 139.8 449.5 121.3 432.2 111.3L348 62.7zM296 356.6L296 463.1L207.7 514.1C206.5 514.8 205.1 515.2 203.7 515.2L203.7 409.9L296 356.6zM527.4 357.2C528.1 358.4 528.5 359.8 528.5 361.2L528.5 458.5C528.5 461.4 527 464 524.5 465.4L440.2 514C439 514.7 437.6 515.1 436.2 515.1L436.2 409.8L527.4 357.2zM412.3 159.8L412.3 261.7L320 315L320 208.5L411.2 155.9C411.9 157.1 412.3 158.5 412.3 159.9z"/>
              </svg>
            </button>
            <button
              type="button"
              onClick={() => onEditBid(bid)}
              title="Edit bid"
              style={{ padding: 0, background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="20" height="20" fill="currentColor" aria-hidden="true">
                <path d="M259.1 73.5C262.1 58.7 275.2 48 290.4 48L350.2 48C365.4 48 378.5 58.7 381.5 73.5L396 143.5C410.1 149.5 423.3 157.2 435.3 166.3L503.1 143.8C517.5 139 533.3 145 540.9 158.2L570.8 210C578.4 223.2 575.7 239.8 564.3 249.9L511 297.3C511.9 304.7 512.3 312.3 512.3 320C512.3 327.7 511.8 335.3 511 342.7L564.4 390.2C575.8 400.3 578.4 417 570.9 430.1L541 481.9C533.4 495 517.6 501.1 503.2 496.3L435.4 473.8C423.3 482.9 410.1 490.5 396.1 496.6L381.7 566.5C378.6 581.4 365.5 592 350.4 592L290.6 592C275.4 592 262.3 581.3 259.3 566.5L244.9 496.6C230.8 490.6 217.7 482.9 205.6 473.8L137.5 496.3C123.1 501.1 107.3 495.1 99.7 481.9L69.8 430.1C62.2 416.9 64.9 400.3 76.3 390.2L129.7 342.7C128.8 335.3 128.4 327.7 128.4 320C128.4 312.3 128.9 304.7 129.7 297.3L76.3 249.8C64.9 239.7 62.3 223 69.8 209.9L99.7 158.1C107.3 144.9 123.1 138.9 137.5 143.7L205.3 166.2C217.4 157.1 230.6 149.5 244.6 143.4L259.1 73.5zM320.3 400C364.5 399.8 400.2 363.9 400 319.7C399.8 275.5 363.9 239.8 319.7 240C275.5 240.2 239.8 276.1 240 320.3C240.2 364.5 276.1 400.2 320.3 400z" />
              </svg>
            </button>
          </div>
        </td>
      </tr>
        {bid.outcome === 'lost' ? (
          <tr
            aria-label={`Loss reason: ${(bid as { loss_reason?: string | null }).loss_reason?.trim() || 'not recorded'}`}
            style={{ background: '#f9fafb' }}
          >
            <td
              colSpan={14}
              style={{
                padding: '0.5rem 1rem 0.5rem 2rem',
                borderTop: '1px solid #e5e7eb',
                borderBottom: notesExpanded ? undefined : '1px solid #e5e7eb',
                verticalAlign: 'top',
                fontSize: '0.8125rem',
                lineHeight: 1.45,
                color: '#374151',
                whiteSpace: 'normal',
                wordBreak: 'break-word',
              }}
            >
              <span style={{ fontWeight: 600, color: '#111827' }}>Why did we lose? </span>
              <span style={{ color: (bid as { loss_reason?: string | null }).loss_reason?.trim() ? '#374151' : '#9ca3af' }}>
                {(bid as { loss_reason?: string | null }).loss_reason?.trim() || '—'}
              </span>
            </td>
          </tr>
        ) : null}
        {notesExpanded ? (
          <tr id={`bid-board-notes-${bid.id}`} style={{ background: '#f9fafb' }}>
            <td colSpan={14} style={{ padding: '1rem', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', verticalAlign: 'top' }}>
              <BidBoardNotesPanel
                bid={bid}
                notesTab={bidBoardNotesTab}
                onNotesTabChange={setBidBoardNotesTab}
                onLoadError={(m) => onError(m)}
                onMutated={() => { onReloadBids() }}
                onMutatedCustomer={() => { onReloadCustomerContacts(); onReloadBids() }}
                idPrefix="bid-board"
              />
            </td>
          </tr>
        ) : null}
      </Fragment>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder="Search (project name or GC/Builder)..."
          value={bidBoardSearchQuery}
          onChange={(e) => setBidBoardSearchQuery(e.target.value)}
          style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
          <button
            type="button"
            onClick={onOpenEvaluateChecklist}
            style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
          >
            Checklist
          </button>
          <button
            type="button"
            onClick={() => setWorkingBoardArchivedModalOpen(true)}
            style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
          >
            Archived{workingBoardArchivedBids.length > 0 ? ` (${workingBoardArchivedBids.length})` : ''}
          </button>
        </div>
      </div>
      {filteredBidsForBidBoard.length === 0 ? (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
          {bids.length === 0 ? 'No bids yet. Click New Bid to add one.' : 'No bids match your search.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {BID_BOARD_SECTION_CONFIG.map(({ key, label }) => {
            const sectionBids = bidBoardBuckets[key]
            const isOpen = sectionOpen[key]
            return (
              <div key={key}>
                {key === 'lost' ? (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleBidBoardSection(key)}
                      aria-expanded={isOpen}
                      style={{
                        margin: 0,
                        fontSize: '1rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: 0,
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        color: 'inherit',
                      }}
                    >
                      <span aria-hidden>{isOpen ? '\u25BC' : '\u25B6'}</span>
                      {label} ({sectionBids.length})
                    </button>
                    {isOpen ? (
                      <span style={{ position: 'relative', display: 'inline-flex' }}>
                        <button
                          type="button"
                          onClick={onOpenLostSummary}
                          aria-label={
                            lostBidsMissingLossReasonCount > 0
                              ? `Open bid tabs summary for lost bids; ${lostBidsMissingLossReasonCount} lost without a recorded reason for loss`
                              : 'Open bid tabs summary for lost bids'
                          }
                          title={
                            lostBidsMissingLossReasonCount > 0
                              ? `Open bid tabs summary for lost bids (${lostBidsMissingLossReasonCount} missing reason for loss)`
                              : 'Open bid tabs summary for lost bids'
                          }
                          style={{
                            padding: '0.35rem 0.75rem',
                            fontSize: '0.8125rem',
                            borderRadius: 4,
                            border: '1px solid #d1d5db',
                            background: '#fff',
                            cursor: 'pointer',
                            color: '#374151',
                          }}
                        >
                          Bid Tabs on Lost
                        </button>
                        {lostBidsMissingLossReasonCount > 0 ? (
                          <span
                            aria-hidden
                            style={{
                              position: 'absolute',
                              top: -4,
                              right: -4,
                              minWidth: '0.875rem',
                              height: '0.875rem',
                              padding: lostBidsMissingLossReasonCount > 9 ? '0 3px' : 0,
                              borderRadius: 999,
                              background: '#f59e0b',
                              color: '#fff',
                              fontSize: '0.5625rem',
                              fontWeight: 700,
                              lineHeight: '0.875rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              pointerEvents: 'none',
                              boxSizing: 'content-box',
                            }}
                          >
                            {lostBidsMissingLossReasonCount > 99 ? '99+' : lostBidsMissingLossReasonCount}
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleBidBoardSection(key)}
                    aria-expanded={isOpen}
                    style={{
                      margin: 0,
                      fontSize: '1rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: 0,
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      color: 'inherit',
                    }}
                  >
                    <span aria-hidden>{isOpen ? '\u25BC' : '\u25B6'}</span>
                    {label} ({sectionBids.length})
                  </button>
                )}
                {isOpen && (
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'auto', marginTop: '0.25rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200 }}>
                      {bidBoardTableHead}
                      <tbody>
                        {sectionBids.length === 0 ? (
                          <tr>
                            <td colSpan={14} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                              No bids in this group
                            </td>
                          </tr>
                        ) : (
                          sectionBids.map((bid) => renderBidBoardTableRow(bid))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
          <BidBoardLostSummaryModal
            open={lostSummaryModalOpen}
            onClose={onCloseLostSummary}
            initialStaffTabUserId={lostSummaryInitialStaffTab}
            lostBids={bidBoardBuckets.lost}
            ledgerPrefixMap={ledgerPrefixMap}
            showLaborColumn={showLostModalLabor}
            onSaveLossReason={onSaveLossReason}
            onOpenBid={(bid) => {
              onCloseLostSummary()
              onEditBid(bid)
            }}
            onPreviewBid={(bid) => {
              onCloseLostSummary()
              bidPreview?.openBidPreviewFromBid(bid)
            }}
          />
          {authUser?.id ? (
            <BidWorkingBoardArchivedModal
              open={workingBoardArchivedModalOpen}
              onClose={() => setWorkingBoardArchivedModalOpen(false)}
              userId={authUser.id}
              archivedBids={workingBoardArchivedBids}
              orgWideColumnLabels={isDev}
              onUnarchived={() => { onReloadBids() }}
              onOpenPreviewBid={(bid) => {
                bidPreview?.openBidPreviewFromBid(bid)
              }}
            />
          ) : null}
          <BidBoardEstimatingHealthSection
            staffOutcomeByRole={bidBoardStaffOutcomeByRole}
            weeklySentSummaries={bidBoardWeeklySentSummaries}
            filteredBids={filteredBidsForBidBoard}
            isDev={isDev}
            ledgerPrefixMap={ledgerPrefixMap}
          />
        </div>
      )}
    </div>
  )
}
