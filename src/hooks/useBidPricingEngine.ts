import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry, formatErrorMessage } from '../utils/errorHandling'
import { expandTemplate } from '../lib/materialPOUtils'
import { normalizeMaterialsModel, sumRoughLinesPreTaxWithCount, roughCountMultiplier, type MaterialsModel, type TakeoffStage } from '../lib/bids/bidTakeoffHelpers'
import { loadTeamLaborDataForBids, type TeamLaborBidRow } from '../utils/teamLabor'
import type { BidCountRow } from '../types/bids'
import type { BidWithBuilder } from '../types/bidWithBuilder'
import type {
  MaterialTemplateWithAssemblyType,
  CostEstimate,
  CostEstimateLaborRow,
  CostEstimatePO,
  DraftPO,
  FixtureLaborDefault,
  LaborBookVersion,
  LaborBookEntry,
  LaborBookEntryWithFixture,
  PriceBookVersion,
  PriceBookEntryWithFixture,
  BidPricingAssignment,
  BidCountRowCustomPrice,
  BidCountRowSubmissionHide,
  TakeoffBookVersion,
  TakeoffBookEntry,
  TakeoffBookEntryItem,
  TakeoffBookEntryWithItems,
  TakeoffMapping,
  TakeoffRoughPartLineRow,
} from '../lib/bids/bidPricingEngineTypes'

export type UseBidPricingEngineDeps = {
  selectedBidForCounts: BidWithBuilder | null
  selectedBidForTakeoff: BidWithBuilder | null
  selectedBidForCostEstimate: BidWithBuilder | null
  selectedBidForPricing: BidWithBuilder | null
  activeTab: string
  selectedServiceTypeId: string
  authUser: { id: string } | null
  setError: (value: string | null) => void
  loadBids: (serviceTypeId?: string | null) => Promise<BidWithBuilder[]>
  setSharedBid: (bid: BidWithBuilder | null) => void
}

/**
 * Shared pricing-engine state for the Counts / Takeoffs / Labor / Pricing / Cover Letter
 * tabs of the Bids page. This hook owns the cached count-row copies, cost-estimate and
 * labor/price-book data, takeoff data, and the materials-model switch state. Loaders,
 * effects, and memoized selectors are added in later stages; for now it owns state + refs
 * so the parent component can consume them via destructuring without behavior changes.
 */
