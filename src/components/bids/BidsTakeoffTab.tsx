import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { createPortal } from 'react-dom'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { supabase } from '../../lib/supabase'
import { loadPartsCatalog } from '../../lib/materials/partsCatalog'
import { useTakeoffPartsCatalog } from '../../hooks/useTakeoffPartsCatalog'
import { useTakeoffRoughLines } from '../../hooks/useTakeoffRoughLines'
import { SortableRoughPartLineRow, type PartType } from './SortableRoughPartLineRow'
import { TakeoffBookAdminSection } from './TakeoffBookAdminSection'
import { BidsTakeoffMaterialsSummarySection } from './BidsTakeoffMaterialsSummarySection'
import { TakeoffPartPricesModal } from './TakeoffPartPricesModal'
import { TakeoffBundleBreakdownModal } from './TakeoffBundleBreakdownModal'
import { TakeoffAssemblyAuthoringModals, type TakeoffNewTemplateItemDraft } from './TakeoffAssemblyAuthoringModals'
import { fetchLowestPartPricesBatch } from '../../lib/materialPartCatalogPrice'
import { formatErrorMessage } from '../../utils/errorHandling'
import { printHtmlInNewWindow } from '../../lib/bidDocuments/htmlDoc'
import { buildRoughTakeoffBreakdownHtml } from '../../lib/bidDocuments/takeoffBreakdown'
import { bidDisplayName } from '../../lib/bids/bidFormatting'
import { bidDetailCloseXStyle, bidDetailCloseFloatMobileStyle } from '../../lib/bids/bidStyles'
import {
  clampRoughQtyFromDraft,
  resolveRoughQtyOnClose,
  takeoffFixtureCountLabel,
  mergePartLinesToTakeoffTemplateItems,
  saveAsAssemblyDefaultName,
} from '../../lib/bids/bidTakeoffHelpers'
import { loadBundlePartLines, type BundlePartLine } from '../../lib/bids/assemblyBundleBreakdown'
import type { PartAssemblyEntry } from '../../lib/bids/partAssemblyIndex'
import { loadPartAssemblyIndex } from '../../lib/bids/partAssemblyIndexIo'
import { BidWorkflowTabTitleWithPreview } from './BidWorkflowTabTitleWithPreview'
import { BidFlowStrip } from './BidFlowStrip'
import { deriveBidFlow, type BidFlowDoor, type BidFlowStep } from '../../lib/bids/bidFlow'
import { useBidFlowFacts } from '../../hooks/useBidFlowFacts'
import { useBidFlowReview } from '../../hooks/useBidFlowReview'
import { useBidFlowFold } from '../../hooks/useBidFlowFold'
import { BidPickerStandardList } from './BidPickerStandardList'
import { TakeoffViewPills } from './TakeoffViewPills'
import { TakeoffFocusView } from './TakeoffFocusView'
import { TakeoffCostRailView } from './TakeoffCostRailView'
import { TakeoffViewChooser } from './TakeoffViewChooser'
import { RfqComposeModal } from './RfqComposeModal'
import { bidPackageLabel } from '../../lib/bidPackageLabel'
import { useTakeoffFixtureHistory } from '../../hooks/useTakeoffFixtureHistory'
import type { CopyFromBidCandidate } from '../../lib/bids/takeoffFixtureHistory'
import { summarizeTakeoffCoverage } from '../../lib/bids/takeoffCoverage'
import {
  DEFAULT_SOV_MATERIAL_FACTOR,
  computeMaterialsByStage,
  describeRulePlan,
  indexStageSplits,
  parseStageSplitJson,
  planRuleFill,
  type BundlePartInput,
  type StageSplitRecord,
  type StageSplitSource,
  type StageWeights,
} from '../../lib/bids/materialsByStage'
import {
  bundlePartInputs,
  loadAssemblyPartStageSplits,
  loadSovMaterialFactorDefault,
  loadStageSplitsForBid,
  saveAssemblyPartStageSplit,
  saveBookEntryStageSplit,
  saveFixtureSplitsBatch,
  saveStageSplit,
  type StageSplitRowRecord,
  type StageSplitScopeKey,
} from '../../lib/bids/materialsByStageIo'
import { StageSplitChips } from './StageSplitChips'
import { matchBookEntries } from '../../lib/bids/takeoffBookMatch'
import { buildScheduleOfValuesHtml, fixtureStageText } from '../../lib/bidDocuments/scheduleOfValues'
import { TakeoffStagesPanel } from './TakeoffStagesPanel'
import { planRememberForBook } from '../../lib/bids/takeoffBookLearn'
import { rememberFixtureForBook } from '../../lib/bids/takeoffBookLearnWrite'
import type { TakeoffFixtureHistoryLine } from '../../types/database-functions'
import { hasStoredTakeoffView, readStoredTakeoffView, writeStoredTakeoffView, type TakeoffView } from '../../lib/bids/takeoffView'
import { pickHopRow, rowIdFromTakeoffTableTarget } from '../../lib/bids/takeoffHop'
import { bookFillMessage, fillFromBookLabel, planBookFill } from '../../lib/bids/takeoffBookFill'
import { BidPickerSearchRow } from './BidPickerSearchRow'
import { bidNumberMatchesQuery, type LedgerPrefixMap } from '../../lib/ledgerDisplayPrefixes'
import { PartFormModal } from '../PartFormModal'
import { resolvePartFormSaveTarget } from '../../lib/bids/partFormSaveTarget'
import { NumericEntryPad } from '../NumericEntryPad'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useBookPrices } from '../../hooks/useTakeoffPriceDrift'
import { roughCountMultiplier } from '../../lib/bids/bidTakeoffHelpers'
import { formatSentDay, pricingLockState, readRevisedBids } from '../../lib/bids/pricingLock'
import { gapWords, takeoffPriceDrift } from '../../lib/bids/takeoffPriceDrift'
import { TakeoffPriceDriftLine } from './TakeoffPriceDrift'
import { breakdownJumpDomId, breakdownJumpMissMessage, takeoffRowDomId, type BreakdownJumpTarget } from '../../lib/bids/bidTabRowJump'
import { usePendingRowFlash } from '../../hooks/usePendingRowFlash'
import type { useBidPreview } from '../../contexts/BidPreviewModalContext'
import type { useBidPricingEngine } from '../../hooks/useBidPricingEngine'
import type { Database } from '../../types/database'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import type { BidCountRow } from '../../types/bids'
import { isAlternateRow } from '../../lib/bids/countSheet'
import { isDeclinedRow, jobScopeRows } from '../../lib/bids/alternateAcceptance'
import type {
  MaterialTemplateWithAssemblyType,
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
  loadBids: (serviceTypeId?: string | null) => Promise<BidWithBuilder[]>
  activeTab: string
  // Shared controlled state
  costEstimatePOModalTaxPercent: string
  setCostEstimatePOModalTaxPercent: Dispatch<SetStateAction<string>>
  // Engine values + setters/loaders
  takeoffCountRows: BidsTakeoffEngine['takeoffCountRows']
  takeoffRoughPartLines: BidsTakeoffEngine['takeoffRoughPartLines']
  setTakeoffRoughPartLines: BidsTakeoffEngine['setTakeoffRoughPartLines']
  takeoffRoughCatalogLowestByPartId: BidsTakeoffEngine['takeoffRoughCatalogLowestByPartId']
  setTakeoffRoughCatalogLowestByPartId: BidsTakeoffEngine['setTakeoffRoughCatalogLowestByPartId']
  materialTemplates: BidsTakeoffEngine['materialTemplates']
  takeoffBookVersions: BidsTakeoffEngine['takeoffBookVersions']
  takeoffBookEntries: BidsTakeoffEngine['takeoffBookEntries']
  setTakeoffBookEntries: BidsTakeoffEngine['setTakeoffBookEntries']
  selectedTakeoffBookVersionId: BidsTakeoffEngine['selectedTakeoffBookVersionId']
  setSelectedTakeoffBookVersionId: BidsTakeoffEngine['setSelectedTakeoffBookVersionId']
  takeoffBookEntriesVersionId: BidsTakeoffEngine['takeoffBookEntriesVersionId']
  setTakeoffBookEntriesVersionId: BidsTakeoffEngine['setTakeoffBookEntriesVersionId']
  costEstimateCountRows: BidsTakeoffEngine['costEstimateCountRows']
  costEstimateMaterialTotalRoughIn: BidsTakeoffEngine['costEstimateMaterialTotalRoughIn']
  loadTakeoffBookVersions: BidsTakeoffEngine['loadTakeoffBookVersions']
  loadTakeoffBookEntries: BidsTakeoffEngine['loadTakeoffBookEntries']
  saveBidSelectedTakeoffBookVersion: BidsTakeoffEngine['saveBidSelectedTakeoffBookVersion']
  loadMaterialTemplates: BidsTakeoffEngine['loadMaterialTemplates']
  // Callbacks
  onSelectBid: (bid: BidWithBuilder) => void
  onClose: () => void
  onEditBid: (bid: BidWithBuilder) => void
  /** v2.3216: open a step's door from the strip — Edit window or another tab — and land on its field. The page owns it. */
  onOpenBidFlowDoor?: (bid: BidWithBuilder, door: BidFlowDoor, step: BidFlowStep) => void
  /** Role gating for those doors (superintendents never reach Pricing / Cover Letter). */
  bidFlowDoorAllowed?: (door: BidFlowDoor) => boolean
  ledgerPrefixMap: LedgerPrefixMap
  onlyMyBids: boolean
  setOnlyMyBids: (next: boolean) => void
  isMyBid: (bid: BidWithBuilder) => boolean
}

