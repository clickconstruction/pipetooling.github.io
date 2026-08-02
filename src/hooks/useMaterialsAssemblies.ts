import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import { fetchPricesForParts } from '../lib/materials/partPrices'
import type { PartType, PartWithPrices } from './useMaterialsCatalog'

type MaterialPart = Database['public']['Tables']['material_parts']['Row']
export type MaterialTemplate = Database['public']['Tables']['material_templates']['Row']
type MaterialTemplateItem = Database['public']['Tables']['material_template_items']['Row']

export type TemplateItemWithDetails = MaterialTemplateItem & {
  part?: MaterialPart & { part_type?: PartType; prices?: PartWithPrices['prices'] }
  nested_template?: MaterialTemplate
}

/**
 * The Materials page's assembly-cluster engine (docs/MATERIALS_TABS_ARCHITECTURE.md
 * seam #3): templates cache, the shared selection (`selectedTemplate` +
 * `templateItems` — the working selection of BOTH Assembly Book and PO Builder),
 * shared filters (whose state deliberately carries over between the two tabs —
 * preserve-quirk #7, including the single dropdown ref both tabs render), and
 * the stats caches feeding cost roll-ups and unpriced badges.
 */
export function useMaterialsAssemblies({
  selectedServiceTypeId,
  setError,
}: {
  selectedServiceTypeId: string
  setError: (message: string | null) => void
}) {
  const [materialTemplates, setMaterialTemplates] = useState<MaterialTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<MaterialTemplate | null>(null)
  const [templateSearchQuery, setTemplateSearchQuery] = useState('')
  const [filterAssemblyTypeIds, setFilterAssemblyTypeIds] = useState<string[]>([])
  const [filterIncludeEmpty, setFilterIncludeEmpty] = useState(false)
  const [filterAssemblyTypeDropdownOpen, setFilterAssemblyTypeDropdownOpen] = useState(false)
  const [templateItems, setTemplateItems] = useState<TemplateItemWithDetails[]>([])
  const [allTemplateItemsForStats, setAllTemplateItemsForStats] = useState<Array<{ template_id: string; item_type: string; part_id: string | null; nested_template_id: string | null; quantity: number }>>([])
  const [partIdToLowestPrice, setPartIdToLowestPrice] = useState<Record<string, number>>({})
  const filterAssemblyTypeDropdownRef = useRef<HTMLDivElement>(null)

  async function loadMaterialTemplates() {
    if (!selectedServiceTypeId) {
      // No service type selected yet, skip loading
      return
    }
    
    const { data, error } = await supabase
      .from('material_templates')
      .select('*')
      .eq('service_type_id', selectedServiceTypeId)
      .order('name')
    if (error) {
      setError(`Failed to load assemblies: ${error.message}`)
      return
    }
    setMaterialTemplates((data as MaterialTemplate[]) ?? [])
  }


  async function loadTemplateItems(templateId: string) {
    const { data: itemsData, error: itemsError } = await supabase
      .from('material_template_items')
      .select('*')
      .eq('template_id', templateId)
      .order('sequence_order', { ascending: true })
    
    if (itemsError) {
      setError(`Failed to load assembly items: ${itemsError.message}`)
      return
    }

    const items = (itemsData as MaterialTemplateItem[]) ?? []
    const partIds = [...new Set(items.filter(i => i.item_type === 'part' && i.part_id).map(i => i.part_id as string))]
    const nestedTemplateIds = [...new Set(items.filter(i => i.item_type === 'template' && i.nested_template_id).map(i => i.nested_template_id as string))]

    // Batch-fetch parts, prices, and nested templates
    const [partsResult, pricesByPartId, templatesResult] = await Promise.all([
      partIds.length > 0
        ? supabase.from('material_parts').select('*, part_types(*)').in('id', partIds)
        : Promise.resolve({ data: [] }),
      partIds.length > 0 ? fetchPricesForParts(supabase, partIds) : Promise.resolve(new Map()),
      nestedTemplateIds.length > 0
        ? supabase.from('material_templates').select('*').in('id', nestedTemplateIds)
        : Promise.resolve({ data: [] }),
    ])

    const partsMap = new Map<string, MaterialPart & { part_type?: PartType; prices?: PartWithPrices['prices'] }>()
    const rawParts = (partsResult.data as (MaterialPart & { part_types?: PartType })[]) ?? []
    for (const p of rawParts) {
      const part: MaterialPart & { part_type?: PartType; prices?: PartWithPrices['prices'] } = {
        ...p,
        part_type: p.part_types,
        prices: pricesByPartId.get(p.id) ?? [],
      }
      partsMap.set(p.id, part)
    }

    const templatesMap = new Map<string, MaterialTemplate>()
    const templates = (templatesResult.data as MaterialTemplate[]) ?? []
    for (const t of templates) {
      templatesMap.set(t.id, t)
    }

    const itemsWithDetails: TemplateItemWithDetails[] = items.map(item => {
      if (item.item_type === 'part' && item.part_id) {
        const part = partsMap.get(item.part_id)
        return { ...item, part }
      }
      if (item.item_type === 'template' && item.nested_template_id) {
        const nested_template = templatesMap.get(item.nested_template_id)
        return { ...item, nested_template }
      }
      return item
    })

    setTemplateItems(itemsWithDetails)
  }

  async function loadAllTemplateItemsForStats() {
    // Only fetch template items for the selected service type to reduce disk IO
    if (!selectedServiceTypeId) {
      setAllTemplateItemsForStats([])
      setPartIdToLowestPrice({})
      return
    }

    const { data: templateIdsData } = await supabase
      .from('material_templates')
      .select('id')
      .eq('service_type_id', selectedServiceTypeId)
    const templateIds = (templateIdsData ?? []).map(t => t.id)
    if (templateIds.length === 0) {
      setAllTemplateItemsForStats([])
      setPartIdToLowestPrice({})
      return
    }

    const { data, error } = await supabase
      .from('material_template_items')
      .select('template_id, item_type, part_id, nested_template_id, quantity')
      .in('template_id', templateIds)
    if (!error && data) {
      const items = data as Array<{ template_id: string; item_type: string; part_id: string | null; nested_template_id: string | null; quantity: number }>
      setAllTemplateItemsForStats(items)
      const partIds = [...new Set(items.filter(i => i.item_type === 'part' && i.part_id).map(i => i.part_id as string))]
      if (partIds.length > 0) {
        const { data: pricesData } = await supabase
          .from('material_part_prices')
          .select('part_id, price')
          .in('part_id', partIds)
        const map: Record<string, number> = {}
        for (const row of (pricesData ?? []) as { part_id: string; price: number }[]) {
          const pid = row.part_id
          const existing = map[pid]
          if (existing === undefined || row.price < existing) map[pid] = row.price
        }
        setPartIdToLowestPrice(map)
      } else {
        setPartIdToLowestPrice({})
      }
    } else {
      setAllTemplateItemsForStats([])
      setPartIdToLowestPrice({})
    }
  }

  useEffect(() => {
    if (!filterAssemblyTypeDropdownOpen) return
    const onMouseDown = (e: MouseEvent) => {
      if (filterAssemblyTypeDropdownRef.current && !filterAssemblyTypeDropdownRef.current.contains(e.target as Node)) {
        setFilterAssemblyTypeDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [filterAssemblyTypeDropdownOpen])


  return {
    materialTemplates,
    setMaterialTemplates,
    selectedTemplate,
    setSelectedTemplate,
    templateSearchQuery,
    setTemplateSearchQuery,
    filterAssemblyTypeIds,
    setFilterAssemblyTypeIds,
    filterIncludeEmpty,
    setFilterIncludeEmpty,
    filterAssemblyTypeDropdownOpen,
    setFilterAssemblyTypeDropdownOpen,
    filterAssemblyTypeDropdownRef,
    templateItems,
    setTemplateItems,
    allTemplateItemsForStats,
    partIdToLowestPrice,
    loadMaterialTemplates,
    loadTemplateItems,
    loadAllTemplateItemsForStats,
  }
}
