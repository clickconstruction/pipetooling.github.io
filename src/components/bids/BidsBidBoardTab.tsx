import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { bidBoardJobLinkLabel, type BidBoardJobLink } from '../../lib/bids/bidBoardJobLinks'
import { perGcSentSummary, type GcPacket } from '../../lib/bids/gcPackets'
import { BidBoardGcLines, gcRowsWorthShowing } from './BidBoardGcRows'
import type { BidRoomStateSummary } from '../../lib/bids/bidRoomState'
import type { Bid } from '../../types/bids'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import type { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import type { useBidPreview } from '../../contexts/BidPreviewModalContext'
import { resolveBidLedgerPrefix, formatBidLedgerNumberLabel, bidNumberMatchesQuery } from '../../lib/ledgerDisplayPrefixes'
import { compareBidsForBidBoardDueDate, compareBidsForBidBoardPendingRecency } from '../../lib/compareBidsForBidBoardDueDate'
import { shouldShowEmptyBidValueAlert } from '../../lib/bidBoardEmptyBidValueAlert'
import { robotBidReadiness } from '../../lib/bids/robotBidReadiness'
import { referenceGrade } from '../../lib/bids/referenceGrade'
import { GRADE_COLORS } from './RobotReferenceGradeModal'
import { fetchBidBoardNotesUnreadCounts } from '../../lib/bidBoardNotesUnreadCounts'
import { upsertBidNotesReadWatermark } from '../../lib/userBidNotesReadState'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { formatAddressWithoutZip } from '../../lib/bids/bidContactInfo'
import { bidDisplayName, formatBidValueShort, formatCompactCurrency } from '../../lib/bids/bidFormatting'
import { formatBidDueTime } from '../../lib/bids/formatBidDueTime'
import { bidBoardDueCellParts, bidBoardLastContactParts, DUE_SOON_WINDOW_DAYS, type BidBoardDateCellParts } from '../../lib/bids/bidBoardDateCells'
import { useNarrowViewport660 } from '../../hooks/useNarrowViewport660'
import { getSubmissionSectionKey, type SubmissionSectionKey } from '../../lib/bids/submissionSections'
import { buildBidBoardWeeklySentSummaries } from '../../lib/bidBoardWeeklySentStats'
import { BidBoardNotesPanel, type BidBoardNotesTab } from './BidBoardNotesPanel'
import { BidBoardLostSummaryModal } from './BidBoardLostSummaryModal'
import { isBidLossCategoryKey, type BidLossCategoryKey } from '../../lib/bidLossCategories'
import type { BidGcRecipientsMap } from '../../lib/bids/bidGcRecipients'
import { BidWorkingBoardArchivedModal } from './BidWorkingBoardArchivedModal'
import { BidBoardCustomerReviewModal } from './BidBoardCustomerReviewModal'
import { BidBoardEstimatingHealthSection } from './BidBoardEstimatingHealthSection'
import { BidBoardSelfHighlightWheel, useBidBoardSelfHighlight } from './BidBoardSelfHighlightWheel'

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
  /** v2.2741: jobs made from this bid's signed proposal (only passed for roles that can open Jobs). */
  jobsByBidId?: Map<string, BidBoardJobLink>
  ledgerPrefixMap: ReturnType<typeof useLedgerPrefixMap>
  bidPreview: ReturnType<typeof useBidPreview> | null
  sectionOpen: BidBoardSectionOpenState
  onSectionOpenChange: React.Dispatch<React.SetStateAction<BidBoardSectionOpenState>>
  deepLinkHighlightId: string | null
  deepLinkHighlightGen: number
  onEditBid: (bid: BidWithBuilder, opts?: { focus?: 'projectName' | 'gcBuilder' | 'bidValue' }) => void
  onOpenGcBuilderOrCustomer: (bid: BidWithBuilder) => void
  onLastContactClick: (bid: BidWithBuilder) => void
  onOpenBidTab: (bid: BidWithBuilder, tab: BidBoardJumpTabKey) => void
  /** Superintendents have no Pricing / Cover Letter tabs — hide those jumps too. */
  canSeePricingTabs: boolean
  onError: (msg: string | null) => void
  onReloadBids: () => void
  onReloadCustomerContacts: () => void
  lostSummaryModalOpen: boolean
  lostSummaryInitialStaffTab: string | null
  onOpenLostSummary: () => void
  onCloseLostSummary: () => void
  showLostModalLabor: boolean
  onSaveLossReason: (bidId: string, lossReason: string, lossCategory: BidLossCategoryKey | null) => Promise<void>
  workingBoardArchivedBids: BidWithBuilder[]
  /** bid_id → other GCs the bid went to (renders the +N chip on the GC cell). */
  recipientsByBidId: BidGcRecipientsMap
  /** Bids by GC: per-bid GC packets (loaded once in Bids.tsx). */
  gcPacketsByBid: Record<string, GcPacket[]>
  roomStatesByBid?: Record<string, Record<string, BidRoomStateSummary>>
  /** Per-GC note counts (v2.2217): `${bidId}:${gcCustomerId}` → n. */
  gcNoteCounts?: Record<string, number>
  /** Robot readiness icon (v2.2530) — human board only; omit on the Robot Board. */
  robotReadiness?: {
    /** source bid id → its digital-twin copy (bids.twin_source_bid_id pairing). */
    twinBidBySourceId: ReadonlyMap<string, BidWithBuilder>
    onOpenReadiness: (bid: BidWithBuilder) => void
    onOpenTwinBid: (twin: BidWithBuilder, source: BidWithBuilder) => void
    /** v2.2542: yellow click requests a robot bid (green); green click withdraws. */
    onToggleRequest: (bid: BidWithBuilder) => void
    /** v2.2547: decided rows show the reference grade instead of readiness. */
    referencePresence: ReadonlyMap<string, { hasCounts: boolean; hasPricing: boolean }>
    onOpenGrade: (bid: BidWithBuilder) => void
  }
}

const BID_BOARD_UNSENT_SECTION_LABEL = 'Unsent / Working Bids'

const BID_BOARD_SECTION_CONFIG = [
  { key: 'unsent' as const, label: BID_BOARD_UNSENT_SECTION_LABEL, jumpLabel: 'Unsent' },
  { key: 'pending' as const, label: 'Not yet won or lost', jumpLabel: 'Pending' },
  { key: 'won' as const, label: 'Won', jumpLabel: 'Won' },
  { key: 'startedOrComplete' as const, label: 'Started or Complete', jumpLabel: 'Started' },
  { key: 'lost' as const, label: 'Lost', jumpLabel: 'Lost' },
] as const

/** Big sections render only this many rows until "Show all N" is clicked. */
const BID_BOARD_SECTION_ROW_CAP = 25
type CappedSectionKey = 'pending' | 'lost'
const BID_BOARD_CAPPED_SECTIONS: readonly CappedSectionKey[] = ['pending', 'lost']

function isCappedSectionKey(key: SubmissionSectionKey): key is CappedSectionKey {
  return (BID_BOARD_CAPPED_SECTIONS as readonly string[]).includes(key)
}

/** The workflow tabs a board row can jump straight into (v2.2360). */
export type BidBoardJumpTabKey = 'counts' | 'takeoffs' | 'labor' | 'pricing' | 'cover-letter'

