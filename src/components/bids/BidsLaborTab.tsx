import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/format'
import { sumEquipmentRows } from '../../lib/bids/bidCostCalc'
import { formatDateYYMMDD } from '../../lib/bids/bidFormatting'
import { bidDetailCloseXStyle, bidDetailCloseFloatMobileStyle } from '../../lib/bids/bidStyles'
import { normalizeMaterialsModel, type MaterialsModel } from '../../lib/bids/bidTakeoffHelpers'
import { laborRowHours, laborRowRough, laborRowTop, laborRowTrim } from '../../lib/bids/laborRowHours'
import { BidWorkflowTabTitleWithPreview } from './BidWorkflowTabTitleWithPreview'
import { BidProjectCell } from './BidProjectCell'
import { MyBidsToggle } from './MyBidsToggle'
import { bidNumberMatchesQuery, type LedgerPrefixMap } from '../../lib/ledgerDisplayPrefixes'
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
  CostEstimateEquipmentRow,
  CostEstimatePermitRow,
  CostEstimateSubcontractorRow,
  CostEstimateWasteRow,
  CostEstimateOtherRow,
  CostEstimatePO,
  LaborBookVersion,
  LaborBookEntry,
  LaborBookEntryWithFixture,
} from '../../lib/bids/bidPricingEngineTypes'

