import { useEffect, useRef, useState } from 'react'
import { BID_ACTIONS, withBidAction } from '../lib/bids/bidActionHeader'
import { jobScopeRows } from '../lib/bids/alternateAcceptance'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { pickLegacyDataTemplateId } from '../lib/bids/legacyTemplatePricing'
import { BID_UPDATE_NOT_APPLIED_MESSAGE, bidUpdateRefused } from '../lib/bids/updateGuard'
import { updateRefused } from '../lib/refusedWrite'
import type { RoughLineDbRow } from '../lib/bids/takeoffOrderRounding'
import { combinedMaterials } from '../lib/bids/bidMaterials'
import { loadTeamLaborDataForBids, type TeamLaborBidRow } from '../utils/teamLabor'
import { loadBidAssignedCosts } from '../lib/bids/loadBidAssignedCosts'
import type { BidAssignedCosts } from '../lib/bids/bidAssignedCosts'
import { pickActiveVersion, deriveActivePricingId, coverLetterPricingTarget, resolveTaggedVersion, versionSwitchStillActive } from '../lib/bids/pickActiveVersion'
import { STAR_NOT_OWN_PRICE_MESSAGE, starWriteAllowed } from '../lib/bids/versionStar'
import { IDLE_PRICING_RESOLVE, beginPricingResolve, settlePricingResolve, type PricingResolveState } from '../lib/bids/pricingResolve'
import { shouldMintCostEstimateOnLoad } from '../lib/bids/laborTabLoadGate'
import { laborHoursOf, planLaborSync } from '../lib/bids/laborSyncPlan'
import { pickDefaultPriceBookTemplateId } from '../lib/bids/pickDefaultPriceBookTemplateId'
import { fetchLastPriceBookTemplateId, saveLastPriceBookTemplateId } from '../lib/bids/pricingUserPrefs'
import type { BidCountRow } from '../types/bids'
import type { BidWithBuilder } from '../types/bidWithBuilder'
import type {
  MaterialTemplateWithAssemblyType,
  CostEstimate,
  CostEstimateLaborRow,
  CostEstimateUnmatchedLaborRow,
  CostEstimateEquipmentRow,
  CostEstimatePermitRow,
  CostEstimateSubcontractorRow,
  CostEstimateWasteRow,
  CostEstimateOtherRow,
  FixtureLaborDefault,
  LaborBookVersion,
  LaborBookEntry,
  LaborBookEntryWithFixture,
  PriceBookVersion,
  BidVersion,
  PriceBookEntryWithFixture,
  BidPricingAssignment,
  BidCountRowCustomPrice,
  BidCountRowSubmissionHide,
  TakeoffBookVersion,
  TakeoffBookEntry,
  TakeoffBookEntryItem,
  TakeoffBookEntryWithItems,
  TakeoffRoughPartLineRow,
} from '../lib/bids/bidPricingEngineTypes'
import { asLaborEntryKind, asLaborUnit, type LaborEntryKind, type LaborUnit } from '../lib/bids/laborBookMatch'

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
  } = deps

  // --- Counts ---
  const [countRows, setCountRows] = useState<BidCountRow[]>([])
  const skipNextLoadCountRowsRef = useRef(false)

  // --- Takeoffs ---
  const [takeoffCountRows, setTakeoffCountRows] = useState<BidCountRow[]>([])
  const [takeoffRoughPartLines, setTakeoffRoughPartLines] = useState<TakeoffRoughPartLineRow[]>([])
  const [takeoffRoughCatalogLowestByPartId, setTakeoffRoughCatalogLowestByPartId] = useState<
    Record<string, { price: number; supplyHouseName: string }>
  >({})
  const [materialTemplates, setMaterialTemplates] = useState<MaterialTemplateWithAssemblyType[]>([])
  const [takeoffBookVersions, setTakeoffBookVersions] = useState<TakeoffBookVersion[]>([])
  const [takeoffBookEntries, setTakeoffBookEntries] = useState<TakeoffBookEntryWithItems[]>([])
  const [selectedTakeoffBookVersionId, setSelectedTakeoffBookVersionId] = useState<string | null>(null)
  const [takeoffBookEntriesVersionId, setTakeoffBookEntriesVersionId] = useState<string | null>(null)

  // --- Labor (cost estimate) ---
  const [costEstimate, setCostEstimate] = useState<CostEstimate | null>(null)
  const [costEstimateLaborRows, setCostEstimateLaborRows] = useState<CostEstimateLaborRow[]>([])
  const [costEstimateUnmatchedLaborRows, setCostEstimateUnmatchedLaborRows] = useState<CostEstimateUnmatchedLaborRow[]>([])
  const [costEstimateCountRows, setCostEstimateCountRows] = useState<BidCountRow[]>([])
  const [costEstimateMaterialTotalRoughIn, setCostEstimateMaterialTotalRoughIn] = useState<number | null>(null)
  const [costEstimateMaterialTotalTopOut, setCostEstimateMaterialTotalTopOut] = useState<number | null>(null)
  const [costEstimateMaterialTotalTrimSet, setCostEstimateMaterialTotalTrimSet] = useState<number | null>(null)
  // v2.4202: each count row's takeoff materials (rough model) — the Labor card splits materials by alternate from it.
  const [costEstimateFixtureMaterials, setCostEstimateFixtureMaterials] = useState<Record<string, number>>({})
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
  // Equipment & Tool Rental direct cost rows (note + per-stage amounts), edited on
  // the Labor tab; a separate copy is loaded for the Pricing cost breakdown.
  const [costEstimateEquipmentRows, setCostEstimateEquipmentRows] = useState<CostEstimateEquipmentRow[]>([])
  const [pricingEquipmentRows, setPricingEquipmentRows] = useState<CostEstimateEquipmentRow[]>([])
  // Permits, Inspections & Regulatory Fees direct cost rows (same shape as equipment).
  const [costEstimatePermitRows, setCostEstimatePermitRows] = useState<CostEstimatePermitRow[]>([])
  const [pricingPermitRows, setPricingPermitRows] = useState<CostEstimatePermitRow[]>([])
  // Subcontractor Fees direct cost rows (same shape as equipment).
  const [costEstimateSubcontractorRows, setCostEstimateSubcontractorRows] = useState<CostEstimateSubcontractorRow[]>([])
  const [pricingSubcontractorRows, setPricingSubcontractorRows] = useState<CostEstimateSubcontractorRow[]>([])
  // Waste Disposal & Site Cleanup direct cost rows (same shape as equipment).
  const [costEstimateWasteRows, setCostEstimateWasteRows] = useState<CostEstimateWasteRow[]>([])
  const [pricingWasteRows, setPricingWasteRows] = useState<CostEstimateWasteRow[]>([])
  // "Other" direct cost rows (same shape as equipment).
  const [costEstimateOtherRows, setCostEstimateOtherRows] = useState<CostEstimateOtherRow[]>([])
  const [pricingOtherRows, setPricingOtherRows] = useState<CostEstimateOtherRow[]>([])

  // --- Team labor (clocked) used in Pricing cost breakdown ---
  const [teamLaborDataForBids, setTeamLaborDataForBids] = useState<TeamLaborBidRow[]>([])
  // --- Costs assigned to bids (v2.1165 mirrors), shown on the Bid Costs tab ---
  const [bidAssignedCosts, setBidAssignedCosts] = useState<Map<string, BidAssignedCosts>>(new Map())

  // --- Pricing ---
  // `priceBookVersions` holds the SELECTED BID's Pricings (bid-scoped copies). The shared
  // master catalog (bid_id IS NULL) lives in `templatePriceBookVersions` and is shown via
  // the price-book drawer, which edits that catalog only.
  const [priceBookVersions, setPriceBookVersions] = useState<PriceBookVersion[]>([])
  const [templatePriceBookVersions, setTemplatePriceBookVersions] = useState<PriceBookVersion[]>([])
  // Per-user "last selected" price-book template for the current service type (cross-device pref).
  const [userLastPriceBookTemplateId, setUserLastPriceBookTemplateId] = useState<string | null>(null)
  // v2.2720: the price_book_version_id of every assignment / custom-price row on the current bid,
  // loaded only when the bid owns no pricing copy. Lets the fallback prefer the shared template
  // that actually holds a legacy bid's prices over the viewer's last-picked book.
  const [legacyPricingRefs, setLegacyPricingRefs] = useState<{ bidId: string; versionIds: string[] } | null>(null)
  const [priceBookEntries, setPriceBookEntries] = useState<PriceBookEntryWithFixture[]>([])
  const [bidPricingAssignments, setBidPricingAssignments] = useState<BidPricingAssignment[]>([])
  const [bidCountRowCustomPrices, setBidCountRowCustomPrices] = useState<BidCountRowCustomPrice[]>([])
  const [bidCountRowSubmissionHides, setBidCountRowSubmissionHides] = useState<BidCountRowSubmissionHide[]>([])
  const [selectedPricingVersionId, setSelectedPricingVersionId] = useState<string | null>(null)
  const pricingBidIdRef = useRef<string | null>(null)
  // Bid Versions (named variants). The active Version drives BOTH the takeoff and pricing.
  // selectedBidVersionId === null means the bid is unsplit (its takeoff/pricing rows are
  // NULL-version-tagged). The ref mirrors the state so the many takeoff loaders/writers can
  // read the current version without stale closures.
  const [bidVersions, setBidVersions] = useState<BidVersion[]>([])
  // Lifecycle of the per-bid pricing resolve (v2.2367): lets the Pricing surfaces tell
  // "still loading" / "load failed" apart from a genuinely empty bid. The retry tick
  // re-fires the resolve effect after a failure (the failed run never stamps
  // pricingBidIdRef, so the re-run takes the full bid-changed path again).
  const [pricingResolve, setPricingResolve] = useState<PricingResolveState>(IDLE_PRICING_RESOLVE)
  const [pricingResolveRetryTick, setPricingResolveRetryTick] = useState(0)
  // Labor/Takeoffs cost-estimate load lifecycle (J11-F1): which bid `costEstimateCountRows`
  // currently describes. Same shape as `pricingResolve`; the Labor tab renders a skeleton
  // until this settles for the bid on screen, so a stale/empty array never reads as "no fixtures".
  const [costEstimateResolve, setCostEstimateResolve] = useState<PricingResolveState>(IDLE_PRICING_RESOLVE)
  const [selectedBidVersionId, setSelectedBidVersionIdState] = useState<string | null>(null)
  // Tagged with the bid the version belongs to, so a synchronous reader only uses it when it
  // matches the bid being loaded (else falls back to that bid's Base — never another bid's version).
  const selectedBidVersionIdRef = useRef<{ bidId: string; versionId: string | null } | null>(null)
  const takeoffBidIdRef = useRef<string | null>(null)
  function setSelectedBidVersionId(bidId: string, versionId: string | null) {
    selectedBidVersionIdRef.current = { bidId, versionId }
    setSelectedBidVersionIdState(versionId)
  }
  /** The active version for `bidId` from the tagged ref (null when the ref is for another bid). */
  function activeVersionIdForBid(bidId: string): string | null {
    const tagged = selectedBidVersionIdRef.current
    if (import.meta.env.DEV && tagged && tagged.bidId !== bidId) {
      console.warn(`[bidVersion] active-version ref is for bid ${tagged.bidId} but loading ${bidId}; using Base.`)
    }
    return resolveTaggedVersion(tagged, bidId)
  }
  /** Add the active-version scope to a takeoff query (NULL = the unsplit Base rows). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyVersionFilter(q: any, versionId: string | null): any {
    return versionId == null ? q.is('bid_version_id', null) : q.eq('bid_version_id', versionId)
  }
  const [pricingCountRows, setPricingCountRows] = useState<BidCountRow[]>([])
  const [pricingCostEstimate, setPricingCostEstimate] = useState<CostEstimate | null>(null)
  const [pricingLaborRows, setPricingLaborRows] = useState<CostEstimateLaborRow[]>([])
  const [pricingMaterialTotalRoughIn, setPricingMaterialTotalRoughIn] = useState<number | null>(null)
  const [pricingMaterialTotalTopOut, setPricingMaterialTotalTopOut] = useState<number | null>(null)
  const [pricingMaterialTotalTrimSet, setPricingMaterialTotalTrimSet] = useState<number | null>(null)
  const [pricingLaborRate, setPricingLaborRate] = useState<number | null>(null)
  const [pricingFixtureMaterialsFromTakeoff, setPricingFixtureMaterialsFromTakeoff] = useState<Record<string, number>>({})

  async function loadCountRows(bidId: string) {
    // v2.2132: counts belong to the bid's active version (null = unsplit bid).
    const { data, error } = await applyVersionFilter(
      supabase.from('bids_count_rows').select('*').eq('bid_id', bidId),
      activeVersionIdForBid(bidId),
    )
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
    const { data, error } = await applyVersionFilter(supabase.from('bids_count_rows').select('*').eq('bid_id', bidId), activeVersionIdForBid(bidId))
      .order('sequence_order', { ascending: true })
    if (error) {
      setError(`Failed to load count rows: ${error.message}`)
      return
    }
    const rows = (data as BidCountRow[]) ?? []
    setTakeoffCountRows(rows)

    {
      const { data: roughData, error: roughErr } = await applyVersionFilter(
        supabase.from('bids_takeoff_rough_part_lines').select('*').eq('bid_id', bidId),
        activeVersionIdForBid(bidId),
      )
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
        part_id: string | null
        quantity: number
        unit_price: number
        sequence_order: number
        source_material_part_price_id: string | null
        source_template_id: string | null
        order_increment?: number | string | null
        order_increment_unit?: string | null
      }>
      setTakeoffRoughPartLines(
        savedRough.map((r) => ({
          id: r.id,
          countRowId: r.count_row_id,
          partId: r.part_id ?? null,
          quantity: Number(r.quantity),
          unitPrice: Number(r.unit_price),
          sourceMaterialPartPriceId: r.source_material_part_price_id ?? null,
          sourceTemplateId: r.source_template_id ?? null,
          orderIncrement: r.order_increment != null && Number(r.order_increment) > 0 ? Number(r.order_increment) : null,
          orderIncrementUnit: r.order_increment_unit ?? null,
          sequenceOrder: r.sequence_order,
          isSaved: true,
        }))
      )
    }
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
    const { data: rows, error: err } = await supabase
      .from('bids')
      .update({ selected_takeoff_book_version_id: versionId })
      .eq('id', bidId)
      .select('id')
    if (err) {
      setError(`Failed to save takeoff book version: ${err.message}`)
      return
    }
    if (bidUpdateRefused(rows)) {
      setError(BID_UPDATE_NOT_APPLIED_MESSAGE)
      return
    }
    await loadBids()
  }

  async function loadCostEstimate(bidId: string) {
    const { data: existing, error: e } = await supabase.from('cost_estimates').select('*').eq('bid_id', bidId).maybeSingle()
    if (e) {
      setError(`Failed to load labor costs: ${e.message}`)
      setCostEstimate(null)
      return null
    }
    const est = (existing as CostEstimate | null) ?? null
    setCostEstimate(est)
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
      {
        const [{ data: equipRows }, { data: permitRows }, { data: subRows }, { data: wasteRows }, { data: otherRows }] = await Promise.all([
          supabase.from('cost_estimate_equipment_rows').select('*').eq('cost_estimate_id', est.id).order('sequence_order', { ascending: true }),
          supabase.from('cost_estimate_permit_rows').select('*').eq('cost_estimate_id', est.id).order('sequence_order', { ascending: true }),
          supabase.from('cost_estimate_subcontractor_rows').select('*').eq('cost_estimate_id', est.id).order('sequence_order', { ascending: true }),
          supabase.from('cost_estimate_waste_rows').select('*').eq('cost_estimate_id', est.id).order('sequence_order', { ascending: true }),
          supabase.from('cost_estimate_other_rows').select('*').eq('cost_estimate_id', est.id).order('sequence_order', { ascending: true }),
        ])
        setCostEstimateEquipmentRows((equipRows as CostEstimateEquipmentRow[]) ?? [])
        setCostEstimatePermitRows((permitRows as CostEstimatePermitRow[]) ?? [])
        setCostEstimateSubcontractorRows((subRows as CostEstimateSubcontractorRow[]) ?? [])
        setCostEstimateWasteRows((wasteRows as CostEstimateWasteRow[]) ?? [])
        setCostEstimateOtherRows((otherRows as CostEstimateOtherRow[]) ?? [])
      }
      {
        // v2.2988: scope the lines to the active version like the count rows below — an
        // unscoped read summed the other version's lines at ×1 (their count rows are not in the map).
        const [{ data: roughLines }, { data: crsForCount }] = await Promise.all([
          applyVersionFilter(
            supabase
              .from('bids_takeoff_rough_part_lines')
              .select('count_row_id, part_id, quantity, unit_price, order_increment, order_increment_unit')
              .eq('bid_id', bidId),
            activeVersionIdForBid(bidId),
          ),
          applyVersionFilter(supabase.from('bids_count_rows').select('id, count').eq('bid_id', bidId), activeVersionIdForBid(bidId)),
        ])
        const countByRowId = new Map(
          ((crsForCount ?? []) as Array<{ id: string; count: number | null }>).map((r) => [r.id, r.count]),
        )
        // v2.3407: the sticks are in the number — Σ count × qty × price plus the order rounding's extra.
        const combined = combinedMaterials((roughLines ?? []) as RoughLineDbRow[], countByRowId)
        setCostEstimateMaterialTotalRoughIn(combined.total)
        setCostEstimateMaterialTotalTopOut(null)
        setCostEstimateMaterialTotalTrimSet(null)
        // v2.4202: the same number per count row (as the Pricing load keeps it) for the Labor card's split.
        setCostEstimateFixtureMaterials(combined.byCountRowId)
      }
    } else {
      setLaborRateInput('')
      setDrivingCostRate('0.70')
      setHoursPerTrip('2')
      setEstimatorCostPerCount('10')
      setEstimatorCostFlatAmount('')
      setEstimatorCostUseFlat(false)
      setCostEstimateEquipmentRows([])
      setCostEstimatePermitRows([])
      setCostEstimateSubcontractorRows([])
      setCostEstimateWasteRows([])
      setCostEstimateOtherRows([])
      setCostEstimateMaterialTotalRoughIn(null)
      setCostEstimateMaterialTotalTopOut(null)
      setCostEstimateMaterialTotalTrimSet(null)
      setCostEstimateFixtureMaterials({})
    }
    return est
  }

  /** The active version's count rows for the Labor/Takeoffs cost estimate; null when the read failed. */
  async function loadCostEstimateCountRows(bidId: string): Promise<BidCountRow[] | null> {
    const { data, error } = await applyVersionFilter(
      supabase.from('bids_count_rows').select('*').eq('bid_id', bidId),
      activeVersionIdForBid(bidId),
    ).order('sequence_order', { ascending: true })
    if (error) {
      setError(`Failed to load count rows: ${error.message}`)
      setCostEstimateCountRows([])
      return null
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

  /** What a minted labor row takes from the applied book (v2.3291): hours, how to read them, and where they came from. */
  type LaborMintDefault = FixtureLaborDefault & { unit?: LaborUnit; kind?: LaborEntryKind; source?: 'book' | 'alias'; source_note?: string | null }

  /** The labor rows the sync set aside for an estimate, newest first; null when the table cannot be read (before its migration is pushed). */
  async function loadUnmatchedLaborRows(estimateId: string): Promise<CostEstimateUnmatchedLaborRow[] | null> {
    const { data, error } = await supabase
      .from('cost_estimate_labor_rows_unmatched')
      .select('*')
      .eq('cost_estimate_id', estimateId)
      .order('parked_at', { ascending: false })
    if (error) return null
    return (data as CostEstimateUnmatchedLaborRow[]) ?? []
  }

  /**
   * Set a labor row aside: copy it to the unmatched table, then delete it. When the table cannot be
   * read or written (the minutes between this client and its migration), the row is deleted as it
   * was before bid history PR 0b; the ledger still keeps its old values.
   */
  async function parkLaborRow(row: CostEstimateLaborRow, canPark: boolean) {
    if (canPark) {
      const { data: parked, error: parkErr } = await withBidAction(supabase
        .from('cost_estimate_labor_rows_unmatched')
        .insert({ cost_estimate_id: row.cost_estimate_id, fixture: row.fixture, count: row.count, labor_row_id: row.id, ...laborHoursOf(row) })
        .select('id')
        .single(), BID_ACTIONS.laborPark)
      if (!parkErr && parked) {
        const { error: delErr } = await withBidAction(supabase.from('cost_estimate_labor_rows').delete().eq('id', row.id), BID_ACTIONS.laborPark)
        // The row stayed, so its copy goes: one place for the hours, never two.
        if (delErr) await withBidAction(supabase.from('cost_estimate_labor_rows_unmatched').delete().eq('id', (parked as { id: string }).id), BID_ACTIONS.laborPark)
        return
      }
    }
    await withBidAction(supabase.from('cost_estimate_labor_rows').delete().eq('id', row.id), BID_ACTIONS.laborSync)
  }

  /**
   * The Labor tab's load sync (bid history PR 0b, `laborSyncPlan.ts`): a counted fixture with no row
   * takes back its parked row, or a live row renamed only in case, spacing or a group prefix, before
   * the book is asked; a row no counted fixture claims is set aside, not deleted.
   */
  async function loadCostEstimateLaborRowsAndSync(estimateId: string, countRows: BidCountRow[], defaults: LaborMintDefault[]) {
    const { data: laborData, error: laborErr } = await supabase
      .from('cost_estimate_labor_rows')
      .select('*')
      .eq('cost_estimate_id', estimateId)
      .order('sequence_order', { ascending: true })
    if (laborErr) {
      setError(`Failed to load labor rows: ${laborErr.message}`)
      setCostEstimateLaborRows([])
      setCostEstimateUnmatchedLaborRows([])
      return
    }
    const rows = (laborData as CostEstimateLaborRow[]) ?? []
    const parked = await loadUnmatchedLaborRows(estimateId)
    // Labor rows are keyed by fixture NAME. Since v2.4188 one name may sit on two count rows (the
    // base bid and an alternate group), so the plan sums their counts onto the one labor row.
    const plan = planLaborSync({ countRows, laborRows: rows, parkedRows: parked ?? [] })

    // The sync's writes are the app's own, not the viewer's (bid history, PR 1b), each tagged with what it did.
    for (const r of plan.renames) {
      await withBidAction(supabase.from('cost_estimate_labor_rows').update({ fixture: r.fixture, count: r.count }).eq('id', r.id), BID_ACTIONS.laborRename)
    }
    for (const p of plan.parks) {
      const row = rows.find((l) => l.id === p.id)
      if (row) await parkLaborRow(row, parked != null)
    }

    // Rows to add, in count-row order: a parked row taken back, else the book's hours.
    const countOrder = new Map<string, number>()
    countRows.forEach((r, i) => { if (!countOrder.has(r.fixture ?? '')) countOrder.set(r.fixture ?? '', i) })
    const adds = [
      ...plan.takeBacks.map((t) => ({ fixture: t.fixture, count: t.count, parkedId: t.parkedId as string | null })),
      ...plan.mints.map((m) => ({ fixture: m.fixture, count: m.count, parkedId: null as string | null })),
    ].sort((a, b) => (countOrder.get(a.fixture) ?? 0) - (countOrder.get(b.fixture) ?? 0))
    let seq = rows.length === 0 ? 0 : Math.max(...rows.map((r) => r.sequence_order))
    for (const add of adds) {
      const p = add.parkedId ? parked?.find((x) => x.id === add.parkedId) : undefined
      if (p) {
        const { data: back, error: backErr } = await withBidAction(supabase
          .from('cost_estimate_labor_rows')
          .insert({ cost_estimate_id: estimateId, fixture: add.fixture, count: add.count, sequence_order: ++seq, ...laborHoursOf(p) })
          .select('id')
          .single(), BID_ACTIONS.laborTakeBack)
        if (!backErr && back) {
          await withBidAction(supabase.from('cost_estimate_labor_rows_unmatched').delete().eq('id', p.id), BID_ACTIONS.laborTakeBack)
          continue
        }
      }
      const def = defaults.find((d) => d.fixture.toLowerCase() === add.fixture.toLowerCase())
      // If not found in primary defaults (labor book), fall back to fixture_labor_defaults
      let hours = { rough_in_hrs: 0, top_out_hrs: 0, trim_set_hrs: 0 }
      // How the row reads and where its hours came from (v2.3291); a zero row says nothing.
      let reading: { unit: LaborUnit; kind: 'fixture' | 'task'; source: 'book' | 'alias' | null; source_note: string | null } = { unit: 'each', kind: 'fixture', source: null, source_note: null }
      if (def) {
        hours = { rough_in_hrs: def.rough_in_hrs, top_out_hrs: def.top_out_hrs, trim_set_hrs: def.trim_set_hrs }
        reading = { unit: def.unit ?? 'each', kind: def.kind ?? 'fixture', source: def.source ?? 'book', source_note: def.source_note ?? null }
      } else {
        // Load from fixture_labor_defaults as fallback
        const { data: fallbackData } = await supabase
          .from('fixture_labor_defaults')
          .select('*')
          .ilike('fixture', add.fixture)
          .limit(1)
          .maybeSingle()
        if (fallbackData) {
          hours = {
            rough_in_hrs: Number(fallbackData.rough_in_hrs),
            top_out_hrs: Number(fallbackData.top_out_hrs),
            trim_set_hrs: Number(fallbackData.trim_set_hrs)
          }
          reading = { unit: 'each', kind: 'fixture', source: 'book', source_note: 'fixture defaults' }
        }
      }
      const hasHours = hours.rough_in_hrs > 0 || hours.top_out_hrs > 0 || hours.trim_set_hrs > 0

      await withBidAction(supabase
        .from('cost_estimate_labor_rows')
        .insert({
          cost_estimate_id: estimateId,
          fixture: add.fixture,
          count: add.count,
          rough_in_hrs_per_unit: hours.rough_in_hrs,
          top_out_hrs_per_unit: hours.top_out_hrs,
          trim_set_hrs_per_unit: hours.trim_set_hrs,
          sequence_order: ++seq,
          is_fixed: reading.kind === 'task',
          kind: reading.kind,
          unit: reading.unit,
          source: hasHours ? reading.source : null,
          source_note: hasHours ? reading.source_note : null,
        })
        .select('*')
        .single(), BID_ACTIONS.laborSync)
    }
    for (const u of plan.countUpdates) {
      await withBidAction(supabase.from('cost_estimate_labor_rows').update({ count: u.count }).eq('id', u.id), BID_ACTIONS.laborSync)
    }
    const { data: refetched } = await supabase
      .from('cost_estimate_labor_rows')
      .select('*')
      .eq('cost_estimate_id', estimateId)
      .order('sequence_order', { ascending: true })
    setCostEstimateLaborRows((refetched as CostEstimateLaborRow[]) ?? [])
    // Read the set-aside rows again only when this sync moved some; otherwise the first read stands.
    const movedAside = parked != null && (plan.parks.length > 0 || plan.takeBacks.length > 0)
    setCostEstimateUnmatchedLaborRows((movedAside ? await loadUnmatchedLaborRows(estimateId) : parked) ?? [])
  }

  /** The Labor tab's band: Use for <fixture> puts a set-aside row's hours on a counted row, and the set-aside row goes. */
  async function applyUnmatchedLaborRow(parkedId: string, laborRowId: string): Promise<boolean> {
    const p = costEstimateUnmatchedLaborRows.find((r) => r.id === parkedId)
    if (!p) return false
    const hours = laborHoursOf(p)
    const { data: used, error: useErr } = await withBidAction(supabase
      .from('cost_estimate_labor_rows')
      .update(hours)
      .eq('id', laborRowId)
      .select('id'), BID_ACTIONS.laborUseParked)
    if (useErr || updateRefused(used, 'cost_estimate_labor_rows')) {
      setError(useErr ? `Could not use those hours: ${useErr.message}` : BID_UPDATE_NOT_APPLIED_MESSAGE)
      return false
    }
    setCostEstimateLaborRows((prev) => prev.map((r) => (r.id === laborRowId ? { ...r, ...hours } : r)))
    const { data: gone, error: goneErr } = await withBidAction(supabase
      .from('cost_estimate_labor_rows_unmatched')
      .delete()
      .eq('id', parkedId)
      .select('id'), BID_ACTIONS.laborUseParked)
    if (!goneErr && !updateRefused(gone, 'cost_estimate_labor_rows_unmatched', 'delete')) setCostEstimateUnmatchedLaborRows((prev) => prev.filter((r) => r.id !== parkedId))
    return true
  }

  /** The Labor tab's band: Remove lets a set-aside row go (the ledger and Recently deleted keep it). */
  async function removeUnmatchedLaborRow(parkedId: string): Promise<boolean> {
    const { data: gone, error } = await supabase
      .from('cost_estimate_labor_rows_unmatched')
      .delete()
      .eq('id', parkedId)
      .select('id')
    if (error || updateRefused(gone, 'cost_estimate_labor_rows_unmatched', 'delete')) {
      setError(error ? `Could not remove those hours: ${error.message}` : BID_UPDATE_NOT_APPLIED_MESSAGE)
      return false
    }
    setCostEstimateUnmatchedLaborRows((prev) => prev.filter((r) => r.id !== parkedId))
    return true
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
        setError(`Failed to create labor costs: ${insErr.message}`)
        return null
      }
      est = inserted as CostEstimate
      setCostEstimate(est)
    }
    return est
  }

  /** Settle the Labor/Takeoffs load for `bidId` (a late settle for a bid the user left is ignored). */
  function settleCostEstimateLoad(bidId: string, ok: boolean) {
    setCostEstimateResolve((prev) => settlePricingResolve(prev.bidId === bidId ? prev : beginPricingResolve(bidId), bidId, ok))
  }

  /**
   * Load the cost estimate the Labor (and Takeoffs) tab renders for `bidId`.
   *
   * Callers must have the active-version ref resolved for this bid first (the Labor
   * effect in Bids.tsx gates on `shouldLoadCostEstimate`); otherwise the count-rows read
   * filters on the wrong version and comes back empty. Minting: a `cost_estimates` row is
   * created only when the resolved version has count rows — the HOURS table is built from
   * `cost_estimate_labor_rows`, which need the parent row, and Pricing reads those rows for
   * its margins. A bid with no fixtures gets no row just for being opened; the first write
   * (`ensureCostEstimateForBid` from PO creation, or a later sync once fixtures exist)
   * mints it.
   */
  async function loadCostEstimateData(bidId: string, laborBookVersionId: string | null) {
    setCostEstimateResolve((prev) => (prev.bidId === bidId ? prev : beginPricingResolve(bidId)))
    const countRows = await loadCostEstimateCountRows(bidId)
    if (countRows == null) {
      setCostEstimateLaborRows([])
      setCostEstimateUnmatchedLaborRows([])
      settleCostEstimateLoad(bidId, false)
      return
    }
    if (!shouldMintCostEstimateOnLoad({ rowCount: countRows.length })) {
      setCostEstimateLaborRows([])
      setCostEstimateUnmatchedLaborRows([])
      await loadCostEstimate(bidId)
      settleCostEstimateLoad(bidId, true)
      return
    }
    const est = await ensureCostEstimateForBid(bidId)
    if (!est) {
      settleCostEstimateLoad(bidId, false)
      return
    }
    let defaults: LaborMintDefault[]
    if (laborBookVersionId) {
      const { data: entries, error } = await supabase
        .from('labor_book_entries')
        .select('*, fixture_types(name)')
        .eq('version_id', laborBookVersionId)
        .order('sequence_order', { ascending: true })
      if (error || !entries?.length) {
        defaults = await loadFixtureLaborDefaults()
      } else {
        const bookName = laborBookVersions.find((v) => v.id === laborBookVersionId)?.name ?? null
        const map = new Map<string, Omit<LaborMintDefault, 'fixture'>>()
        for (const e of entries as (LaborBookEntry & { fixture_types?: { name: string } | null })[]) {
          const primaryName = (e.fixture_types?.name ?? '').trim()
          const base = {
            rough_in_hrs: Number(e.rough_in_hrs),
            top_out_hrs: Number(e.top_out_hrs),
            trim_set_hrs: Number(e.trim_set_hrs),
            unit: asLaborUnit(e.unit),
            kind: asLaborEntryKind(e.kind),
          }
          const primary = primaryName.toLowerCase()
          if (primary && !map.has(primary)) map.set(primary, { ...base, source: 'book', source_note: bookName ? `${primaryName} · ${bookName}` : primaryName })
          for (const name of e.alias_names ?? []) {
            const key = name.trim().toLowerCase()
            if (key && !map.has(key)) map.set(key, { ...base, source: 'alias', source_note: `${primaryName}${bookName ? ` · ${bookName}` : ''} (by alias)` })
          }
        }
        defaults = Array.from(map.entries()).map(([fixture, d]) => ({ fixture, ...d }))
      }
    } else {
      defaults = await loadFixtureLaborDefaults()
    }
    // v2.4211: a declined alternate's rows leave the labor budget once the bid is won.
    await loadCostEstimateLaborRowsAndSync(est.id, jobScopeRows(countRows, selectedBidForCostEstimate), defaults)
    settleCostEstimateLoad(bidId, true)
  }

  async function loadLaborBookVersions() {
    if (!selectedServiceTypeId) return
    
    const { data, error } = await supabase
      .from('labor_book_versions')
      .select('*')
      .eq('service_type_id', selectedServiceTypeId)
      .is('archived_at', null) // v2.3596: a folded human book is archived — hidden from every picker
      .order('is_robot', { ascending: false })
      .order('created_at', { ascending: true })
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
    const { data: rows, error: err } = await supabase
      .from('bids')
      .update({ selected_labor_book_version_id: versionId })
      .eq('id', bidId)
      .select('id')
    if (err) {
      setError(`Failed to save labor book version: ${err.message}`)
      return
    }
    if (bidUpdateRefused(rows)) {
      setError(BID_UPDATE_NOT_APPLIED_MESSAGE)
      return
    }
    await loadBids()
  }

  /** Shared master catalog (bid_id IS NULL) for the current service type — the Templates toggle + clone sources. */
  async function loadTemplatePriceBookVersions() {
    if (!selectedServiceTypeId) return

    const { data, error } = await supabase
      .from('price_book_versions')
      .select('*')
      .eq('service_type_id', selectedServiceTypeId)
      .is('bid_id', null)
      .order('name', { ascending: true })
    if (error) {
      setError(`Failed to load price book templates: ${error.message}`)
      return
    }
    setTemplatePriceBookVersions((data as PriceBookVersion[]) ?? [])
    // Load this user's remembered default template for the same service type, kept in sync with
    // the template list so the fallback resolver (pickDefaultTemplatePricingId) sees both together.
    if (authUser?.id) {
      const prefId = await fetchLastPriceBookTemplateId(authUser.id, selectedServiceTypeId)
      setUserLastPriceBookTemplateId(prefId)
    }
  }

  /** A bid's own Pricings (frozen copies). Sets `priceBookVersions` and returns the list for selection. */
  /** Null return = the fetch failed (state untouched) — the resolve effect turns that into the error panel. */
  async function loadBidPricings(bidId: string): Promise<PriceBookVersion[] | null> {
    const { data, error } = await supabase
      .from('price_book_versions')
      .select('*')
      .eq('bid_id', bidId)
      .order('sort_order', { ascending: true })
    if (error) {
      setError(`Failed to load bid pricings: ${error.message}`)
      return null
    }
    const pricings = (data as PriceBookVersion[]) ?? []
    setPriceBookVersions(pricings)
    return pricings
  }

  /** A bid's named Versions (variants). Returns the list for active-version resolution. */
  /** The version's own ★ scenario id (v2.2117; column arrives with the F1 migration — absent on older rows). */
  function versionStarredId(versions: BidVersion[], versionId: string | null): string | null {
    if (!versionId) return null
    return versions.find((x) => x.id === versionId)?.starred_price_book_version_id ?? null
  }

  /** Null return = the fetch failed (state untouched) — the resolve effect turns that into the error panel. */
  async function loadBidVersions(bidId: string): Promise<BidVersion[] | null> {
    const { data, error } = await supabase
      .from('bid_versions')
      .select('*')
      .eq('bid_id', bidId)
      .order('sort_order', { ascending: true })
    if (error) {
      setError(`Failed to load bid versions: ${error.message}`)
      return null
    }
    const versions = (data as BidVersion[]) ?? []
    setBidVersions(versions)
    return versions
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

  /**
   * v2.2720: which pricing versions this bid's assignment / custom-price rows point at. Cheap
   * (ids only) and non-fatal — a failure just means the fallback behaves as before.
   */
  async function loadLegacyPricingRefs(bidId: string, signal?: AbortSignal): Promise<string[]> {
    try {
      const [a, c] = await Promise.all([
        withSupabaseRetry(
          async () => {
            let q = supabase.from('bid_pricing_assignments').select('price_book_version_id').eq('bid_id', bidId)
            if (signal && 'abortSignal' in q) q = (q as { abortSignal: (s: AbortSignal) => typeof q }).abortSignal(signal)
            return await q
          },
          'fetch bid pricing version refs',
        ),
        withSupabaseRetry(
          async () => {
            let q = supabase.from('bid_count_row_custom_prices').select('price_book_version_id').eq('bid_id', bidId)
            if (signal && 'abortSignal' in q) q = (q as { abortSignal: (s: AbortSignal) => typeof q }).abortSignal(signal)
            return await q
          },
          'fetch bid custom price version refs',
        ),
      ])
      const rows = [...((a as { price_book_version_id: string | null }[] | null) ?? []), ...((c as { price_book_version_id: string | null }[] | null) ?? [])]
      const versionIds = rows.map((r) => r.price_book_version_id).filter((id): id is string => !!id)
      if (!signal?.aborted) setLegacyPricingRefs({ bidId, versionIds })
      return versionIds
    } catch {
      return []
    }
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
      setPricingEquipmentRows([])
      setPricingPermitRows([])
      setPricingSubcontractorRows([])
      setPricingWasteRows([])
      setPricingOtherRows([])
      setPricingMaterialTotalRoughIn(null)
      setPricingMaterialTotalTopOut(null)
      setPricingMaterialTotalTrimSet(null)
      setPricingLaborRate(null)
      setPricingFixtureMaterialsFromTakeoff({})
    }

    try {
    const [countRes, estRes, roughLinesRes] = await Promise.all([
      (() => {
        const qBase = applyVersionFilter(supabase.from('bids_count_rows').select('*').eq('bid_id', bidId), activeVersionIdForBid(bidId)).order('sequence_order', { ascending: true })
        const q = signal ? qBase.abortSignal(signal) : qBase
        return q
      })(),
      (() => {
        const qBase = supabase.from('cost_estimates').select('*').eq('bid_id', bidId)
        const q = signal ? qBase.abortSignal(signal) : qBase
        return q.maybeSingle()
      })(),
      (() => {
        const qBase = applyVersionFilter(supabase
          .from('bids_takeoff_rough_part_lines')
          .select('count_row_id, part_id, quantity, unit_price, order_increment, order_increment_unit')
          .eq('bid_id', bidId), activeVersionIdForBid(bidId))
        const q = signal ? qBase.abortSignal(signal) : qBase
        return q
      })(),
    ])

    // PostgREST surfaces an abort as result.error (not a throw), so a doomed
    // run would land here and wipe the state a fresh run just wrote (v2.1763).
    if (signal?.aborted) return

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

    {
      const [{ data: equipRows }, { data: permitRows }, { data: subRows }, { data: wasteRows }, { data: otherRows }] = await Promise.all([
        supabase.from('cost_estimate_equipment_rows').select('*').eq('cost_estimate_id', est.id).order('sequence_order', { ascending: true }),
        supabase.from('cost_estimate_permit_rows').select('*').eq('cost_estimate_id', est.id).order('sequence_order', { ascending: true }),
        supabase.from('cost_estimate_subcontractor_rows').select('*').eq('cost_estimate_id', est.id).order('sequence_order', { ascending: true }),
        supabase.from('cost_estimate_waste_rows').select('*').eq('cost_estimate_id', est.id).order('sequence_order', { ascending: true }),
        supabase.from('cost_estimate_other_rows').select('*').eq('cost_estimate_id', est.id).order('sequence_order', { ascending: true }),
      ])
      setPricingEquipmentRows((equipRows as CostEstimateEquipmentRow[]) ?? [])
      setPricingPermitRows((permitRows as CostEstimatePermitRow[]) ?? [])
      setPricingSubcontractorRows((subRows as CostEstimateSubcontractorRow[]) ?? [])
      setPricingWasteRows((wasteRows as CostEstimateWasteRow[]) ?? [])
      setPricingOtherRows((otherRows as CostEstimateOtherRow[]) ?? [])
    }

    {
      if (roughLinesRes.error) {
        console.error('Failed to load rough part lines for pricing:', roughLinesRes.error)
      }
      const roughLines = (roughLinesRes.data ?? []) as RoughLineDbRow[]
      const countByRowId = new Map(countRows.map((cr) => [cr.id, cr.count]))
      // v2.3407: the sticks are in the number, and each fixture carries its share of the extra
      // so the per-fixture materials still add up to the bid.
      const combined = combinedMaterials(roughLines, countByRowId)
      setPricingMaterialTotalRoughIn(combined.total)
      setPricingMaterialTotalTopOut(null)
      setPricingMaterialTotalTrimSet(null)

      const qLaborBase = supabase
        .from('cost_estimate_labor_rows')
        .select('*')
        .eq('cost_estimate_id', est.id)
        .order('sequence_order', { ascending: true })
      const qLabor = signal ? qLaborBase.abortSignal(signal) : qLaborBase
      const laborRes = await qLabor
      if (signal?.aborted) return
      if (laborRes.error) {
        setPricingLaborRows([])
        setPricingFixtureMaterialsFromTakeoff({})
        return
      }
      setPricingLaborRows((laborRes.data as CostEstimateLaborRow[]) ?? [])

      if (pricingBidIdRef.current === bidId) {
        setPricingFixtureMaterialsFromTakeoff(combined.byCountRowId)
      }
    }
    } catch (e) {
      const isAbort = (x: unknown) =>
        (x && typeof x === 'object' && 'name' in x && (x as { name: string }).name === 'AbortError') ||
        (x instanceof Error && /abort/i.test(x.message))
      if (isAbort(e)) return
      throw e
    }
  }

  /** Save the ★. Resolves false when nothing was saved (the reason is in `error`). */
  async function saveBidSelectedPriceBookVersion(bidId: string, versionId: string | null): Promise<boolean> {
    // The version the save is for, read once: a switch mid-save must not stamp the next version.
    const activeVersionId = resolveTaggedVersion(selectedBidVersionIdRef.current, bidId)
    // v2.4377: a version's ★ is one of its own prices. Ask the database who owns the price —
    // a caller's list can predate the price it just made.
    if (activeVersionId && versionId) {
      const { data: owner, error: ownerErr } = await supabase.from('price_book_versions').select('bid_version_id').eq('id', versionId).maybeSingle()
      if (ownerErr) {
        setError(`Failed to save version: ${ownerErr.message}`)
        return false
      }
      if (!starWriteAllowed({ activeVersionId, pricingId: versionId, pricingBidVersionId: owner ? owner.bid_version_id : undefined })) {
        setError(STAR_NOT_OWN_PRICE_MESSAGE)
        return false
      }
    }
    const { data: rows, error: err } = await supabase
      .from('bids')
      .update({ selected_price_book_version_id: versionId })
      .eq('id', bidId)
      .select('id')
    if (err) {
      setError(`Failed to save version: ${err.message}`)
      return false
    }
    if (bidUpdateRefused(rows)) {
      setError(BID_UPDATE_NOT_APPLIED_MESSAGE)
      return false
    }
    // v2.2117: the ★ is per version. Stamp the active version's own star so switching
    // versions no longer loses it (the bid-level column stays = the active version's ★).
    if (activeVersionId) {
      const { error: starErr } = await supabase.from('bid_versions').update({ starred_price_book_version_id: versionId }).eq('id', activeVersionId)
      if (starErr) {
        setError(`Failed to save version: ${starErr.message}`)
        return false
      }
      await loadBidVersions(bidId)
    }
    await loadBids()
    return true
  }

  /** Persist the bid's active Version (the variant the user is currently on). */
  async function saveBidSelectedBidVersion(bidId: string, versionId: string | null) {
    const { data: rows, error: err } = await supabase
      .from('bids')
      .update({ selected_bid_version_id: versionId })
      .eq('id', bidId)
      .select('id')
    if (err) {
      setError(`Failed to save version: ${err.message}`)
      return
    }
    if (bidUpdateRefused(rows)) {
      setError(BID_UPDATE_NOT_APPLIED_MESSAGE)
      return
    }
    await loadBids()
  }

  /**
   * Switch the active Version: set the version (ref + state, drives takeoff reads), re-derive
   * the active pricing facet, and persist. The pricing/takeoff effects then reload for it.
   * Reloads bid pricings FRESH first — a just-created version's pricing facet isn't in
   * `priceBookVersions` state yet, so deriving from stale state would miss it.
   */
  // The service type's "Default" price book (else the first template) — the last-resort pricing
  // for an unsplit bid that never explicitly picked one (long-standing auto-select behavior).
  function pickDefaultTemplatePricingId(): string | null {
    return pickDefaultPriceBookTemplateId({
      userLastTemplateId: userLastPriceBookTemplateId,
      templates: templatePriceBookVersions,
    })
  }

  /** v2.2720: the shared template holding this bid's legacy rows (see `pickLegacyDataTemplateId`), from explicit refs or the loaded state. */
  function legacyDataTemplateIdFor(refs: string[] | null, pricings: { id: string }[]): string | null {
    const ids = refs ?? (legacyPricingRefs && legacyPricingRefs.bidId === selectedBidForPricing?.id ? legacyPricingRefs.versionIds : [])
    return pickLegacyDataTemplateId({
      referencedVersionIds: ids,
      templateIds: templatePriceBookVersions.map((t) => t.id),
      bidPricingIds: pricings.map((p) => p.id),
    })
  }

  // The default template id (user's last pick → "Default" → first), exposed so the page can feed
  // it to BidVersionPicker's `fallbackPricingSourceId` instead of re-deriving it inline.
  const defaultPriceBookTemplateId = pickDefaultTemplatePricingId()
  // v2.2731: what "+ version" / "+ Add GC" clone from when the bid has no active pricing —
  // the template that actually holds the bid's legacy rows (so the new version carries its
  // prices), else the viewer's default. The "your default for new bids" chip keeps the latter.
  const versionClonePricingSourceId = legacyDataTemplateIdFor(null, priceBookVersions) ?? defaultPriceBookTemplateId

  /** Remember the template the user just chose as their per-service-type default (optimistic + persisted). */
  function rememberLastPriceBookTemplate(templateId: string) {
    if (!authUser?.id || !selectedServiceTypeId) return
    setUserLastPriceBookTemplateId(templateId)
    void saveLastPriceBookTemplateId(authUser.id, selectedServiceTypeId, templateId)
  }

  /** Re-run the failed per-bid pricing resolve (the error panel's Retry). */
  function retryPricingResolve() {
    setPricingResolveRetryTick((t) => t + 1)
  }

  async function switchActiveVersion(bidId: string, versionId: string | null) {
    setSelectedBidVersionId(bidId, versionId)
    const pricings = (await loadBidPricings(bidId)) ?? []
    // Switching twice in a row leaves two of these awaits in flight and they can
    // finish out of order. Only the switch that is still active may write — a
    // stale one would resolve the pricing facet for the version the user already
    // left, and for a split version with no pricing copy that is null by design,
    // so it lands as "no price book" and sticks (the safety net below only
    // re-resolves unsplit bids). The later switch does its own save.
    if (!versionSwitchStillActive(selectedBidVersionIdRef.current, bidId, versionId)) return
    setSelectedPricingVersionId(
      deriveActivePricingId({
        activeVersionId: versionId,
        bidPricings: pricings,
        legacyFallbackPricingId: selectedBidForPricing?.selected_price_book_version_id ?? null,
        legacyDataPricingId: legacyDataTemplateIdFor(null, pricings),
        defaultTemplatePricingId: pickDefaultTemplatePricingId(),
        versionStarredPricingId: versionStarredId(bidVersions, versionId),
      }),
    )
    await saveBidSelectedBidVersion(bidId, versionId)
  }

  useEffect(() => {
    const bid = selectedBidForCounts
    if (!bid?.id) {
      setCountRows([])
      return
    }
    let cancelled = false
    void (async () => {
      // v2.2132: counts are per version — resolve the active version for this bid before loading
      // (landing directly on Counts must show the right bid's rows); a version switch (same bid)
      // re-runs this via selectedBidVersionId.
      if (selectedBidVersionIdRef.current?.bidId !== bid.id) {
        const versions = (await loadBidVersions(bid.id)) ?? []
        if (cancelled) return
        setSelectedBidVersionId(bid.id, pickActiveVersion({ savedVersionId: bid.selected_bid_version_id, bidVersions: versions }))
      }
      if (!cancelled) await loadCountRows(bid.id)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBidForCounts?.id, selectedBidVersionId])

  useEffect(() => {
    const bid = selectedBidForTakeoff
    if (!bid?.id) {
      takeoffBidIdRef.current = null
      setTakeoffCountRows([])
      setTakeoffRoughPartLines([])
      setTakeoffRoughCatalogLowestByPartId({})
      return
    }
    const bidChanged = takeoffBidIdRef.current !== bid.id
    let cancelled = false
    void (async () => {
      // On bid change resolve the active Version + set its ref BEFORE loading takeoff rows
      // (so landing directly on the Takeoff tab shows the right variant). On a version
      // switch (same bid) the ref is already set by the picker — just reload.
      if (bidChanged) {
        takeoffBidIdRef.current = bid.id
        const versions = (await loadBidVersions(bid.id)) ?? []
        if (cancelled) return
        setSelectedBidVersionId(bid.id, pickActiveVersion({ savedVersionId: bid.selected_bid_version_id, bidVersions: versions }))
      }
      await loadTakeoffCountRows(bid.id)
    })()
    return () => {
      cancelled = true
    }
  }, [selectedBidForTakeoff?.id, selectedBidVersionId, activeTab])

  useEffect(() => {
    const t = setTimeout(() => {
      if (activeTab === 'takeoffs') {
        loadMaterialTemplates()
        loadTakeoffBookVersions()
      }
      if (activeTab === 'pricing' || activeTab === 'cover-letter' || activeTab === 'submission-followup') {
        loadTemplatePriceBookVersions()
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
      setPricingEquipmentRows([])
      setPricingPermitRows([])
      setPricingSubcontractorRows([])
      setPricingWasteRows([])
      setPricingOtherRows([])
      setPricingMaterialTotalRoughIn(null)
      setPricingMaterialTotalTopOut(null)
      setPricingMaterialTotalTrimSet(null)
      setPricingLaborRate(null)
      setPricingResolve(IDLE_PRICING_RESOLVE)
      return
    }
    const controller = new AbortController()
    const signal = controller.signal
    const bidId = selectedBidForPricing.id
    const bidJustChanged = pricingBidIdRef.current !== bidId
    if (bidJustChanged) {
      const savedBidVersionId = selectedBidForPricing.selected_bid_version_id
      const legacyPricingFallback = selectedBidForPricing.selected_price_book_version_id
      setPricingResolve(beginPricingResolve(bidId))
      // Resolve the active Version first (it drives both takeoff and pricing), set the
      // version ref BEFORE the takeoff reads in loadPricingDataForBid, then derive the
      // active pricing facet. Unsplit bids resolve to null → reads the Base (NULL) data.
      void (async () => {
        const [versions, pricings] = await Promise.all([loadBidVersions(bidId), loadBidPricings(bidId)])
        if (signal.aborted) return
        if (versions == null || pricings == null) {
          // Fetch failed. The ref stays unstamped so Retry (or any dep change)
          // re-enters this bid-changed path; pre-v2.2367 this fell through as
          // versions=[] and painted the bid as unsplit-and-empty until reload.
          setPricingResolve((s) => settlePricingResolve(s, bidId, false))
          return
        }
        // Stamp the ref only now that this run will actually write the
        // resolution. Stamping before the await (pre-v2.1763) meant an abort —
        // e.g. the takeoff resolver's setSelectedBidVersionId re-firing this
        // effect mid-flight — dropped setSelectedPricingVersionId forever: the
        // re-run saw bidJustChanged=false and reloaded with a null pricing id,
        // the split-bid empty state that only a reload or Version click fixed.
        // v2.2720: an unsplit bid with no copy may still hold rows keyed to a shared template
        // (pre-copy pricing). Find that template before choosing a fallback book.
        const legacyRefs = versions.length === 0 && pricings.length === 0 ? await loadLegacyPricingRefs(bidId, signal) : []
        if (signal.aborted) return
        pricingBidIdRef.current = bidId
        const activeVersionId = pickActiveVersion({ savedVersionId: savedBidVersionId, bidVersions: versions })
        setSelectedBidVersionId(bidId, activeVersionId)
        const activePricingId = deriveActivePricingId({
          activeVersionId,
          bidPricings: pricings,
          legacyFallbackPricingId: legacyPricingFallback,
          legacyDataPricingId: legacyDataTemplateIdFor(legacyRefs, pricings),
          defaultTemplatePricingId: pickDefaultTemplatePricingId(),
          versionStarredPricingId: versionStarredId(versions, activeVersionId),
        })
        setSelectedPricingVersionId(activePricingId)
        await Promise.all([loadBidPricingAssignments(bidId, activePricingId, signal), loadPricingDataForBid(bidId, signal)])
        if (signal.aborted) return
        setPricingResolve((s) => settlePricingResolve(s, bidId, true))
      })()
    } else {
      void (async () => {
        await Promise.all([loadBidPricingAssignments(bidId, selectedPricingVersionId, signal), loadPricingDataForBid(bidId, signal)])
        if (signal.aborted) return
        // The bid-changed run above often gets aborted mid-flight by its own
        // setSelected* writes re-firing this effect — this re-run is the one
        // that actually finishes, so it settles the pending resolve.
        setPricingResolve((s) => settlePricingResolve(s, bidId, true))
      })()
    }
    return () => controller.abort()
  }, [
    activeTab,
    selectedBidForPricing?.id,
    selectedBidForPricing?.selected_bid_version_id,
    selectedBidForPricing?.selected_price_book_version_id,
    selectedBidVersionId,
    selectedPricingVersionId,
    pricingResolveRetryTick,
  ])

  // Workbench view/★ split (v2.2013): the Pricing Workbench lets you VIEW a scenario without
  // changing the bid's saved customer-facing one. Entering the Cover Letter tab re-aligns the
  // working pricing to the ACTIVE version's ★, so what the letter shows is always the ★ — never
  // the stale bid-level ★ of the GC version you switched away from (`coverLetterPricingTarget`).
  useEffect(() => {
    if (activeTab !== 'cover-letter') return
    const bid = selectedBidForPricing
    if (!bid) return
    const versionId = resolveTaggedVersion(selectedBidVersionIdRef.current, bid.id)
    const target = coverLetterPricingTarget({
      activeVersionId: versionId,
      bidPricings: priceBookVersions,
      bidSavedPricingId: bid.selected_price_book_version_id ?? null,
      versionStarredPricingId: versionStarredId(bidVersions, versionId),
      currentPricingId: selectedPricingVersionId,
    })
    if (!target) return
    setSelectedPricingVersionId(target)
    void loadPriceBookEntries(target)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedBidForPricing?.id, selectedBidForPricing?.selected_price_book_version_id, selectedPricingVersionId, selectedBidVersionId, priceBookVersions, bidVersions])

  // Safety net for the resolve-before-templates-loaded race: once the service-type templates
  // arrive, apply the "Default" pricing fallback to an unsplit bid that still has no pricing.
  useEffect(() => {
    if (activeTab !== 'pricing' && activeTab !== 'cover-letter') return
    if (!selectedBidForPricing || selectedPricingVersionId != null || selectedBidVersionId != null) return
    const fallback = deriveActivePricingId({
      activeVersionId: null,
      bidPricings: priceBookVersions,
      legacyFallbackPricingId: selectedBidForPricing.selected_price_book_version_id ?? null,
      legacyDataPricingId: legacyDataTemplateIdFor(null, priceBookVersions),
      defaultTemplatePricingId: pickDefaultTemplatePricingId(),
    })
    if (fallback) setSelectedPricingVersionId(fallback)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, templatePriceBookVersions, userLastPriceBookTemplateId, legacyPricingRefs, selectedPricingVersionId, selectedBidVersionId, selectedBidForPricing?.id])

  useEffect(() => {
    if (activeTab !== 'pricing' && activeTab !== 'labor' && activeTab !== 'bid-costs') return
    loadTeamLaborDataForBids(supabase).then(setTeamLaborDataForBids).catch(() => setTeamLaborDataForBids([]))
  }, [activeTab])

  // Assigned costs are only rendered on Bid Costs, so only load them there.
  useEffect(() => {
    if (activeTab !== 'bid-costs') return
    loadBidAssignedCosts(supabase)
      .then(setBidAssignedCosts)
      .catch(() => setBidAssignedCosts(new Map()))
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
    takeoffRoughPartLines,
    setTakeoffRoughPartLines,
    takeoffRoughCatalogLowestByPartId,
    setTakeoffRoughCatalogLowestByPartId,
    materialTemplates,
    setMaterialTemplates,
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
    costEstimateUnmatchedLaborRows,
    setCostEstimateUnmatchedLaborRows,
    applyUnmatchedLaborRow,
    removeUnmatchedLaborRow,
    costEstimateCountRows,
    setCostEstimateCountRows,
    costEstimateFixtureMaterials,
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
    costEstimateEquipmentRows,
    setCostEstimateEquipmentRows,
    pricingEquipmentRows,
    costEstimatePermitRows,
    setCostEstimatePermitRows,
    pricingPermitRows,
    costEstimateSubcontractorRows,
    setCostEstimateSubcontractorRows,
    pricingSubcontractorRows,
    costEstimateWasteRows,
    setCostEstimateWasteRows,
    pricingWasteRows,
    costEstimateOtherRows,
    setCostEstimateOtherRows,
    pricingOtherRows,
    // team labor
    teamLaborDataForBids,
    bidAssignedCosts,
    setTeamLaborDataForBids,
    // bid versions (named variants)
    bidVersions,
    setBidVersions,
    selectedBidVersionId,
    setSelectedBidVersionId,
    selectedBidVersionIdRef,
    pricingResolve,
    retryPricingResolve,
    costEstimateResolve,
    // pricing
    priceBookVersions,
    setPriceBookVersions,
    templatePriceBookVersions,
    setTemplatePriceBookVersions,
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
    loadTakeoffBookVersions,
    loadTakeoffBookEntries,
    saveBidSelectedTakeoffBookVersion,
    loadCostEstimate,
    loadCostEstimateCountRows,
    loadFixtureLaborDefaults,
    loadCostEstimateLaborRowsAndSync,
    ensureCostEstimateForBid,
    loadCostEstimateData,
    loadLaborBookVersions,
    loadLaborBookEntries,
    saveBidSelectedLaborBookVersion,
    loadTemplatePriceBookVersions,
    defaultPriceBookTemplateId,
    versionClonePricingSourceId,
    rememberLastPriceBookTemplate,
    loadBidPricings,
    loadBidVersions,
    saveBidSelectedBidVersion,
    switchActiveVersion,
    loadPriceBookEntries,
    loadBidPricingAssignments,
    loadPricingDataForBid,
    saveBidSelectedPriceBookVersion,
  }
}
