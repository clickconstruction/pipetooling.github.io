import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { supabase } from '../../lib/supabase'
import { loadPOItemsSummary } from '../../lib/bids/poItemsSummary'
import { loadPartsCatalog } from '../../lib/materials/partsCatalog'
import { useTakeoffPartsCatalog } from '../../hooks/useTakeoffPartsCatalog'
import { useTakeoffRoughLines } from '../../hooks/useTakeoffRoughLines'
import { SortableRoughPartLineRow, type PartType } from './SortableRoughPartLineRow'
import { TakeoffBookAdminSection } from './TakeoffBookAdminSection'
import { BidsTakeoffMaterialsSummarySection } from './BidsTakeoffMaterialsSummarySection'
import { TakeoffPartPricesModal } from './TakeoffPartPricesModal'
import { TakeoffBundleBreakdownModal } from './TakeoffBundleBreakdownModal'
import { TakeoffAssemblyAuthoringModals, type TakeoffNewTemplateItemDraft } from './TakeoffAssemblyAuthoringModals'
import { addExpandedPartsToPO, expandTemplate } from '../../lib/materialPOUtils'
import { fetchLowestPartPricesBatch } from '../../lib/materialPartCatalogPrice'
import { formatErrorMessage } from '../../utils/errorHandling'
import { printHtmlInNewWindow } from '../../lib/bidDocuments/htmlDoc'
import { buildRoughTakeoffBreakdownHtml, buildExactTakeoffBreakdownHtml } from '../../lib/bidDocuments/takeoffBreakdown'
import { bidDisplayName } from '../../lib/bids/bidFormatting'
import { bidDetailCloseXStyle, bidDetailCloseFloatMobileStyle } from '../../lib/bids/bidStyles'
import {
  clampRoughQtyFromDraft,
  resolveRoughQtyOnClose,
  normalizeMaterialsModel,
  takeoffFixtureCountLabel,
  mergePartLinesToTakeoffTemplateItems,
  STAGE_LABELS,
  type TakeoffStage,
} from '../../lib/bids/bidTakeoffHelpers'
import { loadBundlePartLines, type BundlePartLine } from '../../lib/bids/assemblyBundleBreakdown'
import { buildPartAssemblyIndex, type PartAssemblyEntry, type PartAssemblyIndexItem } from '../../lib/bids/partAssemblyIndex'
import { BidWorkflowTabTitleWithPreview } from './BidWorkflowTabTitleWithPreview'
import { BidPickerStandardList } from './BidPickerStandardList'
import { TakeoffViewPills, TakeoffNewViewPlaceholder } from './TakeoffViewPills'
import { readStoredTakeoffView, writeStoredTakeoffView, type TakeoffView } from '../../lib/bids/takeoffView'
import { bookFillMessage, fillFromBookLabel, planBookFill } from '../../lib/bids/takeoffBookFill'
import { MyBidsToggle } from './MyBidsToggle'
import { BidPickerSortToggle } from './BidPickerSortToggle'
import { bidNumberMatchesQuery, type LedgerPrefixMap } from '../../lib/ledgerDisplayPrefixes'
import { PartFormModal } from '../PartFormModal'
import { resolvePartFormSaveTarget } from '../../lib/bids/partFormSaveTarget'
import { NumericEntryPad } from '../NumericEntryPad'
import { TakeoffPartEditIcon } from '../icons/TakeoffPartEditIcon'
import { useToastContext } from '../../contexts/ToastContext'
import { breakdownJumpDomId, breakdownJumpMissMessage, takeoffRowDomId, type BreakdownJumpTarget } from '../../lib/bids/bidTabRowJump'
import { usePendingRowFlash } from '../../hooks/usePendingRowFlash'
import type { useBidPreview } from '../../contexts/BidPreviewModalContext'
import type { useBidPricingEngine } from '../../hooks/useBidPricingEngine'
import type { Database } from '../../types/database'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import type { BidCountRow } from '../../types/bids'
import type {
  MaterialTemplateWithAssemblyType,
  TakeoffBookEntry,
  TakeoffMapping,
  TakeoffRoughPartLineRow,
} from '../../lib/bids/bidPricingEngineTypes'

type MaterialPart = Database['public']['Tables']['material_parts']['Row']

interface ServiceType {
  id: string
  name: string
  description: string | null
  color: string | null
  sequence_order: number
  created_at: string
  updated_at: string
}

// PartType / RoughTakeoffMaterialPart moved to SortableRoughPartLineRow.tsx (T3)

type BidsTakeoffEngine = ReturnType<typeof useBidPricingEngine>

interface BidsTakeoffTabProps {
  // Data / UI
  bids: BidWithBuilder[]
  /** Breakdown jump (v2.2400): a row to land on — scroll + flash the fixture's cluster, then report handled. */
  rowJump?: BreakdownJumpTarget | null
  onRowJumpHandled?: () => void
  selectedBidForTakeoff: BidWithBuilder | null
  /** Active bid Version that this takeoff belongs to (null = the unsplit Base). */
  selectedBidVersionId: string | null
  selectedBidForCostEstimate: BidWithBuilder | null
  narrowViewport640: boolean
  bidPreview: ReturnType<typeof useBidPreview>
  error: string | null
  setError: (message: string | null) => void
  selectedServiceTypeId: string
  serviceTypes: ServiceType[]
  authUser: { id: string } | null
  loadBids: (serviceTypeId?: string | null) => Promise<BidWithBuilder[]>
  activeTab: string
  // Shared controlled state
  costEstimatePOModalTaxPercent: string
  setCostEstimatePOModalTaxPercent: Dispatch<SetStateAction<string>>
  // Engine values + setters/loaders
  takeoffCountRows: BidsTakeoffEngine['takeoffCountRows']
  takeoffMappings: BidsTakeoffEngine['takeoffMappings']
  setTakeoffMappings: BidsTakeoffEngine['setTakeoffMappings']
  takeoffRoughPartLines: BidsTakeoffEngine['takeoffRoughPartLines']
  setTakeoffRoughPartLines: BidsTakeoffEngine['setTakeoffRoughPartLines']
  takeoffRoughCatalogLowestByPartId: BidsTakeoffEngine['takeoffRoughCatalogLowestByPartId']
  setTakeoffRoughCatalogLowestByPartId: BidsTakeoffEngine['setTakeoffRoughCatalogLowestByPartId']
  materialTemplates: BidsTakeoffEngine['materialTemplates']
  draftPOs: BidsTakeoffEngine['draftPOs']
  takeoffBookVersions: BidsTakeoffEngine['takeoffBookVersions']
  takeoffBookEntries: BidsTakeoffEngine['takeoffBookEntries']
  setTakeoffBookEntries: BidsTakeoffEngine['setTakeoffBookEntries']
  selectedTakeoffBookVersionId: BidsTakeoffEngine['selectedTakeoffBookVersionId']
  setSelectedTakeoffBookVersionId: BidsTakeoffEngine['setSelectedTakeoffBookVersionId']
  takeoffBookEntriesVersionId: BidsTakeoffEngine['takeoffBookEntriesVersionId']
  setTakeoffBookEntriesVersionId: BidsTakeoffEngine['setTakeoffBookEntriesVersionId']
  costEstimate: BidsTakeoffEngine['costEstimate']
  costEstimateCountRows: BidsTakeoffEngine['costEstimateCountRows']
  purchaseOrdersForCostEstimate: BidsTakeoffEngine['purchaseOrdersForCostEstimate']
  costEstimateMaterialTotalRoughIn: BidsTakeoffEngine['costEstimateMaterialTotalRoughIn']
  costEstimateMaterialTotalTopOut: BidsTakeoffEngine['costEstimateMaterialTotalTopOut']
  costEstimateMaterialTotalTrimSet: BidsTakeoffEngine['costEstimateMaterialTotalTrimSet']
  loadDraftPOs: BidsTakeoffEngine['loadDraftPOs']
  loadTakeoffBookVersions: BidsTakeoffEngine['loadTakeoffBookVersions']
  loadTakeoffBookEntries: BidsTakeoffEngine['loadTakeoffBookEntries']
  saveBidSelectedTakeoffBookVersion: BidsTakeoffEngine['saveBidSelectedTakeoffBookVersion']
  loadPurchaseOrdersForCostEstimate: BidsTakeoffEngine['loadPurchaseOrdersForCostEstimate']
  loadCostEstimate: BidsTakeoffEngine['loadCostEstimate']
  ensureCostEstimateForBid: BidsTakeoffEngine['ensureCostEstimateForBid']
  loadMaterialTemplates: BidsTakeoffEngine['loadMaterialTemplates']
  setCostEstimatePO: BidsTakeoffEngine['setCostEstimatePO']
  openMaterialsModelSwitch: BidsTakeoffEngine['openMaterialsModelSwitch']
  // Callbacks
  onSelectBid: (bid: BidWithBuilder) => void
  onClose: () => void
  onEditBid: (bid: BidWithBuilder) => void
  ledgerPrefixMap: LedgerPrefixMap
  onlyMyBids: boolean
  setOnlyMyBids: (next: boolean) => void
  isMyBid: (bid: BidWithBuilder) => boolean
}

