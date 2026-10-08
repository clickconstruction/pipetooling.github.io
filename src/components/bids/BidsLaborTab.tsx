import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { supabase } from '../../lib/supabase'
import { BID_UPDATE_NOT_APPLIED_MESSAGE, bidUpdateRefused } from '../../lib/bids/updateGuard'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../contexts/ToastContext'
import { breakdownJumpDomId, breakdownJumpMissMessage, laborRowDomId, type BreakdownJumpTarget } from '../../lib/bids/bidTabRowJump'
import { usePendingRowFlash } from '../../hooks/usePendingRowFlash'
import { formatCurrency } from '../../lib/format'
import { bidDetailCloseXStyle, bidDetailCloseFloatMobileStyle } from '../../lib/bids/bidStyles'
import { laborRowHours } from '../../lib/bids/laborRowHours'
import { drivingSummaryFromInputs, laborTotalFromInputs, travelSummaryFromInputs } from '../../lib/bids/laborTabCostSummaries'
import {
  EMPTY_LABOR_CELL_SAVE_MAP,
  beginLaborCellSaves,
  finishLaborCellSaves,
  laborCellStatusTitle,
  markLaborCellPending,
  type LaborCellSaveMap,
} from '../../lib/bids/laborCellSaveState'
import type { LaborTabPanel } from '../../lib/bids/laborTabLoadGate'
import { BidsLaborNewView } from './BidsLaborNewView'
import { BidsLaborUnmatchedBand } from './BidsLaborUnmatchedBand'
import { buildCostEstimateAutosavePayload, laborRowAutosaveUpdate, stageAmountRowAutosaveUpdate } from '../../lib/bids/costEstimateAutosavePayload'
import { useBidCrewRate } from '../../hooks/useBidCrewRate'
import { useLaborBookCalibration } from '../../hooks/useLaborBookCalibration'
import { useJobBaselineRates } from '../../hooks/useJobBaselineRates'
import { baselineReading, baselineReadingWords } from '../../lib/bids/bidBaselineRates'
import type { TeamLaborBidRow } from '../../utils/teamLabor'
import { computeBidCostBreakdown, directCostRowsFromTables } from '../../lib/bids/bidTotalCostBreakdown'
import { BidsDirectCostsSection } from './BidsDirectCostsSection'
import { directCostHandlersByKind } from '../../lib/bids/directCostHandlers'
import { BidsLaborBookPanel } from './BidsLaborBookPanel'
import { asLaborEntryKind, asLaborUnit, type LaborEntryKind, type LaborUnit } from '../../lib/bids/laborBookMatch'
import { bookSummaryWords, laborBookForTrade, laborBookRights, robotHoursOf, type CalibrationProposal } from '../../lib/bids/laborEntryProvenance'
import { BidWorkflowTabTitleWithPreview } from './BidWorkflowTabTitleWithPreview'
import { BidFlowStrip } from './BidFlowStrip'
import { deriveBidFlow, type BidFlowDoor, type BidFlowStep } from '../../lib/bids/bidFlow'
import { useBidFlowFacts } from '../../hooks/useBidFlowFacts'
import { useBidFlowReview } from '../../hooks/useBidFlowReview'
import { useBidFlowFold } from '../../hooks/useBidFlowFold'
import { BidPickerStandardList } from './BidPickerStandardList'
import { BidPickerSearchRow } from './BidPickerSearchRow'
import { filterBidsForPicker } from '../../lib/bids/filterBidsForPicker'
import { lastZipInAddress } from '../../lib/bids/extractZipFromAddress'
import { type LedgerPrefixMap } from '../../lib/ledgerDisplayPrefixes'
import {
  printCostEstimatePage as printCostEstimatePageDoc,
  printRoughInSubSheet as printRoughInSubSheetDoc,
  printTopOutSubSheet as printTopOutSubSheetDoc,
  printTrimSetSubSheet as printTrimSetSubSheetDoc,
  printAllSubSheets as printAllSubSheetsDoc,
  type CostEstimatePrintContext,
} from '../../lib/bidDocuments/costEstimatePage'
import type { useBidPreview } from '../../contexts/BidPreviewModalContext'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import type { BidCountRow } from '../../types/bids'
import type {
  CostEstimate,
  CostEstimateLaborRow,
  CostEstimateUnmatchedLaborRow,
  CostEstimateEquipmentRow,
  CostEstimatePermitRow,
  CostEstimateSubcontractorRow,
  CostEstimateWasteRow,
  CostEstimateOtherRow,
  LaborBookVersion,
  LaborBookEntryWithFixture,
} from '../../lib/bids/bidPricingEngineTypes'

