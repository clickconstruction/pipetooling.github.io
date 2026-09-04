import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getTemplatePartsPreview } from '../lib/materialPOUtils'
import { loadPartsCatalog } from '../lib/materials/partsCatalog'
import { normalizeMaterialsModel } from '../lib/bids/bidTakeoffHelpers'
import type { PartType } from '../components/bids/SortableRoughPartLineRow'
import type { Database } from '../types/database'

type SupplyHouse = Database['public']['Tables']['supply_houses']['Row']

/**
 * The parts-catalog substrate of the Takeoffs tab — the T8 seam of
 * docs/BIDS_TAKEOFF_TAB_ARCHITECTURE.md, moved out of BidsTakeoffTab as is
 * (v2.2770): the service type's parts (paged, v2.2755) loaded when the
 * Combined model is active or any assembly-authoring modal is open, the
 * supply houses + part types the modals need, and the exact-model
 * assembly-preview cache filled lazily per mapped template.
 */
export function useTakeoffPartsCatalog<P extends { id: string; name: string }>(args: {
  activeTab: string
  selectedServiceTypeId: string
  selectedBidForTakeoff: { id: string; materials_model: string | null | undefined } | null
  takeoffMappings: ReadonlyArray<{ templateId: string }>
  takeoffAddTemplateModalOpen: boolean
  addPartsToTemplateModalOpen: boolean
  editTemplateModalOpen: boolean
}) {
  const {
    activeTab,
    selectedServiceTypeId,
    selectedBidForTakeoff,
    takeoffMappings,
    takeoffAddTemplateModalOpen,
    addPartsToTemplateModalOpen,
    editTemplateModalOpen,
  } = args
  const [takeoffAddTemplateParts, setTakeoffAddTemplateParts] = useState<P[]>([])
  const [supplyHouses, setSupplyHouses] = useState<SupplyHouse[]>([])
  const [partTypes, setPartTypes] = useState<PartType[]>([])
  const [takeoffTemplatePreviewCache, setTakeoffTemplatePreviewCache] = useState<Record<string, { part_name: string; quantity: number }[] | 'loading' | null>>({})

  async function loadPartTypes() {
    if (!selectedServiceTypeId) {
      setPartTypes([])
      return
    }
    
    const { data, error } = await supabase
      .from('part_types')
      .select('*')
      .eq('service_type_id', selectedServiceTypeId)
      .order('sequence_order', { ascending: true })
    
    if (error) {
      console.error('Failed to load part types:', error)
      setPartTypes([])
      return
    }
    
    setPartTypes((data as unknown as PartType[]) ?? [])
  }

  async function loadSupplyHouses() {
    const { data, error } = await supabase
      .from('supply_houses')
      .select('*')
      .order('name')
    if (error) {
      console.error('Failed to load supply houses:', error)
      return
    }
    setSupplyHouses((data as SupplyHouse[]) ?? [])
  }

  useEffect(() => {
    void loadPartTypes()
    void loadSupplyHouses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedServiceTypeId])

  useEffect(() => {
    if (activeTab !== 'takeoffs' || !selectedServiceTypeId || !selectedBidForTakeoff?.id) return
    if (normalizeMaterialsModel(selectedBidForTakeoff.materials_model) !== 'rough') return
    void (async () => {
      try {
        setTakeoffAddTemplateParts(await loadPartsCatalog<P>(supabase, selectedServiceTypeId))
      } catch (e) {
        console.error('Failed to load the parts catalog:', e)
      }
    })()
  }, [activeTab, selectedBidForTakeoff?.id, selectedBidForTakeoff?.materials_model, selectedServiceTypeId, supabase])

  useEffect(() => {
    if (!takeoffAddTemplateModalOpen && !addPartsToTemplateModalOpen && !editTemplateModalOpen) return
    if (!selectedServiceTypeId) {
      setTakeoffAddTemplateParts([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const rows = await loadPartsCatalog<P>(supabase, selectedServiceTypeId)
        if (!cancelled) setTakeoffAddTemplateParts(rows)
      } catch (e) {
        console.error('Failed to load the parts catalog:', e)
        if (!cancelled) setTakeoffAddTemplateParts([])
      }
    })()
    return () => { cancelled = true }
  }, [takeoffAddTemplateModalOpen, addPartsToTemplateModalOpen, editTemplateModalOpen, selectedServiceTypeId])

  useEffect(() => {
    const idsToLoad = Array.from(
      new Set(takeoffMappings.map((m) => m.templateId).filter(Boolean))
    ).filter((id) => takeoffTemplatePreviewCache[id] === undefined)
    if (idsToLoad.length === 0) return
    setTakeoffTemplatePreviewCache((prev) => {
      const next = { ...prev }
      for (const id of idsToLoad) next[id] = 'loading'
      return next
    })
    for (const tid of idsToLoad) {
      getTemplatePartsPreview(supabase, tid)
        .then((res) => setTakeoffTemplatePreviewCache((p) => ({ ...p, [tid]: res })))
        .catch(() => setTakeoffTemplatePreviewCache((p) => ({ ...p, [tid]: null })))
    }
  }, [takeoffMappings, takeoffTemplatePreviewCache])

  return {
    takeoffAddTemplateParts,
    setTakeoffAddTemplateParts,
    supplyHouses,
    partTypes,
    takeoffTemplatePreviewCache,
    setTakeoffTemplatePreviewCache,
  }
}
