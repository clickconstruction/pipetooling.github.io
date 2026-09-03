import { Link } from 'react-router-dom'
import { useEffect, useRef, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/format'
import { formatRevenueMultiple, marginFlag } from '../../lib/bids/bidFormatting'
import { profitConcentration, solveWorkbenchPrices } from '../../lib/bids/pricingWorkbenchSolver'
import { buildProfitLegend, clampTooltipLeft, formatProfitShare } from '../../lib/bids/profitBarLegend'
import { matchCountRowsToBookEntries, type BookEntryMatch } from '../../lib/bids/bookEntryMatching'
import { mapCountRowsByFixture } from '../../lib/bids/mapCountRowsByFixture'
import { searchPriceBookEntries, seedPricingAssignmentSearch, type AssignMatchMode, type PriceBookSearchResult } from '../../lib/bids/priceBookAssignSearch'
import { computeBidPricingRows, coverLetterTotalsFromPricingRows } from '../../lib/bidPricingRowCalculations'
import { SpotlightTour, spotlightTourStepsPresent, type SpotlightTourStep } from '../SpotlightTour'
import { submissionHiddenIdsForVersion } from '../../lib/bids/submissionHides'
import { readPreviewStash, writePreviewStash } from '../../lib/bids/workbenchPreviewStash'
import { cellEditSeed, impliedUnitPrice, type WorkbenchCellField } from '../../lib/bids/workbenchCellSolve'
import type { BidPricingHistoryRow } from '../../types/database-functions'
import { countTabsMatchedOrBeaten, marginPctToMatchTabLow } from '../../lib/bidTabCapture'
import { bidDetailCloseXStyle, bidDetailCloseFloatMobileStyle } from '../../lib/bids/bidStyles'
import { normalizeMaterialsModel, sumRoughLinesPreTaxWithCount, type MaterialsModel } from '../../lib/bids/bidTakeoffHelpers'
import { alternateCardNumbers, sameGcAlternateVersions } from '../../lib/bids/ownTakeoffAlternates'
import { laborRowHours } from '../../lib/bids/laborRowHours'
import { nextSortOrder, pickActivePricing } from '../../lib/bids/pickActivePricing'
import { versionStarringScenario } from '../../lib/bids/starredScenarioGuard'
import {
  loadRecentMargins,
  normalizeMarginTarget,
  saveRecentMargins,
  unitPriceForTargetMargin,
  updateRecentMargins,
} from '../../lib/bids/applyMarginPricing'
import { resolveCurrentPriceBookTemplateId, resolvePriceBookTemplateRoot } from '../../lib/bids/resolveCurrentPriceBookTemplateId'
import { planBookEditBidOffer, planSiblingCarry, type BookEditBidOffer, type BookEntryPrices } from '../../lib/bids/bookEditBidOffer'
import {
  computeTravelCost,
  costEstimateDrivingRate,
  costEstimateHoursPerTrip,
  costEstimateEstimatorCost,
  sumEquipmentRows,
} from '../../lib/bids/bidCostCalc'
import { BidWorkflowTabTitleWithPreview } from './BidWorkflowTabTitleWithPreview'
import { GenerateUnitCostModal } from './GenerateUnitCostModal'
import { AssignTakeoffPartModal } from './AssignTakeoffPartModal'
import { BidPickerStandardList } from './BidPickerStandardList'
import { bidNumberMatchesQuery } from '../../lib/ledgerDisplayPrefixes'
import { MyBidsToggle } from './MyBidsToggle'
import { BidPickerSortToggle } from './BidPickerSortToggle'
import { PackageAndSendBidPricingModal, type PackageAndSendPricingRowInput } from './PackageAndSendBidPricingModal'
import { bidPackageLabel } from '../../lib/bidPackageLabel'
import { SpecSectionAuditModal } from './SpecSectionAuditModal'
import { PrepareFixtureCopyModal } from './PrepareFixtureCopyModal'
import { PlugInQuotesModal } from './PlugInQuotesModal'
import { QuoteCompareModal } from './QuoteCompareModal'
import { RfqDeskModal } from './RfqDeskModal'
import { RfqComposeModal } from './RfqComposeModal'
import { deriveRfqChip, type DeskRfq } from '../../lib/rfq/rfqDesk'
import { AdoptBidModal } from './AdoptBidModal'
import { PricingShareMenu } from './PricingShareMenu'
import {
  printPricingPage as printPricingPageDoc,
  printAllPricingPages as printAllPricingPagesDoc,
  buildPricingCsvForBid,
  type PricingPrintContext,
} from '../../lib/bidDocuments/pricingPage'
import type { ComputeBidPricingRowsResult } from '../../lib/bidPricingRowCalculations'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import type { useBidPreview } from '../../contexts/BidPreviewModalContext'
import type { LedgerPrefixMap } from '../../lib/ledgerDisplayPrefixes'
import type { BidWithBuilder, EstimatorUser } from '../../types/bidWithBuilder'
import type { BidCountRow } from '../../types/bids'
import type { TeamLaborBidRow } from '../../utils/teamLabor'
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
  saveBidSelectedPriceBookVersion: (bidId: string, versionId: string | null) => Promise<void>
  openMaterialsModelSwitch: (next: MaterialsModel, sourceTab: 'takeoffs' | 'labor' | 'pricing') => void
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
type PricingBreakdownRow = {
  /** The count row behind this line — the jump chips' landing key (v2.2400). */
  countRowId: string
  fixture: string
  count: number
  unitPrice: number
  isFixedPrice: boolean
  revenue: number
  materialsBeforeTax: number
  taxAmount: number
  taxPercent: number
  laborCost: number
  cost: number
  margin: number | null
  materialsFromTakeoff: number | null
}

export function BidsPricingTab({
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
  const templatesMode = true
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
  const [addPricingMenuOpen, setAddPricingMenuOpen] = useState(false)
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
  const [assignTakeoffRow, setAssignTakeoffRow] = useState<{ countRowId: string; fixture: string } | null>(null)
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
  /** Last target-total solve: what was asked vs where it landed (cleared on input edit). */
  const [, setWbTargetSolveResult] = useState<{ target: number; landed: number } | null>(null)
  /** Last margin solve, for the landing chip under the strip: the slider pct and how
      many rows it priced. Where the bid lands (revenue/blended) reads live from the
      preview totals; cleared whenever the preview clears or a row is hand-edited. */
  const [wbSolveLanding, setWbSolveLanding] = useState<{ pct: number; rows: number } | null>(null)
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
  // ---- Margin brush (v2.2401, Wendi): pick up the brush, sweep across rows, each one
  // prices at the chosen margin the instant the brush crosses it. Sweeps paint into
  // wbPriceDrafts (live totals for free) and commit in one batch on pointer-up via the
  // same per-row write typed prices use. Held 📌 / fixed-price / no-cost rows are skipped.
  const [brushArmed, setBrushArmed] = useState(false)
  const [brushMarginInput, setBrushMarginInput] = useState('50')
  const [brushCommitting, setBrushCommitting] = useState(false)
  const [brushStrokeCount, setBrushStrokeCount] = useState(0)
  /** Last committed sweep: [rowId, previous saved price (null = was unpriced)] — one-level undo. */
  const [brushUndo, setBrushUndo] = useState<Array<[string, number | null]> | null>(null)
  const brushStrokeRef = useRef<Map<string, { prev: number | null; next: number }> | null>(null)
  const brushPaintingRef = useRef(false)
  const brushMarginVal = () => normalizeMarginTarget(brushMarginInput)
  function armBrush() {
    setBrushMarginInput(String(recentMargins[0] ?? 50))
    setBrushArmed(true)
    // One tool at a time: picking up the brush folds the solver ring away.
    if (wbSolverOpen) setAndRememberWbSolverOpen(false)
  }
  function cancelBrushStroke() {
    const stroke = brushStrokeRef.current
    brushStrokeRef.current = null
    brushPaintingRef.current = false
    setBrushStrokeCount(0)
    if (stroke && stroke.size > 0) {
      setWbPriceDrafts((prev) => {
        const next = { ...prev }
        for (const rowId of stroke.keys()) delete next[rowId]
        return next
      })
    }
  }
  function disarmBrush() {
    cancelBrushStroke()
    setBrushArmed(false)
    setBrushUndo(null)
  }
  /** One brush touch on one row — draft the margin price; skips carry no side effects. */
  function brushPaintAt(
    clientX: number,
    clientY: number,
    rowsForBrush: Array<{ countRow: { id: string }; cost: number; count: number; unitPrice: number | null; isFixedPrice: boolean }>,
    m: number,
  ) {
    const stroke = brushStrokeRef.current
    if (!stroke) return
    const el = document.elementFromPoint(clientX, clientY)
    const tr = el && 'closest' in el ? (el as Element).closest('tr[id^="wb-row-"]') : null
    if (!tr) return
    const rowId = tr.id.slice('wb-row-'.length)
    const row = rowsForBrush.find((r) => r.countRow.id === rowId)
    if (!row) return
    if (!(row.cost > 0) || row.isFixedPrice || wbLocks.has(rowId)) return
    const price = unitPriceForTargetMargin(row.cost, row.count, m)
    if (price == null) return
    if (!stroke.has(rowId)) {
      stroke.set(rowId, { prev: row.unitPrice != null && row.unitPrice > 0 ? row.unitPrice : null, next: price })
      setBrushStrokeCount([...stroke.values()].filter((v) => v.prev !== v.next).length)
      setWbPriceDrafts((prev) => (prev[rowId] === String(price) ? prev : { ...prev, [rowId]: String(price) }))
      setWbSolveLanding(null)
    }
  }
  /** Pointer-up: write every changed row through the typed-price save, then reload once. */
  async function endBrushStroke() {
    if (!brushPaintingRef.current) return
    brushPaintingRef.current = false
    const stroke = brushStrokeRef.current
    brushStrokeRef.current = null
    const clearStrokeDrafts = () => {
      if (!stroke || stroke.size === 0) return
      setWbPriceDrafts((prev) => {
        const next = { ...prev }
        for (const rowId of stroke.keys()) delete next[rowId]
        return next
      })
    }
    setBrushStrokeCount(0)
    if (!stroke || stroke.size === 0) return
    const changed = [...stroke.entries()].filter(([, v]) => v.prev !== v.next)
    const bidId = selectedBidForPricing?.id
    const versionId = selectedPricingVersionId
    if (changed.length === 0 || !bidId || !versionId) {
      clearStrokeDrafts()
      return
    }
    const m = brushMarginVal()
    setBrushCommitting(true)
    try {
      for (const [rowId, v] of changed) {
        const err = await writeUnitPriceOverrideRow(rowId, v.next)
        if (err) {
          setError(err.message)
          break
        }
      }
      // Painted prices are saved prices now — drop them from any pending solver preview.
      if (wbPreview) {
        const nextPreview = { ...wbPreview }
        const nextVeto = new Set(wbPreviewVeto)
        let touched = false
        for (const [rowId] of changed) {
          if (rowId in nextPreview) {
            delete nextPreview[rowId]
            nextVeto.delete(rowId)
            touched = true
          }
        }
        if (touched) setAndStashWbPreview(versionId, Object.keys(nextPreview).length > 0 ? nextPreview : null, nextVeto)
      }
      await loadBidPricingAssignments(bidId, versionId)
      if (m != null) {
        const nextRec = updateRecentMargins(recentMargins, m)
        setRecentMargins(nextRec)
        saveRecentMargins(window.localStorage, nextRec)
      }
      setBrushUndo(changed.map(([rowId, v]) => [rowId, v.prev]))
      showToast(`Swept ${changed.length} row${changed.length === 1 ? '' : 's'} at ${m}% — sweep again, or Esc puts the brush down.`, 'success')
    } finally {
      clearStrokeDrafts()
      setBrushCommitting(false)
    }
  }
  async function undoBrushSweep() {
    const undo = brushUndo
    if (!undo || brushCommitting) return
    const bidId = selectedBidForPricing?.id
    const versionId = selectedPricingVersionId
    if (!bidId || !versionId) return
    setBrushCommitting(true)
    try {
      for (const [rowId, prev] of undo) {
        const err = await writeUnitPriceOverrideRow(rowId, prev)
        if (err) {
          setError(err.message)
          break
        }
      }
      await loadBidPricingAssignments(bidId, versionId)
      setBrushUndo(null)
      showToast('Sweep undone.', 'success')
    } finally {
      setBrushCommitting(false)
    }
  }
  useEffect(() => {
    if (!brushArmed) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelBrushStroke()
        disarmBrush()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brushArmed])
  // "Where the profit lives" bar (v2.2353): hovered slice + tooltip position,
  // click-pinned detail card (keyed by count-row id so re-solves keep it), the
  // collapsible legend, and the jump-to-row flash.
  const [wbBarHover, setWbBarHover] = useState<number | null>(null)
  const [wbBarTipLeft, setWbBarTipLeft] = useState(0)
  const [wbBarPinnedId, setWbBarPinnedId] = useState<string | null>(null)
  const [wbLegendCollapsed, setWbLegendCollapsed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('wbProfitLegendCollapsed_v1') === '1'
    } catch {
      return false
    }
  })
  const [wbFlashRowId, setWbFlashRowId] = useState<string | null>(null)
  const [wbCopyingPrices, setWbCopyingPrices] = useState(false)
  const [wbFillingBook, setWbFillingBook] = useState(false)
  /** The spotlight walkthrough (v2.2021): null = closed, else the steps whose anchors exist. */
  const [wbTourSteps, setWbTourSteps] = useState<SpotlightTourStep[] | null>(null)
  // Iteration 2 — scenarios: revenue per bid-owned Pricing (the cover-letter
  // bundle computation, one per scenario card). Keyed by pricing version id.
  const [wbScenarioRevenue, setWbScenarioRevenue] = useState<Record<string, number>>({})
  // Iteration 3 — win/loss calibration history (null = loading/unavailable).
  const [wbHistory, setWbHistory] = useState<BidPricingHistoryRow[] | null>(null)
  const [wbCloning, setWbCloning] = useState(false)
  /** The "＋ New price or version…" door (v2.2104, renamed v2.2110): one button asking "price point or sendable bid?" */
  const [wbVariantDoorOpen, setWbVariantDoorOpen] = useState(false)
  // Disables the toolbar price-book dropdown while a clone/switch is in flight (avoids double-submit).
  const [pricebookSwitchBusy, setPricebookSwitchBusy] = useState(false)
  const [generateUnitCostModalParams, setGenerateUnitCostModalParams] = useState<{
    countRowId: string
    totalRevenue: number
    currentRowRevenue: number
    currentPctOfTotal: number | null
    count: number
    isFixedPrice: boolean
    fixtureLabel: string
  } | null>(null)
  const [savingUnitPriceOverride, setSavingUnitPriceOverride] = useState<string | null>(null)
  // Package and send (Pricing tab → "Package and send" modal — left of CSV)
  const [packageSendOpen, setPackageSendOpen] = useState(false)
  const [d22AuditOpen, setD22AuditOpen] = useState(false)
  const [prepareCopyOpen, setPrepareCopyOpen] = useState(false)
  // RFQ Phase 1 (v2.2630, docs/SUPPLY_HOUSE_RFQ_PLAN.md): plug in supply house
  // replies and compare them. Cost-side data — the same roles that can Share.
  const [plugInQuoteOpen, setPlugInQuoteOpen] = useState(false)
  const [quotesCompareOpen, setQuotesCompareOpen] = useState(false)
  const [quoteCount, setQuoteCount] = useState(0)
  const [quoteNonce, setQuoteNonce] = useState(0)
  // Lane B (v2.2636): the header chip is derived from the bid's requests +
  // their email delivery state (deriveRfqChip — none / quotes-only / waiting /
  // bounced / all-in). The desk and compose modals hang off it.
  const [deskRfqs, setDeskRfqs] = useState<DeskRfq[]>([])
  const [rfqDeskOpen, setRfqDeskOpen] = useState(false)
  const [composeScope, setComposeScope] = useState<{ lines: Array<{ fixture: string; count: number; unit?: string | null }>; text: string } | null>(null)
  useEffect(() => {
    const bidId = selectedBidForPricing?.id
    if (!bidId || !canPackageAndSendBidPricing) {
      setQuoteCount(0)
      setDeskRfqs([])
      return
    }
    let cancelled = false
    void (async () => {
      const [{ count, error }, { data: rfqs, error: rErr }] = await Promise.all([
        supabase.from('bid_quotes').select('id', { count: 'exact', head: true }).eq('bid_id', bidId),
        supabase
          .from('bid_rfqs')
          .select('id, status, supply_house_id, sent_to, sent_email, resend_email_id, created_at, viewed_at, last_reminded_at, reminder_count, needed_by')
          .eq('bid_id', bidId)
          .neq('status', 'draft'),
      ])
      if (cancelled) return
      if (!error) setQuoteCount(count ?? 0)
      if (!rErr) {
        const resendIds = (rfqs ?? []).map((r) => r.resend_email_id).filter((x): x is string => !!x)
        const eventById = new Map<string, string>()
        if (resendIds.length > 0) {
          const { data: logs } = await supabase.from('email_send_log').select('resend_email_id, last_event').in('resend_email_id', resendIds)
          for (const l of logs ?? []) if (l.resend_email_id && l.last_event) eventById.set(l.resend_email_id, l.last_event)
        }
        if (cancelled) return
        setOpenRfqHouseIds(new Set((rfqs ?? []).filter((r) => r.status === 'sent' && r.supply_house_id).map((r) => r.supply_house_id as string)))
        setDeskRfqs(
          (rfqs ?? []).map((r) => ({
            id: r.id,
            houseName: r.sent_to,
            sentEmail: r.sent_email,
            status: (r.status ?? 'sent') as DeskRfq['status'],
            createdAt: r.created_at,
            viewedAt: r.viewed_at,
            lastRemindedAt: r.last_reminded_at,
            reminderCount: r.reminder_count ?? 0,
            neededBy: r.needed_by,
            emailLastEvent: r.resend_email_id ? (eventById.get(r.resend_email_id) ?? null) : null,
            scopeLines: [],
          })),
        )
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedBidForPricing?.id, canPackageAndSendBidPricing, quoteNonce])
  const [openRfqHouseIds, setOpenRfqHouseIds] = useState<Set<string>>(new Set())
  const rfqChip = deriveRfqChip(deskRfqs, quoteCount)

  // Deep link from the dashboard's Division 22 Needs You item (v2.2627):
  // /bids?tab=pricing&d22audit=1 opens the audit, then strips the param so a
  // reload or back-nav doesn't reopen it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('d22audit') !== '1') return
    if (canPackageAndSendBidPricing) setD22AuditOpen(true)
    params.delete('d22audit')
    const qs = params.toString()
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount; the param is a one-shot door
  }, [])
  // F2 (v2.2120): Share / Print / CSV honor the ★. When the scenario you're viewing isn't the
  // customer's, a chooser asks which price to use; picking ★ loads that scenario's prices on
  // the fly (no view switch), so "the ★ is what the customer sees — Cover Letter, Share, Print,
  // and the bid value all use it" is finally true end to end.
  const [starChooser, setStarChooser] = useState<'share' | 'print' | 'csv' | null>(null)
  // F6b (v2.2133): "Adopt an existing bid" — fold a board bid into this package as a version.
  const [adoptOpen, setAdoptOpen] = useState(false)
  // G1 (v2.2154): price options per GC — GC names for the structure bar, the "Another price" modal,
  // and the offered-as-alternate toggle (price_book_versions.include_in_submission, scoped per version).
  const [gcNamesById, setGcNamesById] = useState<Record<string, string>>({})
  const [addPriceOpen, setAddPriceOpen] = useState<{ name: string; fromId: string | null; offer: boolean } | null>(null)
  const [copyingGcPrice, setCopyingGcPrice] = useState(false)
  useEffect(() => {
    const ids = [...new Set(bidVersions.map((v) => v.customer_id).filter((id): id is string => !!id))].filter((id) => gcNamesById[id] === undefined)
    if (ids.length === 0) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase.from('customers').select('id, name').in('id', ids)
      if (cancelled || !data) return
      setGcNamesById((prev) => { const next = { ...prev }; for (const c of data) next[c.id] = c.name ?? '—'; return next })
    })()
    return () => { cancelled = true }
  }, [bidVersions, gcNamesById])
  /** The GC a version's letter goes to: its own override, else the bid's GC. */
  function gcNameForVersion(versionId: string | null): string {
    const v = versionId ? bidVersions.find((x) => x.id === versionId) : undefined
    if (v?.customer_id) return gcNamesById[v.customer_id] ?? '…'
    const b = selectedBidForPricing as (BidWithBuilder & { customers?: { name?: string | null } | null; bids_gc_builders?: { name?: string | null } | null }) | null
    return b?.customers?.name ?? b?.bids_gc_builders?.name ?? 'the GC'
  }
  const shortGc = (name: string) => name
  const [starChoice, setStarChoice] = useState<'star' | 'viewed'>('star')
  const [starBusy, setStarBusy] = useState(false)
  /** Unpriced solo bids hide the status band; the ＋ Add price door re-homes to the solver line (artifact 0a627c7c). */
  const wbSolverEnd: { node: React.ReactNode } = { node: null }
  wbSolverEnd.node = null

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

  /** v2.2203: the Workbench structure bar lives behind the (i) beside the bid name. */
  const [wbInfoOpen, setWbInfoOpen] = useState(false)
  const [shareOverride, setShareOverride] = useState<{ pricingId: string; name: string; rows: PackageAndSendPricingRowInput[]; totalRevenue: number } | null>(null)

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
      if (addPricingMenuOpen && !target.closest('[data-add-pricing-menu]')) {
        setAddPricingMenuOpen(false)
      }
      if (wbBarPinnedId && !target.closest('[data-profit-bar]')) {
        setWbBarPinnedId(null)
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && wbBarPinnedId) setWbBarPinnedId(null)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [pricingAssignmentDropdownOpen, addPricingMenuOpen, wbBarPinnedId])

  // --- Bid Pricings vs Templates panel ---
  // The Price Book panel can show either the bid's Pricings or the shared template catalog.
  // `panel*` resolve to whichever the "Templates" toggle is on. Template editing uses its own
  // `editingTemplateId` / `templateEntries` so it never disturbs the bid's active Pricing
  // (`selectedPricingVersionId` / `priceBookEntries`), which still drives the grid + cover letter.
  const panelVersionId = templatesMode ? editingTemplateId : selectedPricingVersionId
  const panelEntries = templatesMode ? templateEntries : priceBookEntries
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
    if (templatesMode) await loadTemplateEntries(editingTemplateId)
    else await loadPriceBookEntries(selectedPricingVersionId)
  }

  async function reloadPanelVersions() {
    if (templatesMode) await loadTemplatePriceBookVersions()
    else if (selectedBidForPricing) await loadBidPricings(selectedBidForPricing.id)
  }

  // Entering Templates mode (or template list changing): default to the first template and load its entries.
  useEffect(() => {
    if (!templatesMode) return
    if (editingTemplateId && templatePriceBookVersions.some((t) => t.id === editingTemplateId)) {
      void loadTemplateEntries(editingTemplateId)
      return
    }
    const first = templatePriceBookVersions[0] ?? null
    setEditingTemplateId(first?.id ?? null)
    void loadTemplateEntries(first?.id ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templatesMode, templatePriceBookVersions])

  function selectPanelVersion(id: string) {
    if (templatesMode) {
      setEditingTemplateId(id)
      void loadTemplateEntries(id)
    } else if (selectedBidForPricing) {
      void handlePricingVersionChange(selectedBidForPricing.id, id)
    }
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
    const versionId = selectedPricingVersionId
    if (!versionId) return null
    const existing = bidPricingAssignments.find(
      (a) => a.count_row_id === countRowId && a.price_book_version_id === versionId,
    )
    const entriesById = new Map(priceBookEntries.map((e) => [e.id, e]))
    if (existing) {
      return entriesById.get(existing.price_book_entry_id) ?? null
    }
    const countRow = pricingCountRows.find((r) => r.id === countRowId)
    if (!countRow) return null
    return (
      priceBookEntries.find(
        (e) =>
          (e.fixture_types?.name ?? '').toLowerCase() === (countRow.fixture ?? '').toLowerCase(),
      ) ?? null
    )
  }

  function pricingRowCanToggleOmitFromSubmission(_countRowId: string): boolean {
    return selectedPricingVersionId != null
  }

  async function savePricingAssignment(countRowId: string, priceBookEntryId: string) {
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
      else await loadBidPricingAssignments(bidId, versionId)
    } else {
      const { error: err } = await supabase
        .from('bid_pricing_assignments')
        .insert({ bid_id: bidId, count_row_id: countRowId, price_book_entry_id: priceBookEntryId, price_book_version_id: versionId })
      if (err) setError(err.message)
      else await loadBidPricingAssignments(bidId, versionId)
    }
  }

  async function removePricingAssignment(countRowId: string) {
    const bidId = selectedBidForPricing?.id
    const versionId = selectedPricingVersionId
    if (!bidId || !versionId) return
    const existing = bidPricingAssignments.find((a) => a.count_row_id === countRowId && a.price_book_version_id === versionId)
    if (!existing) return
    const { error: err } = await supabase.from('bid_pricing_assignments').delete().eq('id', existing.id)
    if (err) setError(err.message)
    else await loadBidPricingAssignments(bidId, versionId)
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

  async function updateUnitPriceOverride(countRowId: string, value: number | null) {
    const bidId = selectedBidForPricing?.id
    const versionId = selectedPricingVersionId
    if (!bidId || !versionId) return

    setSavingUnitPriceOverride(countRowId)
    const err = await writeUnitPriceOverrideRow(countRowId, value)

    if (err) setError(err.message)
    else await loadBidPricingAssignments(bidId, versionId)
    setSavingUnitPriceOverride(null)
  }

  /* ---- Price by margin (v2.1769; row-by-row Margin mode v2.1772) ---- */
  const [recentMargins, setRecentMargins] = useState<number[]>(() => loadRecentMargins(window.localStorage))
  /** The row whose "…" picker is open. */
  const [marginPickerRow, setMarginPickerRow] = useState<{ countRowId: string; fixture: string; cost: number; count: number } | null>(null)
  const [marginPickerCustom, setMarginPickerCustom] = useState('')

  /** One-row apply (chip tap or picker choice) — no overwrite confirm; a single deliberate row is trivially re-done. */
  async function applyMarginToSingleRow(target: { countRowId: string; cost: number; count: number }, marginRaw: string | number) {
    const m = normalizeMarginTarget(marginRaw)
    if (m == null) {
      showToast('Enter a margin between 1 and 95.', 'error')
      return
    }
    const bidId = selectedBidForPricing?.id
    const versionId = selectedPricingVersionId
    if (!bidId || !versionId) return
    const price = unitPriceForTargetMargin(target.cost, target.count, m)
    if (price == null) return
    setApplyingMargin(true)
    try {
      const err = await writeUnitPriceOverrideRow(target.countRowId, price)
      if (err) setError(err.message)
      else {
        // The applied price is now the saved price — drop the row from any solver
        // preview (and its veto) so a later Apply can't overwrite it (New view).
        if (wbPreview && target.countRowId in wbPreview) {
          const nextPreview = { ...wbPreview }
          delete nextPreview[target.countRowId]
          const nextVeto = new Set(wbPreviewVeto)
          nextVeto.delete(target.countRowId)
          setAndStashWbPreview(versionId, Object.keys(nextPreview).length > 0 ? nextPreview : null, nextVeto)
        }
        await loadBidPricingAssignments(bidId, versionId)
      }
      const next = updateRecentMargins(recentMargins, m)
      setRecentMargins(next)
      saveRecentMargins(window.localStorage, next)
    } finally {
      setApplyingMargin(false)
      setMarginPickerRow(null)
      setMarginPickerCustom('')
    }
  }
  const [applyingMargin, setApplyingMargin] = useState(false)

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
      // Re-activate another of the bid's Pricings (if any), else clear.
      const remaining = (selectedBidForPricing ? await loadBidPricings(selectedBidForPricing.id) : []) ?? []
      const nextId = pickActivePricing({ savedVersionId: null, bidPricings: remaining })
      setSelectedPricingVersionId(nextId)
      if (!nextId) setPriceBookEntries([])
      if (selectedBidForPricing) {
        await saveBidSelectedPriceBookVersion(selectedBidForPricing.id, nextId)
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
    e.preventDefault()
    const targetVersionId = entryFormTargetPricing ? selectedPricingVersionId : panelVersionId
    if (!targetVersionId) {
      setError(entryFormTargetPricing ? 'No pricing selected' : templatesMode ? 'No template selected' : 'No pricing selected')
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
        if (entryFormTargetPricing) await loadPriceBookEntries(selectedPricingVersionId)
        else await reloadPanelEntries()
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
        message: `Delete "${entry.fixture_types?.name ?? ''}" from this ${templatesMode ? 'price book' : 'pricing'}?`,
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

  function buildPricingPrintContext(): PricingPrintContext | null {
    if (!selectedBidForPricing) return null
    return {
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
      viewModel: 'price',
      assignments: bidPricingAssignments,
      customPrices: bidCountRowCustomPrices,
      submissionHides: bidCountRowSubmissionHides,
      taxPercent: parseFloat(costEstimatePOModalTaxPercent || '8.25') || 0,
    }
  }

  type ScenarioInputs = { entries: PriceBookEntryWithFixture[]; assignments: BidPricingAssignment[]; customPrices: BidCountRowCustomPrice[]; hides: BidCountRowSubmissionHide[] }
  /** The four per-scenario inputs the print/CSV/Share paths need, for a scenario that isn't the one on screen. */
  async function loadScenarioInputs(bidId: string, pricingId: string): Promise<ScenarioInputs> {
    const [entriesRes, assignRes, customRes, hidesRes] = await Promise.all([
      supabase.from('price_book_entries').select('*, fixture_types(name)').eq('version_id', pricingId),
      supabase.from('bid_pricing_assignments').select('*').eq('bid_id', bidId).eq('price_book_version_id', pricingId),
      supabase.from('bid_count_row_custom_prices').select('*').eq('bid_id', bidId).eq('price_book_version_id', pricingId),
      supabase.from('bid_count_row_submission_hides').select('*').eq('bid_id', bidId).eq('price_book_version_id', pricingId),
    ])
    return {
      entries: (entriesRes.data as PriceBookEntryWithFixture[]) ?? [],
      assignments: (assignRes.data as BidPricingAssignment[]) ?? [],
      customPrices: (customRes.data as BidCountRowCustomPrice[]) ?? [],
      hides: (hidesRes.data as BidCountRowSubmissionHide[]) ?? [],
    }
  }
  /** Same math as useBidPricingRows.pricingPackageSource, for an arbitrary scenario's inputs. */
  function packageRowsFromInputs(pricingId: string, inputs: ScenarioInputs): { rows: PackageAndSendPricingRowInput[]; totalRevenue: number } {
    const customMap = new Map<string, number>()
    for (const cp of inputs.customPrices) if (cp.price_book_version_id === pricingId) customMap.set(cp.count_row_id, Number(cp.unit_price))
    const result = computeBidPricingRows({
      countRows: pricingCountRows,
      assignments: inputs.assignments
        .filter((a) => a.price_book_version_id === pricingId)
        .map((a) => ({ count_row_id: a.count_row_id, price_book_entry_id: a.price_book_entry_id, is_fixed_price: a.is_fixed_price ?? false, unit_price_override: a.unit_price_override })),
      entries: inputs.entries,
      customUnitPriceByCountRowId: customMap,
      laborRows: pricingLaborRows,
      totalMaterials: (pricingMaterialTotalRoughIn ?? 0) + (pricingMaterialTotalTopOut ?? 0) + (pricingMaterialTotalTrimSet ?? 0),
      laborRate: pricingLaborRate ?? 0,
      taxPercent: parseFloat(costEstimatePOModalTaxPercent || '8.25') || 0,
      materialsFromTakeoffByCountRowId: pricingFixtureMaterialsFromTakeoff,
      hiddenSubmissionCountRowIds: submissionHiddenIdsForVersion(inputs.hides, pricingId),
    })
    return {
      rows: result.rows.map((r) => ({ fixture: r.countRow.fixture ?? '', count: r.count, unitPrice: r.unitPrice, revenue: r.revenue, omitFromSubmissionDocuments: r.omitFromSubmissionDocuments })),
      totalRevenue: result.totalRevenue,
    }
  }
  function buildPricingPrintContextFor(pricingId: string, inputs: ScenarioInputs): PricingPrintContext | null {
    const ctx = buildPricingPrintContext()
    if (!ctx) return null
    return { ...ctx, selectedPricingVersionId: pricingId, priceBookEntries: inputs.entries, assignments: inputs.assignments, customPrices: inputs.customPrices, submissionHides: inputs.hides }
  }
  function printPricingPageWith(ctx: PricingPrintContext) {
    printPricingPageDoc(ctx)
  }
  /** Share / Print / CSV entry point: ask which price when the viewed scenario isn't the ★. */
  function requestWithStarCheck(action: 'share' | 'print' | 'csv') {
    const starId = selectedBidForPricing?.selected_price_book_version_id ?? null
    if (starId && selectedPricingVersionId && starId !== selectedPricingVersionId) {
      setStarChoice('star')
      setStarChooser(action)
      return
    }
    void runStarAwareAction(action, false)
  }
  async function runStarAwareAction(action: 'share' | 'print' | 'csv', useStar: boolean) {
    const bid = selectedBidForPricing
    if (!bid) return
    const starId = bid.selected_price_book_version_id ?? null
    if (!useStar || !starId || starId === selectedPricingVersionId) {
      setStarChooser(null)
      if (action === 'share') {
        setShareOverride(null)
        setPackageSendOpen(true)
        return
      }
      const ctx = buildPricingPrintContext()
      if (!ctx) return
      if (action === 'print') printPricingPageWith(ctx)
      else downloadPricingCsvWith(ctx)
      return
    }
    setStarBusy(true)
    try {
      const inputs = await loadScenarioInputs(bid.id, starId)
      if (action === 'share') {
        const pkg = packageRowsFromInputs(starId, inputs)
        setShareOverride({ pricingId: starId, name: priceBookVersions.find((v) => v.id === starId)?.name ?? '—', rows: pkg.rows, totalRevenue: pkg.totalRevenue })
        setPackageSendOpen(true)
      } else {
        const ctx = buildPricingPrintContextFor(starId, inputs)
        if (!ctx) return
        if (action === 'print') printPricingPageWith(ctx)
        else downloadPricingCsvWith(ctx)
      }
    } finally {
      setStarBusy(false)
      setStarChooser(null)
    }
  }

  function printPricingPage() {
    requestWithStarCheck('print')
  }

  function downloadPricingCsv() {
    requestWithStarCheck('csv')
  }

  function downloadPricingCsvWith(ctx: PricingPrintContext) {
    const teamLaborCostByBidId = new Map(teamLaborDataForBids.map((r) => [r.bidId, r.bidCost]))
    const teamLaborCost = teamLaborCostByBidId.get(ctx.bid.id) ?? 0
    const result = buildPricingCsvForBid(ctx, teamLaborCost)
    if (!result) {
      showToast('Select a price and make sure Counts and Labor are set up.', 'info')
      return
    }
    const blob = new Blob([`\uFEFF${result.csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = result.filename
    a.click()
    URL.revokeObjectURL(url)
    showToast('Pricing exported to CSV.', 'success')
  }

  async function printAllPricingPages() {
    const ctx = buildPricingPrintContext()
    if (!ctx) return
    const err = await printAllPricingPagesDoc(ctx)
    if (err) setError(err)
  }

  const bidsScopedForPricing = onlyMyBids ? bids.filter(isMyBid) : bids
  const filteredBidsForPricing: BidWithBuilder[] = pricingSearchQuery.trim()
    ? bidsScopedForPricing.filter(
        (b) =>
          (b.project_name?.toLowerCase().includes(pricingSearchQuery.toLowerCase()) ?? false) ||
          (b.address?.toLowerCase().includes(pricingSearchQuery.toLowerCase()) ?? false) ||
          (b.customers?.name?.toLowerCase().includes(pricingSearchQuery.toLowerCase()) ?? false) ||
          (b.bids_gc_builders?.name?.toLowerCase().includes(pricingSearchQuery.toLowerCase()) ?? false) ||
          bidNumberMatchesQuery(b, pricingSearchQuery, ledgerPrefixMap)
      )
    : bidsScopedForPricing

  // Iteration 2 — per-scenario revenue. Mirrors the cover-letter bundle
  // computation: for each bid-owned Pricing, fetch its entries + overlays and
  // run the shared calc kernel; cost is scenario-independent.
  useEffect(() => {
    const bid = selectedBidForPricing
    const versionIds = priceBookVersions.map((v) => v.id)
    if (!bid || versionIds.length < 2 || pricingCountRows.length === 0) {
      setWbScenarioRevenue({})
      return
    }
    let cancelled = false
    void (async () => {
      const [entriesRes, assignRes, customRes, hidesRes] = await Promise.all([
        supabase.from('price_book_entries').select('*, fixture_types(name)').in('version_id', versionIds),
        supabase.from('bid_pricing_assignments').select('*').eq('bid_id', bid.id).in('price_book_version_id', versionIds),
        supabase.from('bid_count_row_custom_prices').select('*').eq('bid_id', bid.id).in('price_book_version_id', versionIds),
        supabase.from('bid_count_row_submission_hides').select('*').eq('bid_id', bid.id).in('price_book_version_id', versionIds),
      ])
      if (cancelled) return
      const allEntries = (entriesRes.data as PriceBookEntryWithFixture[]) ?? []
      const allAssign = (assignRes.data as BidPricingAssignment[]) ?? []
      const allCustom = (customRes.data as BidCountRowCustomPrice[]) ?? []
      const allHides = (hidesRes.data as BidCountRowSubmissionHide[]) ?? []
      const out: Record<string, number> = {}
      for (const vid of versionIds) {
        const customMap = new Map<string, number>()
        for (const c of allCustom) if (c.price_book_version_id === vid) customMap.set(c.count_row_id, Number(c.unit_price))
        const result = computeBidPricingRows({
          countRows: pricingCountRows,
          assignments: allAssign
            .filter((a) => a.price_book_version_id === vid)
            .map((a) => ({ count_row_id: a.count_row_id, price_book_entry_id: a.price_book_entry_id, is_fixed_price: a.is_fixed_price ?? false, unit_price_override: a.unit_price_override })),
          entries: allEntries.filter((e) => e.version_id === vid),
          customUnitPriceByCountRowId: customMap,
          laborRows: [],
          totalMaterials: 0,
          laborRate: 0,
          taxPercent: 0,
          materialsFromTakeoffByCountRowId: {},
          hiddenSubmissionCountRowIds: submissionHiddenIdsForVersion(allHides, vid),
        })
        out[vid] = coverLetterTotalsFromPricingRows(result.rows).revenueSum
      }
      setWbScenarioRevenue(out)
    })()
    return () => {
      cancelled = true
    }
  }, [selectedBidForPricing?.id, priceBookVersions, pricingCountRows, bidPricingAssignments, bidCountRowCustomPrices])

  // Iteration 3 — win/loss calibration history for this service type.
  useEffect(() => {
    if (!selectedServiceTypeId) {
      setWbHistory(null)
      return
    }
    let cancelled = false
    void (async () => {
      const { data, error: rpcErr } = await supabase.rpc('bid_pricing_history', { p_service_type_id: selectedServiceTypeId })
      if (cancelled) return
      if (rpcErr || !Array.isArray(data)) {
        setWbHistory([])
        return
      }
      setWbHistory(data as unknown as BidPricingHistoryRow[])
    })()
    return () => {
      cancelled = true
    }
  }, [selectedServiceTypeId])

  /**
   * Workbench view/★ split (v2.2013): the bid's saved `selected_price_book_version_id` is the
   * ★ customer-facing scenario (Cover Letter, Share, bid value); `selectedPricingVersionId` is
   * merely the scenario open on the Workbench. Card clicks only view; the star action persists.
   */
  const customerFacingPricingId =
    (selectedBidVersionId ? bidVersions.find((v) => v.id === selectedBidVersionId)?.starred_price_book_version_id ?? null : null)
    ?? selectedBidForPricing?.selected_price_book_version_id
    ?? null

  /** The Workbench walkthrough stops, in the section's own top-to-bottom order. */
  const WORKBENCH_TOUR_STEPS: SpotlightTourStep[] = [
    {
      anchor: 'send-to',
      title: 'Send to — one packet per GC',
      body: 'Versions draft this bid for different GCs: each GC gets its own packet — counts, prices, send date, answer. "＋ Add GC" starts one as a copy of this one.',
    },
    {
      anchor: 'workbench-scenarios',
      title: 'Prices — what this GC receives',
      body: 'Price options are different prices for the same GC. The ★ base is what the GC sees — Cover Letter, Share, Print, and the bid value all use it. Offer another as an alternate and it goes on their letter too; anything else is yours to compare.',
    },
    {
      anchor: 'workbench-summary',
      title: 'Read the strip',
      body: 'Revenue, cost, profit, and margin always show the price you’re viewing. An amber dashed border means the numbers include an unsaved solver preview.',
    },
    {
      anchor: 'workbench-solver',
      title: 'Solve to a number',
      body: 'Press the blue Solver › to unfold the solver — its blue ring holds the 20–95 slider (re-prices live as you drag), the typed margin, and the whole-bid target total; ‹ folds it away, and your choice is remembered. Hand-set prices on no-cost rows stack on top. The ▾ beside Solver holds "Price unpriced only". Apply writes the drafts; Discard throws them away.',
    },
    {
      anchor: 'workbench-rows',
      title: 'Type to price, Solve to preview',
      body: 'A price you type saves the moment you press Enter or leave the field — no Apply needed. Solver results land as amber previews instead, saved only when you "Apply" up in the strip; a preview waits on this device (reloads, closed tabs, tomorrow) until you Apply or Discard. 📌 pins a row so the solver holds its price.',
    },
  ]

  function startWorkbenchTour() {
    // The tour points at the solver's controls — unfold it first (v2.2385).
    setAndRememberWbSolverOpen(true)
    const present = spotlightTourStepsPresent(WORKBENCH_TOUR_STEPS)
    if (present.length === 0) {
      showToast('Nothing to tour yet — the Workbench needs Counts, an active Pricing, and a cost estimate.', 'info')
      return
    }
    setWbTourSteps(present)
  }

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
    await saveBidSelectedPriceBookVersion(bid.id, v.id)
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
  const [altVersionData, setAltVersionData] = useState<Record<string, { revenue: number | null; materials: number | null }>>({})
  const [addOwnTakeoffOpen, setAddOwnTakeoffOpen] = useState<{ name: string } | null>(null)
  const [creatingOwnTakeoffAlt, setCreatingOwnTakeoffAlt] = useState(false)
  useEffect(() => {
    const bid = selectedBidForPricing
    if (!bid) return
    const alts = sameGcAlternateVersions(bidVersions, selectedBidVersionId)
    if (alts.length === 0) {
      setAltVersionData({})
      return
    }
    let cancelled = false
    void (async () => {
      const { data: bidMeta } = await supabase.from('bids').select('materials_model').eq('id', bid.id).maybeSingle()
      const mm = normalizeMaterialsModel((bidMeta as { materials_model?: string } | null)?.materials_model)
      const out: Record<string, { revenue: number | null; materials: number | null }> = {}
      await Promise.all(
        alts.map(async (v) => {
          const [countsRes, roughRes] = await Promise.all([
            supabase.from('bids_count_rows').select('*').eq('bid_id', bid.id).eq('bid_version_id', v.id).order('sequence_order', { ascending: true }),
            mm === 'rough'
              ? supabase.from('bids_takeoff_rough_part_lines').select('count_row_id, quantity, unit_price').eq('bid_id', bid.id).eq('bid_version_id', v.id)
              : Promise.resolve({ data: null }),
          ])
          const counts = (countsRes.data as BidCountRow[] | null) ?? []
          let materials: number | null = null
          if (mm === 'rough' && roughRes.data) {
            const lines = roughRes.data as Array<{ count_row_id: string; quantity: number; unit_price: number }>
            materials = sumRoughLinesPreTaxWithCount(lines, new Map(counts.map((c) => [c.id, c.count])))
          }
          let revenue: number | null = null
          const starId = v.starred_price_book_version_id ?? null
          if (starId && counts.length > 0) {
            // The Map modal's per-version revenue: the pricing kernel on the version's
            // own counts, prices only (no labor/materials → revenue).
            const inputs = await loadScenarioInputs(bid.id, starId)
            const customMap = new Map<string, number>()
            for (const cp of inputs.customPrices) if (cp.price_book_version_id === starId) customMap.set(cp.count_row_id, Number(cp.unit_price))
            const result = computeBidPricingRows({
              countRows: counts,
              assignments: inputs.assignments
                .filter((a) => a.price_book_version_id === starId)
                .map((a) => ({ count_row_id: a.count_row_id, price_book_entry_id: a.price_book_entry_id, is_fixed_price: a.is_fixed_price ?? false, unit_price_override: a.unit_price_override })),
              entries: inputs.entries,
              customUnitPriceByCountRowId: customMap,
              laborRows: [],
              totalMaterials: 0,
              laborRate: 0,
              taxPercent: 0,
              materialsFromTakeoffByCountRowId: {},
              hiddenSubmissionCountRowIds: submissionHiddenIdsForVersion(inputs.hides, starId),
            })
            revenue = coverLetterTotalsFromPricingRows(result.rows).revenueSum
          }
          out[v.id] = { revenue, materials }
        }),
      )
      if (!cancelled) setAltVersionData(out)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBidForPricing?.id, selectedBidVersionId, bidVersions])
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
        .select('id, fixture')
        .eq('bid_id', bidId)
        .eq('bid_version_id', versionId)
      if (err) {
        setError(err.message)
        return null
      }
      return (data ?? []) as Array<{ id: string; fixture: string | null }>
    }
    const sourceRows = await loadRows(sourceBidVersionId)
    const targetRows = await loadRows(targetBidVersionId)
    if (!sourceRows || !targetRows) return null
    const rowMap = mapCountRowsByFixture(sourceRows, targetRows)
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
    const bid = selectedBidForPricing
    const targetId = selectedPricingVersionId
    if (!bid || !targetId || targetId === sourceId) return
    setWbCopyingPrices(true)
    try {
      const sourceBidVersionId = priceBookVersions.find((p) => p.id === sourceId)?.bid_version_id ?? null
      const crossVersion = sourceBidVersionId != null && sourceBidVersionId !== selectedBidVersionId
      let sourceCountRows: Array<{ id: string; fixture: string | null; count: number | string | null }> = pricingCountRows
      if (crossVersion) {
        const { data, error: err } = await supabase
          .from('bids_count_rows')
          .select('id, fixture, count')
          .eq('bid_id', bid.id)
          .eq('bid_version_id', sourceBidVersionId)
        if (err) {
          setError(err.message)
          return
        }
        sourceCountRows = (data ?? []) as Array<{ id: string; fixture: string | null; count: number | string | null }>
      }
      const [entriesRes, assignRes, customRes] = await Promise.all([
        supabase.from('price_book_entries').select('*, fixture_types(name)').eq('version_id', sourceId),
        supabase.from('bid_pricing_assignments').select('*').eq('bid_id', bid.id).eq('price_book_version_id', sourceId),
        supabase.from('bid_count_row_custom_prices').select('*').eq('bid_id', bid.id).eq('price_book_version_id', sourceId),
      ])
      const customMap = new Map<string, number>()
      for (const c of (customRes.data as BidCountRowCustomPrice[]) ?? []) customMap.set(c.count_row_id, Number(c.unit_price))
      const result = computeBidPricingRows({
        countRows: sourceCountRows,
        assignments: ((assignRes.data as BidPricingAssignment[]) ?? []).map((a) => ({
          count_row_id: a.count_row_id,
          price_book_entry_id: a.price_book_entry_id,
          is_fixed_price: a.is_fixed_price ?? false,
          unit_price_override: a.unit_price_override,
        })),
        entries: (entriesRes.data as PriceBookEntryWithFixture[]) ?? [],
        customUnitPriceByCountRowId: customMap,
        laborRows: [],
        totalMaterials: 0,
        laborRate: 0,
        taxPercent: 0,
        materialsFromTakeoffByCountRowId: {},
        hiddenSubmissionCountRowIds: new Set<string>(),
      })
      const rowMap = crossVersion
        ? mapCountRowsByFixture(
            sourceCountRows.map((r) => ({ id: r.id, fixture: r.fixture })),
            pricingCountRows.map((r) => ({ id: r.id, fixture: r.fixture })),
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
    const overhead = Math.max(derived.totalCost - fixtureCostSum, 0)
    const solverRows = derived.rows.map((r) => ({
      id: r.countRow.id,
      count: r.count,
      rowCost: r.cost,
      // A saved $0 is not a price (v2.2396) — the solver treats those rows as unpriced.
      unitPrice: wbPreview?.[r.countRow.id] ?? (r.unitPrice != null && r.unitPrice > 0 ? r.unitPrice : null),
      locked: r.isFixedPrice || wbLocks.has(r.countRow.id),
    }))
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
      setWbTargetSolveResult(null)
    }
    if (opts.targetTotal != null) {
      setWbTargetSolveResult({ target: opts.targetTotal, landed: sol.resultingRevenue })
      // The slider means "margin on the costed rows" (hand-set no-cost revenue
      // stacks on top), so sync it to the costed portion of where this landed —
      // syncing to blended would jump prices on the next slider nudge.
      const costedRev = sol.resultingRevenue - sol.uncostedFixedRevenue
      if (costedRev > 0) {
        const costedMargin = (costedRev - derived.totalCost) / costedRev
        setWbMarginPct(Math.min(95, Math.max(1, Math.round(costedMargin * 100))))
      }
    }
  }

  /** Workbench: commit the preview via the existing per-row override write. */
  async function applyWorkbenchPreview() {
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

  function derivePricingWorkbench() {
    if (!selectedPricingVersionId || pricingCountRows.length === 0 || !pricingCostEstimate) return null
                const totalMaterials = (pricingMaterialTotalRoughIn ?? 0) + (pricingMaterialTotalTopOut ?? 0) + (pricingMaterialTotalTrimSet ?? 0)
                const rate = pricingLaborRate ?? 0
                const totalLaborHours = pricingLaborRows.reduce(
                  (s, r) => s + laborRowHours(r),
                  0
                )
                const taxPercent = parseFloat(costEstimatePOModalTaxPercent || '8.25') || 0
                const laborCost = totalLaborHours * rate
                const distance = parseFloat(selectedBidForPricing?.distance_from_office ?? '0') || 0
                const ratePerMile = costEstimateDrivingRate(pricingCostEstimate)
                const hrsPerTrip = costEstimateHoursPerTrip(pricingCostEstimate)
                const numTrips = totalLaborHours / hrsPerTrip
                const drivingCost = numTrips * ratePerMile * distance
                const estimatorCost = costEstimateEstimatorCost(pricingCostEstimate, pricingCountRows.length)
                const travelCost = computeTravelCost(pricingCostEstimate)
                const equipmentRentalCost = sumEquipmentRows(pricingEquipmentRows)
                const permitCost = sumEquipmentRows(pricingPermitRows)
                const subcontractorCost = sumEquipmentRows(pricingSubcontractorRows)
                const wasteCost = sumEquipmentRows(pricingWasteRows)
                const otherCost = sumEquipmentRows(pricingOtherRows)
                const teamLaborCostByBidId = new Map(teamLaborDataForBids.map((r) => [r.bidId, r.bidCost]))
                const teamLaborCost = selectedBidForPricing?.id ? (teamLaborCostByBidId.get(selectedBidForPricing.id) ?? 0) : 0
                const totalCost = totalMaterials + laborCost + drivingCost + estimatorCost + teamLaborCost + travelCost + equipmentRentalCost + permitCost + subcontractorCost + wasteCost + otherCost
                const assignmentsForVersion = bidPricingAssignments.filter(
                  (a) => a.price_book_version_id === selectedPricingVersionId,
                )
                const pricingCalcResult = pricingRowsForGrid
                if (!pricingCalcResult) return null

                const totalRevenue = pricingCalcResult.totalRevenue
                const rows = pricingCalcResult.rows.map((pr) => {
                  const laborRow = pricingLaborRows.find(
                    (l) =>
                      (l.fixture ?? '').toLowerCase() === (pr.countRow.fixture ?? '').toLowerCase(),
                  )
                  const customPrice =
                    bidCountRowCustomPrices.find(
                      (c) =>
                        c.count_row_id === pr.countRow.id &&
                        c.price_book_version_id === selectedPricingVersionId,
                    )?.unit_price ?? null
                  const assignment = assignmentsForVersion.find((a) => a.count_row_id === pr.countRow.id)
                  const materialsFromTakeoff = pricingFixtureMaterialsFromTakeoff[pr.countRow.id]
                  const taxAmount =
                    materialsFromTakeoff != null ? pr.materialsBeforeTax * (taxPercent / 100) : 0
                  const marginVal = pr.marginPct
                  const flag = marginFlag(marginVal)
                  return {
                    countRow: pr.countRow as BidCountRow,
                    entry: pr.entry as PriceBookEntryWithFixture | undefined,
                    laborRow,
                    count: pr.count,
                    cost: pr.cost,
                    unitPrice: pr.unitPrice,
                    isFixedPrice: pr.isFixedPrice,
                    revenue: pr.revenue,
                    margin: marginVal,
                    flag,
                    assignment,
                    customPrice,
                    materialsBeforeTax: pr.materialsBeforeTax,
                    materialsWithTax: pr.materialsWithTax,
                    taxAmount,
                    laborCost: pr.laborCost,
                    materialsFromTakeoff: materialsFromTakeoff ?? null,
                    pctOfGrandTotal: pr.pctOfGrandTotal,
                    omitFromSubmissionDocuments: pr.omitFromSubmissionDocuments,
                    canToggleOmitSubmission: pricingRowCanToggleOmitFromSubmission(pr.countRow.id),
                  }
                })
                // Fixtures with a Sale Price but no Takeoffs Unit-price cost: their margin reads "—"
                // (no cost basis), and the bid-level Total margin treats them as full profit — so it
                // is overstated until those costs are entered in Takeoffs.
                const uncostedRevenueRows = rows.filter(
                  (r) => r.revenue > 0 && (r.materialsFromTakeoff == null || r.materialsFromTakeoff === 0),
                )
                const uncostedRevenue = uncostedRevenueRows.reduce((s, r) => s + r.revenue, 0)
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
            <input
              type="text"
              placeholder="Search bids (bid #, project name, or GC/Builder)..."
              value={pricingSearchQuery}
              onChange={(e) => setPricingSearchQuery(e.target.value)}
              style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }}
            />
            <BidPickerSortToggle />
            <MyBidsToggle active={onlyMyBids} onChange={setOnlyMyBids} />
          </div>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', flex: '0 0 auto', flexWrap: 'wrap', gap: '0.75rem' }}>
                <BidWorkflowTabTitleWithPreview
                  bid={selectedBidForPricing}
                  previewEnabled={bidPreview != null}
                  onOpenPreview={() => bidPreview?.openBidPreviewFromBid(selectedBidForPricing)}
                  h2Style={{ margin: 0, flex: '0 0 auto' }}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '0 0 auto' }}>
                {/* v2.2630/31/36: one chip, five states (deriveRfqChip) — quotes-only
                    opens compare (as shipped); any request opens the RFQ desk. */}
                {canPackageAndSendBidPricing && rfqChip.kind !== 'none' ? (
                  <button
                    type="button"
                    onClick={() => (rfqChip.kind === 'desk' ? setRfqDeskOpen(true) : setQuotesCompareOpen(true))}
                    title={rfqChip.kind === 'desk' ? 'Open the price-request desk' : 'Compare supply house quotes on this bid'}
                    style={{
                      padding: '0.45rem 0.8rem',
                      background: rfqChip.kind === 'desk' && rfqChip.tone === 'amber' ? 'var(--bg-yellow-tint)' : 'var(--surface)',
                      color:
                        rfqChip.kind === 'quotes'
                          ? 'var(--text-blue-500)'
                          : rfqChip.tone === 'red'
                            ? '#ef4444'
                            : rfqChip.tone === 'amber'
                              ? 'var(--text-amber-700)'
                              : '#15803d',
                      border: `1px solid ${rfqChip.kind === 'quotes' ? '#3b82f6' : rfqChip.tone === 'red' ? '#ef4444' : rfqChip.tone === 'amber' ? '#f59e0b' : '#16a34a'}`,
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
                  const owned = [...priceBookVersions].sort((a, b) => a.sort_order - b.sort_order)
                  const scenarios: Array<{ id: string; name: string }> =
                    owned.length > 0 ? owned : selectedPricingVersionId ? [{ id: selectedPricingVersionId, name: 'Standard prices' }] : []
                  const solo = scenarios.length <= 1 && bidVersions.length <= 1
                  const gcName = gcNameForVersion(selectedBidVersionId)
                  const gcShort = shortGc(gcName)
                  const strong: React.CSSProperties = { color: 'var(--text-strong)' }
                  const infoRow = (k: string, body: React.ReactNode) => (
                    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', padding: '0.5rem 0.95rem', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ flex: '0 0 7.5rem', fontWeight: 700, color: 'var(--text-strong)', fontSize: '0.8rem' }}>{k}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{body}</span>
                    </div>
                  )
                  return (
                    <div role="presentation" onClick={() => setWbInfoOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 60, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '4rem 1rem 1rem' }}>
                      <div role="dialog" aria-label="How this page works" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 10, maxWidth: '30rem', width: '100%', boxShadow: '0 10px 32px rgba(15, 23, 42, 0.2)', overflow: 'hidden' }}>
                        <div style={{ padding: '0.55rem 0.95rem', borderBottom: '1px solid var(--border)', fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>
                          How this page works
                        </div>
                        {infoRow(
                          'Type a price',
                          <>
                            saves when you leave the field <span style={{ color: 'var(--text-green-700)', fontSize: '0.68rem', fontWeight: 700 }}>saved ✓</span>
                          </>,
                        )}
                        {infoRow(
                          'Solve',
                          <>
                            previews prices in amber{' '}
                            <span style={{ border: '1px solid var(--text-amber-700)', background: 'var(--bg-amber-tint)', borderRadius: 4, padding: '0 0.3rem', fontSize: '0.72rem', fontVariantNumeric: 'tabular-nums', color: 'var(--text-strong)' }}>150</span>{' '}
                            — <b style={strong}>Apply</b> writes them, <b style={strong}>Discard</b> clears them. Previews wait on this device and never reach the GC.
                          </>,
                        )}
                        {solo
                          ? infoRow(
                              'This bid',
                              <>
                                one packet — {gcShort} sees <b style={strong}>{scenarios[0]?.name ?? 'your price'}</b>. <b style={strong}>＋ Add price</b> starts another price or GC.
                              </>,
                            )
                          : infoRow(
                              'This GC',
                              <>
                                {gcName} — <span style={{ color: 'var(--text-green-600)', fontWeight: 700 }}>★</span> base is what they see on their letter; switch GC or price option at the top.
                              </>,
                            )}
                        {infoRow('Labor & cost', <>shared by the whole package — switching bids changes revenue, not cost.</>)}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.6rem 0.95rem', background: 'var(--bg-subtle)' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setWbInfoOpen(false)
                              startWorkbenchTour()
                            }}
                            style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '0.32rem 0.8rem', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer' }}
                          >
                            ▶ Take the tour
                          </button>
                          <Link to="/help?g=price-a-bid-with-the-workbench" onClick={() => setWbInfoOpen(false)} style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-link)' }}>
                            Read the guide →
                          </Link>
                          <button
                            type="button"
                            onClick={() => setWbInfoOpen(false)}
                            style={{ font: 'inherit', marginLeft: 'auto', padding: '0.3rem 0.8rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer', fontSize: '0.78rem' }}
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })()
              : null}
            {wbTourSteps ? (
              <SpotlightTour
                steps={wbTourSteps}
                onClose={() => setWbTourSteps(null)}
                guideHref="/help?g=price-a-bid-with-the-workbench"
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
                const fmtM = (n: number) => `$${formatCurrency(n)}`
                return (
                  <>
                    {(() => {
                      const all = [...priceBookVersions].sort((a, b) => a.sort_order - b.sort_order)
                      // v2.2404: the row is "what this GC receives" — scope to the ACTIVE version's
                      // price options (own-takeoff alternates join as version cards below). Falls
                      // back to the unscoped list when scoping would empty the row (legacy pointers).
                      const scoped = selectedBidVersionId ? all.filter((p) => p.bid_version_id === selectedBidVersionId) : all.filter((p) => p.bid_version_id == null)
                      const owned = scoped.length > 0 ? scoped : all
                      // Legacy bids: the active pricing can be a shared (non-bid-owned)
                      // version — still show it as a card so Duplicate can birth the
                      // first real scenario.
                      const scenarios = owned.length > 0
                        ? owned
                        : selectedPricingVersionId
                          ? [{ id: selectedPricingVersionId, name: 'Standard prices', sort_order: 0 } as (typeof owned)[number]]
                          : []
                      const altVersions = sameGcAlternateVersions(bidVersions, selectedBidVersionId)
                      if (scenarios.length === 0 && altVersions.length === 0) return null
                      const revOf = (id: string) => (id === selectedPricingVersionId ? effRevenue : (wbScenarioRevenue[id] ?? null))
                      const starred = scenarios.find((s) => s.id === customerFacingPricingId) ?? null
                      // "Copy prices from …" source for an empty viewed scenario: the ★ if priced, else any priced one.
                      const copySource =
                        starred && (revOf(starred.id) ?? 0) > 0 && starred.id !== selectedPricingVersionId
                          ? starred
                          : scenarios.find((s) => s.id !== selectedPricingVersionId && (revOf(s.id) ?? 0) > 0) ?? null
                      const cardBtnStyle: React.CSSProperties = { font: 'inherit', fontSize: '0.72rem', padding: '0.18rem 0.5rem', borderRadius: 5, border: '1px solid var(--border-strong)', background: 'var(--bg-muted)', color: 'var(--text-700)', cursor: 'pointer' }
                      // v2.2104: one creation door for both variant kinds, and the whole
                      // hierarchy collapses to a single line while it has nothing to say.
                      const doorBtn = (
                        <button
                          type="button"
                          onClick={() => setWbVariantDoorOpen(true)}
                          disabled={wbCloning}
                          style={{ font: 'inherit', fontSize: '0.82rem', fontWeight: 600, padding: '0.42rem 0.85rem', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--bg-blue-tint)', color: 'var(--text-link)', cursor: wbCloning ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}
                        >
                          {wbCloning ? 'Duplicating…' : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span aria-hidden style={{ fontSize: '1.05rem', lineHeight: 1 }}>＋</span>
                              <span style={{ textAlign: 'left', lineHeight: 1.25 }}>Add<br />price</span>
                            </span>
                          )}
                        </button>
                      )
                      const doorOptStyle: React.CSSProperties = { display: 'flex', gap: '0.7rem', alignItems: 'flex-start', width: '100%', textAlign: 'left', font: 'inherit', border: '1px solid var(--border)', borderRadius: 10, padding: '0.7rem 0.8rem', background: 'var(--surface)', cursor: 'pointer', marginBottom: '0.55rem' }
                      const doorModal = wbVariantDoorOpen ? (
                        <div
                          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}
                          onClick={() => setWbVariantDoorOpen(false)}
                        >
                          <div
                            role="dialog"
                            aria-label="Add a price or GC"
                            style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '1rem 1.1rem', maxWidth: 440, width: '92%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <h3 style={{ margin: '0 0 0.2rem', fontSize: '1.02rem' }}>Add a price or GC</h3>
                            <p style={{ margin: '0 0 0.8rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>What do you want?</p>
                            <button
                              type="button"
                              style={doorOptStyle}
                              onClick={() => {
                                setWbVariantDoorOpen(false)
                                setAddPriceOpen({ name: '', fromId: selectedPricingVersionId, offer: true })
                              }}
                            >
                              <span style={{ fontSize: '1.2rem', lineHeight: 1.2 }}>💲</span>
                              <span>
                                <b style={{ display: 'block', fontSize: '0.92rem' }}>Another price for {selectedBidVersionId ? shortGc(gcNameForVersion(selectedBidVersionId)) : 'this GC'}</b>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                  Offer it as an alternate on their letter, or keep it to compare. The GC sees the ★ and what you offer — nothing else. Same takeoff, different numbers.
                                </span>
                              </span>
                            </button>
                            {/* v2.2404 (Wendi): an alternate that CHANGES MATERIALS gets its own takeoff —
                                a same-GC version marked Alternate, so its margin costs against its parts. */}
                            <button
                              type="button"
                              style={{ ...doorOptStyle, border: '1.5px solid #0d9488' }}
                              onClick={() => {
                                setWbVariantDoorOpen(false)
                                setAddOwnTakeoffOpen({ name: '' })
                              }}
                            >
                              <span style={{ fontSize: '1.2rem', lineHeight: 1.2 }}>📐</span>
                              <span>
                                <b style={{ display: 'block', fontSize: '0.92rem' }}>Alternate with its own takeoff</b>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                  For "in lieu of" work that changes materials — PEX for copper, cast iron for PVC. Starts as a copy of this bid's counts, takeoff and prices; swap the materials and the margin follows. Lands on their letter as an alternate.
                                </span>
                              </span>
                            </button>
                            <button
                              type="button"
                              style={doorOptStyle}
                              onClick={() => {
                                setWbVariantDoorOpen(false)
                                window.dispatchEvent(new Event('bid-version-picker-open-add-gc'))
                              }}
                            >
                              <span style={{ fontSize: '1.2rem', lineHeight: 1.2 }}>📦</span>
                              <span>
                                <b style={{ display: 'block', fontSize: '0.92rem' }}>Another GC</b>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                  Send this bid to another GC — its own packet, starting as a copy of this one's counts, takeoff and prices.
                                </span>
                              </span>
                            </button>
                            <button
                              type="button"
                              style={doorOptStyle}
                              onClick={() => {
                                setWbVariantDoorOpen(false)
                                setAdoptOpen(true)
                              }}
                            >
                              <span style={{ fontSize: '1.2rem', lineHeight: 1.2 }}>⤵</span>
                              <span>
                                <b style={{ display: 'block', fontSize: '0.92rem' }}>Adopt an existing bid</b>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                  Pull a bid already on the board in as one of this bid's packets. Its counts, prices and sent history come with it; its old row retires.
                                </span>
                              </span>
                            </button>
                            <div style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                onClick={() => setWbVariantDoorOpen(false)}
                                style={{ font: 'inherit', fontSize: '0.8rem', padding: '0.35rem 0.8rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--bg-muted)', color: 'var(--text-strong)', cursor: 'pointer' }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : null
                      // v2.2404: name the own-takeoff alternate — the door's teal choice lands here.
                      const ownTakeoffModal = addOwnTakeoffOpen ? (
                        <div
                          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}
                          onClick={() => !creatingOwnTakeoffAlt && setAddOwnTakeoffOpen(null)}
                        >
                          <div
                            role="dialog"
                            aria-label="Alternate with its own takeoff"
                            style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '1rem 1.1rem', maxWidth: 460, width: '92%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <h3 style={{ margin: '0 0 0.2rem', fontSize: '1.02rem' }}>📐 Alternate with its own takeoff</h3>
                            <p style={{ margin: '0 0 0.8rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                              Starts as a copy of this bid's counts, takeoff and prices for {shortGc(gcNameForVersion(selectedBidVersionId))}. Swap the materials in Takeoffs and the margin follows. It lands on their letter as an alternate.
                            </p>
                            <label style={{ display: 'block', marginBottom: '0.8rem' }}>
                              <span style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600, fontSize: '0.85rem' }}>Name</span>
                              <input
                                autoFocus
                                value={addOwnTakeoffOpen.name}
                                onChange={(e) => setAddOwnTakeoffOpen({ name: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') void createOwnTakeoffAlternate(addOwnTakeoffOpen.name)
                                  else if (e.key === 'Escape') setAddOwnTakeoffOpen(null)
                                }}
                                placeholder="e.g. PEX in lieu of copper"
                                style={{ width: '100%', padding: '0.45rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 6, boxSizing: 'border-box', font: 'inherit', background: 'var(--surface)', color: 'var(--text-strong)' }}
                              />
                            </label>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                              <button
                                type="button"
                                onClick={() => setAddOwnTakeoffOpen(null)}
                                disabled={creatingOwnTakeoffAlt}
                                style={{ font: 'inherit', fontSize: '0.8rem', padding: '0.35rem 0.8rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--bg-muted)', color: 'var(--text-strong)', cursor: 'pointer' }}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => void createOwnTakeoffAlternate(addOwnTakeoffOpen.name)}
                                disabled={creatingOwnTakeoffAlt || !addOwnTakeoffOpen.name.trim()}
                                style={{ font: 'inherit', fontSize: '0.8rem', fontWeight: 600, padding: '0.35rem 0.9rem', border: 'none', borderRadius: 6, background: '#0d9488', color: '#fff', cursor: creatingOwnTakeoffAlt ? 'wait' : 'pointer', opacity: !addOwnTakeoffOpen.name.trim() ? 0.6 : 1 }}
                              >
                                {creatingOwnTakeoffAlt ? 'Creating…' : 'Create the alternate'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : null
                      const solo = scenarios.length === 1 && bidVersions.length <= 1
                      if (solo) {
                        const v = scenarios[0]!
                        const rev = revOf(v.id)
                        const m = rev != null && rev > 0 ? (rev - totalCost) / rev : null
                        const unpriced = rev === 0
                        const isCustomerFacing = v.id === customerFacingPricingId
                        if (unpriced) {
                          // Nothing priced yet: skip the status band entirely — the solver is the next move
                          // and sits first; ＋ Add price rides at the solver line's end (artifact 0a627c7c).
                          wbSolverEnd.node = doorBtn
                          return <>{doorModal}{ownTakeoffModal}</>
                        }
                        return (
                          <>
                            <div
                              data-tour="workbench-scenarios"
                              style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', flexWrap: 'wrap', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.5rem 0.9rem', marginBottom: '0.9rem' }}
                            >
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>One GC · one price</span>
                              {isCustomerFacing ? (
                                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-green-600)' }}>★ base · the GC sees this</span>
                              ) : null}
                              <b style={{ fontSize: '0.85rem' }}>{v.name}</b>
                              {unpriced ? (
                                <>
                                  <span style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--text-amber-700)', border: '1px solid var(--border)', background: 'var(--bg-amber-tint)', borderRadius: 999, padding: '0.1rem 0.5rem' }}>
                                    No prices yet
                                  </span>
                                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>— price below or use the solver</span>
                                </>
                              ) : (
                                <>
                                  <b style={{ fontSize: '0.9rem', fontVariantNumeric: 'tabular-nums' }}>{rev != null ? fmtM(rev) : '…'}</b>
                                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                                    {m == null ? '' : `${Math.round(m * 100)}% margin · profit ${fmtM((rev ?? 0) - totalCost)}`}
                                  </span>
                                </>
                              )}
                              {!isCustomerFacing && !unpriced ? (
                                <button type="button" onClick={() => void makeScenarioCustomerFacing(v, rev)} style={cardBtnStyle}>
                                  ☆ Make base…
                                </button>
                              ) : null}
                              <span style={{ flex: 1 }} />
                              {doorBtn}
                            </div>
                            {doorModal}
                            {ownTakeoffModal}
                          </>
                        )
                      }
                      return (
                        <>
                          {/* v2.2204: the whole set of price options sits in one quiet gray tray. */}
                          <div data-tour="workbench-scenarios" style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch', margin: '0.85rem 0 0.9rem', flexWrap: 'wrap', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 12, padding: '0.6rem' }}>
                            {scenarios.map((v) => {
                              const viewing = v.id === selectedPricingVersionId
                              const isCustomerFacing = v.id === customerFacingPricingId
                              const rev = revOf(v.id)
                              const m = rev != null && rev > 0 ? (rev - totalCost) / rev : null
                              const unpriced = rev === 0
                              const offered = !isCustomerFacing && !unpriced && (v as { include_in_submission?: boolean }).include_in_submission === true
                              return (
                                <div
                                  key={v.id}
                                  onClick={() => { if (!viewing) viewWorkbenchScenario(v.id) }}
                                  title={viewing ? 'The price open on this Workbench' : 'View this price (doesn’t change what the GC sees)'}
                                  style={{
                                    flex: '1 1 215px', minWidth: 215, maxWidth: 300, textAlign: 'left', font: 'inherit',
                                    background: isCustomerFacing ? 'var(--bg-green-tint)' : 'var(--surface)',
                                    border: viewing ? '1px solid #3b82f6' : isCustomerFacing ? '1px solid var(--border-green)' : '1px solid var(--border)',
                                    boxShadow: viewing ? '0 0 0 1px #3b82f6' : 'none',
                                    borderRadius: 10, padding: '0.5rem 0.75rem 0', cursor: viewing ? 'default' : 'pointer', position: 'relative',
                                    display: 'flex', flexDirection: 'column',
                                  }}
                                >
                                  {/* v2.2203: state tabs sit on the card's top edge — blue Viewing, green ★ Submittal; side by side when both. */}
                                  {(viewing || isCustomerFacing) ? (
                                    <span style={{ position: 'absolute', top: '-0.72rem', left: '0.6rem', display: 'inline-flex', gap: '0.3rem' }}>
                                      {viewing ? (
                                        <span style={{ fontSize: '0.64rem', fontWeight: 700, whiteSpace: 'nowrap', color: '#fff', background: '#3b82f6', borderRadius: 999, padding: '0.14rem 0.55rem', boxShadow: '0 1px 4px rgba(15, 23, 42, 0.18)' }}>Viewing</span>
                                      ) : null}
                                      {isCustomerFacing ? (
                                        <span style={{ fontSize: '0.64rem', fontWeight: 700, whiteSpace: 'nowrap', color: '#fff', background: '#16a34a', borderRadius: 999, padding: '0.14rem 0.55rem', boxShadow: '0 1px 4px rgba(15, 23, 42, 0.18)' }}>★ Submittal</span>
                                      ) : null}
                                    </span>
                                  ) : null}
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', minWidth: 0 }}>
                                      <span style={{ fontSize: '0.8rem', fontWeight: 700, overflowWrap: 'anywhere' }}>{v.name}</span>
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setPricingEdit({ id: v.id, name: v.name }) }}
                                        title="Rename or delete this price"
                                        aria-label={`Edit ${v.name}`}
                                        style={{ padding: '0 0.1rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.72rem', color: 'var(--text-muted)', flex: '0 0 auto' }}
                                      >
                                        ✎
                                      </button>
                                    </div>
                                    {unpriced ? (
                                      <span style={{ fontSize: '0.62rem', fontWeight: 700, whiteSpace: 'nowrap', color: 'var(--text-amber-700)', border: '1px solid var(--border)', background: 'var(--bg-amber-tint)', borderRadius: 999, padding: '0.05rem 0.45rem' }}>No prices yet</span>
                                    ) : null}
                                  </div>
                                  <div style={{ fontSize: '0.92rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: unpriced ? 'var(--text-muted)' : undefined }}>{rev != null ? fmtM(rev) : '…'}</div>
                                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', marginBottom: '0.4rem' }}>
                                    {m == null ? '—' : `${Math.round(m * 100)}% margin · profit ${fmtM((rev ?? 0) - totalCost)}`}
                                  </div>
                                  {unpriced && viewing && copySource ? (
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-amber-700)', marginTop: '0.25rem' }}>
                                      Start pricing:{' '}
                                      <button
                                        type="button"
                                        disabled={wbCopyingPrices}
                                        onClick={(e) => { e.stopPropagation(); void copyPricesIntoViewedScenario(copySource.id) }}
                                        style={{ font: 'inherit', fontSize: '0.7rem', padding: 0, border: 'none', background: 'none', color: 'var(--text-amber-700)', textDecoration: 'underline', cursor: wbCopyingPrices ? 'wait' : 'pointer' }}
                                      >
                                        {wbCopyingPrices ? 'copying…' : `copy prices from ${copySource.name}`}
                                      </button>{' '}
                                      or use the solver below.
                                    </div>
                                  ) : null}
                                  {/* v2.2203 (option 1): the footer answers "who sees this price?" and carries the actions. */}
                                  {(() => {
                                    const linkStyle: React.CSSProperties = { font: 'inherit', fontSize: '0.66rem', fontWeight: 600, padding: 0, border: 'none', background: 'none', cursor: 'pointer', textDecoration: 'underline', color: 'inherit', whiteSpace: 'nowrap' }
                                    const footBase: React.CSSProperties = { margin: 'auto -0.75rem 0', padding: '0.26rem 0.7rem', borderTop: '1px solid var(--border)', borderRadius: '0 0 9px 9px', fontSize: '0.66rem', display: 'flex', alignItems: 'center', gap: '0.3rem 0.55rem', flexWrap: 'wrap', marginTop: 'auto' }
                                    if (isCustomerFacing) {
                                      return (
                                        <div style={{ ...footBase, background: 'var(--bg-green-100)', color: 'var(--text-emerald-800)', fontWeight: 700 }}>
                                          ★ The price on their letter
                                        </div>
                                      )
                                    }
                                    if (unpriced) {
                                      return (
                                        <div style={{ ...footBase, background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>
                                          Only you see this
                                        </div>
                                      )
                                    }
                                    return (
                                      <div style={{ ...footBase, ...(offered ? { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)', fontWeight: 600 } : { background: 'var(--bg-subtle)', color: 'var(--text-muted)' }) }}>
                                        <span style={{ whiteSpace: 'nowrap' }}>{offered ? 'On their letter · alternate' : 'Only you see this'}</span>
                                        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: '0.55rem', whiteSpace: 'nowrap' }}>
                                          <button type="button" style={linkStyle} title={offered ? 'Take this price off their letter' : 'Add this price to their letter as an alternate — same counts, no new version'} onClick={(e) => { e.stopPropagation(); void setScenarioOffered(v, !offered); window.dispatchEvent(new Event('bid-version-picker-reload')) }}>
                                            {offered ? 'stop offering' : 'offer as alternate'}
                                          </button>
                                          <button type="button" style={linkStyle} title="Make this the ★ price their letter is built on" onClick={(e) => { e.stopPropagation(); void makeScenarioCustomerFacing(v, rev); window.dispatchEvent(new Event('bid-version-picker-reload')) }}>
                                            ☆ make base
                                          </button>
                                        </span>
                                      </div>
                                    )
                                  })()}
                                </div>
                              )
                            })}
                            {/* v2.2404 (Wendi): same-GC alternates with their OWN takeoff ride the row as
                                version cards — margin costed from THEIR materials, not the base's. */}
                            {altVersions.map((av) => {
                              const d = altVersionData[av.id]
                              const nums = alternateCardNumbers({
                                revenue: d?.revenue ?? null,
                                altMaterials: d?.materials ?? null,
                                baseMaterials: derived.totalMaterials,
                                baseTotalCost: totalCost,
                              })
                              const inLetter = (av as { include_in_submission?: boolean | null }).include_in_submission === true
                              const unpricedAlt = d != null && (d.revenue == null || d.revenue === 0)
                              return (
                                <div
                                  key={av.id}
                                  onClick={() => onSwitchBidVersion(av.id)}
                                  title="Open this alternate — its own counts and takeoff; the Workbench costs against ITS materials"
                                  style={{
                                    flex: '1 1 215px', minWidth: 215, maxWidth: 300, textAlign: 'left', font: 'inherit',
                                    background: 'var(--surface)', border: '1px solid #0d9488',
                                    borderRadius: 10, padding: '0.5rem 0.75rem 0', cursor: 'pointer', position: 'relative',
                                    display: 'flex', flexDirection: 'column',
                                  }}
                                >
                                  <span style={{ position: 'absolute', top: '-0.72rem', left: '0.6rem', display: 'inline-flex', gap: '0.3rem' }}>
                                    <span style={{ fontSize: '0.64rem', fontWeight: 700, whiteSpace: 'nowrap', color: '#fff', background: '#0d9488', borderRadius: 999, padding: '0.14rem 0.55rem', boxShadow: '0 1px 4px rgba(15, 23, 42, 0.18)' }}>📐 own takeoff</span>
                                  </span>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, overflowWrap: 'anywhere' }}>{av.name}</span>
                                    {unpricedAlt ? (
                                      <span style={{ fontSize: '0.62rem', fontWeight: 700, whiteSpace: 'nowrap', color: 'var(--text-amber-700)', border: '1px solid var(--border)', background: 'var(--bg-amber-tint)', borderRadius: 999, padding: '0.05rem 0.45rem' }}>No prices yet</span>
                                    ) : null}
                                  </div>
                                  <div style={{ fontSize: '0.92rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: unpricedAlt ? 'var(--text-muted)' : undefined }}>
                                    {d == null ? '…' : d.revenue != null ? fmtM(d.revenue) : '—'}
                                  </div>
                                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                                    {nums.margin != null ? (
                                      <>
                                        <span style={{ fontWeight: 700, color: mColor(nums.margin) }}>{Math.round(nums.margin * 100)}% margin</span>
                                        {` · profit ${fmtM(nums.profit ?? 0)}`}
                                      </>
                                    ) : (
                                      '—'
                                    )}
                                  </div>
                                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', margin: '0.2rem 0 0.4rem' }}>
                                    {d == null
                                      ? ''
                                      : d.materials != null
                                        ? (
                                          <>
                                            Materials {fmtM(d.materials)}
                                            {nums.materialsDelta != null && nums.materialsDelta !== 0 ? (
                                              <span style={{ fontWeight: 600, color: nums.materialsDelta < 0 ? 'var(--text-green-600)' : 'var(--text-amber-700)' }}>
                                                {` · ${nums.materialsDelta < 0 ? '−' : '+'}${fmtM(Math.abs(nums.materialsDelta))} vs base`}
                                              </span>
                                            ) : null}
                                            {' · '}
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                onSwitchBidVersion(av.id)
                                                if (selectedBidForPricing) onNavigateBidToTab(selectedBidForPricing, 'takeoffs')
                                              }}
                                              style={{ font: 'inherit', fontSize: '0.68rem', fontWeight: 600, padding: 0, border: 'none', background: 'none', cursor: 'pointer', textDecoration: 'underline', color: 'var(--text-link)' }}
                                            >
                                              open its takeoff →
                                            </button>
                                          </>
                                        )
                                        : 'Materials · shared POs (exact model)'}
                                  </div>
                                  <div style={{ margin: 'auto -0.75rem 0', padding: '0.26rem 0.7rem', borderTop: '1px solid var(--border)', borderRadius: '0 0 9px 9px', fontSize: '0.66rem', display: 'flex', alignItems: 'center', gap: '0.3rem 0.55rem', flexWrap: 'wrap', ...(inLetter ? { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)', fontWeight: 600 } : { background: 'var(--bg-subtle)', color: 'var(--text-muted)' }) }}>
                                    {inLetter ? 'On their letter · alternate' : 'Only you see this'}
                                  </div>
                                </div>
                              )
                            })}
                            <div style={{ flex: '0 0 auto', alignSelf: 'center' }}>{doorBtn}</div>
                          </div>
                          {doorModal}
                          {ownTakeoffModal}
                        </>
                      )
                    })()}
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
                          if (!Number.isFinite(v) || v <= totalCost) {
                            showToast(`Target must beat our cost ($${formatCurrency(totalCost)}).`, 'error')
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
                        return (
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
                                  {wbSolverEnd.node}
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
                                      onChange={(e) => { setWbTargetTotalInput(e.target.value); setWbTargetSolveResult(null) }}
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
                                    {wbSolverEnd.node}
                                    {restoredChip}
                                    {previewControl}
                                  </>,
                                )}
                              </div>
                              </>
                            )}
                          </div>
                        )
                      })()}
                      {brushArmed ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.5rem', border: '1px solid #ddd6fe', background: '#f5f3ff', color: 'var(--text-violet-700)', borderRadius: 8, padding: '0.35rem 0.7rem', fontSize: '0.78rem', fontWeight: 600 }}>
                          <span>Sweep across rows to price them at {brushMarginVal() ?? '—'}% — held 📌, fixed-price and no-cost rows are skipped. Esc puts the brush down.</span>
                          {brushCommitting ? (
                            <span style={{ marginLeft: 'auto', fontWeight: 800 }}>Saving…</span>
                          ) : brushStrokeCount > 0 ? (
                            <span style={{ marginLeft: 'auto', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>Painting {brushStrokeCount} row{brushStrokeCount === 1 ? '' : 's'} @ {brushMarginVal() ?? '—'}%</span>
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
                    </div>
                    </div>

                    {(() => {
                      if (!wbHistory || wbHistory.length === 0) return null
                      const cur = effMargin
                      const currentBidId = selectedBidForPricing?.id
                      const marginOfRow = (h: BidPricingHistoryRow) => (h.bid_value > 0 ? (h.bid_value - h.est_cost) / h.bid_value : null)
                      const usable = wbHistory
                        .filter((h) => h.bid_id !== currentBidId && h.est_cost > 0)
                        .map((h) => ({ ...h, m: marginOfRow(h) }))
                        .filter((h): h is BidPricingHistoryRow & { m: number } => h.m != null && h.m > -0.2 && h.m < 0.95)
                      const won = usable.filter((h) => h.outcome === 'won')
                      // Structured category first (any surface's tapped reason counts); the
                      // free-text regex stays as the pre-category-era fallback.
                      const lostPrice = usable.filter((h) => h.outcome === 'lost' && ((h.loss_category ?? null) === 'price' || /price/i.test(h.loss_reason ?? '')))
                      // Recorded bid tabs (v2.2085) → "the margin that would have matched that tab's low".
                      const tabMarks: { label: string; matchPct: number; customerId: string | null }[] = []
                      for (const h of wbHistory) {
                        if (h.bid_id === currentBidId || h.est_cost <= 0) continue
                        const matchPct = marginPctToMatchTabLow(h.bid_tab_low ?? null, h.est_cost)
                        // Same sanity band as the win/loss dots — a barely-filled cost estimate
                        // would otherwise pin a meaningless mark to the scale's edge.
                        if (matchPct != null && matchPct > -20 && matchPct < 95)
                          tabMarks.push({ label: h.project_name ?? '—', matchPct, customerId: h.customer_id ?? null })
                      }
                      if (won.length + lostPrice.length < 3) return null
                      const MIN = 20, MAX = 65
                      const x = (mPct: number) => `${((Math.min(MAX, Math.max(MIN, mPct)) - MIN) / (MAX - MIN)) * 100}%`
                      let verdict: { text: string; color: string } | null = null
                      if (cur != null) {
                        const curPct = cur * 100
                        const wonAtOrBelow = won.filter((h) => h.m * 100 <= curPct + 0.5).length
                        const lossesAtOrBelow = lostPrice.filter((h) => h.m * 100 <= curPct + 0.5).length
                        const maxWon = won.length ? Math.max(...won.map((h) => h.m * 100)) : null
                        if (maxWon != null && curPct <= maxWon && lossesAtOrBelow === 0) {
                          verdict = { text: `In your winning range — ${wonAtOrBelow} of ${won.length} wins priced at or below ${Math.round(curPct)}% (estimated margins).`, color: 'var(--text-green-600)' }
                        } else if (maxWon != null && curPct <= maxWon) {
                          verdict = { text: `Mixed territory — wins exist here, but ${lossesAtOrBelow} price-loss${lossesAtOrBelow !== 1 ? 'es' : ''} sit at or below ${Math.round(curPct)}%.`, color: 'var(--text-amber-700)' }
                        } else if (maxWon != null) {
                          verdict = { text: `Above every recorded win (max ${Math.round(maxWon)}%) — ${lostPrice.length} bid${lostPrice.length !== 1 ? 's' : ''} lost on price in this range.`, color: 'var(--text-red-700)' }
                        }
                      }
                      return (
                        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.7rem 1rem 0.85rem', marginBottom: '0.9rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>This number vs your history <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(estimated margins from cost estimates)</span></span>
                            {verdict ? <span style={{ fontSize: '0.78rem', fontWeight: 600, color: verdict.color }}>{verdict.text}</span> : null}
                          </div>
                          <div style={{ position: 'relative', height: tabMarks.length > 0 ? 56 : 46, marginTop: '0.5rem' }}>
                            <div style={{ position: 'absolute', top: 18, height: 10, borderRadius: 999, left: 0, width: '100%', background: 'var(--bg-muted)' }} />
                            {won.map((h) => (
                              <span key={h.bid_id} title={`Won: ${h.project_name ?? '—'} at ~${Math.round(h.m * 100)}%`} style={{ position: 'absolute', top: 20, width: 7, height: 7, borderRadius: 999, transform: 'translateX(-50%)', background: 'var(--text-green-600)', left: x(h.m * 100) }} />
                            ))}
                            {lostPrice.map((h) => (
                              <span key={h.bid_id} title={`Lost on price: ${h.project_name ?? '—'} at ~${Math.round(h.m * 100)}%`} style={{ position: 'absolute', top: 20, width: 7, height: 7, borderRadius: 999, transform: 'translateX(-50%)', background: 'var(--text-red-700)', left: x(h.m * 100) }} />
                            ))}
                            {tabMarks.map((t, i) => (
                              <span
                                key={`tab-${i}`}
                                title={`Tab low on ${t.label}: ~${Math.round(t.matchPct)}% would have matched it`}
                                style={{ position: 'absolute', top: 27, fontSize: '0.72rem', color: 'var(--text-amber-700)', transform: 'translateX(-50%)', left: x(t.matchPct), cursor: 'default' }}
                              >
                                {'▽'}
                              </span>
                            ))}
                            {[20, 30, 40, 50, 60].map((a) => (
                              <span key={a} style={{ position: 'absolute', top: tabMarks.length > 0 ? 44 : 34, fontSize: '0.62rem', color: 'var(--text-muted)', transform: 'translateX(-50%)', left: x(a) }}>{a}%</span>
                            ))}
                            {cur != null ? (
                              <span style={{ position: 'absolute', top: 2, transform: 'translateX(-50%)', textAlign: 'center', left: x(cur * 100), transition: 'left 0.15s' }}>
                                <span style={{ display: 'block', fontSize: '0.66rem', fontWeight: 700 }}>{Math.round(cur * 100)}%</span>
                                <span style={{ display: 'block', width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '9px solid var(--text-strong)', margin: '0 auto' }} />
                              </span>
                            ) : null}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                            <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 999, background: 'var(--text-green-600)', margin: '0 0.25rem 0 0' }} />won bids
                            <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 999, background: 'var(--text-red-700)', margin: '0 0.25rem 0 0.7rem' }} />lost on price · ▼ this pricing
                            {tabMarks.length > 0 ? <span style={{ color: 'var(--text-amber-700)' }}> · {'▽'} margin to match a recorded tab low</span> : null}
                          </div>
                          {tabMarks.length > 0 && cur != null ? (
                            <p style={{ margin: '0.4rem 0 0', fontSize: '0.78rem', color: 'var(--text-700)' }}>
                              At {Math.round(cur * 100)}%, this number would have matched or beaten the low on{' '}
                              <strong>{countTabsMatchedOrBeaten(cur * 100, tabMarks.map((t) => t.matchPct))} of {tabMarks.length}</strong> recorded tab
                              {tabMarks.length === 1 ? '' : 's'}.
                              {(() => {
                                const gcId = selectedBidForPricing?.customer_id ?? null
                                const gcTabs = gcId ? tabMarks.filter((t) => t.customerId === gcId) : []
                                if (gcTabs.length < 2) return null
                                const pcts = gcTabs.map((t) => Math.round(t.matchPct)).sort((a, b) => a - b)
                                return (
                                  <span style={{ color: 'var(--text-muted)' }}>
                                    {' '}This GC's {gcTabs.length} tabs needed {pcts[0]}–{pcts[pcts.length - 1]!}% to match the low.
                                  </span>
                                )
                              })()}
                            </p>
                          ) : null}
                        </div>
                      )
                    })()}
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
                            {wbFillingBook ? 'Filling…' : `Fill ${bookMatches.length} matching from book`}
                          </button>
                        </div>
                      )
                    })()}

                    <div
                      data-tour="workbench-rows"
                      // Margin brush (v2.2401): armed, the grid is a canvas — capture-phase down
                      // starts a stroke (and keeps clicks/typing from firing), moves paint every
                      // row the pointer crosses, up commits the batch. The cursor is the brush
                      // itself (Font Awesome Free glyph, hotspot at the bristle edge).
                      onPointerDownCapture={(e) => {
                        if (!brushArmed || brushCommitting) return
                        e.preventDefault()
                        e.stopPropagation()
                        const m = brushMarginVal()
                        if (m == null) {
                          showToast('Load the brush first — margin between 1 and 95.', 'error')
                          return
                        }
                        brushPaintingRef.current = true
                        brushStrokeRef.current = new Map()
                        setBrushStrokeCount(0)
                        try {
                          e.currentTarget.setPointerCapture(e.pointerId)
                        } catch {
                          /* pointer capture unsupported — moves still fire while over the grid */
                        }
                        brushPaintAt(e.clientX, e.clientY, eff, m)
                      }}
                      onPointerMove={(e) => {
                        if (!brushPaintingRef.current) return
                        const m = brushMarginVal()
                        if (m != null) brushPaintAt(e.clientX, e.clientY, eff, m)
                      }}
                      onPointerUp={() => void endBrushStroke()}
                      onPointerCancel={() => void endBrushStroke()}
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
                                <td style={{ padding: '0.35rem 0.7rem', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>{r.countRow.fixture ?? '—'}</td>
                                <td style={{ padding: '0.35rem 0.7rem', borderBottom: '1px solid var(--border)', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{r.count}</td>
                                <td style={{ padding: '0.35rem 0.7rem', borderBottom: '1px solid var(--border)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: r.cost > 0 ? 'var(--text-700)' : 'var(--text-muted)' }} onClick={(e) => e.stopPropagation()}>
                                  {r.cost > 0 ? `$${formatCurrency(r.cost / r.count)}` : 'no cost'}
                                  {(() => {
                                    const cc = bidCountRowCustomCosts.find((c) => c.count_row_id === r.countRow.id)
                                    if (!cc) return null
                                    return (
                                      <button
                                        type="button"
                                        title={`Materials from ${cc.house_name ?? 'a quote'} (${cc.applied_at.slice(5, 10)})${cc.lot_group_id ? ' — part of a package; reverting reverts the whole package' : ''} — click to revert to takeoff`}
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

                    {(() => {
                      const legend = buildProfitLegend(conc.segments)
                      const hoverSeg = wbBarHover != null ? conc.segments[wbBarHover] : null
                      const pinnedIdx = wbBarPinnedId != null ? conc.segments.findIndex((s) => s.id === wbBarPinnedId) : -1
                      const pinnedSeg = pinnedIdx >= 0 ? conc.segments[pinnedIdx] : null
                      const pinnedRow = pinnedSeg ? eff.find((r) => r.countRow.id === pinnedSeg.id) : null
                      const hoverSlice = (i: number, el: HTMLElement) => {
                        const bar = el.closest('[data-profit-bar-track]') as HTMLElement | null
                        setWbBarHover(i)
                        if (bar) setWbBarTipLeft(clampTooltipLeft(el.offsetLeft + el.offsetWidth / 2, bar.offsetWidth, 130))
                      }
                      const jumpToRow = (rowId: string) => {
                        setWbShowNoCostOnly(false)
                        setWbShowUnpricedOnly(false)
                        setWbFlashRowId(rowId)
                        window.setTimeout(() => {
                          document.getElementById(`wb-row-${rowId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        }, 50)
                        window.setTimeout(() => setWbFlashRowId((cur) => (cur === rowId ? null : cur)), 2000)
                      }
                      const statCell = (label: string, value: string, color?: string) => (
                        <div>
                          <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>{label}</div>
                          <div style={{ fontSize: '0.86rem', fontWeight: 600, color: color ?? 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
                        </div>
                      )
                      return (
                        <div data-profit-bar style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.7rem 0.9rem', marginTop: '0.9rem' }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Where the profit lives</span>
                            {conc.top2Share != null && conc.top2Share > 0.6 && conc.segments.length >= 2 ? (
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-amber-700)' }}>
                                ⚠ {Math.round(conc.top2Share * 100)}% of profit sits in {conc.segments[0]?.label} + {conc.segments[1]?.label} — a VE cut there guts the job.
                              </span>
                            ) : null}
                            {conc.totalProfit > 0 ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setWbLegendCollapsed((prev) => {
                                    const next = !prev
                                    try {
                                      window.localStorage.setItem('wbProfitLegendCollapsed_v1', next ? '1' : '0')
                                    } catch {
                                      /* private browsing */
                                    }
                                    return next
                                  })
                                }}
                                style={{ marginLeft: 'auto', font: 'inherit', fontSize: '0.72rem', color: 'var(--text-muted)', border: 'none', background: 'none', cursor: 'pointer', padding: '0 0.2rem' }}
                              >
                                {wbLegendCollapsed ? 'Show legend ▸' : 'Hide legend ▾'}
                              </button>
                            ) : null}
                          </div>
                          <div data-profit-bar-track style={{ position: 'relative', marginTop: '0.45rem' }} onMouseLeave={() => setWbBarHover(null)}>
                            <div style={{ display: 'flex', height: 16, borderRadius: 6, overflow: 'hidden' }}>
                              {conc.totalProfit <= 0 ? (
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No profit yet — price some rows.</span>
                              ) : (
                                conc.segments.map((s, i) => (
                                  <button
                                    key={s.id}
                                    type="button"
                                    aria-label={`${s.label}: $${formatCurrency(s.profit)} profit (${formatProfitShare(s.share)} of job) — click for details`}
                                    onMouseEnter={(e) => hoverSlice(i, e.currentTarget)}
                                    onFocus={(e) => hoverSlice(i, e.currentTarget)}
                                    onBlur={() => setWbBarHover(null)}
                                    onClick={() => setWbBarPinnedId((cur) => (cur === s.id ? null : s.id))}
                                    style={{
                                      width: `${s.share * 100}%`,
                                      minWidth: 2,
                                      border: 'none',
                                      padding: 0,
                                      cursor: 'pointer',
                                      background: concColors[i % concColors.length],
                                      opacity: wbBarHover == null || wbBarHover === i ? 1 : 0.35,
                                      transform: wbBarHover === i ? 'scaleY(1.25)' : undefined,
                                      transition: 'opacity 120ms ease, transform 120ms ease',
                                    }}
                                  />
                                ))
                              )}
                            </div>
                            {hoverSeg ? (
                              <div
                                role="tooltip"
                                style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: wbBarTipLeft, transform: 'translateX(-50%)', background: 'var(--text-strong)', color: 'var(--surface)', borderRadius: 8, padding: '0.4rem 0.6rem', fontSize: '0.78rem', lineHeight: 1.35, whiteSpace: 'nowrap', boxShadow: '0 8px 20px rgba(0,0,0,0.25)', pointerEvents: 'none', zIndex: 20 }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}>
                                  <span style={{ width: 9, height: 9, borderRadius: 3, flex: 'none', background: concColors[(wbBarHover ?? 0) % concColors.length] }} />
                                  {hoverSeg.label}
                                </div>
                                <div style={{ opacity: 0.75, fontVariantNumeric: 'tabular-nums' }}>
                                  ${formatCurrency(hoverSeg.profit)} profit · {formatProfitShare(hoverSeg.share)} of job
                                </div>
                              </div>
                            ) : null}
                          </div>
                          {conc.totalProfit > 0 && !wbLegendCollapsed ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.15rem 0.35rem', marginTop: '0.4rem' }}>
                              {legend.chips.map((c) => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onMouseEnter={(e) => {
                                    const track = (e.currentTarget.closest('[data-profit-bar]') as HTMLElement | null)?.querySelector('[data-profit-bar-track]') as HTMLElement | null
                                    const slice = track?.querySelectorAll('button')[c.colorIndex] as HTMLElement | undefined
                                    if (slice) hoverSlice(c.colorIndex, slice)
                                  }}
                                  onMouseLeave={() => setWbBarHover(null)}
                                  onClick={() => setWbBarPinnedId((cur) => (cur === c.id ? null : c.id))}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    font: 'inherit',
                                    fontSize: '0.72rem',
                                    color: wbBarHover === c.colorIndex || wbBarPinnedId === c.id ? 'var(--text-strong)' : 'var(--text-muted)',
                                    background: wbBarHover === c.colorIndex || wbBarPinnedId === c.id ? 'var(--bg-subtle)' : 'none',
                                    border: 'none',
                                    padding: '0.12rem 0.45rem',
                                    borderRadius: 999,
                                    cursor: 'pointer',
                                  }}
                                >
                                  <span style={{ width: 8, height: 8, borderRadius: 3, flex: 'none', background: concColors[c.colorIndex % concColors.length] }} />
                                  <span style={{ fontWeight: 600 }}>{c.label}</span>
                                  <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.85 }}>{formatProfitShare(c.share)}</span>
                                </button>
                              ))}
                              {legend.moreCount > 0 ? (
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.12rem 0.45rem' }}>+{legend.moreCount} more</span>
                              ) : null}
                            </div>
                          ) : null}
                          {pinnedSeg && pinnedRow ? (
                            <div role="region" aria-label={`Detail for ${pinnedSeg.label}`} style={{ marginTop: '0.55rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', boxShadow: '0 10px 24px rgba(0,0,0,0.12)', padding: '0.6rem 0.8rem 0.7rem', maxWidth: '32rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                                <span style={{ width: 10, height: 10, borderRadius: 3, flex: 'none', background: concColors[pinnedIdx % concColors.length] }} />
                                <b style={{ fontSize: '0.85rem', color: 'var(--text-strong)' }}>{pinnedSeg.label}</b>
                                {pinnedRow.entry ? (
                                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-blue-700)', background: 'var(--bg-blue-tint)', padding: '0.1rem 0.5rem', borderRadius: 999, letterSpacing: '0.02em' }}>
                                    {pinnedRow.entry.fixture_types?.name ?? 'book entry'}
                                  </span>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => setWbBarPinnedId(null)}
                                  aria-label="Close line item detail"
                                  style={{ marginLeft: 'auto', border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.95rem', lineHeight: 1, padding: '0 0.2rem' }}
                                >
                                  ✕
                                </button>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(6.5rem, 1fr))', gap: '0.5rem 1rem', marginTop: '0.55rem' }}>
                                {statCell('Qty', String(pinnedRow.count))}
                                {statCell('Unit cost', pinnedRow.cost > 0 ? `$${formatCurrency(pinnedRow.cost / pinnedRow.count)}` : 'no cost')}
                                {statCell('Sale / unit', pinnedRow.effUnit != null ? `$${formatCurrency(pinnedRow.effUnit)}` : '—')}
                                {statCell('Revenue', `$${formatCurrency(pinnedRow.effRevenue)}`)}
                                {statCell('Cost', pinnedRow.cost > 0 ? `$${formatCurrency(pinnedRow.cost)}` : '—')}
                                {statCell('Profit', `$${formatCurrency(pinnedSeg.profit)}`, mColor(pinnedRow.effMargin))}
                                {statCell('Margin', pinnedRow.effMargin != null ? `${Math.round(pinnedRow.effMargin * 100)}%` : '—', mColor(pinnedRow.effMargin))}
                                {statCell('Share of job profit', formatProfitShare(pinnedSeg.share))}
                              </div>
                              <div style={{ marginTop: '0.6rem' }}>
                                <button
                                  type="button"
                                  onClick={() => jumpToRow(pinnedSeg.id)}
                                  style={{ font: 'inherit', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-link)', border: '1px solid var(--border-strong)', background: 'none', borderRadius: 6, padding: '0.22rem 0.6rem', cursor: 'pointer' }}
                                >
                                  ↑ Jump to row in worksheet
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      )
                    })()}
                  </>
                )
              })()
            }
          </div>
        )}
        {marginPickerRow ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Margin for ${marginPickerRow.fixture || 'row'}`}
            style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))' }}
            onClick={() => setMarginPickerRow(null)}
          >
            <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 8, padding: '1rem 1.25rem', width: 'min(320px, calc(100vw - 2rem))', maxHeight: 'min(90vh, 100%)', overflow: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <h2 style={{ margin: 0, fontSize: '1rem' }}>Margin for {marginPickerRow.fixture || 'row'}</h2>
                <button
                  type="button"
                  onClick={() => setMarginPickerRow(null)}
                  aria-label="Close margin picker"
                  style={{ marginLeft: 'auto', border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: '0 0.25rem' }}
                >
                  ✕
                </button>
              </div>
              <p style={{ margin: '0.1rem 0 0.7rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {marginPickerRow.count > 1 ? `Row cost $${formatCurrency(marginPickerRow.cost)} across ${marginPickerRow.count} units` : `Unit cost $${formatCurrency(marginPickerRow.cost)}`}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {recentMargins.map((v) => {
                  const preview = unitPriceForTargetMargin(marginPickerRow.cost, marginPickerRow.count, v)
                  return (
                    <button
                      key={v}
                      type="button"
                      disabled={applyingMargin}
                      onClick={() => void applyMarginToSingleRow(marginPickerRow, v)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.5rem 0.75rem', fontSize: '0.875rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer' }}
                    >
                      <b>{v}%</b>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{preview != null ? `→ $${formatCurrency(preview)}${marginPickerRow.count > 1 ? ' /unit' : ''}` : '—'}</span>
                    </button>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.7rem', alignItems: 'center' }}>
                <input
                  type="number"
                  min={1}
                  max={95}
                  step={1}
                  value={marginPickerCustom}
                  autoFocus={recentMargins.length === 0}
                  onChange={(e) => setMarginPickerCustom(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void applyMarginToSingleRow(marginPickerRow, marginPickerCustom)
                    if (e.key === 'Escape') {
                      e.stopPropagation()
                      setMarginPickerRow(null)
                    }
                  }}
                  placeholder="Custom %"
                  aria-label="Custom margin percent"
                  style={{ flex: 1, padding: '0.35rem 0.45rem', fontSize: '0.85rem', textAlign: 'right', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)' }}
                />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', minWidth: '4.5rem', textAlign: 'right' }}>
                  {(() => {
                    const m = normalizeMarginTarget(marginPickerCustom)
                    const preview = m != null ? unitPriceForTargetMargin(marginPickerRow.cost, marginPickerRow.count, m) : null
                    return preview != null ? `→ $${formatCurrency(preview)}` : '—'
                  })()}
                </span>
                <button
                  type="button"
                  disabled={applyingMargin}
                  onClick={() => void applyMarginToSingleRow(marginPickerRow, marginPickerCustom)}
                  aria-label="Apply the custom margin"
                  style={{ padding: '0.35rem 0.7rem', fontSize: '0.85rem', fontWeight: 700, background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                >
                  →
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {pricingBreakdownRow && (() => {
          const b = pricingBreakdownRow
          const profit = b.revenue - b.cost
          const marginPct = b.revenue > 0 ? (profit / b.revenue) * 100 : null
          const uncosted = b.materialsFromTakeoff == null || b.materialsFromTakeoff === 0
          const flag = marginFlag(marginPct)
          // Per-unit column only earns its space when the count actually multiplies something.
          const showPerUnit = b.count > 1
          const perUnit = (total: number) => (b.count > 0 ? total / b.count : total)
          const columnCount = showPerUnit ? 3 : 2
          const profitColor = profit < 0 ? 'var(--text-red-600)' : 'var(--text-green-600)'
          const band =
            flag === 'red' ?
              { bg: 'var(--bg-red-tint)', border: 'var(--border-red)', text: 'var(--text-red-800)' }
            : flag === 'yellow' ?
              { bg: 'var(--bg-amber-tint)', border: 'var(--border-amber-soft)', text: 'var(--text-amber-800)' }
            : flag === 'green' ?
              { bg: 'var(--bg-green-tint)', border: 'var(--border-green)', text: 'var(--text-green-800)' }
            : { bg: 'var(--bg-subtle)', border: 'var(--border)', text: undefined }
          const sectionLabelStyle: CSSProperties = {
            padding: '0.8rem 0 0.3rem',
            fontSize: '0.6875rem',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'var(--text-faint)',
            textAlign: 'left',
          }
          const labelStyle: CSSProperties = { padding: '0.2rem 0', color: 'var(--text-muted)', textAlign: 'left' }
          const moneyStyle: CSSProperties = {
            padding: '0.2rem 0 0.2rem 1rem',
            textAlign: 'right',
            whiteSpace: 'nowrap',
          }
          const subtotalLabelStyle: CSSProperties = {
            padding: '0.35rem 0',
            fontWeight: 600,
            textAlign: 'left',
            borderTop: '1px solid var(--border)',
          }
          const subtotalMoneyStyle: CSSProperties = {
            ...moneyStyle,
            padding: '0.35rem 0 0.35rem 1rem',
            borderTop: '1px solid var(--border)',
          }
          return (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="pricing-breakdown-title"
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
              }}
              onClick={() => setPricingBreakdownRow(null)}
            >
              <div
                style={{
                  background: 'var(--surface)',
                  borderRadius: 8,
                  padding: '1.1rem 1.4rem',
                  minWidth: 340,
                  maxWidth: 440,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <h2 id="pricing-breakdown-title" style={{ margin: 0, fontSize: '1rem' }}>
                    Margin breakdown: {b.fixture}
                  </h2>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      color: 'var(--text-muted)',
                      background: 'var(--bg-subtle)',
                      borderRadius: 999,
                      padding: '0.15rem 0.6rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {b.count} unit{b.count === 1 ? '' : 's'}
                  </span>
                </div>

                {/* Jump chips: straight to the tabs this row's numbers come from. */}
                {selectedBidForPricing ? (
                  <div style={{ display: 'flex', gap: '0.4rem', margin: '0.55rem 0 0.1rem' }}>
                    {(
                      [
                        ['counts', '# Counts'],
                        ['takeoffs', '📐 Takeoffs'],
                        ['labor', '🛠 Labor'],
                      ] as const
                    ).map(([tab, label]) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => {
                          setPricingBreakdownRow(null)
                          // v2.2400 (Wendi): land on this fixture's row over there — scroll + flash.
                          if (onNavigateBidToTabRow) onNavigateBidToTabRow(selectedBidForPricing, tab, { countRowId: b.countRowId, fixture: b.fixture })
                          else onNavigateBidToTab(selectedBidForPricing, tab)
                        }}
                        title={`Open this bid's ${label.slice(label.indexOf(' ') + 1)} tab and show this fixture's row`}
                        style={{ font: 'inherit', fontSize: '0.72rem', fontWeight: 600, padding: '0.15rem 0.6rem', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ) : null}

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                  {showPerUnit && (
                    <thead>
                      <tr>
                        <th />
                        <th style={{ ...moneyStyle, fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-faint)', paddingTop: '0.5rem' }}>
                          Per unit
                        </th>
                        <th style={{ ...moneyStyle, fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-faint)', paddingTop: '0.5rem' }}>
                          {b.isFixedPrice ? 'Total' : `Total (× ${b.count})`}
                        </th>
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    <tr>
                      <td colSpan={columnCount} style={sectionLabelStyle}>Revenue</td>
                    </tr>
                    <tr>
                      <td style={labelStyle}>Sale Price{b.isFixedPrice ? ' (fixed)' : ''}</td>
                      {showPerUnit && (
                        <td style={moneyStyle}>{b.isFixedPrice ? '—' : `$${formatCurrency(b.unitPrice)}`}</td>
                      )}
                      <td style={{ ...moneyStyle, fontWeight: 600 }}>${formatCurrency(b.revenue)}</td>
                    </tr>
                    {b.isFixedPrice && (
                      <tr>
                        <td colSpan={columnCount} style={{ padding: '0.1rem 0', color: 'var(--text-faint)', fontSize: '0.8125rem' }}>
                          Fixed price — not multiplied by count
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td colSpan={columnCount} style={sectionLabelStyle}>Our cost</td>
                    </tr>
                    <tr>
                      <td style={labelStyle}>
                        Materials {b.materialsFromTakeoff != null ? '(from Takeoffs)' : '(proportional)'}
                      </td>
                      {showPerUnit && <td style={moneyStyle}>${formatCurrency(perUnit(b.materialsBeforeTax))}</td>}
                      <td style={moneyStyle}>${formatCurrency(b.materialsBeforeTax)}</td>
                    </tr>
                    {b.taxAmount > 0 && (
                      <tr>
                        <td style={labelStyle}>Tax ({b.taxPercent}%)</td>
                        {showPerUnit && <td style={moneyStyle}>${formatCurrency(perUnit(b.taxAmount))}</td>}
                        <td style={moneyStyle}>${formatCurrency(b.taxAmount)}</td>
                      </tr>
                    )}
                    <tr>
                      <td style={{ ...labelStyle, paddingBottom: '0.45rem' }}>Labor</td>
                      {showPerUnit && (
                        <td style={{ ...moneyStyle, paddingBottom: '0.45rem' }}>${formatCurrency(perUnit(b.laborCost))}</td>
                      )}
                      <td style={{ ...moneyStyle, paddingBottom: '0.45rem' }}>${formatCurrency(b.laborCost)}</td>
                    </tr>
                    <tr>
                      <td style={subtotalLabelStyle}>Our cost</td>
                      {showPerUnit && <td style={subtotalMoneyStyle}>${formatCurrency(perUnit(b.cost))}</td>}
                      <td style={{ ...subtotalMoneyStyle, fontWeight: 600 }}>${formatCurrency(b.cost)}</td>
                    </tr>
                    <tr>
                      <td style={subtotalLabelStyle}>Profit</td>
                      {showPerUnit && (
                        <td style={{ ...subtotalMoneyStyle, color: profitColor }}>${formatCurrency(perUnit(profit))}</td>
                      )}
                      <td style={{ ...subtotalMoneyStyle, fontWeight: 600, color: profitColor }}>
                        ${formatCurrency(profit)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div
                  style={{
                    marginTop: '1rem',
                    padding: '0.6rem 0.9rem',
                    background: band.bg,
                    border: `1px solid ${band.border}`,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    color: band.text,
                  }}
                >
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                    Margin <span style={{ fontWeight: 400, fontSize: '0.75rem' }}>(Profit ÷ Revenue)</span>
                  </span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                    {marginPct != null ? `${marginPct.toFixed(1)}%` : '—'}
                  </span>
                </div>

                {uncosted && (
                  <p
                    style={{
                      margin: '1rem 0 0',
                      padding: '0.6rem 0.75rem',
                      background: 'var(--bg-amber-tint)',
                      border: '1px solid var(--border-amber-soft)',
                      borderRadius: 6,
                      fontSize: '0.8125rem',
                      color: 'var(--text-amber-800)',
                    }}
                  >
                    This fixture has no Takeoffs cost, so the grid shows “—” for its margin. The figures
                    above use only the costs entered so far — the real margin will be lower once you add this
                    fixture’s parts in Takeoffs.
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => setPricingBreakdownRow(null)}
                  style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', width: '100%' }}
                >
                  Close
                </button>
              </div>
            </div>
          )
        })()}
        {assignTakeoffRow && selectedBidForPricing && (
          <AssignTakeoffPartModal
            bidId={selectedBidForPricing.id}
            bidVersionId={selectedBidVersionId}
            serviceTypeId={selectedBidForPricing.service_type_id ?? selectedServiceTypeId}
            countRowId={assignTakeoffRow.countRowId}
            fixture={assignTakeoffRow.fixture}
            materialsModel={normalizeMaterialsModel(selectedBidForPricing.materials_model)}
            defaultQuantity={Number(pricingCountRows.find((r) => r.id === assignTakeoffRow.countRowId)?.count) || 1}
            onClose={() => setAssignTakeoffRow(null)}
            onAssigned={async () => {
              await reloadPricingForBid(selectedBidForPricing.id)
              setAssignTakeoffRow(null)
            }}
          />
        )}
        {!selectedBidForPricing && (
          <BidPickerStandardList
            bids={filteredBidsForPricing}
            prefixMap={ledgerPrefixMap}
            onSelectBid={onSelectBid}
            emptyMessage={pricingSearchQuery.trim() ? 'No bids match your search.' : null}
          />
        )}
        {wbBookDrawerOpen ? (() => {
          const drawerName = templatePriceBookVersions.find((t) => t.id === editingTemplateId)?.name ?? 'Price book'
          const defaultName = templatePriceBookVersions.find((t) => t.id === defaultPriceBookTemplateId)?.name ?? null
          const bookChipStyle = (on: boolean): CSSProperties => ({
            font: 'inherit',
            fontSize: '0.75rem',
            fontWeight: on ? 700 : 500,
            padding: '0.2rem 0.6rem',
            borderRadius: 6,
            border: on ? '1px solid #3b82f6' : '1px solid var(--border-strong)',
            background: on ? 'var(--bg-blue-tint)' : 'var(--bg-muted)',
            color: on ? 'var(--text-strong)' : 'var(--text-muted)',
            cursor: 'pointer',
          })
          const visibleEntries = templateEntries.filter((e) =>
            (e.fixture_types?.name ?? '').toLowerCase().includes(priceBookSearchQuery.toLowerCase()),
          )
          // v2.2444: the bid's OWN book — a frozen copy of a template that kept the template's
          // name. Naming it here is what stops "WENDI" in this drawer reading as "WENDI" on the bid.
          const bidBookName = priceBookVersions.find((v) => v.id === selectedPricingVersionId)?.name ?? null
          const cell: CSSProperties = { padding: '0.4rem 0.55rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid var(--border)' }
          return (
            <div
              role="dialog"
              aria-label="Price book"
              style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(430px, 92vw)', background: 'var(--surface)', borderLeft: '1px solid var(--border-strong)', boxShadow: '-14px 0 30px rgba(0,0,0,0.28)', zIndex: 70, padding: '1rem 1.1rem 1.2rem', overflowY: 'auto' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', marginBottom: '0.6rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Price book — {drawerName}</h3>
                <button type="button" onClick={() => setWbBookDrawerOpen(false)} aria-label="Close the price book" style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>✕</button>
              </div>
              {/* v2.2444 (Wendi): the book edit just made does NOT reach the bid on screen — its
                  copy is frozen. This is the door across, offered once, per edit, never automatic:
                  a sent bid must not re-price because someone tidied the book. */}
              {pendingBookOffer ? (
                <div role="status" style={{ border: '1px solid var(--border-amber)', background: 'var(--bg-amber-tint)', borderRadius: 8, padding: '0.55rem 0.65rem', marginBottom: '0.65rem' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-amber-700)', lineHeight: 1.4 }}>
                    {pendingBookOffer.offer.kind === 'update' ? (
                      <>
                        This bid still prices <strong>{pendingBookOffer.offer.fixtureName}</strong> at $
                        {formatCurrency(pendingBookOffer.offer.bidTotal)} — it holds its own copy of the book, taken when
                        the bid started.
                        {pendingBookOffer.siblingPricingCount > 0 ? (
                          <>
                            {' '}
                            {pendingBookOffer.siblingPricingCount} more price option
                            {pendingBookOffer.siblingPricingCount === 1 ? '' : 's'} on this bid hold
                            {pendingBookOffer.siblingPricingCount === 1 ? 's' : ''} the same $
                            {formatCurrency(pendingBookOffer.offer.bidTotal)} and will update with it.
                          </>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <strong>{pendingBookOffer.offer.fixtureName}</strong> isn&rsquo;t in this bid&rsquo;s copy of the
                        book, so it won&rsquo;t come up when you assign a row.
                      </>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.45rem' }}>
                    <button
                      type="button"
                      disabled={applyingBookOffer}
                      onClick={() => void applyPendingBookOffer()}
                      style={{ font: 'inherit', fontSize: '0.76rem', fontWeight: 700, padding: '0.26rem 0.7rem', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', cursor: applyingBookOffer ? 'wait' : 'pointer', opacity: applyingBookOffer ? 0.6 : 1 }}
                    >
                      {applyingBookOffer
                        ? 'Working…'
                        : pendingBookOffer.offer.kind === 'update'
                          ? `Use $${formatCurrency(pendingBookOffer.offer.bookTotal)} on this bid`
                          : 'Add it to this bid too'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingBookOffer(null)}
                      style={{ font: 'inherit', fontSize: '0.76rem', fontWeight: 600, padding: '0.26rem 0.6rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}
                    >
                      Leave this bid alone
                    </button>
                  </div>
                </div>
              ) : null}
              <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Book</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                {(wbBooksExpanded ? templatePriceBookVersions : templatePriceBookVersions.filter((t) => t.id === editingTemplateId)).map((t) => {
                  const on = t.id === editingTemplateId
                  const used = t.id === currentPriceBookTemplateId
                  return (
                    <span key={t.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}>
                      <button
                        type="button"
                        disabled={pricebookSwitchBusy}
                        // v2.2396 (Wendi): clicking a book only BROWSES it — switching the bid
                        // (which clones the book in) moved to the explicit Use button below.
                        title={used ? 'Feeding this bid' : `Look inside ${t.name} — the bid keeps its book until you press Use`}
                        onClick={() => {
                          if (on) return
                          selectPanelVersion(t.id)
                        }}
                        style={bookChipStyle(on)}
                      >
                        {used ? '\u2605 ' : ''}{t.name}
                      </button>
                      {on && wbBooksExpanded ? (
                        <button type="button" onClick={() => openEditPricingVersion(t)} title="Rename this book" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-muted)', padding: 0 }}>✎</button>
                      ) : null}
                    </span>
                  )
                })}
                <button
                  type="button"
                  onClick={() => setWbBooksExpanded((v) => !v)}
                  title={wbBooksExpanded ? 'Show just your book' : 'Show all price books'}
                  style={{ font: 'inherit', fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-link)', border: '1px dashed var(--border-strong)', background: 'none', borderRadius: 6, padding: '0.12rem 0.5rem', cursor: 'pointer' }}
                >
                  {wbBooksExpanded ? '\u2039' : '\u203a'}
                </button>
                {wbBooksExpanded ? (
                  <button type="button" onClick={openAddTemplate} style={{ marginLeft: 'auto', font: 'inherit', fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.55rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                    Add book
                  </button>
                ) : null}
              </div>
              {/* v2.2396 (Wendi): switching the bid's book is this explicit button, never a side
                  effect of clicking around — each press used to mint another price version. */}
              {editingTemplateId && editingTemplateId !== currentPriceBookTemplateId ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.35rem 0 0.55rem' }}>
                  <button
                    type="button"
                    disabled={pricebookSwitchBusy}
                    onClick={() => {
                      void (async () => {
                        await onSelectPriceBookTemplate(editingTemplateId)
                        setWbBooksExpanded(false)
                      })()
                    }}
                    title={`Price this bid from ${drawerName} — and make it your default for new bids`}
                    style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 700, padding: '0.3rem 0.8rem', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', cursor: pricebookSwitchBusy ? 'wait' : 'pointer', opacity: pricebookSwitchBusy ? 0.6 : 1 }}
                  >
                    {pricebookSwitchBusy ? 'Switching…' : `Use ${drawerName} on this bid`}
                  </button>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Browsing only — the bid still prices from its ★ book.</span>
                </div>
              ) : null}
              {defaultName ? (
                <div title="Per person — the book you pick follows you to your next bid" style={{ fontSize: '0.68rem', color: 'var(--text-green-700)', marginBottom: '0.6rem' }}>
                  Your default for new bids: <strong>{defaultName}</strong> ✓
                </div>
              ) : null}
              {/* v2.2444 (Wendi): said for EVERY book, not just one you're browsing away to. The
                  old caption appeared only when the selected book differed from the bid's — so on
                  the bid's own book, the case where you're most likely to edit and expect it to
                  take, nothing explained the freeze at all. */}
              {bidBookName ? (
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: '0.6rem' }}>
                  Edits here change the shared book. This bid prices from <strong>{bidBookName}</strong>, its own copy
                  taken when the bid started — it keeps its prices until you carry a change across.
                </div>
              ) : null}
              {/* v2.2386 (Wendi): Add entry rides beside the price-mode toggle — always visible, no scroll to the list's foot. */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.55rem' }}>
                <div style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 999, overflow: 'hidden' }}>
                  {(
                    [
                      ['combined', 'Combined price'],
                      ['stage', 'Stage price'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={wbPriceDisplayMode === key}
                      onClick={() => setWbPriceDisplayMode(key)}
                      style={{ font: 'inherit', fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.7rem', border: 'none', background: wbPriceDisplayMode === key ? 'var(--bg-blue-tint)' : 'var(--surface)', color: wbPriceDisplayMode === key ? 'var(--text-strong)' : 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={openNewPricingEntry}
                  disabled={!editingTemplateId}
                  style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '0.3rem 0.75rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                >
                  Add entry
                </button>
              </div>
              <input
                type="text"
                placeholder="Search fixture/tie-in name..."
                value={priceBookSearchQuery}
                onChange={(e) => setPriceBookSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '0.4rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, marginBottom: '0.5rem', boxSizing: 'border-box', fontSize: '0.8rem', background: 'var(--surface)', color: 'var(--text-strong)' }}
              />
              <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead style={{ background: 'var(--bg-subtle)' }}>
                    <tr>
                      <th style={{ ...cell, textAlign: 'left', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Fixture / Tie-in</th>
                      {wbPriceDisplayMode === 'combined' ? (
                        <th style={{ ...cell, fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Price</th>
                      ) : (
                        <>
                          <th style={{ ...cell, fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Rough In</th>
                          <th style={{ ...cell, fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Top Out</th>
                          <th style={{ ...cell, fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Trim Set</th>
                        </>
                      )}
                      <th style={{ ...cell, width: 34 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleEntries.map((entry) => (
                      <tr key={entry.id}>
                        <td style={{ ...cell, textAlign: 'left', fontWeight: 600 }} title={wbPriceDisplayMode === 'stage' ? `Combined: $${formatCurrency(Number(entry.total_price))}` : undefined}>
                          {entry.fixture_types?.name ?? ''}
                        </td>
                        {wbPriceDisplayMode === 'combined' ? (
                          <td style={cell}>${formatCurrency(Number(entry.total_price))}</td>
                        ) : (
                          <>
                            <td style={{ ...cell, color: Number(entry.rough_in_price) === 0 ? 'var(--text-faint)' : undefined }}>{Number(entry.rough_in_price) === 0 ? '—' : `$${formatCurrency(Number(entry.rough_in_price))}`}</td>
                            <td style={{ ...cell, color: Number(entry.top_out_price) === 0 ? 'var(--text-faint)' : undefined }}>{Number(entry.top_out_price) === 0 ? '—' : `$${formatCurrency(Number(entry.top_out_price))}`}</td>
                            <td style={{ ...cell, color: Number(entry.trim_set_price) === 0 ? 'var(--text-faint)' : undefined }}>{Number(entry.trim_set_price) === 0 ? '—' : `$${formatCurrency(Number(entry.trim_set_price))}`}</td>
                          </>
                        )}
                        <td style={cell}>
                          <button type="button" onClick={() => openEditPricingEntry(entry)} style={{ padding: '0.1rem', background: 'none', border: 'none', cursor: 'pointer' }} title="Edit">✎</button>
                        </td>
                      </tr>
                    ))}
                    {visibleEntries.length === 0 ? (
                      <tr>
                        <td colSpan={wbPriceDisplayMode === 'combined' ? 3 : 5} style={{ ...cell, textAlign: 'center', color: 'var(--text-muted)' }}>
                          {priceBookSearchQuery ? `No entries match “${priceBookSearchQuery}”` : 'No entries yet'}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <p style={{ margin: '0.6rem 0 0', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                A price added in Combined lands in <strong>Rough In</strong> — flip to Stage price to split it. Esc or ✕ closes.
              </p>
            </div>
          )
        })() : null}
        {pricingVersionFormOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 50,
            }}
            onClick={closePricingVersionForm}
          >
            <div
              style={{ background: 'var(--surface)', borderRadius: 8, padding: '1.5rem', minWidth: 320, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: '0 0 1rem' }}>{
                editingPricingVersion
                  ? (templatesMode ? 'Edit template name' : 'Edit pricing name')
                  : pricingFormMode === 'template' ? 'New template'
                  : pricingFormMode === 'pricing-clone' ? 'New pricing (copy)'
                  : 'New pricing'
              }</h3>
              <form onSubmit={savePricingVersion}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Name</label>
                <input
                  type="text"
                  value={pricingVersionNameInput}
                  onChange={(e) => setPricingVersionNameInput(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, marginBottom: '1rem', boxSizing: 'border-box' }}
                  placeholder="e.g. 2025 Standard"
                />
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
                  {editingPricingVersion && editingPricingVersion.name !== 'Default' ? (
                    <button
                      type="button"
                      onClick={() => openDeletePricingVersionModal(editingPricingVersion)}
                      style={{ padding: '0.5rem 1rem', background: 'var(--surface)', color: 'var(--text-red-700)', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer' }}
                    >
                      Delete version
                    </button>
                  ) : (
                    <span />
                  )}
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={closePricingVersionForm} style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                    <button type="submit" disabled={savingPricingVersion} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{savingPricingVersion ? 'Saving…' : 'Save'}</button>
                  </div>
                </div>
              </form>
            </div>
          </div>
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
            <div role="presentation" onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
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
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 50,
            }}
            onClick={() => {
              setDeletePricingVersionModalOpen(false)
              setPricingVersionToDelete(null)
              setDeletePricingVersionNameInput('')
              setDeletePricingVersionError(null)
            }}
          >
            <div
              style={{ background: 'var(--surface)', borderRadius: 8, padding: '1.5rem', minWidth: 360, maxWidth: '90vw', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: '0 0 0.75rem', color: 'var(--text-red-700)' }}>Delete price option</h3>
              <p style={{ margin: '0 0 0.75rem', color: 'var(--text-700)', fontSize: '0.9rem' }}>
                This will delete the price option <strong>{pricingVersionToDelete.name}</strong> and all entries
                it contains. A dev can put it back for 90 days from <strong>Settings → Data &amp; migration → Recently
                deleted</strong>.
              </p>
              <p style={{ margin: '0 0 0.5rem', color: 'var(--text-600)', fontSize: '0.875rem' }}>
                Type the name of this price to confirm:
              </p>
              <input
                type="text"
                value={deletePricingVersionNameInput}
                onChange={(e) => {
                  setDeletePricingVersionNameInput(e.target.value)
                  if (deletePricingVersionError) setDeletePricingVersionError(null)
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 4,
                  marginBottom: '0.5rem',
                  boxSizing: 'border-box',
                }}
                placeholder={pricingVersionToDelete.name}
              />
              {deletePricingVersionError && (
                <p style={{ margin: '0 0 0.5rem', color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
                  {deletePricingVersionError}
                </p>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setDeletePricingVersionModalOpen(false)
                    setPricingVersionToDelete(null)
                    setDeletePricingVersionNameInput('')
                    setDeletePricingVersionError(null)
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'var(--bg-muted)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeletePricingVersion}
                  disabled={!deletePricingVersionNameInput.trim()}
                  style={{
                    padding: '0.5rem 1rem',
                    background: deletePricingVersionNameInput.trim() ? '#b91c1c' : 'var(--bg-200)',
                    color: deletePricingVersionNameInput.trim() ? 'white' : 'var(--text-faint)',
                    border: 'none',
                    borderRadius: 4,
                    cursor: deletePricingVersionNameInput.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
        {pricingEntryFormOpen && panelVersionId && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              // Above the book drawer (70): its ✎/Add entry open this form, and on narrow
              // screens a lower z put the form behind the drawer (v2.2445).
              zIndex: 80,
            }}
            onClick={closePricingEntryForm}
          >
            <div
              style={{ background: 'var(--surface)', borderRadius: 8, padding: '1.5rem', minWidth: 360, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: '0 0 1rem' }}>{editingPricingEntry ? 'Edit entry' : 'New entry'}</h3>
              {error && (
                <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-red-100)', color: 'var(--text-red-800)', borderRadius: 4, fontSize: '0.875rem' }}>
                  {error}
                </div>
              )}
              <form onSubmit={savePricingEntry}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Fixture / Tie-in *</label>
                <input
                  type="text"
                  list="pricing-fixture-types"
                  value={pricingEntryFixtureName}
                  onChange={(e) => setPricingEntryFixtureName(e.target.value)}
                  required
                  placeholder="Type or select fixture type..."
                  autoComplete="off"
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, marginBottom: '0.75rem', boxSizing: 'border-box' }}
                />
                <datalist id="pricing-fixture-types">
                  {fixtureTypes.map(ft => (
                    <option key={ft.id} value={ft.name} />
                  ))}
                </datalist>
                {wbPriceDisplayMode === 'combined' ? (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Price</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.01}
                      value={pricingEntryCombinedPrice}
                      onChange={(e) => {
                        // Keep the raw string in the field — reformatting mid-typing moved the
                        // cursor and mangled entries like 21.00 → 2.01 (Wendi, v2.2644).
                        setPricingEntryCombinedPrice(e.target.value)
                        // Combined edits land in Rough In: RI absorbs the change so the total matches.
                        const v = parseFloat(e.target.value) || 0
                        const top = parseFloat(pricingEntryTopOut) || 0
                        const trim = parseFloat(pricingEntryTrimSet) || 0
                        setPricingEntryRoughIn(String(Math.max(0, Math.round((v - top - trim) * 100) / 100)))
                      }}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }}
                    />
                    <p style={{ margin: '0.3rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Lands in Rough In — switch the book to Stage price to split it across stages.
                    </p>
                  </div>
                ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Rough In</label>
                    <input type="number" inputMode="decimal" min={0} step={0.01} value={pricingEntryRoughIn} onChange={(e) => setPricingEntryRoughIn(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Top Out</label>
                    <input type="number" inputMode="decimal" min={0} step={0.01} value={pricingEntryTopOut} onChange={(e) => setPricingEntryTopOut(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Trim Set</label>
                    <input type="number" inputMode="decimal" min={0} step={0.01} value={pricingEntryTrimSet} onChange={(e) => setPricingEntryTrimSet(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Total (auto-calculated)</label>
                    <input type="number" min={0} step={0.01} value={pricingEntryTotal} readOnly style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box', background: 'var(--bg-subtle)', cursor: 'not-allowed' }} />
                  </div>
                </div>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    {editingPricingEntry && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (await deletePricingEntry(editingPricingEntry)) closePricingEntryForm()
                        }}
                        style={{ padding: '0.5rem 1rem', background: 'var(--bg-red-tint)', color: 'var(--text-red-800)', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer' }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="button" onClick={closePricingEntryForm} style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                    <button type="submit" disabled={savingPricingEntry} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{savingPricingEntry ? 'Saving…' : 'Save'}</button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      <GenerateUnitCostModal
        open={generateUnitCostModalParams != null}
        onClose={() => setGenerateUnitCostModalParams(null)}
        fixtureLabel={generateUnitCostModalParams?.fixtureLabel}
        totalRevenue={generateUnitCostModalParams?.totalRevenue ?? 0}
        currentRowRevenue={generateUnitCostModalParams?.currentRowRevenue ?? 0}
        currentPctOfTotal={generateUnitCostModalParams?.currentPctOfTotal ?? null}
        count={generateUnitCostModalParams?.count ?? 0}
        isFixedPrice={generateUnitCostModalParams?.isFixedPrice ?? false}
        onApply={async (price) => {
          const p = generateUnitCostModalParams
          if (!p) return
          await updateUnitPriceOverride(p.countRowId, price)
        }}
      />

      {addPriceOpen && selectedBidForPricing ? (() => {
        const gc = gcNameForVersion(selectedBidVersionId)
        const mine = priceBookVersions.filter((p) => (selectedBidVersionId ? p.bid_version_id === selectedBidVersionId : p.bid_version_id == null))
        const defaultName = `Alternate ${Math.max(1, mine.length)}`
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }} onClick={() => !wbCloning && setAddPriceOpen(null)}>
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
      {starChooser && selectedBidForPricing ? (() => {
        const starId = selectedBidForPricing.selected_price_book_version_id ?? null
        const starName = priceBookVersions.find((v) => v.id === starId)?.name ?? '—'
        const viewedName = priceBookVersions.find((v) => v.id === selectedPricingVersionId)?.name ?? '—'
        const verb = starChooser === 'share' ? 'Send' : starChooser === 'print' ? 'Print' : 'Export'
        const radio = (on: boolean): React.CSSProperties => ({ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', padding: '0.5rem 0.6rem', border: on ? '1px solid #3b82f6' : '1px solid var(--border)', background: on ? 'var(--bg-blue-tint)' : 'transparent', borderRadius: 8, cursor: 'pointer', marginTop: '0.35rem', font: 'inherit', color: 'inherit', width: '100%', textAlign: 'left' })
        return (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}
            onClick={() => !starBusy && setStarChooser(null)}
          >
            <div
              role="dialog"
              aria-label={`${verb} which price?`}
              style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '1rem 1.1rem', maxWidth: 460, width: '92%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: '0 0 0.2rem', fontSize: '1.02rem' }}>{verb} which price?</h3>
              <p style={{ margin: '0 0 0.6rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>You're viewing {viewedName}; the customer's price is ★ {starName}.</p>
              <button type="button" style={radio(starChoice === 'star')} onClick={() => setStarChoice('star')}>
                <input type="radio" readOnly checked={starChoice === 'star'} style={{ marginTop: '0.2rem' }} />
                <span><b style={{ display: 'block', fontSize: '0.9rem' }}>Customer's price — ★ {starName}</b><span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>What the Cover Letter and the bid value use.</span></span>
              </button>
              <button type="button" style={radio(starChoice === 'viewed')} onClick={() => setStarChoice('viewed')}>
                <input type="radio" readOnly checked={starChoice === 'viewed'} style={{ marginTop: '0.2rem' }} />
                <span><b style={{ display: 'block', fontSize: '0.9rem' }}>The one you're viewing — {viewedName}</b><span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>For a teammate to check. Not what the GC sees.</span></span>
              </button>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', marginTop: '0.8rem' }}>
                <button type="button" onClick={() => setStarChooser(null)} disabled={starBusy} style={{ font: 'inherit', fontSize: '0.85rem', padding: '0.4rem 0.8rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--bg-muted)', color: 'var(--text-strong)', cursor: 'pointer' }}>Cancel</button>
                <button type="button" onClick={() => void runStarAwareAction(starChooser, starChoice === 'star')} disabled={starBusy} style={{ font: 'inherit', fontSize: '0.85rem', padding: '0.4rem 0.9rem', border: 'none', borderRadius: 6, background: '#3b82f6', color: '#fff', cursor: starBusy ? 'wait' : 'pointer' }}>
                  {starBusy ? 'Loading…' : `${verb} ${starChoice === 'star' ? `★ ${starName}` : viewedName}`}
                </button>
              </div>
            </div>
          </div>
        )
      })() : null}

      <SpecSectionAuditModal open={d22AuditOpen} onClose={() => setD22AuditOpen(false)} />

      {selectedBidForPricing ? (
        <PrepareFixtureCopyModal
          open={prepareCopyOpen}
          onClose={() => setPrepareCopyOpen(false)}
          bidLabel={bidPackageLabel(selectedBidForPricing, ledgerPrefixMap)}
          rows={pricingCountRows.map((r) => ({ id: r.id, fixture: r.fixture, count: r.count, unit: r.unit }))}
          quoteLink={
            canPackageAndSendBidPricing
              ? { bidId: selectedBidForPricing.id, bidVersionId: selectedPricingVersionId ?? null }
              : undefined
          }
          onRfqMinted={() => setQuoteNonce((n) => n + 1)}
          onSendByEmail={
            canPackageAndSendBidPricing
              ? (scope) => {
                  setPrepareCopyOpen(false)
                  setComposeScope(scope)
                }
              : undefined
          }
        />
      ) : null}

      {selectedBidForPricing ? (
        <RfqDeskModal
          open={rfqDeskOpen}
          onClose={() => setRfqDeskOpen(false)}
          onCompare={() => {
            setRfqDeskOpen(false)
            setQuotesCompareOpen(true)
          }}
          onNewRequest={() => {
            setRfqDeskOpen(false)
            setPrepareCopyOpen(true)
          }}
          onChanged={() => setQuoteNonce((n) => n + 1)}
          bidId={selectedBidForPricing.id}
          bidLabel={bidPackageLabel(selectedBidForPricing, ledgerPrefixMap)}
          rows={pricingCountRows.map((r) => ({ id: r.id, fixture: r.fixture, count: r.count }))}
        />
      ) : null}

      {selectedBidForPricing && composeScope ? (
        <RfqComposeModal
          open={composeScope != null}
          onClose={() => setComposeScope(null)}
          onSent={() => {
            setQuoteNonce((n) => n + 1)
            setRfqDeskOpen(true)
          }}
          bidId={selectedBidForPricing.id}
          bidVersionId={selectedPricingVersionId ?? null}
          bidLabel={bidPackageLabel(selectedBidForPricing, ledgerPrefixMap)}
          scope={composeScope}
          openRfqHouseIds={openRfqHouseIds}
          plansLink={selectedBidForPricing.plans_link ?? null}
        />
      ) : null}

      {selectedBidForPricing ? (
        <PlugInQuotesModal
          open={plugInQuoteOpen}
          onClose={() => setPlugInQuoteOpen(false)}
          onSaved={() => {
            setQuoteNonce((n) => n + 1)
            setQuotesCompareOpen(true)
          }}
          bidId={selectedBidForPricing.id}
          bidVersionId={selectedPricingVersionId ?? null}
          bidLabel={bidPackageLabel(selectedBidForPricing, ledgerPrefixMap)}
          rows={pricingCountRows.map((r) => ({ id: r.id, fixture: r.fixture, count: r.count, unit: r.unit }))}
        />
      ) : null}

      {selectedBidForPricing ? (
        <QuoteCompareModal
          open={quotesCompareOpen}
          onClose={() => setQuotesCompareOpen(false)}
          onPlugIn={() => {
            setQuotesCompareOpen(false)
            setPlugInQuoteOpen(true)
          }}
          bidId={selectedBidForPricing.id}
          bidLabel={bidPackageLabel(selectedBidForPricing, ledgerPrefixMap)}
          rows={pricingCountRows.map((r) => ({ id: r.id, fixture: r.fixture, count: r.count }))}
          takeoffMaterialsByCountRowId={pricingFixtureMaterialsFromTakeoff}
          taxPercent={parseFloat(costEstimatePOModalTaxPercent || '8.25') || 0}
          currentTotals={(() => {
            const d = derivePricingWorkbench()
            return d ? { totalRevenue: d.totalRevenue, totalCost: d.totalCost } : null
          })()}
          onCostsApplied={() => {
            void reloadBidCustomCosts()
          }}
        />
      ) : null}

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