type BidsLaborTabProps = {
  /** v2.3216: open a step's door from the strip — Edit window or another tab — and land on its field. The page owns it. */
  onOpenBidFlowDoor?: (bid: BidWithBuilder, door: BidFlowDoor, step: BidFlowStep) => void
  /** Role gating for those doors (superintendents never reach Pricing / Cover Letter). */
  bidFlowDoorAllowed?: (door: BidFlowDoor) => boolean
  bids: BidWithBuilder[]
  /** Breakdown jump (v2.2400): an HOURS row to land on — scroll + flash, then report handled. */
  rowJump?: BreakdownJumpTarget | null
  onRowJumpHandled?: () => void
  selectedBidForCostEstimate: BidWithBuilder | null
  /** Active bid Version whose takeoff materials the cost-estimate print reflects (null = Base). */
  selectedBidVersionId: string | null
  setSelectedBidForCostEstimate: Dispatch<SetStateAction<BidWithBuilder | null>>
  narrowViewport640: boolean
  bidPreview: ReturnType<typeof useBidPreview>
  error: string | null
  setError: (message: string | null) => void
  /** The trade's name, beside the book ("🤖 Robot Default · Plumbing"). */
  selectedServiceTypeName?: string | null
  /** Who is looking (v2.3597): the role gates the book's writes, the id signs proposals and owns overrides. */
  viewerUserId?: string | null
  viewerRole?: string | null
  fixtureTypes: Array<{ id: string; name: string }>
  getOrCreateFixtureTypeId: (name: string, serviceTypeIdOverride?: string) => Promise<{ id: string } | { id: null; error?: string }>
  loadBids: (serviceTypeId?: string | null) => Promise<BidWithBuilder[]>
  // Shared, parent-owned
  costEstimatePOModalTaxPercent: string
  costEstimateDistanceInput: string
  setCostEstimateDistanceInput: Dispatch<SetStateAction<string>>
  // Engine values + setters/loaders
  costEstimate: CostEstimate | null
  costEstimateLaborRows: CostEstimateLaborRow[]
  setCostEstimateLaborRows: Dispatch<SetStateAction<CostEstimateLaborRow[]>>
  /** Rows the load sync set aside because no counted fixture claims them (bid history PR 0b); the band under the hours lists them. */
  costEstimateUnmatchedLaborRows?: CostEstimateUnmatchedLaborRow[]
  onUseUnmatchedLaborRow?: (parkedId: string, laborRowId: string) => Promise<boolean>
  onRemoveUnmatchedLaborRow?: (parkedId: string) => Promise<boolean>
  costEstimateCountRows: BidCountRow[]
  /** v2.4202: each count row's takeoff materials (rough model) — the alternate card's Materials row. */
  costEstimateFixtureMaterials?: Record<string, number>
  /** What renders under the bid header: skeleton while the Version resolves, the empty sentence only for a settled zero-row bid (`laborEmptyState`). */
  panel: LaborTabPanel
  costEstimateMaterialTotalRoughIn: number | null
  costEstimateMaterialTotalTopOut: number | null
  costEstimateMaterialTotalTrimSet: number | null
  /** Hours clocked on each bid (People → Bids); the Labor tab shows this bid's as a fact (v2.3294). */
  teamLaborDataForBids?: TeamLaborBidRow[]
  laborRateInput: string
  setLaborRateInput: Dispatch<SetStateAction<string>>
  drivingCostRate: string
  setDrivingCostRate: Dispatch<SetStateAction<string>>
  hoursPerTrip: string
  setHoursPerTrip: Dispatch<SetStateAction<string>>
  estimatorCostUseFlat: boolean
  estimatorCostPerCount: string
  estimatorCostFlatAmount: string
  travelPeople: string
  setTravelPeople: Dispatch<SetStateAction<string>>
  travelNights: string
  setTravelNights: Dispatch<SetStateAction<string>>
  travelMealsRate: string
  setTravelMealsRate: Dispatch<SetStateAction<string>>
  travelHotelRate: string
  setTravelHotelRate: Dispatch<SetStateAction<string>>
  equipmentRows: CostEstimateEquipmentRow[]
  setEquipmentRows: Dispatch<SetStateAction<CostEstimateEquipmentRow[]>>
  permitRows: CostEstimatePermitRow[]
  setPermitRows: Dispatch<SetStateAction<CostEstimatePermitRow[]>>
  subcontractorRows: CostEstimateSubcontractorRow[]
  setSubcontractorRows: Dispatch<SetStateAction<CostEstimateSubcontractorRow[]>>
  wasteRows: CostEstimateWasteRow[]
  setWasteRows: Dispatch<SetStateAction<CostEstimateWasteRow[]>>
  otherRows: CostEstimateOtherRow[]
  setOtherRows: Dispatch<SetStateAction<CostEstimateOtherRow[]>>
  laborBookVersions: LaborBookVersion[]
  laborBookEntries: LaborBookEntryWithFixture[]
  selectedLaborBookVersionId: string | null
  laborBookEntriesVersionId: string | null
  setLaborBookEntriesVersionId: Dispatch<SetStateAction<string | null>>
  loadLaborBookVersions: () => Promise<void>
  loadLaborBookEntries: (versionId: string | null) => Promise<void>
  // Callbacks
  onSelectBid: (bid: BidWithBuilder) => void
  onClose: () => void
  onEditBid: (bid: BidWithBuilder) => void
  ledgerPrefixMap: LedgerPrefixMap
  onlyMyBids: boolean
  setOnlyMyBids: (next: boolean) => void
  isMyBid: (bid: BidWithBuilder) => boolean
}