/** Font Awesome 640-viewbox paths reused across the table and phone cards. */
const BID_BOARD_ICON_PATHS = {
  /** v2.2741: briefcase — the job made from this bid. */
  job: 'M10 4h4a2 2 0 0 1 2 2v1h3a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a1 1 0 0 1 1-1h3V6a2 2 0 0 1 2-2zm0 3h4V6h-4v1zM6 9v3h12V9H6zm0 5v4h12v-4h-5v1H11v-1H6z',
  takeoffs: 'M64 192 L64 448 L576 448 L576 192 L492 192 L492 288 L452 288 L452 192 L368 192 L368 288 L328 288 L328 192 L244 192 L244 288 L204 288 L204 192 L148 192 L148 288 L108 288 L108 192 Z',
  labor: 'M320 96 C302.3 96 288 110.3 288 128 L288 134.7 C215.4 149.5 160 213.9 160 291.2 L160 352 L128 352 C110.3 352 96 366.3 96 384 C96 401.7 110.3 416 128 416 L512 416 C529.7 416 544 401.7 544 384 C544 366.3 529.7 352 512 352 L480 352 L480 291.2 C480 213.9 424.6 149.5 352 134.7 L352 128 C352 110.3 337.7 96 320 96 Z M96 448 L544 448 L544 480 C544 497.7 529.7 512 512 512 L128 512 C110.3 512 96 497.7 96 480 Z',
  pricing: 'M96 64 L272 64 C284.7 64 296.9 69.1 305.9 78.1 L545.9 318.1 C564.6 336.8 564.6 367.2 545.9 385.9 L407.8 524 C389.1 542.7 358.7 542.7 340 524 L100 284 C91 275 85.9 262.8 85.9 250.1 L85.9 112 C85.9 85.5 107.4 64 133.9 64 Z M256 200 A48 48 0 1 0 160 200 A48 48 0 1 0 256 200 Z',
  coverLetter: 'M64 208 L320 368 L576 208 L576 448 C576 465.7 561.7 480 544 480 L96 480 C78.3 480 64 465.7 64 448 Z M64 160 C64 142.3 78.3 128 96 128 L544 128 C561.7 128 576 142.3 576 160 L576 169.5 L320 320 L64 169.5 Z',
  folder: 'M129.5 464L179.5 304L558.9 304L508.9 464L129.5 464zM320.2 512L509 512C530 512 548.6 498.4 554.8 478.3L604.8 318.3C614.5 287.4 591.4 256 559 256L179.6 256C158.6 256 140 269.6 133.8 289.7L112.2 358.4L112.2 160C112.2 151.2 119.4 144 128.2 144L266.9 144C270.4 144 273.7 145.1 276.5 147.2L314.9 176C328.7 186.4 345.6 192 362.9 192L480.2 192C489 192 496.2 199.2 496.2 208L544.2 208C544.2 172.7 515.5 144 480.2 144L362.9 144C356 144 349.2 141.8 343.7 137.6L305.3 108.8C294.2 100.5 280.8 96 266.9 96L128.2 96C92.9 96 64.2 124.7 64.2 160L64.2 448C64.2 483.3 92.9 512 128.2 512L320.2 512z',
  plans: 'M304 112L192 112C183.2 112 176 119.2 176 128L176 512C176 520.8 183.2 528 192 528L448 528C456.8 528 464 520.8 464 512L464 272L376 272C336.2 272 304 239.8 304 200L304 112zM444.1 224L352 131.9L352 200C352 213.3 362.7 224 376 224L444.1 224zM128 128C128 92.7 156.7 64 192 64L325.5 64C342.5 64 358.8 70.7 370.8 82.7L493.3 205.3C505.3 217.3 512 233.6 512 250.6L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 128zM387.4 496L252.6 496C236.8 496 224 483.2 224 467.4C224 461 226.1 454.9 230 449.8L297.6 362.9C303 356 311.3 352 320 352C328.7 352 337 356 342.4 362.9L410 449.9C413.9 454.9 416 461.1 416 467.5C416 483.3 403.2 496.1 387.4 496.1zM240 288C257.7 288 272 302.3 272 320C272 337.7 257.7 352 240 352C222.3 352 208 337.7 208 320C208 302.3 222.3 288 240 288z',
  countTool: 'M320 48C337.7 48 352 62.3 352 80L352 98.3C450.1 112.3 527.7 189.9 541.7 288L560 288C577.7 288 592 302.3 592 320C592 337.7 577.7 352 560 352L541.7 352C527.7 450.1 450.1 527.7 352 541.7L352 560C352 577.7 337.7 592 320 592C302.3 592 288 577.7 288 560L288 541.7C189.9 527.7 112.3 450.1 98.3 352L80 352C62.3 352 48 337.7 48 320C48 302.3 62.3 288 80 288L98.3 288C112.3 189.9 189.9 112.3 288 98.3L288 80C288 62.3 302.3 48 320 48zM163.2 352C175.9 414.7 225.3 464.1 288 476.8L288 464C288 446.3 302.3 432 320 432C337.7 432 352 446.3 352 464L352 476.8C414.7 464.1 464.1 414.7 476.8 352L464 352C446.3 352 432 337.7 432 320C432 302.3 446.3 288 464 288L476.8 288C464.1 225.3 414.7 175.9 352 163.2L352 176C352 193.7 337.7 208 320 208C302.3 208 288 193.7 288 176L288 163.2C225.3 175.9 175.9 225.3 163.2 288L176 288C193.7 288 208 302.3 208 320C208 337.7 193.7 352 176 352L163.2 352zM320 272C346.5 272 368 293.5 368 320C368 346.5 346.5 368 320 368C293.5 368 272 346.5 272 320C272 293.5 293.5 272 320 272z',
  bidSend: 'M240 112L128 112C119.2 112 112 119.2 112 128L112 512C112 520.8 119.2 528 128 528L208 528L208 576L128 576C92.7 576 64 547.3 64 512L64 128C64 92.7 92.7 64 128 64L261.5 64C278.5 64 294.8 70.7 306.8 82.7L429.3 205.3C441.3 217.3 448 233.6 448 250.6L448 400.1L400 400.1L400 272.1L312 272.1C272.2 272.1 240 239.9 240 200.1L240 112.1zM380.1 224L288 131.9L288 200C288 213.3 298.7 224 312 224L380.1 224zM272 444L304 444C337.1 444 364 470.9 364 504C364 537.1 337.1 564 304 564L292 564L292 592C292 603 283 612 272 612C261 612 252 603 252 592L252 464C252 453 261 444 272 444zM304 524C315 524 324 515 324 504C324 493 315 484 304 484L292 484L292 524L304 524zM400 444L432 444C460.7 444 484 467.3 484 496L484 560C484 588.7 460.7 612 432 612L400 612C389 612 380 603 380 592L380 464C380 453 389 444 400 444zM432 572C438.6 572 444 566.6 444 560L444 496C444 489.4 438.6 484 432 484L420 484L420 572L432 572zM508 464C508 453 517 444 528 444L576 444C587 444 596 453 596 464C596 475 587 484 576 484L548 484L548 508L576 508C587 508 596 517 596 528C596 539 587 548 576 548L548 548L548 592C548 603 539 612 528 612C517 612 508 603 508 592L508 464z',
  counts: 'M348 62.7C330.7 52.7 309.3 52.7 292 62.7L207.8 111.3C190.5 121.3 179.8 139.8 179.8 159.8L179.8 261.7L91.5 312.7C74.2 322.7 63.5 341.2 63.5 361.2L63.5 458.5C63.5 478.5 74.2 497 91.5 507L175.8 555.6C193.1 565.6 214.5 565.6 231.8 555.6L320.1 504.6L408.4 555.6C425.7 565.6 447.1 565.6 464.4 555.6L548.5 507C565.8 497 576.5 478.5 576.5 458.5L576.5 361.2C576.5 341.2 565.8 322.7 548.5 312.7L460.2 261.7L460.2 159.8C460.2 139.8 449.5 121.3 432.2 111.3L348 62.7zM296 356.6L296 463.1L207.7 514.1C206.5 514.8 205.1 515.2 203.7 515.2L203.7 409.9L296 356.6zM527.4 357.2C528.1 358.4 528.5 359.8 528.5 361.2L528.5 458.5C528.5 461.4 527 464 524.5 465.4L440.2 514C439 514.7 437.6 515.1 436.2 515.1L436.2 409.8L527.4 357.2zM412.3 159.8L412.3 261.7L320 315L320 208.5L411.2 155.9C411.9 157.1 412.3 158.5 412.3 159.9z',
  gear: 'M259.1 73.5C262.1 58.7 275.2 48 290.4 48L350.2 48C365.4 48 378.5 58.7 381.5 73.5L396 143.5C410.1 149.5 423.3 157.2 435.3 166.3L503.1 143.8C517.5 139 533.3 145 540.9 158.2L570.8 210C578.4 223.2 575.7 239.8 564.3 249.9L511 297.3C511.9 304.7 512.3 312.3 512.3 320C512.3 327.7 511.8 335.3 511 342.7L564.4 390.2C575.8 400.3 578.4 417 570.9 430.1L541 481.9C533.4 495 517.6 501.1 503.2 496.3L435.4 473.8C423.3 482.9 410.1 490.5 396.1 496.6L381.7 566.5C378.6 581.4 365.5 592 350.4 592L290.6 592C275.4 592 262.3 581.3 259.3 566.5L244.9 496.6C230.8 490.6 217.7 482.9 205.6 473.8L137.5 496.3C123.1 501.1 107.3 495.1 99.7 481.9L69.8 430.1C62.2 416.9 64.9 400.3 76.3 390.2L129.7 342.7C128.8 335.3 128.4 327.7 128.4 320C128.4 312.3 128.9 304.7 129.7 297.3L76.3 249.8C64.9 239.7 62.3 223 69.8 209.9L99.7 158.1C107.3 144.9 123.1 138.9 137.5 143.7L205.3 166.2C217.4 157.1 230.6 149.5 244.6 143.4L259.1 73.5zM320.3 400C364.5 399.8 400.2 363.9 400 319.7C399.8 275.5 363.9 239.8 319.7 240C275.5 240.2 239.8 276.1 240 320.3C240.2 364.5 276.1 400.2 320.3 400z',
  robot: 'M320 64c13 0 24 11 24 24v40h120c40 0 72 32 72 72v192c0 40-32 72-72 72H176c-40 0-72-32-72-72V200c0-40 32-72 72-72h120V88c0-13 11-24 24-24zM48 296c0-18 14-32 32-32v160c-18 0-32-14-32-32v-96zm544-32c18 0 32 14 32 32v96c0 18-14 32-32 32V264zM224 232a40 40 0 100 80 40 40 0 000-80zm192 0a40 40 0 100 80 40 40 0 000-80zM232 400h176c13 0 24 11 24 24s-11 24-24 24H232c-13 0-24-11-24-24s11-24 24-24z',
} as const