export function BidsTakeoffTab({
  bids,
  rowJump,
  onRowJumpHandled,
  selectedBidForTakeoff,
  selectedBidVersionId,
  selectedBidForCostEstimate,
  narrowViewport640,
  bidPreview,
  error,
  setError,
  selectedServiceTypeId,
  serviceTypes,
  authUser,
  loadBids,
  activeTab,
  costEstimatePOModalTaxPercent,
  setCostEstimatePOModalTaxPercent,
  takeoffCountRows,
  takeoffMappings,
  setTakeoffMappings,
  takeoffRoughPartLines,
  setTakeoffRoughPartLines,
  takeoffRoughCatalogLowestByPartId,
  setTakeoffRoughCatalogLowestByPartId,
  materialTemplates,
  draftPOs,
  takeoffBookVersions,
  takeoffBookEntries,
  setTakeoffBookEntries,
  selectedTakeoffBookVersionId,
  setSelectedTakeoffBookVersionId,
  takeoffBookEntriesVersionId,
  setTakeoffBookEntriesVersionId,
  costEstimate,
  costEstimateCountRows,
  purchaseOrdersForCostEstimate,
  costEstimateMaterialTotalRoughIn,
  costEstimateMaterialTotalTopOut,
  costEstimateMaterialTotalTrimSet,
  loadDraftPOs,
  loadTakeoffBookVersions,
  loadTakeoffBookEntries,
  saveBidSelectedTakeoffBookVersion,
  loadPurchaseOrdersForCostEstimate,
  loadCostEstimate,
  ensureCostEstimateForBid,
  loadMaterialTemplates,
  setCostEstimatePO,
  openMaterialsModelSwitch,
  onSelectBid,
  onClose,
  ledgerPrefixMap,
  onlyMyBids,
  setOnlyMyBids,
  isMyBid,
}: BidsTakeoffTabProps) {
  const { showToast } = useToastContext()

  // Breakdown jump landing (v2.2400): scroll + flash the fixture's takeoff rows.
  // The parent clears `rowJump` the moment the landing is handled, so remember the
  // last target — the flash outlives the pending state by ~2s.
  const lastRowJumpRef = useRef(rowJump ?? null)
  if (rowJump) lastRowJumpRef.current = rowJump
  const rowJumpFlashDomId = usePendingRowFlash(rowJump ? breakdownJumpDomId(rowJump) : null, (found) => {
    if (!found && rowJump) showToast(breakdownJumpMissMessage(rowJump.tab, rowJump.fixture), 'info')
    onRowJumpHandled?.()
  })
  /** While the flash is on, every row of the jumped-to fixture tints (a fixture can own several assembly rows). */
  const rowJumpFlashCountRowId = rowJumpFlashDomId != null ? (lastRowJumpRef.current?.countRowId ?? null) : null

  const roughPartLinesSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const [takeoffSearchQuery, setTakeoffSearchQuery] = useState('')
  const [takeoffRoughPartPickerLineId, setTakeoffRoughPartPickerLineId] = useState<string | null>(null)
  const [takeoffRoughPartSearchQuery, setTakeoffRoughPartSearchQuery] = useState('')
  const [roughAddAssemblyModalCountRowId, setRoughAddAssemblyModalCountRowId] = useState<string | null>(null)
  const [roughAddAssemblySearchQuery, setRoughAddAssemblySearchQuery] = useState('')
  const [roughAddAssemblyExpanding, setRoughAddAssemblyExpanding] = useState(false)
  // "In N assemblies" on a selected part line: partId → assemblies containing it,
  // and the active part filter of the Add assembly modal (null = unfiltered).
  const [partAssemblyIndex, setPartAssemblyIndex] = useState<Map<string, PartAssemblyEntry[]> | null>(null)
  const [roughAddAssemblyPartFilter, setRoughAddAssemblyPartFilter] = useState<{ partId: string; partName: string } | null>(null)
  const [roughQtyNumpadLineId, setRoughQtyNumpadLineId] = useState<string | null>(null)
  const [roughQtyNumpadPos, setRoughQtyNumpadPos] = useState<{ top: number; left: number } | null>(null)
  const [roughQtyNumpadDraft, setRoughQtyNumpadDraft] = useState('')
  const roughQtyNumpadLineIdRef = useRef<string | null>(null)
  const roughQtyNumpadDraftRef = useRef('')
  // Pre-focus quantity of the active Qty input (v2.1329): the draft starts
  // blank on focus, so close paths restore this when nothing was entered.
  const roughQtyNumpadOriginalRef = useRef<number | null>(null)
  const roughQtyBlurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [takeoffRemoveConfirm, setTakeoffRemoveConfirm] = useState<
    null | { kind: 'rough_line'; lineId: string } | { kind: 'exact_mapping'; mappingId: string }
  >(null)
  const takeoffRemoveConfirmDeleteRef = useRef<HTMLButtonElement>(null)
  const [takeoffExistingPOId, setTakeoffExistingPOId] = useState('')
  const [takeoffCreatingPO, setTakeoffCreatingPO] = useState(false)
  const [takeoffAddingToPO, setTakeoffAddingToPO] = useState(false)
  const [takeoffPrinting, setTakeoffPrinting] = useState(false)
  const [takeoffSuccessMessage, setTakeoffSuccessMessage] = useState<string | null>(null)
  const [takeoffTemplatePickerOpenMappingId, setTakeoffTemplatePickerOpenMappingId] = useState<string | null>(null)
  const [takeoffTemplatePickerQuery, setTakeoffTemplatePickerQuery] = useState('')
  const takeoffTemplatePickerInputRefs = useRef<Map<string, HTMLInputElement>>(new Map())
  const [takeoffTemplatePickerAnchor, setTakeoffTemplatePickerAnchor] = useState<
    { top: number; left: number; width: number } | null
  >(null)
  const [takeoffCreatedPOId, setTakeoffCreatedPOId] = useState<string | null>(null)
  const [takeoffPreviewModalTemplateId, setTakeoffPreviewModalTemplateId] = useState<string | null>(null)
  const [takeoffPreviewModalTemplateName, setTakeoffPreviewModalTemplateName] = useState<string | null>(null)
  const [takeoffExistingPOItems, setTakeoffExistingPOItems] = useState<Array<{ part_name: string; quantity: number; price_at_time: number; template_name: string | null }> | 'loading' | null>(null)
  const [applyingTakeoffBookTemplates, setApplyingTakeoffBookTemplates] = useState(false)
  const [takeoffBookApplyMessage, setTakeoffBookApplyMessage] = useState<string | null>(null)
  // Assembly authoring cluster (T7): the modal open pointers, the states
  // handleBidsPartFormSave routes into, and the Add-Assembly drafts seeded by
  // openSaveAsAssemblyFromRough stay parent-owned; the rest of the cluster's
  // state lives in TakeoffAssemblyAuthoringModals.
  const [takeoffAddTemplateModalOpen, setTakeoffAddTemplateModalOpen] = useState(false)
  const [takeoffAddTemplateForMappingId, setTakeoffAddTemplateForMappingId] = useState<string | null>(null)
  const [takeoffNewTemplateName, setTakeoffNewTemplateName] = useState('')
  const [takeoffNewTemplateItems, setTakeoffNewTemplateItems] = useState<TakeoffNewTemplateItemDraft[]>([])
  // When the Add-Assembly modal was opened via "Save as Assembly" from a rough count
  // row, this holds that count row id. On save, if a bundle price is selected below,
  // the row's individual part lines are collapsed into one bundle line at that price.
  const [saveAsAssemblyCountRowId, setSaveAsAssemblyCountRowId] = useState<string | null>(null)
  // Index into takeoffNewTemplatePrices chosen to override the takeoff line (null = none).
  const [takeoffNewTemplateApplyPriceIndex, setTakeoffNewTemplateApplyPriceIndex] = useState<number | null>(null)

  type MaterialPartWithType = MaterialPart & { part_types?: PartType | null }
  // Old / New 1 / New 2 (v2.2768, docs/TAKEOFFS_REFRESH_PLAN.md): per-device, default Old until retirement.
  const [takeoffView, setTakeoffView] = useState<TakeoffView>(() =>
    readStoredTakeoffView(typeof window !== 'undefined' ? window.localStorage : null),
  )
  const switchTakeoffView = (next: TakeoffView) => {
    setTakeoffView(next)
    writeStoredTakeoffView(typeof window !== 'undefined' ? window.localStorage : null, next)
  }

  const [takeoffNewItemPartId, setTakeoffNewItemPartId] = useState('')

  // Part Form Modal state
  const [bidsPartFormOpen, setBidsPartFormOpen] = useState(false)
  const [bidsPartFormInitialName, setBidsPartFormInitialName] = useState('')
  const [bidsPartFormEditingPart, setBidsPartFormEditingPart] = useState<MaterialPartWithType | null>(null)
  const bidsPartFormIsEditRef = useRef(false)
  /** Rough-line origin captured when the form was opened; see openBidsPartFormForCreate. */
  const bidsPartFormRoughLineIdRef = useRef<string | null>(null)

  /**
   * @param roughLineId Rough-part-line origin captured AT CLICK TIME (v2.1395).
   * The form focuses its Name input on open, which blurs the row's search box,
   * whose onBlur nulls `takeoffRoughPartPickerLineId` — so by save time the
   * live state is gone and the part never reached the line. Callers that open
   * from a line must pass it; everyone else leaves it undefined.
   */
  function openBidsPartFormForCreate(initialName: string, roughLineId?: string) {
    bidsPartFormIsEditRef.current = false
    bidsPartFormRoughLineIdRef.current = roughLineId ?? null
    setBidsPartFormEditingPart(null)
    setBidsPartFormInitialName(initialName)
    setBidsPartFormOpen(true)
  }

  function openBidsPartFormForEdit(part: MaterialPartWithType) {
    bidsPartFormIsEditRef.current = true
    bidsPartFormRoughLineIdRef.current = null
    setBidsPartFormEditingPart(part)
    setBidsPartFormInitialName('')
    setBidsPartFormOpen(true)
  }

  function closeBidsPartForm() {
    setBidsPartFormOpen(false)
    setBidsPartFormEditingPart(null)
    bidsPartFormIsEditRef.current = false
  }

  // Add Parts to Template Modal state (open pointer + PartFormModal-routed picker states)
  const [addPartsToTemplateModalOpen, setAddPartsToTemplateModalOpen] = useState(false)
  const [addPartsToTemplateId, setAddPartsToTemplateId] = useState<string | null>(null)
  const [addPartsToTemplateName, setAddPartsToTemplateName] = useState<string | null>(null)
  const [addPartsSelectedPartId, setAddPartsSelectedPartId] = useState('')
  // Staged id for the create-from-picker flow (v2.1394): when the part form
  // minted this part, the Add-Parts modal auto-adds it (qty input, default 1)
  // instead of only pre-selecting. Normal picker selections never set this.
  const [addPartsAutoAddPartId, setAddPartsAutoAddPartId] = useState('')

  // Part Prices modal (check/modify prices from Add Assembly / Edit Assembly item rows)
  const [partPricesModal, setPartPricesModal] = useState<{ partId: string; partName: string; defaultAddPrice?: string } | null>(null)
  const prevPartPricesModalRef = useRef<{ partId: string; partName: string; defaultAddPrice?: string } | null>(null)
  const [bundleBreakdownModal, setBundleBreakdownModal] = useState<{ templateId: string; lineId: string; assemblyName: string } | null>(null)

  // Bundle breakdown modal: parts-vs-bundle comparison for a rough Assembly bundle line.
  // Inline grayed part rows shown beneath each Combined bundle line (display-only, never
  // persisted, never summed). Cached by assembly template id; collapse tracked per line id.
  const [bundlePartsByTemplateId, setBundlePartsByTemplateId] = useState<Record<string, BundlePartLine[]>>({})
  const [collapsedBundleLineIds, setCollapsedBundleLineIds] = useState<Set<string>>(new Set())

  // Edit Template Modal state (open pointer + PartFormModal-routed picker states)
  const [editTemplateModalOpen, setEditTemplateModalOpen] = useState(false)
  const [editTemplateModalId, setEditTemplateModalId] = useState<string | null>(null)
  const [editTemplateModalName, setEditTemplateModalName] = useState<string | null>(null)
  const [editTemplateNewItemPartId, setEditTemplateNewItemPartId] = useState('')



  // T8 seam (v2.2770): the parts catalog + supply houses / part types + the exact-model preview cache.
  const {
    takeoffAddTemplateParts,
    setTakeoffAddTemplateParts,
    supplyHouses,
    partTypes,
    takeoffTemplatePreviewCache,
    setTakeoffTemplatePreviewCache,
  } = useTakeoffPartsCatalog<MaterialPartWithType>({
    activeTab,
    selectedServiceTypeId,
    selectedBidForTakeoff,
    takeoffMappings,
    takeoffAddTemplateModalOpen,
    addPartsToTemplateModalOpen,
    editTemplateModalOpen,
  })

  const refreshTakeoffRoughCatalogLowest = useCallback(async (partIds: string[]) => {
    const unique = Array.from(new Set(partIds.filter(Boolean)))
    if (unique.length === 0) return
    try {
      const map = await fetchLowestPartPricesBatch(supabase, unique)
      setTakeoffRoughCatalogLowestByPartId((prev) => {
        const next = { ...prev }
        for (const [pid, row] of map) {
          next[pid] = { price: row.price, supplyHouseName: row.supplyHouseName }
        }
        return next
      })
    } catch (e) {
      showToast(formatErrorMessage(e, 'Failed to load catalog prices'), 'error')
    }
  }, [showToast])


  // T9 seam (v2.2770): the Combined persistence engine — every rough-line write goes through here.
  const {
    setRoughPartLinePartAndCatalogPrice,
    resetRoughLineToCatalogPrice,
    updateTakeoffRoughPartLine,
    addTakeoffRoughPartLine,
    removeTakeoffRoughPartLine,
    handleRoughPartLinesDragEnd,
    applyRoughAddAssemblyTemplate,
    insertRoughBundleLine,
    applyRoughAddAssemblyBundle,
    fillRowsFromAssemblies,
  } = useTakeoffRoughLines<MaterialPartWithType>({
    selectedBidForTakeoff,
    selectedBidVersionId,
    activeTab,
    takeoffRoughPartLines,
    setTakeoffRoughPartLines,
    takeoffAddTemplateParts,
    setTakeoffAddTemplateParts,
    materialTemplates,
    setError,
    showToast,
    refreshTakeoffRoughCatalogLowest,
    setRoughAddAssemblyExpanding,
    closeRoughAddAssemblyModal,
  })

  // Fill from book under Combined (v2.2776): the bid's selected book loads its
  // entries onto the tab (the admin section used to be the only loader), and
  // the matcher runs live so the button can say how many fixtures it would fill.
  const bookEntriesSyncedForRef = useRef<string | null>(null)
  useEffect(() => {
    if (activeTab !== 'takeoffs' || !selectedBidForTakeoff?.id) return
    if (!selectedTakeoffBookVersionId || bookEntriesSyncedForRef.current === selectedTakeoffBookVersionId) return
    bookEntriesSyncedForRef.current = selectedTakeoffBookVersionId
    if (takeoffBookEntriesVersionId === selectedTakeoffBookVersionId) return
    setTakeoffBookEntriesVersionId(selectedTakeoffBookVersionId)
    void loadTakeoffBookEntries(selectedTakeoffBookVersionId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedBidForTakeoff?.id, selectedTakeoffBookVersionId])
  const takeoffIsRough = normalizeMaterialsModel(selectedBidForTakeoff?.materials_model) === 'rough'
  const bookFillPlan = useMemo(() => {
    if (!takeoffIsRough || !selectedTakeoffBookVersionId || takeoffBookEntriesVersionId !== selectedTakeoffBookVersionId) return null
    return planBookFill(takeoffCountRows, takeoffRoughPartLines, takeoffBookEntries)
  }, [takeoffIsRough, selectedTakeoffBookVersionId, takeoffBookEntriesVersionId, takeoffCountRows, takeoffRoughPartLines, takeoffBookEntries])
  const bookFillButton = fillFromBookLabel(bookFillPlan, applyingTakeoffBookTemplates, takeoffIsRough)

  useEffect(() => {
    roughQtyNumpadLineIdRef.current = roughQtyNumpadLineId
  }, [roughQtyNumpadLineId])

  useEffect(() => {
    roughQtyNumpadDraftRef.current = roughQtyNumpadDraft
  }, [roughQtyNumpadDraft])

  useEffect(() => {
    if (!takeoffRemoveConfirm) return
    queueMicrotask(() => takeoffRemoveConfirmDeleteRef.current?.focus())
  }, [takeoffRemoveConfirm])

  useEffect(() => {
    if (!takeoffRemoveConfirm) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTakeoffRemoveConfirm(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [takeoffRemoveConfirm])

  useEffect(() => {
    if (takeoffTemplatePickerOpenMappingId == null) {
      setTakeoffTemplatePickerAnchor(null)
      return
    }
    const recompute = () => {
      const el = takeoffTemplatePickerInputRefs.current.get(takeoffTemplatePickerOpenMappingId)
      if (!el) return
      const rect = el.getBoundingClientRect()
      setTakeoffTemplatePickerAnchor({
        top: rect.bottom + 2,
        left: rect.left,
        width: rect.width,
      })
    }
    recompute()
    window.addEventListener('resize', recompute)
    window.addEventListener('scroll', recompute, true)
    return () => {
      window.removeEventListener('resize', recompute)
      window.removeEventListener('scroll', recompute, true)
    }
  }, [takeoffTemplatePickerOpenMappingId])

  function openSaveAsAssemblyFromRough(countRowId: string, row: BidCountRow) {
    const lines = takeoffRoughPartLines
      .filter(
        (l): l is TakeoffRoughPartLineRow & { partId: string } =>
          l.countRowId === countRowId && typeof l.partId === 'string' && l.partId.trim() !== '',
      )
      .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
    if (lines.length === 0) return
    const merged = mergePartLinesToTakeoffTemplateItems(lines)
    setTakeoffNewTemplateItems(merged)
    const fx = (row.fixture ?? '').trim()
    setTakeoffNewTemplateName(fx ? `${fx} assembly` : 'New assembly')
    setTakeoffAddTemplateForMappingId(null)
    setSaveAsAssemblyCountRowId(countRowId)
    setTakeoffNewTemplateApplyPriceIndex(null)
    setTakeoffNewItemPartId('')
    // The cluster-internal fields (description, bundle-price drafts) are
    // guaranteed default here: every close path runs the cluster's
    // closeTakeoffAddTemplateModal, which resets them.
    setTakeoffAddTemplateModalOpen(true)
  }

  function closeRoughAddAssemblyModal() {
    setRoughAddAssemblyModalCountRowId(null)
    setRoughAddAssemblySearchQuery('')
    setRoughAddAssemblyPartFilter(null)
  }

  /** Assemblies containing a part, restricted to the templates visible on this takeoff. */
  function partAssemblyEntriesFor(partId: string | null | undefined): PartAssemblyEntry[] {
    if (!partId || !partAssemblyIndex) return []
    const entries = partAssemblyIndex.get(partId)
    if (!entries || entries.length === 0) return []
    return entries.filter((e) => materialTemplates.some((t) => t.id === e.templateId))
  }

  /** Open the Add assembly modal pre-filtered to assemblies that contain this part. */
  function openAssembliesForPart(countRowId: string, partId: string) {
    const partName = takeoffAddTemplateParts.find((p) => p.id === partId)?.name ?? 'this part'
    setRoughAddAssemblyPartFilter({ partId, partName })
    setRoughAddAssemblySearchQuery('')
    setRoughAddAssemblyModalCountRowId(countRowId)
  }

  // Add Parts to Existing Template Modal Functions (open pointer stays here;
  // the modal body + save/close live in TakeoffAssemblyAuthoringModals)
  function openAddPartsToTemplateModal(templateId: string, templateName: string) {
    setAddPartsToTemplateId(templateId)
    setAddPartsToTemplateName(templateName)
    setAddPartsSelectedPartId('')
    setAddPartsAutoAddPartId('')
    setAddPartsToTemplateModalOpen(true)
  }

  // Edit Template Modal Functions (open pointer stays here; the reset + item/
  // price loads moved into TakeoffAssemblyAuthoringModals' open-edge effect)
  function openEditTemplateModal(templateId: string, templateName: string) {
    setEditTemplateModalId(templateId)
    setEditTemplateModalName(templateName)
    setEditTemplateNewItemPartId('')
    setEditTemplateModalOpen(true)
  }

  async function handleBidsPartFormSave(part: MaterialPart) {
    const wasEdit = bidsPartFormIsEditRef.current
    bidsPartFormIsEditRef.current = false

    const capturedRoughLineId = bidsPartFormRoughLineIdRef.current
    bidsPartFormRoughLineIdRef.current = null

    try {
      setTakeoffAddTemplateParts(await loadPartsCatalog<MaterialPartWithType>(supabase, selectedServiceTypeId))
    } catch (e) {
      console.error('Failed to reload the parts catalog after a part save:', e)
    }

    // Routing runs even if that catalog reload failed (v2.1395): the part is
    // already saved, and the whole point of "Save & add" is that it lands.
    if (!wasEdit) {
      const target = resolvePartFormSaveTarget({
        capturedRoughLineId,
        addPartsToTemplateModalOpen,
        editTemplateModalOpen,
        livePickerLineId: takeoffRoughPartPickerLineId,
      })
      switch (target.kind) {
        case 'addPartsToTemplate':
          // v2.1394: stage for auto-add — the modal's effect commits it with
          // the current quantity input and closes, like its sibling flows.
          setAddPartsSelectedPartId(part.id)
          setAddPartsAutoAddPartId(part.id)
          break
        case 'editTemplateItem':
          // Edit Assembly's create-new flow: the cluster consumes this id and
          // adds the part straight to the assembly (v2.1327).
          setEditTemplateNewItemPartId(part.id)
          break
        case 'roughLine':
          setTakeoffRoughPartPickerLineId(null)
          setTakeoffRoughPartSearchQuery('')
          void setRoughPartLinePartAndCatalogPrice(target.lineId, part.id)
          break
        case 'assemblyDraftItem':
          // Add Assembly modal's create-new flow: the cluster consumes this id
          // and adds the part straight to the item list (v2.1326).
          setTakeoffNewItemPartId(part.id)
          break
      }
    }

    setBidsPartFormOpen(false)
    setBidsPartFormEditingPart(null)
  }

  // "Save & add another": refresh the parts caches but keep the modal open and
  // skip the picker routing above — intermediate parts just land in the catalog;
  // the final plain Save still routes into whichever picker opened the form.
  async function handleBidsPartFormSaveAndAddAnother(_part: MaterialPart) {
    try {
      setTakeoffAddTemplateParts(await loadPartsCatalog<MaterialPartWithType>(supabase, selectedServiceTypeId))
    } catch (e) {
      console.error('Failed to reload the parts catalog after a part save:', e)
    }
    setBidsPartFormInitialName('')
  }



  async function applyTakeoffBookTemplates() {
    if (!selectedBidForTakeoff || takeoffCountRows.length === 0 || !selectedTakeoffBookVersionId) return
    if (normalizeMaterialsModel(selectedBidForTakeoff.materials_model) === 'rough') {
      // Combined (v2.2776): expand every matched assembly into part lines on the fixtures that have none.
      if (!bookFillPlan || bookFillPlan.fillable.length === 0) {
        setTakeoffBookApplyMessage(
          bookFillPlan && bookFillPlan.matched > 0 ? 'Every fixture this book matches already has lines.' : 'No entry in this book matches these fixtures yet.',
        )
        setTimeout(() => setTakeoffBookApplyMessage(null), 4000)
        return
      }
      setApplyingTakeoffBookTemplates(true)
      setError(null)
      try {
        const result = await fillRowsFromAssemblies(bookFillPlan.fillable.map((m) => ({ countRowId: m.countRowId, templateIds: m.templateIds })))
        setTakeoffBookApplyMessage(bookFillMessage(result))
        setTimeout(() => setTakeoffBookApplyMessage(null), 6000)
      } catch (e) {
        showToast(formatErrorMessage(e, 'Failed to fill from the book'), 'error')
      } finally {
        setApplyingTakeoffBookTemplates(false)
      }
      return
    }
    setTakeoffBookApplyMessage(null)
    setApplyingTakeoffBookTemplates(true)
    setError(null)
    try {
      const { data: entriesData, error: entriesErr } = await supabase
        .from('takeoff_book_entries')
        .select('id, fixture_name, alias_names')
        .eq('version_id', selectedTakeoffBookVersionId)
        .order('sequence_order', { ascending: true })
      if (entriesErr) {
        setError(`Failed to load takeoff book entries: ${entriesErr.message}`)
        setApplyingTakeoffBookTemplates(false)
        return
      }
      const entriesList = (entriesData as Pick<TakeoffBookEntry, 'id' | 'fixture_name' | 'alias_names'>[]) ?? []
      if (entriesList.length === 0) {
        setTakeoffBookApplyMessage('No new assemblies to add.')
        setTimeout(() => setTakeoffBookApplyMessage(null), 3000)
        setApplyingTakeoffBookTemplates(false)
        return
      }
      const entryIds = entriesList.map((e) => e.id)
      const { data: itemsData, error: itemsErr } = await supabase
        .from('takeoff_book_entry_items')
        .select('entry_id, template_id, stage')
        .in('entry_id', entryIds)
        .order('sequence_order', { ascending: true })
      if (itemsErr) {
        setError(`Failed to load takeoff book entry items: ${itemsErr.message}`)
        setApplyingTakeoffBookTemplates(false)
        return
      }
      const itemsList = (itemsData as { entry_id: string; template_id: string; stage: string }[]) ?? []
      const itemsByEntryId = new Map<string, { template_id: string; stage: string }[]>()
      for (const item of itemsList) {
        const list = itemsByEntryId.get(item.entry_id) ?? []
        list.push({ template_id: item.template_id, stage: item.stage })
        itemsByEntryId.set(item.entry_id, list)
      }
      const existingKeys = new Set(
        takeoffMappings
          .filter((m) => m.templateId && m.stage)
          .map((m) => `${m.countRowId}:${m.templateId}:${m.stage}`)
      )
      const toAdd: TakeoffMapping[] = []
      for (const row of takeoffCountRows) {
        const fixtureLower = (row.fixture ?? '').toLowerCase()
        for (const entry of entriesList) {
          const matchesPrimary = entry.fixture_name.toLowerCase() === fixtureLower
          const matchesAlias = (entry.alias_names ?? []).some((alias: string) => alias.trim().toLowerCase() === fixtureLower)
          if (!matchesPrimary && !matchesAlias) continue
          const items = itemsByEntryId.get(entry.id) ?? []
          for (const item of items) {
            const key = `${row.id}:${item.template_id}:${item.stage}`
            if (existingKeys.has(key)) continue
            existingKeys.add(key)
            toAdd.push({
              id: crypto.randomUUID(),
              countRowId: row.id,
              templateId: item.template_id,
              stage: item.stage as TakeoffStage,
              quantity: Number(row.count),
              isSaved: false,
            })
          }
        }
      }
      if (toAdd.length > 0) setTakeoffMappings((prev) => [...prev, ...toAdd])
      setTakeoffBookApplyMessage(toAdd.length === 0 ? 'No new assemblies to add.' : `Applied ${toAdd.length} assembly(ies).`)
      setTimeout(() => setTakeoffBookApplyMessage(null), 3000)
    } finally {
      setApplyingTakeoffBookTemplates(false)
    }
  }

  function setTakeoffMapping(mappingId: string, updates: { templateId?: string; stage?: TakeoffStage; quantity?: number }) {
    setTakeoffMappings((prev) => {
      const originalMapping = prev.find(m => m.id === mappingId)
      
      // Check if we're changing template or stage on a saved mapping
      // If so, we need to delete the old one and insert a new one
      const isChangingUniqueFields = originalMapping?.isSaved && (
        (updates.templateId !== undefined && updates.templateId !== originalMapping.templateId) ||
        (updates.stage !== undefined && updates.stage !== originalMapping.stage)
      )
      
      let mappingToSave: TakeoffMapping | null = null
      
      const updated = prev.map((m) => {
        if (m.id === mappingId) {
          const updatedMapping = { 
            ...m, 
            ...(updates.templateId !== undefined && { templateId: updates.templateId }), 
            ...(updates.stage !== undefined && { stage: updates.stage }), 
            ...(updates.quantity !== undefined && { quantity: updates.quantity }) 
          }
          
          // If changing unique constraint fields, mark as not saved and generate new ID
          if (isChangingUniqueFields) {
            mappingToSave = { ...updatedMapping, isSaved: false, id: crypto.randomUUID() }
            return mappingToSave
          }
          
          mappingToSave = updatedMapping
          return updatedMapping
        }
        return m
      })
      
      // Delete old mapping if we're changing unique fields
      if (isChangingUniqueFields && originalMapping) {
        supabase
          .from('bids_takeoff_template_mappings')
          .delete()
          .eq('id', originalMapping.id)
          .then(({ error }) => {
            if (error) {
              console.error('Failed to delete old takeoff mapping:', error)
            }
          })
      }
      
      // Save the updated mapping to database
      if (mappingToSave) {
        saveTakeoffMapping(mappingToSave)
      }
      
      return updated
    })
  }

  async function saveTakeoffMapping(mapping: TakeoffMapping) {
    if (!selectedBidForTakeoff?.id || !mapping.templateId) return
    
    const mappingData: any = {
      bid_id: selectedBidForTakeoff.id,
      bid_version_id: selectedBidVersionId,
      count_row_id: mapping.countRowId,
      template_id: mapping.templateId,
      stage: mapping.stage,
      quantity: mapping.quantity,
      sequence_order: takeoffMappings.filter(m => m.countRowId === mapping.countRowId).indexOf(mapping)
    }
    
    // Include ID if this is an existing mapping to ensure we update the correct record
    if (mapping.isSaved) {
      mappingData.id = mapping.id
    }
    
    // Use upsert to handle both insert and update cases
    // When ID is provided, it updates that specific record
    // When ID is not provided and there's a conflict on the unique constraint, it updates the conflicting record
    const { data, error } = await supabase
      .from('bids_takeoff_template_mappings')
      .upsert(mappingData, {
        onConflict: 'count_row_id,template_id,stage,bid_version_id',
        ignoreDuplicates: false
      })
      .select()
      .single()
    
    if (error) {
      console.error('Failed to save takeoff mapping:', error)
      setError(`Failed to save template assignment: ${error.message}`)
    } else if (data && !mapping.isSaved) {
      // Update local state with database ID for newly created mappings
      const savedId = (data as { id: string }).id
      setTakeoffMappings(prev => prev.map(m => 
        m.id === mapping.id ? { ...m, id: savedId, isSaved: true } : m
      ))
    }
  }

  function addTakeoffTemplate(countRowId: string, count?: number) {
    const quantity = count != null && !Number.isNaN(Number(count)) ? Math.max(1, Number(count)) : 1
    const newMapping: TakeoffMapping = { 
      id: crypto.randomUUID(), 
      countRowId, 
      templateId: '', 
      stage: 'rough_in', 
      quantity,
      isSaved: false
    }
    setTakeoffMappings((prev) => [...prev, newMapping])
    // Don't save yet - wait until user selects a template
  }

  async function removeTakeoffMapping(mappingId: string) {
    const mapping = takeoffMappings.find(m => m.id === mappingId)
    
    // Remove from local state first for immediate UI update
    setTakeoffMappings((prev) => prev.filter((m) => m.id !== mappingId))
    
    // If it was saved to database, delete it
    if (mapping?.isSaved) {
      const { error } = await supabase
        .from('bids_takeoff_template_mappings')
        .delete()
        .eq('id', mappingId)
      
      if (error) {
        console.error('Failed to delete takeoff mapping:', error)
        // Revert local change on error
        setTakeoffMappings((prev) => [...prev, mapping])
      }
    }
  }

  useEffect(() => {
    if (!roughQtyNumpadLineId) return
    const closeOnScroll = () => {
      const id = roughQtyNumpadLineIdRef.current
      if (!id) return
      const q = resolveRoughQtyOnClose(roughQtyNumpadDraftRef.current, roughQtyNumpadOriginalRef.current)
      updateTakeoffRoughPartLine(id, { quantity: q })
      setRoughQtyNumpadLineId(null)
      setRoughQtyNumpadPos(null)
      setRoughQtyNumpadDraft('')
      roughQtyNumpadOriginalRef.current = null
    }
    window.addEventListener('scroll', closeOnScroll, true)
    window.addEventListener('resize', closeOnScroll)
    return () => {
      window.removeEventListener('scroll', closeOnScroll, true)
      window.removeEventListener('resize', closeOnScroll)
    }
  }, [roughQtyNumpadLineId])

  function onRoughQtyFocus(lineId: string, input: HTMLInputElement) {
    if (roughQtyBlurTimeoutRef.current) {
      clearTimeout(roughQtyBlurTimeoutRef.current)
      roughQtyBlurTimeoutRef.current = null
    }
    // Commit the previously active line BEFORE overwriting the shared
    // draft/original refs with this line's values.
    const prev = roughQtyNumpadLineIdRef.current
    if (prev && prev !== lineId) {
      const q = resolveRoughQtyOnClose(roughQtyNumpadDraftRef.current, roughQtyNumpadOriginalRef.current)
      updateTakeoffRoughPartLine(prev, { quantity: q })
    }
    setRoughQtyNumpadLineId(lineId)
    const lineRow = takeoffRoughPartLines.find((l) => l.id === lineId)
    // Clear-on-focus (v2.1329): start blank so the next digits type fresh; the
    // original is kept so clicking away without entering anything restores it.
    roughQtyNumpadOriginalRef.current = lineRow ? Number(lineRow.quantity) : null
    setRoughQtyNumpadDraft('')
    const r = input.getBoundingClientRect()
    setRoughQtyNumpadPos({ top: r.bottom + 4, left: r.left })
  }

  function onRoughQtyBlur(lineId: string) {
    if (roughQtyBlurTimeoutRef.current) clearTimeout(roughQtyBlurTimeoutRef.current)
    roughQtyBlurTimeoutRef.current = setTimeout(() => {
      roughQtyBlurTimeoutRef.current = null
      const pad = document.querySelector('[data-rough-qty-pad="true"]')
      const ae = document.activeElement
      if (pad && ae && pad.contains(ae)) return
      if (roughQtyNumpadLineIdRef.current !== lineId) return
      const q = resolveRoughQtyOnClose(roughQtyNumpadDraftRef.current, roughQtyNumpadOriginalRef.current)
      updateTakeoffRoughPartLine(lineId, { quantity: q })
      setRoughQtyNumpadLineId(null)
      setRoughQtyNumpadPos(null)
      setRoughQtyNumpadDraft('')
      roughQtyNumpadOriginalRef.current = null
    }, 150)
  }

  function onRoughQtyInputChange(lineId: string, raw: string) {
    if (roughQtyNumpadLineId === lineId) {
      setRoughQtyNumpadDraft(raw)
    }
    // While the draft is empty (cleared-on-focus or fully deleted), don't stamp
    // the 0.0001 floor over the line — the close paths restore the original.
    if (raw.trim() === '') return
    updateTakeoffRoughPartLine(lineId, { quantity: clampRoughQtyFromDraft(raw) })
  }

  function onRoughQtyPadEscape() {
    const id = roughQtyNumpadLineIdRef.current
    if (!id) return
    const q = resolveRoughQtyOnClose(roughQtyNumpadDraftRef.current, roughQtyNumpadOriginalRef.current)
    updateTakeoffRoughPartLine(id, { quantity: q })
    setRoughQtyNumpadLineId(null)
    setRoughQtyNumpadPos(null)
    setRoughQtyNumpadDraft('')
    roughQtyNumpadOriginalRef.current = null
  }

  function closeTakeoffRemoveConfirm() {
    setTakeoffRemoveConfirm(null)
  }

  function confirmTakeoffRemove() {
    if (!takeoffRemoveConfirm) return
    const target = takeoffRemoveConfirm
    setTakeoffRemoveConfirm(null)
    if (target.kind === 'rough_line') void removeTakeoffRoughPartLine(target.lineId)
    else void removeTakeoffMapping(target.mappingId)
  }

  async function createPOFromTakeoff() {
    if (!authUser?.id || !selectedBidForTakeoff) return
    const mapped = takeoffMappings.filter((m) => m.templateId.trim())
    if (mapped.length === 0) {
      setError('Select an assembly for at least one fixture to create a purchase order.')
      return
    }
    setTakeoffCreatingPO(true)
    setError(null)
    setTakeoffSuccessMessage(null)
    const projectName = selectedBidForTakeoff.project_name?.trim() || 'Project'
    const dateStr = new Date().toLocaleDateString()
    const stages: TakeoffStage[] = ['rough_in', 'top_out', 'trim_set']
    const createdIds: string[] = []
    const createdLabels: string[] = []
    const createdByStage: Partial<Record<'rough_in' | 'top_out' | 'trim_set', string>> = {}
    for (const stage of stages) {
      const mappingsForStage = mapped.filter((m) => m.stage === stage)
      if (mappingsForStage.length === 0) continue
      const stageLabel = STAGE_LABELS[stage]
      const poName = `${projectName} – Takeoff ${dateStr} – ${stageLabel}`
      const { data: poData, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          name: poName,
          status: 'draft',
          created_by: authUser.id,
          notes: null,
          stage,
          service_type_id: selectedServiceTypeId,
        })
        .select('id')
        .single()
      if (poError) {
        setError(`Failed to create PO: ${poError.message}`)
        setTakeoffCreatingPO(false)
        return
      }
      const allParts: Array<{ part_id: string; quantity: number }> = []
      for (const m of mappingsForStage) {
        const qty = Math.max(1, Math.round(Number(m.quantity)) || 1)
        const parts = await expandTemplate(supabase, m.templateId, qty)
        allParts.push(...parts)
      }
      const addErr = await addExpandedPartsToPO(supabase, poData.id, allParts)
      if (addErr) {
        setError(addErr)
        setTakeoffCreatingPO(false)
        return
      }
      createdIds.push(poData.id)
      createdLabels.push(stageLabel)
      createdByStage[stage] = poData.id
    }
    setTakeoffCreatingPO(false)
    setTakeoffSuccessMessage(
      createdLabels.length === 1
        ? `Purchase order "${projectName} – Takeoff ${dateStr} – ${createdLabels[0]}" created. Open Materials → Purchase Orders to edit.`
        : `Purchase orders created for ${createdLabels.join(', ')}. Open Materials → Purchase Orders to edit.`
    )
    setTakeoffCreatedPOId(createdIds[0] ?? null)
    loadDraftPOs()
    if (selectedBidForTakeoff?.id && Object.keys(createdByStage).length > 0) {
      const est = await ensureCostEstimateForBid(selectedBidForTakeoff.id)
      if (est) {
        await supabase
          .from('cost_estimates')
          .update({
            purchase_order_id_rough_in: createdByStage.rough_in ?? est.purchase_order_id_rough_in ?? null,
            purchase_order_id_top_out: createdByStage.top_out ?? est.purchase_order_id_top_out ?? null,
            purchase_order_id_trim_set: createdByStage.trim_set ?? est.purchase_order_id_trim_set ?? null,
          })
          .eq('id', est.id)
        await loadPurchaseOrdersForCostEstimate()
        if ((activeTab === 'labor' || activeTab === 'takeoffs') && selectedBidForCostEstimate?.id === selectedBidForTakeoff.id) {
          await loadCostEstimate(selectedBidForTakeoff.id)
        }
      }
    }
  }

  async function addTakeoffToExistingPO() {
    if (!authUser?.id || !takeoffExistingPOId.trim()) return
    const mapped = takeoffMappings.filter((m) => m.templateId.trim())
    if (mapped.length === 0) {
      setError('Select an assembly for at least one fixture to add to a purchase order.')
      return
    }
    setTakeoffAddingToPO(true)
    setError(null)
    setTakeoffSuccessMessage(null)
    for (const m of mapped) {
      const qty = Math.max(1, Math.round(Number(m.quantity)) || 1)
      const parts = await expandTemplate(supabase, m.templateId, qty)
      const addErr = await addExpandedPartsToPO(supabase, takeoffExistingPOId, parts, m.templateId)
      if (addErr) {
        setError(addErr)
        setTakeoffAddingToPO(false)
        return
      }
    }
    setTakeoffAddingToPO(false)
    const po = draftPOs.find((p) => p.id === takeoffExistingPOId)
    setTakeoffSuccessMessage(`Items added to "${po?.name ?? 'purchase order'}". Open Materials → Purchase Orders to view.`)
    setTakeoffCreatedPOId(takeoffExistingPOId)
    loadDraftPOs()
    setTakeoffExistingPOItems('loading')
    const items = await loadPOItemsSummary(supabase, takeoffExistingPOId)
    setTakeoffExistingPOItems(items)
  }

  async function printTakeoffBreakdown() {
    if (!selectedBidForTakeoff) return
    if (normalizeMaterialsModel(selectedBidForTakeoff.materials_model) === 'rough') {
      const filled = takeoffRoughPartLines.filter((l) => (l.partId ?? '').trim() || l.sourceTemplateId)
      if (filled.length === 0) {
        setError('Add at least one part line with a selected part to print.')
        return
      }
      setTakeoffPrinting(true)
      setError(null)
      try {
        const partIds = Array.from(new Set(filled.map((l) => l.partId).filter((x): x is string => !!x)))
        const { data: partsData } = await supabase.from('material_parts').select('id, name').in('id', partIds)
        const partNameById: Record<string, string> = {}
        for (const p of partsData ?? []) {
          if (p?.id) partNameById[p.id] = p.name ?? ''
        }
        // Bundle lines (no part) display the assembly name.
        for (const l of filled) {
          if (!l.partId && l.sourceTemplateId) {
            const tn = materialTemplates.find((t) => t.id === l.sourceTemplateId)?.name ?? 'Assembly'
            partNameById[l.sourceTemplateId] = `${tn} (bundle)`
          }
        }
        printHtmlInNewWindow(
          buildRoughTakeoffBreakdownHtml({
            title: (bidDisplayName(selectedBidForTakeoff) || 'Bid') + ' — Rough Takeoff',
            rows: takeoffCountRows.map((row) => ({ id: row.id, fixture: row.fixture ?? null, count: Number(row.count) })),
            lines: filled.map((l) => ({
              countRowId: l.countRowId,
              partId: l.partId ?? l.sourceTemplateId ?? '',
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              sequenceOrder: l.sequenceOrder,
            })),
            partNameById,
          }),
        )
      } finally {
        setTakeoffPrinting(false)
      }
      return
    }
    const mapped = takeoffMappings.filter((m) => m.templateId.trim())
    if (mapped.length === 0) {
      setError('No assemblies mapped. Select an assembly for at least one fixture to print.')
      return
    }
    setTakeoffPrinting(true)
    setError(null)
    try {
      const stageOrder: TakeoffStage[] = ['rough_in', 'top_out', 'trim_set']
      const stages: Array<{
        stageLabel: string
        rows: Array<{ fixture: string; count: number; parts: Array<{ partName: string; quantity: number; templateName: string }> }>
      }> = []

      for (const stage of stageOrder) {
        const mappingsForStage = mapped.filter((m) => m.stage === stage)
        if (mappingsForStage.length === 0) continue

        const countRowIds = Array.from(new Set(mappingsForStage.map((m) => m.countRowId)))
        const stageRows: Array<{ fixture: string; count: number; parts: Array<{ partName: string; quantity: number; templateName: string }> }> = []

        for (const countRowId of countRowIds) {
          const row = takeoffCountRows.find((r) => r.id === countRowId)
          const fixture = row?.fixture ?? '—'
          const count = row ? Number(row.count) : 0
          const mappingsForRow = mappingsForStage.filter((m) => m.countRowId === countRowId)

          // Parts for this count line item, with template association (don't merge so we keep template per part)
          const partsWithTemplate: Array<{ part_id: string; quantity: number; template_name: string }> = []
          for (const m of mappingsForRow) {
            const qty = Math.max(1, Math.round(Number(m.quantity)) || 1)
            const parts = await expandTemplate(supabase, m.templateId, qty)
            const templateName = materialTemplates.find((t) => t.id === m.templateId)?.name ?? '—'
            for (const { part_id, quantity } of parts) {
              partsWithTemplate.push({ part_id, quantity, template_name: templateName })
            }
          }

          const partIds = Array.from(new Set(partsWithTemplate.map((p) => p.part_id)))
          const { data: partsData } = await supabase.from('material_parts').select('id, name').in('id', partIds)
          const nameById = new Map<string, string>()
          for (const p of partsData ?? []) {
            if (p?.id) nameById.set(p.id, p.name ?? '')
          }

          const parts = partsWithTemplate
            .sort((a, b) => {
              const nameCmp = (nameById.get(a.part_id) ?? '').localeCompare(nameById.get(b.part_id) ?? '')
              if (nameCmp !== 0) return nameCmp
              return a.template_name.localeCompare(b.template_name)
            })
            .map((p) => ({
              partName: nameById.get(p.part_id) ?? p.part_id.slice(0, 8),
              quantity: p.quantity,
              templateName: p.template_name,
            }))

          stageRows.push({ fixture, count, parts })
        }

        stages.push({ stageLabel: STAGE_LABELS[stage], rows: stageRows })
      }

      if (stages.length === 0) {
        setError('No mappings with assemblies to print.')
        return
      }

      printHtmlInNewWindow(
        buildExactTakeoffBreakdownHtml({
          title: (bidDisplayName(selectedBidForTakeoff) || 'Bid') + ' — Takeoff Breakdown',
          stages,
        }),
      )
    } finally {
      setTakeoffPrinting(false)
    }
  }

  const takeoffRoughCatalogLowestPartIdsKey = useMemo(() => {
    if (activeTab !== 'takeoffs' || !selectedBidForTakeoff?.id) return ''
    if (normalizeMaterialsModel(selectedBidForTakeoff.materials_model) !== 'rough') return ''
    const ids = takeoffRoughPartLines.map((l) => (l.partId ?? '').trim()).filter(Boolean)
    return Array.from(new Set(ids)).sort().join(',')
  }, [activeTab, selectedBidForTakeoff?.id, selectedBidForTakeoff?.materials_model, takeoffRoughPartLines])

  useEffect(() => {
    if (!takeoffRoughCatalogLowestPartIdsKey) {
      setTakeoffRoughCatalogLowestByPartId({})
      return
    }
    const ids = takeoffRoughCatalogLowestPartIdsKey.split(',').filter(Boolean)
    let cancelled = false
    void (async () => {
      try {
        const map = await fetchLowestPartPricesBatch(supabase, ids)
        if (cancelled) return
        const next: Record<string, { price: number; supplyHouseName: string }> = {}
        for (const [pid, row] of map) {
          next[pid] = { price: row.price, supplyHouseName: row.supplyHouseName }
        }
        setTakeoffRoughCatalogLowestByPartId(next)
      } catch (e) {
        if (!cancelled) showToast(formatErrorMessage(e, 'Failed to load catalog prices'), 'error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [takeoffRoughCatalogLowestPartIdsKey, showToast])

  // Distinct assembly template ids among the on-screen Combined bundle lines.
  const takeoffBundleTemplateIdsKey = useMemo(() => {
    if (activeTab !== 'takeoffs' || !selectedBidForTakeoff?.id) return ''
    if (normalizeMaterialsModel(selectedBidForTakeoff.materials_model) !== 'rough') return ''
    const ids = takeoffRoughPartLines
      .filter((l) => l.partId == null && l.sourceTemplateId)
      .map((l) => l.sourceTemplateId as string)
    return Array.from(new Set(ids)).sort().join(',')
  }, [activeTab, selectedBidForTakeoff?.id, selectedBidForTakeoff?.materials_model, takeoffRoughPartLines])

  // Lazily load the grayed part rows for each bundle assembly that isn't cached yet.
  useEffect(() => {
    const ids = takeoffBundleTemplateIdsKey.split(',').filter(Boolean)
    const missing = ids.filter((id) => !(id in bundlePartsByTemplateId))
    if (missing.length === 0) return
    let cancelled = false
    void (async () => {
      for (const templateId of missing) {
        try {
          const lines = await loadBundlePartLines(supabase, templateId)
          if (cancelled) return
          setBundlePartsByTemplateId((prev) => ({ ...prev, [templateId]: lines }))
        } catch (e) {
          if (!cancelled) showToast(formatErrorMessage(e, 'Failed to load bundle parts'), 'error')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [takeoffBundleTemplateIdsKey, bundlePartsByTemplateId, showToast])

  // Drop a template's cached grayed part rows so the lazy effect refetches them
  // after the assembly's parts change.
  function invalidateBundleParts(templateId: string) {
    setBundlePartsByTemplateId((prev) => {
      if (!(templateId in prev)) return prev
      const next = { ...prev }
      delete next[templateId]
      return next
    })
  }

  function toggleBundleLineCollapsed(lineId: string) {
    setCollapsedBundleLineIds((prev) => {
      const next = new Set(prev)
      if (next.has(lineId)) next.delete(lineId)
      else next.add(lineId)
      return next
    })
  }

  useEffect(() => {
    const prev = prevPartPricesModalRef.current
    prevPartPricesModalRef.current = partPricesModal
    if (prev == null || partPricesModal != null) return
    if (activeTab !== 'takeoffs' || !selectedBidForTakeoff?.id) return
    if (normalizeMaterialsModel(selectedBidForTakeoff.materials_model) !== 'rough') return
    if (!takeoffRoughCatalogLowestPartIdsKey) return
    void refreshTakeoffRoughCatalogLowest(takeoffRoughCatalogLowestPartIdsKey.split(',').filter(Boolean))
  }, [
    partPricesModal,
    activeTab,
    selectedBidForTakeoff?.id,
    selectedBidForTakeoff?.materials_model,
    takeoffRoughCatalogLowestPartIdsKey,
    refreshTakeoffRoughCatalogLowest,
  ])



  useEffect(() => {
    if (activeTab !== 'takeoffs' || !selectedBidForTakeoff?.id) return
    if (normalizeMaterialsModel(selectedBidForTakeoff.materials_model) !== 'rough') return
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('material_template_items')
        .select('template_id, item_type, part_id, nested_template_id, quantity')
      if (cancelled || error || !data) return
      setPartAssemblyIndex(buildPartAssemblyIndex(data as PartAssemblyIndexItem[]))
    })()
    return () => { cancelled = true }
  }, [activeTab, selectedBidForTakeoff?.id, selectedBidForTakeoff?.materials_model, supabase, materialTemplates])


  useEffect(() => {
    if (!takeoffExistingPOId.trim()) {
      setTakeoffExistingPOItems(null)
      return
    }
    setTakeoffExistingPOItems('loading')
    let cancelled = false
    void (async () => {
      const items = await loadPOItemsSummary(supabase, takeoffExistingPOId)
      if (cancelled) return
      setTakeoffExistingPOItems(items)
    })()
    return () => { cancelled = true }
  }, [takeoffExistingPOId])



  function applyBundleQuoteToLine(lineId: string, price: number, supplyHouseName: string) {
    updateTakeoffRoughPartLine(lineId, { unitPrice: Math.max(0, Number(price) || 0), sourceMaterialPartPriceId: null })
    setBundleBreakdownModal(null)
    showToast(`Applied ${supplyHouseName} bundle price ($${(Number(price) || 0).toFixed(2)}).`, 'success')
  }

  /** v2.1638: the Prices modal's "Use" button — pin a supply house's catalog price on a part line (bid override; sticks even when it isn't the lowest). */
  function applyCatalogPriceToLine(lineId: string, price: number, supplyHouseName: string) {
    updateTakeoffRoughPartLine(lineId, { unitPrice: Math.max(0, Number(price) || 0), sourceMaterialPartPriceId: null })
    showToast(`Applied ${supplyHouseName} price ($${(Number(price) || 0).toFixed(2)}).`, 'success')
  }



  const bidsScopedForTakeoff = onlyMyBids ? bids.filter(isMyBid) : bids
  const filteredBidsForTakeoff = takeoffSearchQuery.trim()
    ? bidsScopedForTakeoff.filter(
        (b) =>
          (b.project_name?.toLowerCase().includes(takeoffSearchQuery.toLowerCase()) ?? false) ||
          (b.address?.toLowerCase().includes(takeoffSearchQuery.toLowerCase()) ?? false) ||
          (b.customers?.name?.toLowerCase().includes(takeoffSearchQuery.toLowerCase()) ?? false) ||
          (b.bids_gc_builders?.name?.toLowerCase().includes(takeoffSearchQuery.toLowerCase()) ?? false) ||
          bidNumberMatchesQuery(b, takeoffSearchQuery, ledgerPrefixMap)
      )
    : bidsScopedForTakeoff

  const takeoffMappedCount = takeoffMappings.filter((m) => m.templateId.trim()).length
  const takeoffRoughFilledLineCount = takeoffRoughPartLines.filter((l) => (l.partId?.trim() || l.sourceTemplateId)).length

  function filterTemplatesByQuery(
    templates: MaterialTemplateWithAssemblyType[],
    query: string,
    limit = 50
  ): MaterialTemplateWithAssemblyType[] {
    const q = (query || '').trim().toLowerCase()
    if (!q) return templates.slice(0, limit)
    return templates
      .filter((t) => [t.name, t.description].some((f) => (f || '').toLowerCase().includes(q)))
      .slice(0, limit)
  }

  function takeoffTemplatePickerOptions(mapping: TakeoffMapping): MaterialTemplateWithAssemblyType[] {
    const filtered = filterTemplatesByQuery(materialTemplates, takeoffTemplatePickerQuery, 50)
    const selected = mapping.templateId ? materialTemplates.find((t) => t.id === mapping.templateId) : null
    if (!selected) return filtered
    if (filtered.some((t) => t.id === selected.id)) return filtered
    return [selected, ...filtered]
  }

  function filterPartsByQuery(parts: MaterialPartWithType[], query: string, limit = 50): MaterialPartWithType[] {
    const q = (query || '').trim().toLowerCase()
    if (!q) return parts.slice(0, limit)
    return parts
      .filter((p) => [p.name, p.manufacturer, p.part_types?.name, p.notes].some((f) => (f || '').toLowerCase().includes(q)))
      .slice(0, limit)
  }

  // Add assembly modal, filtered to assemblies containing one part ("In N assemblies" link).
  const roughAddAssemblyFilterEntries = roughAddAssemblyPartFilter
    ? partAssemblyEntriesFor(roughAddAssemblyPartFilter.partId)
    : null
  const roughAddAssemblyTemplates = roughAddAssemblyFilterEntries
    ? materialTemplates.filter((t) => roughAddAssemblyFilterEntries.some((e) => e.templateId === t.id))
    : materialTemplates

  return (
    <>
        {takeoffRemoveConfirm != null && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="takeoff-remove-confirm-title"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.45)',
              zIndex: 2000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
            }}
            onClick={closeTakeoffRemoveConfirm}
          >
            <div
              style={{
                background: 'var(--surface)',
                padding: '1.5rem',
                borderRadius: 8,
                maxWidth: 420,
                width: '100%',
                boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="takeoff-remove-confirm-title" style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}>
                Remove this line?
              </h3>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: 'var(--text-700)', lineHeight: 1.5 }}>
                {takeoffRemoveConfirm.kind === 'rough_line'
                  ? 'This part line will be removed from the takeoff. You can add it again later.'
                  : 'This assembly line will be removed from the takeoff. You can add an assembly again later.'}
              </p>
              <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                <strong>Delete</strong> is focused when this dialog opens—press <strong>Space</strong> or{' '}
                <strong>Enter</strong> to remove the line, or choose <strong>Cancel</strong> / <strong>Esc</strong> to
                keep it.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={closeTakeoffRemoveConfirm}
                  style={{
                    padding: '0.4rem 0.85rem',
                    background: 'var(--bg-muted)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  Cancel
                </button>
                <button
                  ref={takeoffRemoveConfirmDeleteRef}
                  type="button"
                  onClick={() => confirmTakeoffRemove()}
                  style={{
                    padding: '0.4rem 0.85rem',
                    background: '#b91c1c',
                    color: 'white',
                    border: '1px solid #991b1b',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
        <div>
          {!selectedBidForTakeoff && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
              <input
                type="text"
                placeholder="Search bids (bid #, project name, or GC/Builder)..."
                value={takeoffSearchQuery}
                onChange={(e) => setTakeoffSearchQuery(e.target.value)}
                style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }}
              />
              <BidPickerSortToggle />
              <MyBidsToggle active={onlyMyBids} onChange={setOnlyMyBids} />
            </div>
          )}
          {selectedBidForTakeoff && (
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
                  onClick={() => { onClose(); setTakeoffCreatedPOId(null) }}
                  title="Close"
                  aria-label="Close"
                  style={bidDetailCloseFloatMobileStyle}
                >
                  ×
                </button>
              ) : null}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', minWidth: 0 }}>
                  <BidWorkflowTabTitleWithPreview
                    bid={selectedBidForTakeoff}
                    previewEnabled={bidPreview != null}
                    onOpenPreview={() => bidPreview?.openBidPreviewFromBid(selectedBidForTakeoff)}
                  />
                  <TakeoffViewPills view={takeoffView} onChange={switchTakeoffView} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => void printTakeoffBreakdown()}
                    disabled={takeoffPrinting}
                    style={{ padding: '0.5rem 1rem', background: takeoffPrinting ? '#9ca3af' : '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: takeoffPrinting ? 'wait' : 'pointer' }}
                  >
                    {takeoffPrinting ? 'Preparing…' : 'Print'}
                  </button>
                  {!narrowViewport640 ? (
                    <button
                      type="button"
                      onClick={() => { onClose(); setTakeoffCreatedPOId(null) }}
                      title="Close"
                      aria-label="Close"
                      style={bidDetailCloseXStyle}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              </div>
              {takeoffView !== 'old' ? (
                <TakeoffNewViewPlaceholder view={takeoffView} onBackToOld={() => switchTakeoffView('old')} />
              ) : (
              <>
              {(() => {
                const takeoffMaterialsModel = normalizeMaterialsModel(selectedBidForTakeoff.materials_model)
                return (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    <span
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        marginRight: '0.25rem',
                        color: 'var(--text-600)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Materials
                    </span>
                    <button
                      type="button"
                      onClick={() => openMaterialsModelSwitch('exact', 'takeoffs')}
                      style={{
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.8125rem',
                        border: '1px solid var(--border-strong)',
                        borderRadius: 4,
                        background: takeoffMaterialsModel === 'exact' ? 'var(--bg-200)' : 'var(--surface)',
                        cursor: 'pointer',
                        fontWeight: takeoffMaterialsModel === 'exact' ? 600 : 400,
                        color: takeoffMaterialsModel === 'exact' ? 'var(--text-strong)' : 'var(--text-muted)',
                        boxShadow: takeoffMaterialsModel === 'exact' ? '0 0 0 2px #374151' : 'none',
                      }}
                    >
                      By Stage
                    </button>
                    <button
                      type="button"
                      onClick={() => openMaterialsModelSwitch('rough', 'takeoffs')}
                      style={{
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.8125rem',
                        border: '1px solid var(--border-strong)',
                        borderRadius: 4,
                        background: takeoffMaterialsModel === 'rough' ? 'var(--bg-200)' : 'var(--surface)',
                        cursor: 'pointer',
                        fontWeight: takeoffMaterialsModel === 'rough' ? 600 : 400,
                        color: takeoffMaterialsModel === 'rough' ? 'var(--text-strong)' : 'var(--text-muted)',
                        boxShadow: takeoffMaterialsModel === 'rough' ? '0 0 0 2px #374151' : 'none',
                      }}
                    >
                      Combined
                    </button>
                  </div>
                )
              })()}
              {/* Takeoff book selector (left) + Apply button (right), styled like the Labor tab. */}
              <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.875rem', marginRight: '0.5rem' }}>Takeoff book</label>
                  <select
                    value={selectedTakeoffBookVersionId ?? ''}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v) {
                        setSelectedTakeoffBookVersionId(v)
                        saveBidSelectedTakeoffBookVersion(selectedBidForTakeoff.id, v)
                      } else {
                        setSelectedTakeoffBookVersionId(null)
                        saveBidSelectedTakeoffBookVersion(selectedBidForTakeoff.id, null)
                      }
                    }}
                    title={takeoffBookVersions.find((v) => v.id === selectedTakeoffBookVersionId)?.name ?? undefined}
                    style={{ padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, minWidth: '12rem' }}
                  >
                    <option value="">— Select a book —</option>
                    {takeoffBookVersions.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
                {takeoffCountRows.length > 0 && selectedTakeoffBookVersionId && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => applyTakeoffBookTemplates()}
                      disabled={bookFillButton.disabled}
                      title={bookFillButton.title || undefined}
                      style={{
                        padding: '0.35rem 0.75rem',
                        background: bookFillButton.disabled ? '#9ca3af' : '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        cursor: applyingTakeoffBookTemplates ? 'wait' : bookFillButton.disabled ? 'default' : 'pointer',
                        fontSize: '0.875rem',
                      }}
                    >
                      {bookFillButton.label}
                    </button>
                    {takeoffBookApplyMessage && (
                      <span style={{ color: 'var(--text-green-600)', fontSize: '0.875rem' }}>{takeoffBookApplyMessage}</span>
                    )}
                  </div>
                )}
              </div>
              {takeoffCountRows.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>Add fixtures in the Counts tab first.</p>
              ) : (
                <>
                  {normalizeMaterialsModel(selectedBidForTakeoff.materials_model) === 'exact' ? (
                  <>
                  <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    Select an Assembly for each Fixture or Tie-in you want to include in a PO (Purchase Order). Materials broken down by stage allows for staged billing.
                  </p>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ background: 'var(--bg-subtle)' }}>
                        <tr>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Fixture or Tie-in</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Assembly</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Parts</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Stage</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>Quantity</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {takeoffCountRows.map((row) => {
                          const mappingsForRow = takeoffMappings.filter((m) => m.countRowId === row.id)
                          if (mappingsForRow.length === 0) {
                            return (
                              <tr key={row.id} id={takeoffRowDomId(row.id)} style={{ borderBottom: '1px solid var(--border)', background: rowJumpFlashCountRowId === row.id ? 'var(--bg-blue-tint)' : undefined, transition: 'background 400ms ease' }}>
                                <td style={{ padding: '0.75rem' }}>{takeoffFixtureCountLabel(row)}</td>
                                <td colSpan={5} style={{ padding: '0.75rem' }}>
                                  <button
                                    type="button"
                                    onClick={() => addTakeoffTemplate(row.id, Number(row.count))}
                                    style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                  >
                                    Add assembly
                                  </button>
                                </td>
                              </tr>
                            )
                          }
                          const PREVIEW_MAX_PARTS = 5
                          return (
                            <Fragment key={row.id}>
                              {mappingsForRow.map((mapping, mappingIdx) => {
                                const preview = mapping.templateId ? takeoffTemplatePreviewCache[mapping.templateId] : undefined
                                const templateName = mapping.templateId ? materialTemplates.find((t) => t.id === mapping.templateId)?.name ?? null : null
                                let partsCell: React.ReactNode = '—'
                                if (mapping.templateId) {
                                  if (preview === undefined || preview === 'loading') partsCell = 'Loading…'
                                  else if (preview === null) partsCell = 'Error loading parts'
                                  else if (!Array.isArray(preview) || preview.length === 0) partsCell = (
                                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                      No parts{' '}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          openAddPartsToTemplateModal(mapping.templateId!, templateName!)
                                        }}
                                        style={{
                                          padding: '0.25rem 0.5rem',
                                          background: '#3b82f6',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: 4,
                                          cursor: 'pointer',
                                          fontSize: '0.75rem',
                                          fontWeight: 500
                                        }}
                                      >
                                        Add Parts
                                      </button>
                                    </span>
                                  )
                                  else {
                                    const short = preview.slice(0, PREVIEW_MAX_PARTS).map((p) => `${p.part_name} (${p.quantity})`).join(', ')
                                    const rest = preview.length > PREVIEW_MAX_PARTS ? preview.length - PREVIEW_MAX_PARTS : 0
                                    partsCell = (
                                      <span style={{ fontSize: '0.875rem' }}>
                                        {short}
                                        {rest > 0 && (
                                          <>
                                            {' '}
                                            <button
                                              type="button"
                                              onClick={() => { setTakeoffPreviewModalTemplateId(mapping.templateId); setTakeoffPreviewModalTemplateName(templateName) }}
                                              style={{ background: 'none', border: 'none', color: 'var(--text-blue-500)', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                                            >
                                              and {rest} more
                                            </button>
                                          </>
                                        )}
                                        {rest === 0 && preview.length > 2 && (
                                          <>
                                            {' '}
                                            <button
                                              type="button"
                                              onClick={() => { setTakeoffPreviewModalTemplateId(mapping.templateId); setTakeoffPreviewModalTemplateName(templateName) }}
                                              style={{ background: 'none', border: 'none', color: 'var(--text-blue-500)', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                                            >
                                              View all
                                            </button>
                                          </>
                                        )}
                                      </span>
                                    )
                                  }
                                }
                                return (
                                  <tr key={mapping.id} id={mappingIdx === 0 ? takeoffRowDomId(row.id) : undefined} style={{ borderBottom: '1px solid var(--border)', background: rowJumpFlashCountRowId === row.id ? 'var(--bg-blue-tint)' : undefined, transition: 'background 400ms ease' }}>
                                    <td style={{ padding: '0.75rem' }}>{takeoffFixtureCountLabel(row)}</td>
                                    <td style={{ padding: '0.75rem' }}>
                                      <div style={{ position: 'relative' }}>
                                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                          <input
                                            ref={(el) => {
                                              if (el) takeoffTemplatePickerInputRefs.current.set(mapping.id, el)
                                              else takeoffTemplatePickerInputRefs.current.delete(mapping.id)
                                            }}
                                            type="text"
                                            value={takeoffTemplatePickerOpenMappingId === mapping.id ? takeoffTemplatePickerQuery : (mapping.templateId ? (materialTemplates.find((t) => t.id === mapping.templateId)?.name ?? '') : '')}
                                            onChange={(e) => setTakeoffTemplatePickerQuery(e.target.value)}
                                            onFocus={() => { setTakeoffTemplatePickerOpenMappingId(mapping.id); setTakeoffTemplatePickerQuery('') }}
                                            onBlur={() => setTimeout(() => setTakeoffTemplatePickerOpenMappingId(null), 150)}
                                            onKeyDown={(e) => { if (e.key === 'Escape') setTakeoffTemplatePickerOpenMappingId(null) }}
                                            readOnly={takeoffTemplatePickerOpenMappingId !== mapping.id && !!mapping.templateId}
                                            placeholder="Search assemblies by name or description…"
                                            style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: takeoffTemplatePickerOpenMappingId !== mapping.id && mapping.templateId ? 'var(--bg-muted)' : undefined }}
                                          />
                                          {mapping.templateId && takeoffTemplatePickerOpenMappingId !== mapping.id && (
                                            <button
                                              type="button"
                                              onClick={() => { setTakeoffMapping(mapping.id, { templateId: '' }); setTakeoffTemplatePickerOpenMappingId(mapping.id); setTakeoffTemplatePickerQuery('') }}
                                              style={{ padding: '0.25rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                            >
                                              Clear
                                            </button>
                                          )}
                                        </div>
                                        {mapping.templateId && takeoffTemplatePickerOpenMappingId !== mapping.id ? (
                                          <div
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'space-between',
                                              gap: '0.35rem',
                                              marginTop: '0.2rem',
                                              minWidth: 0,
                                            }}
                                          >
                                            <span
                                              style={{
                                                fontSize: '0.7rem',
                                                color: 'var(--text-muted)',
                                                textAlign: 'left',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                minWidth: 0,
                                                flex: 1,
                                              }}
                                            >
                                              {(() => {
                                                const assemblyTypeName =
                                                  materialTemplates.find((t) => t.id === mapping.templateId)
                                                    ?.assembly_types?.name ?? '—'
                                                return `Assembly · ${assemblyTypeName}`
                                              })()}
                                            </span>
                                            <button
                                              type="button"
                                              aria-label="Edit assembly"
                                              title="Edit assembly"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                openEditTemplateModal(mapping.templateId!, templateName ?? '')
                                              }}
                                              style={{
                                                flexShrink: 0,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                minWidth: 28,
                                                minHeight: 28,
                                                padding: '0.2rem',
                                                background: 'none',
                                                border: 'none',
                                                borderRadius: 4,
                                                cursor: 'pointer',
                                                color: 'var(--text-muted)',
                                              }}
                                            >
                                              <TakeoffPartEditIcon />
                                            </button>
                                          </div>
                                        ) : null}
                                      </div>
                                    </td>
                                    <td style={{ padding: '0.75rem', fontSize: '0.875rem', maxWidth: 280 }}>{partsCell}</td>
                                    <td style={{ padding: '0.75rem' }}>
                                      <select
                                        value={mapping.stage}
                                        onChange={(e) => setTakeoffMapping(mapping.id, { stage: e.target.value as TakeoffStage })}
                                        style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                                      >
                                        {(['rough_in', 'top_out', 'trim_set'] as const).map((s) => (
                                          <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                                        ))}
                                      </select>
                                    </td>
                                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                      <input
                                        type="number"
                                        min={1}
                                        value={mapping.quantity}
                                        onChange={(e) => setTakeoffMapping(mapping.id, { quantity: e.target.value === '' ? 1 : Number(e.target.value) })}
                                        style={{ width: 80, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, textAlign: 'center' }}
                                      />
                                    </td>
                                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                      <button
                                        type="button"
                                        onClick={() => setTakeoffRemoveConfirm({ kind: 'exact_mapping', mappingId: mapping.id })}
                                        style={{ padding: '0.25rem 0.5rem', background: 'var(--bg-red-tint)', color: 'var(--text-red-700)', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer' }}
                                      >
                                        Remove
                                      </button>
                                    </td>
                                  </tr>
                                )
                              })}
                              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '0.75rem' }} />
                                <td colSpan={5} style={{ padding: '0.75rem' }}>
                                  <button
                                    type="button"
                                    onClick={() => addTakeoffTemplate(row.id, Number(row.count))}
                                    style={{ padding: '0.5rem 1rem', background: 'var(--bg-indigo-100)', color: 'var(--text-indigo-800)', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                  >
                                    Add assembly
                                  </button>
                                </td>
                              </tr>
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={createPOFromTakeoff}
                      disabled={takeoffCreatingPO || takeoffMappedCount === 0}
                      style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: takeoffCreatingPO || takeoffMappedCount === 0 ? 'not-allowed' : 'pointer' }}
                    >
                      {takeoffCreatingPO ? 'Creating…' : 'Create purchase orders for Stages'}
                    </button>
                    <button
                      type="button"
                      onClick={printTakeoffBreakdown}
                      disabled={takeoffPrinting || takeoffMappedCount === 0}
                      style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: takeoffPrinting || takeoffMappedCount === 0 ? 'not-allowed' : 'pointer' }}
                    >
                      {takeoffPrinting ? 'Preparing…' : 'Print Breakdown'}
                    </button>
                    <select
                      value={takeoffExistingPOId}
                      onChange={(e) => setTakeoffExistingPOId(e.target.value)}
                      style={{ padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, minWidth: 200 }}
                    >
                      <option value="">OR add to existing PO…</option>
                      {draftPOs.map((po) => (
                        <option key={po.id} value={po.id}>{po.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={addTakeoffToExistingPO}
                      disabled={takeoffAddingToPO || takeoffMappedCount === 0 || !takeoffExistingPOId.trim()}
                      style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: takeoffAddingToPO || takeoffMappedCount === 0 || !takeoffExistingPOId ? 'not-allowed' : 'pointer' }}
                    >
                      {takeoffAddingToPO ? 'Adding…' : 'Add to selected PO'}
                    </button>
                  </div>
                  {takeoffExistingPOId.trim() && (
                    <div style={{ marginTop: '1rem', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden', maxHeight: 240, overflowY: 'auto' }}>
                      <div style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: '0.875rem' }}>
                        Current items in this PO
                      </div>
                      {takeoffExistingPOItems === 'loading' && (
                        <p style={{ padding: '0.75rem 1rem', margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading current items…</p>
                      )}
                      {takeoffExistingPOItems === null && (
                        <p style={{ padding: '0.75rem 1rem', margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Could not load items.</p>
                      )}
                      {Array.isArray(takeoffExistingPOItems) && takeoffExistingPOItems.length === 0 && (
                        <p style={{ padding: '0.75rem 1rem', margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>This PO has no items yet.</p>
                      )}
                      {Array.isArray(takeoffExistingPOItems) && takeoffExistingPOItems.length > 0 && (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                          <thead style={{ background: 'var(--bg-subtle)' }}>
                            <tr>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Part</th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Assembly</th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>Qty</th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Price</th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {takeoffExistingPOItems.map((item, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '0.5rem 0.75rem' }}>{item.part_name}</td>
                                <td style={{ padding: '0.5rem 0.75rem' }}>{item.template_name ?? '—'}</td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>{item.quantity}</td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>${item.price_at_time.toFixed(2)}</td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>${(item.quantity * item.price_at_time).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot style={{ background: 'var(--bg-subtle)' }}>
                            <tr>
                              <td colSpan={4} style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600, borderTop: '1px solid var(--border)' }}>Grand Total:</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600, borderTop: '1px solid var(--border)' }}>
                                ${takeoffExistingPOItems.reduce((sum, item) => sum + item.quantity * item.price_at_time, 0).toFixed(2)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      )}
                    </div>
                  )}
                  </>
                  ) : (
                  <>
                  <DndContext
                    sensors={roughPartLinesSensors}
                    collisionDetection={closestCenter}
                    onDragStart={() => {
                      const id = roughQtyNumpadLineIdRef.current
                      if (!id) return
                      const q = resolveRoughQtyOnClose(roughQtyNumpadDraftRef.current, roughQtyNumpadOriginalRef.current)
                      updateTakeoffRoughPartLine(id, { quantity: q })
                      setRoughQtyNumpadLineId(null)
                      setRoughQtyNumpadPos(null)
                      setRoughQtyNumpadDraft('')
                      roughQtyNumpadOriginalRef.current = null
                    }}
                    onDragEnd={(e) => {
                      void handleRoughPartLinesDragEnd(e)
                    }}
                  >
                  {/* overflow visible (not hidden): the part-search dropdown is position:absolute
                      and was clipped at the container edge on the sheet's last rows. */}
                  <div style={{ border: '1px solid var(--border)', borderRadius: 4 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ background: 'var(--bg-subtle)' }}>
                        <tr>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Fixture or Tie-in</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Part or Assembly</th>
                          <th
                            style={{
                              padding: '0.75rem',
                              paddingLeft: 'calc(0.75rem + 0.35rem)',
                              paddingRight: '0.25rem',
                              textAlign: 'left',
                              borderBottom: '1px solid var(--border)',
                            }}
                          >
                            Unit price
                          </th>
                          <th
                            style={{
                              padding: '0.35rem 0.05rem 0.35rem 0.125rem',
                              textAlign: 'center',
                              borderBottom: '1px solid var(--border)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Qty
                          </th>
                          <th
                            style={{
                              padding: '0.35rem 0.5rem 0.35rem 0.05rem',
                              textAlign: 'right',
                              borderBottom: '1px solid var(--border)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Line total
                          </th>
                          <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {takeoffCountRows.map((row) => {
                          const linesForRow = takeoffRoughPartLines
                            .filter((l) => l.countRowId === row.id)
                            .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
                          return (
                            <Fragment key={row.id}>
                              {linesForRow.length === 0 ? (
                                <tr id={takeoffRowDomId(row.id)} style={{ borderBottom: '1px solid var(--border)', background: rowJumpFlashCountRowId === row.id ? 'var(--bg-blue-tint)' : undefined, transition: 'background 400ms ease' }}>
                                  <td style={{ padding: '0.75rem' }}>{takeoffFixtureCountLabel(row)}</td>
                                  <td colSpan={5} style={{ padding: '0.75rem' }}>
                                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.875rem' }}>
                                      <span
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => addTakeoffRoughPartLine(row.id)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault()
                                            addTakeoffRoughPartLine(row.id)
                                          }
                                        }}
                                        style={{
                                          color: 'var(--text-blue-700)',
                                          cursor: 'pointer',
                                          textDecoration: 'underline',
                                          textUnderlineOffset: '2px',
                                        }}
                                      >
                                        Add part line
                                      </span>
                                      <span
                                        role={materialTemplates.length === 0 ? undefined : 'button'}
                                        tabIndex={materialTemplates.length === 0 ? -1 : 0}
                                        aria-disabled={materialTemplates.length === 0}
                                        onClick={() => {
                                          if (materialTemplates.length === 0) return
                                          setRoughAddAssemblyModalCountRowId(row.id)
                                          setRoughAddAssemblySearchQuery('')
                                        }}
                                        onKeyDown={(e) => {
                                          if (materialTemplates.length === 0) return
                                          if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault()
                                            setRoughAddAssemblyModalCountRowId(row.id)
                                            setRoughAddAssemblySearchQuery('')
                                          }
                                        }}
                                        style={{
                                          color: 'var(--text-600)',
                                          cursor: materialTemplates.length === 0 ? 'not-allowed' : 'pointer',
                                          textDecoration: materialTemplates.length === 0 ? 'none' : 'underline',
                                          textUnderlineOffset: '2px',
                                          opacity: materialTemplates.length === 0 ? 0.5 : 1,
                                        }}
                                      >
                                        Add assembly
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              ) : (
                                <SortableContext items={linesForRow.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                                  {linesForRow.map((line, lineIdx) => (
                                    <SortableRoughPartLineRow
                                      key={line.id}
                                      line={line}
                                      lineIdx={lineIdx}
                                      row={row}
                                      jumpFlash={rowJumpFlashCountRowId === row.id}
                                      showSaveAsAssembly={linesForRow.some((l) => l.partId?.trim())}
                                      onSaveAsAssembly={() => openSaveAsAssemblyFromRough(row.id, row)}
                                      takeoffAddTemplateParts={takeoffAddTemplateParts}
                                      takeoffRoughPartPickerLineId={takeoffRoughPartPickerLineId}
                                      setTakeoffRoughPartPickerLineId={setTakeoffRoughPartPickerLineId}
                                      takeoffRoughPartSearchQuery={takeoffRoughPartSearchQuery}
                                      setTakeoffRoughPartSearchQuery={setTakeoffRoughPartSearchQuery}
                                      takeoffRoughCatalogLowestByPartId={takeoffRoughCatalogLowestByPartId}
                                      setRoughPartLinePartAndCatalogPrice={setRoughPartLinePartAndCatalogPrice}
                                      updateTakeoffRoughPartLine={updateTakeoffRoughPartLine}
                                      resetRoughLineToCatalogPrice={resetRoughLineToCatalogPrice}
                                      setPartPricesModal={setPartPricesModal}
                                      onRequestRemoveRoughLine={(lineId) => setTakeoffRemoveConfirm({ kind: 'rough_line', lineId })}
                                      onOpenBundleBreakdown={(templateId, lineId, assemblyName) => setBundleBreakdownModal({ templateId, lineId, assemblyName })}
                                      bundlePartLines={line.partId == null && line.sourceTemplateId ? bundlePartsByTemplateId[line.sourceTemplateId] : undefined}
                                      bundleCollapsed={collapsedBundleLineIds.has(line.id)}
                                      onToggleBundleCollapsed={() => toggleBundleLineCollapsed(line.id)}
                                      openBidsPartFormForCreate={openBidsPartFormForCreate}
                                      onOpenEditTakeoffPart={(partId) => {
                                        const p = takeoffAddTemplateParts.find((x) => x.id === partId)
                                        if (p) openBidsPartFormForEdit(p)
                                      }}
                                      materialTemplates={materialTemplates}
                                      filterPartsByQuery={filterPartsByQuery}
                                      partAssemblyCount={partAssemblyEntriesFor(line.partId).length}
                                      onShowAssembliesForPart={(partId) => openAssembliesForPart(row.id, partId)}
                                      roughQtyNumpadLineId={roughQtyNumpadLineId}
                                      roughQtyNumpadDraft={roughQtyNumpadDraft}
                                      onRoughQtyFocus={onRoughQtyFocus}
                                      onRoughQtyBlur={onRoughQtyBlur}
                                      onRoughQtyInputChange={onRoughQtyInputChange}
                                      onRoughQtyPadEscape={onRoughQtyPadEscape}
                                    />
                                  ))}
                                </SortableContext>
                              )}
                              {linesForRow.length > 0 ? (
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                  <td style={{ padding: '0.75rem' }} />
                                  <td colSpan={5} style={{ padding: '0.75rem' }}>
                                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.875rem' }}>
                                      <span
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => addTakeoffRoughPartLine(row.id)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault()
                                            addTakeoffRoughPartLine(row.id)
                                          }
                                        }}
                                        style={{
                                          color: 'var(--text-blue-700)',
                                          cursor: 'pointer',
                                          textDecoration: 'underline',
                                          textUnderlineOffset: '2px',
                                        }}
                                      >
                                        Add part line
                                      </span>
                                      <span
                                        role={materialTemplates.length === 0 ? undefined : 'button'}
                                        tabIndex={materialTemplates.length === 0 ? -1 : 0}
                                        aria-disabled={materialTemplates.length === 0}
                                        onClick={() => {
                                          if (materialTemplates.length === 0) return
                                          setRoughAddAssemblyModalCountRowId(row.id)
                                          setRoughAddAssemblySearchQuery('')
                                        }}
                                        onKeyDown={(e) => {
                                          if (materialTemplates.length === 0) return
                                          if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault()
                                            setRoughAddAssemblyModalCountRowId(row.id)
                                            setRoughAddAssemblySearchQuery('')
                                          }
                                        }}
                                        style={{
                                          color: 'var(--text-600)',
                                          cursor: materialTemplates.length === 0 ? 'not-allowed' : 'pointer',
                                          textDecoration: materialTemplates.length === 0 ? 'none' : 'underline',
                                          textUnderlineOffset: '2px',
                                          opacity: materialTemplates.length === 0 ? 0.5 : 1,
                                        }}
                                      >
                                        Add assembly
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              ) : null}
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  </DndContext>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={printTakeoffBreakdown}
                      disabled={takeoffPrinting || takeoffRoughFilledLineCount === 0}
                      style={{
                        padding: '0.5rem 1rem',
                        background: 'var(--bg-muted)',
                        border: '1px solid var(--border-strong)',
                        borderRadius: 4,
                        cursor: takeoffPrinting || takeoffRoughFilledLineCount === 0 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {takeoffPrinting ? 'Preparing…' : 'Print Breakdown'}
                    </button>
                  </div>
                  </>
                  )}
                  {takeoffSuccessMessage && (
                    <p style={{ margin: '1rem 0 0', color: 'var(--text-green-600)', fontSize: '0.875rem' }}>{takeoffSuccessMessage}</p>
                  )}
                  {takeoffCreatedPOId && (
                    <p style={{ margin: '0.75rem 0 0' }}>
                      <Link
                        to="/materials"
                        state={{ openPOId: takeoffCreatedPOId }}
                        style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}
                      >
                        View purchase order
                      </Link>
                    </p>
                  )}
                </>
              )}
              </>
              )}
            </div>
          )}

          {roughAddAssemblyModalCountRowId && (
            <div
              role="presentation"
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1110,
              }}
              onClick={() => {
                if (!roughAddAssemblyExpanding) closeRoughAddAssemblyModal()
              }}
            >
              <div
                style={{
                  background: 'var(--surface)',
                  padding: '1.5rem',
                  borderRadius: 8,
                  maxWidth: 440,
                  width: '90%',
                  maxHeight: '85vh',
                  overflowY: 'auto',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Add assembly</h2>
                  <button
                    type="button"
                    disabled={roughAddAssemblyExpanding}
                    onClick={closeRoughAddAssemblyModal}
                    style={{ background: 'none', border: 'none', cursor: roughAddAssemblyExpanding ? 'not-allowed' : 'pointer', fontSize: '1.25rem', lineHeight: 1 }}
                  >
                    ×
                  </button>
                </div>
                <input
                  type="text"
                  value={roughAddAssemblySearchQuery}
                  onChange={(e) => setRoughAddAssemblySearchQuery(e.target.value)}
                  placeholder="Search assemblies by name or description…"
                  disabled={roughAddAssemblyExpanding}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, marginBottom: '0.5rem' }}
                />
                {roughAddAssemblyPartFilter ? (
                  <div style={{ marginBottom: '0.5rem' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.8125rem',
                        color: 'var(--text-blue-700)',
                        background: 'var(--bg-blue-tint)',
                        border: '1px solid var(--border-blue)',
                        borderRadius: 999,
                        padding: '0.15rem 0.6rem',
                        maxWidth: '100%',
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        Containing: {roughAddAssemblyPartFilter.partName}
                      </span>
                      <button
                        type="button"
                        aria-label="Clear part filter"
                        title="Show all assemblies"
                        disabled={roughAddAssemblyExpanding}
                        onClick={() => setRoughAddAssemblyPartFilter(null)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: roughAddAssemblyExpanding ? 'not-allowed' : 'pointer',
                          color: 'var(--text-blue-700)',
                          fontSize: '0.9rem',
                          lineHeight: 1,
                        }}
                      >
                        ×
                      </button>
                    </span>
                  </div>
                ) : null}
                <ul
                  style={{
                    margin: 0,
                    padding: 0,
                    listStyle: 'none',
                    maxHeight: '70vh',
                    overflowY: 'auto',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                  }}
                >
                  {filterTemplatesByQuery(roughAddAssemblyTemplates, roughAddAssemblySearchQuery, 50).length === 0 ? (
                    <li style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>
                      {roughAddAssemblyPartFilter ? 'No assemblies include this part.' : 'No assemblies match.'}
                    </li>
                  ) : (
                    filterTemplatesByQuery(roughAddAssemblyTemplates, roughAddAssemblySearchQuery, 50).map((t) => (
                      <li key={t.id} style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid var(--border)' }}>
                        <button
                          type="button"
                          disabled={roughAddAssemblyExpanding}
                          title="Expand this assembly into individual part lines"
                          onClick={() => {
                            void applyRoughAddAssemblyTemplate(roughAddAssemblyModalCountRowId, t.id)
                          }}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            textAlign: 'left',
                            padding: '0.5rem 0.75rem',
                            border: 'none',
                            background: roughAddAssemblyExpanding ? 'var(--bg-subtle)' : 'var(--surface)',
                            cursor: roughAddAssemblyExpanding ? 'not-allowed' : 'pointer',
                          }}
                        >
                          <div style={{ fontWeight: 500 }}>{t.name}</div>
                          {t.description ? (
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t.description}</div>
                          ) : null}
                          {roughAddAssemblyFilterEntries && roughAddAssemblyPartFilter ? (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-blue-700)' }}>
                              includes {roughAddAssemblyPartFilter.partName} ×
                              {roughAddAssemblyFilterEntries.find((e) => e.templateId === t.id)?.quantity ?? 0}
                            </div>
                          ) : null}
                        </button>
                        <button
                          type="button"
                          disabled={roughAddAssemblyExpanding}
                          title="Add as one bundle line, priced at this assembly's supply-house price"
                          onClick={() => {
                            void applyRoughAddAssemblyBundle(roughAddAssemblyModalCountRowId, t.id)
                          }}
                          style={{
                            flexShrink: 0,
                            padding: '0.5rem 0.75rem',
                            border: 'none',
                            borderLeft: '1px solid var(--border)',
                            background: roughAddAssemblyExpanding ? 'var(--bg-subtle)' : 'var(--bg-blue-tint)',
                            color: 'var(--text-blue-700)',
                            fontWeight: 600,
                            fontSize: '0.8125rem',
                            whiteSpace: 'nowrap',
                            cursor: roughAddAssemblyExpanding ? 'not-allowed' : 'pointer',
                          }}
                        >
                          Add as bundle
                        </button>
                      </li>
                    ))
                  )}
                </ul>
                {roughAddAssemblyExpanding ? (
                  <p style={{ margin: '0.75rem 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Adding parts…</p>
                ) : null}
              </div>
            </div>
          )}

          {takeoffPreviewModalTemplateId && (
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
              onClick={() => { setTakeoffPreviewModalTemplateId(null); setTakeoffPreviewModalTemplateName(null) }}
            >
              <div
                style={{
                  background: 'var(--surface)',
                  borderRadius: 8,
                  padding: '1.5rem',
                  maxWidth: 420,
                  maxHeight: '80vh',
                  overflow: 'auto',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>{takeoffPreviewModalTemplateName ?? 'Assembly parts'}</h3>
                  <button
                    type="button"
                    onClick={() => { setTakeoffPreviewModalTemplateId(null); setTakeoffPreviewModalTemplateName(null) }}
                    style={{ padding: '0.25rem 0.5rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Close
                  </button>
                </div>
                {(() => {
                  const preview = takeoffTemplatePreviewCache[takeoffPreviewModalTemplateId]
                  if (preview === 'loading') return <p style={{ margin: 0, color: 'var(--text-muted)' }}>Loading…</p>
                  if (preview === null) return <p style={{ margin: 0, color: 'var(--text-red-700)' }}>Error loading parts.</p>
                  if (!preview || preview.length === 0) return (
                    <div>
                      <p style={{ margin: 0, marginBottom: '1rem', color: 'var(--text-muted)' }}>No parts in this assembly.</p>
                      <button
                        type="button"
                        onClick={() => {
                          openAddPartsToTemplateModal(takeoffPreviewModalTemplateId, takeoffPreviewModalTemplateName!)
                          setTakeoffPreviewModalTemplateId(null)
                          setTakeoffPreviewModalTemplateName(null)
                        }}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontWeight: 500
                        }}
                      >
                        Add Parts
                      </button>
                    </div>
                  )
                  return (
                    <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                      {preview.map((p, i) => (
                        <li key={i} style={{ marginBottom: '0.25rem' }}>{p.part_name} ({p.quantity})</li>
                      ))}
                    </ul>
                  )
                })()}
              </div>
            </div>
          )}
          {!selectedBidForTakeoff && (
            <BidPickerStandardList
              bids={filteredBidsForTakeoff}
              prefixMap={ledgerPrefixMap}
              onSelectBid={onSelectBid}
              emptyMessage={takeoffSearchQuery.trim() ? 'No bids match your search.' : null}
            />
          )}
          {/* Takeoff-book admin section (collapsible) + its version/entry form modals */}
          <TakeoffBookAdminSection
            selectedBidForTakeoff={selectedBidForTakeoff}
            selectedServiceTypeId={selectedServiceTypeId}
            setError={setError}
            materialTemplates={materialTemplates}
            takeoffBookVersions={takeoffBookVersions}
            takeoffBookEntries={takeoffBookEntries}
            setTakeoffBookEntries={setTakeoffBookEntries}
            takeoffBookEntriesVersionId={takeoffBookEntriesVersionId}
            setTakeoffBookEntriesVersionId={setTakeoffBookEntriesVersionId}
            selectedTakeoffBookVersionId={selectedTakeoffBookVersionId}
            setSelectedTakeoffBookVersionId={setSelectedTakeoffBookVersionId}
            loadTakeoffBookVersions={loadTakeoffBookVersions}
            loadTakeoffBookEntries={loadTakeoffBookEntries}
            saveBidSelectedTakeoffBookVersion={saveBidSelectedTakeoffBookVersion}
            loadBids={loadBids}
          />
          {/* Cost-estimate materials section + PO review modal (moved from Labor tab) */}
          <BidsTakeoffMaterialsSummarySection
            selectedBidForTakeoff={selectedBidForTakeoff}
            selectedBidForCostEstimate={selectedBidForCostEstimate}
            costEstimate={costEstimate}
            costEstimateCountRows={costEstimateCountRows}
            purchaseOrdersForCostEstimate={purchaseOrdersForCostEstimate}
            costEstimateMaterialTotalRoughIn={costEstimateMaterialTotalRoughIn}
            costEstimateMaterialTotalTopOut={costEstimateMaterialTotalTopOut}
            costEstimateMaterialTotalTrimSet={costEstimateMaterialTotalTrimSet}
            setCostEstimatePO={setCostEstimatePO}
            costEstimatePOModalTaxPercent={costEstimatePOModalTaxPercent}
            setCostEstimatePOModalTaxPercent={setCostEstimatePOModalTaxPercent}
          />
        </div>
      <PartFormModal
        isOpen={bidsPartFormOpen}
        onClose={closeBidsPartForm}
        onSave={handleBidsPartFormSave}
        onSaveAndAddAnother={handleBidsPartFormSaveAndAddAnother}
        addModeSaveLabel="Save & add"
        editingPart={bidsPartFormEditingPart}
        initialName={bidsPartFormInitialName}
        selectedServiceTypeId={selectedServiceTypeId}
        supplyHouses={supplyHouses}
        partTypes={partTypes}
        serviceTypes={serviceTypes}
      />

      {/* Assembly authoring modal cluster (T7): Add Assembly / Add Parts to
          Template / Edit Template. Open pointers, the PartFormModal-routed
          picker states, and the Save-as-Assembly bridge stay parent-owned;
          internal data/edit state lives in the component. */}
      <TakeoffAssemblyAuthoringModals
        error={error}
        setError={setError}
        selectedServiceTypeId={selectedServiceTypeId}
        supplyHouses={supplyHouses}
        materialTemplates={materialTemplates}
        loadMaterialTemplates={loadMaterialTemplates}
        takeoffAddTemplateParts={takeoffAddTemplateParts}
        setTakeoffTemplatePreviewCache={setTakeoffTemplatePreviewCache}
        invalidateBundleParts={invalidateBundleParts}
        filterPartsByQuery={filterPartsByQuery}
        filterTemplatesByQuery={filterTemplatesByQuery}
        openBidsPartFormForCreate={openBidsPartFormForCreate}
        setPartPricesModal={setPartPricesModal}
        takeoffAddTemplateModalOpen={takeoffAddTemplateModalOpen}
        setTakeoffAddTemplateModalOpen={setTakeoffAddTemplateModalOpen}
        takeoffAddTemplateForMappingId={takeoffAddTemplateForMappingId}
        setTakeoffAddTemplateForMappingId={setTakeoffAddTemplateForMappingId}
        takeoffNewTemplateName={takeoffNewTemplateName}
        setTakeoffNewTemplateName={setTakeoffNewTemplateName}
        takeoffNewTemplateItems={takeoffNewTemplateItems}
        setTakeoffNewTemplateItems={setTakeoffNewTemplateItems}
        takeoffNewItemPartId={takeoffNewItemPartId}
        setTakeoffNewItemPartId={setTakeoffNewItemPartId}
        saveAsAssemblyCountRowId={saveAsAssemblyCountRowId}
        setSaveAsAssemblyCountRowId={setSaveAsAssemblyCountRowId}
        takeoffNewTemplateApplyPriceIndex={takeoffNewTemplateApplyPriceIndex}
        setTakeoffNewTemplateApplyPriceIndex={setTakeoffNewTemplateApplyPriceIndex}
        setTakeoffMapping={setTakeoffMapping}
        takeoffRoughPartLines={takeoffRoughPartLines}
        setTakeoffRoughPartLines={setTakeoffRoughPartLines}
        insertRoughBundleLine={insertRoughBundleLine}
        addPartsToTemplateModalOpen={addPartsToTemplateModalOpen}
        setAddPartsToTemplateModalOpen={setAddPartsToTemplateModalOpen}
        addPartsToTemplateId={addPartsToTemplateId}
        setAddPartsToTemplateId={setAddPartsToTemplateId}
        addPartsToTemplateName={addPartsToTemplateName}
        setAddPartsToTemplateName={setAddPartsToTemplateName}
        addPartsSelectedPartId={addPartsSelectedPartId}
        setAddPartsSelectedPartId={setAddPartsSelectedPartId}
        addPartsAutoAddPartId={addPartsAutoAddPartId}
        setAddPartsAutoAddPartId={setAddPartsAutoAddPartId}
        editTemplateModalOpen={editTemplateModalOpen}
        setEditTemplateModalOpen={setEditTemplateModalOpen}
        editTemplateModalId={editTemplateModalId}
        setEditTemplateModalId={setEditTemplateModalId}
        editTemplateModalName={editTemplateModalName}
        setEditTemplateModalName={setEditTemplateModalName}
        editTemplateNewItemPartId={editTemplateNewItemPartId}
        setEditTemplateNewItemPartId={setEditTemplateNewItemPartId}
      />

      {/* Bundle breakdown modal (parts-vs-bundle comparison for a rough Assembly line) */}
      <TakeoffBundleBreakdownModal
        bundleBreakdownModal={bundleBreakdownModal}
        setBundleBreakdownModal={setBundleBreakdownModal}
        applyBundleQuoteToLine={applyBundleQuoteToLine}
        openEditTemplateModal={openEditTemplateModal}
      />

      {/* Part Prices modal - check/modify prices for a part from Add/Edit Assembly */}
      <TakeoffPartPricesModal
        partPricesModal={partPricesModal}
        setPartPricesModal={setPartPricesModal}
        supplyHouses={supplyHouses}
        setError={setError}
        onUsePriceForLine={applyCatalogPriceToLine}
      />

      {roughQtyNumpadLineId != null && roughQtyNumpadPos != null
        ? createPortal(
            <div
              data-rough-qty-pad="true"
              role="toolbar"
              aria-label="Numeric entry"
              onPointerDown={(e) => e.preventDefault()}
              style={{
                position: 'fixed',
                top: roughQtyNumpadPos.top,
                left: roughQtyNumpadPos.left,
                zIndex: 1200,
                padding: '0.35rem',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
              }}
            >
              <NumericEntryPad
                allowDecimal
                widthPx={132}
                value={roughQtyNumpadDraft}
                onChange={(next) => {
                  setRoughQtyNumpadDraft(next)
                  // Empty draft = nothing entered yet — close paths restore the original.
                  if (next.trim() === '') return
                  updateTakeoffRoughPartLine(roughQtyNumpadLineId, { quantity: clampRoughQtyFromDraft(next) })
                }}
              />
            </div>,
            document.body
          )
        : null}
      {takeoffTemplatePickerOpenMappingId != null && takeoffTemplatePickerAnchor
        ? createPortal(
            <ul
              onMouseDown={(e) => e.preventDefault()}
              style={{
                position: 'fixed',
                top: takeoffTemplatePickerAnchor.top,
                left: takeoffTemplatePickerAnchor.left,
                width: takeoffTemplatePickerAnchor.width,
                margin: 0,
                padding: 0,
                listStyle: 'none',
                maxHeight: 240,
                overflowY: 'auto',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                background: 'var(--surface)',
                zIndex: 1200,
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
              }}
            >
              {(() => {
                const openMapping = takeoffMappings.find((m) => m.id === takeoffTemplatePickerOpenMappingId)
                if (!openMapping) return null
                const options = takeoffTemplatePickerOptions(openMapping)
                return options.length === 0 ? (
                  <li style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>
                    No templates match.{' '}
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setTakeoffAddTemplateModalOpen(true)
                        setTakeoffAddTemplateForMappingId(openMapping.id)
                        setTakeoffTemplatePickerOpenMappingId(null)
                      }}
                      style={{ marginLeft: '0.25rem', padding: '0.25rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
                    >
                      Add assembly
                    </button>
                  </li>
                ) : (
                  options.map((t) => (
                    <li
                      key={t.id}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setTakeoffMapping(openMapping.id, { templateId: t.id })
                        setTakeoffTemplatePickerQuery('')
                        setTakeoffTemplatePickerOpenMappingId(null)
                      }}
                      style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                    >
                      <div style={{ fontWeight: 500 }}>{t.name}</div>
                      {t.description && <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t.description}</div>}
                    </li>
                  ))
                )
              })()}
            </ul>,
            document.body
          )
        : null}
    </>
  )
}