export function BidsLaborTab({
  onOpenBidFlowDoor,
  bidFlowDoorAllowed,
  selectedBidVersionId,
  bids,
  rowJump,
  onRowJumpHandled,
  selectedBidForCostEstimate,
  setSelectedBidForCostEstimate,
  narrowViewport640,
  bidPreview,
  error,
  setError,
  selectedServiceTypeName = null,
  viewerUserId = null,
  viewerRole = null,
  fixtureTypes,
  getOrCreateFixtureTypeId,
  loadBids,
  costEstimatePOModalTaxPercent,
  costEstimateDistanceInput,
  setCostEstimateDistanceInput,
  costEstimate,
  costEstimateLaborRows,
  setCostEstimateLaborRows,
  costEstimateUnmatchedLaborRows = [],
  onUseUnmatchedLaborRow,
  onRemoveUnmatchedLaborRow,
  costEstimateCountRows,
  costEstimateFixtureMaterials,
  panel,
  costEstimateMaterialTotalRoughIn,
  costEstimateMaterialTotalTopOut,
  costEstimateMaterialTotalTrimSet,
  teamLaborDataForBids = [],
  laborRateInput,
  setLaborRateInput,
  drivingCostRate,
  setDrivingCostRate,
  hoursPerTrip,
  setHoursPerTrip,
  estimatorCostUseFlat,
  estimatorCostPerCount,
  estimatorCostFlatAmount,
  travelPeople,
  setTravelPeople,
  travelNights,
  setTravelNights,
  travelMealsRate,
  setTravelMealsRate,
  travelHotelRate,
  setTravelHotelRate,
  equipmentRows,
  setEquipmentRows,
  permitRows,
  setPermitRows,
  subcontractorRows,
  setSubcontractorRows,
  wasteRows,
  setWasteRows,
  otherRows,
  setOtherRows,
  laborBookVersions,
  laborBookEntries,
  selectedLaborBookVersionId,
  laborBookEntriesVersionId,
  setLaborBookEntriesVersionId,
  loadLaborBookVersions,
  loadLaborBookEntries,
  onSelectBid,
  onClose,
  onEditBid,
  ledgerPrefixMap,
  onlyMyBids,
  setOnlyMyBids,
  isMyBid,
}: BidsLaborTabProps) {
  // Bid flow facts for the selected bid (one chunked read per selection).
  const { factsByBid: bidFlowFactsByBid } = useBidFlowFacts(selectedBidForCostEstimate ? [selectedBidForCostEstimate.id] : [])
  const bidFlowReview = useBidFlowReview(selectedBidForCostEstimate ? [selectedBidForCostEstimate] : [])
  // v2.3241: the strip folds to one line beside the title; per device.
  const flowFold = useBidFlowFold()
  const confirmDialog = useConfirmDialog()
  const { showToast } = useToastContext()
  // Breakdown jump landing (v2.2400): scroll + flash the fixture's HOURS row.
  const rowJumpFlashDomId = usePendingRowFlash(rowJump ? breakdownJumpDomId(rowJump) : null, (found) => {
    if (!found && rowJump) showToast(breakdownJumpMissMessage(rowJump.tab, rowJump.fixture), 'info')
    onRowJumpHandled?.()
  })
  const [costEstimateSearchQuery, setCostEstimateSearchQuery] = useState('')
  const laborRateInputRef = useRef<HTMLInputElement>(null)
  const bidTeamLabor = useMemo(() => (selectedBidForCostEstimate ? teamLaborDataForBids.find((r) => r.bidId === selectedBidForCostEstimate.id) ?? null : null), [teamLaborDataForBids, selectedBidForCostEstimate])
  // The company crew rate (v2.3294) — only the New view reads it; the hook is fail-soft.
  const { crewRate, loading: crewRateLoading } = useBidCrewRate(!!selectedBidForCostEstimate)
  // Calibration (v2.3307): the jobs linked to bids that priced with the applied book — the New view's Book vs jobs tile and evidence chips.
  const calibration = useLaborBookCalibration(selectedLaborBookVersionId, !!selectedBidForCostEstimate)
  // Baselines (v2.3367): every billed job's hours per $1k — the book's fallback when this bid has no count sheet.
  const baselineRates = useJobBaselineRates(!!selectedBidForCostEstimate)
  const baselineWords = useMemo(() => {
    if (baselineRates.loading && baselineRates.rates.length === 0) return null
    const value = selectedBidForCostEstimate ? (Number(selectedBidForCostEstimate.agreed_value) > 0 ? Number(selectedBidForCostEstimate.agreed_value) : Number(selectedBidForCostEstimate.bid_value) || null) : null
    return baselineReadingWords(baselineReading(baselineRates.rates, value), (h) => `${Math.round(h).toLocaleString('en-US')} h`)
  }, [baselineRates.loading, baselineRates.rates, selectedBidForCostEstimate])
  const focusLaborRate = () => {
    const el = laborRateInputRef.current
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    el.focus()
  }
  const [costEstimateAutosaveStatus, setCostEstimateAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'invalid'>('idle')
  const [costEstimateAutosaveReason, setCostEstimateAutosaveReason] = useState<string | null>(null)
  // J11-F8: per-cell save state for the autosaved inputs — each edit marks its key pending; the
  // autosave effect moves pending → saving → gone. The cell shows it (underline + title + aria-busy).
  const [cellSaves, setCellSaves] = useState<LaborCellSaveMap>(EMPTY_LABOR_CELL_SAVE_MAP)
  const markCell = (key: string) => setCellSaves((m) => markLaborCellPending(m, key))
  /** Accessible name + live save state for one autosaved input. Spread onto the `<input>`. */
  const cellA11y = (key: string, label: string) => {
    const status = cellSaves[key]
    return {
      'aria-label': label,
      'aria-busy': status === 'saving' || undefined,
      'data-save-state': status,
      title: laborCellStatusTitle(status),
    }
  }
  /** Style delta for a cell that is unsaved (amber) or saving (blue); nothing once saved. */
  const cellSaveStyle = (key: string): React.CSSProperties => {
    const status = cellSaves[key]
    if (status === 'pending') return { boxShadow: 'inset 0 -2px 0 var(--text-amber-700)' }
    if (status === 'saving') return { boxShadow: 'inset 0 -2px 0 #3b82f6' }
    return {}
  }
  // Collapsible non-row Direct-Cost sections (collapsed by default; show total on the right).
  const [vehicleTravelCollapsed, setVehicleTravelCollapsed] = useState(true)
  const [lodgingCollapsed, setLodgingCollapsed] = useState(true)
  const [laborEntryFormOpen, setLaborEntryFormOpen] = useState(false)
  const [editingLaborEntry, setEditingLaborEntry] = useState<LaborBookEntryWithFixture | null>(null)
  const [laborEntryFixtureName, setLaborEntryFixtureName] = useState('')
  const [laborEntryAliasNames, setLaborEntryAliasNames] = useState('')
  const [laborEntryRoughIn, setLaborEntryRoughIn] = useState('')
  const [laborEntryTopOut, setLaborEntryTopOut] = useState('')
  const [laborEntryTrimSet, setLaborEntryTrimSet] = useState('')
  const [laborEntryUnit, setLaborEntryUnit] = useState<LaborUnit>('each')
  const [laborEntryKind, setLaborEntryKind] = useState<LaborEntryKind>('fixture')
  const [savingLaborEntry, setSavingLaborEntry] = useState(false)
  const [laborBookSectionOpen, setLaborBookSectionOpen] = useState(true)
  // One book per trade (v2.3597): the panel shows the bid's book, else the trade's; a person never picks.
  const tradeBook = useMemo(() => laborBookForTrade(laborBookVersions), [laborBookVersions])
  const panelBookId = selectedLaborBookVersionId ?? tradeBook?.id ?? null
  useEffect(() => {
    if (panelBookId !== laborBookEntriesVersionId) setLaborBookEntriesVersionId(panelBookId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelBookId])
  const panelBook = useMemo(() => laborBookVersions.find((v) => v.id === panelBookId) ?? null, [laborBookVersions, panelBookId])
  const bookRights = useMemo(() => laborBookRights(viewerRole), [viewerRole])
  const [resettingEntryId, setResettingEntryId] = useState<string | null>(null)
  // The people behind the chips: who set an entry, who proposed a calibration.
  const [userNames, setUserNames] = useState<Record<string, string>>({})
  const namedIds = useMemo(() => {
    const ids = new Set<string>()
    for (const e of laborBookEntries) if (e.set_by) ids.add(e.set_by)
    for (const v of laborBookVersions) if (v.proposed_by) ids.add(v.proposed_by)
    return [...ids].sort()
  }, [laborBookEntries, laborBookVersions])
  useEffect(() => {
    const missing = namedIds.filter((id) => !(id in userNames))
    if (missing.length === 0) return
    let cancelled = false
    void supabase.from('users').select('id, name').in('id', missing).then(({ data }) => {
      if (cancelled) return
      setUserNames((prev) => {
        const next = { ...prev }
        for (const id of missing) next[id] = ''
        for (const u of (data ?? []) as Array<{ id: string; name: string | null }>) next[u.id] = u.name ?? ''
        return next
      })
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namedIds])
  const nameOf = (id: string): string | null => userNames[id] || null
  const bookProposal = useMemo<CalibrationProposal | null>(() => {
    const v = laborBookVersions.find((b) => b.id === selectedLaborBookVersionId)
    if (!v || v.proposed_multiplier == null) return null
    return { multiplier: Number(v.proposed_multiplier), byName: v.proposed_by ? nameOf(v.proposed_by) : null, at: v.proposed_at ?? null, note: v.proposed_note ?? null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laborBookVersions, selectedLaborBookVersionId, userNames])
  /** Reset to robot: the robot's own numbers back onto the entry; the trigger clears the stamp. */
  async function resetEntryToRobot(entry: LaborBookEntryWithFixture) {
    const robot = robotHoursOf(entry)
    if (!robot) return
    setResettingEntryId(entry.id)
    setError(null)
    const { error: err } = await supabase.from('labor_book_entries').update({ rough_in_hrs: robot.rough, top_out_hrs: robot.top, trim_set_hrs: robot.trim }).eq('id', entry.id)
    if (err) setError(`Failed to reset ${entry.fixture_types?.name ?? 'the entry'}: ${err.message}`)
    else if (laborBookEntriesVersionId) await loadLaborBookEntries(laborBookEntriesVersionId)
    setResettingEntryId(null)
  }
  const [updatingBidDistance, setUpdatingBidDistance] = useState(false)
  const [bidDistanceUpdateSuccess, setBidDistanceUpdateSuccess] = useState(false)
  const [travelZip, setTravelZip] = useState('')
  const [travelLookupStatus, setTravelLookupStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [travelLookupMessage, setTravelLookupMessage] = useState<string | null>(null)

  // Autosave for Labor tab
  useEffect(() => {
    if (!costEstimate) return

    const timer = setTimeout(async () => {
      // The boxes → the UPDATE, or the reason nothing can be saved (v2.3292: the status no longer sticks on "Saving…").
      const payload = buildCostEstimateAutosavePayload({ laborRateInput, drivingCostRate, hoursPerTrip, estimatorCostUseFlat, estimatorCostPerCount, estimatorCostFlatAmount, travelPeople, travelNights, travelMealsRate, travelHotelRate })
      if (!payload.ok) {
        setCostEstimateAutosaveStatus('invalid')
        setCostEstimateAutosaveReason(payload.reason)
        return
      }
      setCostEstimateAutosaveReason(null)
      setCostEstimateAutosaveStatus('saving')
      setCellSaves(beginLaborCellSaves)

      // Save cost estimate fields
      await supabase
        .from('cost_estimates')
        .update({
          ...payload.values,
        })
        .eq('id', costEstimate.id)

      // Save labor rows
      for (const row of costEstimateLaborRows) {
        await supabase.from('cost_estimate_labor_rows').update(laborRowAutosaveUpdate(row)).eq('id', row.id)
      }

      // Save equipment & tool rental rows (note + per-stage amounts)
      for (const row of equipmentRows) {
        await supabase
          .from('cost_estimate_equipment_rows')
          .update(stageAmountRowAutosaveUpdate(row))
          .eq('id', row.id)
      }

      // Save permits, inspections & regulatory fee rows
      for (const row of permitRows) {
        await supabase
          .from('cost_estimate_permit_rows')
          .update(stageAmountRowAutosaveUpdate(row))
          .eq('id', row.id)
      }

      // Save subcontractor fee rows
      for (const row of subcontractorRows) {
        await supabase
          .from('cost_estimate_subcontractor_rows')
          .update(stageAmountRowAutosaveUpdate(row))
          .eq('id', row.id)
      }

      // Save waste disposal & site cleanup rows
      for (const row of wasteRows) {
        await supabase
          .from('cost_estimate_waste_rows')
          .update(stageAmountRowAutosaveUpdate(row))
          .eq('id', row.id)
      }

      // Save "Other" rows
      for (const row of otherRows) {
        await supabase
          .from('cost_estimate_other_rows')
          .update(stageAmountRowAutosaveUpdate(row))
          .eq('id', row.id)
      }

      setCostEstimateAutosaveStatus('saved')
      setCellSaves(finishLaborCellSaves)
      setTimeout(() => setCostEstimateAutosaveStatus('idle'), 2000)
    }, 1500) // 1.5 second debounce

    return () => clearTimeout(timer)
  }, [costEstimate, laborRateInput, drivingCostRate, hoursPerTrip, estimatorCostUseFlat, estimatorCostPerCount, estimatorCostFlatAmount, travelPeople, travelNights, travelMealsRate, travelHotelRate, equipmentRows, permitRows, subcontractorRows, wasteRows, otherRows, costEstimateLaborRows])

  // Best-effort prefill of the Travel ZIP from the bid's customer address (a 5-digit ZIP).
  // Not persisted; resets when the selected bid changes. The user can always override.
  useEffect(() => {
    setTravelZip(lastZipInAddress(selectedBidForCostEstimate?.customers?.address))
    setTravelLookupStatus('idle')
    setTravelLookupMessage(null)
  }, [selectedBidForCostEstimate?.id, selectedBidForCostEstimate?.customers?.address])

  function openNewLaborEntry() {
    setEditingLaborEntry(null)
    setLaborEntryFixtureName('')
    setLaborEntryAliasNames('')
    setLaborEntryRoughIn('')
    setLaborEntryTopOut('')
    setLaborEntryTrimSet('')
    setLaborEntryUnit('each')
    setLaborEntryKind('fixture')
    setError(null)
    setLaborEntryFormOpen(true)
  }

  function openEditLaborEntry(entry: LaborBookEntryWithFixture) {
    setEditingLaborEntry(entry)
    setLaborEntryFixtureName(entry.fixture_types?.name ?? '')
    setLaborEntryAliasNames((entry.alias_names ?? []).join(', '))
    setLaborEntryRoughIn(String(entry.rough_in_hrs))
    setLaborEntryTopOut(String(entry.top_out_hrs))
    setLaborEntryTrimSet(String(entry.trim_set_hrs))
    setLaborEntryUnit(asLaborUnit(entry.unit))
    setLaborEntryKind(asLaborEntryKind(entry.kind))
    setError(null)
    setLaborEntryFormOpen(true)
  }

  function closeLaborEntryForm() {
    setLaborEntryFormOpen(false)
    setEditingLaborEntry(null)
    setLaborEntryFixtureName('')
    setLaborEntryAliasNames('')
    setLaborEntryRoughIn('')
    setLaborEntryTopOut('')
    setLaborEntryTrimSet('')
    setLaborEntryUnit('each')
    setLaborEntryKind('fixture')
    setError(null)
  }

  async function saveLaborEntry(e: React.FormEvent) {
    e.preventDefault()
    if (!laborBookEntriesVersionId) {
      setError('No labor book selected')
      return
    }
    const fixtureName = laborEntryFixtureName.trim()
    if (!fixtureName) {
      setError('Please enter a fixture type')
      return
    }

    setSavingLaborEntry(true)
    setError(null)

    // Get or auto-create fixture type
    const laborResult = await getOrCreateFixtureTypeId(fixtureName)
    if (!laborResult.id) {
      setError(('error' in laborResult ? laborResult.error : null) ?? `Failed to create or find fixture type "${fixtureName}"`)
      setSavingLaborEntry(false)
      return
    }
    const fixtureTypeId = laborResult.id

    const aliasNames = laborEntryAliasNames
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const rough = parseFloat(laborEntryRoughIn) || 0
    const top = parseFloat(laborEntryTopOut) || 0
    const trim = parseFloat(laborEntryTrimSet) || 0
    if (editingLaborEntry) {
      const { error: err } = await supabase
        .from('labor_book_entries')
        .update({ fixture_type_id: fixtureTypeId, alias_names: aliasNames, rough_in_hrs: rough, top_out_hrs: top, trim_set_hrs: trim, unit: laborEntryKind === 'task' ? 'each' : laborEntryUnit, kind: laborEntryKind })
        .eq('id', editingLaborEntry.id)
      if (err) setError(err.message)
      else {
        await loadLaborBookEntries(laborBookEntriesVersionId)
        closeLaborEntryForm()
      }
    } else {
      const maxSeq = laborBookEntries.length === 0 ? 0 : Math.max(...laborBookEntries.map((e) => e.sequence_order))
      const { error: err } = await supabase
        .from('labor_book_entries')
        .insert({ version_id: laborBookEntriesVersionId, fixture_type_id: fixtureTypeId, alias_names: aliasNames, rough_in_hrs: rough, top_out_hrs: top, trim_set_hrs: trim, sequence_order: maxSeq + 1, unit: laborEntryKind === 'task' ? 'each' : laborEntryUnit, kind: laborEntryKind })
      if (err) setError(err.message)
      else {
        await loadLaborBookEntries(laborBookEntriesVersionId)
        closeLaborEntryForm()
      }
    }
    setSavingLaborEntry(false)
  }

  /** Returns false when the user cancels the confirm, true once they confirm (even if the delete errors). */
  async function deleteLaborEntry(entry: LaborBookEntryWithFixture) {
    if (
      !(await confirmDialog({
        message: `Delete "${entry.fixture_types?.name ?? ''}" from this labor book?`,
        confirmLabel: 'Delete',
        danger: true,
      }))
    )
      return false
    const { error: err } = await supabase.from('labor_book_entries').delete().eq('id', entry.id)
    if (err) setError(err.message)
    else if (laborBookEntriesVersionId) await loadLaborBookEntries(laborBookEntriesVersionId)
    return true
  }

  async function handleTravelPerDiemLookup() {
    const zip = travelZip.trim()
    if (!/^\d{5}$/.test(zip)) {
      setTravelLookupStatus('error')
      setTravelLookupMessage('Enter a 5-digit ZIP code.')
      return
    }
    setTravelLookupStatus('loading')
    setTravelLookupMessage(null)
    try {
      const { data, error } = await supabase.functions.invoke('gsa-per-diem', { body: { zip } })
      if (error) {
        setTravelLookupStatus('error')
        setTravelLookupMessage('Lookup failed. Enter rates manually.')
        return
      }
      const res = data as { ok?: boolean; meals_rate?: number | null; hotel_rate?: number | null; city?: string | null; state?: string | null; error?: string }
      if (!res?.ok) {
        setTravelLookupStatus('error')
        setTravelLookupMessage(
          res?.error === 'oconus'
            ? 'GSA per diem is not available for this ZIP (outside the continental US). Enter rates manually.'
            : 'No GSA rate found for this ZIP. Enter rates manually.'
        )
        return
      }
      if (res.meals_rate != null) setTravelMealsRate(String(res.meals_rate))
      if (res.hotel_rate != null) setTravelHotelRate(String(res.hotel_rate))
      setTravelLookupStatus('idle')
      const loc = [res.city, res.state].filter(Boolean).join(', ')
      setTravelLookupMessage(`GSA rates loaded${loc ? ` for ${loc}` : ''}. Override as needed.`)
    } catch {
      setTravelLookupStatus('error')
      setTravelLookupMessage('Lookup failed. Enter rates manually.')
    }
  }

  async function updateBidDistanceFromCostEstimate() {
    if (!selectedBidForCostEstimate?.id) return
    setUpdatingBidDistance(true)
    setError(null)
    const val = costEstimateDistanceInput.trim()
    const { data: rows, error: err } = await supabase
      .from('bids')
      .update({ distance_from_office: val || null })
      .eq('id', selectedBidForCostEstimate.id)
      .select('id')
    if (err) {
      setError(err.message)
    } else if (bidUpdateRefused(rows)) {
      setError(BID_UPDATE_NOT_APPLIED_MESSAGE)
    } else {
      const fresh = (await loadBids()).find((b) => b.id === selectedBidForCostEstimate.id)
      if (fresh) {
        setSelectedBidForCostEstimate(fresh)
        setCostEstimateDistanceInput(fresh.distance_from_office ?? '')
      }
      setBidDistanceUpdateSuccess(true)
      setTimeout(() => setBidDistanceUpdateSuccess(false), 3000)
    }
    setUpdatingBidDistance(false)
  }

  function setCostEstimateLaborRow(rowId: string, updates: Partial<Pick<CostEstimateLaborRow, 'rough_in_hrs_per_unit' | 'top_out_hrs_per_unit' | 'trim_set_hrs_per_unit' | 'is_fixed'>>) {
    setCostEstimateLaborRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r
        const next = { ...r, ...updates }
        // Old's "fixed" checkbox and the row's kind say the same thing (v2.3291): fixed on → task; fixed off a task → fixture. A sub line stays a sub.
        if (updates.is_fixed !== undefined && r.kind !== 'sub') next.kind = updates.is_fixed ? 'task' : 'fixture'
        return next
      })
    )
  }

  // The direct-cost list (v2.3295), five tables behind one factory: field edits update state
  // (persisted by the debounced save effect); add/remove hit the DB immediately.
  const directCostHandlers = directCostHandlersByKind(supabase, {
    costEstimateId: costEstimate?.id,
    setError,
    tables: {
      equipment: { rows: equipmentRows, setRows: setEquipmentRows },
      permit: { rows: permitRows, setRows: setPermitRows },
      sub: { rows: subcontractorRows, setRows: setSubcontractorRows },
      waste: { rows: wasteRows, setRows: setWasteRows },
      other: { rows: otherRows, setRows: setOtherRows },
    },
  })
  // The computed driving line the list shows at its top — the same arithmetic as every total.
  const laborDrivingLine = (() => {
    if (!selectedBidForCostEstimate || costEstimateLaborRows.length === 0) return null
    const b = computeBidCostBreakdown({
      materialTotalRoughIn: 0,
      materialTotalTopOut: 0,
      materialTotalTrimSet: 0,
      laborRate: null,
      laborRows: costEstimateLaborRows,
      distanceFromOffice: selectedBidForCostEstimate.distance_from_office ?? null,
      costEstimate,
      countRowsLength: costEstimateCountRows.length,
      ratePerMileOverride: parseFloat(drivingCostRate) || 0.7,
      hoursPerTripOverride: parseFloat(hoursPerTrip) || 2.0,
    })
    return { drivingCost: b.drivingCost, numTrips: b.numTrips, ratePerMile: b.ratePerMile, distance: b.distance, totalHours: b.totalLaborHours, hrsPerTrip: b.hrsPerTrip }
  })()

  function buildCostEstimatePrintContext(): CostEstimatePrintContext | null {
    if (!selectedBidForCostEstimate) return null
    return {
      bid: selectedBidForCostEstimate,
      bidVersionId: selectedBidVersionId,
      costEstimate,
      laborRows: costEstimateLaborRows,
      countRows: costEstimateCountRows,
      materialTotalRoughIn: costEstimateMaterialTotalRoughIn,
      laborRateInput,
      drivingCostRate,
      hoursPerTrip,
      taxPercent: parseFloat(costEstimatePOModalTaxPercent || '8.25') || 0,
      directCostRows: directCostRowsFromTables({ equipment: equipmentRows, permit: permitRows, sub: subcontractorRows, waste: wasteRows, other: otherRows }),
    }
  }

  async function printCostEstimatePage() {
    const ctx = buildCostEstimatePrintContext()
    if (!ctx) return
    await printCostEstimatePageDoc(ctx)
  }

  function printRoughInSubSheet() {
    const ctx = buildCostEstimatePrintContext()
    if (!ctx) return
    printRoughInSubSheetDoc(ctx)
  }

  function printTopOutSubSheet() {
    const ctx = buildCostEstimatePrintContext()
    if (!ctx) return
    printTopOutSubSheetDoc(ctx)
  }

  function printTrimSetSubSheet() {
    const ctx = buildCostEstimatePrintContext()
    if (!ctx) return
    printTrimSetSubSheetDoc(ctx)
  }

  function printAllSubSheets() {
    const ctx = buildCostEstimatePrintContext()
    if (!ctx) return
    printAllSubSheetsDoc(ctx)
  }

  const bidsScopedForCostEstimate = onlyMyBids ? bids.filter(isMyBid) : bids
  const filteredBidsForCostEstimate: BidWithBuilder[] = filterBidsForPicker(bidsScopedForCostEstimate, costEstimateSearchQuery, ledgerPrefixMap)
  const costEstimateBidList: BidWithBuilder[] = Array.from(filteredBidsForCostEstimate, (row) => row as BidWithBuilder)

  return (
    <div>
      {!selectedBidForCostEstimate && (
        <BidPickerSearchRow query={costEstimateSearchQuery} onQueryChange={setCostEstimateSearchQuery} onlyMyBids={onlyMyBids} onOnlyMyBidsChange={setOnlyMyBids} />
      )}
      {selectedBidForCostEstimate && (
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
            flow={deriveBidFlow(selectedBidForCostEstimate, bidFlowFactsByBid[selectedBidForCostEstimate.id])}
            bidLabel={selectedBidForCostEstimate.project_name ?? undefined}
            canOpenDoor={(d) => d === 'review' || (onOpenBidFlowDoor != null && (bidFlowDoorAllowed ? bidFlowDoorAllowed(d) : d != null))}
            onOpenDoor={(d, step) => {
              if (d === 'review') void bidFlowReview.markReviewed(selectedBidForCostEstimate)
              else onOpenBidFlowDoor?.(selectedBidForCostEstimate, d, step)
            }}
            reviewStamp={bidFlowReview.stampFor(selectedBidForCostEstimate)}
          />
          ) : null}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', minWidth: 0 }}>
              <BidWorkflowTabTitleWithPreview
                bid={selectedBidForCostEstimate}
                previewEnabled={bidPreview != null}
                onOpenPreview={() => bidPreview?.openBidPreviewFromBid(selectedBidForCostEstimate)}
              />
              <BidFlowStrip
                variant="inline"
                expanded={flowFold.expanded}
                onToggleExpanded={flowFold.toggle}
                flow={deriveBidFlow(selectedBidForCostEstimate, bidFlowFactsByBid[selectedBidForCostEstimate.id])}
                bidLabel={selectedBidForCostEstimate.project_name ?? undefined}
                canOpenDoor={(d) => d === 'review' || (onOpenBidFlowDoor != null && (bidFlowDoorAllowed ? bidFlowDoorAllowed(d) : d != null))}
                onOpenDoor={(d, step) => {
                if (d === 'review') void bidFlowReview.markReviewed(selectedBidForCostEstimate)
                else onOpenBidFlowDoor?.(selectedBidForCostEstimate, d, step)
                }}
                reviewStamp={bidFlowReview.stampFor(selectedBidForCostEstimate)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => void printCostEstimatePage()}
                style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                Print
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
          {panel === 'skeleton' ? (
            // J11-F1: while this bid's Version is still resolving, say so — the empty sentence
            // below used to render here and read as deleted work (same pattern as Pricing, v2.2367).
            <div role="status" aria-label="Loading this bid's fixtures and hours" style={{ padding: '0.95rem 1.1rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8125rem', fontWeight: 500 }}>
                <span className="bid-resolve-spinner" aria-hidden />
                Loading this bid's fixtures and hours…
              </div>
              {[['34%', '14%'], ['46%', '20%'], ['40%', '11%']].map(([w1, w2]) => (
                <div key={w1} aria-hidden style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span className="bid-resolve-shimmer" style={{ width: w1, height: 12, borderRadius: 4 }} />
                  <span className="bid-resolve-shimmer" style={{ width: w2, height: 12, borderRadius: 4 }} />
                </div>
              ))}
            </div>
          ) : panel === 'empty' ? (
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Add fixtures in the Counts tab first.</p>
          ) : (
            <>
              {/* Manhours section */}
              <div style={{ marginBottom: '1.5rem' }}>
                <BidsLaborNewView
                    bidId={selectedBidForCostEstimate.id}
                    bidValue={selectedBidForCostEstimate.bid_value != null ? Number(selectedBidForCostEstimate.bid_value) : null}
                    rows={costEstimateLaborRows}
                    ratePerHour={laborRateInput.trim() === '' ? null : parseFloat(laborRateInput) || null}
                    materialsSource={(costEstimateMaterialTotalRoughIn ?? 0) + (costEstimateMaterialTotalTopOut ?? 0) + (costEstimateMaterialTotalTrimSet ?? 0) > 0 ? 'takeoff' : 'none'}
                    appliedBookVersionId={selectedLaborBookVersionId}
                    appliedBookName={laborBookVersions.find((v) => v.id === selectedLaborBookVersionId)?.name ?? null}
                    costEstimateId={costEstimate?.id ?? null}
                    bidLabel={selectedBidForCostEstimate.bid_number ?? selectedBidForCostEstimate.project_name ?? null}
                    crewRate={crewRate}
                    baselineWords={baselineWords}
                    crewRateLoading={crewRateLoading}
                    onUseCompanyRate={(rate) => { markCell('rate:labor'); setLaborRateInput(rate.toFixed(2)) }}
                    onClearRate={() => { markCell('rate:labor'); setLaborRateInput('') }}
                    teamLabor={bidTeamLabor ? { hours: bidTeamLabor.manHours, cost: bidTeamLabor.bidCost, people: bidTeamLabor.people } : null}
                    materials={{ rough: costEstimateMaterialTotalRoughIn, top: costEstimateMaterialTotalTopOut, trim: costEstimateMaterialTotalTrimSet }}
                    costEstimate={costEstimate}
                    distanceFromOffice={selectedBidForCostEstimate.distance_from_office ?? null}
                    countRowsLength={costEstimateCountRows.length}
                    countRows={costEstimateCountRows}
                    materialsByCountRowId={costEstimateFixtureMaterials}
                    alternateTags={selectedBidForCostEstimate.alternate_group_tags ?? []}
                    directCostTables={{ equipment: equipmentRows, permit: permitRows, sub: subcontractorRows, waste: wasteRows, other: otherRows }}
                    calibrationJobs={calibration.jobs}
                    calibrationLoaded={calibration.loaded}
                    tradeName={selectedServiceTypeName}
                    viewer={{ userId: viewerUserId, role: viewerRole }}
                    bookProposal={bookProposal}
                    onBookChanged={() => {
                      void loadLaborBookVersions()
                      if (laborBookEntriesVersionId) void loadLaborBookEntries(laborBookEntriesVersionId)
                    }}
                    setRowHours={setCostEstimateLaborRow}
                    markCell={markCell}
                    cellA11y={cellA11y}
                    cellSaveStyle={cellSaveStyle}
                    replaceRows={setCostEstimateLaborRows}
                    getOrCreateFixtureTypeId={(name) => getOrCreateFixtureTypeId(name)}
                    onFocusRate={focusLaborRate}
                    setError={setError}
                    rowDomId={laborRowDomId}
                    rowJumpFlashDomId={rowJumpFlashDomId}
                  />
                {onUseUnmatchedLaborRow && onRemoveUnmatchedLaborRow ? (
                  <BidsLaborUnmatchedBand
                    rows={costEstimateUnmatchedLaborRows}
                    laborRows={costEstimateLaborRows}
                    onUse={onUseUnmatchedLaborRow}
                    onRemove={onRemoveUnmatchedLaborRow}
                  />
                ) : null}
                {/* v2.4453: the rate and the print buttons wrap, so on a phone the buttons drop below the
                    rate. On one line they pushed the page 66 px sideways. */}
                <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <label style={{ marginRight: '0.5rem', fontWeight: 500 }}>Labor rate ($/hr)</label>
                    <input
                      ref={laborRateInputRef}
                      type="number"
                      min={0}
                      step={0.01}
                      value={laborRateInput}
                      onChange={(e) => { markCell('rate:labor'); setLaborRateInput(e.target.value) }}
                      onWheel={(e) => e.currentTarget.blur()}
                      {...cellA11y('rate:labor', 'Labor rate, dollars per hour')}
                      style={{ width: '8rem', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, ...cellSaveStyle('rate:labor') }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={printRoughInSubSheet}
                      style={{ padding: '0.35rem 0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
                    >
                      Rough In sub sheet
                    </button>
                    <button
                      type="button"
                      onClick={printTopOutSubSheet}
                      style={{ padding: '0.35rem 0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
                    >
                      Top Out sub sheet
                    </button>
                    <button
                      type="button"
                      onClick={printTrimSetSubSheet}
                      style={{ padding: '0.35rem 0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
                    >
                      Trim Set sub sheet
                    </button>
                    <button
                      type="button"
                      onClick={printAllSubSheets}
                      style={{ padding: '0.35rem 0.75rem', background: '#10b981', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}
                    >
                      Print All
                    </button>
                  </div>
                </div>
                {costEstimateLaborRows.length > 0 && (() => {
                  const { totalHours, rate, laborCost } = laborTotalFromInputs({ rowHours: costEstimateLaborRows.map((r) => laborRowHours(r)), laborRateInput })
                  return (
                    <p style={{ margin: '0.75rem 0 0', fontWeight: 600, textAlign: 'right' }}>
                      Labor total: ${formatCurrency(laborCost)}
                      <br />
                      <span style={{ fontWeight: 400, fontSize: '0.875rem' }}>({totalHours.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} hrs × ${formatCurrency(rate)}/hr)</span>
                    </p>
                  )
                })()}
                {/* Driving Cost Section */}
                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-amber-100)', borderRadius: 4, border: '1px solid var(--border-amber-soft)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: vehicleTravelCollapsed ? 0 : '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <button type="button" onClick={() => setVehicleTravelCollapsed((c) => !c)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
                      <span aria-hidden style={{ fontSize: '0.7rem' }}>{vehicleTravelCollapsed ? '▶' : '▼'}</span>
                      Vehicle Travel
                    </button>
                    {vehicleTravelCollapsed && (() => {
                      const { distance, ratePerMile, numTrips, drivingCost } = drivingSummaryFromInputs({
                        distanceFromOffice: selectedBidForCostEstimate?.distance_from_office,
                        totalHours: costEstimateLaborRows.reduce((s, r) => s + laborRowHours(r), 0),
                        drivingCostRate,
                        hoursPerTrip,
                      })
                      return (
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-700)' }}>
                          Driving cost: {numTrips.toFixed(1)} trips × ${ratePerMile.toFixed(2)}/mi × {distance.toFixed(0)}mi = <span style={{ fontWeight: 700 }}>${formatCurrency(drivingCost)}</span>
                        </span>
                      )
                    })()}
                    {!vehicleTravelCollapsed && selectedBidForCostEstimate && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => onEditBid(selectedBidForCostEstimate)}
                          style={{ padding: '0.25rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500 }}
                        >
                          Edit bid
                        </button>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem' }}>
                          [
                          <input
                            type="number"
                            min={0}
                            step={0.1}
                            value={costEstimateDistanceInput}
                            onChange={(e) => setCostEstimateDistanceInput(e.target.value)}
                            onWheel={(e) => e.currentTarget.blur()}
                            aria-label="Distance to the job, miles"
                            placeholder="—"
                            style={{ width: '4rem', padding: '0.25rem 0.375rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', textAlign: 'right' }}
                          />
                          {' mi]'}
                        </span>
                        <button
                          type="button"
                          onClick={updateBidDistanceFromCostEstimate}
                          disabled={updatingBidDistance}
                          style={{ padding: '0.25rem 0.5rem', background: updatingBidDistance ? '#d1d5db' : 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: updatingBidDistance ? 'wait' : 'pointer', fontSize: '0.75rem', fontWeight: 500 }}
                        >
                          {updatingBidDistance ? 'Updating…' : 'Update bid distance'}
                        </button>
                        {bidDistanceUpdateSuccess && (
                          <span style={{ color: 'var(--text-green-600)', fontSize: '0.75rem', fontWeight: 500 }}>✓ Distance updated</span>
                        )}
                      </div>
                    )}
                  </div>
                  {!vehicleTravelCollapsed && (
                  <>
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                    <div>
                      <label style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>Rate per mile ($)</label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={drivingCostRate}
                        onChange={(e) => { markCell('rate:perMile'); setDrivingCostRate(e.target.value) }}
                        onWheel={(e) => e.currentTarget.blur()}
                        {...cellA11y('rate:perMile', 'Rate per mile, dollars')}
                        style={{ width: '6rem', padding: '0.375rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', ...cellSaveStyle('rate:perMile') }}
                      />
                    </div>
                    <div>
                      <label style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>Hours per trip</label>
                      <input
                        type="number"
                        min={0.1}
                        step={0.1}
                        value={hoursPerTrip}
                        onChange={(e) => { markCell('rate:hoursPerTrip'); setHoursPerTrip(e.target.value) }}
                        onWheel={(e) => e.currentTarget.blur()}
                        {...cellA11y('rate:hoursPerTrip', 'Hours per trip')}
                        style={{ width: '6rem', padding: '0.375rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', ...cellSaveStyle('rate:hoursPerTrip') }}
                      />
                    </div>
                  </div>
                  {(() => {
                    const { distance, ratePerMile, numTrips, drivingCost } = drivingSummaryFromInputs({
                      distanceFromOffice: selectedBidForCostEstimate?.distance_from_office,
                      totalHours: costEstimateLaborRows.reduce((s, r) => s + laborRowHours(r), 0),
                      drivingCostRate,
                      hoursPerTrip,
                    })
                    return (
                      <>
                        <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                          Distance to office: {distance > 0 ? `${distance.toFixed(1)} miles` : 'Not set'}
                        </p>
                        <p style={{ margin: 0, fontWeight: 400, fontSize: '0.875rem', textAlign: 'right' }}>
                          Driving cost: {numTrips.toFixed(1)} trips × ${ratePerMile.toFixed(2)}/mi × {distance.toFixed(0)}mi = <span style={{ fontWeight: 700 }}>${formatCurrency(drivingCost)}</span>
                        </p>
                      </>
                    )
                  })()}
                  </>
                  )}
                </div>
              </div>
              {/* Travel Cost Parameters */}
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-amber-100)', borderRadius: 4, border: '1px solid var(--border-amber-soft)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: lodgingCollapsed ? 0 : '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <button type="button" onClick={() => setLodgingCollapsed((c) => !c)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
                    <span aria-hidden style={{ fontSize: '0.7rem' }}>{lodgingCollapsed ? '▶' : '▼'}</span>
                    Lodging and Meals
                  </button>
                  {lodgingCollapsed && (() => {
                    const { travelCost } = travelSummaryFromInputs({ travelPeople, travelNights, travelMealsRate, travelHotelRate })
                    return (
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-700)' }}>Travel total: <span style={{ fontWeight: 700 }}>${formatCurrency(travelCost)}</span></span>
                    )
                  })()}
                </div>
                {!lodgingCollapsed && (
                <>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Travelers</label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={travelPeople}
                      onChange={(e) => { markCell('travel:people'); setTravelPeople(e.target.value) }}
                      onWheel={(e) => e.currentTarget.blur()}
                      {...cellA11y('travel:people', 'Travelers')}
                      style={{ width: '5rem', padding: '0.375rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', ...cellSaveStyle('travel:people') }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Nights</label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={travelNights}
                      onChange={(e) => { markCell('travel:nights'); setTravelNights(e.target.value) }}
                      onWheel={(e) => e.currentTarget.blur()}
                      {...cellA11y('travel:nights', 'Nights')}
                      style={{ width: '5rem', padding: '0.375rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', ...cellSaveStyle('travel:nights') }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Meals/day ($)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={travelMealsRate}
                      onChange={(e) => { markCell('travel:meals'); setTravelMealsRate(e.target.value) }}
                      onWheel={(e) => e.currentTarget.blur()}
                      placeholder="—"
                      {...cellA11y('travel:meals', 'Meals per day, dollars')}
                      style={{ width: '6rem', padding: '0.375rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', ...cellSaveStyle('travel:meals') }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Hotel/night ($)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={travelHotelRate}
                      onChange={(e) => { markCell('travel:hotel'); setTravelHotelRate(e.target.value) }}
                      onWheel={(e) => e.currentTarget.blur()}
                      placeholder="—"
                      {...cellA11y('travel:hotel', 'Hotel per night, dollars')}
                      style={{ width: '6rem', padding: '0.375rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', ...cellSaveStyle('travel:hotel') }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.875rem' }}>ZIP</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    value={travelZip}
                    onChange={(e) => setTravelZip(e.target.value.replace(/[^0-9]/g, '').slice(0, 5))}
                    aria-label="ZIP code for the travel lookup"
                    placeholder="78701"
                    style={{ width: '5rem', padding: '0.375rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
                  />
                  <button
                    type="button"
                    onClick={handleTravelPerDiemLookup}
                    disabled={travelLookupStatus === 'loading'}
                    style={{ padding: '0.375rem 0.625rem', background: travelLookupStatus === 'loading' ? '#d1d5db' : 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: travelLookupStatus === 'loading' ? 'wait' : 'pointer', fontSize: '0.75rem', fontWeight: 500 }}
                  >
                    {travelLookupStatus === 'loading' ? 'Looking up…' : 'Look up GSA per diem'}
                  </button>
                  {travelLookupMessage && (
                    <span style={{ fontSize: '0.75rem', color: travelLookupStatus === 'error' ? 'var(--text-amber-700)' : 'var(--text-green-600)' }}>{travelLookupMessage}</span>
                  )}
                </div>
                {(() => {
                  const { people, nights, mealsRate, hotelRate, mealsCost, hotelCost, travelCost } = travelSummaryFromInputs({ travelPeople, travelNights, travelMealsRate, travelHotelRate })
                  return (
                    <>
                      <p style={{ margin: '0.25rem 0', fontWeight: 400, fontSize: '0.875rem', textAlign: 'right' }}>
                        Meals: {people} ppl × {nights} nights × ${mealsRate.toFixed(2)} = <span style={{ fontWeight: 700 }}>${formatCurrency(mealsCost)}</span>
                      </p>
                      <p style={{ margin: '0.25rem 0', fontWeight: 400, fontSize: '0.875rem', textAlign: 'right' }}>
                        Hotels: {people} ppl × {nights} nights × ${hotelRate.toFixed(2)} = <span style={{ fontWeight: 700 }}>${formatCurrency(hotelCost)}</span>
                      </p>
                      <p style={{ margin: '0.25rem 0', fontWeight: 400, fontSize: '0.875rem', textAlign: 'right' }}>
                        Travel total: <span style={{ fontWeight: 700 }}>${formatCurrency(travelCost)}</span>
                      </p>
                    </>
                  )
                })()}
                </>
                )}
              </div>
              {/* Bid labor recorded (v2.3294): estimator time is a fact off the clock, not an invented cost */}
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-amber-100)', borderRadius: 4, border: '1px solid var(--border-amber-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }} data-testid="bid-labor-recorded">
                <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Bid labor recorded</span>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-700)' }}>
                  {bidTeamLabor && bidTeamLabor.manHours > 0 ? (
                    <>
                      {bidTeamLabor.manHours.toLocaleString('en-US', { maximumFractionDigits: 1 })} h · <span style={{ fontWeight: 700 }}>${formatCurrency(bidTeamLabor.bidCost)}</span>
                      {bidTeamLabor.people.length > 0 ? <span style={{ color: 'var(--text-muted)' }}> · {bidTeamLabor.people.join(', ')}</span> : null}
                      <span style={{ color: 'var(--text-muted)' }}> · clocked on this bid — already in the overhead pool, not in this bid's cost</span>
                    </>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>no hours clocked on this bid yet — bid labor sits in the overhead pool, not in this bid's cost</span>
                  )}
                </span>
              </div>
                {/* DIRECT COSTS as one list (v2.3295): the five tables behind one section with a kind chip */}
                <BidsDirectCostsSection
                  tables={{ equipment: equipmentRows, permit: permitRows, sub: subcontractorRows, waste: wasteRows, other: otherRows }}
                  canAdd={!!costEstimate?.id}
                  onAdd={(kind) => directCostHandlers[kind].add()}
                  onUpdate={(kind, rowId, updates) => directCostHandlers[kind].update(rowId, updates)}
                  onRemove={(kind, rowId) => directCostHandlers[kind].remove(rowId)}
                  markCell={markCell}
                  cellA11y={cellA11y}
                  cellSaveStyle={cellSaveStyle}
                  driving={laborDrivingLine}
                />
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {costEstimateAutosaveStatus === 'saving' && (
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Saving...</span>
                  )}
                  {costEstimateAutosaveStatus === 'saved' && (
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-green-600)' }}>✓ Saved</span>
                  )}
                  {costEstimateAutosaveStatus === 'invalid' && (
                    <span role="status" style={{ fontSize: '0.875rem', color: 'var(--text-amber-700)', fontWeight: 600 }}>Not saved — {costEstimateAutosaveReason ?? 'check the boxes above'}</span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
      {!selectedBidForCostEstimate && (
        <BidPickerStandardList
          bids={costEstimateBidList.map((row) => row as unknown as BidWithBuilder)}
          searching={costEstimateSearchQuery.trim() !== ''}
          prefixMap={ledgerPrefixMap}
          onSelectBid={onSelectBid}
          emptyMessage={costEstimateSearchQuery.trim() ? 'No bids match your search.' : null}
        />
      )}
      <BidsLaborBookPanel
        book={{
          sectionOpen: laborBookSectionOpen,
          onToggleSection: () => setLaborBookSectionOpen((prev) => !prev),
          book: panelBook ? { name: panelBook.name, tradeName: selectedServiceTypeName } : null,
          summaryWords: bookSummaryWords(laborBookEntries),
          entries: laborBookEntries,
          rights: bookRights,
          userId: viewerUserId,
          nameOf,
          onAddEntry: openNewLaborEntry,
          onEditEntry: openEditLaborEntry,
          onResetToRobot: resetEntryToRobot,
          resettingId: resettingEntryId,
        }}
        entryForm={{
          open: laborEntryFormOpen,
          editing: editingLaborEntry,
          error,
          fixtureName: laborEntryFixtureName,
          onFixtureNameChange: setLaborEntryFixtureName,
          fixtureTypes,
          aliasNames: laborEntryAliasNames,
          onAliasNamesChange: setLaborEntryAliasNames,
          kind: laborEntryKind,
          onKindChange: setLaborEntryKind,
          unit: laborEntryUnit,
          onUnitChange: setLaborEntryUnit,
          roughIn: laborEntryRoughIn,
          onRoughInChange: setLaborEntryRoughIn,
          topOut: laborEntryTopOut,
          onTopOutChange: setLaborEntryTopOut,
          trimSet: laborEntryTrimSet,
          onTrimSetChange: setLaborEntryTrimSet,
          saving: savingLaborEntry,
          onSubmit: saveLaborEntry,
          onClose: closeLaborEntryForm,
          onDelete: deleteLaborEntry,
        }}
      />
    </div>
  )
}
