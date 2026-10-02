import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { loadPartsCatalog } from '../lib/materials/partsCatalog'
import type { PartType } from '../components/bids/SortableRoughPartLineRow'
import type { Database } from '../types/database'

type SupplyHouse = Database['public']['Tables']['supply_houses']['Row']

/**
 * The parts-catalog substrate of the Takeoffs tab — the T8 seam of
 * docs/BIDS_TAKEOFF_TAB_ARCHITECTURE.md, moved out of BidsTakeoffTab as is
 * (v2.2770): the service type's parts (paged, v2.2755) loaded when a bid is
 * open on Takeoffs or an assembly-authoring modal is open, and the supply
 * houses + part types the modals need.
 */
export function useTakeoffPartsCatalog<P extends { id: string; name: string }>(args: {
  activeTab: string
  selectedServiceTypeId: string
  selectedBidForTakeoff: { id: string } | null
  takeoffAddTemplateModalOpen: boolean
  editTemplateModalOpen: boolean
}) {
  const {
    activeTab,
    selectedServiceTypeId,
    selectedBidForTakeoff,
    takeoffAddTemplateModalOpen,
    editTemplateModalOpen,
  } = args
  const [takeoffAddTemplateParts, setTakeoffAddTemplateParts] = useState<P[]>([])
  const [supplyHouses, setSupplyHouses] = useState<SupplyHouse[]>([])
  const [partTypes, setPartTypes] = useState<PartType[]>([])

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
    void (async () => {
      try {
        setTakeoffAddTemplateParts(await loadPartsCatalog<P>(supabase, selectedServiceTypeId))
      } catch (e) {
        console.error('Failed to load the parts catalog:', e)
      }
    })()
  }, [activeTab, selectedBidForTakeoff?.id, selectedServiceTypeId, supabase])

  useEffect(() => {
    if (!takeoffAddTemplateModalOpen && !editTemplateModalOpen) return
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
  }, [takeoffAddTemplateModalOpen, editTemplateModalOpen, selectedServiceTypeId])

  return {
    takeoffAddTemplateParts,
    setTakeoffAddTemplateParts,
    supplyHouses,
    partTypes,
  }
}
