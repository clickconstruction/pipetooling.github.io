import { useEffect, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/format'
import { formatDateYYMMDD, marginFlag } from '../../lib/bids/bidFormatting'
import { bidDetailCloseXStyle, bidDetailCloseFloatMobileStyle } from '../../lib/bids/bidStyles'
import { normalizeMaterialsModel, type MaterialsModel } from '../../lib/bids/bidTakeoffHelpers'
import { laborRowHours } from '../../lib/bids/laborRowHours'
import { nextSortOrder, pickActivePricing } from '../../lib/bids/pickActivePricing'
import { resolveCurrentPriceBookTemplateId } from '../../lib/bids/resolveCurrentPriceBookTemplateId'
import {
  computeTravelCost,
  costEstimateDrivingRate,
  costEstimateHoursPerTrip,
  costEstimateEstimatorCost,
  sumEquipmentRows,
} from '../../lib/bids/bidCostCalc'
import { BidWorkflowTabTitleWithPreview } from './BidWorkflowTabTitleWithPreview'
import { GenerateUnitCostModal, GenerateUnitCostTriggerIcon } from './GenerateUnitCostModal'
import { AssignTakeoffPartModal } from './AssignTakeoffPartModal'
import { BidProjectCell } from './BidProjectCell'
import { bidNumberMatchesQuery } from '../../lib/ledgerDisplayPrefixes'
import { MyBidsToggle } from './MyBidsToggle'
import { PackageAndSendBidPricingModal, type PackageAndSendPricingRowInput } from './PackageAndSendBidPricingModal'
import {
  printPricingPage as printPricingPageDoc,
  printAllPricingPages as printAllPricingPagesDoc,
  buildPricingCsvForBid,
  type PricingPrintContext,
} from '../../lib/bidDocuments/pricingPage'
import type { ComputeBidPricingRowsResult } from '../../lib/bidPricingRowCalculations'
import { useToastContext } from '../../contexts/ToastContext'
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
} from '../../lib/bids/bidPricingEngineTypes'

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
  selectedPricingVersionId: string | null
  setSelectedPricingVersionId: Dispatch<SetStateAction<string | null>>
  pricingCountRows: BidCountRow[]
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
  templatesMode: boolean
  setTemplatesMode: Dispatch<SetStateAction<boolean>>
  loadTemplatePriceBookVersions: () => Promise<void>
  /** Record `templateId` as this user's last-selected price book (their per-service-type default). */
  rememberLastPriceBookTemplate: (templateId: string) => void
  loadBidPricings: (bidId: string) => Promise<PriceBookVersion[]>
  loadPriceBookEntries: (versionId: string | null) => Promise<void>
  loadBidPricingAssignments: (bidId: string, versionId: string | null, signal?: AbortSignal) => Promise<void>
  reloadPricingForBid: (bidId: string, signal?: AbortSignal) => Promise<void>
  saveBidSelectedPriceBookVersion: (bidId: string, versionId: string | null) => Promise<void>
  openMaterialsModelSwitch: (next: MaterialsModel, sourceTab: 'takeoffs' | 'labor' | 'pricing') => void
  // Shared pricing-rows calc (from useBidPricingRows)
  pricingRowsForGrid: ComputeBidPricingRowsResult | null
  pricingPackageSource: { rows: PackageAndSendPricingRowInput[]; totalRevenue: number } | null
  // Callbacks
  onSelectBid: (bid: BidWithBuilder) => void
  onClose: () => void
  onEditBid: (bid: BidWithBuilder) => void
  onNavigateToLabor: () => void
  onNavigateBidToTab: (bid: BidWithBuilder, tab: 'takeoffs' | 'labor') => void
  onNavigateToLaborDirectCosts: (bid: BidWithBuilder) => void
  onlyMyBids: boolean
  setOnlyMyBids: (next: boolean) => void
  isMyBid: (bid: BidWithBuilder) => boolean
}

/** Shared style for the "Add pricing" dropdown menu items. */
const addPricingMenuItemStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '0.4rem 0.5rem',
  background: 'none',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: '0.875rem',
}

/** Margin flag → text color (replaces the old colored status circles). */
const MARGIN_FLAG_COLOR: Record<'red' | 'yellow' | 'green', string> = {
  red: '#dc2626',
  yellow: '#ca8a04',
  green: '#16a34a',
}

