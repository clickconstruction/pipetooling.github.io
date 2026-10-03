import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/format'
import { formatRevenueMultiple } from '../../lib/bids/bidFormatting'
import { profitConcentration, solveWorkbenchPrices } from '../../lib/bids/pricingWorkbenchSolver'
import { computeBidCostBreakdown, directCostRowsFromTables } from '../../lib/bids/bidTotalCostBreakdown'
import { PricingCompositionBar } from './PricingCompositionBar'
import { PricingProfitBar } from './PricingProfitBar'
import { usePricingProfitBar } from '../../hooks/usePricingProfitBar'
import { matchCountRowsToBookEntries, type BookEntryMatch } from '../../lib/bids/bookEntryMatching'
import { needsFreezeAfterWrite, resolvePricingWriteTarget } from '../../lib/bids/pricingWriteTarget'
import { compareSentVsToday, sentVsTodayText } from '../../lib/bids/sentVsToday'
import { pricingLockChipText, pricingLockState, pricingLockedMessage, readRevisedBids, writeRevisedBid } from '../../lib/bids/pricingLock'
import { mapCountRowsByFixture } from '../../lib/bids/mapCountRowsByFixture'
import { sumByAlternate } from '../../lib/bids/alternateScope'
import { sameSolveScope, scopeWorkbenchRows, solveScopeLabel, type WorkbenchSolveScope } from '../../lib/bids/workbenchSolveScope'
import { alternateScopeKey, isAlternateRow } from '../../lib/bids/countSheet'
import { isDeclinedRow } from '../../lib/bids/alternateAcceptance'
import { searchPriceBookEntries, seedPricingAssignmentSearch, type AssignMatchMode, type PriceBookSearchResult } from '../../lib/bids/priceBookAssignSearch'
import { SpotlightTour } from '../SpotlightTour'
import { scenarioPricingRows } from '../../lib/bids/scenarioPricingRows'
import { loadScenarioInputs, scenarioBidVersionIdOf, type ScenarioInputs } from '../../lib/bids/loadScenarioInputs'
import { readPreviewStash, writePreviewStash } from '../../lib/bids/workbenchPreviewStash'
import { cellEditSeed, impliedUnitPrice, type WorkbenchCellField } from '../../lib/bids/workbenchCellSolve'
import { bidDetailCloseXStyle, bidDetailCloseFloatMobileStyle } from '../../lib/bids/bidStyles'
import { useAlternateVersionData, useGcNamesById, useScenarioCardRevenues } from '../../hooks/usePricingCardsData'
import { AddPriceDoorButton, PricingCardsRow } from './PricingCardsRow'
import { cardRevenue, cardsRowMode, cardsRowScenarios, copySourceFor } from '../../lib/bids/pricingCardsRow'
import { gcNameForVersion as gcNameForVersionOf } from '../../lib/bids/pricingCardsData'
import { sameGcAlternateVersions } from '../../lib/bids/ownTakeoffAlternates'
import { nextSortOrder } from '../../lib/bids/pickActivePricing'
import { versionStarringScenario } from '../../lib/bids/starredScenarioGuard'
import { afterOpenPriceDeleted, resolvedStarPricingId } from '../../lib/bids/versionStar'
import { useMarginBrush } from '../../hooks/useMarginBrush'
import { resolveCurrentPriceBookTemplateId, resolvePriceBookTemplateRoot } from '../../lib/bids/resolveCurrentPriceBookTemplateId'
import { planBookEditBidOffer, planSiblingCarry, type BookEditBidOffer, type BookEntryPrices } from '../../lib/bids/bookEditBidOffer'
import { BidWorkflowTabTitleWithPreview } from './BidWorkflowTabTitleWithPreview'
import { BidFlowStrip } from './BidFlowStrip'
import { deriveBidFlow, type BidFlowDoor, type BidFlowStep } from '../../lib/bids/bidFlow'
import { useBidFlowFacts } from '../../hooks/useBidFlowFacts'
import { useBidFlowReview } from '../../hooks/useBidFlowReview'
import { useBidFlowFold } from '../../hooks/useBidFlowFold'
import { BidPickerStandardList } from './BidPickerStandardList'
import { filterBidsForPicker } from '../../lib/bids/filterBidsForPicker'
import { resolvePricingEntry } from '../../lib/bids/resolvePricingEntry'
import { decoratePricingRows } from '../../lib/bids/decoratePricingRows'
import { BidsPriceBookDrawer } from './BidsPriceBookDrawer'
import { PricingVersionFormModal } from './PricingVersionFormModal'
import { DeletePricingVersionModal } from './DeletePricingVersionModal'
import { PricingEntryFormModal } from './PricingEntryFormModal'
import { PricingMarginBreakdownModal, type PricingBreakdownRow } from './PricingMarginBreakdownModal'
import { BidPickerSearchRow } from './BidPickerSearchRow'
import { PackageAndSendBidPricingModal, type PackageAndSendPricingRowInput } from './PackageAndSendBidPricingModal'
import { PricingQuoteModals } from './PricingQuoteModals'
import { usePricingQuoteDesk } from '../../hooks/usePricingQuoteDesk'
import { AdoptBidModal } from './AdoptBidModal'
import { PricingShareMenu } from './PricingShareMenu'
import { PricingStarChooserDialog } from './PricingStarChooserDialog'
import { PricingBidsLikeThis } from './PricingBidsLikeThis'
import { WorkbenchHelpCard } from './WorkbenchHelpCard'
import { usePricingMarginHistory } from '../../hooks/usePricingMarginHistory'
import { useWorkbenchHelp } from '../../hooks/useWorkbenchHelp'
import { WORKBENCH_GUIDE_HREF, workbenchHelpFacts } from '../../lib/bids/workbenchHelp'
import { useStarAwareShare } from '../../hooks/useStarAwareShare'
import { useTakeoffPriceDrift } from '../../hooks/useTakeoffPriceDrift'
import { PricingMaterialsTodayNote } from './TakeoffPriceDrift'
import { pricingNameOf } from '../../lib/bids/starAwareShare'
import type { ComputeBidPricingRowsResult } from '../../lib/bidPricingRowCalculations'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import type { useBidPreview } from '../../contexts/BidPreviewModalContext'
import type { LedgerPrefixMap } from '../../lib/ledgerDisplayPrefixes'
import type { BidWithBuilder, EstimatorUser } from '../../types/bidWithBuilder'
import type { BidCountRow } from '../../types/bids'
import type { TeamLaborBidRow } from '../../utils/teamLabor'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import type {
  CostEstimate,
  CostEstimateLaborRow,
  CostEstimateEquipmentRow,
  CostEstimatePermitRow,
  CostEstimateSubcontractorRow,
  CostEstimateWasteRow,
  CostEstimateOtherRow,
  PriceBookVersion,
  PriceBookEntryWithFixture,
  BidPricingAssignment,
  BidCountRowCustomPrice,
  BidCountRowSubmissionHide,
  BidVersion,
} from '../../lib/bids/bidPricingEngineTypes'