type BidsLaborTabProps = {
  bids: BidWithBuilder[]
  selectedBidForCostEstimate: BidWithBuilder | null
  /** Active bid Version whose takeoff materials the cost-estimate print reflects (null = Base). */
  selectedBidVersionId: string | null
  setSelectedBidForCostEstimate: Dispatch<SetStateAction<BidWithBuilder | null>>
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
  costEstimateDistanceInput: string
  setCostEstimateDistanceInput: Dispatch<SetStateAction<string>>
  // Engine values + setters/loaders
  costEstimate: CostEstimate | null
  costEstimateLaborRows: CostEstimateLaborRow[]
  setCostEstimateLaborRows: Dispatch<SetStateAction<CostEstimateLaborRow[]>>
  costEstimateCountRows: BidCountRow[]
  purchaseOrdersForCostEstimate: CostEstimatePO[]
  costEstimateMaterialTotalRoughIn: number | null
  costEstimateMaterialTotalTopOut: number | null
  costEstimateMaterialTotalTrimSet: number | null
  laborRateInput: string
  setLaborRateInput: Dispatch<SetStateAction<string>>
  drivingCostRate: string
  setDrivingCostRate: Dispatch<SetStateAction<string>>
  hoursPerTrip: string
  setHoursPerTrip: Dispatch<SetStateAction<string>>
  estimatorCostUseFlat: boolean
  setEstimatorCostUseFlat: Dispatch<SetStateAction<boolean>>
  estimatorCostPerCount: string
  setEstimatorCostPerCount: Dispatch<SetStateAction<string>>
  estimatorCostFlatAmount: string
  setEstimatorCostFlatAmount: Dispatch<SetStateAction<string>>
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
  setLaborBookEntries: Dispatch<SetStateAction<LaborBookEntryWithFixture[]>>
  selectedLaborBookVersionId: string | null
  setSelectedLaborBookVersionId: Dispatch<SetStateAction<string | null>>
  laborBookEntriesVersionId: string | null
  setLaborBookEntriesVersionId: Dispatch<SetStateAction<string | null>>
  loadCostEstimateData: (bidId: string, laborBookVersionId: string | null) => Promise<void>
  loadLaborBookVersions: () => Promise<void>
  loadLaborBookEntries: (versionId: string | null) => Promise<void>
  saveBidSelectedLaborBookVersion: (bidId: string, versionId: string | null) => Promise<void>
  openMaterialsModelSwitch: (next: MaterialsModel, sourceTab: 'takeoffs' | 'labor' | 'pricing') => void
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
  selectedBidVersionId,
  bids,
  selectedBidForCostEstimate,
  setSelectedBidForCostEstimate,
  narrowViewport640,
  bidPreview,
  error,
  setError,
  selectedServiceTypeId,
  fixtureTypes,
  getOrCreateFixtureTypeId,
  loadBids,
  costEstimatePOModalTaxPercent,
  costEstimateDistanceInput,
  setCostEstimateDistanceInput,
  costEstimate,
  costEstimateLaborRows,
  setCostEstimateLaborRows,
  costEstimateCountRows,
  purchaseOrdersForCostEstimate,
  costEstimateMaterialTotalRoughIn,
  costEstimateMaterialTotalTopOut,
  costEstimateMaterialTotalTrimSet,
  laborRateInput,
  setLaborRateInput,
  drivingCostRate,
  setDrivingCostRate,
  hoursPerTrip,
  setHoursPerTrip,
  estimatorCostUseFlat,
  setEstimatorCostUseFlat,
  estimatorCostPerCount,
  setEstimatorCostPerCount,
  estimatorCostFlatAmount,
  setEstimatorCostFlatAmount,
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
  setLaborBookEntries,
  selectedLaborBookVersionId,
  setSelectedLaborBookVersionId,
  laborBookEntriesVersionId,
  setLaborBookEntriesVersionId,
  loadCostEstimateData,
  loadLaborBookVersions,
  loadLaborBookEntries,
  saveBidSelectedLaborBookVersion,
  openMaterialsModelSwitch,
  onSelectBid,
  onClose,
  onEditBid,
  ledgerPrefixMap,
  onlyMyBids,
  setOnlyMyBids,
  isMyBid,
}: BidsLaborTabProps) {
  const [costEstimateSearchQuery, setCostEstimateSearchQuery] = useState('')
  const [costEstimateAutosaveStatus, setCostEstimateAutosaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  // Collapsible non-row Direct-Cost sections (collapsed by default; show total on the right).
  const [vehicleTravelCollapsed, setVehicleTravelCollapsed] = useState(true)
  const [lodgingCollapsed, setLodgingCollapsed] = useState(true)
  const [estimatorTimeCollapsed, setEstimatorTimeCollapsed] = useState(true)
  const [laborVersionFormOpen, setLaborVersionFormOpen] = useState(false)
  const [editingLaborVersion, setEditingLaborVersion] = useState<LaborBookVersion | null>(null)
  const [laborVersionNameInput, setLaborVersionNameInput] = useState('')
  const [savingLaborVersion, setSavingLaborVersion] = useState(false)
  const [laborEntryFormOpen, setLaborEntryFormOpen] = useState(false)
  const [editingLaborEntry, setEditingLaborEntry] = useState<LaborBookEntryWithFixture | null>(null)
  const [laborEntryFixtureName, setLaborEntryFixtureName] = useState('')
  const [laborEntryAliasNames, setLaborEntryAliasNames] = useState('')
  const [laborEntryRoughIn, setLaborEntryRoughIn] = useState('')
  const [laborEntryTopOut, setLaborEntryTopOut] = useState('')
  const [laborEntryTrimSet, setLaborEntryTrimSet] = useState('')
  const [savingLaborEntry, setSavingLaborEntry] = useState(false)
  const [applyingLaborBookHours, setApplyingLaborBookHours] = useState(false)
  const [laborBookApplyMessage, setLaborBookApplyMessage] = useState<string | null>(null)
  const [missingLaborBookFixtures, setMissingLaborBookFixtures] = useState<Set<string>>(new Set())
  const [addMissingFixtureModalOpen, setAddMissingFixtureModalOpen] = useState(false)
  const [addMissingFixtureName, setAddMissingFixtureName] = useState('')
  const [addMissingFixtureRoughIn, setAddMissingFixtureRoughIn] = useState('')
  const [addMissingFixtureTopOut, setAddMissingFixtureTopOut] = useState('')
  const [addMissingFixtureTrimSet, setAddMissingFixtureTrimSet] = useState('')
  const [savingMissingFixture, setSavingMissingFixture] = useState(false)
  const [laborBookSectionOpen, setLaborBookSectionOpen] = useState(true)
  const [updatingBidDistance, setUpdatingBidDistance] = useState(false)
  const [bidDistanceUpdateSuccess, setBidDistanceUpdateSuccess] = useState(false)
  const [travelZip, setTravelZip] = useState('')
  const [travelLookupStatus, setTravelLookupStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [travelLookupMessage, setTravelLookupMessage] = useState<string | null>(null)

  // Autosave for Labor tab
  useEffect(() => {
    if (!costEstimate) return

    const timer = setTimeout(async () => {
      setCostEstimateAutosaveStatus('saving')

      const laborRateNum = laborRateInput.trim() === '' ? null : parseFloat(laborRateInput)
      const drivingCostRateNum = drivingCostRate.trim() === '' ? 0.70 : parseFloat(drivingCostRate)
      const hoursPerTripNum = hoursPerTrip.trim() === '' ? 2.0 : parseFloat(hoursPerTrip)

      // Skip autosave if validation fails
      if (laborRateInput.trim() !== '' && (isNaN(laborRateNum!) || laborRateNum! < 0)) return
      if (isNaN(drivingCostRateNum) || drivingCostRateNum < 0) return
      if (isNaN(hoursPerTripNum) || hoursPerTripNum <= 0) return
      const estimatorCostPerCountNum = estimatorCostUseFlat ? null : (parseFloat(estimatorCostPerCount) || 10)
      const estimatorCostFlatAmountNum = estimatorCostUseFlat && estimatorCostFlatAmount.trim() !== '' ? parseFloat(estimatorCostFlatAmount) : null
      if (estimatorCostUseFlat && estimatorCostFlatAmount.trim() !== '' && (isNaN(estimatorCostFlatAmountNum!) || estimatorCostFlatAmountNum! < 0)) return
      if (!estimatorCostUseFlat && (isNaN(estimatorCostPerCountNum!) || estimatorCostPerCountNum! < 0)) return
      const travelPeopleNum = travelPeople.trim() === '' ? 1 : Math.round(parseFloat(travelPeople))
      const travelNightsNum = travelNights.trim() === '' ? 1 : Math.round(parseFloat(travelNights))
      const travelMealsRateNum = travelMealsRate.trim() === '' ? null : parseFloat(travelMealsRate)
      const travelHotelRateNum = travelHotelRate.trim() === '' ? null : parseFloat(travelHotelRate)
      if (isNaN(travelPeopleNum) || travelPeopleNum < 1) return
      if (isNaN(travelNightsNum) || travelNightsNum < 0) return
      if (travelMealsRateNum != null && (isNaN(travelMealsRateNum) || travelMealsRateNum < 0)) return
      if (travelHotelRateNum != null && (isNaN(travelHotelRateNum) || travelHotelRateNum < 0)) return

      // Save cost estimate fields
      await supabase
        .from('cost_estimates')
        .update({
          purchase_order_id_rough_in: costEstimate.purchase_order_id_rough_in || null,
          purchase_order_id_top_out: costEstimate.purchase_order_id_top_out || null,
          purchase_order_id_trim_set: costEstimate.purchase_order_id_trim_set || null,
          labor_rate: laborRateNum,
          driving_cost_rate: drivingCostRateNum,
          hours_per_trip: hoursPerTripNum,
          estimator_cost_per_count: estimatorCostPerCountNum,
          estimator_cost_flat_amount: estimatorCostFlatAmountNum,
          travel_people: travelPeopleNum,
          travel_nights: travelNightsNum,
          travel_meals_rate: travelMealsRateNum,
          travel_hotel_rate: travelHotelRateNum,
        })
        .eq('id', costEstimate.id)

      // Save labor rows
      for (const row of costEstimateLaborRows) {
        await supabase
          .from('cost_estimate_labor_rows')
          .update({
            rough_in_hrs_per_unit: row.rough_in_hrs_per_unit,
            top_out_hrs_per_unit: row.top_out_hrs_per_unit,
            trim_set_hrs_per_unit: row.trim_set_hrs_per_unit,
            count: row.count,
            is_fixed: row.is_fixed ?? false,
          })
          .eq('id', row.id)
      }

      // Save equipment & tool rental rows (note + per-stage amounts)
      for (const row of equipmentRows) {
        await supabase
          .from('cost_estimate_equipment_rows')
          .update({
            note: row.note,
            rough_in: Number(row.rough_in) || 0,
            top_out: Number(row.top_out) || 0,
            trim_set: Number(row.trim_set) || 0,
            sequence_order: row.sequence_order,
          })
          .eq('id', row.id)
      }

      // Save permits, inspections & regulatory fee rows
      for (const row of permitRows) {
        await supabase
          .from('cost_estimate_permit_rows')
          .update({
            note: row.note,
            rough_in: Number(row.rough_in) || 0,
            top_out: Number(row.top_out) || 0,
            trim_set: Number(row.trim_set) || 0,
            sequence_order: row.sequence_order,
          })
          .eq('id', row.id)
      }

      // Save subcontractor fee rows
      for (const row of subcontractorRows) {
        await supabase
          .from('cost_estimate_subcontractor_rows')
          .update({
            note: row.note,
            rough_in: Number(row.rough_in) || 0,
            top_out: Number(row.top_out) || 0,
            trim_set: Number(row.trim_set) || 0,
            sequence_order: row.sequence_order,
          })
          .eq('id', row.id)
      }

      // Save waste disposal & site cleanup rows
      for (const row of wasteRows) {
        await supabase
          .from('cost_estimate_waste_rows')
          .update({
            note: row.note,
            rough_in: Number(row.rough_in) || 0,
            top_out: Number(row.top_out) || 0,
            trim_set: Number(row.trim_set) || 0,
            sequence_order: row.sequence_order,
          })
          .eq('id', row.id)
      }

      // Save "Other" rows
      for (const row of otherRows) {
        await supabase
          .from('cost_estimate_other_rows')
          .update({
            note: row.note,
            rough_in: Number(row.rough_in) || 0,
            top_out: Number(row.top_out) || 0,
            trim_set: Number(row.trim_set) || 0,
            sequence_order: row.sequence_order,
          })
          .eq('id', row.id)
      }

      setCostEstimateAutosaveStatus('saved')
      setTimeout(() => setCostEstimateAutosaveStatus('idle'), 2000)
    }, 1500) // 1.5 second debounce

    return () => clearTimeout(timer)
  }, [costEstimate, laborRateInput, drivingCostRate, hoursPerTrip, estimatorCostUseFlat, estimatorCostPerCount, estimatorCostFlatAmount, travelPeople, travelNights, travelMealsRate, travelHotelRate, equipmentRows, permitRows, subcontractorRows, wasteRows, otherRows, costEstimateLaborRows])

  // Best-effort prefill of the Travel ZIP from the bid's customer address (a 5-digit ZIP).
  // Not persisted; resets when the selected bid changes. The user can always override.
  useEffect(() => {
    const addr = selectedBidForCostEstimate?.customers?.address ?? ''
    const matches = addr.match(/\b\d{5}\b/g)
    setTravelZip(matches && matches.length > 0 ? matches[matches.length - 1]! : '')
    setTravelLookupStatus('idle')
    setTravelLookupMessage(null)
  }, [selectedBidForCostEstimate?.id, selectedBidForCostEstimate?.customers?.address])

  async function handleLaborBookVersionChange(bidId: string, versionId: string) {
    setSelectedLaborBookVersionId(versionId)
    await saveBidSelectedLaborBookVersion(bidId, versionId)
    await loadCostEstimateData(bidId, versionId)
  }

  function openNewLaborVersion() {
    setEditingLaborVersion(null)
    setLaborVersionNameInput('')
    setLaborVersionFormOpen(true)
  }

  function openEditLaborVersion(v: LaborBookVersion) {
    setEditingLaborVersion(v)
    setLaborVersionNameInput(v.name)
    setLaborVersionFormOpen(true)
  }

  function closeLaborVersionForm() {
    setLaborVersionFormOpen(false)
    setEditingLaborVersion(null)
    setLaborVersionNameInput('')
  }

  async function saveLaborVersion(e: React.FormEvent) {
    e.preventDefault()
    const name = laborVersionNameInput.trim()
    if (!name) return
    setSavingLaborVersion(true)
    setError(null)
    if (editingLaborVersion) {
      const { error: err } = await supabase.from('labor_book_versions').update({ name }).eq('id', editingLaborVersion.id)
      if (err) setError(err.message)
      else {
        await loadLaborBookVersions()
        closeLaborVersionForm()
      }
    } else {
      const { error: err } = await supabase.from('labor_book_versions').insert({ name, service_type_id: selectedServiceTypeId })
      if (err) setError(err.message)
      else {
        await loadLaborBookVersions()
        closeLaborVersionForm()
      }
    }
    setSavingLaborVersion(false)
  }

  async function deleteLaborVersion(v: LaborBookVersion) {
    if (!confirm(`Delete labor book "${v.name}"? This will delete all entries in this version.`)) return
    const { error: err } = await supabase.from('labor_book_versions').delete().eq('id', v.id)
    if (err) setError(err.message)
    else {
      await loadLaborBookVersions()
      if (laborBookEntriesVersionId === v.id) {
        setLaborBookEntriesVersionId(null)
        setLaborBookEntries([])
      }
      if (selectedLaborBookVersionId === v.id) {
        setSelectedLaborBookVersionId(null)
        if (selectedBidForCostEstimate?.selected_labor_book_version_id === v.id) {
          saveBidSelectedLaborBookVersion(selectedBidForCostEstimate!.id, null)
          await loadBids()
        }
      }
    }
  }

  function openNewLaborEntry() {
    setEditingLaborEntry(null)
    setLaborEntryFixtureName('')
    setLaborEntryAliasNames('')
    setLaborEntryRoughIn('')
    setLaborEntryTopOut('')
    setLaborEntryTrimSet('')
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
    setError(null)
  }

  async function saveLaborEntry(e: React.FormEvent) {
    e.preventDefault()
    if (!laborBookEntriesVersionId) {
      setError('No labor book version selected')
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
        .update({ fixture_type_id: fixtureTypeId, alias_names: aliasNames, rough_in_hrs: rough, top_out_hrs: top, trim_set_hrs: trim })
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
        .insert({ version_id: laborBookEntriesVersionId, fixture_type_id: fixtureTypeId, alias_names: aliasNames, rough_in_hrs: rough, top_out_hrs: top, trim_set_hrs: trim, sequence_order: maxSeq + 1 })
      if (err) setError(err.message)
      else {
        await loadLaborBookEntries(laborBookEntriesVersionId)
        closeLaborEntryForm()
      }
    }
    setSavingLaborEntry(false)
  }

  async function deleteLaborEntry(entry: LaborBookEntryWithFixture) {
    if (!confirm(`Delete "${entry.fixture_types?.name ?? ''}" from this labor book?`)) return
    const { error: err } = await supabase.from('labor_book_entries').delete().eq('id', entry.id)
    if (err) setError(err.message)
    else if (laborBookEntriesVersionId) await loadLaborBookEntries(laborBookEntriesVersionId)
  }

  async function saveLaborRows() {
    for (const row of costEstimateLaborRows) {
      await supabase
        .from('cost_estimate_labor_rows')
        .update({
          rough_in_hrs_per_unit: row.rough_in_hrs_per_unit,
          top_out_hrs_per_unit: row.top_out_hrs_per_unit,
          trim_set_hrs_per_unit: row.trim_set_hrs_per_unit,
          count: row.count,
          is_fixed: row.is_fixed ?? false,
        })
        .eq('id', row.id)
    }
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
    const { error: err } = await supabase
      .from('bids')
      .update({ distance_from_office: val || null })
      .eq('id', selectedBidForCostEstimate.id)
    if (err) {
      setError(err.message)
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

  async function applyLaborBookHoursToEstimate() {
    if (!costEstimate?.id || !selectedLaborBookVersionId || costEstimateLaborRows.length === 0) return
    setLaborBookApplyMessage(null)
    setApplyingLaborBookHours(true)
    setError(null)
    try {
      // Auto-save current labor rows to database before applying labor book
      // This ensures non-matching fixtures preserve their current values
      await saveLaborRows()

      const { data: entries, error: fetchErr } = await supabase
        .from('labor_book_entries')
        .select('fixture_type_id, alias_names, rough_in_hrs, top_out_hrs, trim_set_hrs, fixture_types(name)')
        .eq('version_id', selectedLaborBookVersionId)
        .order('sequence_order', { ascending: true })
      if (fetchErr) {
        setError(`Failed to load labor book entries: ${fetchErr.message}`)
        setApplyingLaborBookHours(false)
        return
      }
      const entriesByFixtureName = new Map<string, { rough_in_hrs: number; top_out_hrs: number; trim_set_hrs: number }>()
      type LaborEntryWithFixture = LaborBookEntry & { fixture_types?: { name: string } | null }
      for (const e of (entries as LaborEntryWithFixture[]) ?? []) {
        const hours = { rough_in_hrs: Number(e.rough_in_hrs), top_out_hrs: Number(e.top_out_hrs), trim_set_hrs: Number(e.trim_set_hrs) }
        const name = e.fixture_types?.name ?? ''
        if (name) entriesByFixtureName.set(name.toLowerCase(), hours)
      }
      const missingFixtures = new Set<string>()
      for (const row of costEstimateLaborRows) {
        const entry = entriesByFixtureName.get((row.fixture ?? '').toLowerCase())
        if (!entry) {
          missingFixtures.add(row.fixture ?? '')
        }
      }
      for (const row of costEstimateLaborRows) {
        const entry = entriesByFixtureName.get((row.fixture ?? '').toLowerCase())
        if (!entry) continue
        const { error: updateErr } = await supabase
          .from('cost_estimate_labor_rows')
          .update({
            rough_in_hrs_per_unit: entry.rough_in_hrs,
            top_out_hrs_per_unit: entry.top_out_hrs,
            trim_set_hrs_per_unit: entry.trim_set_hrs,
          })
          .eq('id', row.id)
        if (updateErr) {
          setError(`Failed to update labor row: ${updateErr.message}`)
          setApplyingLaborBookHours(false)
          return
        }
      }
      const { data: refetched, error: refetchErr } = await supabase
        .from('cost_estimate_labor_rows')
        .select('*')
        .eq('cost_estimate_id', costEstimate.id)
        .order('sequence_order', { ascending: true })
      if (refetchErr) {
        setError(`Failed to refresh labor rows: ${refetchErr.message}`)
      } else {
        setCostEstimateLaborRows((refetched as CostEstimateLaborRow[]) ?? [])
        setLaborBookApplyMessage('Labor book hours applied.')
        setTimeout(() => setLaborBookApplyMessage(null), 3000)
        setMissingLaborBookFixtures(missingFixtures)
      }
    } finally {
      setApplyingLaborBookHours(false)
    }
  }

  function openAddMissingFixtureModal(fixtureName: string) {
    setAddMissingFixtureName(fixtureName)
    setAddMissingFixtureRoughIn('')
    setAddMissingFixtureTopOut('')
    setAddMissingFixtureTrimSet('')
    setAddMissingFixtureModalOpen(true)
  }

  async function saveMissingFixtureToLaborBook(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedLaborBookVersionId || !addMissingFixtureName.trim()) return

    setSavingMissingFixture(true)
    setError(null)

    const addResult = await getOrCreateFixtureTypeId(addMissingFixtureName.trim())
    if (!addResult.id) {
      setError(('error' in addResult ? addResult.error : null) ?? `Failed to create or find fixture type "${addMissingFixtureName.trim()}"`)
      setSavingMissingFixture(false)
      return
    }
    const fixtureTypeId = addResult.id

    const rough = parseFloat(addMissingFixtureRoughIn) || 0
    const top = parseFloat(addMissingFixtureTopOut) || 0
    const trim = parseFloat(addMissingFixtureTrimSet) || 0

    // Get max sequence order for the version
    const { data: entries } = await supabase
      .from('labor_book_entries')
      .select('sequence_order')
      .eq('version_id', selectedLaborBookVersionId)
      .order('sequence_order', { ascending: false })
      .limit(1)

    const maxSeq = entries?.[0]?.sequence_order ?? 0

    const { error: insertErr } = await supabase
      .from('labor_book_entries')
      .insert({
        version_id: selectedLaborBookVersionId,
        fixture_type_id: fixtureTypeId,
        alias_names: [],
        rough_in_hrs: rough,
        top_out_hrs: top,
        trim_set_hrs: trim,
        sequence_order: maxSeq + 1
      })

    if (insertErr) {
      setError(`Failed to add fixture: ${insertErr.message}`)
    } else {
      // Remove from missing set
      setMissingLaborBookFixtures(prev => {
        const next = new Set(prev)
        next.delete(addMissingFixtureName)
        return next
      })
      setAddMissingFixtureModalOpen(false)
      // Reload labor book entries so the new entry appears instantly
      await loadLaborBookEntries(selectedLaborBookVersionId)
      // Re-apply labor hours to update the cost estimate row
      await applyLaborBookHoursToEstimate()
    }

    setSavingMissingFixture(false)
  }

  function setCostEstimateLaborRow(rowId: string, updates: Partial<Pick<CostEstimateLaborRow, 'rough_in_hrs_per_unit' | 'top_out_hrs_per_unit' | 'trim_set_hrs_per_unit' | 'is_fixed'>>) {
    setCostEstimateLaborRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, ...updates } : r))
    )
  }

  // Equipment & Tool Rental rows: field edits update state (persisted by the debounced
  // save effect); add/remove hit the DB immediately.
  function updateEquipmentRow(rowId: string, updates: Partial<Pick<CostEstimateEquipmentRow, 'note' | 'rough_in' | 'top_out' | 'trim_set'>>) {
    setEquipmentRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...updates } : r)))
  }

  async function addEquipmentRow() {
    if (!costEstimate?.id) return
    const maxOrder = equipmentRows.reduce((m, r) => Math.max(m, r.sequence_order), 0)
    const { data, error: insErr } = await supabase
      .from('cost_estimate_equipment_rows')
      .insert({ cost_estimate_id: costEstimate.id, note: '', rough_in: 0, top_out: 0, trim_set: 0, sequence_order: maxOrder + 1 })
      .select('*')
      .single()
    if (insErr) {
      setError(`Failed to add equipment row: ${insErr.message}`)
      return
    }
    setEquipmentRows((prev) => [...prev, data as CostEstimateEquipmentRow])
  }

  async function removeEquipmentRow(rowId: string) {
    setEquipmentRows((prev) => prev.filter((r) => r.id !== rowId))
    const { error: delErr } = await supabase.from('cost_estimate_equipment_rows').delete().eq('id', rowId)
    if (delErr) setError(`Failed to remove equipment row: ${delErr.message}`)
  }

  // Permits, Inspections & Regulatory Fees rows: same edit/add/remove model as equipment.
  function updatePermitRow(rowId: string, updates: Partial<Pick<CostEstimatePermitRow, 'note' | 'rough_in' | 'top_out' | 'trim_set'>>) {
    setPermitRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...updates } : r)))
  }

  async function addPermitRow() {
    if (!costEstimate?.id) return
    const maxOrder = permitRows.reduce((m, r) => Math.max(m, r.sequence_order), 0)
    const { data, error: insErr } = await supabase
      .from('cost_estimate_permit_rows')
      .insert({ cost_estimate_id: costEstimate.id, note: '', rough_in: 0, top_out: 0, trim_set: 0, sequence_order: maxOrder + 1 })
      .select('*')
      .single()
    if (insErr) {
      setError(`Failed to add permit row: ${insErr.message}`)
      return
    }
    setPermitRows((prev) => [...prev, data as CostEstimatePermitRow])
  }

  async function removePermitRow(rowId: string) {
    setPermitRows((prev) => prev.filter((r) => r.id !== rowId))
    const { error: delErr } = await supabase.from('cost_estimate_permit_rows').delete().eq('id', rowId)
    if (delErr) setError(`Failed to remove permit row: ${delErr.message}`)
  }

  // Subcontractor Fees rows: same edit/add/remove model as equipment.
  function updateSubcontractorRow(rowId: string, updates: Partial<Pick<CostEstimateSubcontractorRow, 'note' | 'rough_in' | 'top_out' | 'trim_set'>>) {
    setSubcontractorRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...updates } : r)))
  }

  async function addSubcontractorRow() {
    if (!costEstimate?.id) return
    const maxOrder = subcontractorRows.reduce((m, r) => Math.max(m, r.sequence_order), 0)
    const { data, error: insErr } = await supabase
      .from('cost_estimate_subcontractor_rows')
      .insert({ cost_estimate_id: costEstimate.id, note: '', rough_in: 0, top_out: 0, trim_set: 0, sequence_order: maxOrder + 1 })
      .select('*')
      .single()
    if (insErr) {
      setError(`Failed to add subcontractor row: ${insErr.message}`)
      return
    }
    setSubcontractorRows((prev) => [...prev, data as CostEstimateSubcontractorRow])
  }

  async function removeSubcontractorRow(rowId: string) {
    setSubcontractorRows((prev) => prev.filter((r) => r.id !== rowId))
    const { error: delErr } = await supabase.from('cost_estimate_subcontractor_rows').delete().eq('id', rowId)
    if (delErr) setError(`Failed to remove subcontractor row: ${delErr.message}`)
  }

  // Waste Disposal & Site Cleanup rows: same edit/add/remove model as equipment.
  function updateWasteRow(rowId: string, updates: Partial<Pick<CostEstimateWasteRow, 'note' | 'rough_in' | 'top_out' | 'trim_set'>>) {
    setWasteRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...updates } : r)))
  }

  async function addWasteRow() {
    if (!costEstimate?.id) return
    const maxOrder = wasteRows.reduce((m, r) => Math.max(m, r.sequence_order), 0)
    const { data, error: insErr } = await supabase
      .from('cost_estimate_waste_rows')
      .insert({ cost_estimate_id: costEstimate.id, note: '', rough_in: 0, top_out: 0, trim_set: 0, sequence_order: maxOrder + 1 })
      .select('*')
      .single()
    if (insErr) {
      setError(`Failed to add waste row: ${insErr.message}`)
      return
    }
    setWasteRows((prev) => [...prev, data as CostEstimateWasteRow])
  }

  async function removeWasteRow(rowId: string) {
    setWasteRows((prev) => prev.filter((r) => r.id !== rowId))
    const { error: delErr } = await supabase.from('cost_estimate_waste_rows').delete().eq('id', rowId)
    if (delErr) setError(`Failed to remove waste row: ${delErr.message}`)
  }

  // "Other" rows: same edit/add/remove model as equipment.
  function updateOtherRow(rowId: string, updates: Partial<Pick<CostEstimateOtherRow, 'note' | 'rough_in' | 'top_out' | 'trim_set'>>) {
    setOtherRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...updates } : r)))
  }

  async function addOtherRow() {
    if (!costEstimate?.id) return
    const maxOrder = otherRows.reduce((m, r) => Math.max(m, r.sequence_order), 0)
    const { data, error: insErr } = await supabase
      .from('cost_estimate_other_rows')
      .insert({ cost_estimate_id: costEstimate.id, note: '', rough_in: 0, top_out: 0, trim_set: 0, sequence_order: maxOrder + 1 })
      .select('*')
      .single()
    if (insErr) {
      setError(`Failed to add row: ${insErr.message}`)
      return
    }
    setOtherRows((prev) => [...prev, data as CostEstimateOtherRow])
  }

  async function removeOtherRow(rowId: string) {
    setOtherRows((prev) => prev.filter((r) => r.id !== rowId))
    const { error: delErr } = await supabase.from('cost_estimate_other_rows').delete().eq('id', rowId)
    if (delErr) setError(`Failed to remove row: ${delErr.message}`)
  }

  function buildCostEstimatePrintContext(): CostEstimatePrintContext | null {
    if (!selectedBidForCostEstimate) return null
    return {
      bid: selectedBidForCostEstimate,
      bidVersionId: selectedBidVersionId,
      costEstimate,
      laborRows: costEstimateLaborRows,
      countRows: costEstimateCountRows,
      purchaseOrders: purchaseOrdersForCostEstimate,
      materialTotalRoughIn: costEstimateMaterialTotalRoughIn,
      materialTotalTopOut: costEstimateMaterialTotalTopOut,
      materialTotalTrimSet: costEstimateMaterialTotalTrimSet,
      laborRateInput,
      drivingCostRate,
      hoursPerTrip,
      taxPercent: parseFloat(costEstimatePOModalTaxPercent || '8.25') || 0,
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
  const filteredBidsForCostEstimate: BidWithBuilder[] = costEstimateSearchQuery.trim()
    ? bidsScopedForCostEstimate.filter(
        (b) =>
          (b.project_name?.toLowerCase().includes(costEstimateSearchQuery.toLowerCase()) ?? false) ||
          (b.address?.toLowerCase().includes(costEstimateSearchQuery.toLowerCase()) ?? false) ||
          (b.customers?.name?.toLowerCase().includes(costEstimateSearchQuery.toLowerCase()) ?? false) ||
          (b.bids_gc_builders?.name?.toLowerCase().includes(costEstimateSearchQuery.toLowerCase()) ?? false) ||
          bidNumberMatchesQuery(b, costEstimateSearchQuery, ledgerPrefixMap)
      )
    : bidsScopedForCostEstimate
  const costEstimateBidList: BidWithBuilder[] = Array.from(filteredBidsForCostEstimate, (row) => row as BidWithBuilder)

  return (
    <div>
      {!selectedBidForCostEstimate && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
          <input
            type="text"
            placeholder="Search bids (bid #, project name, or GC/Builder)..."
            value={costEstimateSearchQuery}
            onChange={(e) => setCostEstimateSearchQuery(e.target.value)}
            style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }}
          />
          <MyBidsToggle active={onlyMyBids} onChange={setOnlyMyBids} />
        </div>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', minWidth: 0 }}>
              <BidWorkflowTabTitleWithPreview
                bid={selectedBidForCostEstimate}
                previewEnabled={bidPreview != null}
                onOpenPreview={() => bidPreview?.openBidPreviewFromBid(selectedBidForCostEstimate)}
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
          {(() => {
            const ceMaterialsModel = normalizeMaterialsModel(selectedBidForCostEstimate.materials_model)
            return (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: '0.25rem',
                  flexWrap: 'wrap',
                  marginBottom: '0.75rem',
                }}
              >
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
                  onClick={() => openMaterialsModelSwitch('exact', 'labor')}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.8125rem',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 4,
                    background: ceMaterialsModel === 'exact' ? 'var(--bg-200)' : 'var(--surface)',
                    cursor: 'pointer',
                    fontWeight: ceMaterialsModel === 'exact' ? 600 : 400,
                    color: ceMaterialsModel === 'exact' ? 'var(--text-strong)' : 'var(--text-muted)',
                    boxShadow: ceMaterialsModel === 'exact' ? '0 0 0 2px #374151' : 'none',
                  }}
                >
                  By Stage
                </button>
                <button
                  type="button"
                  onClick={() => openMaterialsModelSwitch('rough', 'labor')}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.8125rem',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 4,
                    background: ceMaterialsModel === 'rough' ? 'var(--bg-200)' : 'var(--surface)',
                    cursor: 'pointer',
                    fontWeight: ceMaterialsModel === 'rough' ? 600 : 400,
                    color: ceMaterialsModel === 'rough' ? 'var(--text-strong)' : 'var(--text-muted)',
                    boxShadow: ceMaterialsModel === 'rough' ? '0 0 0 2px #374151' : 'none',
                  }}
                >
                  Combined
                </button>
              </div>
            )
          })()}
          {costEstimateCountRows.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Add fixtures in the Counts tab first.</p>
          ) : (
            <>
              {/* Manhours section */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', textAlign: 'center' }}>HOURS</h3>
                <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <label style={{ fontSize: '0.875rem', marginRight: '0.5rem' }}>Labor book version</label>
                    <select
                      value={selectedLaborBookVersionId ?? ''}
                      onChange={(e) => {
                        const v = e.target.value
                        if (selectedBidForCostEstimate) {
                          if (v) handleLaborBookVersionChange(selectedBidForCostEstimate.id, v)
                          else {
                            saveBidSelectedLaborBookVersion(selectedBidForCostEstimate.id, null)
                            setSelectedLaborBookVersionId(null)
                            loadCostEstimateData(selectedBidForCostEstimate.id, null)
                          }
                        }
                      }}
                      style={{ padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, minWidth: '12rem' }}
                    >
                      <option value="">— Use defaults —</option>
                      {laborBookVersions.map((v) => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  </div>
                  {costEstimateLaborRows.length > 0 && selectedLaborBookVersionId && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => applyLaborBookHoursToEstimate()}
                        disabled={applyingLaborBookHours}
                        style={{
                          padding: '0.35rem 0.75rem',
                          background: applyingLaborBookHours ? '#9ca3af' : '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: 4,
                          cursor: applyingLaborBookHours ? 'wait' : 'pointer',
                          fontSize: '0.875rem',
                        }}
                      >
                        {applyingLaborBookHours ? 'Applying…' : 'Apply matching Labor Hours'}
                      </button>
                      {laborBookApplyMessage && (
                        <span style={{ color: 'var(--text-green-600)', fontSize: '0.875rem' }}>{laborBookApplyMessage}</span>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'var(--bg-subtle)' }}>
                      <tr>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Fixture or Tie-in</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>Count</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>(hrs/unit)</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>Rough In</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>Top Out</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>Trim Set</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>Total hrs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {costEstimateLaborRows.map((row) => {
                        const totalHrs = laborRowHours(row)
                        return (
                          <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span>{row.fixture ?? ''}</span>
                              {missingLaborBookFixtures.has(row.fixture ?? '') && selectedLaborBookVersionId && (
                                <button
                                  type="button"
                                  onClick={() => openAddMissingFixtureModal(row.fixture ?? '')}
                                  title="Add to labor book"
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: 0,
                                    display: 'flex',
                                    alignItems: 'center'
                                  }}
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 640 640"
                                    style={{ width: '1rem', height: '1rem', fill: '#3b82f6' }}
                                  >
                                    <path d="M192 576L512 576C529.7 576 544 561.7 544 544C544 526.3 529.7 512 512 512L512 445.3C530.6 438.7 544 420.9 544 400L544 112C544 85.5 522.5 64 496 64L192 64C139 64 96 107 96 160L96 480C96 533 139 576 192 576zM160 480C160 462.3 174.3 448 192 448L448 448L448 512L192 512C174.3 512 160 497.7 160 480zM288 184C288 175.2 295.2 168 304 168L336 168C344.8 168 352 175.2 352 184L352 224L392 224C400.8 224 408 231.2 408 240L408 272C408 280.8 400.8 288 392 288L352 288L352 328C352 336.8 344.8 344 336 344L304 344C295.2 344 288 336.8 288 328L288 288L248 288C239.2 288 232 280.8 232 272L232 240C232 231.2 239.2 224 248 224L288 224L288 184z"/>
                                  </svg>
                                </button>
                              )}
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>{Number(row.count)}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.1rem', fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                <input
                                  type="checkbox"
                                  checked={!!row.is_fixed}
                                  onChange={(e) => setCostEstimateLaborRow(row.id, { is_fixed: e.target.checked })}
                                  style={{ width: '0.875rem', height: '0.875rem', margin: 0 }}
                                />
                                <span style={{ color: 'var(--text-muted)' }}>fixed</span>
                              </label>
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                              <input
                                type="number"
                                min={0}
                                step={0.25}
                                value={row.rough_in_hrs_per_unit}
                                onChange={(e) => setCostEstimateLaborRow(row.id, { rough_in_hrs_per_unit: parseFloat(e.target.value) || 0 })}
                                onWheel={(e) => e.currentTarget.blur()}
                                style={{ width: '5rem', padding: '0.25rem', border: '1px solid var(--border-strong)', borderRadius: 4, textAlign: 'center' }}
                              />
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                              <input
                                type="number"
                                min={0}
                                step={0.25}
                                value={row.top_out_hrs_per_unit}
                                onChange={(e) => setCostEstimateLaborRow(row.id, { top_out_hrs_per_unit: parseFloat(e.target.value) || 0 })}
                                onWheel={(e) => e.currentTarget.blur()}
                                style={{ width: '5rem', padding: '0.25rem', border: '1px solid var(--border-strong)', borderRadius: 4, textAlign: 'center' }}
                              />
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                              <input
                                type="number"
                                min={0}
                                step={0.25}
                                value={row.trim_set_hrs_per_unit}
                                onChange={(e) => setCostEstimateLaborRow(row.id, { trim_set_hrs_per_unit: parseFloat(e.target.value) || 0 })}
                                onWheel={(e) => e.currentTarget.blur()}
                                style={{ width: '5rem', padding: '0.25rem', border: '1px solid var(--border-strong)', borderRadius: 4, textAlign: 'center' }}
                              />
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 500 }}>{totalHrs.toFixed(2)}</td>
                          </tr>
                        )
                      })}
                      {costEstimateLaborRows.length > 0 && (() => {
                        const totalRough = costEstimateLaborRows.reduce((s, r) => s + laborRowRough(r), 0)
                        const totalTop = costEstimateLaborRows.reduce((s, r) => s + laborRowTop(r), 0)
                        const totalTrim = costEstimateLaborRows.reduce((s, r) => s + laborRowTrim(r), 0)
                        const totalHours = totalRough + totalTop + totalTrim
                        return (
                          <tr style={{ background: 'var(--bg-subtle)', fontWeight: 600 }}>
                            <td style={{ padding: '0.75rem' }}>Totals</td>
                            <td style={{ padding: '0.75rem', textAlign: 'center' }} />
                            <td style={{ padding: '0.75rem', textAlign: 'center' }} />
                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>{totalRough.toFixed(2)} hrs</td>
                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>{totalTop.toFixed(2)} hrs</td>
                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>{totalTrim.toFixed(2)} hrs</td>
                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>{totalHours.toFixed(2)} hrs</td>
                          </tr>
                        )
                      })()}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <label style={{ marginRight: '0.5rem', fontWeight: 500 }}>Labor rate ($/hr)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={laborRateInput}
                      onChange={(e) => setLaborRateInput(e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      style={{ width: '8rem', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
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
                  const totalHours = costEstimateLaborRows.reduce(
                    (s, r) => s + laborRowHours(r),
                    0
                  )
                  const rate = laborRateInput.trim() === '' ? 0 : parseFloat(laborRateInput) || 0
                  const laborCost = totalHours * rate
                  return (
                    <p style={{ margin: '0.75rem 0 0', fontWeight: 600, textAlign: 'right' }}>
                      Labor total: ${formatCurrency(laborCost)}
                      <br />
                      <span style={{ fontWeight: 400, fontSize: '0.875rem' }}>({totalHours.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} hrs × ${formatCurrency(rate)}/hr)</span>
                    </p>
                  )
                })()}
                {/* Driving Cost Section */}
                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-amber-100)', borderRadius: 4, border: '1px solid #fde68a' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: vehicleTravelCollapsed ? 0 : '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <button type="button" onClick={() => setVehicleTravelCollapsed((c) => !c)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
                      <span aria-hidden style={{ fontSize: '0.7rem' }}>{vehicleTravelCollapsed ? '▶' : '▼'}</span>
                      Vehicle Travel
                    </button>
                    {vehicleTravelCollapsed && (() => {
                      const distance = parseFloat(selectedBidForCostEstimate?.distance_from_office ?? '0') || 0
                      const totalHours = costEstimateLaborRows.reduce((s, r) => s + laborRowHours(r), 0)
                      const ratePerMile = parseFloat(drivingCostRate) || 0.70
                      const numTrips = totalHours / (parseFloat(hoursPerTrip) || 2.0)
                      const drivingCost = numTrips * ratePerMile * distance
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
                        onChange={(e) => setDrivingCostRate(e.target.value)}
                        onWheel={(e) => e.currentTarget.blur()}
                        style={{ width: '6rem', padding: '0.375rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>Hours per trip</label>
                      <input
                        type="number"
                        min={0.1}
                        step={0.1}
                        value={hoursPerTrip}
                        onChange={(e) => setHoursPerTrip(e.target.value)}
                        onWheel={(e) => e.currentTarget.blur()}
                        style={{ width: '6rem', padding: '0.375rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
                      />
                    </div>
                  </div>
                  {(() => {
                    const distance = parseFloat(selectedBidForCostEstimate?.distance_from_office ?? '0') || 0
                    const totalHours = costEstimateLaborRows.reduce(
                      (s, r) => s + laborRowHours(r),
                      0
                    )
                    const ratePerMile = parseFloat(drivingCostRate) || 0.70
                    const hrsPerTrip = parseFloat(hoursPerTrip) || 2.0
                    const numTrips = totalHours / hrsPerTrip
                    const drivingCost = numTrips * ratePerMile * distance

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
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-amber-100)', borderRadius: 4, border: '1px solid #fde68a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: lodgingCollapsed ? 0 : '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <button type="button" onClick={() => setLodgingCollapsed((c) => !c)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
                    <span aria-hidden style={{ fontSize: '0.7rem' }}>{lodgingCollapsed ? '▶' : '▼'}</span>
                    Lodging and Meals
                  </button>
                  {lodgingCollapsed && (() => {
                    const people = Math.max(0, Math.round(parseFloat(travelPeople) || 0))
                    const nights = Math.max(0, Math.round(parseFloat(travelNights) || 0))
                    const mealsRate = parseFloat(travelMealsRate) || 0
                    const hotelRate = parseFloat(travelHotelRate) || 0
                    const travelCost = people * nights * (mealsRate + hotelRate)
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
                      onChange={(e) => setTravelPeople(e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      style={{ width: '5rem', padding: '0.375rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Nights</label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={travelNights}
                      onChange={(e) => setTravelNights(e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      style={{ width: '5rem', padding: '0.375rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Meals/day ($)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={travelMealsRate}
                      onChange={(e) => setTravelMealsRate(e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      placeholder="—"
                      style={{ width: '6rem', padding: '0.375rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Hotel/night ($)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={travelHotelRate}
                      onChange={(e) => setTravelHotelRate(e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      placeholder="—"
                      style={{ width: '6rem', padding: '0.375rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
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
                  const people = Math.max(0, Math.round(parseFloat(travelPeople) || 0))
                  const nights = Math.max(0, Math.round(parseFloat(travelNights) || 0))
                  const mealsRate = parseFloat(travelMealsRate) || 0
                  const hotelRate = parseFloat(travelHotelRate) || 0
                  const mealsCost = people * nights * mealsRate
                  const hotelCost = people * nights * hotelRate
                  const travelCost = mealsCost + hotelCost
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
              {/* Estimators Time */}
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-amber-100)', borderRadius: 4, border: '1px solid #fde68a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: estimatorTimeCollapsed ? 0 : '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <button type="button" onClick={() => setEstimatorTimeCollapsed((c) => !c)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
                    <span aria-hidden style={{ fontSize: '0.7rem' }}>{estimatorTimeCollapsed ? '▶' : '▼'}</span>
                    Estimators Time
                  </button>
                  {estimatorTimeCollapsed && (() => {
                    const countRows = costEstimateCountRows.length
                    const estimatorCost = estimatorCostUseFlat
                      ? (estimatorCostFlatAmount.trim() !== '' ? parseFloat(estimatorCostFlatAmount) || 0 : 0)
                      : countRows * (parseFloat(estimatorCostPerCount) || 10)
                    return (
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-700)' }}>
                        Estimator cost: {estimatorCostUseFlat ? '' : `${countRows} Count Types × $${(parseFloat(estimatorCostPerCount) || 10).toFixed(2)} = `}<span style={{ fontWeight: 700 }}>${formatCurrency(estimatorCost)}</span>
                      </span>
                    )
                  })()}
                </div>
                {!estimatorTimeCollapsed && (
                <>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                    <input
                      type="checkbox"
                      checked={estimatorCostUseFlat}
                      onChange={(e) => setEstimatorCostUseFlat(e.target.checked)}
                    />
                    Use flat amount
                  </label>
                  <span style={{ color: 'var(--text-faint)', fontSize: '0.875rem' }}>|</span>
                  {estimatorCostUseFlat ? (
                    <div>
                      <label style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>Flat amount ($)</label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={estimatorCostFlatAmount}
                        onChange={(e) => setEstimatorCostFlatAmount(e.target.value)}
                        onWheel={(e) => e.currentTarget.blur()}
                        style={{ width: '6rem', padding: '0.375rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
                      />
                    </div>
                  ) : (
                    <div>
                      <label style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>Per count row ($)</label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={estimatorCostPerCount}
                        onChange={(e) => setEstimatorCostPerCount(e.target.value)}
                        onWheel={(e) => e.currentTarget.blur()}
                        style={{ width: '6rem', padding: '0.375rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
                      />
                    </div>
                  )}
                </div>
                {(() => {
                  const countRows = costEstimateCountRows.length
                  const estimatorCost = estimatorCostUseFlat
                    ? (estimatorCostFlatAmount.trim() !== '' ? parseFloat(estimatorCostFlatAmount) || 0 : 0)
                    : countRows * (parseFloat(estimatorCostPerCount) || 10)
                  return (
                    <p style={{ margin: 0, fontWeight: 400, fontSize: '0.875rem', textAlign: 'right' }}>
                      Estimator cost: {estimatorCostUseFlat ? '' : `${countRows} Count Types × $${(parseFloat(estimatorCostPerCount) || 10).toFixed(2)} = `}<span style={{ fontWeight: 700 }}>${formatCurrency(estimatorCost)}</span>
                    </p>
                  )
                })()}
                </>
                )}
              </div>
                <h3 id="labor-direct-costs" style={{ margin: '1.5rem 0 0.75rem', fontSize: '1rem', textAlign: 'center', scrollMarginTop: '1rem' }}>DIRECT COSTS</h3>
                {/* Equipment and Tool Rental Section */}
                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-amber-100)', borderRadius: 4, border: '1px solid #fde68a' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: equipmentRows.length > 0 ? '0.5rem' : 0, flexWrap: 'wrap', gap: '0.5rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600 }}>Equipment and Tool Rental</h4>
                    <button
                      type="button"
                      onClick={() => void addEquipmentRow()}
                      disabled={!costEstimate?.id}
                      style={{ padding: '0.25rem 0.6rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: costEstimate?.id ? 'pointer' : 'not-allowed', fontSize: '0.75rem', fontWeight: 500 }}
                    >
                      + Add row
                    </button>
                  </div>
                  {equipmentRows.length === 0 ? null : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '0.25rem 0.5rem', fontWeight: 500 }}>Note</th>
                          <th style={{ padding: '0.25rem 0.5rem', fontWeight: 500, width: '6.5rem' }}>Rough In ($)</th>
                          <th style={{ padding: '0.25rem 0.5rem', fontWeight: 500, width: '6.5rem' }}>Top Out ($)</th>
                          <th style={{ padding: '0.25rem 0.5rem', fontWeight: 500, width: '6.5rem' }}>Trim Set ($)</th>
                          <th style={{ width: '2rem' }} />
                        </tr>
                      </thead>
                      <tbody>
                        {equipmentRows.map((row) => (
                          <tr key={row.id}>
                            <td style={{ padding: '0.2rem 0.5rem' }}>
                              <input
                                type="text"
                                value={row.note ?? ''}
                                onChange={(e) => updateEquipmentRow(row.id, { note: e.target.value })}
                                placeholder="Description"
                                style={{ width: '100%', padding: '0.375rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
                              />
                            </td>
                            {(['rough_in', 'top_out', 'trim_set'] as const).map((stage) => (
                              <td key={stage} style={{ padding: '0.2rem 0.5rem' }}>
                                <input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  value={row[stage] === 0 ? '' : String(row[stage])}
                                  onChange={(e) => updateEquipmentRow(row.id, { [stage]: e.target.value === '' ? 0 : parseFloat(e.target.value) } as Partial<Pick<CostEstimateEquipmentRow, 'rough_in' | 'top_out' | 'trim_set'>>)}
                                  onWheel={(e) => e.currentTarget.blur()}
                                  placeholder="0.00"
                                  style={{ width: '100%', padding: '0.375rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', textAlign: 'right' }}
                                />
                              </td>
                            ))}
                            <td style={{ padding: '0.2rem 0.25rem', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => void removeEquipmentRow(row.id)}
                                title="Remove row"
                                aria-label="Remove equipment row"
                                style={{ background: 'none', border: 'none', color: 'var(--text-red-700)', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {equipmentRows.length > 0 && (
                  <p style={{ margin: '0.5rem 0 0', textAlign: 'right', fontWeight: 600, fontSize: '0.875rem' }}>
                    Equipment &amp; tool rental total: ${formatCurrency(sumEquipmentRows(equipmentRows))}
                  </p>
                  )}
                </div>
                {/* Permits, Inspections & Regulatory Fees Section */}
                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-amber-100)', borderRadius: 4, border: '1px solid #fde68a' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: permitRows.length > 0 ? '0.5rem' : 0, flexWrap: 'wrap', gap: '0.5rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600 }}>Permits, Inspections, and Regulatory Fees</h4>
                    <button
                      type="button"
                      onClick={() => void addPermitRow()}
                      disabled={!costEstimate?.id}
                      style={{ padding: '0.25rem 0.6rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: costEstimate?.id ? 'pointer' : 'not-allowed', fontSize: '0.75rem', fontWeight: 500 }}
                    >
                      + Add row
                    </button>
                  </div>
                  {permitRows.length === 0 ? null : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '0.25rem 0.5rem', fontWeight: 500 }}>Description</th>
                          <th style={{ padding: '0.25rem 0.5rem', fontWeight: 500, width: '6.5rem' }}>Rough In ($)</th>
                          <th style={{ padding: '0.25rem 0.5rem', fontWeight: 500, width: '6.5rem' }}>Top Out ($)</th>
                          <th style={{ padding: '0.25rem 0.5rem', fontWeight: 500, width: '6.5rem' }}>Trim Set ($)</th>
                          <th style={{ width: '2rem' }} />
                        </tr>
                      </thead>
                      <tbody>
                        {permitRows.map((row) => (
                          <tr key={row.id}>
                            <td style={{ padding: '0.2rem 0.5rem' }}>
                              <input
                                type="text"
                                value={row.note ?? ''}
                                onChange={(e) => updatePermitRow(row.id, { note: e.target.value })}
                                placeholder="Description"
                                style={{ width: '100%', padding: '0.375rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
                              />
                            </td>
                            {(['rough_in', 'top_out', 'trim_set'] as const).map((stage) => (
                              <td key={stage} style={{ padding: '0.2rem 0.5rem' }}>
                                <input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  value={row[stage] === 0 ? '' : String(row[stage])}
                                  onChange={(e) => updatePermitRow(row.id, { [stage]: e.target.value === '' ? 0 : parseFloat(e.target.value) } as Partial<Pick<CostEstimatePermitRow, 'rough_in' | 'top_out' | 'trim_set'>>)}
                                  onWheel={(e) => e.currentTarget.blur()}
                                  placeholder="0.00"
                                  style={{ width: '100%', padding: '0.375rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', textAlign: 'right' }}
                                />
                              </td>
                            ))}
                            <td style={{ padding: '0.2rem 0.25rem', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => void removePermitRow(row.id)}
                                title="Remove row"
                                aria-label="Remove permit row"
                                style={{ background: 'none', border: 'none', color: 'var(--text-red-700)', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {permitRows.length > 0 && (
                  <p style={{ margin: '0.5rem 0 0', textAlign: 'right', fontWeight: 600, fontSize: '0.875rem' }}>
                    Permits, inspections &amp; fees total: ${formatCurrency(sumEquipmentRows(permitRows))}
                  </p>
                  )}
                </div>
                {/* Subcontractor Fees Section */}
                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-amber-100)', borderRadius: 4, border: '1px solid #fde68a' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: subcontractorRows.length > 0 ? '0.5rem' : 0, flexWrap: 'wrap', gap: '0.5rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600 }}>Subcontractor Fees</h4>
                    <button
                      type="button"
                      onClick={() => void addSubcontractorRow()}
                      disabled={!costEstimate?.id}
                      style={{ padding: '0.25rem 0.6rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: costEstimate?.id ? 'pointer' : 'not-allowed', fontSize: '0.75rem', fontWeight: 500 }}
                    >
                      + Add row
                    </button>
                  </div>
                  {subcontractorRows.length === 0 ? null : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '0.25rem 0.5rem', fontWeight: 500 }}>Description</th>
                          <th style={{ padding: '0.25rem 0.5rem', fontWeight: 500, width: '6.5rem' }}>Rough In ($)</th>
                          <th style={{ padding: '0.25rem 0.5rem', fontWeight: 500, width: '6.5rem' }}>Top Out ($)</th>
                          <th style={{ padding: '0.25rem 0.5rem', fontWeight: 500, width: '6.5rem' }}>Trim Set ($)</th>
                          <th style={{ width: '2rem' }} />
                        </tr>
                      </thead>
                      <tbody>
                        {subcontractorRows.map((row) => (
                          <tr key={row.id}>
                            <td style={{ padding: '0.2rem 0.5rem' }}>
                              <input
                                type="text"
                                value={row.note ?? ''}
                                onChange={(e) => updateSubcontractorRow(row.id, { note: e.target.value })}
                                placeholder="Description"
                                style={{ width: '100%', padding: '0.375rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
                              />
                            </td>
                            {(['rough_in', 'top_out', 'trim_set'] as const).map((stage) => (
                              <td key={stage} style={{ padding: '0.2rem 0.5rem' }}>
                                <input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  value={row[stage] === 0 ? '' : String(row[stage])}
                                  onChange={(e) => updateSubcontractorRow(row.id, { [stage]: e.target.value === '' ? 0 : parseFloat(e.target.value) } as Partial<Pick<CostEstimateSubcontractorRow, 'rough_in' | 'top_out' | 'trim_set'>>)}
                                  onWheel={(e) => e.currentTarget.blur()}
                                  placeholder="0.00"
                                  style={{ width: '100%', padding: '0.375rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', textAlign: 'right' }}
                                />
                              </td>
                            ))}
                            <td style={{ padding: '0.2rem 0.25rem', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => void removeSubcontractorRow(row.id)}
                                title="Remove row"
                                aria-label="Remove subcontractor row"
                                style={{ background: 'none', border: 'none', color: 'var(--text-red-700)', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {subcontractorRows.length > 0 && (
                  <p style={{ margin: '0.5rem 0 0', textAlign: 'right', fontWeight: 600, fontSize: '0.875rem' }}>
                    Subcontractor fees total: ${formatCurrency(sumEquipmentRows(subcontractorRows))}
                  </p>
                  )}
                </div>
                {/* Waste Disposal & Site Cleanup Section */}
                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-amber-100)', borderRadius: 4, border: '1px solid #fde68a' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: wasteRows.length > 0 ? '0.5rem' : 0, flexWrap: 'wrap', gap: '0.5rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600 }}>Waste Disposal and Site Cleanup</h4>
                    <button
                      type="button"
                      onClick={() => void addWasteRow()}
                      disabled={!costEstimate?.id}
                      style={{ padding: '0.25rem 0.6rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: costEstimate?.id ? 'pointer' : 'not-allowed', fontSize: '0.75rem', fontWeight: 500 }}
                    >
                      + Add row
                    </button>
                  </div>
                  {wasteRows.length === 0 ? null : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '0.25rem 0.5rem', fontWeight: 500 }}>Description</th>
                          <th style={{ padding: '0.25rem 0.5rem', fontWeight: 500, width: '6.5rem' }}>Rough In ($)</th>
                          <th style={{ padding: '0.25rem 0.5rem', fontWeight: 500, width: '6.5rem' }}>Top Out ($)</th>
                          <th style={{ padding: '0.25rem 0.5rem', fontWeight: 500, width: '6.5rem' }}>Trim Set ($)</th>
                          <th style={{ width: '2rem' }} />
                        </tr>
                      </thead>
                      <tbody>
                        {wasteRows.map((row) => (
                          <tr key={row.id}>
                            <td style={{ padding: '0.2rem 0.5rem' }}>
                              <input
                                type="text"
                                value={row.note ?? ''}
                                onChange={(e) => updateWasteRow(row.id, { note: e.target.value })}
                                placeholder="Description"
                                style={{ width: '100%', padding: '0.375rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
                              />
                            </td>
                            {(['rough_in', 'top_out', 'trim_set'] as const).map((stage) => (
                              <td key={stage} style={{ padding: '0.2rem 0.5rem' }}>
                                <input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  value={row[stage] === 0 ? '' : String(row[stage])}
                                  onChange={(e) => updateWasteRow(row.id, { [stage]: e.target.value === '' ? 0 : parseFloat(e.target.value) } as Partial<Pick<CostEstimateWasteRow, 'rough_in' | 'top_out' | 'trim_set'>>)}
                                  onWheel={(e) => e.currentTarget.blur()}
                                  placeholder="0.00"
                                  style={{ width: '100%', padding: '0.375rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', textAlign: 'right' }}
                                />
                              </td>
                            ))}
                            <td style={{ padding: '0.2rem 0.25rem', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => void removeWasteRow(row.id)}
                                title="Remove row"
                                aria-label="Remove waste row"
                                style={{ background: 'none', border: 'none', color: 'var(--text-red-700)', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {wasteRows.length > 0 && (
                  <p style={{ margin: '0.5rem 0 0', textAlign: 'right', fontWeight: 600, fontSize: '0.875rem' }}>
                    Waste disposal &amp; site cleanup total: ${formatCurrency(sumEquipmentRows(wasteRows))}
                  </p>
                  )}
                </div>
                {/* Other Section */}
                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-amber-100)', borderRadius: 4, border: '1px solid #fde68a' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: otherRows.length > 0 ? '0.5rem' : 0, flexWrap: 'wrap', gap: '0.5rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600 }}>Other</h4>
                    <button
                      type="button"
                      onClick={() => void addOtherRow()}
                      disabled={!costEstimate?.id}
                      style={{ padding: '0.25rem 0.6rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: costEstimate?.id ? 'pointer' : 'not-allowed', fontSize: '0.75rem', fontWeight: 500 }}
                    >
                      + Add row
                    </button>
                  </div>
                  {otherRows.length === 0 ? null : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '0.25rem 0.5rem', fontWeight: 500 }}>Description</th>
                          <th style={{ padding: '0.25rem 0.5rem', fontWeight: 500, width: '6.5rem' }}>Rough In ($)</th>
                          <th style={{ padding: '0.25rem 0.5rem', fontWeight: 500, width: '6.5rem' }}>Top Out ($)</th>
                          <th style={{ padding: '0.25rem 0.5rem', fontWeight: 500, width: '6.5rem' }}>Trim Set ($)</th>
                          <th style={{ width: '2rem' }} />
                        </tr>
                      </thead>
                      <tbody>
                        {otherRows.map((row) => (
                          <tr key={row.id}>
                            <td style={{ padding: '0.2rem 0.5rem' }}>
                              <input
                                type="text"
                                value={row.note ?? ''}
                                onChange={(e) => updateOtherRow(row.id, { note: e.target.value })}
                                placeholder="Description"
                                style={{ width: '100%', padding: '0.375rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
                              />
                            </td>
                            {(['rough_in', 'top_out', 'trim_set'] as const).map((stage) => (
                              <td key={stage} style={{ padding: '0.2rem 0.5rem' }}>
                                <input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  value={row[stage] === 0 ? '' : String(row[stage])}
                                  onChange={(e) => updateOtherRow(row.id, { [stage]: e.target.value === '' ? 0 : parseFloat(e.target.value) } as Partial<Pick<CostEstimateOtherRow, 'rough_in' | 'top_out' | 'trim_set'>>)}
                                  onWheel={(e) => e.currentTarget.blur()}
                                  placeholder="0.00"
                                  style={{ width: '100%', padding: '0.375rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', textAlign: 'right' }}
                                />
                              </td>
                            ))}
                            <td style={{ padding: '0.2rem 0.25rem', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => void removeOtherRow(row.id)}
                                title="Remove row"
                                aria-label="Remove row"
                                style={{ background: 'none', border: 'none', color: 'var(--text-red-700)', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {otherRows.length > 0 && (
                  <p style={{ margin: '0.5rem 0 0', textAlign: 'right', fontWeight: 600, fontSize: '0.875rem' }}>
                    Other total: ${formatCurrency(sumEquipmentRows(otherRows))}
                  </p>
                  )}
                </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {costEstimateAutosaveStatus === 'saving' && (
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Saving...</span>
                  )}
                  {costEstimateAutosaveStatus === 'saved' && (
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-green-600)' }}>✓ Saved</span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
      {!selectedBidForCostEstimate && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'var(--bg-subtle)' }}>
              <tr>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Project</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Bid Date</th>
              </tr>
            </thead>
            <tbody>
              {costEstimateBidList.map((row) => {
                const bid = row as unknown as BidWithBuilder
                const sel = selectedBidForCostEstimate as BidWithBuilder | null
                return (
                  <tr
                    key={bid.id}
                    onClick={() => onSelectBid(bid)}
                    style={{
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border)',
                      background: (sel?.id != null && sel.id === bid.id) ? '#eff6ff' : undefined,
                    }}
                  >
                    <td style={{ padding: '0.75rem' }}><BidProjectCell bid={bid} ledgerPrefixMap={ledgerPrefixMap} /></td>
                    <td style={{ padding: '0.75rem' }}>{formatDateYYMMDD(bid.bid_due_date)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', marginTop: '1.5rem' }}>
        <div>
          <button
            type="button"
            onClick={() => setLaborBookSectionOpen((prev) => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              margin: 0,
              marginBottom: laborBookSectionOpen ? '0.75rem' : 0,
              padding: 0,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 600,
            }}
          >
            <span style={{ fontSize: '0.75rem' }}>{laborBookSectionOpen ? '▼' : '▶'}</span>
            Labor book
          </button>
          {laborBookSectionOpen && (
          <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {laborBookVersions.map((v) => (
              <span
                key={v.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.35rem 0.5rem',
                  background: laborBookEntriesVersionId === v.id ? '#dbeafe' : 'var(--bg-muted)',
                  border: laborBookEntriesVersionId === v.id ? '1px solid #3b82f6' : '1px solid var(--border-strong)',
                  borderRadius: 4,
                }}
              >
                <button
                  type="button"
                  onClick={() => { setLaborBookEntriesVersionId(v.id); loadLaborBookEntries(v.id) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: laborBookEntriesVersionId === v.id ? 600 : 400, padding: 0 }}
                >
                  {v.name}
                </button>
                <button
                  type="button"
                  onClick={() => openEditLaborVersion(v)}
                  style={{ padding: '0.15rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
                  title="Edit version name"
                >
                  ✎
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={openNewLaborVersion}
              style={{ marginLeft: 'auto', padding: '0.35rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
            >
              Add version
            </button>
          </div>
          {laborBookEntriesVersionId && (
            <>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>Entries (hrs per stage)</h4>
              <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ background: 'var(--bg-subtle)' }}>
                    <tr>
                      <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Fixture or Tie-in</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Rough In (hrs)</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Top Out (hrs)</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Trim Set (hrs)</th>
                      <th style={{ padding: '0.5rem', width: 60, borderBottom: '1px solid var(--border)' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {laborBookEntries.map((entry) => (
                      <tr key={entry.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.5rem' }}>
                          {entry.fixture_types?.name ?? ''}
                          {entry.alias_names?.length ? (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.25rem' }}>also: {entry.alias_names.join(', ')}</span>
                          ) : null}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(entry.rough_in_hrs)}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(entry.top_out_hrs)}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(entry.trim_set_hrs)}</td>
                        <td style={{ padding: '0.5rem' }}>
                          <button type="button" onClick={() => openEditLaborEntry(entry)} style={{ padding: '0.15rem', background: 'none', border: 'none', cursor: 'pointer' }} title="Edit">✎</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={openNewLaborEntry}
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
      {laborVersionFormOpen && (
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
          onClick={closeLaborVersionForm}
        >
          <div
            style={{ background: 'var(--surface)', borderRadius: 8, padding: '1.5rem', minWidth: 320, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 1rem' }}>{editingLaborVersion ? 'Edit version' : 'New version'}</h3>
            <form onSubmit={saveLaborVersion}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Name</label>
              <input
                type="text"
                value={laborVersionNameInput}
                onChange={(e) => setLaborVersionNameInput(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, marginBottom: '1rem', boxSizing: 'border-box' }}
                placeholder="e.g. Default"
              />
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  {editingLaborVersion && editingLaborVersion.name !== 'Default' && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm(`Delete labor book "${editingLaborVersion.name}"? This will delete all entries in this version.`)) return
                        await deleteLaborVersion(editingLaborVersion)
                        closeLaborVersionForm()
                      }}
                      style={{ padding: '0.5rem 1rem', background: 'var(--bg-red-tint)', color: 'var(--text-red-800)', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer' }}
                    >
                      Delete version
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" onClick={closeLaborVersionForm} style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" disabled={savingLaborVersion} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{savingLaborVersion ? 'Saving…' : 'Save'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {laborEntryFormOpen && laborBookEntriesVersionId && (
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
          onClick={closeLaborEntryForm}
        >
          <div
            style={{ background: 'var(--surface)', borderRadius: 8, padding: '1.5rem', minWidth: 360, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 1rem' }}>{editingLaborEntry ? 'Edit entry' : 'New entry'}</h3>
            {error && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-red-100)', color: 'var(--text-red-800)', borderRadius: 4, fontSize: '0.875rem' }}>
                {error}
              </div>
            )}
            <form onSubmit={saveLaborEntry}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Fixture or Tie-in *</label>
              <input
                type="text"
                list="labor-fixture-types"
                value={laborEntryFixtureName}
                onChange={(e) => setLaborEntryFixtureName(e.target.value)}
                required
                placeholder="Type or select fixture type..."
                autoComplete="off"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, marginBottom: '0.75rem', boxSizing: 'border-box' }}
              />
              <datalist id="labor-fixture-types">
                {fixtureTypes.map(ft => (
                  <option key={ft.id} value={ft.name} />
                ))}
              </datalist>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Additional names (optional)</label>
              <input
                type="text"
                value={laborEntryAliasNames}
                onChange={(e) => setLaborEntryAliasNames(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, marginBottom: '0.25rem', boxSizing: 'border-box' }}
                placeholder="e.g. WC, Commode"
              />
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>If any of these match a count row's Fixture or Tie-in, this labor rate is applied.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Rough In (hrs)</label>
                  <input type="number" min={0} step={0.01} value={laborEntryRoughIn} onChange={(e) => setLaborEntryRoughIn(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Top Out (hrs)</label>
                  <input type="number" min={0} step={0.01} value={laborEntryTopOut} onChange={(e) => setLaborEntryTopOut(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Trim Set (hrs)</label>
                  <input type="number" min={0} step={0.01} value={laborEntryTrimSet} onChange={(e) => setLaborEntryTrimSet(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  {editingLaborEntry && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm(`Delete "${editingLaborEntry.fixture_types?.name ?? ''}" from this labor book?`)) return
                        await deleteLaborEntry(editingLaborEntry)
                        closeLaborEntryForm()
                      }}
                      style={{ padding: '0.5rem 1rem', background: 'var(--bg-red-tint)', color: 'var(--text-red-800)', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer' }}
                    >
                      Delete
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" onClick={closeLaborEntryForm} style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" disabled={savingLaborEntry} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{savingLaborEntry ? 'Saving…' : 'Save'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {addMissingFixtureModalOpen && selectedLaborBookVersionId && (
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
          onClick={() => setAddMissingFixtureModalOpen(false)}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 8,
              padding: '1.5rem',
              maxWidth: 500,
              width: '90%',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>
              Add "{addMissingFixtureName}" to Labor Book
            </h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Adding to: <strong>{laborBookVersions.find(v => v.id === selectedLaborBookVersionId)?.name || 'Unknown'}</strong>
            </p>
            <form onSubmit={saveMissingFixtureToLaborBook}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>
                    Rough In
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={addMissingFixtureRoughIn}
                    onChange={(e) => setAddMissingFixtureRoughIn(e.target.value)}
                    onWheel={(e) => e.currentTarget.blur()}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                    autoFocus
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>
                    Top Out
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={addMissingFixtureTopOut}
                    onChange={(e) => setAddMissingFixtureTopOut(e.target.value)}
                    onWheel={(e) => e.currentTarget.blur()}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>
                    Trim Set
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={addMissingFixtureTrimSet}
                    onChange={(e) => setAddMissingFixtureTrimSet(e.target.value)}
                    onWheel={(e) => e.currentTarget.blur()}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setAddMissingFixtureModalOpen(false)}
                  style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingMissingFixture}
                  style={{
                    padding: '0.5rem 1rem',
                    background: savingMissingFixture ? '#9ca3af' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor: savingMissingFixture ? 'wait' : 'pointer'
                  }}
                >
                  {savingMissingFixture ? 'Adding...' : 'Add to Labor Book'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