export function BidsTakeoffTab({
  onOpenBidFlowDoor,
  bidFlowDoorAllowed,
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
  loadBids,
  activeTab,
  costEstimatePOModalTaxPercent,
  setCostEstimatePOModalTaxPercent,
  takeoffCountRows,
  takeoffRoughPartLines,
  setTakeoffRoughPartLines,
  takeoffRoughCatalogLowestByPartId,
  setTakeoffRoughCatalogLowestByPartId,
  materialTemplates,
  takeoffBookVersions,
  takeoffBookEntries,
  setTakeoffBookEntries,
  selectedTakeoffBookVersionId,
  setSelectedTakeoffBookVersionId,
  takeoffBookEntriesVersionId,
  setTakeoffBookEntriesVersionId,
  costEstimateCountRows,
  costEstimateMaterialTotalRoughIn,
  loadTakeoffBookVersions,
  loadTakeoffBookEntries,
  saveBidSelectedTakeoffBookVersion,
  loadMaterialTemplates,
  onSelectBid,
  onClose,
  ledgerPrefixMap,
  onlyMyBids,
  setOnlyMyBids,
  isMyBid,
}: BidsTakeoffTabProps) {
  // Bid flow facts for the selected bid (one chunked read per selection).
  const { factsByBid: bidFlowFactsByBid } = useBidFlowFacts(selectedBidForTakeoff ? [selectedBidForTakeoff.id] : [])
  const bidFlowReview = useBidFlowReview(selectedBidForTakeoff ? [selectedBidForTakeoff] : [])
  // v2.3241: the strip folds to one line beside the title; per device.
  const flowFold = useBidFlowFold()
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
  // Seamless hop between views (v2.2998): the fixture you are on follows you across Old / One at a
  // time / Sheet. `takeoffTouchedRowId` is the last row clicked or focused in any view (or One at a
  // time's focused fixture), remembered per bid for the session; a hop reuses the v2.2784 focus
  // request (One at a time focuses it, Sheet drops its filter) plus its own scroll-and-flash.
  const [takeoffTouchedRowId, setTakeoffTouchedRowId] = useState<string | null>(null)
  const takeoffTouchedByBidRef = useRef<Map<string, string>>(new Map())
  const noteTakeoffRow = (rowId: string | null) => {
    setTakeoffTouchedRowId(rowId)
    const bidId = selectedBidForTakeoff?.id
    if (bidId && rowId) takeoffTouchedByBidRef.current.set(bidId, rowId)
  }
  useEffect(() => {
    const bidId = selectedBidForTakeoff?.id
    setTakeoffTouchedRowId(bidId ? takeoffTouchedByBidRef.current.get(bidId) ?? null : null)
  }, [selectedBidForTakeoff?.id])
  const [hopFlash, setHopFlash] = useState<{ countRowId: string; nonce: number } | null>(null)
  const hopFlashDomId = usePendingRowFlash(hopFlash ? takeoffRowDomId(hopFlash.countRowId) : null, () => {}, { nonce: hopFlash?.nonce })
  /** While the flash is on, every row of the jumped-to fixture tints (a fixture can own several assembly rows). */
  const rowJumpFlashCountRowId =
    rowJumpFlashDomId != null ? (lastRowJumpRef.current?.countRowId ?? null) : hopFlashDomId != null ? (hopFlash?.countRowId ?? null) : null

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
    null | { kind: 'rough_line'; lineId: string }
  >(null)
  const takeoffRemoveConfirmDeleteRef = useRef<HTMLButtonElement>(null)
  const [takeoffPrinting, setTakeoffPrinting] = useState(false)
  const [applyingTakeoffBookTemplates, setApplyingTakeoffBookTemplates] = useState(false)
  // Assembly authoring cluster (T7): the modal open pointers, the states
  // handleBidsPartFormSave routes into, and the Add-Assembly drafts seeded by
  // openSaveAsAssemblyFromRough stay parent-owned; the rest of the cluster's
  // state lives in TakeoffAssemblyAuthoringModals.
  const [takeoffAddTemplateModalOpen, setTakeoffAddTemplateModalOpen] = useState(false)
  const [takeoffNewTemplateName, setTakeoffNewTemplateName] = useState('')
  const [takeoffNewTemplateItems, setTakeoffNewTemplateItems] = useState<TakeoffNewTemplateItemDraft[]>([])
  // When the Add-Assembly modal was opened via "Save as Assembly" from a rough count
  // row, this holds that count row id. On save, if a bundle price is selected below,
  // the row's individual part lines are collapsed into one bundle line at that price.
  const [saveAsAssemblyCountRowId, setSaveAsAssemblyCountRowId] = useState<string | null>(null)
  // Index into takeoffNewTemplatePrices chosen to override the takeoff line (null = none).
  const [takeoffNewTemplateApplyPriceIndex, setTakeoffNewTemplateApplyPriceIndex] = useState<number | null>(null)

  type MaterialPartWithType = MaterialPart & { part_types?: PartType | null }
  // One at a time / Sheet (v2.2768; Old retired v2.3588, docs/TAKEOFFS_REFRESH_PLAN.md): per-device, default One at a time.
  const [takeoffView, setTakeoffView] = useState<TakeoffView>(() =>
    readStoredTakeoffView(typeof window !== 'undefined' ? window.localStorage : null),
  )
  const switchTakeoffView = (next: TakeoffView) => {
    if (next === takeoffView) return
    // The fixture to land on: the last one touched, else the row at the top of the viewport right now.
    const rowId = pickHopRow(
      takeoffCountRows.map((r) => ({
        id: r.id,
        top: typeof document === 'undefined' ? null : document.getElementById(takeoffRowDomId(r.id))?.getBoundingClientRect().top ?? null,
      })),
      takeoffTouchedRowId,
    )
    setTakeoffView(next)
    writeStoredTakeoffView(typeof window !== 'undefined' ? window.localStorage : null, next)
    if (!rowId) return
    noteTakeoffRow(rowId)
    setViewFocusRequest((prev) => ({ countRowId: rowId, nonce: (prev?.nonce ?? 0) + 1 }))
    // Into One at a time the rail highlight is the cue; the sheets scroll to the row and flash it.
    if (next !== 'new1') setHopFlash((prev) => ({ countRowId: rowId, nonce: (prev?.nonce ?? 0) + 1 }))
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


  // Part Prices modal (check/modify prices from Add Assembly / Edit Assembly item rows)
  const [partPricesModal, setPartPricesModal] = useState<{ partId: string; partName: string; defaultAddPrice?: string } | null>(null)
  const prevPartPricesModalRef = useRef<{ partId: string; partName: string; defaultAddPrice?: string } | null>(null)
  const [bundleBreakdownModal, setBundleBreakdownModal] = useState<{ templateId: string; lineId: string; assemblyName: string } | null>(null)

  // Bundle breakdown modal: parts-vs-bundle comparison for a rough Assembly bundle line.
  // Inline grayed part rows shown beneath each Combined bundle line (display-only, never
  // persisted, never summed). Cached by assembly template id; collapse tracked per line id.
  const [bundlePartsByTemplateId, setBundlePartsByTemplateId] = useState<Record<string, BundlePartLine[]>>({})
  // Materials by stage (v2.3672): the bid's stage splits, the company factor and this bid's own.
  const [stageSplits, setStageSplits] = useState<StageSplitRowRecord[]>([])
  const [sovFactorDefault, setSovFactorDefault] = useState<number>(DEFAULT_SOV_MATERIAL_FACTOR)
  const [sovFactorOverride, setSovFactorOverride] = useState<number | null>(null)
  const [stageFillNote, setStageFillNote] = useState<string | null>(null)
  // PR 4: what each bundle's assembly remembers for its parts (template id → part id → weights).
  const [assemblyPartDefaults, setAssemblyPartDefaults] = useState<Map<string, Map<string, StageWeights>>>(new Map())
  const [collapsedBundleLineIds, setCollapsedBundleLineIds] = useState<Set<string>>(new Set())

  // Edit Template Modal state (open pointer + PartFormModal-routed picker states)
  const [editTemplateModalOpen, setEditTemplateModalOpen] = useState(false)
  const [editTemplateModalId, setEditTemplateModalId] = useState<string | null>(null)
  const [editTemplateModalName, setEditTemplateModalName] = useState<string | null>(null)
  const [editTemplateNewItemPartId, setEditTemplateNewItemPartId] = useState('')



  // T8 seam (v2.2770): the parts catalog + supply houses / part types.
  const {
    takeoffAddTemplateParts,
    setTakeoffAddTemplateParts,
    supplyHouses,
    partTypes,
  } = useTakeoffPartsCatalog<MaterialPartWithType>({
    activeTab,
    selectedServiceTypeId,
    selectedBidForTakeoff,
    takeoffAddTemplateModalOpen,
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
    copyLinesToRow,
    refreshOrderIncrementsFromCatalog,
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
  // The view chooser (v2.3082): a bid opened here asks which view to work in — but only
  // until this device has picked once (v2.3165, Wendi: "stop asking me every time"). After that the
  // remembered view opens straight away and the pills beside the bid name are the way to switch.
  // A pick goes through
  // switchTakeoffView so the device remembers it and the seamless hop still lands the fixture.
  const [takeoffChooserOpen, setTakeoffChooserOpen] = useState(false)
  useEffect(() => {
    setTakeoffChooserOpen(
      !!selectedBidForTakeoff?.id && !hasStoredTakeoffView(typeof window !== 'undefined' ? window.localStorage : null),
    )
  }, [selectedBidForTakeoff?.id])
  // v2.4211: once the bid is won, a declined alternate's rows stay on the sheet (grey mark) but leave
  // the materials total, the book fill and the schedule of values — the job's numbers.
  const jobRows = useMemo(() => jobScopeRows(takeoffCountRows, selectedBidForTakeoff), [takeoffCountRows, selectedBidForTakeoff])
  const bookFillPlan = useMemo(() => {
    if (!selectedTakeoffBookVersionId || takeoffBookEntriesVersionId !== selectedTakeoffBookVersionId) return null
    return planBookFill(jobRows, takeoffRoughPartLines, takeoffBookEntries)
  }, [selectedTakeoffBookVersionId, takeoffBookEntriesVersionId, jobRows, takeoffRoughPartLines, takeoffBookEntries])
  const bookFillButton = fillFromBookLabel(bookFillPlan, applyingTakeoffBookTemplates)
  // New 1 / New 2 substrate (v2.2778): coverage is the same math the Labor tab and Workbench use.
  const takeoffCoverage = useMemo(() => summarizeTakeoffCoverage(jobRows, takeoffRoughPartLines), [jobRows, takeoffRoughPartLines])
  // v2.4191: the bid's alternate groups — the rail splits materials by them; an alternate's row wears the ALT mark.
  const altTags: readonly string[] = selectedBidForTakeoff?.alternate_group_tags ?? []
  const altChip = (row: BidCountRow) =>
    selectedBidForTakeoff && isDeclinedRow(row, selectedBidForTakeoff) ? (
      <span title="The customer did not take this alternate — the row stays on the bid and is out of the job's materials" style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.06em', padding: '0 0.3rem', borderRadius: 3, border: '1px solid var(--border-strong)', color: 'var(--text-muted)', marginLeft: '0.35rem', verticalAlign: '1px' }}>ALT · declined</span>
    ) : isAlternateRow(row, altTags) ? (
      <span title="In an alternate group — priced with and without" style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.06em', padding: '0 0.3rem', borderRadius: 3, border: '1px solid var(--text-amber-700)', color: 'var(--text-amber-700)', marginLeft: '0.35rem', verticalAlign: '1px' }}>ALT</span>
    ) : null

  // Materials by stage (v2.3672): load the splits + the factor with the bid, and again when the
  // version changes (v2.4393): a version made a moment ago brought its boxes with it (v2.4388),
  // and the list read when the bid opened does not hold them.
  const stageBidId = selectedBidForTakeoff?.id ?? null
  const stageBidFactorRaw = selectedBidForTakeoff?.sov_material_factor ?? null
  useEffect(() => {
    setStageFillNote(null)
    setSovFactorOverride(stageBidFactorRaw != null && Number.isFinite(Number(stageBidFactorRaw)) ? Number(stageBidFactorRaw) : null)
    if (!stageBidId) {
      setStageSplits([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const [splits, factor] = await Promise.all([loadStageSplitsForBid(supabase, stageBidId), loadSovMaterialFactorDefault(supabase)])
        if (cancelled) return
        setStageSplits(splits)
        setSovFactorDefault(factor)
      } catch (e) {
        if (!cancelled) showToast(formatErrorMessage(e, 'Failed to load the stages'), 'error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [stageBidId, selectedBidVersionId, stageBidFactorRaw, showToast])
  const stageLookup = useMemo(() => indexStageSplits(stageSplits), [stageSplits])
  // PR 4: the assemblies' memory for the bundles on this bid (keyed like the bundle-parts cache).
  const stageBundleTemplateIdsKey = useMemo(
    () => Array.from(new Set(takeoffRoughPartLines.filter((l) => l.partId == null && l.sourceTemplateId).map((l) => l.sourceTemplateId as string))).sort().join(','),
    [takeoffRoughPartLines],
  )
  useEffect(() => {
    const ids = stageBundleTemplateIdsKey.split(',').filter(Boolean)
    if (ids.length === 0) {
      setAssemblyPartDefaults(new Map())
      return
    }
    let cancelled = false
    void loadAssemblyPartStageSplits(supabase, ids)
      .then((m) => {
        if (!cancelled) setAssemblyPartDefaults(m)
      })
      .catch(() => {
        if (!cancelled) setAssemblyPartDefaults(new Map())
      })
    return () => {
      cancelled = true
    }
  }, [stageBundleTemplateIdsKey])
  // PR 4: what the book remembers for each matched fixture.
  const bookStageSplitByRow = useMemo(() => {
    const m = new Map<string, StageWeights>()
    if (takeoffBookEntries.length === 0) return m
    const byEntry = new Map(takeoffBookEntries.map((e) => [e.id, e]))
    for (const [rowId, match] of matchBookEntries(takeoffCountRows, takeoffBookEntries, takeoffBookEntries.flatMap((e) => e.items))) {
      const w = parseStageSplitJson(byEntry.get(match.entryId)?.stage_split)
      if (w) m.set(rowId, w)
    }
    return m
  }, [takeoffBookEntries, takeoffCountRows])
  const stageBundleParts = useMemo(() => {
    const m = new Map<string, BundlePartInput[]>()
    for (const [templateId, lines] of Object.entries(bundlePartsByTemplateId)) m.set(templateId, bundlePartInputs(lines))
    return m
  }, [bundlePartsByTemplateId])
  const stageSummary = useMemo(() => {
    const extra = new Map<string, number>()
    for (const f of takeoffCoverage.perFixture.values()) extra.set(f.countRowId, f.roundingExtra)
    return computeMaterialsByStage({
      countRows: jobRows,
      lines: takeoffRoughPartLines,
      roundingExtraByCountRow: extra,
      splits: stageSplits,
      bundleParts: stageBundleParts,
      assemblyPartDefaults,
      factor: sovFactorOverride ?? sovFactorDefault,
    })
  }, [takeoffCountRows, takeoffRoughPartLines, takeoffCoverage, stageSplits, stageBundleParts, assemblyPartDefaults, sovFactorOverride, sovFactorDefault])
  const stageOwnCountByRow = useMemo(() => new Map(stageSummary.fixtures.map((f) => [f.countRowId, f.ownSplitCount])), [stageSummary])
  // A cross-tab row jump (Pricing → Takeoffs) must land in New 1 / New 2 too (v2.2782):
  // New 1 focuses the fixture, New 2 drops its filter, then the flash finds the row.
  const [viewFocusRequest, setViewFocusRequest] = useState<{ countRowId: string; nonce: number } | null>(null)
  useEffect(() => {
    const id = rowJump?.countRowId
    if (!id) return
    setViewFocusRequest((prev) => ({ countRowId: id, nonce: (prev?.nonce ?? 0) + 1 }))
  }, [rowJump, takeoffView])
  // Shared by One at a time / Sheet (v2.2781): one fixture-history call per Combined bid.
  const takeoffHistory = useTakeoffFixtureHistory({
    bidId: selectedBidForTakeoff?.id ?? null,
    serviceTypeId: selectedServiceTypeId,
    countRows: takeoffCountRows,
  })
  const takeoffPartNameById = useMemo(() => new Map(takeoffAddTemplateParts.map((p) => [p.id, p.name])), [takeoffAddTemplateParts])

  // v2.4395: the materials at today's book — each line as priced against its book row today.
  const confirmDialog = useConfirmDialog()
  const driftPriceIds = useMemo(() => takeoffRoughPartLines.map((l) => l.sourceMaterialPartPriceId ?? '').filter(Boolean), [takeoffRoughPartLines])
  const driftBook = useBookPrices(driftPriceIds, activeTab === 'takeoffs')
  const takeoffDrift = useMemo(() => {
    const countByRowId = new Map(takeoffCountRows.map((r) => [r.id, r.count]))
    return takeoffPriceDrift(
      // Every line counts toward the materials (a bundle line too); only book-priced ones can move.
      takeoffRoughPartLines
        .map((l) => ({
          id: l.id,
          partName: (l.partId ? takeoffPartNameById.get(l.partId) : null) ?? '',
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          count: roughCountMultiplier(countByRowId.get(l.countRowId)),
          sourcePriceId: l.sourceMaterialPartPriceId,
        })),
      driftBook,
    )
  }, [takeoffRoughPartLines, takeoffCountRows, takeoffPartNameById, driftBook])
  const takeoffLock = pricingLockState({
    bidDateSent: selectedBidForTakeoff?.bid_date_sent,
    bidId: selectedBidForTakeoff?.id,
    revised: readRevisedBids(typeof window !== 'undefined' ? window.sessionStorage : null),
  })
  const [refreshingTakeoffPrices, setRefreshingTakeoffPrices] = useState(false)
  /** Refresh prices: every moved book-priced line to today's price from its own row, after a confirm. */
  async function refreshTakeoffPrices() {
    const plan = takeoffDrift.refresh
    if (plan.length === 0 || refreshingTakeoffPrices) return
    const ok = await confirmDialog({
      title: `Refresh ${plan.length === 1 ? '1 price' : `${plan.length} prices`} to today’s book?`,
      message: `These materials will cost ${gapWords(takeoffDrift.gap)}. Prices you typed stay as they are.`,
      confirmLabel: 'Refresh prices',
    })
    if (!ok) return
    setRefreshingTakeoffPrices(true)
    try {
      for (const r of plan) updateTakeoffRoughPartLine(r.lineId, { unitPrice: r.unitPrice })
      showToast(`Refreshed ${plan.length === 1 ? '1 price' : `${plan.length} prices`} to today’s book.`, 'success')
    } finally {
      setRefreshingTakeoffPrices(false)
    }
  }
  // New 2's "Request quotes" door reuses the Pricing tab's RfqComposeModal (plan decision 7).
  const [takeoffRfqScope, setTakeoffRfqScope] = useState<{ lines: Array<{ fixture: string; count: number; unit?: string | null }>; text: string } | null>(null)
  const [takeoffOpenRfqHouseIds, setTakeoffOpenRfqHouseIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (!takeoffRfqScope || !selectedBidForTakeoff?.id) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase.from('bid_rfqs').select('supply_house_id, status').eq('bid_id', selectedBidForTakeoff.id).eq('status', 'sent')
      if (cancelled) return
      setTakeoffOpenRfqHouseIds(new Set(((data ?? []) as Array<{ supply_house_id: string | null }>).map((r) => r.supply_house_id).filter((x): x is string => !!x)))
    })()
    return () => { cancelled = true }
  }, [takeoffRfqScope, selectedBidForTakeoff?.id])

  async function copyFixturesFromBid(candidate: CopyFromBidCandidate) {
    let added = 0
    let noPrice = 0
    try {
      for (const f of candidate.fills) {
        const r = await copyLinesToRow(f.countRowId, f.source.lines)
        added += r.linesAdded
        noPrice += r.partsWithoutPrice
      }
      showToast(added > 0 ? `Copied ${added} line${added === 1 ? '' : 's'} onto ${candidate.fills.length} fixture${candidate.fills.length === 1 ? '' : 's'} from B${candidate.bidNumber ?? '?'}${noPrice > 0 ? ` · ${noPrice} without a catalog price` : ''}.` : 'Nothing to copy.', added > 0 ? 'success' : 'info')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Failed to copy from the previous bid'), 'error')
    }
  }

  async function applyBookToFixture(countRowId: string, templateIds: string[]) {
    try {
      const r = await fillRowsFromAssemblies([{ countRowId, templateIds }])
      showToast(r.linesAdded > 0 ? `Added ${r.linesAdded} line${r.linesAdded === 1 ? '' : 's'} from the book${r.partsWithoutPrice > 0 ? ` · ${r.partsWithoutPrice} without a catalog price` : ''}.` : 'The book\'s assembly has no parts.', r.linesAdded > 0 ? 'success' : 'info')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Failed to apply the book'), 'error')
    }
  }

  async function useHistoryLinesOnFixture(countRowId: string, sourceLines: TakeoffFixtureHistoryLine[]) {
    try {
      const r = await copyLinesToRow(countRowId, sourceLines)
      showToast(r.linesAdded > 0 ? `Copied ${r.linesAdded} line${r.linesAdded === 1 ? '' : 's'} at today\'s lowest prices${r.partsWithoutPrice > 0 ? ` · ${r.partsWithoutPrice} without a catalog price` : ''}.` : 'Nothing to copy.', r.linesAdded > 0 ? 'success' : 'info')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Failed to copy the lines'), 'error')
    }
  }

  /** "Remember for the book" (plan decision 3): Save-as-Assembly + a book entry / alias, additive. */
  async function rememberFixtureForBookFromRow(row: BidCountRow): Promise<boolean> {
    if (!selectedTakeoffBookVersionId) {
      showToast('Pick a takeoff book first.', 'info')
      return false
    }
    const plan = planRememberForBook({
      fixture: row.fixture,
      lines: takeoffRoughPartLines.filter((l) => l.countRowId === row.id),
      existingEntries: takeoffBookEntries,
      existingAssemblyNames: materialTemplates.map((t) => t.name),
    })
    if (plan.kind === 'nothing') return false
    try {
      const aliasEntryId = plan.entry.action === 'alias' ? plan.entry.entryId : null
      const entry = aliasEntryId ? takeoffBookEntries.find((e) => e.id === aliasEntryId) : null
      const remembered = await rememberFixtureForBook(supabase, { plan, serviceTypeId: selectedServiceTypeId, bookVersionId: selectedTakeoffBookVersionId, existingAlias: entry?.alias_names })
      // PR 4: the fixture's stage split rides along, so the next bid arrives staged.
      const fixtureSplit = stageLookup.fixture.get(row.id)?.weights ?? null
      if (fixtureSplit) await saveBookEntryStageSplit(supabase, remembered.entryId, fixtureSplit).catch(() => undefined)
      await Promise.all([loadMaterialTemplates(), loadTakeoffBookEntries(selectedTakeoffBookVersionId)])
      showToast(`Remembered "${plan.key}" in the book${plan.newAssembly ? ` as ${plan.newAssembly.name}` : ''}${fixtureSplit ? ', with its stage' : ''}.`, 'success')
      return true
    } catch (e) {
      showToast(formatErrorMessage(e, 'Failed to remember for the book'), 'error')
      return false
    }
  }

  // Materials by stage (v2.3672): one scope's split — optimistic, then the row comes back with its id.
  async function setStageSplit(scope: StageSplitScopeKey, weights: StageWeights | null, source: StageSplitSource = 'hand') {
    const bid = selectedBidForTakeoff
    if (!bid) return
    const same = (r: StageSplitRecord) => r.countRowId === scope.countRowId && (r.lineId ?? null) === (scope.lineId ?? null) && (r.partId ?? null) === (scope.partId ?? null)
    const before = stageSplits
    setStageFillNote(null)
    setStageSplits((cur) => {
      const rest = cur.filter((r) => !same(r))
      if (!weights) return rest
      const existing = cur.find(same)
      return [...rest, { id: existing?.id ?? `pending-${scope.countRowId}-${scope.lineId ?? ''}-${scope.partId ?? ''}`, bidId: bid.id, countRowId: scope.countRowId, lineId: scope.lineId ?? null, partId: scope.partId ?? null, weights, source }]
    })
    try {
      const saved = await saveStageSplit(supabase, { bidId: bid.id, scope, weights, source })
      if (saved) setStageSplits((cur) => [...cur.filter((r) => !same(r)), saved])
    } catch (e) {
      setStageSplits(before)
      showToast(formatErrorMessage(e, 'Failed to save the stage'), 'error')
    }
  }

  // "Fill from rules": every fixture without a hand-set split gets the rule's; the note says what happened.
  async function fillStagesByRules() {
    const bid = selectedBidForTakeoff
    if (!bid) return
    const plan = planRuleFill(takeoffCountRows, stageSplits, undefined, (rowId) => bookStageSplitByRow.get(rowId) ?? null)
    try {
      const applied = await saveFixtureSplitsBatch(supabase, bid.id, plan.toWrite.map((w) => ({ countRowId: w.countRowId, weights: w.weights, source: w.source })))
      setStageSplits(await loadStageSplitsForBid(supabase, bid.id))
      setStageFillNote(describeRulePlan(plan, applied))
    } catch (e) {
      showToast(formatErrorMessage(e, 'Failed to fill the stages'), 'error')
    }
  }

  // PR 4: "Remember for this assembly" — the part's split lives on the assembly, for every bid that uses it.
  async function rememberPartSplitForAssembly(templateId: string, partId: string, weights: StageWeights | null) {
    try {
      await saveAssemblyPartStageSplit(supabase, templateId, partId, weights)
      setAssemblyPartDefaults((cur) => {
        const next = new Map(cur)
        const m = new Map(next.get(templateId) ?? [])
        if (weights) m.set(partId, weights)
        else m.delete(partId)
        next.set(templateId, m)
        return next
      })
      const name = materialTemplates.find((t) => t.id === templateId)?.name ?? 'the assembly'
      showToast(`${name} will stage this part the same way on every bid.`, 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Failed to remember for the assembly'), 'error')
    }
  }

  // Print → Schedule of values (v2.3673): the rail's numbers on paper, with every fixture's stage on page 2.
  function printScheduleOfValues() {
    const bid = selectedBidForTakeoff
    if (!bid) return
    const factorNote = sovFactorOverride != null ? `Factor ${stageSummary.factor} is this bid's own (the company default is ${sovFactorDefault}).` : `Factor ${stageSummary.factor} is the company default.`
    printHtmlInNewWindow(
      buildScheduleOfValuesHtml({
        title: `${bidDisplayName(bid) || 'Bid'} — Schedule of values (materials)`,
        subtitle: `Takeoff materials by stage × ${stageSummary.factor} · ${stageSummary.stagedFixtureCount} of ${stageSummary.costedFixtureCount} costed fixtures staged`,
        summary: stageSummary,
        unstagedNames: stageSummary.fixtures.filter((f) => f.raw <= 0 && f.fixture.trim()).map((f) => f.fixture),
        factorNote,
      }),
    )
  }

  async function setBidSovFactor(next: number | null) {
    const bid = selectedBidForTakeoff
    if (!bid) return
    const before = sovFactorOverride
    setSovFactorOverride(next)
    const { error } = await supabase.from('bids').update({ sov_material_factor: next }).eq('id', bid.id)
    if (error) {
      setSovFactorOverride(before)
      showToast('Error updating bid: ' + error.message, 'error')
      return
    }
    void loadBids()
  }

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
    setTakeoffNewTemplateName(saveAsAssemblyDefaultName(row.fixture, selectedBidForTakeoff?.project_name))
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
        editTemplateModalOpen,
        livePickerLineId: takeoffRoughPartPickerLineId,
      })
      switch (target.kind) {
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
    // v2.2776: expand every matched assembly into part lines on the fixtures that have none.
    // The summary is a toast: the line it used to print on sat in the Old view (retired v2.3588).
    if (!bookFillPlan || bookFillPlan.fillable.length === 0) {
      showToast(
        bookFillPlan && bookFillPlan.matched > 0 ? 'Every fixture this book matches already has lines.' : 'No entry in this book matches these fixtures yet.',
        'info',
      )
      return
    }
    setApplyingTakeoffBookTemplates(true)
    setError(null)
    try {
      const result = await fillRowsFromAssemblies(bookFillPlan.fillable.map((m) => ({ countRowId: m.countRowId, templateIds: m.templateIds })))
      showToast(bookFillMessage(result), 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Failed to fill from the book'), 'error')
    } finally {
      setApplyingTakeoffBookTemplates(false)
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
    void removeTakeoffRoughPartLine(target.lineId)
  }

  async function printTakeoffBreakdown() {
    if (!selectedBidForTakeoff) return
    {
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
            stageTextByRowId: Object.fromEntries(stageSummary.fixtures.map((f) => [f.countRowId, fixtureStageText(f)])),
          }),
        )
      } finally {
        setTakeoffPrinting(false)
      }
    }
  }

  const takeoffRoughCatalogLowestPartIdsKey = useMemo(() => {
    if (activeTab !== 'takeoffs' || !selectedBidForTakeoff?.id) return ''
    const ids = takeoffRoughPartLines.map((l) => (l.partId ?? '').trim()).filter(Boolean)
    return Array.from(new Set(ids)).sort().join(',')
  }, [activeTab, selectedBidForTakeoff?.id, takeoffRoughPartLines])

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
    const ids = takeoffRoughPartLines
      .filter((l) => l.partId == null && l.sourceTemplateId)
      .map((l) => l.sourceTemplateId as string)
    return Array.from(new Set(ids)).sort().join(',')
  }, [activeTab, selectedBidForTakeoff?.id, takeoffRoughPartLines])

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
    if (!takeoffRoughCatalogLowestPartIdsKey) return
    void refreshTakeoffRoughCatalogLowest(takeoffRoughCatalogLowestPartIdsKey.split(',').filter(Boolean))
  }, [
    partPricesModal,
    activeTab,
    selectedBidForTakeoff?.id,
    takeoffRoughCatalogLowestPartIdsKey,
    refreshTakeoffRoughCatalogLowest,
  ])



  useEffect(() => {
    if (activeTab !== 'takeoffs' || !selectedBidForTakeoff?.id) return
    let cancelled = false
    void (async () => {
      const index = await loadPartAssemblyIndex(supabase)
      if (cancelled || !index) return
      setPartAssemblyIndex(index)
    })()
    return () => { cancelled = true }
  }, [activeTab, selectedBidForTakeoff?.id, supabase, materialTemplates])


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

  /**
   * The Combined line editor for a set of fixtures — Old renders every fixture
   * through it, New 1 one fixture at a time (v2.2778). One drag context, the
   * same header, rows, and add-line footer, so the views cannot drift apart.
   */
  const renderRoughLinesTable = (rowsToRender: BidCountRow[], opts?: { suggestionFor?: (row: BidCountRow) => ReactNode }) => (
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
                      <tbody
                        onPointerDownCapture={(e) => {
                          const id = rowIdFromTakeoffTableTarget(e.target)
                          if (id) noteTakeoffRow(id)
                        }}
                        onFocusCapture={(e) => {
                          const id = rowIdFromTakeoffTableTarget(e.target)
                          if (id) noteTakeoffRow(id)
                        }}
                      >
                        {rowsToRender.map((row) => {
                          const linesForRow = takeoffRoughPartLines
                            .filter((l) => l.countRowId === row.id)
                            .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
                          return (
                            <Fragment key={row.id}>
                              {linesForRow.length === 0 ? (
                                <tr id={takeoffRowDomId(row.id)} style={{ borderBottom: '1px solid var(--border)', background: rowJumpFlashCountRowId === row.id ? 'var(--bg-blue-tint)' : undefined, transition: 'background 400ms ease' }}>
                                  <td style={{ padding: '0.75rem', verticalAlign: 'top' }}>
                                    <div>{takeoffFixtureCountLabel(row)}{altChip(row)}</div>
                                    <div style={{ marginTop: '0.35rem' }}>
                                      <StageSplitChips
                                        scope="fixture"
                                        label={String(row.fixture ?? '')}
                                        value={stageLookup.fixture.get(row.id)?.weights ?? null}
                                        source={stageLookup.fixture.get(row.id)?.source ?? null}
                                        onChange={(w) => void setStageSplit({ countRowId: row.id }, w)}
                                      />
                                    </div>
                                  </td>
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
                                      {opts?.suggestionFor?.(row)}
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
                                      orderRounding={line.partId ? (takeoffCoverage.orderRounding.byPartId.get(line.partId) ?? null) : null}
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
                                      stageLookup={stageLookup}
                                      onSetStageSplit={(scope, weights) => void setStageSplit(scope, weights)}
                                      stageOwnCount={stageOwnCountByRow.get(row.id) ?? 0}
                                      assemblyPartDefaults={line.partId == null && line.sourceTemplateId ? assemblyPartDefaults.get(line.sourceTemplateId) ?? null : null}
                                      onRememberPartSplitForAssembly={(templateId, partId, weights) => void rememberPartSplitForAssembly(templateId, partId, weights)}
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
  )

  return (
    <>
        {selectedBidForTakeoff && takeoffRfqScope ? (
          <RfqComposeModal
            open
            onClose={() => setTakeoffRfqScope(null)}
            onSent={() => {
              setTakeoffRfqScope(null)
              showToast('Quote request sent — picked prices land back on these lines.', 'success')
            }}
            bidId={selectedBidForTakeoff.id}
            bidVersionId={selectedBidVersionId}
            bidLabel={bidPackageLabel(selectedBidForTakeoff, ledgerPrefixMap)}
            scope={takeoffRfqScope}
            openRfqHouseIds={takeoffOpenRfqHouseIds}
            plansLink={selectedBidForTakeoff.plans_link ?? null}
          />
        ) : null}
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
            <BidPickerSearchRow query={takeoffSearchQuery} onQueryChange={setTakeoffSearchQuery} onlyMyBids={onlyMyBids} onOnlyMyBidsChange={setOnlyMyBids} />
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
                  onClick={onClose}
                  title="Close"
                  aria-label="Close"
                  style={bidDetailCloseFloatMobileStyle}
                >
                  ×
                </button>
              ) : null}
              {flowFold.expanded ? (
              <BidFlowStrip
                variant="full"
                hideHeader
                flow={deriveBidFlow(selectedBidForTakeoff, bidFlowFactsByBid[selectedBidForTakeoff.id])}
                bidLabel={selectedBidForTakeoff.project_name ?? undefined}
                canOpenDoor={(d) => d === 'review' || (onOpenBidFlowDoor != null && (bidFlowDoorAllowed ? bidFlowDoorAllowed(d) : d != null))}
                onOpenDoor={(d, step) => {
                  if (d === 'review') void bidFlowReview.markReviewed(selectedBidForTakeoff)
                  else onOpenBidFlowDoor?.(selectedBidForTakeoff, d, step)
                }}
                reviewStamp={bidFlowReview.stampFor(selectedBidForTakeoff)}
              />
              ) : null}
              <div id="takeoff-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', minWidth: 0 }}>
                  <BidWorkflowTabTitleWithPreview
                    bid={selectedBidForTakeoff}
                    previewEnabled={bidPreview != null}
                    onOpenPreview={() => bidPreview?.openBidPreviewFromBid(selectedBidForTakeoff)}
                  />
                  <BidFlowStrip
                    variant="inline"
                    expanded={flowFold.expanded}
                    onToggleExpanded={flowFold.toggle}
                    flow={deriveBidFlow(selectedBidForTakeoff, bidFlowFactsByBid[selectedBidForTakeoff.id])}
                    bidLabel={selectedBidForTakeoff.project_name ?? undefined}
                    canOpenDoor={(d) => d === 'review' || (onOpenBidFlowDoor != null && (bidFlowDoorAllowed ? bidFlowDoorAllowed(d) : d != null))}
                    onOpenDoor={(d, step) => {
                    if (d === 'review') void bidFlowReview.markReviewed(selectedBidForTakeoff)
                    else onOpenBidFlowDoor?.(selectedBidForTakeoff, d, step)
                    }}
                    reviewStamp={bidFlowReview.stampFor(selectedBidForTakeoff)}
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
              {takeoffChooserOpen ? (
                <TakeoffViewChooser
                  bidLabel={`BP${selectedBidForTakeoff.bid_number?.trim() || '?'} ${selectedBidForTakeoff.project_name?.trim() || ''}`.trim()}
                  fixtures={takeoffCoverage.fixtures}
                  costed={takeoffCoverage.costed}
                  onPick={(v) => {
                    setTakeoffChooserOpen(false)
                    if (v !== takeoffView) switchTakeoffView(v)
                    // Picking the view already showing still counts as the device's pick (v2.3165).
                    else writeStoredTakeoffView(typeof window !== 'undefined' ? window.localStorage : null, v)
                  }}
                />
              ) : null}
              <TakeoffPriceDriftLine
                drift={takeoffDrift}
                lock={takeoffLock}
                sentDay={selectedBidForTakeoff.bid_date_sent ? formatSentDay(selectedBidForTakeoff.bid_date_sent, new Date().getFullYear()) : null}
                refreshing={refreshingTakeoffPrices}
                onRefresh={() => void refreshTakeoffPrices()}
              />
              {takeoffView === 'new1' ? (
                  <TakeoffFocusView
                    bidId={selectedBidForTakeoff.id}
                    countRows={takeoffCountRows}
                    lines={takeoffRoughPartLines}
                    coverage={takeoffCoverage}
                    bookPlan={bookFillPlan}
                    bookVersionName={takeoffBookVersions.find((v) => v.id === selectedTakeoffBookVersionId)?.name ?? null}
                    materialTemplates={materialTemplates}
                    renderLinesTable={renderRoughLinesTable}
                    onApplyBook={applyBookToFixture}
                    onUseLines={useHistoryLinesOnFixture}
                    onRemember={rememberFixtureForBookFromRow}
                    fillButton={bookFillButton}
                    onFillAll={() => void applyTakeoffBookTemplates()}
                    onSheetView={() => switchTakeoffView('new2')}
                    preferredFocusId={takeoffTouchedRowId}
                    onFocusChange={noteTakeoffRow}
                    showToast={showToast}
                    history={takeoffHistory}
                    focusRequest={viewFocusRequest}
                    partNameById={takeoffPartNameById}
                    onRefreshOrderRules={refreshOrderIncrementsFromCatalog}
                  />
                ) : (
                  <TakeoffCostRailView
                    countRows={takeoffCountRows}
                    lines={takeoffRoughPartLines}
                    coverage={takeoffCoverage}
                    alternateTags={altTags}
                    bookPlan={bookFillPlan}
                    bookVersions={takeoffBookVersions}
                    selectedBookVersionId={selectedTakeoffBookVersionId}
                    onSelectBook={(id) => {
                      setSelectedTakeoffBookVersionId(id)
                      saveBidSelectedTakeoffBookVersion(selectedBidForTakeoff.id, id)
                    }}
                    materialTemplates={materialTemplates}
                    partNameById={takeoffPartNameById}
                    history={takeoffHistory}
                    renderLinesTable={renderRoughLinesTable}
                    fillButton={bookFillButton}
                    onFillAll={() => void applyTakeoffBookTemplates()}
                    onApplyBook={applyBookToFixture}
                    onCopyFromBid={copyFixturesFromBid}
                    onRequestQuotes={(scope) => setTakeoffRfqScope(scope)}
                    onFocusView={() => switchTakeoffView('new1')}
                    focusRequest={viewFocusRequest}
                    onRefreshOrderRules={refreshOrderIncrementsFromCatalog}
                    stagesPanel={
                      <TakeoffStagesPanel
                        summary={stageSummary}
                        factorDefault={sovFactorDefault}
                        factorOverride={sovFactorOverride}
                        onFactorChange={setBidSovFactor}
                        onFillByRules={fillStagesByRules}
                        fillNote={stageFillNote}
                        onPrint={printScheduleOfValues}
                      />
                    }
                  />
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
              <div role="dialog" aria-modal="true"
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

          {!selectedBidForTakeoff && (
            <BidPickerStandardList
              bids={filteredBidsForTakeoff}
              searching={takeoffSearchQuery.trim() !== ''}
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
          {/* The takeoff's materials roll-up */}
          <BidsTakeoffMaterialsSummarySection
            selectedBidForTakeoff={selectedBidForTakeoff}
            selectedBidForCostEstimate={selectedBidForCostEstimate}
            costEstimateCountRows={costEstimateCountRows}
            costEstimateMaterialTotalRoughIn={costEstimateMaterialTotalRoughIn}
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
        invalidateBundleParts={invalidateBundleParts}
        filterPartsByQuery={filterPartsByQuery}
        filterTemplatesByQuery={filterTemplatesByQuery}
        openBidsPartFormForCreate={openBidsPartFormForCreate}
        setPartPricesModal={setPartPricesModal}
        takeoffAddTemplateModalOpen={takeoffAddTemplateModalOpen}
        setTakeoffAddTemplateModalOpen={setTakeoffAddTemplateModalOpen}
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
        takeoffRoughPartLines={takeoffRoughPartLines}
        setTakeoffRoughPartLines={setTakeoffRoughPartLines}
        insertRoughBundleLine={insertRoughBundleLine}
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
    </>
  )
}