/** One jump icon per workflow tab, in tab-strip order — the cluster doubles as
    a mini map of the flow. RFI/CO/Lien stay off the board to keep rows calm. */
const BID_BOARD_JUMP_TABS: Array<{ tab: BidBoardJumpTabKey; icon: keyof typeof BID_BOARD_ICON_PATHS; label: string }> = [
  { tab: 'counts', icon: 'counts', label: 'Open in Counts' },
  { tab: 'takeoffs', icon: 'takeoffs', label: 'Open in Takeoffs' },
  { tab: 'labor', icon: 'labor', label: 'Open in Labor' },
  { tab: 'pricing', icon: 'pricing', label: 'Open in Pricing' },
  { tab: 'cover-letter', icon: 'coverLetter', label: 'Open in Cover Letter' },
]

function BidBoardIcon({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={size} height={size} fill="currentColor" aria-hidden>
      <path d={d} />
    </svg>
  )
}

function bidAddressMapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

const BID_BOARD_DUE_CHIP_COLORS = {
  overdue: { background: 'var(--bg-red-100)', color: 'var(--text-red-700)', border: '#fecaca' },
  soon: { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', border: 'var(--border-amber-soft)' },
  normal: { background: 'var(--bg-muted)', color: 'var(--text-700)', border: 'var(--border)' },
} as const

export function BidsBidBoardTab({
  bids,
  authUser,
  isDev,
  jobsByBidId,
  ledgerPrefixMap,
  bidPreview,
  sectionOpen,
  onSectionOpenChange,
  deepLinkHighlightId,
  deepLinkHighlightGen,
  onEditBid,
  onOpenGcBuilderOrCustomer,
  onLastContactClick,
  onOpenBidTab,
  canSeePricingTabs,
  onError,
  onReloadBids,
  onReloadCustomerContacts,
  lostSummaryModalOpen,
  lostSummaryInitialStaffTab,
  onOpenLostSummary,
  onCloseLostSummary,
  showLostModalLabor,
  onSaveLossReason,
  workingBoardArchivedBids,
  recipientsByBidId,
  gcPacketsByBid,
  roomStatesByBid,
  gcNoteCounts,
  robotReadiness,
}: BidsBidBoardTabProps) {
  // How the viewer's OWN name is boxed on the board (per-account, per-theme —
  // picked via the color wheel on the Health line, v2.1710).
  const {
    pref: selfHighlightPref,
    savePref: saveSelfHighlightPref,
    previewName: selfHighlightPreviewName,
    selfHighlightStyle,
  } = useBidBoardSelfHighlight(authUser?.id)
  const [bidBoardSearchQuery, setBidBoardSearchQuery] = useState('')
  const [expandedBidBoardBidId, setExpandedBidBoardBidId] = useState<string | null>(null)
  // Bids by GC (v2.2162): per-GC packets for every bid on the board → the GC lines under a row.
  const [bidBoardNotesTab, setBidBoardNotesTab] = useState<BidBoardNotesTab>('all')
  const [bidBoardNotesUnreadByBidId, setBidBoardNotesUnreadByBidId] = useState<Record<string, number>>({})
  const [workingBoardArchivedModalOpen, setWorkingBoardArchivedModalOpen] = useState(false)
  const [customerReviewOpen, setCustomerReviewOpen] = useState(false)
  const narrowViewport = useNarrowViewport660()
  const [sectionShowAll, setSectionShowAll] = useState<Record<CappedSectionKey, boolean>>({
    pending: false,
    lost: false,
  })
  const [dueLegendOpen, setDueLegendOpen] = useState(false)
  const bidBoardUnreadFetchSeqRef = useRef(0)
  const bidsForBoardUnreadRef = useRef(bids)
  bidsForBoardUnreadRef.current = bids

  const filteredBidsForBidBoard = bidBoardSearchQuery.trim()
    ? bids.filter(
        (b) =>
          (b.project_name?.toLowerCase().includes(bidBoardSearchQuery.toLowerCase()) ?? false) ||
          bidNumberMatchesQuery(b as { bid_number?: string | null; service_type_id?: string | null }, bidBoardSearchQuery, ledgerPrefixMap) ||
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
    // Pending reads newest-first (most recently sent on top, bid_due_date
    // fallback) — the awaiting-an-answer list, not a due-date worklist (v2.1760).
    buckets.pending.sort(compareBidsForBidBoardPendingRecency)
    return buckets
  }, [filteredBidsForBidBoard])

  // "Missing" clears when either a structured category or free text exists (v2.1799),
  // matching the Lost summary's red-row rule and the Why we lost lens queue.
  const lostBidsMissingLossReasonCount = useMemo(() => {
    return bidBoardBuckets.lost.filter(
      (b) =>
        !((b as { loss_reason?: string | null }).loss_reason ?? '').trim() &&
        !isBidLossCategoryKey((b as { loss_category?: string | null }).loss_category ?? null),
    ).length
  }, [bidBoardBuckets.lost])

  const bidBoardWeeklySentSummaries = useMemo(
    () => buildBidBoardWeeklySentSummaries(filteredBidsForBidBoard),
    [filteredBidsForBidBoard]
  )

  function toggleBidBoardSection(key: 'unsent' | 'pending' | 'won' | 'startedOrComplete' | 'lost') {
    onSectionOpenChange((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function jumpToBidBoardSection(key: SubmissionSectionKey | 'health') {
    if (key !== 'health') {
      onSectionOpenChange((prev) => (prev[key] ? prev : { ...prev, [key]: true }))
    }
    const targetId = key === 'health' ? 'bid-board-health-section' : `bid-board-section-${key}`
    requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  // A deep-linked row past the render cap would have nothing to scroll to —
  // uncap its section before the highlight scroll (Bids.tsx) fires.
  useEffect(() => {
    if (!deepLinkHighlightId) return
    setSectionShowAll((prev) => {
      let next = prev
      for (const key of BID_BOARD_CAPPED_SECTIONS) {
        if (
          !next[key] &&
          bidBoardBuckets[key].findIndex((b) => b.id === deepLinkHighlightId) >= BID_BOARD_SECTION_ROW_CAP
        ) {
          next = { ...next, [key]: true }
        }
      }
      return next
    })
  }, [deepLinkHighlightId, bidBoardBuckets])

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

  function bidBoardTableHead(hideBidColumn: boolean) {
    const th: React.CSSProperties = {
      padding: '0.0625rem 0.3rem',
      textAlign: 'center',
      borderBottom: '1px solid var(--border)',
      fontSize: '0.6875rem',
      lineHeight: 1.25,
    }
    return (
      <thead style={{ background: 'var(--bg-subtle)' }}>
        <tr>
          <th style={{ ...th, whiteSpace: 'nowrap', textAlign: 'right', paddingRight: '0.4rem' }} title="Bid number — Counts on the left, Edit on the right" aria-label="Bid number with Counts and Edit actions">Bid #</th>
          <th style={{ ...th, textAlign: 'left', paddingLeft: '0.4rem' }} title="Project name and GC or builder" aria-label="Project name and GC or builder">Project Name<br />GC/Builder</th>
          {!hideBidColumn ? <th style={th}>Bid</th> : null}
          <th style={th}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              <span>Due<br />Date</span>
              <button
                type="button"
                onClick={() => setDueLegendOpen(true)}
                title="What do the due-date colors mean?"
                aria-label="What do the due-date colors mean?"
                style={{
                  padding: '0.15rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                {(['overdue', 'soon', 'normal'] as const).map((k) => (
                  <span
                    key={k}
                    aria-hidden
                    style={{
                      width: 14,
                      height: 5,
                      borderRadius: 2,
                      background: BID_BOARD_DUE_CHIP_COLORS[k].background,
                      border: `1px solid ${BID_BOARD_DUE_CHIP_COLORS[k].border}`,
                    }}
                  />
                ))}
              </button>
            </span>
          </th>
          <th style={th} title="Estimator, with the account manager underneath when it's someone else" aria-label="Estimator and account manager">Estimator<br />Account Man</th>
          <th style={th}>Last<br />Contact</th>
          <th style={th} title="Project folder, job plans, Count Tool, and bid submission links" aria-label="Artifact links">Links</th>
        </tr>
      </thead>
    )
  }

  function toggleBidBoardRowExpanded(bidId: string) {
    setExpandedBidBoardBidId((cur) => (cur === bidId ? null : bidId))
  }

  /** Row/card click-to-expand; ignores clicks on interactive descendants. */
  function handleBidBoardRowClick(e: React.MouseEvent, bidId: string) {
    if ((e.target as HTMLElement).closest('a, button, input, textarea, select, label')) return
    toggleBidBoardRowExpanded(bidId)
  }

  /** Robot readiness icon (v2.2530): 🤖 emoji when a twin bid exists (click jumps to it
      on the Robot Board), yellow glyph when a robot could bid this (click shows the
      kickoff prompt), grey glyph when required inputs are missing (click explains).
      One kernel (`robotBidReadiness`) decides state here AND fills the modal, so the
      row and the explanation can never disagree. */
  function renderRobotReadinessIcon(bid: BidWithBuilder, actionStyle: React.CSSProperties) {
    if (!robotReadiness) return null
    const twin = robotReadiness.twinBidBySourceId.get(bid.id)
    if (twin) {
      return (
        <button
          type="button"
          onClick={() => robotReadiness.onOpenTwinBid(twin, bid)}
          title={`Robot bid exists (b${twin.bid_number ?? '?'}) — see how it compares`}
          aria-label={`Robot bid exists for ${bid.project_name ?? 'bid'} — see how it compares`}
          style={{ ...actionStyle, fontSize: '0.9375rem', lineHeight: 1 }}
        >
          {'\u{1F916}'}
        </button>
      )
    }
    // v2.2547: a decided bid is a REFERENCE — the icon answers "can a robot learn
    // from this?" (grade badge) instead of "can a robot bid this?".
    if (bid.outcome) {
      const presence = robotReadiness.referencePresence.get(bid.id)
      const grade = referenceGrade({
        hasPlans: !!bid.plans_link?.trim(),
        hasValue: bid.bid_value != null && Number(bid.bid_value) > 0,
        hasCounts: presence?.hasCounts ?? false,
        hasPricing: presence?.hasPricing ?? false,
      })
      const color = GRADE_COLORS[grade]
      return (
        <button
          type="button"
          onClick={() => robotReadiness.onOpenGrade(bid)}
          title={`Reference grade ${grade} — how much can a robot learn from this record? Click for details.`}
          aria-label={`Reference grade ${grade} — ${bid.project_name ?? 'bid'}`}
          style={{ ...actionStyle, color, position: 'relative' }}
        >
          <BidBoardIcon d={BID_BOARD_ICON_PATHS.robot} size={18} />
          <span
            aria-hidden
            style={{
              position: 'absolute',
              right: -1,
              bottom: -1,
              fontSize: '0.5625rem',
              fontWeight: 800,
              lineHeight: 1,
              padding: '1px 3px',
              borderRadius: 3,
              color: 'white',
              background: color,
              fontFamily: 'ui-monospace, monospace',
            }}
          >
            {grade}
          </span>
        </button>
      )
    }
    const ready = robotBidReadiness(bid).state === 'ready'
    // v2.2542: the prompt modal left the board — yellow requests (green), green withdraws.
    const requested = ready && !!bid.robot_requested_at
    const title = requested
      ? `Robot bid requested ${new Date(bid.robot_requested_at!).toLocaleDateString()} — click to withdraw`
      : ready
        ? 'Ready for a robot — click to request a robot bid'
        : 'A robot can’t bid this yet — see why'
    return (
      <button
        type="button"
        onClick={() => (ready ? robotReadiness.onToggleRequest(bid) : robotReadiness.onOpenReadiness(bid))}
        title={title}
        aria-label={`${requested ? 'Robot bid requested' : ready ? 'Robot-ready' : 'Not robot-ready'} — ${bid.project_name ?? 'bid'}`}
        style={{ ...actionStyle, color: requested ? '#16a34a' : ready ? '#eab308' : 'var(--border-strong)' }}
      >
        <BidBoardIcon d={BID_BOARD_ICON_PATHS.robot} size={18} />
      </button>
    )
  }

  /** Counts button · bid number (+ unread-notes badge) · Edit gear. */
  function renderBidBoardBidNumberCluster(bid: BidWithBuilder) {
    const notesUnreadRaw = bidBoardNotesUnreadByBidId[bid.id] ?? 0
    const badgeText = notesUnreadRaw > 9 ? '9+' : notesUnreadRaw > 0 ? String(notesUnreadRaw) : null
    const actionStyle: React.CSSProperties = {
      padding: 0,
      width: '1.75rem',
      height: '1.75rem',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--text-muted)',
      borderRadius: 6,
    }
    const num = (bid as { bid_number?: string | null }).bid_number?.trim()
    const pref = resolveBidLedgerPrefix((bid as Bid).service_type_id, ledgerPrefixMap)
    const label = num ? formatBidLedgerNumberLabel(pref, num) : null
    let numberNode: React.ReactNode = '-'
    if (num) {
      // A lone "5" reads as a count; a lowercase "b" marks it as a bid number
      // without the full trade prefix (the trade is already chosen above the
      // board). The prefixed label still carries the tooltip/aria text.
      const marked = (
        <>
          <span style={{ fontSize: '0.75em', fontWeight: 600 }}>b</span>
          {num}
        </>
      )
      numberNode = !bidPreview ? (
        <span title={label ?? undefined}>{marked}</span>
      ) : (
        <button
          type="button"
          onClick={() => bidPreview.openBidPreviewFromBid(bid)}
          title={`Preview bid ${label}`}
          aria-label={`Preview bid ${label}`}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            color: 'var(--text-blue-500)',
            cursor: 'pointer',
            textDecoration: 'underline',
            font: 'inherit',
          }}
        >
          {marked}
        </button>
      )
    }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem', whiteSpace: 'nowrap' }}>
        {badgeText != null ? (
          <span
            title={`${notesUnreadRaw} unread note${notesUnreadRaw === 1 ? '' : 's'}`}
            aria-label={`${notesUnreadRaw} unread note${notesUnreadRaw === 1 ? '' : 's'}`}
            style={{
              minWidth: '0.9375rem',
              height: '0.9375rem',
              padding: notesUnreadRaw > 9 ? '0 3px' : 0,
              borderRadius: 999,
              background: '#ef4444',
              color: '#fff',
              fontSize: '0.5625rem',
              fontWeight: 700,
              lineHeight: '0.9375rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxSizing: 'content-box',
              marginRight: '0.1rem',
            }}
          >
            {badgeText}
          </span>
        ) : null}
        {BID_BOARD_JUMP_TABS.filter((j) => canSeePricingTabs || (j.tab !== 'pricing' && j.tab !== 'cover-letter')).map((j) => (
          <button
            key={j.tab}
            type="button"
            onClick={() => onOpenBidTab(bid, j.tab)}
            title={j.label}
            aria-label={`${j.label} — ${bid.project_name ?? 'bid'}`}
            style={actionStyle}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#3b82f6' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            <BidBoardIcon d={BID_BOARD_ICON_PATHS[j.icon]} size={18} />
          </button>
        ))}
        {robotReadiness ? renderRobotReadinessIcon(bid, actionStyle) : null}
        {numberNode}
        <button
          type="button"
          onClick={() => onEditBid(bid)}
          title="Edit bid"
          aria-label="Edit bid"
          style={actionStyle}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#3b82f6' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}
        >
          <BidBoardIcon d={BID_BOARD_ICON_PATHS.gear} />
        </button>
      </span>
    )
  }

  /** Only the artifact links that exist, as an icon cluster ('—' when none). */
  function renderBidBoardLinksCluster(bid: BidWithBuilder) {
    const links: Array<{ href: string; title: string; d: string }> = []
    if (bid.drive_link) links.push({ href: bid.drive_link, title: 'Project folder', d: BID_BOARD_ICON_PATHS.folder })
    if (bid.plans_link) links.push({ href: bid.plans_link, title: 'Job plans', d: BID_BOARD_ICON_PATHS.plans })
    if (bid.count_tooling_plans_link) links.push({ href: bid.count_tooling_plans_link, title: 'CountTooling plans', d: BID_BOARD_ICON_PATHS.countTool })
    if (bid.bid_submission_link) links.push({ href: bid.bid_submission_link, title: 'Bid submission', d: BID_BOARD_ICON_PATHS.bidSend })
    const job = jobsByBidId?.get(bid.id) ?? null
    if (links.length === 0 && !job) return <span style={{ color: 'var(--text-muted)' }}>—</span>
    return (
      <span style={{ display: 'inline-flex', gap: '0.45rem', alignItems: 'center', justifyContent: 'center' }}>
        {job ? (
          <Link
            to={`/jobs?edit=${job.jobId}`}
            title={`Open job ${bidBoardJobLinkLabel(job.hcpNumber)} — made from this bid's signed proposal`}
            aria-label={`Open job ${bidBoardJobLinkLabel(job.hcpNumber)}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.1rem 0.45rem 0.1rem 0.35rem',
              borderRadius: 9999,
              border: '1px solid var(--border-green)',
              background: 'var(--bg-green-tint)',
              color: 'var(--text-green-700)',
              fontSize: '0.72rem',
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '0.01em',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              lineHeight: 1.3,
            }}
          >
            <BidBoardIcon d={BID_BOARD_ICON_PATHS.job} size={13} />
            {bidBoardJobLinkLabel(job.hcpNumber)}
          </Link>
        ) : null}
        {links.map((l) => (
          <a
            key={l.title}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            title={l.title}
            aria-label={l.title}
            onClick={(e) => { e.preventDefault(); openInExternalBrowser(l.href) }}
            style={{ color: 'var(--text-blue-500)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <BidBoardIcon d={l.d} />
          </a>
        ))}
      </span>
    )
  }

  /** Weekday+date on top, signed day count below — (+4) days after, (-2) until.
      Sent bids render quiet (gray chip); decided bids also drop the day count. */
  /** "sent 1/2" pill on multi-GC bids (v2.2411): the per-GC roll-up at a glance —
      amber while a GC's letter is still out, green ✓ once every packet went. */
  function renderGcSentBadge(bidId: string) {
    const s = perGcSentSummary(gcPacketsByBid[bidId])
    if (!s) return null
    const remaining = s.total - s.sent
    return (
      <span
        title={s.complete ? "Every GC's letter is out" : `${remaining} of ${s.total} GC letter${s.total === 1 ? '' : 's'} not sent yet`}
        style={{
          fontSize: '0.6875rem',
          fontWeight: 700,
          padding: '0.05rem 0.4rem',
          borderRadius: 999,
          whiteSpace: 'nowrap',
          fontVariantNumeric: 'tabular-nums',
          background: s.complete ? 'var(--bg-green-tint)' : 'var(--bg-amber-tint)',
          color: s.complete ? 'var(--text-green-700)' : 'var(--text-amber-700)',
        }}
      >
        sent {s.sent}/{s.total}{s.complete ? ' ✓' : ''}
      </span>
    )
  }

  function renderBidBoardDueChip(bid: BidWithBuilder, inline = false) {
    const parts = bidBoardDueCellParts(bid.bid_due_date, new Date(), bid.outcome, bid.bid_date_sent)
    if (!parts) return <span style={{ color: 'var(--text-muted)' }}>—</span>
    const colors = BID_BOARD_DUE_CHIP_COLORS[parts.urgency]
    return (
      <span
        style={{
          display: 'inline-flex',
          flexDirection: inline ? 'row' : 'column',
          alignItems: 'center',
          gap: inline ? '0.3rem' : 0,
          padding: '0.15rem 0.55rem',
          borderRadius: inline ? 999 : 10,
          fontSize: '0.6875rem',
          fontWeight: 700,
          whiteSpace: 'nowrap',
          lineHeight: 1.2,
          fontVariantNumeric: 'tabular-nums',
          background: colors.background,
          color: colors.color,
          border: `1px solid ${colors.border}`,
        }}
      >
        <span>{parts.dateLabel}</span>
        {!parts.decided ? (
          <span style={{ fontSize: '0.625rem', fontWeight: 600, opacity: 0.85 }}>{parts.deltaLabel}</span>
        ) : null}
      </span>
    )
  }

  function renderBidBoardLastContact(bid: BidWithBuilder, parts: BidBoardDateCellParts | null) {
    return (
      <button
        type="button"
        onClick={() => onLastContactClick(bid)}
        title={parts ? 'Update last contact' : 'Log a contact'}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-blue-500)',
          cursor: 'pointer',
          padding: 0,
          textDecoration: 'none',
          font: 'inherit',
          lineHeight: 1.2,
        }}
      >
        {parts ? (
          <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
            <span>{parts.dateLabel}</span>
            <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>{parts.deltaLabel}</span>
          </span>
        ) : (
          '+'
        )}
      </button>
    )
  }

  function renderBidBoardBidValue(bid: BidWithBuilder) {
    return shouldShowEmptyBidValueAlert(bid) ? (
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
    )
  }

  /** Detail strip (address / due + time / bid / team) + the notes panel below it. */
  function renderBidBoardExpandedContent(bid: BidWithBuilder) {
    const due = bidBoardDueCellParts(bid.bid_due_date)
    const dueTime = formatBidDueTime(bid.bid_due_time)
    const estRaw = bid.estimator
    const estNorm = estRaw == null ? null : Array.isArray(estRaw) ? estRaw[0] ?? null : estRaw
    const labelStyle: React.CSSProperties = {
      display: 'block',
      fontSize: '0.625rem',
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: 'var(--text-muted)',
      marginBottom: '0.1rem',
    }
    return (
      <>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem 1.75rem',
            fontSize: '0.8125rem',
            textAlign: 'left',
            marginBottom: '0.85rem',
          }}
        >
          <div>
            <span style={labelStyle}>Project</span>
            {bid.project_name ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
          </div>
          <div>
            <span style={labelStyle}>GC/Builder</span>
            {bid.customers?.name ?? bid.bids_gc_builders?.name ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
          </div>
          <div>
            <span style={labelStyle}>Address</span>
            {bid.address ? (
              <a
                href={bidAddressMapsUrl(bid.address)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--text-blue-500)', textDecoration: 'none' }}
              >
                {formatAddressWithoutZip(bid.address)}
              </a>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>—</span>
            )}
          </div>
          <div>
            <span style={labelStyle}>Due</span>
            {due ? `${due.dateLabel}${dueTime ? ` · ${dueTime}` : ''}` : <span style={{ color: 'var(--text-muted)' }}>—</span>}
          </div>
          <div>
            <span style={labelStyle}>Bid</span>
            {bid.bid_value != null && Number(bid.bid_value) > 0 ? (
              formatCompactCurrency(Number(bid.bid_value))
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>not set yet</span>
            )}
          </div>
          <div>
            <span style={labelStyle}>Estimator</span>
            {estNorm ? estNorm.name || estNorm.email : <span style={{ color: 'var(--text-muted)' }}>—</span>}
          </div>
          <div>
            <span style={labelStyle}>Distance</span>
            {bid.distance_from_office != null && bid.distance_from_office !== '' ? (
              `${Number.isNaN(Number(bid.distance_from_office)) ? bid.distance_from_office : Math.round(Number(bid.distance_from_office))} mi`
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>—</span>
            )}
          </div>
        </div>
        <BidBoardNotesPanel
          bid={bid}
          notesTab={bidBoardNotesTab}
          onNotesTabChange={setBidBoardNotesTab}
          onLoadError={(m) => onError(m)}
          onMutated={() => { onReloadBids() }}
          onMutatedCustomer={() => { onReloadCustomerContacts(); onReloadBids() }}
          idPrefix="bid-board"
        />
      </>
    )
  }

  function renderBidBoardTableRow(bid: BidWithBuilder, hideBidColumn: boolean) {
    const expanded = expandedBidBoardBidId === bid.id
    const colCount = hideBidColumn ? 6 : 7
    const lcParts = bidBoardLastContactParts(bid.last_contact)
    return (
      <Fragment key={bid.id}>
        <tr
          id={`bid-board-row-${bid.id}`}
          data-deeplink-gen={bid.id === deepLinkHighlightId ? deepLinkHighlightGen : undefined}
          onClick={(e) => handleBidBoardRowClick(e, bid.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.target === e.currentTarget) toggleBidBoardRowExpanded(bid.id)
          }}
          tabIndex={0}
          aria-expanded={expanded}
          aria-controls={`bid-board-notes-${bid.id}`}
          style={{
            borderBottom: '1px solid var(--border)',
            cursor: 'pointer',
            ...(bid.id === deepLinkHighlightId
              ? {
                  backgroundColor: 'var(--bg-amber-tint)',
                  outline: '2px solid #d97706',
                  outlineOffset: -2,
                  transition: 'background-color 0.25s ease, outline-color 0.25s ease',
                }
              : {}),
          }}
        >
          <td style={{ padding: '0.0625rem 0.4rem 0.0625rem 0.15rem', textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
            {renderBidBoardBidNumberCluster(bid)}
          </td>
          <td
            style={{
              padding: '0.0625rem 0.0625rem 0.0625rem 0.4rem',
              maxWidth: 200,
              textAlign: 'left',
              fontSize: '0.8125rem',
              lineHeight: 1.4,
              verticalAlign: 'middle',
            }}
          >
            {/* One line each, ellipsized — the row dropdown carries the full text.
                maxWidth sits on this div, not the td: auto table layout ignores td max-width. */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem', maxWidth: gcRowsWorthShowing(gcPacketsByBid[bid.id]) ? 250 : 200, minWidth: 0 }}>
              <span
                title={bid.project_name ?? undefined}
                style={{ maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.9375rem', fontWeight: 600 }}
              >
                {bid.project_name ?? '-'}
              </span>
              {renderGcSentBadge(bid.id)}
              {gcRowsWorthShowing(gcPacketsByBid[bid.id]) ? (
                // Bids by GC (in-cell, v2.2183): one line per GC — name · sent · state pill — in place of the GC name.
                <div style={{ alignSelf: 'stretch', minWidth: 0 }}><BidBoardGcLines bidId={bid.id} bidLabel={bidDisplayName(bid)} bidOutcome={bid.outcome ?? null} packets={gcPacketsByBid[bid.id] ?? []} onChanged={onReloadBids} gcNoteCounts={gcNoteCounts} roomStates={roomStatesByBid?.[bid.id]} jobLink={jobsByBidId?.get(bid.id) ?? null} dense /></div>
              ) : (bid.customers || bid.bids_gc_builders) ? (
                <button
                  type="button"
                  onClick={() => onOpenGcBuilderOrCustomer(bid)}
                  title={bid.customers?.name ?? bid.bids_gc_builders?.name ?? undefined}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-blue-500)',
                    cursor: 'pointer',
                    padding: 0,
                    textDecoration: 'none',
                    font: 'inherit',
                    maxWidth: '100%',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    textAlign: 'left',
                  }}
                >
                  {bid.customers?.name ?? bid.bids_gc_builders?.name ?? '—'}
                </button>
              ) : (
                '-'
              )}
              {!gcRowsWorthShowing(gcPacketsByBid[bid.id]) && (recipientsByBidId[bid.id]?.length ?? 0) > 0 ? (
                <span
                  title={`Also sent to: ${recipientsByBidId[bid.id]!.map((r) => r.name).join(', ')}`}
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    padding: '0.05rem 0.4rem',
                    borderRadius: 999,
                    background: 'var(--bg-muted)',
                    color: 'var(--text-700)',
                  }}
                >
                  +{recipientsByBidId[bid.id]!.length} GC{recipientsByBidId[bid.id]!.length === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>
          </td>
          {!hideBidColumn ? (
            <td style={{ padding: '0.0625rem', textAlign: 'center', fontSize: '0.6875rem', lineHeight: 1.35 }}>
              {renderBidBoardBidValue(bid)}
            </td>
          ) : null}
          <td style={{ padding: '0.0625rem 0.2rem', textAlign: 'center', fontSize: '0.6875rem', lineHeight: 1.35 }}>
            {renderBidBoardDueChip(bid)}
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
              // One person wearing both hats prints once. Match on id when both
              // sides have one, else fall back to the displayed name. A missing
              // account manager prints nothing rather than a second em dash.
              const sameStaff = Boolean(
                amNorm && estNorm && (amNorm.id && estNorm.id ? amNorm.id === estNorm.id : amLine === estLine)
              )
              const showAmLine = Boolean(amNorm) && !sameStaff
              const selfLineStyle = {
                // Per-user, per-theme pick (color wheel on the Health line);
                // theme-aware default when the viewer never chose (v2.1710).
                ...selfHighlightStyle,
                padding: '0.125rem 0.35rem',
                borderRadius: 4,
                display: 'inline-block' as const,
                maxWidth: '100%',
                textAlign: 'center' as const,
                boxSizing: 'border-box' as const,
              }
              return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem' }}>
                  <span
                    title={isSelfEst ? 'You' : sameStaff ? 'Estimator and account manager' : 'Estimator'}
                    style={{ fontSize: '0.9375rem', fontWeight: 600, ...(isSelfEst ? selfLineStyle : {}) }}
                  >
                    {estLine}
                  </span>
                  {showAmLine ? (
                    <span
                      title={isSelfAm ? 'You' : 'Account manager'}
                      style={{ color: 'var(--text-muted)', ...(isSelfAm ? selfLineStyle : {}) }}
                    >
                      {amLine}
                    </span>
                  ) : null}
                </div>
              )
            })()}
          </td>
          <td style={{ padding: '0.0625rem', textAlign: 'center', fontSize: '0.6875rem', lineHeight: 1.35 }}>
            {renderBidBoardLastContact(bid, lcParts)}
          </td>
          <td style={{ padding: '0.0625rem 0.2rem', textAlign: 'center' }}>
            {renderBidBoardLinksCluster(bid)}
          </td>
        </tr>
        {bid.outcome === 'lost' ? (
          <tr
            aria-label={`Loss reason: ${(bid as { loss_reason?: string | null }).loss_reason?.trim() || 'not recorded'}`}
            style={{ background: 'var(--bg-subtle)' }}
          >
            <td
              colSpan={colCount}
              style={{
                padding: '0.5rem 1rem 0.5rem 2rem',
                borderTop: '1px solid var(--border)',
                borderBottom: expanded ? undefined : '1px solid #e5e7eb',
                verticalAlign: 'top',
                fontSize: '0.8125rem',
                lineHeight: 1.45,
                color: 'var(--text-700)',
                whiteSpace: 'normal',
                wordBreak: 'break-word',
              }}
            >
              <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>Why did we lose? </span>
              <span style={{ color: (bid as { loss_reason?: string | null }).loss_reason?.trim() ? '#374151' : '#9ca3af' }}>
                {(bid as { loss_reason?: string | null }).loss_reason?.trim() || '—'}
              </span>
            </td>
          </tr>
        ) : null}
        {expanded ? (
          <tr id={`bid-board-notes-${bid.id}`} style={{ background: 'var(--bg-subtle)' }}>
            <td colSpan={colCount} style={{ padding: '1rem', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
              {renderBidBoardExpandedContent(bid)}
            </td>
          </tr>
        ) : null}
      </Fragment>
    )
  }

  /** Phone (<660px) card row — same data, no horizontal scrolling. */
  function renderBidBoardCard(bid: BidWithBuilder) {
    const expanded = expandedBidBoardBidId === bid.id
    const lcParts = bidBoardLastContactParts(bid.last_contact)
    const lossReason = (bid as { loss_reason?: string | null }).loss_reason?.trim()
    const estRaw = bid.estimator
    const estNorm = estRaw == null ? null : Array.isArray(estRaw) ? estRaw[0] ?? null : estRaw
    const hasLinks = Boolean(bid.drive_link || bid.plans_link || bid.count_tooling_plans_link || bid.bid_submission_link)
    return (
      <div
        key={bid.id}
        id={`bid-board-row-${bid.id}`}
        data-deeplink-gen={bid.id === deepLinkHighlightId ? deepLinkHighlightGen : undefined}
        onClick={(e) => handleBidBoardRowClick(e, bid.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.target === e.currentTarget) toggleBidBoardRowExpanded(bid.id)
        }}
        tabIndex={0}
        role="button"
        aria-expanded={expanded}
        aria-controls={`bid-board-notes-${bid.id}`}
        style={{
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '0.5rem 0.6rem',
          background: 'var(--surface)',
          cursor: 'pointer',
          ...(bid.id === deepLinkHighlightId
            ? {
                backgroundColor: 'var(--bg-amber-tint)',
                outline: '2px solid #d97706',
                outlineOffset: -2,
                transition: 'background-color 0.25s ease, outline-color 0.25s ease',
              }
            : {}),
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {renderBidBoardBidNumberCluster(bid)}
          <span style={{ marginLeft: 'auto' }}>{renderBidBoardDueChip(bid, true)}</span>
        </div>
        <div
          style={{
            fontSize: '1.0625rem',
            fontWeight: 600,
            margin: '0.2rem 0 0.15rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {bid.project_name ?? '-'}
        </div>
        {renderGcSentBadge(bid.id)}
        {gcRowsWorthShowing(gcPacketsByBid[bid.id]) ? (
          <div style={{ margin: '0.1rem 0 0.25rem' }}>
            <BidBoardGcLines bidId={bid.id} bidLabel={bidDisplayName(bid)} bidOutcome={bid.outcome ?? null} packets={gcPacketsByBid[bid.id] ?? []} onChanged={onReloadBids} gcNoteCounts={gcNoteCounts} roomStates={roomStatesByBid?.[bid.id]} jobLink={jobsByBidId?.get(bid.id) ?? null} />
          </div>
        ) : null}
        <div
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.15rem 0.35rem',
          }}
        >
          {gcRowsWorthShowing(gcPacketsByBid[bid.id]) ? null : (bid.customers || bid.bids_gc_builders) ? (
            <button
              type="button"
              onClick={() => onOpenGcBuilderOrCustomer(bid)}
              style={{ background: 'none', border: 'none', color: 'var(--text-blue-500)', cursor: 'pointer', padding: 0, font: 'inherit' }}
            >
              {bid.customers?.name ?? bid.bids_gc_builders?.name ?? '—'}
            </button>
          ) : null}
          {estNorm ? <span>{gcRowsWorthShowing(gcPacketsByBid[bid.id]) ? '' : '· '}{estNorm.name || estNorm.email}</span> : null}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            · {renderBidBoardBidValue(bid)}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
            · Last contact{' '}
            <button
              type="button"
              onClick={() => onLastContactClick(bid)}
              style={{ background: 'none', border: 'none', color: 'var(--text-blue-500)', cursor: 'pointer', padding: 0, font: 'inherit' }}
            >
              {lcParts ? `${lcParts.dateLabel} ${lcParts.deltaLabel}` : '+'}
            </button>
          </span>
        </div>
        {hasLinks ? <div style={{ marginTop: '0.35rem' }}>{renderBidBoardLinksCluster(bid)}</div> : null}
        {bid.outcome === 'lost' ? (
          <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: 'var(--text-700)' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>Why did we lose? </span>
            <span style={{ color: lossReason ? 'var(--text-700)' : 'var(--text-faint)' }}>{lossReason || '—'}</span>
          </div>
        ) : null}
        {expanded ? (
          <div
            id={`bid-board-notes-${bid.id}`}
            onClick={(e) => e.stopPropagation()}
            style={{ borderTop: '1px dashed var(--border)', marginTop: '0.5rem', paddingTop: '0.5rem', cursor: 'default' }}
          >
            {renderBidBoardExpandedContent(bid)}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div>
      {/* Board tools row: search grows, Archived + Customer review sit to its right and never wrap
          off the line — the search input shrinks instead (padding tightens on phones to keep it usable). */}
      <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder={narrowViewport ? 'Search...' : 'Search (project name or GC/Builder)...'}
          value={bidBoardSearchQuery}
          onChange={(e) => setBidBoardSearchQuery(e.target.value)}
          /* height matches the Archived / Customer review buttons beside it
             (owner call, v2.1709) — the input's taller line box stuck out. */
          style={{ flex: '1 1 auto', minWidth: 0, height: 36, padding: '0 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setWorkingBoardArchivedModalOpen(true)}
            title="Archived bids"
            aria-label={`Archived bids${workingBoardArchivedBids.length > 0 ? ` (${workingBoardArchivedBids.length})` : ''}`}
            style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true" style={{ display: 'block' }}>
              <path d="M64 128C64 110.3 78.3 96 96 96L544 96C561.7 96 576 110.3 576 128L576 160C576 177.7 561.7 192 544 192L96 192C78.3 192 64 177.7 64 160L64 128zM96 240L544 240L544 480C544 515.3 515.3 544 480 544L160 544C124.7 544 96 515.3 96 480L96 240zM248 304C234.7 304 224 314.7 224 328C224 341.3 234.7 352 248 352L392 352C405.3 352 416 341.3 416 328C416 314.7 405.3 304 392 304L248 304z" />
            </svg>
            {workingBoardArchivedBids.length > 0 ? `(${workingBoardArchivedBids.length})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setCustomerReviewOpen(true)}
            title="Customer review"
            style={{
              padding: narrowViewport ? '0.5rem 0.6rem' : '0.5rem 1rem',
              background: 'var(--bg-muted)',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Customer review
          </button>
        </div>
      </div>
      {filteredBidsForBidBoard.length === 0 ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 4, padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          {bids.length === 0 ? 'No bids yet. Click New Bid to add one.' : 'No bids match your search.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <nav
            aria-label="Bid Board sections"
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 5,
              background: 'var(--bg-page)',
              display: 'flex',
              gap: '0.4rem',
              alignItems: 'center',
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              padding: '0.35rem 0.125rem 0.5rem',
              borderBottom: '1px solid var(--border)',
              margin: '0 0 -0.5rem',
            }}
          >
            {[
              ...BID_BOARD_SECTION_CONFIG.map(({ key, jumpLabel }) => ({
                key: key as SubmissionSectionKey | 'health',
                jumpLabel,
                count: bidBoardBuckets[key].length as number | null,
              })),
              { key: 'health' as const, jumpLabel: 'Health', count: null },
            ].map(({ key, jumpLabel, count }) => (
              <button
                key={key}
                type="button"
                onClick={() => jumpToBidBoardSection(key)}
                title={key === 'health' ? 'Jump to Estimating Health' : `Jump to ${jumpLabel}`}
                style={{
                  flex: '0 0 auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.3rem 0.7rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 999,
                  background: 'var(--surface)',
                  color: 'var(--text-700)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {jumpLabel}
                {count != null ? (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      borderRadius: 999,
                      padding: '0.05rem 0.4rem',
                      fontVariantNumeric: 'tabular-nums',
                      background: key === 'pending' && count > 0 ? '#FF6600' : 'var(--bg-muted)',
                      color: key === 'pending' && count > 0 ? '#fff' : 'var(--text-muted)',
                    }}
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            ))}
            {/* Far right of the Health line: pick how YOUR name is boxed when
                you're a bid's Estimator or Account Man (v2.1710). */}
            <span style={{ marginLeft: 'auto', display: 'inline-flex' }}>
              <BidBoardSelfHighlightWheel
                pref={selfHighlightPref}
                onSave={saveSelfHighlightPref}
                previewName={selfHighlightPreviewName}
              />
            </span>
          </nav>
          {BID_BOARD_SECTION_CONFIG.map(({ key, label }) => {
            const sectionBids = bidBoardBuckets[key]
            const isOpen = sectionOpen[key]
            const capExpanded = isCappedSectionKey(key) ? sectionShowAll[key] : true
            const capApplies = isCappedSectionKey(key) && sectionBids.length > BID_BOARD_SECTION_ROW_CAP
            const visibleSectionBids =
              capApplies && !capExpanded ? sectionBids.slice(0, BID_BOARD_SECTION_ROW_CAP) : sectionBids
            return (
              <div key={key} id={`bid-board-section-${key}`} style={{ scrollMarginTop: '3.25rem' }}>
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
                            border: '1px solid var(--border-strong)',
                            background: 'var(--surface)',
                            cursor: 'pointer',
                            color: 'var(--text-700)',
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
                {isOpen && narrowViewport && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                    {sectionBids.length === 0 ? (
                      <div style={{ border: '1px solid var(--border)', borderRadius: 4, padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No bids in this group
                      </div>
                    ) : (
                      visibleSectionBids.map((bid) => renderBidBoardCard(bid))
                    )}
                    {capApplies ? (
                      <button
                        type="button"
                        onClick={() =>
                          setSectionShowAll((prev) =>
                            isCappedSectionKey(key) ? { ...prev, [key]: !prev[key] } : prev
                          )
                        }
                        aria-expanded={capExpanded}
                        style={{
                          padding: '0.5rem',
                          background: 'none',
                          border: '1px dashed var(--border-strong)',
                          borderRadius: 8,
                          cursor: 'pointer',
                          color: 'var(--text-blue-500)',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                        }}
                      >
                        {capExpanded
                          ? `Show first ${BID_BOARD_SECTION_ROW_CAP} ▴`
                          : `Show all ${sectionBids.length} ▾`}
                      </button>
                    ) : null}
                  </div>
                )}
                {isOpen && !narrowViewport && (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'auto', marginTop: '0.25rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                      {bidBoardTableHead(key === 'unsent')}
                      <tbody>
                        {sectionBids.length === 0 ? (
                          <tr>
                            <td colSpan={key === 'unsent' ? 6 : 7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                              No bids in this group
                            </td>
                          </tr>
                        ) : (
                          visibleSectionBids.map((bid) => renderBidBoardTableRow(bid, key === 'unsent'))
                        )}
                        {capApplies ? (
                          <tr>
                            {/* capped sections are pending/lost, which always show the Bid column */}
                            <td colSpan={7} style={{ padding: 0, background: 'var(--bg-subtle)', borderTop: '1px solid var(--border)' }}>
                              <button
                                type="button"
                                onClick={() =>
                                  setSectionShowAll((prev) =>
                                    isCappedSectionKey(key) ? { ...prev, [key]: !prev[key] } : prev
                                  )
                                }
                                aria-expanded={capExpanded}
                                style={{
                                  width: '100%',
                                  padding: '0.5rem',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: 'var(--text-blue-500)',
                                  fontSize: '0.8125rem',
                                  fontWeight: 600,
                                }}
                              >
                                {capExpanded
                                  ? `Show first ${BID_BOARD_SECTION_ROW_CAP} ▴`
                                  : `Show all ${sectionBids.length} ▾`}
                              </button>
                            </td>
                          </tr>
                        ) : null}
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
          <div id="bid-board-health-section" style={{ scrollMarginTop: '3.25rem' }}>
            <BidBoardEstimatingHealthSection
              weeklySentSummaries={bidBoardWeeklySentSummaries}
              filteredBids={filteredBidsForBidBoard}
              isDev={isDev}
              openBid={bidPreview ? (b) => bidPreview.openBidPreviewFromBid(b) : undefined}
            />
          </div>
        </div>
      )}
      {customerReviewOpen ? <BidBoardCustomerReviewModal onClose={() => setCustomerReviewOpen(false)} /> : null}
      {dueLegendOpen ? (
        <div
          role="dialog"
          aria-modal
          aria-label="Due date colors"
          onClick={() => setDueLegendOpen(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') setDueLegendOpen(false) }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--surface)', borderRadius: 8, padding: '1.25rem 1.5rem', maxWidth: 440, width: '90%' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Due date colors</h2>
              <button
                type="button"
                onClick={() => setDueLegendOpen(false)}
                aria-label="Close"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1, color: 'inherit' }}
              >
                ×
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.875rem' }}>
              {(
                [
                  { key: 'overdue' as const, sample: '(+4)', text: 'Past the due date — the bottom line counts days late.' },
                  { key: 'soon' as const, sample: '(-2)', text: `Due today or within the next ${DUE_SOON_WINDOW_DAYS} days.` },
                  { key: 'normal' as const, sample: '(-12)', text: `Due more than ${DUE_SOON_WINDOW_DAYS} days out.` },
                ]
              ).map(({ key, sample, text }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span
                    style={{
                      flex: '0 0 auto',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      padding: '0.15rem 0.55rem',
                      borderRadius: 10,
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                      background: BID_BOARD_DUE_CHIP_COLORS[key].background,
                      color: BID_BOARD_DUE_CHIP_COLORS[key].color,
                      border: `1px solid ${BID_BOARD_DUE_CHIP_COLORS[key].border}`,
                    }}
                  >
                    {sample}
                  </span>
                  <span>{text}</span>
                </div>
              ))}
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', lineHeight: 1.45 }}>
                Colors apply to unsent bids only — once a bid is sent, its chip goes quiet (and once it's Won, Lost, or
                Started, the day count drops too), so red and amber always mean a bid still needs to go out.
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