export function useBidPricingEngine(deps: UseBidPricingEngineDeps) {
  const {
    selectedBidForCounts,
    selectedBidForTakeoff,
    selectedBidForCostEstimate,
    selectedBidForPricing,
    activeTab,
    selectedServiceTypeId,
    authUser,
    setError,
    loadBids,
    setSharedBid,
  } = deps

  // --- Counts ---
  const [countRows, setCountRows] = useState<BidCountRow[]>([])
  const skipNextLoadCountRowsRef = useRef(false)

  // --- Takeoffs ---
  const [takeoffCountRows, setTakeoffCountRows] = useState<BidCountRow[]>([])
  const [takeoffMappings, setTakeoffMappings] = useState<TakeoffMapping[]>([])
  const [takeoffRoughPartLines, setTakeoffRoughPartLines] = useState<TakeoffRoughPartLineRow[]>([])
  const [takeoffRoughCatalogLowestByPartId, setTakeoffRoughCatalogLowestByPartId] = useState<
    Record<string, { price: number; supplyHouseName: string }>
  >({})
  const [materialsModelSwitchModal, setMaterialsModelSwitchModal] = useState<{
    open: boolean
    next: MaterialsModel | null
    sourceTab: 'takeoffs' | 'labor' | 'pricing' | null
  }>({ open: false, next: null, sourceTab: null })
  const [materialsModelBusy, setMaterialsModelBusy] = useState(false)
  const [materialTemplates, setMaterialTemplates] = useState<MaterialTemplateWithAssemblyType[]>([])
  const [draftPOs, setDraftPOs] = useState<DraftPO[]>([])
  const [takeoffBookVersions, setTakeoffBookVersions] = useState<TakeoffBookVersion[]>([])
  const [takeoffBookEntries, setTakeoffBookEntries] = useState<TakeoffBookEntryWithItems[]>([])
  const [selectedTakeoffBookVersionId, setSelectedTakeoffBookVersionId] = useState<string | null>(null)
  const [takeoffBookEntriesVersionId, setTakeoffBookEntriesVersionId] = useState<string | null>(null)

  // --- Labor (cost estimate) ---
  const [costEstimate, setCostEstimate] = useState<CostEstimate | null>(null)
  const [costEstimateLaborRows, setCostEstimateLaborRows] = useState<CostEstimateLaborRow[]>([])
  const [costEstimateCountRows, setCostEstimateCountRows] = useState<BidCountRow[]>([])
  const [purchaseOrdersForCostEstimate, setPurchaseOrdersForCostEstimate] = useState<CostEstimatePO[]>([])
  const [costEstimateMaterialTotalRoughIn, setCostEstimateMaterialTotalRoughIn] = useState<number | null>(null)
  const [costEstimateMaterialTotalTopOut, setCostEstimateMaterialTotalTopOut] = useState<number | null>(null)
  const [costEstimateMaterialTotalTrimSet, setCostEstimateMaterialTotalTrimSet] = useState<number | null>(null)
  const [laborRateInput, setLaborRateInput] = useState('')
  const [drivingCostRate, setDrivingCostRate] = useState('0.70')
  const [hoursPerTrip, setHoursPerTrip] = useState('2')
  const [laborBookVersions, setLaborBookVersions] = useState<LaborBookVersion[]>([])
  const [laborBookEntries, setLaborBookEntries] = useState<LaborBookEntryWithFixture[]>([])
  const [selectedLaborBookVersionId, setSelectedLaborBookVersionId] = useState<string | null>(null)
  const [laborBookEntriesVersionId, setLaborBookEntriesVersionId] = useState<string | null>(null)
  const costEstimateBidIdRef = useRef<string | null>(null)
  const [estimatorCostUseFlat, setEstimatorCostUseFlat] = useState(false)
  const [estimatorCostPerCount, setEstimatorCostPerCount] = useState('10')
  const [estimatorCostFlatAmount, setEstimatorCostFlatAmount] = useState('')
  const [travelPeople, setTravelPeople] = useState('1')
  const [travelNights, setTravelNights] = useState('1')
  const [travelMealsRate, setTravelMealsRate] = useState('')
  const [travelHotelRate, setTravelHotelRate] = useState('')

  // --- Team labor (clocked) used in Pricing cost breakdown ---
  const [teamLaborDataForBids, setTeamLaborDataForBids] = useState<TeamLaborBidRow[]>([])

  // --- Pricing ---
  const [priceBookVersions, setPriceBookVersions] = useState<PriceBookVersion[]>([])
  const [priceBookEntries, setPriceBookEntries] = useState<PriceBookEntryWithFixture[]>([])
  const [bidPricingAssignments, setBidPricingAssignments] = useState<BidPricingAssignment[]>([])
  const [bidCountRowCustomPrices, setBidCountRowCustomPrices] = useState<BidCountRowCustomPrice[]>([])
  const [bidCountRowSubmissionHides, setBidCountRowSubmissionHides] = useState<BidCountRowSubmissionHide[]>([])
  const [selectedPricingVersionId, setSelectedPricingVersionId] = useState<string | null>(null)
  const pricingBidIdRef = useRef<string | null>(null)
  const [pricingCountRows, setPricingCountRows] = useState<BidCountRow[]>([])
  const [pricingCostEstimate, setPricingCostEstimate] = useState<CostEstimate | null>(null)
  const [pricingLaborRows, setPricingLaborRows] = useState<CostEstimateLaborRow[]>([])
  const [pricingMaterialTotalRoughIn, setPricingMaterialTotalRoughIn] = useState<number | null>(null)
  const [pricingMaterialTotalTopOut, setPricingMaterialTotalTopOut] = useState<number | null>(null)
  const [pricingMaterialTotalTrimSet, setPricingMaterialTotalTrimSet] = useState<number | null>(null)
  const [pricingLaborRate, setPricingLaborRate] = useState<number | null>(null)
  const [pricingFixtureMaterialsFromTakeoff, setPricingFixtureMaterialsFromTakeoff] = useState<Record<string, number>>({})

  async function loadCountRows(bidId: string) {
    const { data, error } = await supabase
      .from('bids_count_rows')
      .select('*')
      .eq('bid_id', bidId)
      .order('sequence_order', { ascending: true })
      .order('id', { ascending: true })
    if (error) {
      setError(`Failed to load count rows: ${error.message}`)
      return
    }
    if (skipNextLoadCountRowsRef.current) {
      console.log('[CountMove] loadCountRows SKIPPED (move in progress)')
      return
    }
    const loaded = (data as BidCountRow[]) ?? []
    console.log('[CountMove] loadCountRows APPLIED', { len: loaded.length, fixtures: loaded.map((r) => r?.fixture?.slice(0, 12)) })
    setCountRows(loaded)
  }

  function refreshAfterCountsChange(opts?: { skipCountRows?: boolean }) {
    const bidId = selectedBidForCounts?.id
    if (!bidId) return
    if (!opts?.skipCountRows) loadCountRows(bidId)
    if (selectedBidForTakeoff?.id === bidId) loadTakeoffCountRows(bidId)
    if (selectedBidForCostEstimate?.id === bidId) loadCostEstimateData(bidId, selectedLaborBookVersionId)
  }

  async function loadTakeoffCountRows(bidId: string) {
    const [{ data, error }, bidMetaRes] = await Promise.all([
      supabase
        .from('bids_count_rows')
        .select('*')
        .eq('bid_id', bidId)
        .order('sequence_order', { ascending: true }),
      supabase.from('bids').select('materials_model').eq('id', bidId).maybeSingle(),
    ])
    if (error) {
      setError(`Failed to load count rows: ${error.message}`)
      return
    }
    const rows = (data as BidCountRow[]) ?? []
    setTakeoffCountRows(rows)
    const mm = normalizeMaterialsModel((bidMetaRes.data as { materials_model?: string } | null)?.materials_model)

    if (mm === 'rough') {
      setTakeoffMappings([])
      const { data: roughData, error: roughErr } = await supabase
        .from('bids_takeoff_rough_part_lines')
        .select('*')
        .eq('bid_id', bidId)
        .order('count_row_id', { ascending: true })
        .order('sequence_order', { ascending: true })
      if (roughErr) {
        console.error('Failed to load rough part lines:', roughErr)
        setTakeoffRoughPartLines([])
        return
      }
      const savedRough = (roughData ?? []) as Array<{
        id: string
        count_row_id: string
        part_id: string
        quantity: number
        unit_price: number
        sequence_order: number
        source_material_part_price_id: string | null
        source_template_id: string | null
      }>
      setTakeoffRoughPartLines(
        savedRough.map((r) => ({
          id: r.id,
          countRowId: r.count_row_id,
          partId: r.part_id,
          quantity: Number(r.quantity),
          unitPrice: Number(r.unit_price),
          sourceMaterialPartPriceId: r.source_material_part_price_id ?? null,
          sourceTemplateId: r.source_template_id ?? null,
          sequenceOrder: r.sequence_order,
          isSaved: true,
        }))
      )
      return
    }

    setTakeoffRoughPartLines([])

    const { data: mappingsData, error: mappingsError } = await supabase
      .from('bids_takeoff_template_mappings')
      .select('*')
      .eq('bid_id', bidId)
      .order('sequence_order', { ascending: true })

    if (mappingsError) {
      console.error('Failed to load takeoff mappings:', mappingsError)
    }

    const savedMappings =
      (mappingsData as Array<{
        id: string
        count_row_id: string
        template_id: string
        stage: string
        quantity: number
      }> | null) ?? []

    const mappings: TakeoffMapping[] = []

    for (const row of rows) {
      const saved = savedMappings.filter((m) => m.count_row_id === row.id)

      if (saved.length > 0) {
        for (const s of saved) {
          mappings.push({
            id: s.id,
            countRowId: s.count_row_id,
            templateId: s.template_id,
            stage: s.stage as TakeoffStage,
            quantity: s.quantity,
            isSaved: true,
          })
        }
      } else {
        mappings.push({
          id: crypto.randomUUID(),
          countRowId: row.id,
          templateId: '',
          stage: 'rough_in' as TakeoffStage,
          quantity: Number(row.count),
          isSaved: false,
        })
      }
    }

    setTakeoffMappings(mappings)
  }

  async function loadMaterialTemplates() {
    if (!selectedServiceTypeId) {
      setMaterialTemplates([])
      return
    }
    const { data, error } = await supabase
      .from('material_templates')
      .select('*, assembly_types(name)')
      .eq('service_type_id', selectedServiceTypeId)
      .order('name', { ascending: true })
    if (error) {
      setError(`Failed to load templates: ${error.message}`)
      return
    }
    setMaterialTemplates((data as MaterialTemplateWithAssemblyType[]) ?? [])
  }

  async function loadDraftPOs() {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('id, name')
      .eq('status', 'draft')
      .order('updated_at', { ascending: false })
    if (error) {
      setError(`Failed to load draft POs: ${error.message}`)
      return
    }
    setDraftPOs((data as DraftPO[]) ?? [])
  }

  async function loadTakeoffBookVersions() {
    if (!selectedServiceTypeId) return
    
    const { data, error } = await supabase
      .from('takeoff_book_versions')
      .select('*')
      .eq('service_type_id', selectedServiceTypeId)
      .order('name', { ascending: true })
    if (error) {
      setError(`Failed to load takeoff book versions: ${error.message}`)
      return
    }
    setTakeoffBookVersions((data as TakeoffBookVersion[]) ?? [])
  }

  async function loadTakeoffBookEntries(versionId: string | null) {
    if (!versionId) {
      setTakeoffBookEntries([])
      return
    }
    const { data: entriesData, error: entriesErr } = await supabase
      .from('takeoff_book_entries')
      .select('*')
      .eq('version_id', versionId)
      .order('sequence_order', { ascending: true })
      .order('fixture_name', { ascending: true })
    if (entriesErr) {
      setError(`Failed to load takeoff book entries: ${entriesErr.message}`)
      setTakeoffBookEntries([])
      return
    }
    const entries = (entriesData as TakeoffBookEntry[]) ?? []
    if (entries.length === 0) {
      setTakeoffBookEntries([])
      return
    }
    const entryIds = entries.map((e) => e.id)
    const { data: itemsData, error: itemsErr } = await supabase
      .from('takeoff_book_entry_items')
      .select('*')
      .in('entry_id', entryIds)
      .order('sequence_order', { ascending: true })
    if (itemsErr) {
      setError(`Failed to load takeoff book entry items: ${itemsErr.message}`)
      setTakeoffBookEntries([])
      return
    }
    const items = (itemsData as TakeoffBookEntryItem[]) ?? []
    const itemsByEntryId = new Map<string, TakeoffBookEntryItem[]>()
    for (const item of items) {
      const list = itemsByEntryId.get(item.entry_id) ?? []
      list.push(item)
      itemsByEntryId.set(item.entry_id, list)
    }
    const entriesWithItems: TakeoffBookEntryWithItems[] = entries.map((e) => ({
      ...e,
      items: itemsByEntryId.get(e.id) ?? [],
    }))
    setTakeoffBookEntries(entriesWithItems)
  }

  async function saveBidSelectedTakeoffBookVersion(bidId: string, versionId: string | null) {
    const { error: err } = await supabase
      .from('bids')
      .update({ selected_takeoff_book_version_id: versionId })
      .eq('id', bidId)
    if (err) {
      setError(`Failed to save takeoff book version: ${err.message}`)
      return
    }
    await loadBids()
  }

  async function loadPurchaseOrdersForCostEstimate() {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('id, name, stage')
      .order('updated_at', { ascending: false })
    if (error) {
      setError(`Failed to load purchase orders: ${error.message}`)
      return
    }
    setPurchaseOrdersForCostEstimate((data as CostEstimatePO[]) ?? [])
  }

  async function loadPOTotal(poId: string, signal?: AbortSignal): Promise<number> {
    let q: ReturnType<typeof supabase.from> = supabase
      .from('purchase_order_items')
      .select('price_at_time, quantity')
      .eq('purchase_order_id', poId)
    if (signal && 'abortSignal' in q) q = (q as { abortSignal: (s: AbortSignal) => typeof q }).abortSignal(signal)
    const { data, error } = await q
    if (error) return 0
    const items = (data as { price_at_time: number; quantity: number }[]) ?? []
    return items.reduce((sum, i) => sum + Number(i.price_at_time) * Number(i.quantity), 0)
  }

  async function loadCostEstimate(bidId: string) {
    const [{ data: existing, error: e }, bidMmRes] = await Promise.all([
      supabase.from('cost_estimates').select('*').eq('bid_id', bidId).maybeSingle(),
      supabase.from('bids').select('materials_model').eq('id', bidId).maybeSingle(),
    ])
    if (e) {
      setError(`Failed to load cost estimate: ${e.message}`)
      setCostEstimate(null)
      return null
    }
    const est = (existing as CostEstimate | null) ?? null
    setCostEstimate(est)
    const mm = normalizeMaterialsModel((bidMmRes.data as { materials_model?: string } | null)?.materials_model)
    if (est) {
      setLaborRateInput(est.labor_rate != null ? String(est.labor_rate) : '')
      setDrivingCostRate((est as any).driving_cost_rate?.toString() ?? '0.70')
      setHoursPerTrip((est as any).hours_per_trip?.toString() ?? '2')
      setEstimatorCostPerCount((est as any).estimator_cost_per_count?.toString() ?? '10')
      setEstimatorCostFlatAmount((est as any).estimator_cost_flat_amount != null ? String((est as any).estimator_cost_flat_amount) : '')
      setEstimatorCostUseFlat((est as any).estimator_cost_flat_amount != null)
      setTravelPeople((est as any).travel_people != null ? String((est as any).travel_people) : '1')
      setTravelNights((est as any).travel_nights != null ? String((est as any).travel_nights) : '1')
      setTravelMealsRate((est as any).travel_meals_rate != null ? String((est as any).travel_meals_rate) : '')
      setTravelHotelRate((est as any).travel_hotel_rate != null ? String((est as any).travel_hotel_rate) : '')
      if (mm === 'rough') {
        const [{ data: roughLines }, { data: crsForCount }] = await Promise.all([
          supabase
            .from('bids_takeoff_rough_part_lines')
            .select('count_row_id, quantity, unit_price')
            .eq('bid_id', bidId),
          supabase.from('bids_count_rows').select('id, count').eq('bid_id', bidId),
        ])
        const countByRowId = new Map(
          ((crsForCount ?? []) as Array<{ id: string; count: number | null }>).map((r) => [r.id, r.count]),
        )
        const sum = sumRoughLinesPreTaxWithCount(
          (roughLines ?? []) as Array<{ count_row_id: string | null; quantity: number; unit_price: number }>,
          countByRowId,
        )
        setCostEstimateMaterialTotalRoughIn(sum)
        setCostEstimateMaterialTotalTopOut(null)
        setCostEstimateMaterialTotalTrimSet(null)
      } else {
        const rough = est.purchase_order_id_rough_in ? await loadPOTotal(est.purchase_order_id_rough_in) : 0
        const top = est.purchase_order_id_top_out ? await loadPOTotal(est.purchase_order_id_top_out) : 0
        const trim = est.purchase_order_id_trim_set ? await loadPOTotal(est.purchase_order_id_trim_set) : 0
        setCostEstimateMaterialTotalRoughIn(est.purchase_order_id_rough_in ? rough : null)
        setCostEstimateMaterialTotalTopOut(est.purchase_order_id_top_out ? top : null)
        setCostEstimateMaterialTotalTrimSet(est.purchase_order_id_trim_set ? trim : null)
      }
    } else {
      setLaborRateInput('')
      setDrivingCostRate('0.70')
      setHoursPerTrip('2')
      setEstimatorCostPerCount('10')
      setEstimatorCostFlatAmount('')
      setEstimatorCostUseFlat(false)
      setCostEstimateMaterialTotalRoughIn(null)
      setCostEstimateMaterialTotalTopOut(null)
      setCostEstimateMaterialTotalTrimSet(null)
    }
    return est
  }

  async function loadCostEstimateCountRows(bidId: string) {
    const { data, error } = await supabase
      .from('bids_count_rows')
      .select('*')
      .eq('bid_id', bidId)
      .order('sequence_order', { ascending: true })
    if (error) {
      setError(`Failed to load count rows: ${error.message}`)
      setCostEstimateCountRows([])
      return []
    }
    const rows = (data as BidCountRow[]) ?? []
    setCostEstimateCountRows(rows)
    return rows
  }

  async function loadFixtureLaborDefaults(): Promise<FixtureLaborDefault[]> {
    const { data, error } = await supabase.from('fixture_labor_defaults').select('*')
    if (error) return []
    return (data as FixtureLaborDefault[]) ?? []
  }

  async function loadCostEstimateLaborRowsAndSync(estimateId: string, countRows: BidCountRow[], defaults: FixtureLaborDefault[]) {
    const { data: laborData, error: laborErr } = await supabase
      .from('cost_estimate_labor_rows')
      .select('*')
      .eq('cost_estimate_id', estimateId)
      .order('sequence_order', { ascending: true })
    if (laborErr) {
      setError(`Failed to load labor rows: ${laborErr.message}`)
      setCostEstimateLaborRows([])
      return
    }
    let rows = (laborData as CostEstimateLaborRow[]) ?? []
    const countByFixture = new Map<string, number>()
    for (const r of countRows) countByFixture.set(r.fixture ?? '', Number(r.count))
    const fixtureSet = new Set(countRows.map((r) => r.fixture ?? ''))
    const maxSeq = rows.length === 0 ? 0 : Math.max(...rows.map((r) => r.sequence_order))
    let seq = maxSeq
    for (const cr of countRows) {
      const existing = rows.find((l) => (l.fixture ?? '') === (cr.fixture ?? ''))
      const countVal = Number(cr.count)
      if (!existing) {
        const def = defaults.find((d) => d.fixture.toLowerCase() === (cr.fixture ?? '').toLowerCase())
        // If not found in primary defaults (labor book), fall back to fixture_labor_defaults
        let hours = { rough_in_hrs: 0, top_out_hrs: 0, trim_set_hrs: 0 }
        if (def) {
          hours = { rough_in_hrs: def.rough_in_hrs, top_out_hrs: def.top_out_hrs, trim_set_hrs: def.trim_set_hrs }
        } else {
          // Load from fixture_labor_defaults as fallback
          const { data: fallbackData } = await supabase
            .from('fixture_labor_defaults')
            .select('*')
            .ilike('fixture', cr.fixture ?? '')
            .limit(1)
            .maybeSingle()
          if (fallbackData) {
            hours = { 
              rough_in_hrs: Number(fallbackData.rough_in_hrs), 
              top_out_hrs: Number(fallbackData.top_out_hrs), 
              trim_set_hrs: Number(fallbackData.trim_set_hrs) 
            }
          }
        }
        
        const { data: inserted, error: insErr } = await supabase
          .from('cost_estimate_labor_rows')
          .insert({
            cost_estimate_id: estimateId,
            fixture: cr.fixture ?? '',
            count: countVal,
            rough_in_hrs_per_unit: hours.rough_in_hrs,
            top_out_hrs_per_unit: hours.top_out_hrs,
            trim_set_hrs_per_unit: hours.trim_set_hrs,
            sequence_order: ++seq,
            is_fixed: false,
          })
          .select('*')
          .single()
        if (!insErr && inserted) rows = [...rows, inserted as CostEstimateLaborRow]
      } else if (Number(existing.count) !== countVal) {
        await supabase.from('cost_estimate_labor_rows').update({ count: countVal }).eq('id', existing.id)
      }
    }
    const toDelete = rows.filter((r) => !fixtureSet.has(r.fixture ?? ''))
    for (const r of toDelete) {
      await supabase.from('cost_estimate_labor_rows').delete().eq('id', r.id)
    }
    const { data: refetched } = await supabase
      .from('cost_estimate_labor_rows')
      .select('*')
      .eq('cost_estimate_id', estimateId)
      .order('sequence_order', { ascending: true })
    setCostEstimateLaborRows((refetched as CostEstimateLaborRow[]) ?? [])
  }

  async function ensureCostEstimateForBid(bidId: string): Promise<CostEstimate | null> {
    let est = await loadCostEstimate(bidId)
    if (!est && authUser?.id) {
      const { data: inserted, error: insErr } = await supabase
        .from('cost_estimates')
        .insert({ bid_id: bidId })
        .select('*')
        .single()
      if (insErr) {
        // Duplicate key = cost estimate already exists (race or concurrent create); load and use it
        const isUniqueViolation = (insErr as { code?: string | number }).code === '23505' || (insErr as { code?: string | number }).code === 23505
        if (isUniqueViolation && insErr.message?.includes('cost_estimates_bid_id_key')) {
          est = await loadCostEstimate(bidId)
          if (est) return est
        }
        setError(`Failed to create cost estimate: ${insErr.message}`)
        return null
      }
      est = inserted as CostEstimate
      setCostEstimate(est)
    }
    return est
  }

  async function loadCostEstimateData(bidId: string, laborBookVersionId: string | null) {
    const countRows = await loadCostEstimateCountRows(bidId)
    if (countRows.length === 0) {
      setCostEstimateLaborRows([])
      const est = await loadCostEstimate(bidId)
      if (!est) await ensureCostEstimateForBid(bidId)
      return
    }
    const est = await ensureCostEstimateForBid(bidId)
    if (!est) return
    let defaults: FixtureLaborDefault[]
    if (laborBookVersionId) {
      const { data: entries, error } = await supabase
        .from('labor_book_entries')
        .select('*, fixture_types(name)')
        .eq('version_id', laborBookVersionId)
        .order('sequence_order', { ascending: true })
      if (error || !entries?.length) {
        defaults = await loadFixtureLaborDefaults()
      } else {
        const map = new Map<string, { rough_in_hrs: number; top_out_hrs: number; trim_set_hrs: number }>()
        for (const e of entries as (LaborBookEntry & { fixture_types?: { name: string } | null })[]) {
          const hours = { rough_in_hrs: Number(e.rough_in_hrs), top_out_hrs: Number(e.top_out_hrs), trim_set_hrs: Number(e.trim_set_hrs) }
          const primary = (e.fixture_types?.name ?? '').trim().toLowerCase()
          if (primary && !map.has(primary)) map.set(primary, hours)
          for (const name of e.alias_names ?? []) {
            const key = name.trim().toLowerCase()
            if (key && !map.has(key)) map.set(key, hours)
          }
        }
        defaults = Array.from(map.entries()).map(([fixture, hrs]) => ({ fixture, ...hrs }))
      }
    } else {
      defaults = await loadFixtureLaborDefaults()
    }
    await loadCostEstimateLaborRowsAndSync(est.id, countRows, defaults)
  }

  async function loadLaborBookVersions() {
    if (!selectedServiceTypeId) return
    
    const { data, error } = await supabase
      .from('labor_book_versions')
      .select('*')
      .eq('service_type_id', selectedServiceTypeId)
      .order('name', { ascending: true })
    if (error) {
      setError(`Failed to load labor book versions: ${error.message}`)
      return
    }
    setLaborBookVersions((data as LaborBookVersion[]) ?? [])
  }

  async function loadLaborBookEntries(versionId: string | null) {
    if (!versionId) {
      setLaborBookEntries([])
      return
    }
    const { data, error } = await supabase
      .from('labor_book_entries')
      .select('*, fixture_types(name)')
      .eq('version_id', versionId)
      .order('sequence_order', { ascending: true })
      .order('fixture_types(name)', { ascending: true })
    if (error) {
      setError(`Failed to load labor book entries: ${error.message}`)
      setLaborBookEntries([])
      return
    }
    setLaborBookEntries((data as LaborBookEntry[]) ?? [])
  }

  async function saveBidSelectedLaborBookVersion(bidId: string, versionId: string | null) {
    const { error: err } = await supabase
      .from('bids')
      .update({ selected_labor_book_version_id: versionId })
      .eq('id', bidId)
    if (err) {
      setError(`Failed to save labor book version: ${err.message}`)
      return
    }
    await loadBids()
  }

  async function loadPriceBookVersions() {
    if (!selectedServiceTypeId) return
    
    const { data, error } = await supabase
      .from('price_book_versions')
      .select('*')
      .eq('service_type_id', selectedServiceTypeId)
      .order('name', { ascending: true })
    if (error) {
      setError(`Failed to load price book versions: ${error.message}`)
      return
    }
    setPriceBookVersions((data as PriceBookVersion[]) ?? [])
  }

  async function loadPriceBookEntries(versionId: string | null) {
    if (!versionId) {
      setPriceBookEntries([])
      return
    }
    const { data, error } = await supabase
      .from('price_book_entries')
      .select('*, fixture_types(name)')
      .eq('version_id', versionId)
    if (error) {
      setError(`Failed to load price book entries: ${error.message}`)
      setPriceBookEntries([])
      return
    }
    const entries = (data as PriceBookEntryWithFixture[]) ?? []
    entries.sort((a, b) => (a.fixture_types?.name ?? '').localeCompare(b.fixture_types?.name ?? '', undefined, { numeric: true }))
    setPriceBookEntries(entries)
  }

  async function loadBidPricingAssignments(bidId: string, versionId: string | null, signal?: AbortSignal) {
    if (versionId == null) {
      setBidPricingAssignments([])
      setBidCountRowCustomPrices([])
      setBidCountRowSubmissionHides([])
      return
    }
    try {
      const [assignmentsData, customPricesData, submissionHidesData] = await Promise.all([
        withSupabaseRetry(
          async () => {
            let q = supabase
              .from('bid_pricing_assignments')
              .select('*')
              .eq('bid_id', bidId)
              .eq('price_book_version_id', versionId)
            if (signal && 'abortSignal' in q) q = (q as { abortSignal: (s: AbortSignal) => typeof q }).abortSignal(signal)
            return await q
          },
          'fetch bid pricing assignments'
        ),
        withSupabaseRetry(
          async () => {
            let q = supabase
              .from('bid_count_row_custom_prices')
              .select('*')
              .eq('bid_id', bidId)
              .eq('price_book_version_id', versionId)
            if (signal && 'abortSignal' in q) q = (q as { abortSignal: (s: AbortSignal) => typeof q }).abortSignal(signal)
            return await q
          },
          'fetch bid count row custom prices'
        ),
        withSupabaseRetry(
          async () => {
            let q = supabase
              .from('bid_count_row_submission_hides')
              .select('*')
              .eq('bid_id', bidId)
              .eq('price_book_version_id', versionId)
            if (signal && 'abortSignal' in q) q = (q as { abortSignal: (s: AbortSignal) => typeof q }).abortSignal(signal)
            return await q
          },
          'fetch bid count row submission hides'
        ),
      ])
      setBidPricingAssignments((assignmentsData as BidPricingAssignment[]) ?? [])
      setBidCountRowCustomPrices((customPricesData as BidCountRowCustomPrice[]) ?? [])
      setBidCountRowSubmissionHides((submissionHidesData as BidCountRowSubmissionHide[]) ?? [])
    } catch (e) {
      const isAbort = (x: unknown) =>
        (x && typeof x === 'object' && 'name' in x && (x as { name: string }).name === 'AbortError') ||
        (x instanceof Error && /abort/i.test(x.message))
      if (isAbort(e)) return
      setError(`Failed to load pricing assignments: ${e instanceof Error ? e.message : String(e)}`)
      setBidPricingAssignments([])
      setBidCountRowCustomPrices([])
      setBidCountRowSubmissionHides([])
    }
  }

  async function loadPricingDataForBid(bidId: string, signal?: AbortSignal) {
    const clearPricingState = () => {
      setPricingCountRows([])
      setPricingCostEstimate(null)
      setPricingLaborRows([])
      setPricingMaterialTotalRoughIn(null)
      setPricingMaterialTotalTopOut(null)
      setPricingMaterialTotalTrimSet(null)
      setPricingLaborRate(null)
      setPricingFixtureMaterialsFromTakeoff({})
    }

    try {
    const [countRes, estRes, bidMetaRes, mappingsRes, roughLinesRes] = await Promise.all([
      (() => {
        let q: ReturnType<typeof supabase.from> = supabase.from('bids_count_rows').select('*').eq('bid_id', bidId).order('sequence_order', { ascending: true })
        if (signal && 'abortSignal' in q) q = (q as { abortSignal: (s: AbortSignal) => typeof q }).abortSignal(signal)
        return q
      })(),
      (() => {
        let q: ReturnType<typeof supabase.from> = supabase.from('cost_estimates').select('*').eq('bid_id', bidId)
        if (signal && 'abortSignal' in q) q = (q as { abortSignal: (s: AbortSignal) => typeof q }).abortSignal(signal)
        return q.maybeSingle()
      })(),
      (() => {
        let q: ReturnType<typeof supabase.from> = supabase.from('bids').select('materials_model').eq('id', bidId)
        if (signal && 'abortSignal' in q) q = (q as { abortSignal: (s: AbortSignal) => typeof q }).abortSignal(signal)
        return q.maybeSingle()
      })(),
      (() => {
        let q: ReturnType<typeof supabase.from> = supabase.from('bids_takeoff_template_mappings').select('id, count_row_id, template_id, stage, quantity').eq('bid_id', bidId)
        if (signal && 'abortSignal' in q) q = (q as { abortSignal: (s: AbortSignal) => typeof q }).abortSignal(signal)
        return q
      })(),
      (() => {
        let q: ReturnType<typeof supabase.from> = supabase
          .from('bids_takeoff_rough_part_lines')
          .select('count_row_id, quantity, unit_price')
          .eq('bid_id', bidId)
        if (signal && 'abortSignal' in q) q = (q as { abortSignal: (s: AbortSignal) => typeof q }).abortSignal(signal)
        return q
      })(),
    ])

    if (countRes.error) {
      clearPricingState()
      return
    }
    const countRows = (countRes.data as BidCountRow[]) ?? []
    setPricingCountRows(countRows)

    if (estRes.error || !estRes.data) {
      clearPricingState()
      return
    }
    const est = estRes.data as CostEstimate
    setPricingCostEstimate(est)
    setPricingLaborRate(est.labor_rate != null ? Number(est.labor_rate) : null)

    const mm = normalizeMaterialsModel((bidMetaRes.data as { materials_model?: string } | null)?.materials_model)

    if (mm === 'rough') {
      if (roughLinesRes.error) {
        console.error('Failed to load rough part lines for pricing:', roughLinesRes.error)
      }
      const roughLines =
        (roughLinesRes.data ?? []) as Array<{ count_row_id: string; quantity: number; unit_price: number }>
      const countByRowId = new Map(countRows.map((cr) => [cr.id, cr.count]))
      const roughTotal = sumRoughLinesPreTaxWithCount(roughLines, countByRowId)
      setPricingMaterialTotalRoughIn(roughTotal)
      setPricingMaterialTotalTopOut(null)
      setPricingMaterialTotalTrimSet(null)

      let qLabor: ReturnType<typeof supabase.from> = supabase
        .from('cost_estimate_labor_rows')
        .select('*')
        .eq('cost_estimate_id', est.id)
        .order('sequence_order', { ascending: true })
      if (signal && 'abortSignal' in qLabor)
        qLabor = (qLabor as { abortSignal: (s: AbortSignal) => typeof qLabor }).abortSignal(signal)
      const laborRes = await qLabor
      if (laborRes.error) {
        setPricingLaborRows([])
        setPricingFixtureMaterialsFromTakeoff({})
        return
      }
      setPricingLaborRows((laborRes.data as CostEstimateLaborRow[]) ?? [])

      const fixtureMaterials: Record<string, number> = {}
      for (const countRow of countRows) {
        let sum = 0
        for (const ln of roughLines) {
          if (ln.count_row_id === countRow.id) {
            sum += Number(ln.quantity) * Number(ln.unit_price)
          }
        }
        fixtureMaterials[countRow.id] = sum * roughCountMultiplier(countRow.count)
      }
      if (pricingBidIdRef.current === bidId) {
        setPricingFixtureMaterialsFromTakeoff(fixtureMaterials)
      }
      return
    }

    // Phase 2: parallel fetches (all need est) — Exact materials model
    const loadPOItems = async (poId: string | null) => {
      if (!poId) return []
      let q: ReturnType<typeof supabase.from> = supabase
        .from('purchase_order_items')
        .select('part_id, quantity, price_at_time')
        .eq('purchase_order_id', poId)
      if (signal && 'abortSignal' in q) q = (q as { abortSignal: (s: AbortSignal) => typeof q }).abortSignal(signal)
      const { data, error } = await q
      if (error) return []
      return (data as Array<{ part_id: string; quantity: number; price_at_time: number }>) ?? []
    }
    const [roughTotal, topTotal, trimTotal, laborRes, roughItems, topItems, trimItems] = await Promise.all([
      est.purchase_order_id_rough_in ? loadPOTotal(est.purchase_order_id_rough_in, signal) : Promise.resolve(0),
      est.purchase_order_id_top_out ? loadPOTotal(est.purchase_order_id_top_out, signal) : Promise.resolve(0),
      est.purchase_order_id_trim_set ? loadPOTotal(est.purchase_order_id_trim_set, signal) : Promise.resolve(0),
      (() => {
        let q: ReturnType<typeof supabase.from> = supabase.from('cost_estimate_labor_rows').select('*').eq('cost_estimate_id', est.id).order('sequence_order', { ascending: true })
        if (signal && 'abortSignal' in q) q = (q as { abortSignal: (s: AbortSignal) => typeof q }).abortSignal(signal)
        return q
      })(),
      loadPOItems(est.purchase_order_id_rough_in),
      loadPOItems(est.purchase_order_id_top_out),
      loadPOItems(est.purchase_order_id_trim_set),
    ])

    setPricingMaterialTotalRoughIn(est.purchase_order_id_rough_in ? roughTotal : null)
    setPricingMaterialTotalTopOut(est.purchase_order_id_top_out ? topTotal : null)
    setPricingMaterialTotalTrimSet(est.purchase_order_id_trim_set ? trimTotal : null)

    if (laborRes.error) {
      setPricingLaborRows([])
      setPricingFixtureMaterialsFromTakeoff({})
      return
    }
    setPricingLaborRows((laborRes.data as CostEstimateLaborRow[]) ?? [])

    // Progressive loading: show table with proportional materials immediately; compute per-fixture materials in background
    setPricingFixtureMaterialsFromTakeoff({})

    const partPriceByStage: Record<string, Record<string, number>> = {
      rough_in: Object.fromEntries(roughItems.map((i) => [i.part_id, i.price_at_time])),
      top_out: Object.fromEntries(topItems.map((i) => [i.part_id, i.price_at_time])),
      trim_set: Object.fromEntries(trimItems.map((i) => [i.part_id, i.price_at_time])),
    }
    const mappings = (mappingsRes.data as Array<{ id: string; count_row_id: string; template_id: string; stage: string; quantity: number }>) ?? []

    if (mappings.length > 0) {
      void (async () => {
        // Deduplicate and parallelize expandTemplate
        const uniqueKeys = new Set(mappings.map((m) => `${m.template_id}:${m.quantity}`))
        const cache = new Map<string, Array<{ part_id: string; quantity: number }>>()
        await Promise.all(
          [...uniqueKeys].map(async (key) => {
            const [tid, qtyStr] = key.split(':')
            const qty = Number(qtyStr ?? 0)
            const parts = await expandTemplate(supabase, tid ?? '', qty)
            cache.set(key, parts)
          })
        )

        // Compute fixtureMaterials from cache (sync)
        const fixtureMaterials: Record<string, number> = {}
        for (const countRow of countRows) {
          const rowMappings = mappings.filter((m) => m.count_row_id === countRow.id)
          if (rowMappings.length === 0) continue
          let sum = 0
          for (const m of rowMappings) {
            const parts = cache.get(`${m.template_id}:${m.quantity}`) ?? []
            const priceMap = partPriceByStage[m.stage] ?? {}
            for (const { part_id, quantity } of parts) {
              const price = priceMap[part_id] ?? 0
              sum += quantity * price
            }
          }
          fixtureMaterials[countRow.id] = sum
        }

        if (pricingBidIdRef.current === bidId) {
          setPricingFixtureMaterialsFromTakeoff(fixtureMaterials)
        }
      })()
    }
    } catch (e) {
      const isAbort = (x: unknown) =>
        (x && typeof x === 'object' && 'name' in x && (x as { name: string }).name === 'AbortError') ||
        (x instanceof Error && /abort/i.test(x.message))
      if (isAbort(e)) return
      throw e
    }
  }

  async function saveBidSelectedPriceBookVersion(bidId: string, versionId: string | null) {
    const { error: err } = await supabase
      .from('bids')
      .update({ selected_price_book_version_id: versionId })
      .eq('id', bidId)
    if (err) {
      setError(`Failed to save version: ${err.message}`)
      return
    }
    await loadBids()
  }

  function setCostEstimatePO(stage: 'rough_in' | 'top_out' | 'trim_set', poId: string) {
    if (!costEstimate) return
    const key = stage === 'rough_in' ? 'purchase_order_id_rough_in' : stage === 'top_out' ? 'purchase_order_id_top_out' : 'purchase_order_id_trim_set'
    const id = poId || null
    setCostEstimate((prev) => (prev ? { ...prev, [key]: id } : null))
    if (id) {
      loadPOTotal(id).then((total) => {
        if (stage === 'rough_in') setCostEstimateMaterialTotalRoughIn(total)
        else if (stage === 'top_out') setCostEstimateMaterialTotalTopOut(total)
        else setCostEstimateMaterialTotalTrimSet(total)
      })
    } else {
      if (stage === 'rough_in') setCostEstimateMaterialTotalRoughIn(null)
      else if (stage === 'top_out') setCostEstimateMaterialTotalTopOut(null)
      else setCostEstimateMaterialTotalTrimSet(null)
    }
  }

  function openMaterialsModelSwitch(next: MaterialsModel, sourceTab: 'takeoffs' | 'labor' | 'pricing') {
    const bid = selectedBidForTakeoff ?? selectedBidForCostEstimate ?? selectedBidForPricing
    if (!bid) return
    const current = normalizeMaterialsModel(bid.materials_model)
    if (next === current) return
    setMaterialsModelSwitchModal({ open: true, next, sourceTab })
  }

  async function confirmMaterialsModelSwitch() {
    const next = materialsModelSwitchModal.next
    const bid = selectedBidForTakeoff ?? selectedBidForCostEstimate ?? selectedBidForPricing
    if (!next || !bid) {
      setMaterialsModelSwitchModal({ open: false, next: null, sourceTab: null })
      return
    }
    setMaterialsModelBusy(true)
    setError(null)
    try {
      await withSupabaseRetry(
        async () =>
          supabase
            .from('bids')
            .update({ materials_model: next })
            .eq('id', bid.id),
        'update bid materials_model'
      )
      const rows = await loadBids()
      const fresh = rows.find((b) => b.id === bid.id)
      if (fresh) setSharedBid(fresh)
      if (selectedBidForTakeoff?.id === bid.id) await loadTakeoffCountRows(bid.id)
      if (selectedBidForCostEstimate?.id === bid.id) await loadCostEstimate(bid.id)
      setMaterialsModelSwitchModal({ open: false, next: null, sourceTab: null })
    } catch (e) {
      setError(formatErrorMessage(e, 'Failed to switch materials model'))
    } finally {
      setMaterialsModelBusy(false)
    }
  }

  useEffect(() => {
    if (selectedBidForCounts?.id) loadCountRows(selectedBidForCounts.id)
    else setCountRows([])
  }, [selectedBidForCounts?.id])

  useEffect(() => {
    if (selectedBidForTakeoff?.id) loadTakeoffCountRows(selectedBidForTakeoff.id)
    else {
      setTakeoffCountRows([])
      setTakeoffMappings([])
      setTakeoffRoughPartLines([])
      setTakeoffRoughCatalogLowestByPartId({})
    }
  }, [selectedBidForTakeoff?.id, selectedBidForTakeoff?.materials_model, activeTab])

  useEffect(() => {
    const t = setTimeout(() => {
      if (activeTab === 'takeoffs') {
        loadMaterialTemplates()
        loadDraftPOs()
        loadTakeoffBookVersions()
      }
      if (activeTab === 'pricing' || activeTab === 'cover-letter' || activeTab === 'submission-followup') {
        loadPriceBookVersions()
      }
    }, 80)
    return () => clearTimeout(t)
  }, [activeTab])

  useEffect(() => {
    if (selectedBidForTakeoff?.selected_takeoff_book_version_id != null) {
      setSelectedTakeoffBookVersionId(selectedBidForTakeoff.selected_takeoff_book_version_id)
    } else {
      setSelectedTakeoffBookVersionId(null)
    }
  }, [selectedBidForTakeoff?.id, selectedBidForTakeoff?.selected_takeoff_book_version_id])

  useEffect(() => {
    if (selectedBidForTakeoff && selectedBidForTakeoff.selected_takeoff_book_version_id == null && takeoffBookVersions.length > 0) {
      const defaultVer = takeoffBookVersions.find((v) => v.name === 'Default')
      if (defaultVer) {
        setSelectedTakeoffBookVersionId(defaultVer.id)
        saveBidSelectedTakeoffBookVersion(selectedBidForTakeoff.id, defaultVer.id)
      }
    }
  }, [selectedBidForTakeoff?.id, selectedBidForTakeoff?.selected_takeoff_book_version_id, takeoffBookVersions])

  useEffect(() => {
    if (!takeoffBookEntriesVersionId) {
      setTakeoffBookEntries([])
      return
    }
    loadTakeoffBookEntries(takeoffBookEntriesVersionId)
  }, [takeoffBookEntriesVersionId])

  useEffect(() => {
    if (activeTab === 'labor' || activeTab === 'takeoffs') {
      const t = setTimeout(() => {
        loadPurchaseOrdersForCostEstimate()
        loadLaborBookVersions()
      }, 80)
      return () => clearTimeout(t)
    }
  }, [activeTab])

  useEffect(() => {
    if (!laborBookEntriesVersionId) {
      setLaborBookEntries([])
      return
    }
    loadLaborBookEntries(laborBookEntriesVersionId)
  }, [laborBookEntriesVersionId])

  useEffect(() => {
    if ((activeTab !== 'pricing' && activeTab !== 'cover-letter') || !selectedBidForPricing?.id) {
      pricingBidIdRef.current = null
      setBidPricingAssignments([])
      setBidCountRowCustomPrices([])
      setBidCountRowSubmissionHides([])
      setPricingCountRows([])
      setPricingCostEstimate(null)
      setPricingLaborRows([])
      setPricingMaterialTotalRoughIn(null)
      setPricingMaterialTotalTopOut(null)
      setPricingMaterialTotalTrimSet(null)
      setPricingLaborRate(null)
      return
    }
    const controller = new AbortController()
    const signal = controller.signal
    const bidId = selectedBidForPricing.id
    const bidJustChanged = pricingBidIdRef.current !== bidId
    let versionId: string | null
    if (bidJustChanged) {
      pricingBidIdRef.current = bidId
      const savedVersionId = selectedBidForPricing.selected_price_book_version_id
      if (savedVersionId) {
        setSelectedPricingVersionId(savedVersionId)
        versionId = savedVersionId
      } else if (priceBookVersions.length > 0) {
        // Auto-select "Default" if it exists, otherwise first version
        const defaultVersion = priceBookVersions.find((v) => v.name === 'Default')
        const versionToUse = defaultVersion ?? priceBookVersions[0]
        setSelectedPricingVersionId(versionToUse?.id ?? null)
        versionId = versionToUse?.id ?? null
      } else {
        setSelectedPricingVersionId(null)
        versionId = null
      }
    } else {
      versionId = selectedPricingVersionId
    }
    loadBidPricingAssignments(bidId, versionId, signal)
    loadPricingDataForBid(bidId, signal)
    return () => controller.abort()
  }, [
    activeTab,
    selectedBidForPricing?.id,
    selectedBidForPricing?.selected_price_book_version_id,
    selectedBidForPricing?.materials_model,
    selectedPricingVersionId,
    priceBookVersions,
  ])

  useEffect(() => {
    if (activeTab !== 'pricing' && activeTab !== 'labor' && activeTab !== 'bid-costs') return
    loadTeamLaborDataForBids(supabase).then(setTeamLaborDataForBids).catch(() => setTeamLaborDataForBids([]))
  }, [activeTab])

  useEffect(() => {
    if (!selectedPricingVersionId) {
      setPriceBookEntries([])
      return
    }
    loadPriceBookEntries(selectedPricingVersionId)
  }, [selectedPricingVersionId])

  return {
    // counts
    countRows,
    setCountRows,
    skipNextLoadCountRowsRef,
    // takeoffs
    takeoffCountRows,
    setTakeoffCountRows,
    takeoffMappings,
    setTakeoffMappings,
    takeoffRoughPartLines,
    setTakeoffRoughPartLines,
    takeoffRoughCatalogLowestByPartId,
    setTakeoffRoughCatalogLowestByPartId,
    materialsModelSwitchModal,
    setMaterialsModelSwitchModal,
    materialsModelBusy,
    setMaterialsModelBusy,
    materialTemplates,
    setMaterialTemplates,
    draftPOs,
    setDraftPOs,
    takeoffBookVersions,
    setTakeoffBookVersions,
    takeoffBookEntries,
    setTakeoffBookEntries,
    selectedTakeoffBookVersionId,
    setSelectedTakeoffBookVersionId,
    takeoffBookEntriesVersionId,
    setTakeoffBookEntriesVersionId,
    // labor (cost estimate)
    costEstimate,
    setCostEstimate,
    costEstimateLaborRows,
    setCostEstimateLaborRows,
    costEstimateCountRows,
    setCostEstimateCountRows,
    purchaseOrdersForCostEstimate,
    setPurchaseOrdersForCostEstimate,
    costEstimateMaterialTotalRoughIn,
    setCostEstimateMaterialTotalRoughIn,
    costEstimateMaterialTotalTopOut,
    setCostEstimateMaterialTotalTopOut,
    costEstimateMaterialTotalTrimSet,
    setCostEstimateMaterialTotalTrimSet,
    laborRateInput,
    setLaborRateInput,
    drivingCostRate,
    setDrivingCostRate,
    hoursPerTrip,
    setHoursPerTrip,
    laborBookVersions,
    setLaborBookVersions,
    laborBookEntries,
    setLaborBookEntries,
    selectedLaborBookVersionId,
    setSelectedLaborBookVersionId,
    laborBookEntriesVersionId,
    setLaborBookEntriesVersionId,
    costEstimateBidIdRef,
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
    // team labor
    teamLaborDataForBids,
    setTeamLaborDataForBids,
    // pricing
    priceBookVersions,
    setPriceBookVersions,
    priceBookEntries,
    setPriceBookEntries,
    bidPricingAssignments,
    setBidPricingAssignments,
    bidCountRowCustomPrices,
    setBidCountRowCustomPrices,
    bidCountRowSubmissionHides,
    setBidCountRowSubmissionHides,
    selectedPricingVersionId,
    setSelectedPricingVersionId,
    pricingBidIdRef,
    pricingCountRows,
    setPricingCountRows,
    pricingCostEstimate,
    setPricingCostEstimate,
    pricingLaborRows,
    setPricingLaborRows,
    pricingMaterialTotalRoughIn,
    setPricingMaterialTotalRoughIn,
    pricingMaterialTotalTopOut,
    setPricingMaterialTotalTopOut,
    pricingMaterialTotalTrimSet,
    setPricingMaterialTotalTrimSet,
    pricingLaborRate,
    setPricingLaborRate,
    pricingFixtureMaterialsFromTakeoff,
    setPricingFixtureMaterialsFromTakeoff,
    // loaders / mutators
    loadCountRows,
    refreshAfterCountsChange,
    loadTakeoffCountRows,
    loadMaterialTemplates,
    loadDraftPOs,
    loadTakeoffBookVersions,
    loadTakeoffBookEntries,
    saveBidSelectedTakeoffBookVersion,
    loadPurchaseOrdersForCostEstimate,
    loadPOTotal,
    loadCostEstimate,
    loadCostEstimateCountRows,
    loadFixtureLaborDefaults,
    loadCostEstimateLaborRowsAndSync,
    ensureCostEstimateForBid,
    loadCostEstimateData,
    loadLaborBookVersions,
    loadLaborBookEntries,
    saveBidSelectedLaborBookVersion,
    loadPriceBookVersions,
    loadPriceBookEntries,
    loadBidPricingAssignments,
    loadPricingDataForBid,
    saveBidSelectedPriceBookVersion,
    setCostEstimatePO,
    openMaterialsModelSwitch,
    confirmMaterialsModelSwitch,
  }
}