/** Self-contained payload for the per-line breakdown modal (Revenue → Cost → Margin). */
type PricingBreakdownRow = {
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
  selectedPricingVersionId,
  setSelectedPricingVersionId,
  pricingCountRows,
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
  templatesMode,
  setTemplatesMode,
  loadTemplatePriceBookVersions,
  rememberLastPriceBookTemplate,
  loadBidPricings,
  loadPriceBookEntries,
  loadBidPricingAssignments,
  reloadPricingForBid,
  saveBidSelectedPriceBookVersion,
  pricingRowsForGrid,
  pricingPackageSource,
  onSelectBid,
  onClose,
  onEditBid,
  onNavigateToLabor,
  onNavigateBidToTab,
  onNavigateToLaborDirectCosts,
  onlyMyBids,
  setOnlyMyBids,
  isMyBid,
}: BidsPricingTabProps) {
  const { showToast } = useToastContext()

  const [pricingSearchQuery, setPricingSearchQuery] = useState('')
  const [priceBookSectionOpen, setPriceBookSectionOpen] = useState(false)
  const [pricingVersionFormOpen, setPricingVersionFormOpen] = useState(false)
  const [editingPricingVersion, setEditingPricingVersion] = useState<PriceBookVersion | null>(null)
  const [pricingVersionNameInput, setPricingVersionNameInput] = useState('')
  const [savingPricingVersion, setSavingPricingVersion] = useState(false)
  const [pricingEntryFormOpen, setPricingEntryFormOpen] = useState(false)
  const [editingPricingEntry, setEditingPricingEntry] = useState<PriceBookEntryWithFixture | null>(null)
  const [pricingEntryFixtureName, setPricingEntryFixtureName] = useState('')
  const [pricingEntryRoughIn, setPricingEntryRoughIn] = useState('')
  const [pricingEntryTopOut, setPricingEntryTopOut] = useState('')
  const [pricingEntryTrimSet, setPricingEntryTrimSet] = useState('')
  const [pricingEntryTotal, setPricingEntryTotal] = useState('')
  const [savingPricingEntry, setSavingPricingEntry] = useState(false)
  const [savingPricingAssignment, setSavingPricingAssignment] = useState<string | null>(null)
  const [deletePricingVersionModalOpen, setDeletePricingVersionModalOpen] = useState(false)
  const [pricingVersionToDelete, setPricingVersionToDelete] = useState<PriceBookVersion | null>(null)
  const [deletePricingVersionNameInput, setDeletePricingVersionNameInput] = useState('')
  const [deletePricingVersionError, setDeletePricingVersionError] = useState<string | null>(null)
  const [priceBookSearchQuery, setPriceBookSearchQuery] = useState('')
  // --- Bid Pricings vs Templates panel state ---
  // In Templates mode the panel edits the shared master catalog; `editingTemplateId` +
  // `templateEntries` keep that editing fully separate from the bid's active Pricing
  // (`selectedPricingVersionId` / `priceBookEntries`), which still drives the grid.
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [templateEntries, setTemplateEntries] = useState<PriceBookEntryWithFixture[]>([])
  // What kind of version the version-form modal is creating.
  const [pricingFormMode, setPricingFormMode] = useState<'template' | 'pricing-blank' | 'pricing-clone'>('pricing-blank')
  const [pricingCloneSourceId, setPricingCloneSourceId] = useState<string | null>(null)
  const [addPricingMenuOpen, setAddPricingMenuOpen] = useState(false)
  const [pricingAssignmentSearches, setPricingAssignmentSearches] = useState<Record<string, string>>({})
  const [pricingAssignmentDropdownOpen, setPricingAssignmentDropdownOpen] = useState<string | null>(null)
  const [pricingBreakdownRow, setPricingBreakdownRow] = useState<PricingBreakdownRow | null>(null)
  const [assignTakeoffRow, setAssignTakeoffRow] = useState<{ countRowId: string; fixture: string } | null>(null)
  const [pricingViewModel, setPricingViewModel] = useState<'cost' | 'price'>('price')
  // Disables the toolbar price-book dropdown while a clone/switch is in flight (avoids double-submit).
  const [pricebookSwitchBusy, setPricebookSwitchBusy] = useState(false)
  const [unitPriceEditValues, setUnitPriceEditValues] = useState<Record<string, string>>({})
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
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [pricingAssignmentDropdownOpen, addPricingMenuOpen])

  // --- Bid Pricings vs Templates panel ---
  // The Price Book panel can show either the bid's Pricings or the shared template catalog.
  // `panel*` resolve to whichever the "Templates" toggle is on. Template editing uses its own
  // `editingTemplateId` / `templateEntries` so it never disturbs the bid's active Pricing
  // (`selectedPricingVersionId` / `priceBookEntries`), which still drives the grid + cover letter.
  const panelVersions = templatesMode ? templatePriceBookVersions : priceBookVersions
  const panelVersionId = templatesMode ? editingTemplateId : selectedPricingVersionId
  const panelEntries = templatesMode ? templateEntries : priceBookEntries
  // In pricings mode the panel edits the ACTIVE version's pricing. It's editable only when that
  // pricing is bid-owned (not a shared template surfaced via the legacy fallback, and not absent).
  const activeBidPricing = priceBookVersions.find((p) => p.id === selectedPricingVersionId) ?? null
  const isBidOwnedPricing = activeBidPricing != null
  const canEditPanelEntries = templatesMode ? !!editingTemplateId : isBidOwnedPricing
  // Which shared template the toolbar price-book dropdown shows as "current" for this bid.
  const currentPriceBookTemplateId = resolveCurrentPriceBookTemplateId({
    selectedPricingVersionId,
    bidPricings: priceBookVersions,
    templateIds: templatePriceBookVersions.map((t) => t.id),
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
  function openAddBlankPricing() {
    setEditingPricingVersion(null)
    setPricingFormMode('pricing-blank')
    setPricingCloneSourceId(null)
    setPricingVersionNameInput('')
    setError(null)
    setAddPricingMenuOpen(false)
    setPricingVersionFormOpen(true)
  }
  function openClonePricing(sourceId: string, suggestedName: string) {
    setEditingPricingVersion(null)
    setPricingFormMode('pricing-clone')
    setPricingCloneSourceId(sourceId)
    setPricingVersionNameInput(suggestedName)
    setError(null)
    setAddPricingMenuOpen(false)
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
    setSavingPricingAssignment(countRowId)
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
    setSavingPricingAssignment(null)
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

  async function togglePricingAssignmentFixedPrice(countRowId: string) {
    const bidId = selectedBidForPricing?.id
    const versionId = selectedPricingVersionId
    if (!bidId || !versionId) return

    const existing = bidPricingAssignments.find(
      (a) => a.count_row_id === countRowId && a.price_book_version_id === versionId
    )
    if (!existing) return

    const { error: err } = await supabase
      .from('bid_pricing_assignments')
      .update({ is_fixed_price: !existing.is_fixed_price })
      .eq('id', existing.id)

    if (err) setError(err.message)
    else await loadBidPricingAssignments(bidId, versionId)
  }

  async function togglePricingRowOmitFromSubmission(countRowId: string) {
    const bidId = selectedBidForPricing?.id
    const versionId = selectedPricingVersionId
    if (!bidId || !versionId) return
    const existingHide = bidCountRowSubmissionHides.find(
      (h) => h.count_row_id === countRowId && h.price_book_version_id === versionId,
    )
    setSavingPricingAssignment(countRowId)
    try {
      if (existingHide) {
        const { error: err } = await supabase
          .from('bid_count_row_submission_hides')
          .delete()
          .eq('bid_id', bidId)
          .eq('count_row_id', countRowId)
          .eq('price_book_version_id', versionId)
        if (err) setError(err.message)
        else await loadBidPricingAssignments(bidId, versionId)
      } else {
        const { error: err } = await supabase.from('bid_count_row_submission_hides').insert({
          bid_id: bidId,
          count_row_id: countRowId,
          price_book_version_id: versionId,
        })
        if (err) setError(err.message)
        else await loadBidPricingAssignments(bidId, versionId)
      }
    } finally {
      setSavingPricingAssignment(null)
    }
  }

  async function updateUnitPriceOverride(countRowId: string, value: number | null) {
    const bidId = selectedBidForPricing?.id
    const versionId = selectedPricingVersionId
    if (!bidId || !versionId) return
    const existing = bidPricingAssignments.find((a) => a.count_row_id === countRowId && a.price_book_version_id === versionId)
    const entry = resolvePricingEntryForCountRow(countRowId)
    const existingCustom = bidCountRowCustomPrices.find((c) => c.count_row_id === countRowId && c.price_book_version_id === versionId)

    setSavingUnitPriceOverride(countRowId)
    let err: { message: string } | null = null

    if (existing) {
      const res = await supabase.from('bid_pricing_assignments').update({ unit_price_override: value }).eq('id', existing.id)
      err = res.error
      if (!err && existingCustom) {
        await supabase.from('bid_count_row_custom_prices').delete().eq('id', existingCustom.id)
      }
    } else if (entry) {
      const res = await supabase.from('bid_pricing_assignments').insert({
        bid_id: bidId,
        count_row_id: countRowId,
        price_book_entry_id: entry.id,
        price_book_version_id: versionId,
        unit_price_override: value,
      })
      err = res.error
      if (!err && existingCustom) {
        await supabase.from('bid_count_row_custom_prices').delete().eq('id', existingCustom.id)
      }
    } else {
      if (value == null) {
        if (existingCustom) {
          const res = await supabase.from('bid_count_row_custom_prices').delete().eq('id', existingCustom.id)
          err = res.error
        }
      } else {
        const res = existingCustom
          ? await supabase.from('bid_count_row_custom_prices').update({ unit_price: value }).eq('id', existingCustom.id)
          : await supabase.from('bid_count_row_custom_prices').insert({ bid_id: bidId, count_row_id: countRowId, price_book_version_id: versionId, unit_price: value })
        err = res.error
      }
    }

    if (err) setError(err.message)
    else await loadBidPricingAssignments(bidId, versionId)
    setSavingUnitPriceOverride(null)
    setUnitPriceEditValues((prev) => {
      const next = { ...prev }
      delete next[countRowId]
      return next
    })
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
      setDeletePricingVersionError('Name does not match. Type the version name exactly to confirm.')
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
      const remaining = selectedBidForPricing ? await loadBidPricings(selectedBidForPricing.id) : []
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
    setError(null)
    setPricingEntryFormOpen(true)
  }

  function openEditPricingEntry(entry: PriceBookEntryWithFixture) {
    setEditingPricingEntry(entry)
    setPricingEntryFixtureName(entry.fixture_types?.name ?? '')
    setPricingEntryRoughIn(String(entry.rough_in_price))
    setPricingEntryTopOut(String(entry.top_out_price))
    setPricingEntryTrimSet(String(entry.trim_set_price))
    setPricingEntryTotal(String(entry.total_price))
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
    setError(null)
  }

  async function savePricingEntry(e: React.FormEvent) {
    e.preventDefault()
    if (!panelVersionId) {
      setError(templatesMode ? 'No template selected' : 'No pricing selected')
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
        closePricingEntryForm()
      }
    } else {
      const maxSeq = panelEntries.length === 0 ? 0 : Math.max(...panelEntries.map((e) => e.sequence_order))
      const { error: err } = await supabase
        .from('price_book_entries')
        .insert({ version_id: panelVersionId, fixture_type_id: fixtureTypeId, rough_in_price: rough, top_out_price: top, trim_set_price: trim, total_price: total, sequence_order: maxSeq + 1 })
      if (err) setError(err.message)
      else {
        await reloadPanelEntries()
        closePricingEntryForm()
      }
    }
    setSavingPricingEntry(false)
  }

  async function deletePricingEntry(entry: PriceBookEntryWithFixture) {
    if (!confirm(`Delete "${entry.fixture_types?.name ?? ''}" from this ${templatesMode ? 'price book' : 'pricing'}?`)) return
    const { error: err } = await supabase.from('price_book_entries').delete().eq('id', entry.id)
    if (err) setError(err.message)
    else await reloadPanelEntries()
  }

  async function handlePricingVersionChange(bidId: string, versionId: string) {
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
      const existing = priceBookVersions.find(
        (p) =>
          p.source_version_id === templateId &&
          (selectedBidVersionId ? p.bid_version_id === selectedBidVersionId : p.bid_version_id == null),
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
      viewModel: pricingViewModel,
      assignments: bidPricingAssignments,
      customPrices: bidCountRowCustomPrices,
      submissionHides: bidCountRowSubmissionHides,
      taxPercent: parseFloat(costEstimatePOModalTaxPercent || '8.25') || 0,
    }
  }

  function printPricingPage() {
    const ctx = buildPricingPrintContext()
    if (!ctx) return
    printPricingPageDoc(ctx)
  }

  function downloadPricingCsv() {
    const ctx = buildPricingPrintContext()
    if (!ctx) return
    const teamLaborCostByBidId = new Map(teamLaborDataForBids.map((r) => [r.bidId, r.bidCost]))
    const teamLaborCost = teamLaborCostByBidId.get(ctx.bid.id) ?? 0
    const result = buildPricingCsvForBid(ctx, teamLaborCost)
    if (!result) {
      showToast('Select a price book version and ensure Counts and Labor are set up.', 'info')
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

  return (
    <>
      <div>
        {!selectedBidForPricing && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
            <input
              type="text"
              placeholder="Search bids (bid #, project name, or GC/Builder)..."
              value={pricingSearchQuery}
              onChange={(e) => setPricingSearchQuery(e.target.value)}
              style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }}
            />
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
              <BidWorkflowTabTitleWithPreview
                bid={selectedBidForPricing}
                previewEnabled={bidPreview != null}
                onOpenPreview={() => bidPreview?.openBidPreviewFromBid(selectedBidForPricing)}
                h2Style={{ margin: 0, flex: '0 0 auto' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '0 0 auto' }}>
                {canPackageAndSendBidPricing ? (
                  <button
                    type="button"
                    onClick={() => setPackageSendOpen(true)}
                    disabled={!selectedPricingVersionId || pricingCountRows.length === 0 || !pricingCostEstimate}
                    title={
                      !selectedPricingVersionId || pricingCountRows.length === 0 || !pricingCostEstimate
                        ? 'Select a price book and ensure Counts and Labor exist'
                        : 'Share pricing (Job Plans + 4-column table) with a teammate'
                    }
                    style={{
                      padding: '0.5rem 1rem',
                      background:
                        !selectedPricingVersionId || pricingCountRows.length === 0 || !pricingCostEstimate ? 'var(--bg-200)' : '#16a34a',
                      color:
                        !selectedPricingVersionId || pricingCountRows.length === 0 || !pricingCostEstimate ? 'var(--text-faint)' : 'white',
                      border: 'none',
                      borderRadius: 4,
                      cursor:
                        !selectedPricingVersionId || pricingCountRows.length === 0 || !pricingCostEstimate ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Share
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => downloadPricingCsv()}
                  disabled={!selectedPricingVersionId || pricingCountRows.length === 0 || !pricingCostEstimate}
                  title={
                    !selectedPricingVersionId || pricingCountRows.length === 0 || !pricingCostEstimate
                      ? 'Select a price book and ensure Counts and Labor exist'
                      : 'Download pricing grid as CSV'
                  }
                  style={{
                    padding: '0.5rem 1rem',
                    background:
                      !selectedPricingVersionId || pricingCountRows.length === 0 || !pricingCostEstimate ? 'var(--bg-200)' : 'var(--bg-muted)',
                    color: 'var(--text-strong)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 4,
                    cursor:
                      !selectedPricingVersionId || pricingCountRows.length === 0 || !pricingCostEstimate ? 'not-allowed' : 'pointer',
                  }}
                >
                  CSV
                </button>
                <button
                  type="button"
                  onClick={() => printPricingPage()}
                  style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                >
                  Print
                </button>
                <button
                  type="button"
                  onClick={() => void printAllPricingPages()}
                  style={{ padding: '0.5rem 1rem', background: '#f97316', color: 'black', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Review
                </button>
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
                {selectedPricingVersionId && pricingCountRows.length > 0 && pricingCostEstimate ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flex: '0 0 auto', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, marginRight: '0.25rem' }}>View:</span>
                    <button
                      type="button"
                      onClick={() => setPricingViewModel('cost')}
                      style={{
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.8125rem',
                        border: '1px solid var(--border-strong)',
                        borderRadius: 4,
                        background: pricingViewModel === 'cost' ? 'var(--bg-200)' : 'var(--surface)',
                        cursor: 'pointer',
                        fontWeight: pricingViewModel === 'cost' ? 600 : 400,
                        color: pricingViewModel === 'cost' ? 'var(--text-strong)' : 'var(--text-muted)',
                        boxShadow: pricingViewModel === 'cost' ? '0 0 0 2px #374151' : 'none',
                      }}
                    >
                      Cost Model
                    </button>
                    <button
                      type="button"
                      onClick={() => setPricingViewModel('price')}
                      style={{
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.8125rem',
                        border: '1px solid var(--border-strong)',
                        borderRadius: 4,
                        background: pricingViewModel === 'price' ? 'var(--bg-200)' : 'var(--surface)',
                        cursor: 'pointer',
                        fontWeight: pricingViewModel === 'price' ? 600 : 400,
                        color: pricingViewModel === 'price' ? 'var(--text-strong)' : 'var(--text-muted)',
                        boxShadow: pricingViewModel === 'price' ? '0 0 0 2px #374151' : 'none',
                      }}
                    >
                      Price Model
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            {/* Price book selector (left) + partial-fill (right), styled like the Labor/Takeoffs tabs. */}
            <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              {/* Price-book picker: clone the chosen template into this bid as an editable copy. */}
              {selectedBidForPricing ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <label htmlFor="pricing-pricebook-select" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                    Price book:
                  </label>
                  <select
                    id="pricing-pricebook-select"
                    value={currentPriceBookTemplateId ?? ''}
                    disabled={pricebookSwitchBusy || templatePriceBookVersions.length === 0}
                    onChange={(e) => {
                      if (e.target.value) void onSelectPriceBookTemplate(e.target.value)
                    }}
                    style={{ padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', background: 'var(--surface)', cursor: 'pointer' }}
                  >
                    {currentPriceBookTemplateId == null ? <option value="">Select a price book…</option> : null}
                    {templatePriceBookVersions.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div />
              )}
              {selectedPricingVersionId && pricingCountRows.length > 0 && pricingCostEstimate && (
                <button
                  type="button"
                  onClick={() => {
                    setPricingAssignmentSearches((prev) => {
                      const next = { ...prev }
                      for (const cr of pricingCountRows) {
                        next[cr.id] = (cr.fixture ?? '').slice(0, 3)
                      }
                      return next
                    })
                  }}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.875rem',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                  title="Pre-fill each fixture's search box to find matching price book entries"
                >
                  Apply Matching Price Book Entries
                </button>
              )}
            </div>
            {!pricingCostEstimate && pricingCountRows.length > 0 && (
              <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                Add fixtures in Counts and set up Labor first to see margin comparison.{' '}
                <button
                  type="button"
                  onClick={() => onNavigateToLabor()}
                  style={{ padding: '0.25rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  Go to Labor
                </button>
              </p>
            )}
            {selectedPricingVersionId && pricingCountRows.length > 0 && pricingCostEstimate && (() => {
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
              return (
                <>
                <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'visible' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'var(--bg-subtle)' }}>
                      <tr>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Fixture or Tie-in</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>Count</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Price book entry</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>{pricingViewModel === 'cost' ? 'Our cost' : 'Sale Price'}</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Revenue</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>Margin/Total</th>
                        <th style={{ width: 0, padding: 0, borderBottom: '1px solid var(--border)' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.countRow.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.75rem' }}>{row.countRow.fixture ?? ''}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>{row.count}</td>
                          <td style={{ padding: '0.75rem', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ position: 'relative' }} data-pricing-assignment-dropdown>
                              <input
                                type="text"
                                value={pricingAssignmentSearches[row.countRow.id] !== undefined 
                                  ? pricingAssignmentSearches[row.countRow.id] 
                                  : (row.entry?.fixture_types?.name ?? '')}
                                onChange={(e) => {
                                  setPricingAssignmentSearches((prev) => ({ ...prev, [row.countRow.id]: e.target.value }))
                                  setPricingAssignmentDropdownOpen(row.countRow.id)
                                }}
                                onFocus={() => setPricingAssignmentDropdownOpen(row.countRow.id)}
                                placeholder="Search or assign..."
                                disabled={savingPricingAssignment === row.countRow.id}
                                style={{ 
                                  width: '100%',
                                  padding: '0.35rem', 
                                  border: '1px solid var(--border-strong)', 
                                  borderRadius: 4, 
                                  minWidth: '10rem',
                                  boxSizing: 'border-box',
                                  paddingRight: row.entry ? '5rem' : '0.35rem'
                                }}
                              />
                              {row.entry && (
                                <>
                                  <label
                                    style={{
                                      position: 'absolute',
                                      right: '2rem',
                                      top: '50%',
                                      transform: 'translateY(-50%)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.25rem',
                                      fontSize: '0.75rem',
                                      color: 'var(--text-muted)',
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap'
                                    }}
                                    title="Fixed price: don't multiply by count"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={row.assignment?.is_fixed_price ?? false}
                                      onChange={() => togglePricingAssignmentFixedPrice(row.countRow.id)}
                                      style={{ cursor: 'pointer' }}
                                    />
                                    Fixed
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      removePricingAssignment(row.countRow.id)
                                      setPricingAssignmentSearches((prev) => {
                                        const next = { ...prev }
                                        delete next[row.countRow.id]
                                        return next
                                      })
                                    }}
                                    style={{
                                      position: 'absolute',
                                      right: '0.5rem',
                                      top: '50%',
                                      transform: 'translateY(-50%)',
                                      background: 'none',
                                      border: 'none',
                                      cursor: 'pointer',
                                      color: 'var(--text-muted)',
                                      fontSize: '1.25rem',
                                      lineHeight: 1,
                                      padding: 0
                                    }}
                                    title="Clear assignment"
                                  >
                                    ×
                                  </button>
                                </>
                              )}
                              {pricingAssignmentDropdownOpen === row.countRow.id && (() => {
                                const searchTerm = pricingAssignmentSearches[row.countRow.id] || ''
                                const filtered = priceBookEntries.filter((e) => 
                                  (e.fixture_types?.name ?? '').toLowerCase().includes(searchTerm.toLowerCase())
                                )
                                return (
                                  <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    background: 'var(--surface)',
                                    border: '1px solid var(--border-strong)',
                                    borderRadius: 4,
                                    marginTop: '0.25rem',
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                    zIndex: 10,
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                  }}>
                                    {filtered.length > 0 ? (
                                      filtered.map((e) => (
                                        <div
                                          key={e.id}
                                          onClick={() => {
                                            savePricingAssignment(row.countRow.id, e.id)
                                            setPricingAssignmentSearches((prev) => {
                                              const next = { ...prev }
                                              delete next[row.countRow.id]
                                              return next
                                            })
                                            setPricingAssignmentDropdownOpen(null)
                                          }}
                                          style={{
                                            padding: '0.5rem',
                                            cursor: 'pointer',
                                            borderBottom: '1px solid #f3f4f6',
                                            background: row.entry?.id === e.id ? 'var(--bg-blue-tint)' : 'var(--surface)'
                                          }}
                                          onMouseEnter={(ev) => { ev.currentTarget.style.background = 'var(--bg-subtle)' }}
                                          onMouseLeave={(ev) => { ev.currentTarget.style.background = row.entry?.id === e.id ? '#eff6ff' : 'white' }}
                                        >
                                          {e.fixture_types?.name ?? ''}
                                        </div>
                                      ))
                                    ) : searchTerm ? (
                                      <div style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        No matches for "{searchTerm}"
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingPricingEntry(null)
                                            setPricingEntryFixtureName(searchTerm)
                                            setPricingEntryRoughIn('')
                                            setPricingEntryTopOut('')
                                            setPricingEntryTrimSet('')
                                            setPricingEntryTotal('')
                                            setPricingEntryFormOpen(true)
                                            setPricingAssignmentDropdownOpen(null)
                                          }}
                                          style={{
                                            display: 'block',
                                            margin: '0.5rem auto 0',
                                            padding: '0.5rem 1rem',
                                            background: '#3b82f6',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 4,
                                            cursor: 'pointer',
                                            fontSize: '0.875rem'
                                          }}
                                        >
                                          Add "{searchTerm}" to Price Book
                                        </button>
                                      </div>
                                    ) : (
                                      <div style={{ padding: '0.5rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                                        Start typing to search...
                                      </div>
                                    )}
                                  </div>
                                )
                              })()}
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                            {pricingViewModel === 'cost' ? (
                              `$${formatCurrency(row.cost)}`
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-end' }}>
                                {(() => {
                                  const unitCostDisplayStr =
                                    unitPriceEditValues[row.countRow.id] ??
                                    (row.unitPrice > 0 ? formatCurrency(row.unitPrice) : '')
                                  const showGenerateUnitCostIcon =
                                    unitCostDisplayStr.trim() === '' &&
                                    savingUnitPriceOverride !== row.countRow.id
                                  return (
                                    <div style={{ position: 'relative', display: 'inline-block' }}>
                                      {showGenerateUnitCostIcon ?
                                        <button
                                          type="button"
                                          aria-label="Line share of total percent"
                                          title="Set unit from line share of current bid total (percent)"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setGenerateUnitCostModalParams({
                                              countRowId: row.countRow.id,
                                              totalRevenue,
                                              currentRowRevenue: row.revenue,
                                              currentPctOfTotal: row.pctOfGrandTotal,
                                              count: row.count,
                                              isFixedPrice: row.isFixedPrice,
                                              fixtureLabel: row.countRow.fixture ?? '',
                                            })
                                          }}
                                          onMouseDown={(e) => e.stopPropagation()}
                                          style={{
                                            position: 'absolute',
                                            left: 4,
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            padding: 0,
                                            margin: 0,
                                            border: 'none',
                                            background: 'transparent',
                                            cursor: 'pointer',
                                            color: 'var(--text-muted)',
                                            lineHeight: 0,
                                            zIndex: 1,
                                          }}
                                        >
                                          <GenerateUnitCostTriggerIcon />
                                        </button>
                                      : null}
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        value={unitCostDisplayStr}
                                        onFocus={() => {
                                          if (unitPriceEditValues[row.countRow.id] == null) {
                                            setUnitPriceEditValues((prev) => ({
                                              ...prev,
                                              [row.countRow.id]: row.unitPrice > 0 ? row.unitPrice.toFixed(2) : '',
                                            }))
                                          }
                                        }}
                                        onChange={(e) =>
                                          setUnitPriceEditValues((prev) => ({
                                            ...prev,
                                            [row.countRow.id]: e.target.value,
                                          }))
                                        }
                                        onBlur={() => {
                                          const raw = (
                                            unitPriceEditValues[row.countRow.id] ?? String(row.unitPrice)
                                          ).replace(/,/g, '')
                                          const v = parseFloat(raw)
                                          const bookPrice = row.entry ? Number(row.entry.total_price) : 0
                                          if (raw.trim() === '' || isNaN(v)) {
                                            updateUnitPriceOverride(row.countRow.id, null)
                                          } else if (row.entry && Math.abs(v - bookPrice) <= 0.001) {
                                            updateUnitPriceOverride(row.countRow.id, null)
                                          } else {
                                            updateUnitPriceOverride(row.countRow.id, v)
                                          }
                                        }}
                                        disabled={savingUnitPriceOverride === row.countRow.id}
                                        placeholder={
                                          row.entry ? `$${formatCurrency(row.entry.total_price)}` : '—'
                                        }
                                        style={{
                                          width: '7rem',
                                          paddingTop: '0.35rem',
                                          paddingBottom: '0.35rem',
                                          paddingRight: '0.5rem',
                                          paddingLeft: showGenerateUnitCostIcon ? '1.6rem' : '0.5rem',
                                          border: '1px solid var(--border-strong)',
                                          borderRadius: 4,
                                          textAlign: 'right',
                                          background:
                                            row.assignment?.unit_price_override != null || row.customPrice != null ?
                                              '#fef9c3'
                                            : 'var(--surface)',
                                          fontSize: '0.875rem',
                                        }}
                                      />
                                    </div>
                                  )
                                })()}
                                {(row.assignment?.unit_price_override != null || row.customPrice != null) && (
                                  <button
                                    type="button"
                                    onClick={() => updateUnitPriceOverride(row.countRow.id, null)}
                                    title={row.assignment ? 'Reset to price book' : 'Clear custom price'}
                                    aria-label={row.assignment ? 'Reset to price book' : 'Clear custom price'}
                                    disabled={savingUnitPriceOverride === row.countRow.id}
                                    style={{
                                      padding: '0.15rem',
                                      background: 'none',
                                      border: 'none',
                                      cursor:
                                        savingUnitPriceOverride === row.countRow.id ?
                                          'not-allowed'
                                        : 'pointer',
                                      color: 'var(--text-muted)',
                                      fontSize: '0.75rem',
                                    }}
                                  >
                                    Reset
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                          <td
                            style={{ padding: '0.75rem', textAlign: 'right', cursor: 'pointer' }}
                            role="button"
                            tabIndex={0}
                            title="Revenue, cost & margin breakdown"
                            onClick={(e) => {
                              e.stopPropagation()
                              openRowBreakdown(row)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                openRowBreakdown(row)
                              }
                            }}
                          >
                            ${formatCurrency(row.revenue)}
                          </td>
                          <td
                            style={{ padding: '0.75rem', textAlign: 'center' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                                {row.materialsFromTakeoff == null || row.materialsFromTakeoff === 0 ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setAssignTakeoffRow({ countRowId: row.countRow.id, fixture: row.countRow.fixture ?? '' })
                                    }}
                                    title="No Takeoffs cost yet — assign a part or assembly"
                                    aria-label="No Takeoffs cost yet — assign a part or assembly"
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      background: 'none',
                                      border: 'none',
                                      padding: 0,
                                      margin: 0,
                                      color: 'var(--text-red-600)',
                                      cursor: 'pointer',
                                      lineHeight: 0,
                                    }}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} aria-hidden focusable="false">
                                      <path
                                        fill="currentColor"
                                        d="M102.8 57.3C108.2 51.9 116.6 51.1 123 55.3L241.9 134.5C250.8 140.4 256.1 150.4 256.1 161.1L256.1 210.7L346.9 301.5C380.2 286.5 420.8 292.6 448.1 320L574.2 446.1C592.9 464.8 592.9 495.2 574.2 514L514.1 574.1C495.4 592.8 465 592.8 446.2 574.1L320.1 448C292.7 420.6 286.6 380.1 301.6 346.8L210.8 256L161.2 256C150.5 256 140.5 250.7 134.6 241.8L55.4 122.9C51.2 116.6 52 108.1 57.4 102.7L102.8 57.3zM247.8 360.8C241.5 397.7 250.1 436.7 274 468L179.1 563C151 591.1 105.4 591.1 77.3 563C49.2 534.9 49.2 489.3 77.3 461.2L212.7 325.7L247.9 360.8zM416.1 64C436.2 64 455.5 67.7 473.2 74.5C483.2 78.3 485 91 477.5 98.6L420.8 155.3C417.8 158.3 416.1 162.4 416.1 166.6L416.1 208C416.1 216.8 423.3 224 432.1 224L473.5 224C477.7 224 481.8 222.3 484.8 219.3L541.5 162.6C549.1 155.1 561.8 156.9 565.6 166.9C572.4 184.6 576.1 203.9 576.1 224C576.1 267.2 558.9 306.3 531.1 335.1L482 286C448.9 253 403.5 240.3 360.9 247.6L304.1 190.8L304.1 161.1L303.9 156.1C303.1 143.7 299.5 131.8 293.4 121.2C322.8 86.2 366.8 64 416.1 63.9z"
                                      />
                                    </svg>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      openRowBreakdown(row)
                                    }}
                                    title="How this margin was computed"
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      padding: 0,
                                      margin: 0,
                                      font: 'inherit',
                                      fontSize: '0.875rem',
                                      fontWeight: 600,
                                      color: row.flag ? MARGIN_FLAG_COLOR[row.flag] : '#374151',
                                      cursor: 'pointer',
                                      textDecoration: 'underline',
                                      textDecorationStyle: 'dotted',
                                      textUnderlineOffset: '2px',
                                    }}
                                  >
                                    {row.margin != null ? `${row.margin.toFixed(1)}%` : '—'}
                                  </button>
                                )}
                                <span style={{ color: 'var(--text-faint)' }}>/</span>
                                {(() => {
                                  const pctDisplay =
                                    row.pctOfGrandTotal != null ? `${row.pctOfGrandTotal.toFixed(1)}%` : '—'
                                  const pctTextStyle = { fontSize: '0.875rem' as const }
                                  const toggleInteractive =
                                    row.canToggleOmitSubmission &&
                                    savingPricingAssignment !== row.countRow.id
                                  if (toggleInteractive) {
                                    return (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          void togglePricingRowOmitFromSubmission(row.countRow.id)
                                        }}
                                        aria-pressed={row.omitFromSubmissionDocuments}
                                        aria-label={
                                          row.omitFromSubmissionDocuments ?
                                            'Include line in Cover Letter fixture list'
                                          : 'Hide line from Cover Letter fixture list'
                                        }
                                        title={
                                          row.omitFromSubmissionDocuments ?
                                            'Hidden from Cover Letter fixture list — click to restore'
                                          : 'Click to hide from Cover Letter fixture list (included in totals)'
                                        }
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '0.35rem',
                                          padding: 0,
                                          margin: 0,
                                          border: 'none',
                                          borderRadius: 0,
                                          background: 'transparent',
                                          cursor: 'pointer',
                                          font: 'inherit',
                                          color:
                                            row.omitFromSubmissionDocuments ? 'var(--text-link)' : 'var(--text-700)',
                                          lineHeight: 1.25,
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.textDecoration = 'underline'
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.textDecoration = 'none'
                                        }}
                                      >
                                        <span style={pctTextStyle}>{pctDisplay}</span>
                                        {row.omitFromSubmissionDocuments ?
                                          <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 640 640"
                                            width={16}
                                            height={16}
                                            aria-hidden
                                          >
                                            <path
                                              fill="currentColor"
                                              d="M73 39.1C63.6 29.7 48.4 29.7 39.1 39.1C29.8 48.5 29.7 63.7 39 73.1L567 601.1C576.4 610.5 591.6 610.5 600.9 601.1C610.2 591.7 610.3 576.5 600.9 567.2L504.5 470.8C507.2 468.4 509.9 466 512.5 463.6C559.3 420.1 590.6 368.2 605.5 332.5C608.8 324.6 608.8 315.8 605.5 307.9C590.6 272.2 559.3 220.2 512.5 176.8C465.4 133.1 400.7 96.2 319.9 96.2C263.1 96.2 214.3 114.4 173.9 140.4L73 39.1zM208.9 175.1C241 156.2 278.1 144 320 144C385.2 144 438.8 173.6 479.9 211.7C518.4 247.4 545 290 558.5 320C544.9 350 518.3 392.5 479.9 428.3C476.8 431.1 473.7 433.9 470.5 436.7L425.8 392C439.8 371.5 448 346.7 448 320C448 249.3 390.7 192 320 192C293.3 192 268.5 200.2 248 214.2L208.9 175.1zM390.9 357.1L282.9 249.1C294 243.3 306.6 240 320 240C364.2 240 400 275.8 400 320C400 333.4 396.7 346 390.9 357.1zM135.4 237.2L101.4 203.2C68.8 240 46.4 279 34.5 307.7C31.2 315.6 31.2 324.4 34.5 332.3C49.4 368 80.7 420 127.5 463.4C174.6 507.1 239.3 544 320.1 544C357.4 544 391.3 536.1 421.6 523.4L384.2 486C364.2 492.4 342.8 496 320 496C254.8 496 201.2 466.4 160.1 428.3C121.6 392.6 95 350 81.5 320C91.9 296.9 110.1 266.4 135.5 237.2z"
                                            />
                                          </svg>
                                        : null}
                                      </button>
                                    )
                                  }
                                  return (
                                    <span
                                      style={{
                                        ...pctTextStyle,
                                        color:
                                          savingPricingAssignment === row.countRow.id ?
                                            '#9ca3af'
                                          : !row.canToggleOmitSubmission ?
                                            '#9ca3af'
                                          : '#374151',
                                        opacity:
                                          savingPricingAssignment === row.countRow.id ?
                                            0.7
                                          : !row.canToggleOmitSubmission ?
                                            0.55
                                          : 1,
                                      }}
                                      title={
                                        savingPricingAssignment === row.countRow.id ?
                                          'Saving…'
                                        : !row.canToggleOmitSubmission ?
                                          'Select a price book version to change submission visibility.'
                                        : undefined
                                      }
                                    >
                                      {pctDisplay}
                                    </span>
                                  )
                                })()}
                              </div>
                          </td>
                          <td style={{ width: 0, padding: 0 }} />
                        </tr>
                      ))}
                      <tr style={{ background: 'var(--bg-amber-tint)' }}>
                        <td colSpan={3} style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-amber-800)' }}>Our cost breakdown</td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-amber-800)' }}>${formatCurrency(totalCost)}</td>
                        <td colSpan={3} />
                      </tr>
                      <tr style={{ fontSize: '0.8125rem' }}>
                        <td colSpan={7} style={{ padding: '0.35rem 0.75rem' }}>
                          <button
                            type="button"
                            onClick={() => { if (selectedBidForPricing) onNavigateBidToTab(selectedBidForPricing, 'takeoffs') }}
                            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}
                          >
                            Takeoffs
                          </button>
                        </td>
                      </tr>
                      <tr style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>
                        <td colSpan={3} style={{ padding: '0.4rem 0.75rem 0.4rem 1.5rem' }}>Materials</td>
                        <td style={{ padding: '0.4rem 0.75rem', textAlign: 'right' }}>${formatCurrency(totalMaterials)} {totalCost > 0 ? <span style={{ color: 'var(--text-muted)' }}>{`| ${((totalMaterials / totalCost) * 100).toFixed(1)}%`}</span> : ''}</td>
                        <td colSpan={3} />
                      </tr>
                      <tr style={{ fontSize: '0.8125rem' }}>
                        <td colSpan={7} style={{ padding: '0.35rem 0.75rem' }}>
                          <button
                            type="button"
                            onClick={() => { if (selectedBidForPricing) onNavigateBidToTab(selectedBidForPricing, 'labor') }}
                            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}
                          >
                            Labor
                          </button>
                        </td>
                      </tr>
                      {(() => {
                        const laborSubtotal = laborCost + drivingCost + travelCost + estimatorCost + teamLaborCost
                        const pct = (v: number) => (totalCost > 0 ? <span style={{ color: 'var(--text-muted)' }}>{`| ${((v / totalCost) * 100).toFixed(1)}%`}</span> : '')
                        const lineRow = (label: React.ReactNode, value: number) => (
                          <tr style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>
                            <td colSpan={3} style={{ padding: '0.4rem 0.75rem 0.4rem 1.5rem' }}>{label}</td>
                            <td style={{ padding: '0.4rem 0.75rem', textAlign: 'right' }}>${formatCurrency(value)} {pct(value)}</td>
                            <td colSpan={3} />
                          </tr>
                        )
                        const subtotalRow = (label: string, value: number) => (
                          <tr style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)', background: 'var(--bg-subtle)' }}>
                            <td colSpan={3} style={{ padding: '0.4rem 0.75rem 0.4rem 1rem' }}>{label}</td>
                            <td style={{ padding: '0.4rem 0.75rem', textAlign: 'right' }}>${formatCurrency(value)} {pct(value)}</td>
                            <td colSpan={3} />
                          </tr>
                        )
                        return (
                          <>
                            {lineRow('Manhours', laborCost)}
                            {lineRow(
                              <>Vehicle Travel <span style={{ color: 'var(--text-muted)' }}>({numTrips.toFixed(1)} trips × ${ratePerMile.toFixed(2)}/mi × {distance.toFixed(0)} mi)</span></>,
                              drivingCost,
                            )}
                            {lineRow(<>Lodging &amp; Meals <span style={{ color: 'var(--text-muted)' }}>(meals + hotels)</span></>, travelCost)}
                            {lineRow('Estimators Time', estimatorCost)}
                            {lineRow('Team Labor (clocked)', teamLaborCost)}
                            {subtotalRow('Labor subtotal', laborSubtotal)}
                          </>
                        )
                      })()}
                      <tr style={{ fontSize: '0.8125rem' }}>
                        <td colSpan={7} style={{ padding: '0.35rem 0.75rem' }}>
                          <button
                            type="button"
                            onClick={() => { if (selectedBidForPricing) onNavigateToLaborDirectCosts(selectedBidForPricing) }}
                            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}
                          >
                            Direct Costs
                          </button>
                        </td>
                      </tr>
                      {(() => {
                        const directCostsSubtotal = equipmentRentalCost + permitCost + subcontractorCost + wasteCost + otherCost
                        const pct = (v: number) => (totalCost > 0 ? <span style={{ color: 'var(--text-muted)' }}>{`| ${((v / totalCost) * 100).toFixed(1)}%`}</span> : '')
                        const lineRow = (label: React.ReactNode, value: number) => (
                          <tr style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>
                            <td colSpan={3} style={{ padding: '0.4rem 0.75rem 0.4rem 1.5rem' }}>{label}</td>
                            <td style={{ padding: '0.4rem 0.75rem', textAlign: 'right' }}>${formatCurrency(value)} {pct(value)}</td>
                            <td colSpan={3} />
                          </tr>
                        )
                        return (
                          <>
                            {lineRow(<>Equipment &amp; Tool Rental</>, equipmentRentalCost)}
                            {lineRow(<>Permits, Inspections &amp; Fees</>, permitCost)}
                            {lineRow(<>Subcontractor Fees</>, subcontractorCost)}
                            {lineRow(<>Waste Disposal &amp; Site Cleanup</>, wasteCost)}
                            {lineRow(<>Other</>, otherCost)}
                            <tr style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)', background: 'var(--bg-subtle)' }}>
                              <td colSpan={3} style={{ padding: '0.4rem 0.75rem 0.4rem 1rem' }}>Direct Costs subtotal</td>
                              <td style={{ padding: '0.4rem 0.75rem', textAlign: 'right' }}>${formatCurrency(directCostsSubtotal)} {pct(directCostsSubtotal)}</td>
                              <td colSpan={3} />
                            </tr>
                          </>
                        )
                      })()}
                      <tr style={{ background: 'var(--bg-subtle)', fontWeight: 600 }}>
                        <td style={{ padding: '0.75rem' }}>Total</td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }} />
                        <td style={{ padding: '0.75rem' }} />
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>{pricingViewModel === 'cost' ? `$${formatCurrency(totalCost)}` : ''}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>${formatCurrency(totalRevenue)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          {(() => {
                            const m = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : null
                            const f = m != null ? marginFlag(m) : null
                            return (
                              <>
                                <span style={{ color: f ? MARGIN_FLAG_COLOR[f] : undefined }}>
                                  {m != null ? `${m.toFixed(1)}%` : '—'}
                                </span>
                                {' / 100%'}
                              </>
                            )
                          })()}
                        </td>
                        <td style={{ width: 0, padding: 0 }} />
                      </tr>
                      {uncostedRevenueRows.length > 0 && (
                        <tr style={{ background: 'var(--bg-amber-tint)' }}>
                          <td
                            colSpan={7}
                            style={{
                              padding: '0.6rem 0.75rem',
                              fontSize: '0.8125rem',
                              color: 'var(--text-amber-800)',
                              borderTop: '1px solid #fde68a',
                              textAlign: 'center',
                            }}
                          >
                            ⚠ {uncostedRevenueRows.length} item
                            {uncostedRevenueRows.length === 1 ? '' : 's'} with a Sale Price but no Takeoffs cost
                            {` (${`$${formatCurrency(uncostedRevenue)}`}${totalRevenue > 0 ? `, ${((uncostedRevenue / totalRevenue) * 100).toFixed(0)}% of revenue` : ''})`}
                            {' '}Currently counts as 100% margin.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                </>
              )
            })()}
          </div>
        )}
        {pricingBreakdownRow && (() => {
          const b = pricingBreakdownRow
          const profit = b.revenue - b.cost
          const marginPct = b.revenue > 0 ? (profit / b.revenue) * 100 : null
          const uncosted = b.materialsFromTakeoff == null || b.materialsFromTakeoff === 0
          const sectionLabelStyle: CSSProperties = {
            fontSize: '0.6875rem',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'var(--text-faint)',
            margin: '0.75rem 0 0.25rem',
            textAlign: 'center',
          }
          const lineStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: '1rem' }
          const subtotalStyle: CSSProperties = {
            ...lineStyle,
            fontWeight: 600,
            paddingTop: '0.4rem',
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
                  padding: '1.5rem 2rem',
                  minWidth: 360,
                  maxWidth: 440,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h2 id="pricing-breakdown-title" style={{ margin: '0 0 0.5rem', fontSize: '1.125rem' }}>
                  Margin breakdown: {b.fixture}
                </h2>

                <p style={sectionLabelStyle}>Revenue</p>
                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  <div style={lineStyle}>
                    <span style={{ color: 'var(--text-muted)' }}>Sale Price {b.isFixedPrice ? '(fixed)' : '(per unit)'}</span>
                    <span>${formatCurrency(b.unitPrice)}</span>
                  </div>
                  {b.isFixedPrice ? (
                    <div style={lineStyle}>
                      <span style={{ color: 'var(--text-faint)', fontSize: '0.8125rem' }}>Fixed price — not multiplied by count</span>
                      <span />
                    </div>
                  ) : (
                    <div style={lineStyle}>
                      <span style={{ color: 'var(--text-muted)' }}>× Count</span>
                      <span>{b.count}</span>
                    </div>
                  )}
                  <div style={subtotalStyle}>
                    <span>Revenue</span>
                    <span>${formatCurrency(b.revenue)}</span>
                  </div>
                </div>

                <p style={sectionLabelStyle}>Our cost</p>
                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  <div style={lineStyle}>
                    <span style={{ color: 'var(--text-muted)' }}>
                      Materials {b.materialsFromTakeoff != null ? '(from Takeoffs)' : '(proportional)'}
                    </span>
                    <span>${formatCurrency(b.materialsBeforeTax)}</span>
                  </div>
                  {b.taxAmount > 0 && (
                    <div style={lineStyle}>
                      <span style={{ color: 'var(--text-muted)' }}>Tax ({b.taxPercent}%)</span>
                      <span>${formatCurrency(b.taxAmount)}</span>
                    </div>
                  )}
                  <div style={lineStyle}>
                    <span style={{ color: 'var(--text-muted)' }}>Labor</span>
                    <span>${formatCurrency(b.laborCost)}</span>
                  </div>
                  <div style={subtotalStyle}>
                    <span>Our cost</span>
                    <span>${formatCurrency(b.cost)}</span>
                  </div>
                </div>

                <p style={sectionLabelStyle}>Margin</p>
                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  <div style={lineStyle}>
                    <span style={{ color: 'var(--text-muted)' }}>Profit (Revenue − Our cost)</span>
                    <span style={{ color: profit < 0 ? '#dc2626' : undefined }}>${formatCurrency(profit)}</span>
                  </div>
                  <div style={{ ...subtotalStyle, fontSize: '1.0625rem' }}>
                    <span>Margin (Profit ÷ Revenue)</span>
                    <span>{marginPct != null ? `${marginPct.toFixed(1)}%` : '—'}</span>
                  </div>
                </div>

                {uncosted && (
                  <p
                    style={{
                      margin: '1rem 0 0',
                      padding: '0.6rem 0.75rem',
                      background: 'var(--bg-amber-tint)',
                      border: '1px solid #fde68a',
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
          <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: 'var(--bg-subtle)' }}>
                <tr>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Project</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Bid Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredBidsForPricing.map((bid) => (
                  <tr
                    key={bid.id}
                    onClick={() => onSelectBid(bid)}
                    style={{
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <td style={{ padding: '0.75rem' }}><BidProjectCell bid={bid} ledgerPrefixMap={ledgerPrefixMap} /></td>
                    <td style={{ padding: '0.75rem' }}>{formatDateYYMMDD(bid.bid_due_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', marginTop: '1.5rem' }}>
          <div>
            <button
              type="button"
              onClick={() => setPriceBookSectionOpen((prev) => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                margin: 0,
                marginBottom: priceBookSectionOpen ? '0.75rem' : 0,
                padding: 0,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 600,
              }}
            >
              <span style={{ fontSize: '0.75rem' }}>{priceBookSectionOpen ? '▼' : '▶'}</span>
              Price book
            </button>
            {priceBookSectionOpen && (
            <>
            {/* Toggle: edit this bid's Pricings vs the shared template catalog. */}
            <div style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden', marginBottom: '0.75rem' }}>
              {([['pricings', "This version's prices"], ['templates', 'Template library']] as const).map(([key, label]) => {
                const active = (key === 'templates') === templatesMode
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTemplatesMode(key === 'templates')}
                    style={{
                      padding: '0.35rem 0.75rem',
                      background: active ? '#3b82f6' : 'var(--surface)',
                      color: active ? 'white' : 'var(--text-700)',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.8125rem',
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            {templatesMode ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {panelVersions.map((v) => (
                  <span
                    key={v.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.35rem 0.5rem',
                      background: panelVersionId === v.id ? '#dbeafe' : 'var(--bg-muted)',
                      border: panelVersionId === v.id ? '1px solid #3b82f6' : '1px solid var(--border-strong)',
                      borderRadius: 4,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => selectPanelVersion(v.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: panelVersionId === v.id ? 600 : 400, padding: 0 }}
                    >
                      {v.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditPricingVersion(v)}
                      style={{ padding: '0.15rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
                      title="Edit template name"
                    >
                      ✎
                    </button>
                  </span>
                ))}
                {panelVersions.length === 0 && (
                  <span style={{ color: 'var(--text-faint)', fontSize: '0.8125rem', alignSelf: 'center' }}>
                    No templates for this service type yet.
                  </span>
                )}
                <button
                  type="button"
                  onClick={openAddTemplate}
                  style={{ marginLeft: 'auto', padding: '0.35rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  Add template
                </button>
              </div>
            ) : isBidOwnedPricing ? (
              <div style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: 'var(--text-700)' }}>
                Editing prices for the active version.
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', position: 'relative' }} data-add-pricing-menu>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>This version has no pricing yet.</span>
                <button
                  type="button"
                  onClick={() => setAddPricingMenuOpen((o) => !o)}
                  style={{ padding: '0.35rem 0.6rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  Set up pricing ▾
                </button>
                {addPricingMenuOpen && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 30, minWidth: '14rem', padding: '0.25rem', maxHeight: '60vh', overflowY: 'auto' }}>
                    <button type="button" onClick={openAddBlankPricing} style={addPricingMenuItemStyle}>Blank pricing</button>
                    {priceBookVersions.filter((p) => p.id !== selectedPricingVersionId).length > 0 && (
                      <div style={{ borderTop: '1px solid #f1f5f9', margin: '0.25rem 0', paddingTop: '0.25rem' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-faint)', padding: '0.15rem 0.5rem' }}>Duplicate another version's pricing</div>
                        {priceBookVersions.filter((p) => p.id !== selectedPricingVersionId).map((p) => (
                          <button key={p.id} type="button" onClick={() => openClonePricing(p.id, p.name)} style={addPricingMenuItemStyle}>{p.name}</button>
                        ))}
                      </div>
                    )}
                    {templatePriceBookVersions.length > 0 && (
                      <div style={{ borderTop: '1px solid #f1f5f9', margin: '0.25rem 0', paddingTop: '0.25rem' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-faint)', padding: '0.15rem 0.5rem' }}>From template</div>
                        {templatePriceBookVersions.map((t) => (
                          <button key={t.id} type="button" onClick={() => openClonePricing(t.id, t.name)} style={addPricingMenuItemStyle}>{t.name}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {canEditPanelEntries && panelVersionId && (
              <>
                <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>Entries</h4>
                <input
                  type="text"
                  placeholder="Search fixture/tie-in name..."
                  value={priceBookSearchQuery}
                  onChange={(e) => setPriceBookSearchQuery(e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: '0.5rem', 
                    border: '1px solid var(--border-strong)', 
                    borderRadius: 4, 
                    marginBottom: '0.5rem', 
                    boxSizing: 'border-box' 
                  }}
                />
                <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'var(--bg-subtle)' }}>
                      <tr>
                        <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Fixture / Tie-in</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Rough In</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Top Out</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Trim Set</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Total</th>
                        <th style={{ padding: '0.5rem', width: 60, borderBottom: '1px solid var(--border)' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {panelEntries
                        .filter((entry) =>
                          (entry.fixture_types?.name ?? '').toLowerCase().includes(priceBookSearchQuery.toLowerCase())
                        )
                        .map((entry) => (
                        <tr key={entry.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.5rem' }}>{entry.fixture_types?.name ?? ''}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>${formatCurrency(Number(entry.rough_in_price))}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>${formatCurrency(Number(entry.top_out_price))}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>${formatCurrency(Number(entry.trim_set_price))}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>${formatCurrency(Number(entry.total_price))}</td>
                          <td style={{ padding: '0.5rem' }}>
                            <button type="button" onClick={() => openEditPricingEntry(entry)} style={{ padding: '0.15rem', background: 'none', border: 'none', cursor: 'pointer' }} title="Edit">✎</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {priceBookSearchQuery &&
                 panelEntries.filter((e) =>
                   (e.fixture_types?.name ?? '').toLowerCase().includes(priceBookSearchQuery.toLowerCase())
                 ).length === 0 && (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '1rem', 
                    color: 'var(--text-muted)' 
                  }}>
                    No entries match "{priceBookSearchQuery}"
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPricingEntry(null)
                        setPricingEntryFixtureName(priceBookSearchQuery)
                        setPricingEntryRoughIn('')
                        setPricingEntryTopOut('')
                        setPricingEntryTrimSet('')
                        setPricingEntryTotal('')
                        setPricingEntryFormOpen(true)
                      }}
                      style={{ 
                        display: 'block',
                        margin: '0.5rem auto 0',
                        padding: '0.5rem 1rem', 
                        background: '#3b82f6', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: 4, 
                        cursor: 'pointer',
                        fontSize: '0.875rem'
                      }}
                    >
                      Add "{priceBookSearchQuery}" to Price Book
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={openNewPricingEntry}
                  style={{ marginTop: '0.5rem', padding: '0.35rem 0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  Add entry
                </button>
              </>
            )}
            </>
            )}
          </div>
        </div>
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
              <h3 style={{ margin: '0 0 0.75rem', color: 'var(--text-red-700)' }}>Delete price book version</h3>
              <p style={{ margin: '0 0 0.75rem', color: 'var(--text-700)', fontSize: '0.9rem' }}>
                This will permanently delete the price book version{' '}
                <strong>{pricingVersionToDelete.name}</strong> and all entries it contains.
              </p>
              <p style={{ margin: '0 0 0.5rem', color: 'var(--text-600)', fontSize: '0.875rem' }}>
                Type the name of this price book version to confirm:
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
              zIndex: 50,
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
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    {editingPricingEntry && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm(`Delete "${editingPricingEntry.fixture_types?.name ?? ''}" from this price book?`)) return
                          await deletePricingEntry(editingPricingEntry)
                          closePricingEntryForm()
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

      {packageSendOpen && selectedBidForPricing && selectedPricingVersionId && pricingPackageSource ? (
        <PackageAndSendBidPricingModal
          open={packageSendOpen}
          onClose={() => setPackageSendOpen(false)}
          bid={selectedBidForPricing}
          priceBookVersionId={selectedPricingVersionId}
          priceBookVersionName={
            priceBookVersions.find((v) => v.id === selectedPricingVersionId)?.name ?? '—'
          }
          pricingRows={pricingPackageSource.rows}
          totalRevenue={pricingPackageSource.totalRevenue}
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