/** "Tue 4:12 PM" for a restored solve from this week; adds the date once it's older (v2.2373). */
function formatRestoredStamp(at: number): string {
  const d = new Date(at)
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const ageDays = (Date.now() - at) / (24 * 60 * 60 * 1000)
  if (ageDays < 6) return `${d.toLocaleDateString([], { weekday: 'short' })} ${time}`
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`
}

type BidsPricingTabProps = {
  /** v2.3216: open a step's door from the strip — Edit window or another tab — and land on its field. The page owns it. */
  onOpenBidFlowDoor?: (bid: BidWithBuilder, door: BidFlowDoor, step: BidFlowStep) => void
  /** Role gating for those doors (superintendents never reach Pricing / Cover Letter). */
  bidFlowDoorAllowed?: (door: BidFlowDoor) => boolean
  bids: BidWithBuilder[]
  selectedBidForPricing: BidWithBuilder | null
  narrowViewport640: boolean
  bidPreview: ReturnType<typeof useBidPreview>
  error: string | null
  setError: (message: string | null) => void
  selectedServiceTypeId: string
  fixtureTypes: Array<{ id: string; name: string }>
  getOrCreateFixtureTypeId: (name: string, serviceTypeIdOverride?: string) => Promise<{ id: string } | { id: null; error?: string }>
  loadBids: (serviceTypeId?: string | null) => Promise<BidWithBuilder[]>
  // Shared, parent-owned
  costEstimatePOModalTaxPercent: string
  canPackageAndSendBidPricing: boolean
  estimatorUsers: EstimatorUser[]
  ledgerPrefixMap: LedgerPrefixMap
  profileName: string | null
  // Engine values + setters/loaders
  priceBookVersions: PriceBookVersion[]
  priceBookEntries: PriceBookEntryWithFixture[]
  setPriceBookEntries: Dispatch<SetStateAction<PriceBookEntryWithFixture[]>>
  bidPricingAssignments: BidPricingAssignment[]
  bidCountRowCustomPrices: BidCountRowCustomPrice[]
  bidCountRowSubmissionHides: BidCountRowSubmissionHide[]
  /** Active bid Version (null = unsplit Base) — stamps takeoff writes from the margin column. */
  selectedBidVersionId: string | null
  /** All the bid's Versions — the Workbench structure bar names the active one. */
  bidVersions: BidVersion[]
  /** Open another Version on this Workbench (engine switchActiveVersion) — own-takeoff alternate cards (v2.2404). */
  onSwitchBidVersion: (versionId: string) => void
  /** Refresh the versions list after this tab creates one (v2.2404). */
  reloadBidVersions: () => Promise<void>
  selectedPricingVersionId: string | null
  setSelectedPricingVersionId: Dispatch<SetStateAction<string | null>>
  pricingCountRows: BidCountRow[]
  bidCountRowCustomCosts: Array<{ id: string; count_row_id: string; unit_materials_cents: number; house_name: string | null; lot_group_id: string | null; applied_at: string }>
  reloadBidCustomCosts: () => Promise<void>
  pricingCostEstimate: CostEstimate | null
  pricingLaborRows: CostEstimateLaborRow[]
  pricingEquipmentRows: CostEstimateEquipmentRow[]
  pricingPermitRows: CostEstimatePermitRow[]
  pricingSubcontractorRows: CostEstimateSubcontractorRow[]
  pricingWasteRows: CostEstimateWasteRow[]
  pricingOtherRows: CostEstimateOtherRow[]
  pricingMaterialTotalRoughIn: number | null
  pricingMaterialTotalTopOut: number | null
  pricingMaterialTotalTrimSet: number | null
  pricingLaborRate: number | null
  pricingFixtureMaterialsFromTakeoff: Record<string, number>
  teamLaborDataForBids: TeamLaborBidRow[]
  /** Shared master catalog (bid_id IS NULL) shown under the "Templates" toggle / used as clone sources. */
  templatePriceBookVersions: PriceBookVersion[]
  /** The user's default template for new bids (last pick → "Default" → first) — the drawer's "your default" line. */
  defaultPriceBookTemplateId: string | null
  loadTemplatePriceBookVersions: () => Promise<void>
  /** Record `templateId` as this user's last-selected price book (their per-service-type default). */
  rememberLastPriceBookTemplate: (templateId: string) => void
  loadBidPricings: (bidId: string) => Promise<PriceBookVersion[] | null>
  loadPriceBookEntries: (versionId: string | null) => Promise<void>
  loadBidPricingAssignments: (bidId: string, versionId: string | null, signal?: AbortSignal) => Promise<void>
  reloadPricingForBid: (bidId: string, signal?: AbortSignal) => Promise<void>
  /** Per-bid pricing resolve (v2.2367): 'skeleton' while this bid's versions/prices load,
      'error' when the load failed — the Workbench must not show its empty state for either. */
  resolvePanel: 'skeleton' | 'error' | 'content'
  /** Re-run a failed resolve (the error panel's Retry). */
  onRetryResolve: () => void
  /** Resolves false when nothing was saved — e.g. a price that is not the active version's own (v2.4377). */
  saveBidSelectedPriceBookVersion: (bidId: string, versionId: string | null) => Promise<boolean>
  // Shared pricing-rows calc (from useBidPricingRows)
  pricingRowsForGrid: ComputeBidPricingRowsResult | null
  pricingPackageSource: { rows: PackageAndSendPricingRowInput[]; totalRevenue: number } | null
  // Callbacks
  onSelectBid: (bid: BidWithBuilder) => void
  onClose: () => void
  onEditBid: (bid: BidWithBuilder) => void
  onNavigateBidToTab: (bid: BidWithBuilder, tab: 'counts' | 'takeoffs' | 'labor') => void
  /** Breakdown jump chips (v2.2400): navigate AND land on that fixture's row (scroll + flash). */
  onNavigateBidToTabRow?: (bid: BidWithBuilder, tab: 'counts' | 'takeoffs' | 'labor', target: { countRowId: string; fixture: string }) => void
  onlyMyBids: boolean
  setOnlyMyBids: (next: boolean) => void
  isMyBid: (bid: BidWithBuilder) => boolean
}

/** Self-contained payload for the per-line breakdown modal (Revenue → Cost → Margin). */

export function BidsPricingTab({
  onOpenBidFlowDoor,
  bidFlowDoorAllowed,
  bids,
  selectedBidForPricing,
  narrowViewport640,
  bidPreview,
  error,
  setError,
  selectedServiceTypeId,
  fixtureTypes,
  getOrCreateFixtureTypeId,
  loadBids,
  costEstimatePOModalTaxPercent,
  canPackageAndSendBidPricing,
  estimatorUsers,
  ledgerPrefixMap,
  profileName,
  priceBookVersions,
  priceBookEntries,
  setPriceBookEntries,
  bidPricingAssignments,
  bidCountRowCustomPrices,
  bidCountRowSubmissionHides,
  selectedBidVersionId,
  bidVersions,
  onSwitchBidVersion,
  reloadBidVersions,
  selectedPricingVersionId,
  setSelectedPricingVersionId,
  pricingCountRows,
  bidCountRowCustomCosts,
  reloadBidCustomCosts,
  pricingCostEstimate,
  pricingLaborRows,
  pricingEquipmentRows,
  pricingPermitRows,
  pricingSubcontractorRows,
  pricingWasteRows,
  pricingOtherRows,
  pricingMaterialTotalRoughIn,
  pricingMaterialTotalTopOut,
  pricingMaterialTotalTrimSet,
  pricingLaborRate,
  pricingFixtureMaterialsFromTakeoff,
  teamLaborDataForBids,
  templatePriceBookVersions,
  defaultPriceBookTemplateId,
  loadTemplatePriceBookVersions,
  rememberLastPriceBookTemplate,
  loadBidPricings,
  loadPriceBookEntries,
  loadBidPricingAssignments,
  reloadPricingForBid,
  resolvePanel,
  onRetryResolve,
  saveBidSelectedPriceBookVersion,
  pricingRowsForGrid,
  pricingPackageSource,
  onSelectBid,
  onClose,
  onEditBid,
  onNavigateBidToTab,
  onNavigateBidToTabRow,
  onlyMyBids,
  setOnlyMyBids,
  isMyBid,
}: BidsPricingTabProps) {
  const { showToast } = useToastContext()
  // Lock pricing after send (v2.3591): a sent bid refuses every pricing write until this session
  // presses Revise; the choice lives in sessionStorage, never on the bid.
  const [revisedBidIds, setRevisedBidIds] = useState<ReadonlySet<string>>(() => readRevisedBids(typeof window !== 'undefined' ? window.sessionStorage : null))
  const pricingLock = pricingLockState({ bidDateSent: selectedBidForPricing?.bid_date_sent, bidId: selectedBidForPricing?.id, revised: revisedBidIds })
  /** False (with the toast) when the selected bid is sent and not being revised — every pricing write asks first. */
  function guardPricingWrite(): boolean {
    if (pricingLock !== 'locked') return true
    showToast(pricingLockedMessage(selectedBidForPricing?.bid_date_sent ?? '', new Date().getFullYear()), 'warning')
    return false
  }
  function setPricingRevising(revising: boolean) {
    const bid = selectedBidForPricing
    if (!bid) return
    setRevisedBidIds(writeRevisedBid(typeof window !== 'undefined' ? window.sessionStorage : null, bid.id, revising))
    showToast(revising ? 'Revising a sent bid — the sent number stays on the record; the grid and the letter will move.' : 'Pricing locked again.', 'info')
  }
  // Bid flow facts for the selected bid (one chunked read per selection).
  const { factsByBid: bidFlowFactsByBid } = useBidFlowFacts(selectedBidForPricing ? [selectedBidForPricing.id] : [])
  const bidFlowReview = useBidFlowReview(selectedBidForPricing ? [selectedBidForPricing] : [])
  // v2.3241: the strip folds to one line beside the title; per device.
  const flowFold = useBidFlowFold()
  const confirmDialog = useConfirmDialog()

  const [pricingSearchQuery, setPricingSearchQuery] = useState('')
  const [pricingVersionFormOpen, setPricingVersionFormOpen] = useState(false)
  const [editingPricingVersion, setEditingPricingVersion] = useState<PriceBookVersion | null>(null)
  const [pricingVersionNameInput, setPricingVersionNameInput] = useState('')
  const [savingPricingVersion, setSavingPricingVersion] = useState(false)
  const [pricingEntryFormOpen, setPricingEntryFormOpen] = useState(false)
  // v2.2398: entry form opened from an assign search targets the bid's ACTIVE pricing
  // (what the dropdowns search), not the drawer's template catalog.
  const [entryFormTargetPricing, setEntryFormTargetPricing] = useState(false)
  const [editingPricingEntry, setEditingPricingEntry] = useState<PriceBookEntryWithFixture | null>(null)
  const [pricingEntryFixtureName, setPricingEntryFixtureName] = useState('')
  const [pricingEntryRoughIn, setPricingEntryRoughIn] = useState('')
  const [pricingEntryTopOut, setPricingEntryTopOut] = useState('')
  const [pricingEntryTrimSet, setPricingEntryTrimSet] = useState('')
  const [pricingEntryTotal, setPricingEntryTotal] = useState('')
  // Combined-mode Price input keeps the raw string the user types; binding it to the
  // auto-toFixed(2) total reformatted the field on every keystroke ("21.00" → "2.01").
  const [pricingEntryCombinedPrice, setPricingEntryCombinedPrice] = useState('')
  const [savingPricingEntry, setSavingPricingEntry] = useState(false)
  const [deletePricingVersionModalOpen, setDeletePricingVersionModalOpen] = useState(false)
  const [pricingVersionToDelete, setPricingVersionToDelete] = useState<PriceBookVersion | null>(null)
  const [deletePricingVersionNameInput, setDeletePricingVersionNameInput] = useState('')
  const [deletePricingVersionError, setDeletePricingVersionError] = useState<string | null>(null)
  const [priceBookSearchQuery, setPriceBookSearchQuery] = useState('')
  // The price-book drawer (v2.2384, owner-approved prototype): the strip chip is
  // the one door to the book. It edits the shared TEMPLATE catalog only — the
  // old "This version's prices" panel mode was added by mistake and never used.
  const [wbBookDrawerOpen, setWbBookDrawerOpen] = useState(false)
  const [wbBooksExpanded, setWbBooksExpanded] = useState(false)
  const [wbPriceDisplayMode, setWbPriceDisplayMode] = useState<'combined' | 'stage'>('combined')
  // v2.2444 (Wendi: "changed both versions of water to 13 and it isnt coming up"): the drawer
  // edits the SHARED book, but a bid prices from a frozen copy of it that keeps the same name.
  // After a book edit, this holds the door back to the open bid — see `bookEditBidOffer.ts`.
  // For an update, `siblingEntryIds` are same-fixture entries in the bid's OTHER pricings still
  // holding the identical stale prices (v2.2445) — "on this bid" updates them in the same press.
  type PendingBookOffer = { offer: BookEditBidOffer; fixtureTypeId: string; prices: BookEntryPrices; siblingEntryIds: string[]; siblingPricingCount: number }
  const [pendingBookOffer, setPendingBookOffer] = useState<PendingBookOffer | null>(null)
  const [applyingBookOffer, setApplyingBookOffer] = useState(false)
  // Planning an offer awaits a sibling fetch; the token drops a result that lands after the
  // context it was planned for (pricing switched, drawer closed) is gone.
  const bookOfferTokenRef = useRef(0)
  // The first price on a bid freezes it (frozen-bid-prices PR 1): a write that landed on a
  // shared template is followed by taking the bid's own copy. One clone at a time.
  const freezingPricingRef = useRef(false)
  useEffect(() => {
    if (!wbBookDrawerOpen) {
      bookOfferTokenRef.current++
      setPendingBookOffer(null)
      return
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setWbBookDrawerOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [wbBookDrawerOpen])
  // --- Bid Pricings vs Templates panel state ---
  // In Templates mode the panel edits the shared master catalog; `editingTemplateId` +
  // `templateEntries` keep that editing fully separate from the bid's active Pricing
  // (`selectedPricingVersionId` / `priceBookEntries`), which still drives the grid.
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [templateEntries, setTemplateEntries] = useState<PriceBookEntryWithFixture[]>([])
  // The v2.2444 offer names entries in this bid's pricings — switching either side retires it
  // (and invalidates any plan still fetching).
  useEffect(() => {
    bookOfferTokenRef.current++
    setPendingBookOffer(null)
  }, [selectedPricingVersionId, editingTemplateId])
  // What kind of version the version-form modal is creating.
  const [pricingFormMode, setPricingFormMode] = useState<'template' | 'pricing-blank' | 'pricing-clone'>('pricing-blank')
  const [pricingCloneSourceId, setPricingCloneSourceId] = useState<string | null>(null)
  const [pricingAssignmentSearches, setPricingAssignmentSearches] = useState<Record<string, string>>({})
  // Assign-search matching mode (v2.2397, Wendi: "i want exact matching as an option").
  // Similar = any word, ranked; Exact = every word must appear. Per device, both dropdowns.
  const [assignMatchMode, setAssignMatchMode] = useState<AssignMatchMode>(() => {
    try {
      return window.localStorage.getItem('bidPricingAssignMatchMode_v1') === 'exact' ? 'exact' : 'similar'
    } catch {
      return 'similar'
    }
  })
  const setAssignMatchModePersist = (m: AssignMatchMode) => {
    setAssignMatchMode(m)
    try {
      window.localStorage.setItem('bidPricingAssignMatchMode_v1', m)
    } catch {
      /* device just won't remember the mode */
    }
  }
  /** Matched characters in a dropdown row — the reason the row is in the list. */
  const assignHighlightStyle: React.CSSProperties = { background: 'var(--bg-blue-200)', color: 'var(--text-blue-700)', fontWeight: 700, borderRadius: 3, padding: '0 1px' }
  function renderAssignHighlightedName(name: string, ranges: ReadonlyArray<readonly [number, number]>) {
    if (ranges.length === 0) return name
    const parts: React.ReactNode[] = []
    let pos = 0
    ranges.forEach(([s, e], i) => {
      if (s > pos) parts.push(name.slice(pos, s))
      parts.push(
        <span key={i} style={assignHighlightStyle}>
          {name.slice(s, e)}
        </span>,
      )
      pos = e
    })
    if (pos < name.length) parts.push(name.slice(pos))
    return <>{parts}</>
  }
  /** Dropdown header: match count on the left, the Similar|Exact toggle in the corner (v2.2397). */
  function renderAssignDropdownHeader<T>(res: PriceBookSearchResult<T>, searchTerm: string) {
    const words = searchTerm.toLowerCase().split(/\s+/).filter(Boolean)
    const countText =
      words.length === 0
        ? `${res.matches.length} entr${res.matches.length === 1 ? 'y' : 'ies'}`
        : assignMatchMode === 'exact'
          ? `${res.matches.length} exact match${res.matches.length === 1 ? '' : 'es'} · contains all ${words.length} word${words.length === 1 ? '' : 's'}`
          : `${res.matches.length} similar · best match first`
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '0.3rem 0.5rem', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{countText}</span>
          <span style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 999, overflow: 'hidden' }}>
            {(['similar', 'exact'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={assignMatchMode === m}
                onClick={() => setAssignMatchModePersist(m)}
                title={m === 'similar' ? 'Any typed word can match — ranked best first' : 'Only entries containing every typed word'}
                style={{ font: 'inherit', fontSize: '0.68rem', fontWeight: assignMatchMode === m ? 700 : 600, padding: '0.14rem 0.6rem', border: 'none', background: assignMatchMode === m ? 'var(--bg-blue-tint)' : 'var(--surface)', color: assignMatchMode === m ? 'var(--text-strong)' : 'var(--text-muted)', cursor: 'pointer' }}
              >
                {m === 'similar' ? 'Similar' : 'Exact'}
              </button>
            ))}
          </span>
        </div>
        {assignMatchMode === 'similar' && res.unmatchedWords.length > 0 && res.matches.length > 0 ? (
          <div style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem', color: 'var(--text-amber-700)', background: 'var(--bg-amber-tint)', borderBottom: '1px solid var(--border)' }}>
            {res.unmatchedWords.map((w) => `“${w}”`).join(' / ')} match{res.unmatchedWords.length === 1 ? 'es' : ''} nothing
            {res.matchedWords.length > 0 ? (
              <> — showing entries matching {res.matchedWords.map((w) => `“${w}”`).join(' / ')}</>
            ) : null}
          </div>
        ) : null}
      </>
    )
  }
  /** Exact mode found nothing — always offer the way back to Similar (v2.2397). */
  function renderAssignExactEmptyEscape<T>(res: PriceBookSearchResult<T>, searchTerm: string) {
    return (
      <div style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Nothing contains all of “{searchTerm.trim()}”.</div>
        {res.similarCount > 0 ? (
          <button
            type="button"
            onClick={() => setAssignMatchModePersist('similar')}
            style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 600, marginTop: '0.45rem', padding: '0.28rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}
          >
            Show {res.similarCount} similar
          </button>
        ) : null}
      </div>
    )
  }
  const [pricingAssignmentDropdownOpen, setPricingAssignmentDropdownOpen] = useState<string | null>(null)
  const [pricingBreakdownRow, setPricingBreakdownRow] = useState<PricingBreakdownRow | null>(null)
  // Workbench (New view) state: solver PREVIEW prices (never written until Apply),
  // session-local locks, and the solver controls.
  const [wbPreview, setWbPreview] = useState<Record<string, number> | null>(null)
  // When the on-screen preview came back from the stash rather than a fresh Solve,
  // this holds the stash's written-at time so the strip can say how old it is (v2.2373).
  const [wbPreviewRestoredAt, setWbPreviewRestoredAt] = useState<number | null>(null)
  /** localStorage, unless the browser says no (private mode, disabled storage). Per-device on purpose — previews must outlive the tab (v2.2373). */
  const wbStash = (): Storage | null => {
    try {
      return window.localStorage
    } catch {
      return null
    }
  }
  // Clicked-off proposals (v2.2379): rows whose ghost price was clicked to red ✕ —
  // Apply holds their saved price. Lives beside the preview, stashes with it,
  // and survives re-solves (drops persist while the margin is retuned).
  const [wbPreviewVeto, setWbPreviewVeto] = useState<Set<string>>(() => new Set())
  /** Every preview change goes through here so the stash always mirrors state (v2.2354); vetoes ride along (v2.2379). */
  const setAndStashWbPreview = (versionId: string | null, preview: Record<string, number> | null, vetoed: Set<string> = new Set()) => {
    setWbPreview(preview)
    setWbPreviewVeto(vetoed)
    if (!versionId) return
    const storage = wbStash()
    if (storage) writePreviewStash(storage, versionId, preview, Date.now(), [...vetoed])
  }
  /** Ghost click: toggle one row out of (or back into) the pending solve.
      Functional update so rapid clicks on different ghosts can't lose one;
      the stash mirror inside is idempotent, so a double-invoked updater is harmless. */
  const toggleWbPreviewVeto = (rowId: string) => {
    setWbPreviewVeto((prev) => {
      const next = new Set(prev)
      if (next.has(rowId)) next.delete(rowId)
      else next.add(rowId)
      const storage = wbStash()
      if (storage && selectedPricingVersionId) {
        writePreviewStash(storage, selectedPricingVersionId, wbPreview, Date.now(), [...next])
      }
      return next
    })
  }
  // A preview belongs to the price option it was made on — whenever an option takes
  // the screen (first load, tab switches, reloads, scenario moves), its own stashed
  // preview comes back with it. This replaces the old silent discard-on-unmount.
  useEffect(() => {
    if (!selectedPricingVersionId) {
      setWbPreview(null)
      setWbPreviewVeto(new Set())
      setWbPreviewRestoredAt(null)
      return
    }
    const storage = wbStash()
    const stash = storage ? readPreviewStash(storage, selectedPricingVersionId) : null
    setWbPreview(stash?.prices ?? null)
    setWbPreviewVeto(new Set(stash?.vetoed ?? []))
    setWbPreviewRestoredAt(stash ? stash.at : null)
  }, [selectedPricingVersionId])
  const [wbLocks, setWbLocks] = useState<Set<string>>(() => new Set())
  const [wbMarginPct, setWbMarginPct] = useState(45)
  const [wbTargetTotalInput, setWbTargetTotalInput] = useState('')
  /** True while the "or total" box has focus — margin solves must not overwrite her typing (v2.2403). */
  const wbTargetTotalFocusedRef = useRef(false)
  /** Last margin solve, for the landing chip under the strip: the slider pct and how
      many rows it priced. Where the bid lands (revenue/blended) reads live from the
      preview totals; cleared whenever the preview clears or a row is hand-edited. */
  const [wbSolveLanding, setWbSolveLanding] = useState<{ pct: number; rows: number } | null>(null)
  // v2.4202: what the solver prices on a bid with an alternate — the base by default (the number the
  // letter leads with); one alternate or the whole bid a click away. Rows outside keep their prices.
  const [wbSolveScope, setWbSolveScope] = useState<WorkbenchSolveScope>('base')
  const [wbShowUnpricedOnly, setWbShowUnpricedOnly] = useState(false)
  const [wbShowNoCostOnly, setWbShowNoCostOnly] = useState(false)
  const [wbApplying, setWbApplying] = useState(false)
  // Typed prices save themselves (v2.2373, Wendi): the raw string lives here only
  // while the field is being edited — commit on Enter/blur writes it straight to
  // the bid (the same write Apply uses), no preview gate for hand-typed prices.
  const [wbPriceDrafts, setWbPriceDrafts] = useState<Record<string, string>>({})
  // One Revenue/Profit/Margin cell mid-edit (v2.2379): its raw text. Each
  // keystroke converts to an implied unit price in wbPriceDrafts, so the
  // price cell and live totals follow; Enter/blur commits through the same
  // save commitWorkbenchTypedPrice already runs for typed prices.
  const [wbCellDraft, setWbCellDraft] = useState<{ rowId: string; field: WorkbenchCellField; raw: string } | null>(null)
  // Rows that just saved show a brief green "saved ✓" tag, then it fades.
  const [wbJustSaved, setWbJustSaved] = useState<Record<string, true>>({})
  // ---- Margin brush (v2.2401, Wendi): the state, the stroke, the recent margins, the handlers
  // and the grid's pointer handlers live in the hook (the Pricing / Labor map's step 8). It is
  // called where the brush block stood, so the Escape effect keeps its place among the tab's.
  const {
    brushArmed,
    brushMarginInput,
    setBrushMarginInput,
    brushMargin,
    brushCommitting,
    brushStrokeCount,
    brushUndo,
    recentMargins,
    armBrush,
    disarmBrush,
    undoBrushSweep,
    gridPointerHandlers: brushGridPointerHandlers,
  } = useMarginBrush({
    guardPricingWrite,
    // One tool at a time: picking up the brush folds the solver ring away. Read at click time
    // (the solver's state is declared further down).
    foldSolver: () => {
      if (wbSolverOpen) setAndRememberWbSolverOpen(false)
    },
    wbLocks,
    setWbPriceDrafts,
    clearSolveLanding: () => setWbSolveLanding(null),
    bidId: selectedBidForPricing?.id,
    pricingVersionId: selectedPricingVersionId,
    writePrice: writeUnitPriceOverrideRow,
    wbPreview,
    wbPreviewVeto,
    setAndStashWbPreview,
    reloadAssignments: loadBidPricingAssignments,
    freezeAfterWrite: freezeSharedPricingAfterWrite,
    setError,
  })
  // The jump-to-row flash: "Where the profit lives" and the composition bar both send the
  // worksheet to a row — the filters clear, the row flashes for two seconds and scrolls in.
  const [wbFlashRowId, setWbFlashRowId] = useState<string | null>(null)
  const jumpToWorksheetRow = (rowId: string) => {
    setWbShowNoCostOnly(false)
    setWbShowUnpricedOnly(false)
    setWbFlashRowId(rowId)
    window.setTimeout(() => {
      document.getElementById(`wb-row-${rowId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
    window.setTimeout(() => setWbFlashRowId((cur) => (cur === rowId ? null : cur)), 2000)
  }
  const [wbCopyingPrices, setWbCopyingPrices] = useState(false)
  const [wbFillingBook, setWbFillingBook] = useState(false)
  const [wbCloning, setWbCloning] = useState(false)
  /** The "＋ New price or version…" door (v2.2104, renamed v2.2110): one button asking "price point or sendable bid?" */
  const [wbVariantDoorOpen, setWbVariantDoorOpen] = useState(false)
  // Disables the toolbar price-book dropdown while a clone/switch is in flight (avoids double-submit).
  const [pricebookSwitchBusy, setPricebookSwitchBusy] = useState(false)
  const [savingUnitPriceOverride, setSavingUnitPriceOverride] = useState<string | null>(null)
  // Region P6: the quotes / RFQ / robot doors — the open flags, the bid's requests, the header
  // chip and the two one-shot URL doors live in the hook; the windows are PricingQuoteModals.
  const quoteDesk = usePricingQuoteDesk({ selectedBid: selectedBidForPricing, canPackageAndSendBidPricing })
  const {
    rfqChip,
    openRobotChip,
    priceMatrixSupported,
    setD22AuditOpen,
    setPrepareCopyOpen,
    setPlugInQuoteOpen,
    setPlugInScheduleOpen,
    setPriceWithRobotOpen,
    setQuotesCompareOpen,
    setRfqDeskOpen,
  } = quoteDesk
  // F6b (v2.2133): "Adopt an existing bid" — fold a board bid into this package as a version.
  const [adoptOpen, setAdoptOpen] = useState(false)
  // G1 (v2.2154): price options per GC — GC names for the structure bar, the "Another price" modal,
  // and the offered-as-alternate toggle (price_book_versions.include_in_submission, scoped per version).
  const gcNamesById = useGcNamesById(bidVersions)
  const [addPriceOpen, setAddPriceOpen] = useState<{ name: string; fromId: string | null; offer: boolean } | null>(null)
  const [copyingGcPrice, setCopyingGcPrice] = useState(false)
  /** The GC a version's letter goes to: its own override, else the bid's GC (`lib/bids/pricingCardsData`). */
  function gcNameForVersion(versionId: string | null): string {
    const bid = selectedBidForPricing as (BidWithBuilder & { customers?: { name?: string | null } | null; bids_gc_builders?: { name?: string | null } | null }) | null
    return gcNameForVersionOf({ bidVersions, gcNamesById, bid, versionId })
  }
  const shortGc = (name: string) => name

  /** The ▾ beside Solve — holds the rarely-used "Price unpriced only" (batch 2, artifact 11c68afc). */
  const [solveMenuOpen, setSolveMenuOpen] = useState(false)
  const solveMenuRef = useRef<HTMLSpanElement | null>(null)
  // v2.2385 (Wendi): the whole solver folds behind a blue "Solver ›" — open, its
  // controls (slider back inline, margin box, target total, Solve) sit inside a
  // blue ring so they read as one unit; ‹ folds them away. Device preference,
  // folded by default. This replaces v2.2378's slider-behind-▾ popover.
  const [wbSolverOpen, setWbSolverOpen] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('bidPricingSolverOpen_v1') === '1'
    } catch {
      return false
    }
  })
  const setAndRememberWbSolverOpen = (open: boolean) => {
    setWbSolverOpen(open)
    try {
      window.localStorage.setItem('bidPricingSolverOpen_v1', open ? '1' : '0')
    } catch {
      /* device just won't remember */
    }
  }
  // The "?" card and the walkthrough (region P2's help): the two open flags live in the hook.
  const { wbInfoOpen, setWbInfoOpen, wbTourSteps, setWbTourSteps, startWorkbenchTour } = useWorkbenchHelp({
    unfoldSolver: () => setAndRememberWbSolverOpen(true),
  })
  // v2.2378 (Wendi): the coverage bar collapses to a chip on the solver line —
  // expansion is a device preference, collapsed by default.
  const [wbCoverageOpen, setWbCoverageOpen] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('bidPricingCoverageOpen_v1') === '1'
    } catch {
      return false
    }
  })
  const toggleWbCoverageOpen = () => {
    setWbCoverageOpen((open) => {
      const next = !open
      try {
        window.localStorage.setItem('bidPricingCoverageOpen_v1', next ? '1' : '0')
      } catch {
        /* device just won't remember */
      }
      return next
    })
  }
  useEffect(() => {
    if (!solveMenuOpen) return
    const onDoc = (e: MouseEvent) => { if (solveMenuRef.current && !solveMenuRef.current.contains(e.target as Node)) setSolveMenuOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setSolveMenuOpen(false) } }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey, true)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey, true) }
  }, [solveMenuOpen])

  /** The ✎ on a price card opens this modal — rename + delete, mirroring the Version modal (artifact a4133103). */
  const [pricingEdit, setPricingEdit] = useState<{ id: string; name: string } | null>(null)
  async function savePricingEdit() {
    if (!pricingEdit) return
    const name = pricingEdit.name.trim()
    const current = priceBookVersions.find((p) => p.id === pricingEdit.id)?.name
    setPricingEdit(null)
    if (!name || !current || name === current) return
    const { error: renameErr } = await supabase.from('price_book_versions').update({ name }).eq('id', pricingEdit.id)
    if (renameErr) { showToast('Could not rename: ' + renameErr.message, 'error'); return }
    if (selectedBidForPricing) await loadBidPricings(selectedBidForPricing.id)
    window.dispatchEvent(new Event('bid-version-picker-reload'))
  }


  // Close price book modals when service type changes
  useEffect(() => {
    setPricingVersionFormOpen(false)
    setPricingEntryFormOpen(false)
    setDeletePricingVersionModalOpen(false)
    setEditingPricingVersion(null)
    setEditingPricingEntry(null)
    setPricingVersionToDelete(null)
    setPricingVersionNameInput('')
    setPricingEntryFixtureName('')
    setPricingEntryRoughIn('')
    setPricingEntryTopOut('')
    setPricingEntryTrimSet('')
    setPricingEntryTotal('')
    setPricingEntryCombinedPrice('')
    setDeletePricingVersionNameInput('')
    setDeletePricingVersionError(null)
  }, [selectedServiceTypeId])

  // Auto-calculate price book entry total
  useEffect(() => {
    const rough = parseFloat(pricingEntryRoughIn) || 0
    const top = parseFloat(pricingEntryTopOut) || 0
    const trim = parseFloat(pricingEntryTrimSet) || 0
    const calculatedTotal = rough + top + trim

    // Only auto-update if the current total is different (allows manual override)
    if (calculatedTotal !== (parseFloat(pricingEntryTotal) || 0)) {
      setPricingEntryTotal(calculatedTotal.toFixed(2))
    }
  }, [pricingEntryRoughIn, pricingEntryTopOut, pricingEntryTrimSet])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement
      if (pricingAssignmentDropdownOpen && !target.closest('[data-pricing-assignment-dropdown]')) {
        setPricingAssignmentDropdownOpen(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [pricingAssignmentDropdownOpen])
  // "Where the profit lives" (v2.2353): the bar's four values, and the other half of the
  // outside-click effect above — called here, so the two run in the order they did as one.
  const profitBar = usePricingProfitBar()

  // --- Bid Pricings vs Templates panel ---
  // The Price Book panel can show either the bid's Pricings or the shared template catalog.
  // `panel*` resolve to whichever the "Templates" toggle is on. Template editing uses its own
  // `editingTemplateId` / `templateEntries` so it never disturbs the bid's active Pricing
  // (`selectedPricingVersionId` / `priceBookEntries`), which still drives the grid + cover letter.
  const panelVersionId = editingTemplateId
  const panelEntries = templateEntries
  // Which shared template the toolbar price-book dropdown shows as "current" for this bid.
  const currentPriceBookTemplateId = resolveCurrentPriceBookTemplateId({
    selectedPricingVersionId,
    bidPricings: priceBookVersions,
    templateIds: templatePriceBookVersions.map((t) => t.id),
    // v2.2444: `templates` lets a severed lineage (source scenario deleted → ON DELETE SET NULL)
    // still resolve by name, so the drawer opens the bid's own book instead of the first one.
    templates: templatePriceBookVersions,
  })

  async function loadTemplateEntries(versionId: string | null) {
    if (!versionId) {
      setTemplateEntries([])
      return
    }
    const { data, error: err } = await supabase
      .from('price_book_entries')
      .select('*, fixture_types(name)')
      .eq('version_id', versionId)
    if (err) {
      setError(err.message)
      setTemplateEntries([])
      return
    }
    const entries = (data as PriceBookEntryWithFixture[]) ?? []
    entries.sort((a, b) => (a.fixture_types?.name ?? '').localeCompare(b.fixture_types?.name ?? '', undefined, { numeric: true }))
    setTemplateEntries(entries)
  }

  async function reloadPanelEntries() {
    await loadTemplateEntries(editingTemplateId)
  }

  async function reloadPanelVersions() {
    await loadTemplatePriceBookVersions()
  }

  // Entering Templates mode (or template list changing): default to the first template and load its entries.
  useEffect(() => {
    if (editingTemplateId && templatePriceBookVersions.some((t) => t.id === editingTemplateId)) {
      void loadTemplateEntries(editingTemplateId)
      return
    }
    const first = templatePriceBookVersions[0] ?? null
    setEditingTemplateId(first?.id ?? null)
    void loadTemplateEntries(first?.id ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templatePriceBookVersions])

  function selectPanelVersion(id: string) {
    setEditingTemplateId(id)
    void loadTemplateEntries(id)
  }

  // Version-form openers (the modal's Save branches on `pricingFormMode`).
  function openAddTemplate() {
    setEditingPricingVersion(null)
    setPricingFormMode('template')
    setPricingCloneSourceId(null)
    setPricingVersionNameInput('')
    setError(null)
    setPricingVersionFormOpen(true)
  }

  function resolvePricingEntryForCountRow(countRowId: string): PriceBookEntryWithFixture | null {
    return resolvePricingEntry({
      countRowId,
      versionId: selectedPricingVersionId,
      assignments: bidPricingAssignments,
      entries: priceBookEntries,
      countRows: pricingCountRows,
    })
  }

  async function savePricingAssignment(countRowId: string, priceBookEntryId: string) {
    if (!guardPricingWrite()) return
    const bidId = selectedBidForPricing?.id
    const versionId = selectedPricingVersionId
    if (!bidId || !versionId) return
    const existing = bidPricingAssignments.find((a) => a.count_row_id === countRowId && a.price_book_version_id === versionId)
    if (existing) {
      const { error: err } = await supabase
        .from('bid_pricing_assignments')
        .update({ price_book_entry_id: priceBookEntryId })
        .eq('id', existing.id)
      if (err) setError(err.message)
      else {
        await loadBidPricingAssignments(bidId, versionId)
        await freezeSharedPricingAfterWrite()
      }
    } else {
      const { error: err } = await supabase
        .from('bid_pricing_assignments')
        .insert({ bid_id: bidId, count_row_id: countRowId, price_book_entry_id: priceBookEntryId, price_book_version_id: versionId })
      if (err) setError(err.message)
      else {
        await loadBidPricingAssignments(bidId, versionId)
        await freezeSharedPricingAfterWrite()
      }
    }
  }

  async function removePricingAssignment(countRowId: string) {
    if (!guardPricingWrite()) return
    const bidId = selectedBidForPricing?.id
    const versionId = selectedPricingVersionId
    if (!bidId || !versionId) return
    const existing = bidPricingAssignments.find((a) => a.count_row_id === countRowId && a.price_book_version_id === versionId)
    if (!existing) return
    const { error: err } = await supabase.from('bid_pricing_assignments').delete().eq('id', existing.id)
    if (err) setError(err.message)
    else {
      await loadBidPricingAssignments(bidId, versionId)
      await freezeSharedPricingAfterWrite()
    }
  }

  /** One row's price write (no reload) — shared by the single-row editor and the margin bulk apply (v2.1769). */
  async function writeUnitPriceOverrideRow(countRowId: string, value: number | null): Promise<{ message: string } | null> {
    const bidId = selectedBidForPricing?.id
    const versionId = selectedPricingVersionId
    if (!bidId || !versionId) return { message: 'No bid or pricing version selected' }
    const existing = bidPricingAssignments.find((a) => a.count_row_id === countRowId && a.price_book_version_id === versionId)
    const entry = resolvePricingEntryForCountRow(countRowId)
    const existingCustom = bidCountRowCustomPrices.find((c) => c.count_row_id === countRowId && c.price_book_version_id === versionId)

    if (existing) {
      const res = await supabase.from('bid_pricing_assignments').update({ unit_price_override: value }).eq('id', existing.id)
      if (res.error) return res.error
      if (existingCustom) {
        await supabase.from('bid_count_row_custom_prices').delete().eq('id', existingCustom.id)
      }
      return null
    }
    if (entry) {
      const res = await supabase.from('bid_pricing_assignments').insert({
        bid_id: bidId,
        count_row_id: countRowId,
        price_book_entry_id: entry.id,
        price_book_version_id: versionId,
        unit_price_override: value,
      })
      if (res.error) return res.error
      if (existingCustom) {
        await supabase.from('bid_count_row_custom_prices').delete().eq('id', existingCustom.id)
      }
      return null
    }
    if (value == null) {
      if (existingCustom) {
        const res = await supabase.from('bid_count_row_custom_prices').delete().eq('id', existingCustom.id)
        return res.error
      }
      return null
    }
    const res = existingCustom
      ? await supabase.from('bid_count_row_custom_prices').update({ unit_price: value }).eq('id', existingCustom.id)
      : await supabase.from('bid_count_row_custom_prices').insert({ bid_id: bidId, count_row_id: countRowId, price_book_version_id: versionId, unit_price: value })
    return res.error
  }

  function openEditPricingVersion(v: PriceBookVersion) {
    setEditingPricingVersion(v)
    setPricingVersionNameInput(v.name)
    setPricingVersionFormOpen(true)
  }

  function closePricingVersionForm() {
    setPricingVersionFormOpen(false)
    setEditingPricingVersion(null)
    setPricingVersionNameInput('')
  }

  async function savePricingVersion(e: React.FormEvent) {
    e.preventDefault()
    const name = pricingVersionNameInput.trim()
    if (!name) return

    // Duplicate-name guard within the relevant list (templates vs this bid's Pricings).
    const dupScope = editingPricingVersion || pricingFormMode === 'template' ? templatePriceBookVersions : priceBookVersions
    const isDuplicate = dupScope.some((v) =>
      v.name.toLowerCase() === name.toLowerCase() &&
      v.id !== editingPricingVersion?.id
    )
    if (editingPricingVersion || pricingFormMode === 'template') {
      if (isDuplicate) {
        setError(`A ${pricingFormMode === 'template' ? 'price book' : 'pricing'} named "${name}" already exists. Please use a different name.`)
        return
      }
    }

    setSavingPricingVersion(true)
    setError(null)

    // Rename (templates or Pricings).
    if (editingPricingVersion) {
      const { error: err } = await supabase.from('price_book_versions').update({ name }).eq('id', editingPricingVersion.id)
      if (err) setError(err.message)
      else {
        await reloadPanelVersions()
        closePricingVersionForm()
      }
      setSavingPricingVersion(false)
      return
    }

    // New TEMPLATE (shared master catalog).
    if (pricingFormMode === 'template') {
      const { data, error: err } = await supabase
        .from('price_book_versions')
        .insert({ name, service_type_id: selectedServiceTypeId, bid_id: null })
        .select('id')
        .single()
      if (err) setError(err.message)
      else {
        await loadTemplatePriceBookVersions()
        const newId = (data as { id: string } | null)?.id ?? null
        setEditingTemplateId(newId)
        await loadTemplateEntries(newId)
        closePricingVersionForm()
      }
      setSavingPricingVersion(false)
      return
    }

    // New bid PRICING — blank or cloned from a template/Pricing.
    const bid = selectedBidForPricing
    if (!bid) {
      setError('Select a bid first')
      setSavingPricingVersion(false)
      return
    }
    let newId: string | null = null
    if (pricingFormMode === 'pricing-clone' && pricingCloneSourceId) {
      const { data, error: err } = await supabase.rpc('clone_price_book_version_to_bid', {
        p_source_version_id: pricingCloneSourceId,
        p_bid_id: bid.id,
        p_name: name,
      })
      if (err) { setError(err.message); setSavingPricingVersion(false); return }
      newId = (data as string) ?? null
      // "From template" updates the user's default; "Duplicate another version" (a bid-owned
      // source, not in the template list) does not.
      if (templatePriceBookVersions.some((t) => t.id === pricingCloneSourceId)) {
        rememberLastPriceBookTemplate(pricingCloneSourceId)
      }
    } else {
      const { data, error: err } = await supabase
        .from('price_book_versions')
        .insert({ name, service_type_id: bid.service_type_id, bid_id: bid.id, sort_order: nextSortOrder(priceBookVersions) })
        .select('id')
        .single()
      if (err) { setError(err.message); setSavingPricingVersion(false); return }
      newId = (data as { id: string } | null)?.id ?? null
    }
    await attachAndActivateNewBidPricing(bid.id, newId)
    closePricingVersionForm()
    setSavingPricingVersion(false)
  }

  function openDeletePricingVersionModal(v: PriceBookVersion) {
    setPricingVersionToDelete(v)
    setDeletePricingVersionNameInput('')
    setDeletePricingVersionError(null)
    setDeletePricingVersionModalOpen(true)
  }

  async function confirmDeletePricingVersion() {
    if (!pricingVersionToDelete) {
      setDeletePricingVersionModalOpen(false)
      return
    }
    const expected = pricingVersionToDelete.name.trim()
    const typed = deletePricingVersionNameInput.trim()
    if (typed !== expected) {
      setDeletePricingVersionError('Name does not match. Type the scenario name exactly to confirm.')
      return
    }
    // Backstop for every door into this modal: a scenario some packet's ★ is built on
    // never deletes, no matter which packet the session is viewing (BP384, 2026-08-27).
    const starredBy = versionStarringScenario(bidVersions, pricingVersionToDelete.id)
    if (starredBy) {
      setDeletePricingVersionError(`${gcNameForVersion(starredBy.id)}'s letter is built on this price — star another price for that packet first.`)
      return
    }
    // The ★ the letter reads can be a version's first price when its saved ★ is another
    // version's (v2.4377) — no trigger guards that one, so this does.
    if (selectedBidVersionId && pricingVersionToDelete.id === customerFacingPricingId) {
      setDeletePricingVersionError("The GC's letter is built on this price — make another price the base first.")
      return
    }

    const { error: err } = await supabase
      .from('price_book_versions')
      .delete()
      .eq('id', pricingVersionToDelete.id)
    if (err) {
      setDeletePricingVersionError(err.message)
      return
    }

    await reloadPanelVersions()
    if (editingTemplateId === pricingVersionToDelete.id) {
      setEditingTemplateId(null)
      setTemplateEntries([])
    }
    if (selectedPricingVersionId === pricingVersionToDelete.id) {
      // Open the ★ instead. This used to re-pick the lowest sort_order price on the WHOLE bid
      // and save it as the active version's ★ — another version's price, as on BP385 and
      // BP384 (v2.4377). Deleting a price never moves a version's ★ now.
      const remaining = (selectedBidForPricing ? await loadBidPricings(selectedBidForPricing.id) : []) ?? []
      const next = afterOpenPriceDeleted({
        deletedId: pricingVersionToDelete.id,
        activeVersion: selectedBidVersionId ? (bidVersions.find((v) => v.id === selectedBidVersionId) ?? { id: selectedBidVersionId }) : null,
        remaining,
        bidSavedPricingId: selectedBidForPricing?.selected_price_book_version_id ?? null,
      })
      setSelectedPricingVersionId(next.viewId)
      if (!next.viewId) setPriceBookEntries([])
      if (selectedBidForPricing && next.saveStarId !== undefined) {
        await saveBidSelectedPriceBookVersion(selectedBidForPricing.id, next.saveStarId)
        await loadBids()
      }
    }

    setDeletePricingVersionModalOpen(false)
    setPricingVersionToDelete(null)
    setDeletePricingVersionNameInput('')
    setDeletePricingVersionError(null)
  }

  function openNewPricingEntry() {
    setEditingPricingEntry(null)
    setPricingEntryFixtureName('')
    setPricingEntryRoughIn('')
    setPricingEntryTopOut('')
    setPricingEntryTrimSet('')
    setPricingEntryTotal('')
    setPricingEntryCombinedPrice('')
    setError(null)
    setPricingEntryFormOpen(true)
  }

  /**
   * Add-from-the-assign-search (v2.2398, Wendi: "need ability to add new from dropdown
   * like on the old page"): opens the entry form pre-filled with the search term and
   * targets the bid's ACTIVE pricing — the set the assign dropdowns actually search.
   * (The panel form targets the template catalog since the drawer rework, so an entry
   * added there never appeared back in the dropdown.)
   */
  function openAddEntryFromAssignSearch(term: string) {
    setEditingPricingEntry(null)
    setPricingEntryFixtureName(term.trim())
    setPricingEntryRoughIn('')
    setPricingEntryTopOut('')
    setPricingEntryTrimSet('')
    setPricingEntryTotal('')
    setPricingEntryCombinedPrice('')
    setEntryFormTargetPricing(true)
    setError(null)
    setPricingEntryFormOpen(true)
    setPricingAssignmentDropdownOpen(null)
  }

  function openEditPricingEntry(entry: PriceBookEntryWithFixture) {
    setEditingPricingEntry(entry)
    setPricingEntryFixtureName(entry.fixture_types?.name ?? '')
    setPricingEntryRoughIn(String(entry.rough_in_price))
    setPricingEntryTopOut(String(entry.top_out_price))
    setPricingEntryTrimSet(String(entry.trim_set_price))
    setPricingEntryTotal(String(entry.total_price))
    setPricingEntryCombinedPrice(String(entry.total_price))
    setError(null)
    setPricingEntryFormOpen(true)
  }

  function closePricingEntryForm() {
    setPricingEntryFormOpen(false)
    setEditingPricingEntry(null)
    setPricingEntryFixtureName('')
    setPricingEntryRoughIn('')
    setPricingEntryTopOut('')
    setPricingEntryTrimSet('')
    setPricingEntryTotal('')
    setPricingEntryCombinedPrice('')
    setEntryFormTargetPricing(false)
    setError(null)
  }

  /**
   * v2.2444: the drawer's ✎ and Add entry write to the SHARED book. A bid prices from a frozen
   * copy of that book (same name, different rows), so the edit stops there unless someone carries
   * it across. After each book save, park the offer to do exactly that for the bid on screen.
   * Silence when no bid is open, or when its copy already agrees.
   */
  async function noteBookEditForOpenBid(fixtureTypeId: string, fixtureName: string, prices: BookEntryPrices) {
    if (entryFormTargetPricing) return // that save already landed in the bid's own copy
    const token = ++bookOfferTokenRef.current
    const offer = planBookEditBidOffer({
      fixtureTypeId,
      fixtureName,
      book: prices,
      bidEntries: priceBookEntries.map((entry) => ({
        id: entry.id,
        fixture_type_id: entry.fixture_type_id,
        rough_in_price: Number(entry.rough_in_price),
        top_out_price: Number(entry.top_out_price),
        trim_set_price: Number(entry.trim_set_price),
        total_price: Number(entry.total_price),
      })),
      hasActiveBidPricing: selectedBidForPricing != null && selectedPricingVersionId != null,
      // An update offer is a same-book sync — never offered from a book this bid doesn't price
      // from. When the lineage is unknowable (no template resolves), any book may offer.
      editedBookFeedsThisBid: currentPriceBookTemplateId == null || editingTemplateId === currentPriceBookTemplateId,
    })
    if (!offer) {
      setPendingBookOffer(null)
      return
    }
    // "On this bid" means the bid: the update also covers sibling pricings (alternates, other GC
    // packets) whose copy still holds the viewed copy's exact stale prices — identical values are
    // inherited values; anything re-priced on purpose won't match and is left alone (v2.2445).
    let siblingEntryIds: string[] = []
    let siblingPricingCount = 0
    if (offer.kind === 'update') {
      const stale = priceBookEntries.find((entry) => entry.id === offer.bidEntryId)
      const siblingIds = priceBookVersions.map((v) => v.id).filter((id) => id !== selectedPricingVersionId)
      if (stale && siblingIds.length > 0) {
        const { data } = await supabase
          .from('price_book_entries')
          .select('id, version_id, rough_in_price, top_out_price, trim_set_price, total_price')
          .eq('fixture_type_id', fixtureTypeId)
          .in('version_id', siblingIds)
        // A failed fetch just narrows the offer to the viewed pricing — never blocks it.
        const carry = planSiblingCarry({
          stale: {
            rough_in_price: Number(stale.rough_in_price),
            top_out_price: Number(stale.top_out_price),
            trim_set_price: Number(stale.trim_set_price),
            total_price: Number(stale.total_price),
          },
          siblingEntries: ((data as Array<{ id: string; version_id: string } & BookEntryPrices> | null) ?? []).map((e) => ({
            ...e,
            rough_in_price: Number(e.rough_in_price),
            top_out_price: Number(e.top_out_price),
            trim_set_price: Number(e.trim_set_price),
            total_price: Number(e.total_price),
          })),
        })
        siblingEntryIds = carry.entryIds
        siblingPricingCount = carry.pricingIds.length
      }
    }
    if (token !== bookOfferTokenRef.current) return // context moved on while we fetched
    setPendingBookOffer({ offer, fixtureTypeId, prices, siblingEntryIds, siblingPricingCount })
  }

  /**
   * Carry the parked book edit into the bid's own copy. Assignments already point at the copy's
   * entry id, so an updated price re-prices every assigned row with no re-assigning; an added
   * entry simply starts turning up in the assign dropdowns.
   */
  async function applyPendingBookOffer() {
    if (!guardPricingWrite()) return
    const pending = pendingBookOffer
    const versionId = selectedPricingVersionId
    if (!pending || !versionId || applyingBookOffer) return
    setApplyingBookOffer(true)
    try {
      const { offer, fixtureTypeId, prices } = pending
      if (offer.kind === 'update') {
        const { error: err } = await supabase
          .from('price_book_entries')
          .update(prices)
          .in('id', [offer.bidEntryId, ...pending.siblingEntryIds])
        if (err) {
          setError(err.message)
          return
        }
      } else {
        const maxSeq = priceBookEntries.length === 0 ? 0 : Math.max(...priceBookEntries.map((entry) => entry.sequence_order))
        const { error: err } = await supabase
          .from('price_book_entries')
          .insert({ version_id: versionId, fixture_type_id: fixtureTypeId, ...prices, sequence_order: maxSeq + 1 })
        if (err) {
          setError(err.message)
          return
        }
      }
      await loadPriceBookEntries(versionId)
      setPendingBookOffer(null)
      showToast(
        offer.kind === 'update'
          ? `This bid now prices ${offer.fixtureName} at $${formatCurrency(offer.bookTotal)}${
              pending.siblingPricingCount > 0
                ? ` — across ${pending.siblingPricingCount + 1} price option${pending.siblingPricingCount + 1 === 1 ? '' : 's'}`
                : ''
            }.`
          : `${offer.fixtureName} added to this bid's book — it will come up when you assign.`,
        'success',
      )
    } finally {
      setApplyingBookOffer(false)
    }
  }

  async function savePricingEntry(e: React.FormEvent) {
    // An entry added straight into the bid's own pricing is a pricing write; a shared-book edit is not.
    if (entryFormTargetPricing && !editingPricingEntry && !guardPricingWrite()) {
      e.preventDefault()
      return
    }
    e.preventDefault()
    const targetVersionId = entryFormTargetPricing ? selectedPricingVersionId : panelVersionId
    if (!targetVersionId) {
      setError(entryFormTargetPricing ? 'No pricing selected' : 'No template selected')
      return
    }
    const fixtureName = pricingEntryFixtureName.trim()
    if (!fixtureName) {
      setError('Please enter a fixture type')
      return
    }
    setSavingPricingEntry(true)
    setError(null)

    // Get or auto-create fixture type (use bid's service type when on Pricing tab for robustness)
    const result = await getOrCreateFixtureTypeId(fixtureName, selectedBidForPricing?.service_type_id)
    if (!result.id) {
      const errMsg = ('error' in result ? result.error : null) ?? `Failed to create or find fixture type "${fixtureName}"`
      setError(errMsg)
      setSavingPricingEntry(false)
      return
    }
    const fixtureTypeId = result.id

    const rough = parseFloat(pricingEntryRoughIn) || 0
    const top = parseFloat(pricingEntryTopOut) || 0
    const trim = parseFloat(pricingEntryTrimSet) || 0
    const total = parseFloat(pricingEntryTotal) || 0
    if (editingPricingEntry) {
      const { error: err } = await supabase
        .from('price_book_entries')
        .update({ fixture_type_id: fixtureTypeId, rough_in_price: rough, top_out_price: top, trim_set_price: trim, total_price: total })
        .eq('id', editingPricingEntry.id)
      if (err) setError(err.message)
      else {
        await reloadPanelEntries()
        void noteBookEditForOpenBid(fixtureTypeId, fixtureName, { rough_in_price: rough, top_out_price: top, trim_set_price: trim, total_price: total })
        closePricingEntryForm()
      }
    } else {
      const seqBase = entryFormTargetPricing ? priceBookEntries : panelEntries
      const maxSeq = seqBase.length === 0 ? 0 : Math.max(...seqBase.map((e) => e.sequence_order))
      const { error: err } = await supabase
        .from('price_book_entries')
        .insert({ version_id: targetVersionId, fixture_type_id: fixtureTypeId, rough_in_price: rough, top_out_price: top, trim_set_price: trim, total_price: total, sequence_order: maxSeq + 1 })
      if (err) setError(err.message)
      else {
        if (entryFormTargetPricing) {
          await loadPriceBookEntries(selectedPricingVersionId)
          await freezeSharedPricingAfterWrite()
        } else await reloadPanelEntries()
        void noteBookEditForOpenBid(fixtureTypeId, fixtureName, { rough_in_price: rough, top_out_price: top, trim_set_price: trim, total_price: total })
        closePricingEntryForm()
      }
    }
    setSavingPricingEntry(false)
  }

  /** Returns false when the user cancels the confirm, true once they confirm (even if the delete errors). */
  async function deletePricingEntry(entry: PriceBookEntryWithFixture) {
    if (
      !(await confirmDialog({
        message: `Delete "${entry.fixture_types?.name ?? ''}" from this price book?`,
        confirmLabel: 'Delete',
        danger: true,
      }))
    )
      return false
    const { error: err } = await supabase.from('price_book_entries').delete().eq('id', entry.id)
    if (err) setError(err.message)
    else await reloadPanelEntries()
    return true
  }

  async function handlePricingVersionChange(bidId: string, versionId: string) {
    // A solver preview belongs to the scenario it was solved on — counts are
    // shared across scenarios, so it must never Apply onto another one. The
    // stash keys previews by version id, and the restore effect swaps in the
    // incoming scenario's own preview (usually none). The landing chip is not
    // stashed — it describes the solve that built THIS preview, so it clears.
    setWbSolveLanding(null)
    setSelectedPricingVersionId(versionId)
    await loadPriceBookEntries(versionId)
    await saveBidSelectedPriceBookVersion(bidId, versionId)
  }

  /**
   * Wire a freshly-created bid pricing into the active Version and make it the live pricing:
   * stamp `bid_version_id` (so it isn't a version-less orphan), reload the bid's pricings, then
   * activate + persist + load its entries. Shared by the "Set up pricing" modal and the toolbar
   * price-book dropdown.
   */
  async function attachAndActivateNewBidPricing(bidId: string, newId: string | null) {
    if (newId && selectedBidVersionId) {
      await supabase.from('price_book_versions').update({ bid_version_id: selectedBidVersionId }).eq('id', newId)
    }
    await loadBidPricings(bidId)
    if (newId) {
      setSelectedPricingVersionId(newId)
      await saveBidSelectedPriceBookVersion(bidId, newId)
      await loadPriceBookEntries(newId)
    }
  }

  /**
   * The first price on a bid freezes it. Until someone picks a book, `deriveActivePricingId`
   * shows a shared template's prices and every write keys to that template — so a bid sent in
   * that state re-priced with every book edit (BP483: 42 rows on the shared Default, no copy).
   * Call this after any write keyed to `selectedPricingVersionId`: when that id is a shared
   * template, clone it into the bid (the RPC carries the bid's template-keyed rows onto the
   * copy, entry ids remapped) and make the copy the live pricing, so the next write — and every
   * book edit from now on — stops at the copy. A bid-owned copy, a robot template (the twin
   * fence lives there) and an id we cannot place are left alone. The template-keyed rows stay
   * behind, inert, as the v2.2720 backfill left them.
   */
  async function freezeSharedPricingAfterWrite(): Promise<void> {
    const bid = selectedBidForPricing
    if (!bid || freezingPricingRef.current) return
    const target = resolvePricingWriteTarget({ selectedPricingVersionId, bidPricings: priceBookVersions, templates: templatePriceBookVersions })
    if (!needsFreezeAfterWrite(target)) return
    freezingPricingRef.current = true
    try {
      const newId = await cloneTemplateIntoBidAndActivate(target.versionId, target.name)
      if (!newId) return
      await loadBidPricingAssignments(bid.id, newId)
      showToast(`Took this bid's own copy of ${target.name} — edits to the shared book won't reach it.`, 'success')
    } finally {
      freezingPricingRef.current = false
    }
  }

  /** Clone a price-book version (template or other pricing) into the active bid and activate it. */
  async function cloneTemplateIntoBidAndActivate(sourceVersionId: string, name: string): Promise<string | null> {
    const bid = selectedBidForPricing
    if (!bid) { setError('Select a bid first'); return null }
    const { data, error: err } = await supabase.rpc('clone_price_book_version_to_bid', {
      p_source_version_id: sourceVersionId,
      p_bid_id: bid.id,
      p_name: name,
    })
    if (err) { setError(err.message); return null }
    const newId = (data as string) ?? null
    await attachAndActivateNewBidPricing(bid.id, newId)
    return newId
  }

  /**
   * Toolbar dropdown: price the bid against a shared template by cloning it in as an editable
   * copy. If the active Version already owns a copy from this template, just switch to it (no
   * duplicate). Matches on `bid_version_id` so split-bid versions stay independent.
   */
  async function onSelectPriceBookTemplate(templateId: string) {
    const bid = selectedBidForPricing
    if (!bid || pricebookSwitchBusy) return
    setPricebookSwitchBusy(true)
    rememberLastPriceBookTemplate(templateId)
    try {
      // v2.2396: match by lineage ROOT, not direct source — scenarios born from version
      // clones / "+ Add price" duplicates point at another scenario, and the old direct
      // match minted a fresh copy every time Wendi switched back to her own book.
      const templateIds = templatePriceBookVersions.map((t) => t.id)
      const existing = priceBookVersions.find(
        (p) =>
          (selectedBidVersionId ? p.bid_version_id === selectedBidVersionId : p.bid_version_id == null) &&
          resolvePriceBookTemplateRoot({ pricingId: p.id, bidPricings: priceBookVersions, templateIds, templates: templatePriceBookVersions }) ===
            templateId,
      )
      if (existing) {
        await handlePricingVersionChange(bid.id, existing.id)
        return
      }
      const tmpl = templatePriceBookVersions.find((t) => t.id === templateId)
      await cloneTemplateIntoBidAndActivate(templateId, tmpl?.name ?? 'Pricing')
    } finally {
      setPricebookSwitchBusy(false)
    }
  }

  /** The per-scenario inputs for a scenario that isn't the one on screen — `lib/bids/loadScenarioInputs` (v2.3856), with this tab's scenarios and on-screen version. */
  function loadScenarioInputsFor(bidId: string, pricingId: string): Promise<ScenarioInputs> {
    return loadScenarioInputs(supabase, { bidId, pricingId, scenarioBidVersionId: scenarioBidVersionIdOf(priceBookVersions, pricingId), selectedBidVersionId })
  }
  const bidsScopedForPricing = onlyMyBids ? bids.filter(isMyBid) : bids
  const filteredBidsForPricing: BidWithBuilder[] = filterBidsForPicker(bidsScopedForPricing, pricingSearchQuery, ledgerPrefixMap)

  // Iteration 2 — per-scenario revenue for each card, each scenario priced on its own bid
  // version's rows (the read sits where its effect stood).
  const wbScenarioRevenue = useScenarioCardRevenues({
    bidId: selectedBidForPricing?.id,
    selectedBidVersionId,
    priceBookVersions,
    pricingCountRows,
    bidPricingAssignments,
    bidCountRowCustomPrices,
  })

  // Iteration 3 — win/loss calibration history for this service type (the read sits where its
  // effect stood, so the tab's effects run in the order they did).
  const wbHistory = usePricingMarginHistory(selectedServiceTypeId)
  // v2.4448: the header slot "Bids like this" is portalled into (a state, not a ref, so the
  // first render after the slot mounts draws the chips).
  const [bidsLikeThisSlot, setBidsLikeThisSlot] = useState<HTMLSpanElement | null>(null)
  // v2.4395: the version's materials at today's book, one line under the sent-vs-today line.
  const materialsToday = useTakeoffPriceDrift({ bidId: selectedBidForPricing?.id, versionId: selectedBidVersionId, enabled: !!selectedBidForPricing })

  /**
   * Workbench view/★ split (v2.2013): the bid's saved `selected_price_book_version_id` is the
   * ★ customer-facing scenario (Cover Letter, Share, bid value); `selectedPricingVersionId` is
   * merely the scenario open on the Workbench. Card clicks only view; the star action persists.
   * Read the letter's way (v2.4377): a version's ★ is one of its own prices, so a saved ★ that
   * belongs to another version — or a stale bid-level one after a switch — never wins here.
   */
  const customerFacingPricingId = resolvedStarPricingId({
    activeVersionId: selectedBidVersionId,
    bidVersions,
    bidPricings: priceBookVersions,
    bidSavedPricingId: selectedBidForPricing?.selected_price_book_version_id ?? null,
  })

  /** View a scenario without touching what the customer sees. The outgoing scenario's preview stays stashed under its own id. */
  function viewWorkbenchScenario(versionId: string) {
    if (wbPreview && Object.keys(wbPreview).length > 0) {
      showToast('Preview set aside — it’ll be here when you view this price again.', 'info')
    }
    setWbSolveLanding(null)
    setSelectedPricingVersionId(versionId)
    void loadPriceBookEntries(versionId)
  }

  /** The deliberate ★ action: confirm, then persist the scenario the customer sees. */
  async function makeScenarioCustomerFacing(v: { id: string; name: string }, revenue: number | null) {
    const bid = selectedBidForPricing
    if (!bid) return
    const amount = revenue != null ? `$${formatCurrency(revenue)}` : 'its current total'
    const gc = gcNameForVersion(selectedBidVersionId)
    const ok = await confirmDialog({
      title: `Make "${v.name}" the base price for ${gc}?`,
      message: `The Cover Letter, Share, Print, and the bid value will show ${amount}.`,
      confirmLabel: 'Make base',
    })
    if (!ok) return
    if (v.id !== selectedPricingVersionId) viewWorkbenchScenario(v.id)
    if (!(await saveBidSelectedPriceBookVersion(bid.id, v.id))) return
    // The base is never also an "offered alternate".
    await supabase.from('price_book_versions').update({ include_in_submission: false }).eq('id', v.id)
    await loadBidPricings(bid.id)
    showToast(`"${v.name}" is now ${gc}'s base price.`, 'success')
  }

  /** G1: offer (or stop offering) a non-base price to this GC as an alternate on their letter. */
  async function setScenarioOffered(v: { id: string; name: string }, offered: boolean) {
    const bid = selectedBidForPricing
    if (!bid) return
    const { error: err } = await supabase.from('price_book_versions').update({ include_in_submission: offered }).eq('id', v.id)
    if (err) { showToast('Could not update: ' + err.message, 'error'); return }
    await loadBidPricings(bid.id)
    const gc = shortGc(gcNameForVersion(selectedBidVersionId))
    showToast(offered ? `"${v.name}" offered to ${gc} as an alternate.` : `"${v.name}" no longer offered to ${gc}.`, 'success')
  }

  /* ---- Own-takeoff alternates (v2.2404, Wendi) ---- */
  /** Per alternate-version card data: its ★'s revenue on ITS counts, and its own pre-tax
      takeoff materials ('rough' model only — the exact model's POs are bid-wide). */
  const altVersionData = useAlternateVersionData({
    bidId: selectedBidForPricing?.id,
    selectedBidVersionId,
    bidVersions,
    loadInputs: loadScenarioInputsFor,
  })
  const [addOwnTakeoffOpen, setAddOwnTakeoffOpen] = useState<{ name: string } | null>(null)
  const [creatingOwnTakeoffAlt, setCreatingOwnTakeoffAlt] = useState(false)
  /** The ＋ Add price door's new choice: a same-GC version marked Alternate — its own
      counts + takeoff + prices, cloned from the active version (clone-all, v2.2395). */
  async function createOwnTakeoffAlternate(name: string) {
    const bid = selectedBidForPricing
    const trimmed = name.trim()
    if (!bid || !trimmed || creatingOwnTakeoffAlt) return
    setCreatingOwnTakeoffAlt(true)
    try {
      const activeVersion = selectedBidVersionId ? (bidVersions.find((v) => v.id === selectedBidVersionId) ?? null) : null
      const pricingSourceId = activeVersion?.starred_price_book_version_id ?? selectedPricingVersionId
      let newId: string | null = null
      if (!selectedBidVersionId) {
        // Unsplit bid: one atomic split — the current setup becomes the named base.
        const { data, error: err } = await supabase.rpc('split_bid_into_versions', {
          p_bid_id: bid.id,
          p_current_name: gcNameForVersion(null),
          p_new_name: trimmed,
          p_clone_pricing: true,
          p_pricing_source_version_id: pricingSourceId as string,
        })
        if (err) {
          showToast(`Could not create the alternate: ${err.message}`, 'error')
          return
        }
        newId = (data as string) ?? null
      } else {
        const { data, error: err } = await supabase.rpc('create_bid_version', {
          p_bid_id: bid.id,
          p_name: trimmed,
          p_source_bid_version_id: selectedBidVersionId,
          p_clone_pricing: true,
          p_pricing_source_version_id: pricingSourceId as string,
        })
        if (err) {
          showToast(`Could not create the alternate: ${err.message}`, 'error')
          return
        }
        newId = (data as string) ?? null
      }
      if (!newId) return
      const { error: stampErr } = await supabase
        .from('bid_versions')
        .update({ is_alternate: true, include_in_submission: true, customer_id: activeVersion?.customer_id ?? null })
        .eq('id', newId)
      if (stampErr) showToast(`Created, but couldn't mark it as an alternate: ${stampErr.message}`, 'error')
      await reloadBidVersions()
      window.dispatchEvent(new Event('bid-version-picker-reload'))
      setAddOwnTakeoffOpen(null)
      onSwitchBidVersion(newId)
      showToast(`"${trimmed}" created with its own takeoff — a copy of this bid's counts, takeoff and prices. Swap materials in Takeoffs; the margin follows.`, 'success')
    } finally {
      setCreatingOwnTakeoffAlt(false)
    }
  }

  /** G1: "Another price for this GC" — named clone of a scenario, optionally offered right away. */
  async function createPriceOption(name: string, fromId: string | null, offer: boolean) {
    const bid = selectedBidForPricing
    const source = priceBookVersions.find((p) => p.id === (fromId ?? selectedPricingVersionId))
    if (!bid || !source) return
    setWbCloning(true)
    try {
      const { data, error: err } = await supabase.rpc('clone_price_book_version_to_bid', { p_source_version_id: source.id, p_bid_id: bid.id, p_name: name })
      if (err) { setError(err.message); return }
      const newId = (data as string) ?? null
      if (newId) {
        const patch: { bid_version_id?: string; include_in_submission: boolean } = { include_in_submission: offer }
        if (selectedBidVersionId) patch.bid_version_id = selectedBidVersionId
        await supabase.from('price_book_versions').update(patch).eq('id', newId)
      }
      await loadBidPricings(bid.id)
      if (newId) viewWorkbenchScenario(newId)
      const gc = shortGc(gcNameForVersion(selectedBidVersionId))
      showToast(offer ? `"${name}" created from ${source.name} — offered to ${gc} as an alternate.` : `"${name}" created from ${source.name}.`, 'success')
      setAddPriceOpen(null)
    } finally {
      setWbCloning(false)
    }
  }

  /**
   * Re-key a just-cloned pricing's count-row children (custom prices, assignments,
   * submission hides) from the SOURCE version's rows onto the TARGET version's rows,
   * matched by fixture name (v2.2405). Without this the clone points at rows the
   * target packet's grid never shows and the copy lands as "No prices yet" (Wendi's
   * BP384). Children whose row has no unique same-named counterpart are deleted —
   * a price for a row this packet doesn't carry belongs to nobody.
   */
  async function rekeyClonedPricingToVersion(
    bidId: string,
    pricingId: string,
    sourceBidVersionId: string,
    targetBidVersionId: string,
  ): Promise<{ matched: number; dropped: number } | null> {
    const loadRows = async (versionId: string) => {
      const { data, error: err } = await supabase
        .from('bids_count_rows')
        .select('id, fixture, group_tag')
        .eq('bid_id', bidId)
        .eq('bid_version_id', versionId)
      if (err) {
        setError(err.message)
        return null
      }
      return (data ?? []) as Array<{ id: string; fixture: string | null; group_tag: string | null }>
    }
    const sourceRows = await loadRows(sourceBidVersionId)
    const targetRows = await loadRows(targetBidVersionId)
    if (!sourceRows || !targetRows) return null
    // v2.4194: a fixture that sits in the base and in an alternate pairs within its scope.
    const scopeTags = selectedBidForPricing?.alternate_group_tags ?? []
    const rowMap = mapCountRowsByFixture(sourceRows, targetRows, (r) => alternateScopeKey({ group_tag: r.group_tag ?? null }, scopeTags))
    let matched = 0
    let dropped = 0
    for (const table of ['bid_count_row_custom_prices', 'bid_pricing_assignments', 'bid_count_row_submission_hides'] as const) {
      const { data, error: err } = await supabase
        .from(table)
        .select('count_row_id')
        .eq('price_book_version_id', pricingId)
      if (err) {
        setError(err.message)
        return null
      }
      for (const child of (data ?? []) as Array<{ count_row_id: string }>) {
        const targetRowId = rowMap.get(child.count_row_id)
        if (targetRowId) {
          const { error: upErr } = await supabase
            .from(table)
            .update({ count_row_id: targetRowId })
            .eq('price_book_version_id', pricingId)
            .eq('count_row_id', child.count_row_id)
          if (upErr) {
            setError(upErr.message)
            return null
          }
          if (table === 'bid_count_row_custom_prices') matched++
        } else {
          const { error: delErr } = await supabase
            .from(table)
            .delete()
            .eq('price_book_version_id', pricingId)
            .eq('count_row_id', child.count_row_id)
          if (delErr) {
            setError(delErr.message)
            return null
          }
          if (table === 'bid_count_row_custom_prices') dropped++
        }
      }
    }
    return { matched, dropped }
  }

  /** G1: a GC with no prices yet starts from another GC's base price (clone of that version's ★). */
  async function copyBasePriceFromVersion(sourceVersionId: string) {
    const bid = selectedBidForPricing
    const src = bidVersions.find((v) => v.id === sourceVersionId)
    const starId = src?.starred_price_book_version_id ?? null
    const star = starId ? priceBookVersions.find((p) => p.id === starId) : null
    if (!bid || !star || !selectedBidVersionId) return
    setCopyingGcPrice(true)
    try {
      const newId = await cloneTemplateIntoBidAndActivate(star.id, star.name)
      if (!newId) return
      // Each version owns its OWN count rows (v2.2132) — re-key the clone's prices
      // onto THIS packet's rows by fixture name or the copy is invisible (v2.2405).
      const rekey = await rekeyClonedPricingToVersion(bid.id, newId, sourceVersionId, selectedBidVersionId)
      await Promise.all([loadBidPricingAssignments(bid.id, newId), reloadPricingForBid(bid.id)])
      const gcFrom = gcNameForVersion(sourceVersionId)
      const gcTo = gcNameForVersion(selectedBidVersionId)
      if (rekey && rekey.dropped > 0) {
        showToast(
          `Copied ${gcFrom}'s base price into ${gcTo} — ${rekey.matched} price${rekey.matched === 1 ? '' : 's'} matched this packet's counts; ${rekey.dropped} had no matching row here.`,
          'info',
        )
      } else {
        showToast(`Copied ${gcFrom}'s base price into ${gcTo} — now its base.`, 'success')
      }
    } finally {
      setCopyingGcPrice(false)
    }
  }

  /**
   * Fill the VIEWED (empty) scenario with another scenario's effective prices. Computes the
   * source's per-row prices with the shared calc kernel, then writes them through the same
   * per-row override path as hand-typing each one.
   *
   * A source from ANOTHER packet keys its assignments/custom prices to that version's own
   * count rows (v2.2132), so it must be computed against THOSE rows and re-keyed onto this
   * packet's rows by fixture name — same repair as copyBasePriceFromVersion (v2.2405).
   */
  async function copyPricesIntoViewedScenario(sourceId: string) {
    if (!guardPricingWrite()) return
    const bid = selectedBidForPricing
    const targetId = selectedPricingVersionId
    if (!bid || !targetId || targetId === sourceId) return
    setWbCopyingPrices(true)
    try {
      const sourceBidVersionId = priceBookVersions.find((p) => p.id === sourceId)?.bid_version_id ?? null
      const crossVersion = sourceBidVersionId != null && sourceBidVersionId !== selectedBidVersionId
      let sourceCountRows: Array<{ id: string; fixture: string | null; count: number | string | null; group_tag: string | null }> = pricingCountRows
      if (crossVersion) {
        const { data, error: err } = await supabase
          .from('bids_count_rows')
          .select('id, fixture, count, group_tag')
          .eq('bid_id', bid.id)
          .eq('bid_version_id', sourceBidVersionId)
        if (err) {
          setError(err.message)
          return
        }
        sourceCountRows = (data ?? []) as Array<{ id: string; fixture: string | null; count: number | string | null; group_tag: string | null }>
      }
      const [entriesRes, assignRes, customRes] = await Promise.all([
        supabase.from('price_book_entries').select('*, fixture_types(name)').eq('version_id', sourceId),
        supabase.from('bid_pricing_assignments').select('*').eq('bid_id', bid.id).eq('price_book_version_id', sourceId),
        supabase.from('bid_count_row_custom_prices').select('*').eq('bid_id', bid.id).eq('price_book_version_id', sourceId),
      ])
      // Prices only, on the source's own rows; the reads above are already scoped to sourceId (v2.3853: the one kernel).
      const result = scenarioPricingRows({
        scenarioId: sourceId,
        countRows: sourceCountRows,
        entries: (entriesRes.data as PriceBookEntryWithFixture[]) ?? [],
        assignments: (assignRes.data as BidPricingAssignment[]) ?? [],
        customPrices: (customRes.data as BidCountRowCustomPrice[]) ?? [],
      })
      const scopeTags = selectedBidForPricing?.alternate_group_tags ?? []
      const rowMap = crossVersion
        ? mapCountRowsByFixture(
            sourceCountRows.map((r) => ({ id: r.id, fixture: r.fixture, group_tag: r.group_tag })),
            pricingCountRows.map((r) => ({ id: r.id, fixture: r.fixture, group_tag: r.group_tag })),
            (r) => alternateScopeKey({ group_tag: r.group_tag ?? null }, scopeTags),
          )
        : null
      let copied = 0
      let dropped = 0
      for (const row of result.rows) {
        if (!(row.unitPrice > 0)) continue
        const targetRowId = rowMap ? rowMap.get(row.countRow.id) ?? null : row.countRow.id
        if (!targetRowId) {
          dropped++
          continue
        }
        const err = await writeUnitPriceOverrideRow(targetRowId, row.unitPrice)
        if (err) {
          setError(err.message)
          return
        }
        copied++
      }
      await loadBidPricingAssignments(bid.id, targetId)
      await freezeSharedPricingAfterWrite()
      const sourceName = priceBookVersions.find((p) => p.id === sourceId)?.name ?? 'the other scenario'
      if (copied > 0 && dropped > 0) {
        showToast(`Copied ${copied} price${copied !== 1 ? 's' : ''} from "${sourceName}" — ${dropped} had no matching row in this packet's counts.`, 'info')
      } else if (copied > 0) {
        showToast(`Copied ${copied} price${copied !== 1 ? 's' : ''} from "${sourceName}".`, 'success')
      } else if (dropped > 0) {
        showToast(`"${sourceName}" prices matched none of this packet's count rows — nothing copied.`, 'error')
      } else {
        showToast(`"${sourceName}" has no prices to copy.`, 'error')
      }
    } finally {
      setWbCopyingPrices(false)
    }
  }

  /** Iteration 2 — duplicate a Pricing as a fresh scenario and VIEW it (the ★ stays put). */
  /** Workbench: assign every exact-name book match in one batch (v2.2060). */
  async function fillMatchingBookEntries(matches: BookEntryMatch[]) {
    if (!guardPricingWrite()) return
    const bidId = selectedBidForPricing?.id
    const versionId = selectedPricingVersionId
    if (!bidId || !versionId || matches.length === 0) return
    setWbFillingBook(true)
    try {
      const { error: err } = await supabase.from('bid_pricing_assignments').insert(
        matches.map((m) => ({ bid_id: bidId, count_row_id: m.countRowId, price_book_entry_id: m.entryId, price_book_version_id: versionId })),
      )
      if (err) {
        setError(err.message)
        return
      }
      await loadBidPricingAssignments(bidId, versionId)
      await freezeSharedPricingAfterWrite()
      showToast(`Assigned ${matches.length} row${matches.length === 1 ? '' : 's'} from the book.`, 'success')
    } finally {
      setWbFillingBook(false)
    }
  }

  /** Workbench: build a PREVIEW from the solver (nothing writes until Apply).
      opts.marginPct overrides the wbMarginPct state for same-tick calls (the
      slider solves on every drag step, before React has applied the setState). */
  function runWorkbenchSolve(opts: { onlyUnpriced?: boolean; targetTotal?: number; marginPct?: number }) {
    const derived = derivePricingWorkbench()
    if (!derived) return
    const fixtureCostSum = derived.rows.reduce((s, r) => s + (r.cost > 0 ? r.cost : 0), 0)
    const overheadAll = Math.max(derived.totalCost - fixtureCostSum, 0)
    const allRows = derived.rows.map((r) => ({
      id: r.countRow.id,
      count: r.count,
      rowCost: r.cost,
      // A saved $0 is not a price (v2.2396) — the solver treats those rows as unpriced.
      unitPrice: wbPreview?.[r.countRow.id] ?? (r.unitPrice != null && r.unitPrice > 0 ? r.unitPrice : null),
      locked: r.isFixedPrice || wbLocks.has(r.countRow.id),
      group_tag: r.countRow.group_tag ?? null,
    }))
    // v2.4202: the scope — the base, one alternate or the whole bid; the overhead follows pro rata.
    const scoped = scopeWorkbenchRows(allRows, wbSolveScope, selectedBidForPricing?.alternate_group_tags ?? [], overheadAll)
    const solverRows = scoped.rows
    const overhead = scoped.overhead
    const scopeTotalCost = scoped.fixtureCost + scoped.overhead
    const sol = solveWorkbenchPrices(solverRows, overhead, {
      ...(opts.targetTotal == null ? { targetMarginPct: opts.marginPct ?? wbMarginPct } : { targetTotal: opts.targetTotal }),
      onlyUnpriced: opts.onlyUnpriced === true,
      roundTo5: true, // v2.2148: always on (was the default; the checkbox is gone)
    })
    if (!sol) {
      showToast('Nothing to solve — check the margin (1–95) and that unlocked rows have costs.', 'error')
      return
    }
    setAndStashWbPreview(selectedPricingVersionId, { ...(wbPreview ?? {}), ...Object.fromEntries(sol.prices) }, wbPreviewVeto)
    // A fresh solve is her current work, not a restoration — the age chip stands down.
    setWbPreviewRestoredAt(null)
    // Margin solves get the landing chip ("56% on 12 costed rows"); a
    // target-total solve replaces it with the slider sync below.
    setWbSolveLanding(opts.targetTotal == null ? { pct: opts.marginPct ?? wbMarginPct, rows: sol.prices.size } : null)
    // v2.2403 (Wendi): a margin solve carries the "or total" box with it — the ideal
    // total rises and falls under the slider, so she can see where the bid lands and
    // step over to fine-edit that number. Never while she's typing in the box itself.
    if (opts.targetTotal == null && !wbTargetTotalFocusedRef.current) {
      setWbTargetTotalInput(Math.round(sol.resultingRevenue).toLocaleString('en-US'))
    }
    if (opts.targetTotal != null) {
      // The slider means "margin on the costed rows" (hand-set no-cost revenue
      // stacks on top), so sync it to the costed portion of where this landed —
      // syncing to blended would jump prices on the next slider nudge.
      const costedRev = sol.resultingRevenue - sol.uncostedFixedRevenue
      if (costedRev > 0) {
        const costedMargin = (costedRev - scopeTotalCost) / costedRev
        setWbMarginPct(Math.min(95, Math.max(1, Math.round(costedMargin * 100))))
      }
    }
  }

  /** v2.4202: the cost the solver's scope carries (its rows plus their share of the overhead) — the target must beat it. */
  function workbenchScopeCost(): number | null {
    const derived = derivePricingWorkbench()
    if (!derived) return null
    const fixtureCostSum = derived.rows.reduce((s, r) => s + (r.cost > 0 ? r.cost : 0), 0)
    const scoped = scopeWorkbenchRows(
      derived.rows.map((r) => ({ id: r.countRow.id, rowCost: r.cost, group_tag: r.countRow.group_tag ?? null })),
      wbSolveScope,
      selectedBidForPricing?.alternate_group_tags ?? [],
      Math.max(derived.totalCost - fixtureCostSum, 0),
    )
    return scoped.fixtureCost + scoped.overhead
  }

  /** Workbench: commit the preview via the existing per-row override write. */
  async function applyWorkbenchPreview() {
    if (!guardPricingWrite()) return
    const bidId = selectedBidForPricing?.id
    const versionId = selectedPricingVersionId
    const derived = derivePricingWorkbench()
    if (!bidId || !versionId || !wbPreview || !derived) return
    setWbApplying(true)
    try {
      for (const [rowId, price] of Object.entries(wbPreview)) {
        // Clicked-off proposals hold their saved price (v2.2379).
        if (wbPreviewVeto.has(rowId)) continue
        // A stashed preview can outlive its count row (row deleted in Counts) —
        // never write an override for a row the grid no longer has.
        const row = derived.rows.find((r) => r.countRow.id === rowId)
        if (!row || row.unitPrice === price) continue
        const err = await writeUnitPriceOverrideRow(rowId, price)
        if (err) {
          setError(err.message)
          return
        }
      }
      await loadBidPricingAssignments(bidId, versionId)
      await freezeSharedPricingAfterWrite()
      setAndStashWbPreview(versionId, null)
      setWbSolveLanding(null)
      showToast('Prices applied.', 'success')
    } finally {
      setWbApplying(false)
    }
  }

  /** Workbench: a hand-typed price saves itself on Enter/blur (v2.2373, Wendi) —
      the same write Apply uses, no preview gate. The preview gate stays solver-only. */
  async function commitWorkbenchTypedPrice(countRowId: string) {
    if (!guardPricingWrite()) return
    const raw = wbPriceDrafts[countRowId]
    if (raw == null) return
    const clearDraft = () =>
      setWbPriceDrafts((prev) => {
        const next = { ...prev }
        delete next[countRowId]
        return next
      })
    const bidId = selectedBidForPricing?.id
    const versionId = selectedPricingVersionId
    const derived = derivePricingWorkbench()
    if (!bidId || !versionId || !derived) {
      clearDraft()
      return
    }
    const row = derived.rows.find((r) => r.countRow.id === countRowId)
    const v = parseFloat(raw.replace(/[$,]/g, ''))
    // What the field showed before she typed: the saved price (the ghost carries
    // the solver's proposal now — v2.2379). Blur without a real change writes nothing.
    const before = row?.unitPrice ?? null
    if (!Number.isFinite(v) || v <= 0 || v === before) {
      clearDraft()
      return
    }
    setSavingUnitPriceOverride(countRowId)
    const err = await writeUnitPriceOverrideRow(countRowId, v)
    if (err) {
      setError(err.message)
      setSavingUnitPriceOverride(null)
      clearDraft()
      return
    }
    // Her typed price is now the saved price — drop the row from any solver
    // preview (and its veto) so Apply can't later overwrite what she just saved.
    if (wbPreview && countRowId in wbPreview) {
      const nextPreview = { ...wbPreview }
      delete nextPreview[countRowId]
      const nextVeto = new Set(wbPreviewVeto)
      nextVeto.delete(countRowId)
      setAndStashWbPreview(versionId, Object.keys(nextPreview).length > 0 ? nextPreview : null, nextVeto)
    }
    await loadBidPricingAssignments(bidId, versionId)
    await freezeSharedPricingAfterWrite()
    setSavingUnitPriceOverride(null)
    clearDraft()
    setWbJustSaved((prev) => ({ ...prev, [countRowId]: true }))
    window.setTimeout(() => {
      setWbJustSaved((prev) => {
        const next = { ...prev }
        delete next[countRowId]
        return next
      })
    }, 2500)
  }

  /** Shared derive for BOTH pricing views (Old grid + New Workbench): totals,
      decorated rows, and the row-breakdown opener. Null until a Pricing,
      Counts, and cost estimate exist. */
  /** Rung G: revert an applied quote cost — lot groups revert together. */
  async function revertCustomCost(cc: { id: string; lot_group_id: string | null; house_name: string | null }) {
    const q = cc.lot_group_id
      ? supabase.from('bid_count_row_custom_costs').delete().eq('lot_group_id', cc.lot_group_id)
      : supabase.from('bid_count_row_custom_costs').delete().eq('id', cc.id)
    const { error } = await q
    if (error) {
      showToast(error.message, 'error')
      return
    }
    showToast(cc.lot_group_id ? 'Package costs reverted to takeoff.' : 'Cost reverted to takeoff.', 'success')
    await reloadBidCustomCosts()
  }

  /** The five direct-cost tables as one list — what the Workbench, the print and the CSV hand the cost kernel. */
  const pricingDirectCostRows = useMemo(
    () => directCostRowsFromTables({ equipment: pricingEquipmentRows, permit: pricingPermitRows, sub: pricingSubcontractorRows, waste: pricingWasteRows, other: pricingOtherRows }),
    [pricingEquipmentRows, pricingPermitRows, pricingSubcontractorRows, pricingWasteRows, pricingOtherRows],
  )

  // Region P7: Share / Print / CSV and the ★ chooser — the five values and the handlers live in
  // the hook (called here, after the direct-cost rows it reads); the chooser is
  // PricingStarChooserDialog, and the Package-and-send window below reads `shareOverride`.
  const {
    packageSendOpen,
    setPackageSendOpen,
    shareOverride,
    setShareOverride,
    starChooser,
    setStarChooser,
    starChoice,
    setStarChoice,
    starBusy,
    requestWithStarCheck,
    runStarAwareAction,
    printPricingPage,
    downloadPricingCsv,
    printAllPricingPages,
  } = useStarAwareShare({
    inputs: selectedBidForPricing
      ? {
          bid: selectedBidForPricing,
          priceBookVersions,
          priceBookEntries,
          selectedPricingVersionId,
          countRows: pricingCountRows,
          costEstimate: pricingCostEstimate,
          laborRows: pricingLaborRows,
          materialTotalRoughIn: pricingMaterialTotalRoughIn,
          materialTotalTopOut: pricingMaterialTotalTopOut,
          materialTotalTrimSet: pricingMaterialTotalTrimSet,
          laborRate: pricingLaborRate,
          fixtureMaterialsFromTakeoff: pricingFixtureMaterialsFromTakeoff,
          assignments: bidPricingAssignments,
          customPrices: bidCountRowCustomPrices,
          submissionHides: bidCountRowSubmissionHides,
          taxPercent: parseFloat(costEstimatePOModalTaxPercent || '8.25') || 0,
          directCostRows: pricingDirectCostRows,
          teamLaborDataForBids,
        }
      : null,
    selectedBidVersionId,
    starPricingId: customerFacingPricingId,
    pricingPackageSource,
    setError,
  })

  function derivePricingWorkbench() {
    if (!selectedPricingVersionId || pricingCountRows.length === 0 || !pricingCostEstimate) return null
                const taxPercent = parseFloat(costEstimatePOModalTaxPercent || '8.25') || 0
                const teamLaborCostByBidId = new Map(teamLaborDataForBids.map((r) => [r.bidId, r.bidCost]))
                // One total (v2.3292): the same kernel the Pricing print/CSV, the Labor page and the approval PDF read.
                const { totalMaterials, rate, totalLaborHours, laborCost, distance, ratePerMile, hrsPerTrip, numTrips, drivingCost, estimatorCost, travelCost, equipmentRentalCost, permitCost, subcontractorCost, wasteCost, otherCost, teamLaborCost, totalCost } = computeBidCostBreakdown({
                  materialTotalRoughIn: pricingMaterialTotalRoughIn,
                  materialTotalTopOut: pricingMaterialTotalTopOut,
                  materialTotalTrimSet: pricingMaterialTotalTrimSet,
                  laborRate: pricingLaborRate,
                  laborRows: pricingLaborRows,
                  distanceFromOffice: selectedBidForPricing?.distance_from_office ?? null,
                  costEstimate: pricingCostEstimate,
                  countRowsLength: pricingCountRows.length,
                  directCostRows: pricingDirectCostRows,
                  teamLaborCost: selectedBidForPricing?.id ? (teamLaborCostByBidId.get(selectedBidForPricing.id) ?? 0) : 0,
                })
                const assignmentsForVersion = bidPricingAssignments.filter(
                  (a) => a.price_book_version_id === selectedPricingVersionId,
                )
                const pricingCalcResult = pricingRowsForGrid
                if (!pricingCalcResult) return null

                const totalRevenue = pricingCalcResult.totalRevenue
                // Fixtures with a Sale Price but no Takeoffs Unit-price cost: their margin reads "—"
                // (no cost basis), and the bid-level Total margin treats them as full profit — so it
                // is overstated until those costs are entered in Takeoffs (`uncostedRevenueRows`).
                const { rows, uncostedRevenueRows, uncostedRevenue } = decoratePricingRows({
                  rows: pricingCalcResult.rows,
                  laborRows: pricingLaborRows,
                  customPrices: bidCountRowCustomPrices,
                  assignmentsForVersion,
                  materialsFromTakeoffByCountRowId: pricingFixtureMaterialsFromTakeoff,
                  taxPercent,
                  versionId: selectedPricingVersionId,
                  canToggleOmitSubmission: selectedPricingVersionId != null,
                })
                const openRowBreakdown = (r: (typeof rows)[number]) =>
                  setPricingBreakdownRow({
                    countRowId: r.countRow.id,
                    fixture: r.countRow.fixture ?? '',
                    count: r.count,
                    unitPrice: r.unitPrice,
                    isFixedPrice: r.isFixedPrice,
                    revenue: r.revenue,
                    materialsBeforeTax: r.materialsBeforeTax,
                    taxAmount: r.taxAmount,
                    taxPercent,
                    laborCost: r.laborCost,
                    cost: r.cost,
                    margin: r.margin,
                    materialsFromTakeoff: r.materialsFromTakeoff,
                  })
    return { totalMaterials, rate, totalLaborHours, taxPercent, laborCost, distance, ratePerMile, hrsPerTrip, numTrips, drivingCost, estimatorCost, travelCost, equipmentRentalCost, permitCost, subcontractorCost, wasteCost, otherCost, teamLaborCost, totalCost, assignmentsForVersion, totalRevenue, rows, uncostedRevenueRows, uncostedRevenue, openRowBreakdown }
  }

  return (
    <>
      <div>
        {!selectedBidForPricing && (
          <BidPickerSearchRow query={pricingSearchQuery} onQueryChange={setPricingSearchQuery} onlyMyBids={onlyMyBids} onOnlyMyBidsChange={setOnlyMyBids} />
        )}
        {selectedBidForPricing && (
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '1.5rem 2rem',
              background: 'var(--surface)',
              marginBottom: '1.5rem',
              ...(narrowViewport640 ? { position: 'relative' } : {}),
            }}
          >
            {narrowViewport640 ? (
              <button
                type="button"
                onClick={onClose}
                title="Close"
                aria-label="Close"
                style={bidDetailCloseFloatMobileStyle}
              >
                ×
              </button>
            ) : null}
            {/* v2.3200: the bid flow strip above the bid title. */}
            {flowFold.expanded ? (
            <BidFlowStrip
              variant="full"
              hideHeader
              flow={deriveBidFlow(selectedBidForPricing, bidFlowFactsByBid[selectedBidForPricing.id])}
              bidLabel={selectedBidForPricing.project_name ?? undefined}
              canOpenDoor={(d) => d === 'review' || (onOpenBidFlowDoor != null && (bidFlowDoorAllowed ? bidFlowDoorAllowed(d) : d != null))}
              onOpenDoor={(d, step) => {
                if (d === 'review') void bidFlowReview.markReviewed(selectedBidForPricing)
                else onOpenBidFlowDoor?.(selectedBidForPricing, d, step)
              }}
              reviewStamp={bidFlowReview.stampFor(selectedBidForPricing)}
            />
            ) : null}
            <div id="pricing-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              {/* v2.4448: the group may shrink (minWidth 0) so its own items wrap inside it; at its
                  max-content width the chips pushed the flow strip off the right of a 1,400 px window. */}
              <div style={{ display: 'flex', alignItems: 'center', flex: '1 1 auto', minWidth: 0, flexWrap: 'wrap', gap: '0.75rem' }}>
                {/* v2.4451: no h2Style, so the title may shrink and wrap as on every other tab. Held
                    at its full width (flex 0 0 auto), it ran past the card on a phone. */}
                <BidWorkflowTabTitleWithPreview
                  bid={selectedBidForPricing}
                  previewEnabled={bidPreview != null}
                  onOpenPreview={() => bidPreview?.openBidPreviewFromBid(selectedBidForPricing)}
                />
                {/* v2.4448: "Bids like this" sits here, after the title. Its numbers (the Workbench's
                    effective revenue and margin) are derived further down, inside the Workbench block,
                    so that block portals the chips into this slot. */}
                <span ref={setBidsLikeThisSlot} style={{ display: 'inline-flex', alignItems: 'center' }} />
                <BidFlowStrip
                  variant="inline"
                  expanded={flowFold.expanded}
                  onToggleExpanded={flowFold.toggle}
                  flow={deriveBidFlow(selectedBidForPricing, bidFlowFactsByBid[selectedBidForPricing.id])}
                  bidLabel={selectedBidForPricing.project_name ?? undefined}
                  canOpenDoor={(d) => d === 'review' || (onOpenBidFlowDoor != null && (bidFlowDoorAllowed ? bidFlowDoorAllowed(d) : d != null))}
                  onOpenDoor={(d, step) => {
                  if (d === 'review') void bidFlowReview.markReviewed(selectedBidForPricing)
                  else onOpenBidFlowDoor?.(selectedBidForPricing, d, step)
                  }}
                  reviewStamp={bidFlowReview.stampFor(selectedBidForPricing)}
                />
                {/* v2.2376 (Wendi): one "?" beside the title as the single help door (the old (i) modal,
                    tour, and guide all live behind it). The Old/New pills retired in v2.2707. */}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <button
                      type="button"
                      onClick={() => setWbInfoOpen(true)}
                      title="How this page works"
                      aria-label="How this page works"
                      style={{ font: 'inherit', flexShrink: 0, width: 20, height: 20, borderRadius: '50%', border: '1.5px solid #3b82f6', color: 'var(--text-blue-500)', background: 'var(--surface)', fontSize: '0.72rem', fontWeight: 700, lineHeight: 1, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, marginLeft: '0.15rem' }}
                    >
                      ?
                    </button>
                </span>
              </div>
              {/* v2.4451: may shrink to the card and wrap (the RFQ chip above the Share button) on a phone. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '0 1 auto', minWidth: 0, flexWrap: 'wrap' }}>
                {/* v2.2630/31/36: one chip, five states (deriveRfqChip) — quotes-only
                    opens compare (as shipped); any request opens the RFQ desk. */}
                {canPackageAndSendBidPricing && rfqChip.kind !== 'none' ? (
                  <button
                    type="button"
                    id="pricing-price-requests"
                    onClick={() => {
                      if (rfqChip.kind === 'robot') void openRobotChip(rfqChip)
                      else if (rfqChip.kind === 'desk') setRfqDeskOpen(true)
                      else setQuotesCompareOpen(true)
                    }}
                    title={rfqChip.kind === 'robot' ? (rfqChip.status === 'ready' ? 'The robot’s matrix is ready — open the compare' : 'Where the robot is on this bid') : rfqChip.kind === 'desk' ? 'Open the price-request desk' : 'Compare supply house quotes on this bid'}
                    style={{
                      padding: '0.45rem 0.8rem',
                      background:
                        rfqChip.kind === 'robot'
                          ? rfqChip.tone === 'green'
                            ? 'var(--bg-green-tint)'
                            : rfqChip.tone === 'amber'
                              ? 'var(--bg-yellow-tint)'
                              : 'var(--bg-blue-tint)'
                          : rfqChip.kind === 'desk' && rfqChip.tone === 'amber'
                            ? 'var(--bg-yellow-tint)'
                            : 'var(--surface)',
                      color:
                        rfqChip.kind === 'quotes' || (rfqChip.kind === 'robot' && rfqChip.tone === 'blue')
                          ? 'var(--text-blue-500)'
                          : rfqChip.tone === 'red'
                            ? '#ef4444'
                            : rfqChip.tone === 'amber'
                              ? 'var(--text-amber-700)'
                              : '#15803d',
                      border: `1px solid ${rfqChip.kind === 'quotes' || (rfqChip.kind === 'robot' && rfqChip.tone === 'blue') ? '#3b82f6' : rfqChip.tone === 'red' ? '#ef4444' : rfqChip.tone === 'amber' ? '#f59e0b' : '#16a34a'}`,
                      borderRadius: 999,
                      cursor: 'pointer',
                      font: 'inherit',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {rfqChip.label}
                  </button>
                ) : null}
                {/* v2.2198 (option A, artifact df8daa33): Share keeps one click; Print / CSV / review live in the ▾ menu. */}
                <PricingShareMenu
                  canShare={canPackageAndSendBidPricing}
                  shareDisabled={!selectedPricingVersionId || pricingCountRows.length === 0 || !pricingCostEstimate}
                  shareTitle={
                    !selectedPricingVersionId || pricingCountRows.length === 0 || !pricingCostEstimate
                      ? 'Select a price book and ensure Counts and Labor exist'
                      : 'Share pricing (Job Plans + 4-column table) with a teammate'
                  }
                  onShare={() => requestWithStarCheck('share')}
                  csvDisabled={!selectedPricingVersionId || pricingCountRows.length === 0 || !pricingCostEstimate}
                  csvTitle="Select a price book and ensure Counts and Labor exist"
                  fixturesDisabled={pricingCountRows.length === 0}
                  fixturesTitle="Add Counts first — nothing to copy yet"
                  onPrint={() => printPricingPage()}
                  onCsv={() => downloadPricingCsv()}
                  onReview={() => void printAllPricingPages()}
                  onCopyFixtures={() => setPrepareCopyOpen(true)}
                  onOpenD22Audit={canPackageAndSendBidPricing ? () => setD22AuditOpen(true) : undefined}
                  onPlugInQuote={canPackageAndSendBidPricing ? () => setPlugInQuoteOpen(true) : undefined}
                  onPlugInSchedule={canPackageAndSendBidPricing ? () => setPlugInScheduleOpen(true) : undefined}
                onPriceWithRobot={canPackageAndSendBidPricing ? () => setPriceWithRobotOpen(true) : undefined}
                robotDisabled={!priceMatrixSupported || pricingCountRows.length === 0}
                robotTitle={!priceMatrixSupported ? 'The robot queue switches on with the next database update' : 'Count some fixtures first — the robot prices your count rows'}
                />
                {!narrowViewport640 ? (
                  <button
                    type="button"
                    onClick={onClose}
                    title="Close"
                    aria-label="Close"
                    style={bidDetailCloseXStyle}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                marginBottom: '0.75rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
              </div>
            </div>
            {/* v2.2376: the "?" card — the Workbench in four scannable lines; the tour and the
                full guide ride in its footer, so one icon is the whole help story. */}
            {wbInfoOpen
              ? (() => {
                  const gcName = gcNameForVersion(selectedBidVersionId)
                  return (
                    <WorkbenchHelpCard
                      {...workbenchHelpFacts({ priceBookVersions, selectedPricingVersionId, bidVersionCount: bidVersions.length })}
                      gcName={gcName}
                      gcShort={shortGc(gcName)}
                      onClose={() => setWbInfoOpen(false)}
                      onTakeTour={() => {
                        setWbInfoOpen(false)
                        startWorkbenchTour()
                      }}
                    />
                  )
                })()
              : null}
            {wbTourSteps ? (
              <SpotlightTour
                steps={wbTourSteps}
                onClose={() => setWbTourSteps(null)}
                guideHref={WORKBENCH_GUIDE_HREF}
                guideLabel="Read the full guide: price a bid with the Workbench →"
              />
            ) : null}
            {
              (() => {
                // v2.2367: while this bid's versions/prices are still resolving (or the resolve
                // failed), say so — the "needs Counts…" empty state below reads as deleted work.
                if (resolvePanel === 'skeleton') {
                  return (
                    <div role="status" aria-label="Loading this bid's packets and prices" style={{ padding: '0.95rem 1.1rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8125rem', fontWeight: 500 }}>
                        <span className="bid-resolve-spinner" aria-hidden />
                        Loading this bid's packets and prices…
                      </div>
                      {[['34%', '14%'], ['46%', '20%'], ['40%', '11%']].map(([w1, w2]) => (
                        <div key={w1} aria-hidden style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span className="bid-resolve-shimmer" style={{ width: w1, height: 12, borderRadius: 4 }} />
                          <span className="bid-resolve-shimmer" style={{ width: w2, height: 12, borderRadius: 4 }} />
                        </div>
                      ))}
                    </div>
                  )
                }
                if (resolvePanel === 'error') {
                  return (
                    <div style={{ padding: '0.9rem 1.1rem', border: '1px solid var(--border-red)', borderRadius: 8, background: 'var(--bg-red-tint)', display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--text-red-700)', fontSize: '0.8125rem', fontWeight: 500 }}>
                        Couldn't load this bid's packets and prices — the connection dropped or the server didn't answer. Your versions are safe.
                      </span>
                      <button
                        type="button"
                        onClick={onRetryResolve}
                        style={{ font: 'inherit', fontSize: '0.75rem', fontWeight: 600, padding: '0.3rem 0.8rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer' }}
                      >
                        Retry
                      </button>
                    </div>
                  )
                }
                const derived = derivePricingWorkbench()
                if (!derived) {
                  // G1: a GC with no prices yet can start from another GC's base price.
                  const donors = bidVersions.filter((v) => v.id !== selectedBidVersionId && v.starred_price_book_version_id && priceBookVersions.some((p) => p.id === v.starred_price_book_version_id))
                  const noPricingHere = selectedBidVersionId != null && !priceBookVersions.some((p) => p.bid_version_id === selectedBidVersionId)
                  return (
                    <div style={{ padding: '1rem', border: '1px dashed var(--border-strong)', borderRadius: 8, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      {noPricingHere && donors.length > 0 ? (
                        <>
                          <div style={{ color: 'var(--text-strong)', fontWeight: 600, marginBottom: '0.3rem' }}>No prices yet for {gcNameForVersion(selectedBidVersionId)}.</div>
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            Start from another GC's base price:
                            {donors.map((d) => (
                              <button key={d.id} type="button" disabled={copyingGcPrice} onClick={() => void copyBasePriceFromVersion(d.id)} style={{ font: 'inherit', fontSize: '0.8rem', padding: '0.3rem 0.7rem', borderRadius: 6, border: '1px solid #3b82f6', background: '#3b82f6', color: '#fff', cursor: 'pointer' }}>
                                {copyingGcPrice ? 'Copying…' : `Copy ${shortGc(gcNameForVersion(d.id))}'s base price`}
                              </button>
                            ))}
                            <span>or pick a price book in Old and price from there.</span>
                          </div>
                        </>
                      ) : (
                        <>The Workbench needs Counts, an active Pricing, and a cost estimate. Set those up on the Counts / Labor tabs, then come back.</>
                      )}
                    </div>
                  )
                }
                const { rows, totalCost, uncostedRevenue, openRowBreakdown } = derived
                const eff = rows.map((r) => {
                  const pv = wbPreview?.[r.countRow.id]
                  const isPreview = pv != null && pv !== r.unitPrice
                  const isVetoed = isPreview && wbPreviewVeto.has(r.countRow.id)
                  // A price mid-typing drives the live totals too (v2.2373) — but
                  // only the solver's preview map makes a row "preview": typed
                  // prices save on Enter/blur instead of waiting on Apply.
                  const draftRaw = wbPriceDrafts[r.countRow.id]
                  const draftNum = draftRaw != null ? parseFloat(draftRaw.replace(/[$,]/g, '')) : NaN
                  const draft = Number.isFinite(draftNum) && draftNum > 0 ? draftNum : null
                  // v2.2396 (Wendi): a saved $0 is not a price — it reads as a dash and counts
                  // as unpriced (the priced meter, "Show unpriced only", the solver's unpriced set).
                  const savedUnit = r.unitPrice != null && r.unitPrice > 0 ? r.unitPrice : null
                  // Totals see the pending solve (minus clicked-off rows); the row's
                  // own cells keep the saved price — the ghost carries the proposal (v2.2379).
                  const unit = draft ?? (isPreview && !isVetoed ? pv : null) ?? savedUnit
                  const revenue = unit != null ? unit * r.count : 0
                  const rowMargin = unit != null && revenue > 0 && r.cost > 0 ? (revenue - r.cost) / revenue : null
                  const displayUnit = draft ?? savedUnit
                  const displayRevenue = displayUnit != null ? displayUnit * r.count : 0
                  const displayMargin =
                    displayUnit != null && displayRevenue > 0 && r.cost > 0 ? (displayRevenue - r.cost) / displayRevenue : null
                  return { ...r, effUnit: unit, effRevenue: revenue, effMargin: rowMargin, isPreview, isVetoed, displayUnit, displayRevenue, displayMargin }
                })
                const effRevenue = eff.reduce((s, r) => s + r.effRevenue, 0)
                const effProfit = effRevenue - totalCost
                const effMargin = effRevenue > 0 ? effProfit / effRevenue : null
                // v2.4194: the base and what each alternate adds — revenue and cost per row, summed by
                // the Count Sheet's scope (one kernel with Takeoffs and Labor). null on a bid without one.
                const altTags: readonly string[] = selectedBidForPricing?.alternate_group_tags ?? []
                const groupTagById = new Map(pricingCountRows.map((cr) => [cr.id, cr.group_tag] as const))
                const effScoped = eff.map((r) => ({ ...r, group_tag: groupTagById.get(r.countRow.id) ?? null }))
                const altRevenue = sumByAlternate(effScoped, altTags, (r) => r.effRevenue)
                const altCost = sumByAlternate(effScoped, altTags, (r) => r.cost)
                const altRowIds = new Set(pricingCountRows.filter((cr) => isAlternateRow(cr, altTags)).map((cr) => cr.id))
                const declinedIds = new Set(selectedBidForPricing ? pricingCountRows.filter((cr) => isDeclinedRow(cr, selectedBidForPricing)).map((cr) => cr.id) : [])
                const altChip = (id: string) =>
                  declinedIds.has(id) ? (
                    <span title="The customer did not take this alternate — priced as sent, out of the job" style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.06em', padding: '0 0.3rem', borderRadius: 3, border: '1px solid var(--border-strong)', color: 'var(--text-muted)', marginLeft: '0.35rem', verticalAlign: '1px' }}>ALT · declined</span>
                  ) : altRowIds.has(id) ? (
                    <span title="In an alternate group — priced with and without" style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.06em', padding: '0 0.3rem', borderRadius: 3, border: '1px solid var(--text-amber-700)', color: 'var(--text-amber-700)', marginLeft: '0.35rem', verticalAlign: '1px' }}>ALT</span>
                  ) : null
                const previewCount = eff.filter((r) => r.isPreview && !r.isVetoed).length
                const vetoCount = eff.filter((r) => r.isVetoed).length
                const costed = eff.filter((r) => r.cost > 0)
                const pricedCount = costed.filter((r) => r.effUnit != null).length
                const unpricedCost = costed.filter((r) => r.effUnit == null).reduce((s, r) => s + r.cost, 0)
                const conc = profitConcentration(
                  eff.map((r) => ({ id: r.countRow.id, label: r.countRow.fixture ?? '—', count: r.count, rowCost: r.cost, unitPrice: r.effUnit })),
                )
                const concColors = ['#3b82f6', '#6366f1', '#8b5cf6', '#0ea5e9', '#14b8a6', '#f59e0b', '#84cc16', '#ec4899', '#64748b', '#eab308']
                const mColor = (m: number | null) => (m == null ? 'var(--text-muted)' : m >= 0.42 ? 'var(--text-green-600)' : m >= 0.28 ? 'var(--text-amber-700)' : 'var(--text-red-700)')
                // v2.2379: price, Revenue, Profit, and Margin share one quiet-cell
                // look — dashed underline until focused, no lone boxed input.
                const wbCellStyle = (width: string, extra?: React.CSSProperties): React.CSSProperties => ({
                  width,
                  font: 'inherit',
                  fontSize: '0.85rem',
                  padding: '0.25rem 0.4rem',
                  border: 'none',
                  borderBottom: '1px dashed var(--border-strong)',
                  borderRadius: 0,
                  textAlign: 'right',
                  background: 'transparent',
                  color: 'var(--text-strong)',
                  fontVariantNumeric: 'tabular-nums',
                  ...extra,
                })
                const wbCellText = (r: (typeof eff)[number], field: WorkbenchCellField): string => {
                  if (field === 'revenue') return r.displayUnit != null ? `$${formatCurrency(r.displayRevenue)}` : ''
                  if (field === 'profit') return r.displayUnit != null ? `$${formatCurrency(r.displayRevenue - r.cost)}` : ''
                  return r.displayMargin == null ? '' : `${Math.round(r.displayMargin * 100)}%`
                }
                /** One editable Revenue/Profit/Margin cell — typing solves the sale price/unit live (v2.2379). */
                const wbCellInput = (r: (typeof eff)[number], field: WorkbenchCellField, width: string, extra?: React.CSSProperties) => {
                  const id = r.countRow.id
                  const editingThis = wbCellDraft != null && wbCellDraft.rowId === id && wbCellDraft.field === field
                  return (
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editingThis ? wbCellDraft.raw : wbCellText(r, field)}
                      placeholder="—"
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => {
                        const el = e.currentTarget
                        if (document.activeElement !== el) el.dataset.selectAll = '1'
                      }}
                      onMouseUp={(e) => {
                        // Same slow-click guard as the price cell: keep the select-all when the
                        // mouseup lands after the deferred select() (v2.NEXT, Wendi).
                        const el = e.currentTarget
                        if (el.dataset.selectAll) {
                          e.preventDefault()
                          delete el.dataset.selectAll
                        }
                      }}
                      onFocus={(e) => {
                        const el = e.currentTarget
                        setWbCellDraft({ rowId: id, field, raw: cellEditSeed(field, r.displayUnit, r.count, r.cost) })
                        window.setTimeout(() => el.select(), 0)
                      }}
                      onChange={(e) => {
                        const raw = e.target.value
                        setWbCellDraft({ rowId: id, field, raw })
                        const unit = impliedUnitPrice(field, raw, r.count, r.cost)
                        setWbPriceDrafts((prev) => {
                          const next = { ...prev }
                          if (unit != null) next[id] = String(unit)
                          else delete next[id]
                          return next
                        })
                        setWbSolveLanding(null)
                      }}
                      onBlur={() => {
                        setWbCellDraft(null)
                        void commitWorkbenchTypedPrice(id)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur()
                        else if (e.key === 'Escape') {
                          setWbCellDraft(null)
                          setWbPriceDrafts((prev) => {
                            const next = { ...prev }
                            delete next[id]
                            return next
                          })
                        }
                      }}
                      disabled={savingUnitPriceOverride === r.countRow.id}
                      style={wbCellStyle(width, extra)}
                      aria-label={`${field === 'revenue' ? 'Revenue' : field === 'profit' ? 'Profit' : 'Margin'} for ${r.countRow.fixture ?? 'row'} — solves the sale price per unit`}
                      title="Type here — the sale price/unit follows as you type"
                    />
                  )
                }
                const visibleEff = wbShowNoCostOnly
                  ? eff.filter((r) => !(r.cost > 0))
                  : wbShowUnpricedOnly
                    ? eff.filter((r) => r.effUnit == null && r.cost > 0)
                    : eff
                // The price cards row (v2.2404): its cards, its layout, and the solver line's ＋ Add
                // price door while a solo bid is unpriced (artifact 0a627c7c) — `lib/bids/pricingCardsRow`.
                const cardScenarios = cardsRowScenarios({ priceBookVersions, selectedBidVersionId, selectedPricingVersionId })
                const cardAltVersions = sameGcAlternateVersions(bidVersions, selectedBidVersionId)
                const cardRevenueOf = (id: string) => cardRevenue(id, { selectedPricingVersionId, effRevenue, scenarioRevenue: wbScenarioRevenue })
                const cardsMode = cardsRowMode({
                  scenarioCount: cardScenarios.length,
                  alternateCount: cardAltVersions.length,
                  bidVersionCount: bidVersions.length,
                  soloRevenue: cardScenarios.length === 1 ? cardRevenueOf(cardScenarios[0]!.id) : null,
                })
                const solverEndDoor = cardsMode === 'soloUnpriced' ? <AddPriceDoorButton cloning={wbCloning} onOpenDoor={() => setWbVariantDoorOpen(true)} /> : null
                return (
                  <>
                    {cardsMode !== 'none' ? (
                      <PricingCardsRow
                        mode={cardsMode}
                        scenarios={cardScenarios}
                        altVersions={cardAltVersions}
                        selectedPricingVersionId={selectedPricingVersionId}
                        selectedBidVersionId={selectedBidVersionId}
                        customerFacingPricingId={customerFacingPricingId}
                        revenueOf={cardRevenueOf}
                        totalCost={totalCost}
                        baseMaterials={derived.totalMaterials}
                        altVersionData={altVersionData}
                        marginColor={mColor}
                        copySource={copySourceFor({ scenarios: cardScenarios, starredId: customerFacingPricingId, viewingId: selectedPricingVersionId, revenueOf: cardRevenueOf })}
                        cloning={wbCloning}
                        copyingPrices={wbCopyingPrices}
                        doorOpen={wbVariantDoorOpen}
                        doorGcLabel={selectedBidVersionId ? shortGc(gcNameForVersion(selectedBidVersionId)) : 'this GC'}
                        onOpenDoor={() => setWbVariantDoorOpen(true)}
                        onCloseDoor={() => setWbVariantDoorOpen(false)}
                        onAnotherPrice={() => setAddPriceOpen({ name: '', fromId: selectedPricingVersionId, offer: true })}
                        onOwnTakeoff={() => setAddOwnTakeoffOpen({ name: '' })}
                        onAdopt={() => setAdoptOpen(true)}
                        ownTakeoff={addOwnTakeoffOpen}
                        creatingOwnTakeoff={creatingOwnTakeoffAlt}
                        ownTakeoffGcLabel={shortGc(gcNameForVersion(selectedBidVersionId))}
                        onOwnTakeoffName={(name) => setAddOwnTakeoffOpen({ name })}
                        onCancelOwnTakeoff={() => setAddOwnTakeoffOpen(null)}
                        onCreateOwnTakeoff={(name) => void createOwnTakeoffAlternate(name)}
                        onView={viewWorkbenchScenario}
                        onEdit={setPricingEdit}
                        onMakeBase={(v, rev) => void makeScenarioCustomerFacing(v, rev)}
                        onSetOffered={(v, offered) => void setScenarioOffered(v, offered)}
                        onCopyPrices={(sourceId) => void copyPricesIntoViewedScenario(sourceId)}
                        onOpenAlternate={(id) => onSwitchBidVersion(id)}
                        onOpenAlternateTakeoff={(id) => {
                          onSwitchBidVersion(id)
                          if (selectedBidForPricing) onNavigateBidToTab(selectedBidForPricing, 'takeoffs')
                        }}
                      />
                    ) : null}
                    <div
                      data-tour="workbench-summary"
                      style={{
                        position: 'sticky', top: 0, zIndex: 20,
                        background: 'var(--surface)',
                        border: wbPreview && previewCount + vetoCount > 0 ? '1px dashed #8b5cf6' : '1px solid var(--border)',
                        borderRadius: 10,
                        boxShadow: '0 4px 14px rgba(0,0,0,0.08)', marginBottom: '0.9rem', padding: '0.5rem 0.9rem',
                      }}
                    >
                      {/* v2.2203 (1B): the stats and the solver share one line that wraps; Apply/Discard join it on preview. */}
                    <div data-tour="workbench-solver">
                      {(() => {
                        const solveToTarget = () => {
                          const v = parseFloat(wbTargetTotalInput.replace(/[$,]/g, ''))
                          // v2.4202: the scope's cost, not the bid's — a base target beats the base's cost.
                          const floor = altRevenue ? (workbenchScopeCost() ?? totalCost) : totalCost
                          if (!Number.isFinite(v) || v <= floor) {
                            showToast(`Target must beat our cost ($${formatCurrency(floor)}).`, 'error')
                            return
                          }
                          runWorkbenchSolve({ targetTotal: v })
                        }
                        const labelStyle: React.CSSProperties = { fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }
                        const stat = (k: string, v: string, c: string, title?: string) => (
                          <span key={k} title={title} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', flex: '0 0 auto' }}>
                            <span style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{k}</span>
                            <span style={{ fontSize: '0.92rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.15, color: c }}>{v}</span>
                          </span>
                        )
                        // v2.2385 (Wendi): preview actions fuse into ONE segmented control — amber
                        // count chip · Apply · Discard, one shared height, wrapping as a unit and
                        // right-pinned even when it wraps to its own line. The long caption rides hover.
                        const previewControl =
                          wbPreview && previewCount + vetoCount > 0 ? (
                            <span
                              title={`${previewCount} draft price${previewCount === 1 ? '' : 's'} — saved only when you Apply · waits on this device${vetoCount > 0 ? ` · ${vetoCount} clicked off — ${vetoCount === 1 ? 'its price holds' : 'their prices hold'}` : ''}`}
                              style={{ display: 'inline-flex', alignItems: 'stretch', border: '1px solid var(--border-strong)', borderRadius: 7, overflow: 'hidden', flex: '0 0 auto', whiteSpace: 'nowrap' }}
                            >
                              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.3rem 0.7rem', fontSize: '0.74rem', fontWeight: 700, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-700)', fontVariantNumeric: 'tabular-nums' }}>
                                {previewCount} draft{previewCount === 1 ? '' : 's'}
                                {vetoCount > 0 ? <span style={{ color: 'var(--text-red-700)', fontWeight: 700 }}>{` · ${vetoCount} off`}</span> : null}
                              </span>
                              <button
                                type="button"
                                onClick={() => void applyWorkbenchPreview()}
                                disabled={wbApplying || previewCount === 0}
                                style={{ font: 'inherit', fontSize: '0.8rem', fontWeight: 600, padding: '0.3rem 0.85rem', border: 'none', borderLeft: '1px solid var(--border-strong)', background: '#3b82f6', color: '#fff', cursor: wbApplying ? 'wait' : previewCount === 0 ? 'not-allowed' : 'pointer', opacity: previewCount === 0 ? 0.55 : 1 }}
                              >
                                {wbApplying ? 'Applying…' : 'Apply'}
                              </button>
                              <button
                                type="button"
                                onClick={() => { setAndStashWbPreview(selectedPricingVersionId, null); setWbSolveLanding(null) }}
                                disabled={wbApplying}
                                style={{ font: 'inherit', fontSize: '0.8rem', padding: '0.3rem 0.7rem', border: 'none', borderLeft: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer' }}
                              >
                                Discard
                              </button>
                            </span>
                          ) : null
                        // A preview restored from an earlier sitting says how old it is (v2.2373).
                        const restoredChip =
                          wbPreview && previewCount + vetoCount > 0 && wbPreviewRestoredAt != null && Date.now() - wbPreviewRestoredAt > 60 * 60 * 1000 ? (
                            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', border: '1px solid var(--border-strong)', borderRadius: 999, padding: '0.1rem 0.55rem', background: 'var(--bg-subtle)', whiteSpace: 'nowrap', flex: '0 0 auto' }}>
                              solve from {formatRestoredStamp(wbPreviewRestoredAt)} — restored
                            </span>
                          ) : null
                        // Everything that must stay reachable while folded rides one right-pinned
                        // cluster that keeps right alignment when it wraps (artifact 370f8f3c).
                        const rightCluster = (children: React.ReactNode) => (
                          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'flex-end', flex: '0 1 auto', minWidth: 0 }}>{children}</span>
                        )
                        // Margin brush (v2.2401, Wendi): the brush lives LEFT of Solver › — its own
                        // purple ring when armed, mirroring the solver's blue one.
                        // Font Awesome Free "brush" (fontawesome.com/license/free, CC BY 4.0) — same glyph as the armed cursor.
                        const brushGlyph = (
                          <svg width="13" height="13" viewBox="0 0 640 640" fill="currentColor" aria-hidden="true">
                            <path d="M64 128C64 92.7 92.7 64 128 64L416 64C451.3 64 480 92.7 480 128L496 128C540.2 128 576 163.8 576 208L576 304C576 348.2 540.2 384 496 384L336 384C327.2 384 320 391.2 320 400L320 418.7C338.6 425.3 352 443.1 352 464L352 560C352 586.5 330.5 608 304 608L272 608C245.5 608 224 586.5 224 560L224 464C224 443.1 237.4 425.3 256 418.7L256 400C256 355.8 291.8 320 336 320L496 320C504.8 320 512 312.8 512 304L512 208C512 199.2 504.8 192 496 192L480 192C480 227.3 451.3 256 416 256L128 256C92.7 256 64 227.3 64 192L64 128z"></path>
                          </svg>
                        )
                        const brushControl = brushArmed ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', border: '1.5px solid #8b5cf6', borderRadius: 9, padding: '0.28rem 0.55rem', background: '#f5f3ff', boxShadow: '0 0 0 3px rgba(139, 92, 246, 0.15)', flex: '0 0 auto' }}>
                            <input
                              type="number"
                              min={1}
                              max={95}
                              step={1}
                              value={brushMarginInput}
                              onChange={(e) => setBrushMarginInput(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                              aria-label="Margin percent the brush paints"
                              style={{ width: '3.4rem', font: 'inherit', fontSize: '0.85rem', fontWeight: 700, textAlign: 'right', padding: '0.2rem 0.35rem', border: '1px solid #8b5cf6', borderRadius: 7, color: 'var(--text-violet-700)', background: 'var(--surface)' }}
                            />
                            <span style={{ fontWeight: 800, color: 'var(--text-violet-700)', fontSize: '0.85rem' }}>%</span>
                            {recentMargins.map((rm) => {
                              const sel = String(rm) === String(Math.round(Number(brushMarginInput)))
                              return (
                                <button
                                  key={rm}
                                  type="button"
                                  onClick={() => setBrushMarginInput(String(rm))}
                                  title={`Load the brush with ${rm}%`}
                                  style={{ font: 'inherit', fontSize: '0.75rem', fontWeight: 700, padding: '0.12rem 0.55rem', borderRadius: 999, border: sel ? '1px solid #8b5cf6' : '1px solid var(--border-strong)', background: sel ? '#8b5cf6' : 'var(--surface)', color: sel ? '#fff' : 'var(--text-700)', cursor: 'pointer' }}
                                >
                                  {rm}%
                                </button>
                              )
                            })}
                            {brushUndo ? (
                              <button
                                type="button"
                                disabled={brushCommitting}
                                onClick={() => void undoBrushSweep()}
                                style={{ font: 'inherit', fontSize: '0.72rem', fontWeight: 600, padding: '0.16rem 0.5rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: brushCommitting ? 'wait' : 'pointer' }}
                              >
                                ↩ Undo sweep ({brushUndo.length})
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={disarmBrush}
                              title="Put the brush down (Esc)"
                              aria-label="Put the brush down"
                              style={{ font: 'inherit', fontSize: '0.85rem', fontWeight: 800, padding: '0.24rem 0.5rem', border: 'none', borderRadius: 6, background: '#8b5cf6', color: '#fff', cursor: 'pointer', lineHeight: 1 }}
                            >
                              ‹
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={armBrush}
                            aria-pressed={false}
                            title="Margin brush — pick it up, then sweep across rows to price them"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', font: 'inherit', fontSize: '0.8rem', fontWeight: 700, padding: '0.3rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer', whiteSpace: 'nowrap', lineHeight: 1, flex: '0 0 auto' }}
                          >
                            {brushGlyph}
                            Margin ›
                          </button>
                        )
                        // v2.4194: a second line under the scoreboard when the bid carries an alternate —
                        // the base, what each alternate adds (with its own margin on hover), and the whole.
                        const whole = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`
                        const altLine =
                          altRevenue && altCost ? (
                            <div data-testid="workbench-alternates" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem 0.9rem', flexWrap: 'wrap', marginTop: '0.45rem', paddingTop: '0.4rem', borderTop: '1px dashed var(--border-strong)' }}>
                              {stat('Base', whole(altRevenue.base), 'var(--text-strong)', `$${formatCurrency(altRevenue.base)} · our cost $${formatCurrency(altCost.base)}`)}
                              {altRevenue.alternates.map((a, i) => {
                                const c = altCost.alternates[i]?.value ?? 0
                                const m = a.value > 0 ? (a.value - c) / a.value : null
                                return stat(`+ ${a.label}`, whole(a.value), 'var(--text-amber-700)', `$${formatCurrency(a.value)} · our cost $${formatCurrency(c)}${m != null ? ` · margin ${Math.round(m * 100)}%` : ''}`)
                              })}
                              {stat(altRevenue.alternates.length === 1 ? 'With the alternate' : 'With every alternate', whole(altRevenue.total), 'var(--text-strong)', `$${formatCurrency(altRevenue.total)} · our cost $${formatCurrency(altCost.total)}`)}
                              {altRevenue.alternates.length === 1 && altRevenue.alternates[0]!.value > 0
                                ? stat('Alternate margin', `${Math.round(((altRevenue.alternates[0]!.value - (altCost.alternates[0]?.value ?? 0)) / altRevenue.alternates[0]!.value) * 100)}%`, mColor((altRevenue.alternates[0]!.value - (altCost.alternates[0]?.value ?? 0)) / altRevenue.alternates[0]!.value))
                                : null}
                            </div>
                          ) : null
                        return (
                          <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem 0.9rem', flexWrap: 'wrap' }}>
                            {/* Whole dollars only — the strip is a scoreboard, cents live in the rows (owner, v2.2205). */}
                            {stat('Revenue', `$${Math.round(effRevenue).toLocaleString('en-US')}`, 'var(--text-strong)', `$${formatCurrency(effRevenue)} · our cost $${formatCurrency(totalCost)}`)}
                            {stat('Profit', `${effProfit < 0 ? '-' : ''}$${Math.abs(Math.round(effProfit)).toLocaleString('en-US')}`, effProfit >= 0 ? 'var(--text-green-600)' : 'var(--text-red-700)', `$${formatCurrency(effProfit)} · our cost $${formatCurrency(totalCost)}`)}
                            {stat('Margin', effMargin == null ? '—' : `${Math.round(effMargin * 100)}%`, mColor(effMargin))}
                            {/* v2.2423 (owner): margin's other dialect — revenue as a multiple of cost. */}
                            {stat('Multiple', formatRevenueMultiple(effRevenue, totalCost) ?? '—', mColor(effMargin), `Revenue ÷ our cost — $${formatCurrency(effRevenue)} ÷ $${formatCurrency(totalCost)}`)}
                            {/* v2.2378 (Wendi): coverage lives here as a chip — green ✓ when everything's
                                priced, amber while work remains; the caret drops today's bar + filter row. */}
                            {costed.length > 0 ? (
                              <button
                                type="button"
                                onClick={toggleWbCoverageOpen}
                                aria-expanded={wbCoverageOpen}
                                title={
                                  pricedCount === costed.length
                                    ? `All ${costed.length} costed rows have a sale price`
                                    : `${costed.length - pricedCount} costed row${costed.length - pricedCount === 1 ? '' : 's'} still unpriced${unpricedCost > 0 ? ` — $${formatCurrency(unpricedCost)} of cost has no sale price yet` : ''}`
                                }
                                style={{
                                  font: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.16rem 0.55rem', borderRadius: 999,
                                  fontSize: '0.75rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', cursor: 'pointer', flex: '0 0 auto',
                                  border: pricedCount === costed.length ? '1px solid var(--border-strong)' : '1px solid var(--text-amber-700)',
                                  background: pricedCount === costed.length ? 'var(--surface)' : 'var(--bg-amber-tint)',
                                  color: pricedCount === costed.length ? 'var(--text-green-600)' : 'var(--text-amber-700)',
                                }}
                              >
                                {pricedCount}/{costed.length}{pricedCount === costed.length ? ' ✓' : ''}
                                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{wbCoverageOpen ? '▾' : '▸'}</span>
                              </button>
                            ) : null}
                            {!wbSolverOpen ? (
                              // v2.2385: folded — the strip is a scoreboard with one blue door. A pending
                              // preview's actions stay on the strip; folding can never hide unsaved work.
                              rightCluster(
                                <>
                                  {solverEndDoor}
                                  {brushControl}
                                  <button
                                    type="button"
                                    onClick={() => setAndRememberWbSolverOpen(true)}
                                    aria-expanded={false}
                                    title="Open the solver — margin, target total, Solve"
                                    style={{ font: 'inherit', fontSize: '0.8rem', fontWeight: 700, padding: '0.32rem 0.75rem', border: 'none', borderRadius: 6, background: '#3b82f6', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap', lineHeight: 1 }}
                                  >
                                    Solver ›
                                  </button>
                                  {restoredChip}
                                  {previewControl}
                                </>,
                              )
                            ) : (
                              // v2.2385: open — every solver control inside one blue ring, ‹ folds it away.
                              // The brush's compact button keeps riding left of the ring (v2.2401).
                              <>
                              {brushControl}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem 0.8rem', flexWrap: 'wrap', flex: '1 1 460px', minWidth: 300, border: '1.5px solid #3b82f6', borderRadius: 9, padding: '0.3rem 0.6rem', background: 'var(--bg-blue-tint)', boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.15)' }}>
                                <button
                                  type="button"
                                  onClick={() => setAndRememberWbSolverOpen(false)}
                                  aria-expanded={true}
                                  title="Fold the solver away"
                                  aria-label="Fold the solver away"
                                  style={{ font: 'inherit', fontSize: '0.85rem', fontWeight: 800, padding: '0.3rem 0.55rem', border: 'none', borderRadius: 6, background: '#3b82f6', color: '#fff', cursor: 'pointer', lineHeight: 1, flex: '0 0 auto' }}
                                >
                                  ‹
                                </button>
                                {altRevenue && altRevenue.alternates.length > 0 ? (() => {
                                  // v2.4202: Solve for — Base · + <alternate> · Whole bid. Held rows and the rows outside keep their prices.
                                  const labels = new Map(altRevenue.alternates.map((a) => [a.label.trim().toLowerCase(), a.label] as const))
                                  const scopes: WorkbenchSolveScope[] = ['base', ...altRevenue.alternates.map((a) => ({ alternate: a.label.trim().toLowerCase() })), 'whole']
                                  const pill = (sc: WorkbenchSolveScope) => {
                                    const on = sameSolveScope(sc, wbSolveScope)
                                    return (
                                      <button
                                        key={solveScopeLabel(sc)}
                                        type="button"
                                        onClick={() => { setWbSolveScope(sc); setWbSolveLanding(null) }}
                                        aria-pressed={on}
                                        title={sc === 'whole' ? 'Price every row' : sc === 'base' ? 'Price the rows outside the alternate — its rows keep their prices' : 'Price only this alternate\'s rows'}
                                        style={{ font: 'inherit', fontSize: '0.72rem', fontWeight: 700, padding: '0.16rem 0.55rem', borderRadius: 999, border: `1px solid ${on ? '#3b82f6' : 'var(--border-strong)'}`, background: on ? '#3b82f6' : 'var(--surface)', color: on ? '#fff' : 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                      >
                                        {solveScopeLabel(sc, labels)}
                                      </button>
                                    )
                                  }
                                  return (
                                    <span data-testid="workbench-solve-scope" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                                      <span style={labelStyle}>Solve for</span>
                                      {scopes.map(pill)}
                                    </span>
                                  )
                                })() : null}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flex: '1 1 230px', minWidth: 210 }}>
                                  <span style={labelStyle}>Margin</span>
                                  <span style={{ flex: 1, minWidth: 110, position: 'relative', display: 'inline-flex', flexDirection: 'column' }}>
                                    <input
                                      type="range" min={20} max={95} step={1} value={Math.min(95, Math.max(20, wbMarginPct))}
                                      onChange={(e) => {
                                        // Live solve on every step of the drag — totals and ghosts track the thumb.
                                        const v = Number(e.target.value)
                                        setWbMarginPct(v)
                                        runWorkbenchSolve({ marginPct: v })
                                      }}
                                      style={{ width: '100%', accentColor: '#3b82f6' }}
                                      aria-label="Margin for the costed rows"
                                      title={`Prices the ${costed.length} costed row${costed.length !== 1 ? 's' : ''} at this margin, live as you drag — rows without Takeoffs cost keep their prices and stack on top. Prices round up to $5.`}
                                    />
                                    <span aria-hidden style={{ position: 'relative', display: 'block', height: '0.8rem' }}>
                                      {/* Markup reference ticks: 2× = 50% margin, 3× = 66%, 4× = 75%, 5× = 80%. */}
                                      {(
                                        [
                                          ['2', 50],
                                          ['3', 66],
                                          ['4', 75],
                                          ['5', 80],
                                        ] as const
                                      ).map(([mult, pct]) => (
                                        <span
                                          key={mult}
                                          title={`${mult}× markup = ${pct}% margin`}
                                          style={{ position: 'absolute', left: `${((pct - 20) / 75) * 100}%`, transform: 'translateX(-50%)', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 1, fontSize: '0.58rem', color: 'var(--text-muted)', cursor: 'help', lineHeight: 1 }}
                                        >
                                          <span style={{ display: 'block', width: 1, height: 4, background: 'var(--border-strong)' }} />
                                          {mult}
                                        </span>
                                      ))}
                                    </span>
                                  </span>
                                  <input
                                    type="number" min={1} max={95} inputMode="numeric" value={wbMarginPct}
                                    onChange={(e) => {
                                      const v = Math.round(Number(e.target.value))
                                      if (Number.isFinite(v)) setWbMarginPct(Math.min(95, Math.max(1, v)))
                                    }}
                                    onBlur={() => runWorkbenchSolve({})}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault()
                                        runWorkbenchSolve({})
                                      }
                                    }}
                                    aria-label="Margin percent for the costed rows"
                                    style={{ width: '3.4rem', font: 'inherit', fontSize: '0.95rem', fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums', padding: '0.18rem 0.3rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)' }}
                                  />
                                  <span style={{ fontSize: '0.95rem', fontWeight: 700 }}>%</span>
                                </div>
                                <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)', flex: '0 0 1px' }} className="wb-solver-sep" />
                                {/* Label + control move as ONE unit on wrap — never a label orphaned from its field. */}
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', flex: '0 0 auto', whiteSpace: 'nowrap' }}>
                                  <span style={labelStyle}>or total</span>
                                  <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', overflow: 'hidden', flex: '0 0 auto' }}>
                                    <span style={{ padding: '0 0.4rem 0 0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>$</span>
                                    <input
                                      type="text" inputMode="decimal" placeholder="42,000" value={wbTargetTotalInput}
                                      onChange={(e) => setWbTargetTotalInput(e.target.value)}
                                      // While she's in the box, slider solves keep their hands off it (v2.2403);
                                      // select-on-focus so stepping over from the slider is type-to-replace.
                                      onFocus={(e) => {
                                        wbTargetTotalFocusedRef.current = true
                                        const el = e.currentTarget
                                        window.setTimeout(() => el.select(), 0)
                                      }}
                                      onBlur={() => { wbTargetTotalFocusedRef.current = false }}
                                      onKeyDown={(e) => {
                                        if (e.key !== 'Enter') return
                                        e.preventDefault()
                                        solveToTarget()
                                      }}
                                      aria-label="Target bid total"
                                      style={{ border: 0, width: `${Math.max(wbTargetTotalInput.length, 6) + 1}ch`, padding: '0.33rem 0.45rem 0.33rem 0', font: 'inherit', fontSize: '0.9rem', fontWeight: 600, background: 'transparent', color: 'var(--text-strong)', outline: 'none' }}
                                    />
                                  </div>
                                  {/* Solve belongs to "or total" (v2.2388, Wendi) — inside the unit it sits tight
                                      to the field and the whole "or total $___ Solve ▾" wraps as one piece. */}
                                  <span ref={solveMenuRef} style={{ position: 'relative', display: 'inline-flex', flex: '0 0 auto' }}>
                                  <button type="button" onClick={solveToTarget} style={{ font: 'inherit', fontSize: '0.8rem', fontWeight: 600, padding: '0.35rem 0.8rem', borderRadius: '6px 0 0 6px', border: '1px solid #3b82f6', background: '#3b82f6', color: '#fff', cursor: 'pointer' }}>
                                    Solve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setSolveMenuOpen((o) => !o)}
                                    aria-haspopup="menu"
                                    aria-expanded={solveMenuOpen}
                                    aria-label="More ways to solve"
                                    title="More ways to solve"
                                    style={{ font: 'inherit', fontSize: '0.7rem', padding: '0.35rem 0.45rem', borderRadius: '0 6px 6px 0', border: '1px solid #3b82f6', borderLeft: '1px solid rgba(255, 255, 255, 0.35)', background: '#3b82f6', color: '#fff', cursor: 'pointer' }}
                                  >
                                    ▾
                                  </button>
                                  {solveMenuOpen ? (
                                    <span role="menu" aria-label="More ways to solve" style={{ position: 'absolute', left: 0, top: 'calc(100% + 0.3rem)', minWidth: '16.5rem', maxWidth: 'calc(100vw - 1rem)', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 8, boxShadow: '0 6px 24px rgba(15, 23, 42, 0.14)', padding: '0.3rem', zIndex: 40 }}>
                                      <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => { setSolveMenuOpen(false); runWorkbenchSolve({ onlyUnpriced: true }) }}
                                        style={{ display: 'block', width: '100%', padding: '0.45rem 0.55rem', border: 'none', background: 'none', borderRadius: 6, font: 'inherit', textAlign: 'left', cursor: 'pointer', color: 'var(--text-strong)' }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-subtle)' }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
                                      >
                                        Price unpriced only
                                        <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.74rem' }}>fills only rows with no sale price, at the current margin — priced rows are held as-is</span>
                                      </button>
                                    </span>
                                  ) : null}
                                  </span>
                                </span>
                                {rightCluster(
                                  <>
                                    {solverEndDoor}
                                    {restoredChip}
                                    {previewControl}
                                  </>,
                                )}
                              </div>
                              </>
                            )}
                          </div>
                          {altLine}
                          </>
                        )
                      })()}
                      {brushArmed ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.5rem', border: '1px solid #ddd6fe', background: '#f5f3ff', color: 'var(--text-violet-700)', borderRadius: 8, padding: '0.35rem 0.7rem', fontSize: '0.78rem', fontWeight: 600 }}>
                          <span>Sweep across rows to price them at {brushMargin ?? '—'}% — held 📌, fixed-price and no-cost rows are skipped. Esc puts the brush down.</span>
                          {brushCommitting ? (
                            <span style={{ marginLeft: 'auto', fontWeight: 800 }}>Saving…</span>
                          ) : brushStrokeCount > 0 ? (
                            <span style={{ marginLeft: 'auto', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>Painting {brushStrokeCount} row{brushStrokeCount === 1 ? '' : 's'} @ {brushMargin ?? '—'}%</span>
                          ) : null}
                        </div>
                      ) : null}
                      {/* v2.2402 (Wendi): solver blue, no "→ bid is …" restatement (the totals sit
                          right above), tucked tight under the Revenue/Profit/Margin strip. */}
                      {wbSolveLanding && wbPreview && previewCount > 0 ? (
                        <div style={{ marginTop: '0.15rem' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-blue-700)', background: 'var(--bg-blue-tint)', border: '1px solid #3b82f6', borderRadius: 999, padding: '0.18rem 0.7rem', fontVariantNumeric: 'tabular-nums' }}>
                            {wbSolveLanding.pct}% on {wbSolveLanding.rows} costed row{wbSolveLanding.rows === 1 ? '' : 's'}
                          </span>
                        </div>
                      ) : null}
                      {/* Only worth saying while a solve is pending — that's when "unaffected" means something. */}
                      {uncostedRevenue > 0 && wbPreview && previewCount + vetoCount > 0 ? (
                        <div style={{ marginTop: '0.55rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.7rem', flexWrap: 'wrap', border: '1px solid var(--border)', background: 'var(--bg-subtle)', borderRadius: 7, padding: '0.4rem 0.7rem' }}>
                          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                            <strong style={{ color: 'var(--text-strong)' }}>{eff.length - costed.length}/{eff.length} have no cost:</strong> their ${formatCurrency(uncostedRevenue)} is unaffected
                          </span>
                          <button
                            type="button"
                            onClick={() => { setWbShowNoCostOnly((v) => !v); setWbShowUnpricedOnly(false) }}
                            style={{ font: 'inherit', fontSize: '0.72rem', padding: '0.2rem 0.6rem', borderRadius: 999, border: '1px solid var(--border-strong)', cursor: 'pointer', whiteSpace: 'nowrap', background: wbShowNoCostOnly ? '#3b82f6' : 'var(--surface)', color: wbShowNoCostOnly ? '#fff' : 'var(--text-700)' }}
                          >
                            {wbShowNoCostOnly ? 'Showing no-cost rows — show all' : `Show these ${eff.length - costed.length} rows`}
                          </button>
                        </div>
                      ) : null}
                    {/* Frozen bid prices, PR 3 (v2.3591): a sent bid is locked — the chip says so and Revise unlocks it for this session. */}
                    {(() => {
                      const chip = pricingLockChipText(pricingLock, selectedBidForPricing?.bid_date_sent, new Date().getFullYear())
                      if (!chip) return null
                      const revising = pricingLock === 'revising'
                      return (
                        <div data-testid="pricing-lock-chip" style={{ marginTop: '0.45rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.74rem' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              padding: '0.15rem 0.55rem',
                              borderRadius: 999,
                              border: `1px solid ${revising ? 'var(--border-amber)' : 'var(--border-strong)'}`,
                              background: revising ? 'var(--bg-amber-tint)' : 'var(--bg-subtle)',
                              color: revising ? 'var(--text-amber-700)' : 'var(--text-600)',
                              fontWeight: 600,
                            }}
                          >
                            {revising ? '✎' : '🔒'} {chip}
                          </span>
                          <button
                            type="button"
                            onClick={() => setPricingRevising(!revising)}
                            title={revising ? 'Lock this bid\'s pricing again' : 'Unlock this bid\'s pricing for this session — changes after send are on purpose'}
                            style={{ padding: '0.15rem 0.55rem', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 600 }}
                          >
                            {revising ? 'Lock again' : 'Revise…'}
                          </button>
                        </div>
                      )
                    })()}
                    {/* Frozen bid prices, PR 2: on a sent bid the grid is a recomputation, not the quote —
                        `bid_value` (stamped at send) is the honest number; say both wherever the live one is read. */}
                    {(() => {
                      const cmp = compareSentVsToday({ bidDateSent: selectedBidForPricing?.bid_date_sent, bidValue: selectedBidForPricing?.bid_value, today: effRevenue })
                      if (!cmp) return null
                      const differs = cmp.kind === 'differs'
                      return (
                        <div
                          data-testid="pricing-sent-vs-today"
                          style={{ marginTop: '0.4rem', fontSize: '0.74rem', fontVariantNumeric: 'tabular-nums', color: differs ? 'var(--text-amber-700)' : 'var(--text-muted)', fontWeight: differs ? 600 : 400 }}
                        >
                          {sentVsTodayText(cmp, { where: 'grid', currentYear: new Date().getFullYear() })}
                        </div>
                      )
                    })()}
                    <PricingMaterialsTodayNote
                      drift={materialsToday}
                      onSeeTakeoffs={() => {
                        if (selectedBidForPricing) onNavigateBidToTab(selectedBidForPricing, 'takeoffs')
                      }}
                    />
                    </div>
                    </div>

                    {bidsLikeThisSlot
                      ? createPortal(
                          <PricingBidsLikeThis
                            history={wbHistory}
                            currentBidId={selectedBidForPricing?.id}
                            currentPrice={effRevenue}
                            currentMargin={effMargin}
                            gcCustomerId={selectedBidForPricing?.customer_id ?? null}
                            gcName={selectedBidForPricing?.customers?.name ?? null}
                          />,
                          bidsLikeThisSlot,
                        )
                      : null}
                    {/* Batch 2: short label — "N of M priced" (owner). v2.2378: collapsed behind the
                        solver-line chip by default — this row renders only while the chip is expanded. */}
                    {(wbCoverageOpen || wbShowUnpricedOnly) && costed.length > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '0.7rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-700)', fontVariantNumeric: 'tabular-nums' }} title={unpricedCost > 0 ? `$${formatCurrency(unpricedCost)} of cost has no sale price yet` : undefined}>
                        {pricedCount} of {costed.length} priced
                      </span>
                      <div style={{ flex: 1, minWidth: 160, height: 8, borderRadius: 999, background: 'var(--bg-muted)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 999, width: `${costed.length > 0 ? (pricedCount / costed.length) * 100 : 0}%`, background: pricedCount === costed.length ? 'var(--text-green-600)' : 'var(--text-amber-700)', transition: 'width 0.25s' }} />
                      </div>
                      <button
                        type="button"
                        onClick={() => { setWbShowUnpricedOnly((v) => !v); setWbShowNoCostOnly(false) }}
                        style={{ font: 'inherit', fontSize: '0.78rem', padding: '0.26rem 0.6rem', borderRadius: 999, border: '1px solid var(--border-strong)', cursor: 'pointer', background: wbShowUnpricedOnly ? '#3b82f6' : 'var(--surface)', color: wbShowUnpricedOnly ? '#fff' : 'var(--text-700)' }}
                      >
                        {wbShowUnpricedOnly ? 'Showing unpriced — show all' : 'Show unpriced only'}
                      </button>
                    </div>
                    ) : null}

                    {(() => {
                      const bookMatches = matchCountRowsToBookEntries(
                        eff.map((r) => ({ id: r.countRow.id, fixture: r.countRow.fixture, hasAssignment: r.assignment != null })),
                        priceBookEntries.map((e) => ({ id: e.id, name: e.fixture_types?.name ?? null })),
                      )
                      const activeBookName =
                        priceBookVersions.find((v) => v.id === selectedPricingVersionId)?.name ??
                        templatePriceBookVersions.find((v) => v.id === selectedPricingVersionId)?.name ??
                        'this pricing'
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.55rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.63rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Price book</span>
                          <button
                            type="button"
                            onClick={() => {
                              setWbBookDrawerOpen(true)
                              setWbBooksExpanded(false)
                              const t = currentPriceBookTemplateId ?? templatePriceBookVersions[0]?.id ?? null
                              if (t) selectPanelVersion(t)
                            }}
                            title="Open the price book — switch books, edit entries"
                            style={{ font: 'inherit', fontSize: '0.78rem', color: 'var(--text-700)', border: '1px solid var(--border-strong)', borderRadius: 999, background: 'var(--surface)', padding: '0.18rem 0.7rem', cursor: 'pointer' }}
                          >
                            {activeBookName} · {priceBookEntries.length} entr{priceBookEntries.length === 1 ? 'y' : 'ies'} <b style={{ color: 'var(--text-link)' }}>{'\u25b8'}</b>
                          </button>
                          <button
                            type="button"
                            disabled={wbFillingBook || bookMatches.length === 0}
                            onClick={() => void fillMatchingBookEntries(bookMatches)}
                            title={bookMatches.length === 0 ? 'No unassigned rows exactly match a book entry name' : 'Assign each matching row its book entry — prices fill from the book'}
                            style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '0.28rem 0.7rem', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', cursor: bookMatches.length === 0 ? 'not-allowed' : 'pointer', opacity: wbFillingBook || bookMatches.length === 0 ? 0.55 : 1 }}
                          >
                            {wbFillingBook ? 'Filling…' : bookMatches.length === 0 ? '0 unassigned rows match the book' : `Fill ${bookMatches.length} matching from book`}
                          </button>
                        </div>
                      )
                    })()}

                    <div
                      data-tour="workbench-rows"
                      // Margin brush (v2.2401): armed, the grid is a canvas — capture-phase down
                      // starts a stroke, moves paint every row the pointer crosses, up commits the
                      // batch (useMarginBrush). The cursor is the brush itself (Font Awesome Free
                      // glyph, hotspot at the bristle edge).
                      {...brushGridPointerHandlers(eff)}
                      style={{
                        background: 'var(--surface)',
                        border: brushArmed ? '1px solid #8b5cf6' : '1px solid var(--border)',
                        borderRadius: 10,
                        overflowX: 'auto',
                        ...(brushArmed
                          ? {
                              touchAction: 'none',
                              userSelect: 'none',
                              WebkitUserSelect: 'none',
                              cursor: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='26' height='26' viewBox='0 0 640 640'%3E%3Cpath fill='%236d28d9' stroke='%23ffffff' stroke-width='34' d='M64 128C64 92.7 92.7 64 128 64L416 64C451.3 64 480 92.7 480 128L496 128C540.2 128 576 163.8 576 208L576 304C576 348.2 540.2 384 496 384L336 384C327.2 384 320 391.2 320 400L320 418.7C338.6 425.3 352 443.1 352 464L352 560C352 586.5 330.5 608 304 608L272 608C245.5 608 224 586.5 224 560L224 464C224 443.1 237.4 425.3 256 418.7L256 400C256 355.8 291.8 320 336 320L496 320C504.8 320 512 312.8 512 304L512 208C512 199.2 504.8 192 496 192L480 192C480 227.3 451.3 256 416 256L128 256C92.7 256 64 227.3 64 192L64 128z'/%3E%3C/svg%3E") 13 1, crosshair`,
                            }
                          : {}),
                      }}
                    >
                      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85rem', minWidth: 900 }}>
                        <thead>
                          <tr>
                            {([
                              ['', 'left'],
                              ['Fixture or tie-in', 'left'],
                              ['Count', 'center'],
                              ['Cost/unit', 'right'],
                              ['Book entry', 'left'],
                              ['Sale price/unit', 'left'],
                              ['Revenue', 'center'],
                              ['Profit', 'center'],
                              ['Margin', 'right'],
                              ['', 'left'],
                            ] as const).map(([h, align], i) => (
                              <th key={`${h}-${i}`} style={{ textAlign: align, fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', padding: '0.5rem 0.7rem', borderBottom: '1px solid var(--border)' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {visibleEff.map((r) => {
                            const locked = r.isFixedPrice || wbLocks.has(r.countRow.id)
                            return (
                              <tr
                                key={r.countRow.id}
                                id={`wb-row-${r.countRow.id}`}
                                // No row-level click: the breakdown opens ONLY from the row's ⓘ button
                                // (v2.NEXT, Wendi — it kept popping up mid-typing when a click missed an input).
                                style={{
                                  // Brushed rows tint violet while their sweep is in flight (v2.2401).
                                  background:
                                    brushArmed && wbPriceDrafts[r.countRow.id] != null
                                      ? '#f5f3ff'
                                      : wbFlashRowId === r.countRow.id
                                        ? 'var(--bg-blue-tint)'
                                        : r.effUnit == null && r.cost > 0
                                          ? 'var(--bg-amber-tint)'
                                          : undefined,
                                  transition: 'background 400ms ease',
                                }}
                              >
                                <td style={{ padding: '0.35rem 0.4rem 0.35rem 0.7rem', borderBottom: '1px solid var(--border)' }}>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (r.isFixedPrice) { showToast('Fixed-price row — always held by the solver.', 'error'); return }
                                      setWbLocks((prev) => {
                                        const next = new Set(prev)
                                        if (next.has(r.countRow.id)) next.delete(r.countRow.id)
                                        else next.add(r.countRow.id)
                                        return next
                                      })
                                    }}
                                    title={r.isFixedPrice ? 'Fixed price — always held' : locked ? 'Held — the solver will not move this row' : 'Hold this price while solving'}
                                    style={{ font: 'inherit', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', padding: '0.05rem 0.2rem', opacity: locked ? 1 : 0.3 }}
                                  >
                                    📌
                                  </button>
                                </td>
                                <td style={{ padding: '0.35rem 0.7rem', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>{r.countRow.fixture ?? '—'}{altChip(r.countRow.id)}</td>
                                <td style={{ padding: '0.35rem 0.7rem', borderBottom: '1px solid var(--border)', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{r.count}</td>
                                <td style={{ padding: '0.35rem 0.7rem', borderBottom: '1px solid var(--border)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: r.cost > 0 ? 'var(--text-700)' : 'var(--text-muted)' }} onClick={(e) => e.stopPropagation()}>
                                  {r.cost > 0 ? `$${formatCurrency(r.cost / r.count)}` : 'no cost'}
                                  {(() => {
                                    const cc = bidCountRowCustomCosts.find((c) => c.count_row_id === r.countRow.id)
                                    if (!cc) return null
                                    return (
                                      <button
                                        type="button"
                                        title={`Materials from ${cc.house_name ?? 'a quote'} (${calendarYmdInAppTzFromIso(cc.applied_at).slice(5, 10)})${cc.lot_group_id ? ' — part of a package; reverting reverts the whole package' : ''} — click to revert to takeoff`}
                                        onClick={() => void revertCustomCost(cc)}
                                        style={{ display: 'block', marginLeft: 'auto', font: 'inherit', fontSize: '0.62rem', fontWeight: 700, color: '#15803d', background: 'none', border: '1px solid #16a34a', borderRadius: 999, padding: '0 0.4rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                      >
                                        {cc.house_name ?? 'quote'} ↩
                                      </button>
                                    )
                                  })()}
                                </td>
                                <td style={{ padding: '0.35rem 0.7rem', borderBottom: '1px solid var(--border)', minWidth: '9rem' }} onClick={(e) => e.stopPropagation()}>
                                  {r.entry ? (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'var(--bg-blue-tint)', border: '1px solid var(--border)', color: 'var(--text-blue-700)', borderRadius: 6, padding: '0.1rem 0.5rem', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                      {r.entry.fixture_types?.name ?? 'entry'} · ${formatCurrency(Number(r.entry.total_price) || 0)}
                                      <button
                                        type="button"
                                        onClick={() => void removePricingAssignment(r.countRow.id)}
                                        title="Unassign this book entry"
                                        aria-label={`Unassign book entry from ${r.countRow.fixture}`}
                                        style={{ font: 'inherit', border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ) : (
                                    <div style={{ position: 'relative' }} data-pricing-assignment-dropdown>
                                      {pricingAssignmentDropdownOpen === r.countRow.id ? (
                                        <input
                                          type="text"
                                          autoFocus
                                          value={pricingAssignmentSearches[r.countRow.id] ?? ''}
                                          onChange={(e) => setPricingAssignmentSearches((prev) => ({ ...prev, [r.countRow.id]: e.target.value }))}
                                          placeholder="Search the book…"
                                          aria-label={`Assign a book entry to ${r.countRow.fixture}`}
                                          style={{ width: '9rem', font: 'inherit', fontSize: '0.78rem', padding: '0.2rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)' }}
                                        />
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setPricingAssignmentSearches((prev) => ({ ...prev, [r.countRow.id]: seedPricingAssignmentSearch(r.countRow.fixture) }))
                                            setPricingAssignmentDropdownOpen(r.countRow.id)
                                          }}
                                          title="Assign a price-book entry — the book's price fills the row"
                                          style={{ font: 'inherit', fontSize: '0.75rem', color: 'var(--text-muted)', border: '1px dashed var(--border-strong)', background: 'none', borderRadius: 6, padding: '0.12rem 0.55rem', cursor: 'pointer' }}
                                        >
                                          assign…
                                        </button>
                                      )}
                                      {pricingAssignmentDropdownOpen === r.countRow.id ? (() => {
                                        const term = pricingAssignmentSearches[r.countRow.id] ?? ''
                                        const res = searchPriceBookEntries(priceBookEntries, (e) => e.fixture_types?.name ?? '', term, assignMatchMode, Infinity)
                                        return (
                                          <div style={{ position: 'absolute', top: '100%', left: 0, minWidth: '20rem', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, marginTop: '0.2rem', maxHeight: 260, overflowY: 'auto', zIndex: 30, boxShadow: '0 8px 20px rgba(0,0,0,0.18)' }}>
                                            {renderAssignDropdownHeader(res, term)}
                                            {res.matches.length > 0 ? (
                                              res.matches.map(({ entry: e, name, ranges }) => (
                                                <button
                                                  key={e.id}
                                                  type="button"
                                                  onClick={() => {
                                                    void savePricingAssignment(r.countRow.id, e.id)
                                                    setPricingAssignmentSearches((prev) => {
                                                      const next = { ...prev }
                                                      delete next[r.countRow.id]
                                                      return next
                                                    })
                                                    setPricingAssignmentDropdownOpen(null)
                                                  }}
                                                  style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', width: '100%', textAlign: 'left', font: 'inherit', fontSize: '0.78rem', padding: '0.35rem 0.55rem', border: 'none', borderBottom: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer' }}
                                                >
                                                  <span>{renderAssignHighlightedName(name, ranges)}</span>
                                                  <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>${formatCurrency(Number(e.total_price) || 0)}</span>
                                                </button>
                                              ))
                                            ) : assignMatchMode === 'exact' && term.trim() ? (
                                              renderAssignExactEmptyEscape(res, term)
                                            ) : (
                                              <div style={{ padding: '0.45rem 0.55rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>No book entries match.</div>
                                            )}
                                            {/* v2.2398 (Wendi): the Old page's add door, here too — and even when
                                                there ARE matches, since near-misses are when a new entry is needed. */}
                                            {term.trim() ? (
                                              <button
                                                type="button"
                                                onClick={() => openAddEntryFromAssignSearch(term)}
                                                style={{ display: 'block', width: '100%', font: 'inherit', padding: '0.45rem 0.55rem', border: 'none', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text-link)', fontWeight: 600, cursor: 'pointer', fontSize: '0.78rem', textAlign: 'center' }}
                                              >
                                                + Add "{term.trim()}" to the book
                                              </button>
                                            ) : null}
                                          </div>
                                        )
                                      })() : null}
                                    </div>
                                  )}
                                </td>
                                <td style={{ padding: '0.35rem 0.7rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                                  {r.isPreview ? (
                                    // The solver's proposal rides LEFT of the untouched saved price
                                    // (owner-approved prototype, v2.2379). Clicking it toggles this
                                    // row out of Apply: red + ✕ = clicked off, its price holds.
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        toggleWbPreviewVeto(r.countRow.id)
                                      }}
                                      title={
                                        r.isVetoed
                                          ? 'Clicked off — Apply keeps this row’s saved price. Click to bring the proposal back.'
                                          : 'Solver proposal — not saved yet. Click to drop just this row from Apply; its saved price holds.'
                                      }
                                      aria-label={`${r.isVetoed ? 'Restore' : 'Drop'} the proposed price for ${r.countRow.fixture ?? 'row'}`}
                                      aria-pressed={r.isVetoed}
                                      style={{
                                        font: 'inherit',
                                        fontSize: '0.82rem',
                                        fontWeight: 700,
                                        fontVariantNumeric: 'tabular-nums',
                                        border: 'none',
                                        background: 'none',
                                        cursor: 'pointer',
                                        padding: '0.1rem 0.25rem',
                                        marginRight: '0.15rem',
                                        color: r.isVetoed ? 'var(--text-red-700)' : '#8b5cf6',
                                        textDecoration: r.isVetoed ? 'line-through' : 'none',
                                      }}
                                    >
                                      ${formatCurrency(wbPreview?.[r.countRow.id] ?? 0)} {r.isVetoed ? '✕' : '→'}
                                    </button>
                                  ) : null}
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    // Reads as money when idle ($1,130.00); editing shows the raw number.
                                    // A saved $0 shows the — placeholder like any unpriced row (v2.2396).
                                    value={
                                      wbPriceDrafts[r.countRow.id] ??
                                      (r.unitPrice != null && r.unitPrice > 0 ? `$${formatCurrency(r.unitPrice)}` : '')
                                    }
                                    placeholder="—"
                                    onClick={(e) => e.stopPropagation()}
                                    onMouseDown={(e) => {
                                      const el = e.currentTarget
                                      if (document.activeElement !== el) el.dataset.selectAll = '1'
                                    }}
                                    onMouseUp={(e) => {
                                      // A slow click's mouseup lands AFTER the deferred select() and drops the
                                      // caret, un-selecting — so typing appended to the old number instead of
                                      // replacing it (v2.NEXT, Wendi). Swallow that first mouseup once.
                                      const el = e.currentTarget
                                      if (el.dataset.selectAll) {
                                        e.preventDefault()
                                        delete el.dataset.selectAll
                                      }
                                    }}
                                    onFocus={(e) => {
                                      // Typing overwrites: seed the raw editable number, then select it after
                                      // the click's own caret placement lands (v2.2372).
                                      const el = e.currentTarget
                                      setWbPriceDrafts((prev) =>
                                        prev[r.countRow.id] != null
                                          ? prev
                                          : { ...prev, [r.countRow.id]: r.unitPrice != null && r.unitPrice > 0 ? String(Math.round(r.unitPrice * 100) / 100) : '' },
                                      )
                                      window.setTimeout(() => el.select(), 0)
                                    }}
                                    onChange={(e) => {
                                      // Draft while typing (live totals recompute); the save happens on Enter/blur (v2.2373).
                                      const raw = e.target.value
                                      setWbPriceDrafts((prev) => ({ ...prev, [r.countRow.id]: raw }))
                                      // A hand edit means the totals are no longer "the 56% solve" — the chip stands down.
                                      setWbSolveLanding(null)
                                    }}
                                    onBlur={() => void commitWorkbenchTypedPrice(r.countRow.id)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') e.currentTarget.blur()
                                      else if (e.key === 'Escape') {
                                        setWbPriceDrafts((prev) => {
                                          const next = { ...prev }
                                          delete next[r.countRow.id]
                                          return next
                                        })
                                      }
                                    }}
                                    disabled={savingUnitPriceOverride === r.countRow.id}
                                    style={{
                                      ...wbCellStyle('6rem'),
                                      // A struck-through saved price under an active proposal — it changes only on Apply.
                                      ...(r.isPreview && !r.isVetoed ? { color: 'var(--text-muted)', textDecoration: 'line-through' } : {}),
                                    }}
                                    aria-label={`Sale price per unit for ${r.countRow.fixture ?? 'row'}`}
                                  />
                                  {savingUnitPriceOverride === r.countRow.id ? (
                                    <span style={{ marginLeft: '0.3rem', fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>saving…</span>
                                  ) : wbJustSaved[r.countRow.id] ? (
                                    <span style={{ marginLeft: '0.3rem', fontSize: '0.68rem', color: 'var(--text-green-700)', fontWeight: 700 }}>saved ✓</span>
                                  ) : null}
                                </td>
                                <td style={{ padding: '0.35rem 0.7rem', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>{wbCellInput(r, 'revenue', '6.5rem')}</td>
                                <td style={{ padding: '0.35rem 0.7rem', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
                                  {r.cost > 0 ? wbCellInput(r, 'profit', '6rem') : <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>—</span>}
                                </td>
                                <td style={{ padding: '0.35rem 0.7rem', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
                                  {r.cost > 0 ? (
                                    wbCellInput(r, 'margin', '3.8rem', { fontWeight: 700, color: mColor(r.displayMargin) })
                                  ) : (
                                    <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>
                                      {r.displayUnit != null ? 'no cost' : '—'}
                                    </span>
                                  )}
                                </td>
                                {/* v2.2401: the Apply-margin column retired — the margin brush (strip, left
                                    of Solver ›) is the per-row/per-sweep way to price at a margin here. */}
                                <td style={{ padding: '0.35rem 0.5rem 0.35rem 0.2rem', borderBottom: '1px solid var(--border)' }}>
                                  <button
                                    type="button"
                                    onClick={() => openRowBreakdown(r)}
                                    title="Revenue, cost & margin breakdown"
                                    aria-label={`Margin breakdown for ${r.countRow.fixture ?? 'row'}`}
                                    style={{ font: 'inherit', fontSize: '0.85rem', border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', padding: '0.05rem 0.3rem', lineHeight: 1 }}
                                  >
                                    ⓘ
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    <PricingProfitBar
                      bar={profitBar}
                      conc={conc}
                      rows={eff.map((r) => ({
                        id: r.countRow.id,
                        count: r.count,
                        cost: r.cost,
                        effUnit: r.effUnit,
                        effRevenue: r.effRevenue,
                        effMargin: r.effMargin,
                        bookEntryName: r.entry ? (r.entry.fixture_types?.name ?? 'book entry') : null,
                      }))}
                      concColors={concColors}
                      marginColor={mColor}
                      onJumpToRow={jumpToWorksheetRow}
                    />

                    {/* v2.3239: what the bid is made of — fixtures · pipe · fittings · other, the strip's
                        own colors. v2.3458: sits under "Where the profit lives" (it was one level above). */}
                    <PricingCompositionBar
                      rows={eff.map((r) => ({ id: r.countRow.id, name: r.countRow.fixture ?? '', count: r.count, cost: r.cost, revenue: r.effRevenue }))}
                      marginColor={mColor}
                      onJumpToRow={jumpToWorksheetRow}
                    />
                  </>
                )
              })()
            }
          </div>
        )}
        {pricingBreakdownRow && (
          <PricingMarginBreakdownModal
            row={pricingBreakdownRow}
            onClose={() => setPricingBreakdownRow(null)}
            onJumpToTab={
              selectedBidForPricing
                ? (tab, ref) => {
                    if (onNavigateBidToTabRow) onNavigateBidToTabRow(selectedBidForPricing, tab, ref)
                    else onNavigateBidToTab(selectedBidForPricing, tab)
                  }
                : undefined
            }
          />
        )}
        {!selectedBidForPricing && (
          <BidPickerStandardList
            bids={filteredBidsForPricing}
            searching={pricingSearchQuery.trim() !== ''}
            prefixMap={ledgerPrefixMap}
            onSelectBid={onSelectBid}
            emptyMessage={pricingSearchQuery.trim() ? 'No bids match your search.' : null}
          />
        )}
        {wbBookDrawerOpen ? (
          <BidsPriceBookDrawer
            books={{
              templates: templatePriceBookVersions,
              bidPricings: priceBookVersions,
              selectedPricingVersionId,
              browsedTemplateId: editingTemplateId,
              currentTemplateId: currentPriceBookTemplateId,
              defaultTemplateId: defaultPriceBookTemplateId,
              expanded: wbBooksExpanded,
              onExpandedChange: setWbBooksExpanded,
              switchBusy: pricebookSwitchBusy,
              onBrowse: selectPanelVersion,
              onUseOnBid: onSelectPriceBookTemplate,
            }}
            entries={{
              rows: templateEntries,
              search: priceBookSearchQuery,
              onSearchChange: setPriceBookSearchQuery,
              displayMode: wbPriceDisplayMode,
              onDisplayModeChange: setWbPriceDisplayMode,
            }}
            offer={{
              pending: pendingBookOffer,
              applying: applyingBookOffer,
              onApply: applyPendingBookOffer,
              onDismiss: () => setPendingBookOffer(null),
            }}
            doors={{
              onAddBook: openAddTemplate,
              onEditBook: openEditPricingVersion,
              onAddEntry: openNewPricingEntry,
              onEditEntry: openEditPricingEntry,
              onClose: () => setWbBookDrawerOpen(false),
            }}
          />
        ) : null}
        {pricingVersionFormOpen && (
          <PricingVersionFormModal
            editing={editingPricingVersion}
            formMode={pricingFormMode}
            nameInput={pricingVersionNameInput}
            onNameChange={setPricingVersionNameInput}
            saving={savingPricingVersion}
            onSubmit={savePricingVersion}
            onClose={closePricingVersionForm}
            onDelete={openDeletePricingVersionModal}
          />
        )}
        {pricingEdit && (() => {
          // The card row can show ANOTHER packet's ★ (unscoped legacy-pointer fallback),
          // so the guard asks whether any packet stars this scenario — not just the viewed one.
          const starringVersion = versionStarringScenario(bidVersions, pricingEdit.id)
          const isBase = starringVersion != null || pricingEdit.id === customerFacingPricingId
          const baseMsg = starringVersion && starringVersion.id !== selectedBidVersionId
            ? `${gcNameForVersion(starringVersion.id)}'s letter is built on this price — star another price for that packet first.`
            : "The GC's letter is built on this price — make another price the base first."
          const close = () => setPricingEdit(null)
          return (
            <div role="presentation" onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 750, paddingTop: 'var(--app-top-chrome, 0px)' }}>
              <div role="dialog" aria-label="Price" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); close() } }} style={{ background: 'var(--surface)', borderRadius: 8, padding: '1.25rem 1.4rem', minWidth: 360, maxWidth: '90vw', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                <h3 style={{ margin: '0 0 1rem' }}>Price</h3>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.875rem' }} htmlFor="pricing-edit-name">Name</label>
                <input
                  id="pricing-edit-name"
                  autoFocus
                  value={pricingEdit.name}
                  onChange={(e) => setPricingEdit({ id: pricingEdit.id, name: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void savePricingEdit() } }}
                  style={{ width: '100%', padding: '0.5rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, font: 'inherit', background: 'var(--surface)', color: 'var(--text-strong)', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.1rem' }}>
                  <button
                    type="button"
                    disabled={isBase}
                    title={isBase ? baseMsg : 'Delete this price'}
                    onClick={() => {
                      const target = priceBookVersions.find((pv) => pv.id === pricingEdit.id)
                      close()
                      if (target) { setPricingVersionToDelete(target); setDeletePricingVersionModalOpen(true) }
                    }}
                    style={{ font: 'inherit', fontSize: '0.9rem', padding: '0.45rem 0.9rem', borderRadius: 6, border: '1px solid var(--border-red)', background: 'var(--surface)', color: isBase ? 'var(--text-faint)' : 'var(--text-red-700)', cursor: isBase ? 'not-allowed' : 'pointer' }}
                  >
                    Delete
                  </button>
                  <span style={{ flex: 1 }} />
                  <button type="button" onClick={close} style={{ font: 'inherit', fontSize: '0.9rem', padding: '0.45rem 0.9rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--bg-muted)', color: 'var(--text-strong)', cursor: 'pointer' }}>Cancel</button>
                  <button type="button" onClick={() => void savePricingEdit()} style={{ font: 'inherit', fontSize: '0.9rem', padding: '0.45rem 1.1rem', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer' }}>Save</button>
                </div>
              </div>
            </div>
          )
        })()}
        {deletePricingVersionModalOpen && pricingVersionToDelete && (
          <DeletePricingVersionModal
            version={pricingVersionToDelete}
            nameInput={deletePricingVersionNameInput}
            onNameChange={(value) => {
              setDeletePricingVersionNameInput(value)
              if (deletePricingVersionError) setDeletePricingVersionError(null)
            }}
            error={deletePricingVersionError}
            onConfirm={confirmDeletePricingVersion}
            onClose={() => {
              setDeletePricingVersionModalOpen(false)
              setPricingVersionToDelete(null)
              setDeletePricingVersionNameInput('')
              setDeletePricingVersionError(null)
            }}
          />
        )}
        {pricingEntryFormOpen && panelVersionId && (
          <PricingEntryFormModal
            editing={editingPricingEntry}
            error={error}
            fixtureName={pricingEntryFixtureName}
            onFixtureNameChange={setPricingEntryFixtureName}
            fixtureTypes={fixtureTypes}
            priceMode={wbPriceDisplayMode}
            combinedPrice={pricingEntryCombinedPrice}
            onCombinedPriceChange={setPricingEntryCombinedPrice}
            roughIn={pricingEntryRoughIn}
            onRoughInChange={setPricingEntryRoughIn}
            topOut={pricingEntryTopOut}
            onTopOutChange={setPricingEntryTopOut}
            trimSet={pricingEntryTrimSet}
            onTrimSetChange={setPricingEntryTrimSet}
            total={pricingEntryTotal}
            saving={savingPricingEntry}
            onSubmit={savePricingEntry}
            onClose={closePricingEntryForm}
            onDelete={deletePricingEntry}
          />
        )}
      </div>

      {addPriceOpen && selectedBidForPricing ? (() => {
        const gc = gcNameForVersion(selectedBidVersionId)
        const mine = priceBookVersions.filter((p) => (selectedBidVersionId ? p.bid_version_id === selectedBidVersionId : p.bid_version_id == null))
        const defaultName = `Alternate ${Math.max(1, mine.length)}`
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, paddingTop: 'var(--app-top-chrome, 0px)' }} onClick={() => !wbCloning && setAddPriceOpen(null)}>
            <div role="dialog" aria-label={`Another price for ${gc}`} style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '1rem 1.1rem', maxWidth: 460, width: '92%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ margin: '0 0 0.2rem', fontSize: '1.02rem' }}>Another price for {gc}</h3>
              <p style={{ margin: '0 0 0.7rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Same counts, same takeoff — a second price this GC can pick. Different materials? use “+ version” in the picker instead.</p>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>Name this price option</label>
              <input type="text" autoFocus value={addPriceOpen.name} onChange={(e) => setAddPriceOpen((st) => st && { ...st, name: e.target.value })} placeholder={defaultName} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void createPriceOption(addPriceOpen.name.trim() || defaultName, addPriceOpen.fromId, addPriceOpen.offer) } }} style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--bg-subtle)', color: 'var(--text-strong)', font: 'inherit', boxSizing: 'border-box' }} />
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, margin: '0.6rem 0 0.2rem' }}>Start from</label>
              <select value={addPriceOpen.fromId ?? ''} onChange={(e) => setAddPriceOpen((st) => st && { ...st, fromId: e.target.value || null })} style={{ width: '100%', padding: '0.4rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--bg-subtle)', color: 'var(--text-strong)', font: 'inherit' }}>
                {mine.map((p) => <option key={p.id} value={p.id}>{p.name}{p.id === customerFacingPricingId ? ' · ★ base' : ''}</option>)}
              </select>
              <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.82rem', marginTop: '0.6rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={addPriceOpen.offer} onChange={(e) => setAddPriceOpen((st) => st && { ...st, offer: e.target.checked })} /> Offer it to {shortGc(gc)} as an alternate right away
              </label>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', marginTop: '0.8rem' }}>
                <button type="button" onClick={() => setAddPriceOpen(null)} disabled={wbCloning} style={{ font: 'inherit', fontSize: '0.85rem', padding: '0.4rem 0.8rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--bg-muted)', color: 'var(--text-strong)', cursor: 'pointer' }}>Cancel</button>
                <button type="button" onClick={() => void createPriceOption(addPriceOpen.name.trim() || defaultName, addPriceOpen.fromId, addPriceOpen.offer)} disabled={wbCloning || mine.length === 0} style={{ font: 'inherit', fontSize: '0.85rem', padding: '0.4rem 0.9rem', border: 'none', borderRadius: 6, background: '#3b82f6', color: '#fff', cursor: wbCloning ? 'wait' : 'pointer' }}>{wbCloning ? 'Creating…' : 'Create'}</button>
              </div>
            </div>
          </div>
        )
      })() : null}
      {adoptOpen && selectedBidForPricing ? (
        <AdoptBidModal
          targetBid={selectedBidForPricing}
          onClose={() => setAdoptOpen(false)}
          onAdopted={async () => {
            setAdoptOpen(false)
            window.dispatchEvent(new Event('bid-version-picker-reload'))
            await loadBids()
          }}
        />
      ) : null}
      {starChooser && selectedBidForPricing ? (
        <PricingStarChooserDialog
          action={starChooser}
          choice={starChoice}
          busy={starBusy}
          starName={pricingNameOf(priceBookVersions, customerFacingPricingId)}
          viewedName={pricingNameOf(priceBookVersions, selectedPricingVersionId)}
          onChoose={setStarChoice}
          onCancel={() => setStarChooser(null)}
          onConfirm={() => void runStarAwareAction(starChooser, starChoice)}
        />
      ) : null}

      <PricingQuoteModals
        desk={quoteDesk}
        selectedBidForPricing={selectedBidForPricing}
        ledgerPrefixMap={ledgerPrefixMap}
        pricingCountRows={pricingCountRows}
        selectedPricingVersionId={selectedPricingVersionId}
        canPackageAndSendBidPricing={canPackageAndSendBidPricing}
        takeoffMaterialsByCountRowId={pricingFixtureMaterialsFromTakeoff}
        taxPercent={parseFloat(costEstimatePOModalTaxPercent || '8.25') || 0}
        currentTotals={
          selectedBidForPricing
            ? (() => {
                const d = derivePricingWorkbench()
                return d ? { totalRevenue: d.totalRevenue, totalCost: d.totalCost } : null
              })()
            : null
        }
        onCostsApplied={() => {
          void reloadBidCustomCosts()
        }}
      />

      {packageSendOpen && selectedBidForPricing && selectedPricingVersionId && pricingPackageSource ? (
        <PackageAndSendBidPricingModal
          open={packageSendOpen}
          onClose={() => { setPackageSendOpen(false); setShareOverride(null) }}
          bid={selectedBidForPricing}
          priceBookVersionId={shareOverride?.pricingId ?? selectedPricingVersionId}
          priceBookVersionName={
            shareOverride?.name ?? priceBookVersions.find((v) => v.id === selectedPricingVersionId)?.name ?? '—'
          }
          pricingRows={shareOverride?.rows ?? pricingPackageSource.rows}
          totalRevenue={shareOverride?.totalRevenue ?? pricingPackageSource.totalRevenue}
          alsoPrice={shareOverride?.also ? { priceBookVersionId: shareOverride.also.pricingId, name: shareOverride.also.name, rows: shareOverride.also.rows, totalRevenue: shareOverride.also.totalRevenue } : null}
          estimatorUsers={estimatorUsers}
          prefixMap={ledgerPrefixMap}
          currentUserName={profileName ?? null}
          onRequestEditBid={() => {
            setPackageSendOpen(false)
            onEditBid(selectedBidForPricing)
          }}
        />
      ) : null}
    </>
  )
}
