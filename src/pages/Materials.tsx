import { Fragment, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { addExpandedPartsToPO, expandTemplate } from '../lib/materialPOUtils'
import { useAuth } from '../hooks/useAuth'
import { Database } from '../types/database'
import { PartFormModal } from '../components/PartFormModal'

type SupplyHouse = Database['public']['Tables']['supply_houses']['Row']
type MaterialPart = Database['public']['Tables']['material_parts']['Row']
type MaterialPartPrice = Database['public']['Tables']['material_part_prices']['Row']
type MaterialTemplate = Database['public']['Tables']['material_templates']['Row']
type MaterialTemplateItem = Database['public']['Tables']['material_template_items']['Row']
type PurchaseOrder = Database['public']['Tables']['purchase_orders']['Row']
type PurchaseOrderItem = Database['public']['Tables']['purchase_order_items']['Row']
type UserRole = 'dev' | 'master_technician' | 'assistant' | 'estimator'

interface ServiceType {
  id: string
  name: string
  description: string | null
  color: string | null
  sequence_order: number
  created_at: string
  updated_at: string
}

interface PartType {
  id: string
  service_type_id: string
  name: string
  category: string | null
  sequence_order: number
  created_at: string
  updated_at: string
}

type PartWithPrices = MaterialPart & {
  prices: (MaterialPartPrice & { supply_house: SupplyHouse })[]
  part_type?: PartType
}

type TemplateItemWithDetails = MaterialTemplateItem & {
  part?: MaterialPart
  nested_template?: MaterialTemplate
}

type POItemWithDetails = PurchaseOrderItem & {
  part: MaterialPart
  supply_house?: SupplyHouse
  source_template?: { id: string; name: string } | null
}

type PurchaseOrderWithItems = PurchaseOrder & {
  items: POItemWithDetails[]
}

const PARTS_PAGE_SIZE = 50

function formatCurrency(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function Materials() {
  const { user: authUser } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [myRole, setMyRole] = useState<UserRole | null>(null)
  const [activeTab, setActiveTab] = useState<'price-book' | 'templates-po' | 'purchase-orders'>('price-book')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Service Types state
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
  const [selectedServiceTypeId, setSelectedServiceTypeId] = useState<string>('')
  const [estimatorServiceTypeIds, setEstimatorServiceTypeIds] = useState<string[] | null>(null)

  // Part Types state
  const [partTypes, setPartTypes] = useState<PartType[]>([])

  // Price Book state
  const [parts, setParts] = useState<PartWithPrices[]>([])
  const [supplyHouses, setSupplyHouses] = useState<SupplyHouse[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPartTypeId, setFilterPartTypeId] = useState<string>('')
  const [filterManufacturer, setFilterManufacturer] = useState<string>('')
  const [sortByPriceCountAsc, setSortByPriceCountAsc] = useState(false)
  const [editingPart, setEditingPart] = useState<MaterialPart | null>(null)
  const [partFormOpen, setPartFormOpen] = useState(false)
  const [partFormInitialName, setPartFormInitialName] = useState('')
  const [viewingPartPrices, setViewingPartPrices] = useState<MaterialPart | null>(null)
  const [expandedPartId, setExpandedPartId] = useState<string | null>(null)
  const [partsPage, setPartsPage] = useState(0)
  const [hasMoreParts, setHasMoreParts] = useState(true)
  const [loadingPartsPage, setLoadingPartsPage] = useState(false)
  const loadingPartsRef = useRef(false)
  const [supplyHouseStatsByServiceType, setSupplyHouseStatsByServiceType] = useState<{
    serviceTypes: Array<{
      id: string
      name: string
      totalParts: number
      partsWithPrices: number
      partsWithMultiplePrices: number
    }>
    supplyHouses: Array<{
      id: string
      name: string
      pricesByServiceType: Record<string, number>
    }>
  } | null>(null)

  // Load All Mode state - persisted per user in localStorage, default on
  const LOAD_ALL_MODE_KEY = (uid: string) => `materials_loadAllMode_${uid}`
  const [loadAllMode, setLoadAllMode] = useState(true)
  const [allParts, setAllParts] = useState<PartWithPrices[]>([])
  const [loadingAllParts, setLoadingAllParts] = useState(false)
  const [clientSearchQuery, setClientSearchQuery] = useState('')

  // Supply House Management state
  const [viewingSupplyHouses, setViewingSupplyHouses] = useState(false)
  const [supplyHouseFormOpen, setSupplyHouseFormOpen] = useState(false)
  const [editingSupplyHouse, setEditingSupplyHouse] = useState<SupplyHouse | null>(null)
  const [supplyHouseName, setSupplyHouseName] = useState('')
  const [supplyHouseContactName, setSupplyHouseContactName] = useState('')
  const [supplyHousePhone, setSupplyHousePhone] = useState('')
  const [supplyHouseEmail, setSupplyHouseEmail] = useState('')
  const [supplyHouseAddress, setSupplyHouseAddress] = useState('')
  const [supplyHouseNotes, setSupplyHouseNotes] = useState('')
  const [savingSupplyHouse, setSavingSupplyHouse] = useState(false)

  // Templates & PO Builder state
  const [materialTemplates, setMaterialTemplates] = useState<MaterialTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<MaterialTemplate | null>(null)
  const [templateSearchQuery, setTemplateSearchQuery] = useState('')
  const [templateItems, setTemplateItems] = useState<TemplateItemWithDetails[]>([])
  const [allTemplateItemsForStats, setAllTemplateItemsForStats] = useState<Array<{ template_id: string; item_type: string; part_id: string | null }>>([])
  const [draftPOs, setDraftPOs] = useState<PurchaseOrderWithItems[]>([])
  const [selectedPO, setSelectedPO] = useState<PurchaseOrderWithItems | null>(null)
  const [editingPO, setEditingPO] = useState<PurchaseOrderWithItems | null>(null)
  const [templateFormOpen, setTemplateFormOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<MaterialTemplate | null>(null)
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [addingItemToTemplate, setAddingItemToTemplate] = useState(false)
  const [newItemType, setNewItemType] = useState<'part' | 'template'>('part')
  const [newItemPartId, setNewItemPartId] = useState('')
  const [templatePartSearchQuery, setTemplatePartSearchQuery] = useState('')
  const [templatePartDropdownOpen, setTemplatePartDropdownOpen] = useState(false)
  const [newItemTemplateId, setNewItemTemplateId] = useState('')
  const [newItemQuantity, setNewItemQuantity] = useState('1')
  const [newItemNotes, setNewItemNotes] = useState('')
  const [creatingPOFromTemplate, setCreatingPOFromTemplate] = useState(false)
  const [addingTemplateToPO, setAddingTemplateToPO] = useState(false)
  const [addingPartToPO, setAddingPartToPO] = useState(false)
  const [selectedTemplateForPO, setSelectedTemplateForPO] = useState('')
  const [selectedPartForPO, setSelectedPartForPO] = useState('')
  const [poPartSearchQuery, setPoPartSearchQuery] = useState('')
  const [poPartDropdownOpen, setPoPartDropdownOpen] = useState(false)
  const [partQuantityForPO, setPartQuantityForPO] = useState('1')
  const [editingPOItem, setEditingPOItem] = useState<string | null>(null)
  const [editingPOItemQuantity, setEditingPOItemQuantity] = useState('')
  const [editingPOItemSupplyHouse, setEditingPOItemSupplyHouse] = useState('')
  const [editingPOItemPrice, setEditingPOItemPrice] = useState('')
  const [editingPOItemNotesId, setEditingPOItemNotesId] = useState<string | null>(null)
  const [editingPOItemNotesValue, setEditingPOItemNotesValue] = useState('')
  const [editingPOItemSupplyHouseView, setEditingPOItemSupplyHouseView] = useState<string | null>(null)
  const [availablePricesForItem, setAvailablePricesForItem] = useState<Array<{ price_id: string; supply_house_id: string; supply_house_name: string; price: number }>>([])
  const [loadingAvailablePrices, setLoadingAvailablePrices] = useState(false)
  const [editingPricesByPriceId, setEditingPricesByPriceId] = useState<Record<string, string>>({})
  const [updatingPriceId, setUpdatingPriceId] = useState<string | null>(null)
  const [addPriceSupplyHouseId, setAddPriceSupplyHouseId] = useState('')
  const [addPriceValue, setAddPriceValue] = useState('')
  const [addingNewPrice, setAddingNewPrice] = useState(false)
  const [draftPOSupplyHouseOptionsPartId, setDraftPOSupplyHouseOptionsPartId] = useState<string | null>(null)
  const [draftPOSupplyHouseOptions, setDraftPOSupplyHouseOptions] = useState<Array<{ supply_house_id: string; supply_house_name: string; price: number }>>([])
  const [loadingDraftPOSupplyHouseOptions, setLoadingDraftPOSupplyHouseOptions] = useState(false)
  const [confirmingPriceForItem, setConfirmingPriceForItem] = useState<string | null>(null)
  const [editingPOName, setEditingPOName] = useState<string | null>(null)
  const [editingPONameValue, setEditingPONameValue] = useState('')
  const [duplicatingPO, setDuplicatingPO] = useState<string | null>(null)
  const [addingNotesToPO, setAddingNotesToPO] = useState<string | null>(null)
  const [notesValue, setNotesValue] = useState('')
  const [viewedPOTaxPercent, setViewedPOTaxPercent] = useState('8.25')

  const templatePartPickerRef = useRef<HTMLDivElement>(null)
  const poPartPickerRef = useRef<HTMLDivElement>(null)
  const templateItemsSectionRef = useRef<HTMLDivElement>(null)

  // Purchase Orders state
  const [allPOs, setAllPOs] = useState<PurchaseOrderWithItems[]>([])
  const [userNamesMap, setUserNamesMap] = useState<Record<string, string>>({})
  const [poStatusFilter, setPoStatusFilter] = useState<'all' | 'draft' | 'finalized'>('all')
  const [poSearchQuery, setPoSearchQuery] = useState('')

  async function loadRole() {
    if (!authUser?.id) {
      setLoading(false)
      return
    }
    const { data: me, error: eMe } = await supabase
      .from('users')
      .select('role, estimator_service_type_ids')
      .eq('id', authUser.id)
      .single()
    if (eMe) {
      setError(eMe.message)
      setLoading(false)
      return
    }
    const role = (me as { role: UserRole; estimator_service_type_ids?: string[] | null } | null)?.role ?? null
    const estIds = (me as { estimator_service_type_ids?: string[] | null } | null)?.estimator_service_type_ids
    setMyRole(role)
    if (role === 'estimator' && estIds && estIds.length > 0) {
      setEstimatorServiceTypeIds(estIds)
    } else {
      setEstimatorServiceTypeIds(null)
    }
    if (role !== 'dev' && role !== 'master_technician' && role !== 'assistant' && role !== 'estimator') {
      setLoading(false)
      return
    }
    // For allowed roles, do not set loading false here; data-load effect will set it after parts etc. load
  }

  async function loadServiceTypes() {
    const { data, error } = await supabase
      .from('service_types')
      .select('*')
      .order('sequence_order', { ascending: true })
    
    if (error) {
      setError(`Failed to load service types: ${error.message}`)
      return
    }
    
    const types = (data as unknown as ServiceType[]) ?? []
    setServiceTypes(types)
    
    // For estimators with restrictions, filter to allowed types
    const visibleTypes = estimatorServiceTypeIds && estimatorServiceTypeIds.length > 0
      ? types.filter((st) => estimatorServiceTypeIds.includes(st.id))
      : types
    const firstId = visibleTypes[0]?.id
    if (firstId) {
      // Set or adjust selected: use first allowed, or keep current if still valid
      setSelectedServiceTypeId((prev) => {
        if (!prev || !visibleTypes.some((st) => st.id === prev)) return firstId
        return prev
      })
    }
  }

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
      setError(`Failed to load supply houses: ${error.message}`)
      return
    }
    setSupplyHouses((data as SupplyHouse[]) ?? [])
  }

  async function loadParts(page = 0, options?: {
    searchQuery?: string
    partTypeId?: string
    manufacturer?: string
    sortByPriceCount?: boolean
    serviceTypeId?: string
  }) {
    const serviceType = options?.serviceTypeId ?? selectedServiceTypeId
    if (!serviceType) {
      // No service type selected yet, skip loading
      return
    }
    
    setLoadingPartsPage(true)
    const from = page * PARTS_PAGE_SIZE
    const to = from + PARTS_PAGE_SIZE - 1

    // If sorting by price count, use RPC function to get ordered part IDs first
    if (options?.sortByPriceCount) {
      const { data: orderedParts, error: orderError } = await supabase
        .rpc('get_parts_ordered_by_price_count' as any, { ascending_order: true })
      
      if (orderError) {
        console.error('Failed to load parts order:', orderError)
        setError(`Failed to load parts: ${orderError.message}`)
        setLoadingPartsPage(false)
        return
      }
      
      type PartOrder = { part_id: string; price_count: number }
      const orderedPartIds = ((orderedParts as unknown as PartOrder[] | null) ?? []).map(p => p.part_id)
      
      // Get the IDs for this page
      const pagePartIds = orderedPartIds.slice(from, to + 1)
      
      if (pagePartIds.length === 0) {
        if (page === 0) {
          setParts([])
        }
        setHasMoreParts(false)
        setLoadingPartsPage(false)
        return
      }
      
      // Fetch the actual parts data for these IDs
      const { data: partsData, error: partsError } = await supabase
        .from('material_parts')
        .select('*, part_types(*)')
        .in('id', pagePartIds)
      
      if (partsError) {
        setError(`Failed to load parts: ${partsError.message}`)
        setLoadingPartsPage(false)
        return
      }
      
      // Sort the results to match the order we got from RPC
      const partsList = (partsData as any[]) ?? []
      const partsWithTypes = partsList.map(p => ({
        ...p,
        part_type: p.part_types
      }))
      const orderedPartsList = pagePartIds
        .map(id => partsWithTypes.find(p => p.id === id))
        .filter(p => p !== undefined) as MaterialPart[]
      
      // Load prices for each part
      const partsWithPrices: PartWithPrices[] = await Promise.all(
        orderedPartsList.map(async (part) => {
          const { data: pricesData, error: pricesError } = await supabase
            .from('material_part_prices')
            .select('*, supply_houses(*)')
            .eq('part_id', part.id)
            .order('price', { ascending: true })
          
          if (pricesError) {
            console.error(`Failed to load prices for part ${part.id}:`, pricesError)
            return { ...part, prices: [] }
          }

          const pricesList = (pricesData as unknown as (MaterialPartPrice & { supply_houses: SupplyHouse })[]) ?? []
          const prices = pricesList.map(p => ({
            ...p,
            supply_house: p.supply_houses,
          }))

          return { ...part, prices }
        })
      )
      
      if (page === 0) {
        setParts(partsWithPrices)
      } else {
        setParts((prev) => [...prev, ...partsWithPrices])
      }
      
      if (orderedPartsList.length < PARTS_PAGE_SIZE) {
        setHasMoreParts(false)
      }
      setLoadingPartsPage(false)
      return
    }

    // Build the query with filters
    let query = supabase
      .from('material_parts')
      .select('*, part_types(*)')
      .eq('service_type_id', serviceType)
      .order('name')
    
    // Apply search filter if provided
    if (options?.searchQuery) {
      const q = options.searchQuery.toLowerCase()
      query = query.or(`name.ilike.%${q}%,manufacturer.ilike.%${q}%,notes.ilike.%${q}%`)
    }
    
    // Apply part type filter if provided
    if (options?.partTypeId) {
      query = query.eq('part_type_id', options.partTypeId)
    }
    
    // Apply manufacturer filter if provided
    if (options?.manufacturer) {
      query = query.eq('manufacturer', options.manufacturer)
    }
    
    // Apply pagination
    query = query.range(from, to)
    
    const { data: partsData, error: partsError } = await query
    
    if (partsError) {
      setError(`Failed to load parts: ${partsError.message}`)
      setLoadingPartsPage(false)
      return
    }

    const rawPartsList = (partsData as any[]) ?? []
    const partsList = rawPartsList.map(p => ({
      ...p,
      part_type: p.part_types
    })) as MaterialPart[]

    // If there are no parts yet, skip price lookup entirely
    if (partsList.length === 0) {
      if (page === 0) {
        setParts([])
      }
      setHasMoreParts(false)
      setLoadingPartsPage(false)
      return
    }

    // Load prices for each part individually to avoid limit issues
    const partsWithPrices: PartWithPrices[] = await Promise.all(
      partsList.map(async (part) => {
        const { data: pricesData, error: pricesError } = await supabase
          .from('material_part_prices')
          .select('*, supply_houses(*)')
          .eq('part_id', part.id)
          .order('price', { ascending: true })
        
        if (pricesError) {
          console.error(`Failed to load prices for part ${part.id}:`, pricesError)
          return { ...part, prices: [] }
        }

        const pricesList = (pricesData as unknown as (MaterialPartPrice & { supply_houses: SupplyHouse })[]) ?? []
        const prices = pricesList.map(p => ({
          ...p,
          supply_house: p.supply_houses,
        }))

        return { ...part, prices }
      })
    )

    if (page === 0) {
      setParts(partsWithPrices)
    } else {
      setParts((prev) => {
        const existingById = new Map(prev.map((p) => [p.id, p]))
        for (const p of partsWithPrices) {
          existingById.set(p.id, p)
        }
        return Array.from(existingById.values())
      })
    }

    if (partsList.length < PARTS_PAGE_SIZE) {
      setHasMoreParts(false)
    }
    setLoadingPartsPage(false)
  }

  async function loadAllParts(serviceTypeId?: string) {
    const serviceType = serviceTypeId ?? selectedServiceTypeId
    if (!serviceType) {
      // No service type selected yet, skip loading
      return
    }
    
    setLoadingAllParts(true)
    setError(null)
    
    try {
      // Fetch all part IDs first
      const { data: allPartsData, error: partsError } = await supabase
        .from('material_parts')
        .select('*, part_types(*)')
        .eq('service_type_id', serviceType)
        .order('name')
      
      if (partsError) throw partsError
      
      const rawPartsList = (allPartsData as any[]) ?? []
      const partsList = rawPartsList.map(p => ({
        ...p,
        part_type: p.part_types
      })) as MaterialPart[]
      
      // Load prices for each part (show progress)
      const partsWithPrices: PartWithPrices[] = []
      const batchSize = 50
      
      for (let i = 0; i < partsList.length; i += batchSize) {
        const batch = partsList.slice(i, i + batchSize)
        const batchWithPrices = await Promise.all(
          batch.map(async (part) => {
            const { data: pricesData } = await supabase
              .from('material_part_prices')
              .select('*, supply_houses(*)')
              .eq('part_id', part.id)
              .order('price', { ascending: true })
            
            const pricesList = (pricesData as unknown as (MaterialPartPrice & { supply_houses: SupplyHouse })[]) ?? []
            const prices = pricesList.map(p => ({
              ...p,
              supply_house: p.supply_houses,
            }))
            
            return { ...part, prices }
          })
        )
        partsWithPrices.push(...batchWithPrices)
        
        // Update progress (optional: could show "Loaded 100/1500 parts...")
        setAllParts([...partsWithPrices])
      }
      
      setAllParts(partsWithPrices)
    } catch (err: any) {
      setError(`Failed to load all parts: ${err.message}`)
    } finally {
      setLoadingAllParts(false)
    }
  }

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

  async function loadSupplyHouseStatsByServiceType() {
    const { data, error } = await supabase
      .rpc('get_supply_house_stats_by_service_type' as any)

    if (error) {
      console.error('Failed to load supply house stats:', error)
      return
    }

    type StatsRow = {
      service_type_id: string
      service_type_name: string
      total_parts: number
      parts_with_prices: number
      parts_with_multiple_prices: number
      supply_house_id: string
      supply_house_name: string
      price_count: number
    }
    
    const rows = (data as unknown as StatsRow[] | null) ?? []
    
    // Group by service type
    const serviceTypeMap = new Map<string, {
      id: string
      name: string
      totalParts: number
      partsWithPrices: number
      partsWithMultiplePrices: number
    }>()
    
    // Group by supply house
    const supplyHouseMap = new Map<string, {
      id: string
      name: string
      pricesByServiceType: Record<string, number>
    }>()
    
    for (const row of rows) {
      // Service type stats (same for all rows with same service_type_id)
      if (!serviceTypeMap.has(row.service_type_id)) {
        serviceTypeMap.set(row.service_type_id, {
          id: row.service_type_id,
          name: row.service_type_name,
          totalParts: row.total_parts,
          partsWithPrices: row.parts_with_prices,
          partsWithMultiplePrices: row.parts_with_multiple_prices,
        })
      }
      
      // Supply house prices
      if (!supplyHouseMap.has(row.supply_house_id)) {
        supplyHouseMap.set(row.supply_house_id, {
          id: row.supply_house_id,
          name: row.supply_house_name,
          pricesByServiceType: {},
        })
      }
      
      const sh = supplyHouseMap.get(row.supply_house_id)!
      sh.pricesByServiceType[row.service_type_id] = row.price_count
    }
    
    setSupplyHouseStatsByServiceType({
      serviceTypes: Array.from(serviceTypeMap.values()),
      supplyHouses: Array.from(supplyHouseMap.values()),
    })
  }

  async function reloadPartsFirstPage() {
    setPartsPage(0)
    setHasMoreParts(true)
    await loadParts(0, {
      searchQuery,
      partTypeId: filterPartTypeId,
      manufacturer: filterManufacturer,
      sortByPriceCount: sortByPriceCountAsc,
    })
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
    
    // Load details for parts and nested templates
    const itemsWithDetails: TemplateItemWithDetails[] = await Promise.all(
      items.map(async (item) => {
        if (item.item_type === 'part' && item.part_id) {
          const { data: partData } = await supabase
            .from('material_parts')
            .select('*')
            .eq('id', item.part_id)
            .single()
          return { ...item, part: partData as MaterialPart | undefined }
        } else if (item.item_type === 'template' && item.nested_template_id) {
          const { data: templateData } = await supabase
            .from('material_templates')
            .select('*')
            .eq('id', item.nested_template_id)
            .single()
          return { ...item, nested_template: templateData as MaterialTemplate | undefined }
        }
        return item
      })
    )

    setTemplateItems(itemsWithDetails)
  }

  async function loadPurchaseOrders() {
    if (!selectedServiceTypeId) {
      // No service type selected yet, skip loading
      return
    }
    
    const { data: poData, error: poError } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('service_type_id', selectedServiceTypeId)
      .order('created_at', { ascending: false })
    
    if (poError) {
      setError(`Failed to load purchase orders: ${poError.message}`)
      return
    }

    const pos = (poData as PurchaseOrder[]) ?? []

    // Load items for each PO
    const posWithItems: PurchaseOrderWithItems[] = await Promise.all(
      pos.map(async (po) => {
        const { data: itemsData, error: itemsError } = await supabase
          .from('purchase_order_items')
          .select('*, material_parts(*), supply_houses(*), source_template:material_templates!source_template_id(id, name)')
          .eq('purchase_order_id', po.id)
          .order('sequence_order', { ascending: true })
        
        if (itemsError) {
          return { ...po, items: [] }
        }

        const items = (itemsData as unknown as (PurchaseOrderItem & { material_parts: MaterialPart; supply_houses: SupplyHouse | null; source_template?: { id: string; name: string } | null })[]) ?? []
        const itemsWithDetails: POItemWithDetails[] = items.map(item => ({
          ...item,
          part: item.material_parts,
          supply_house: item.supply_houses || undefined,
          source_template: item.source_template ?? null,
        }))

        return { ...po, items: itemsWithDetails }
      })
    )

    setAllPOs(posWithItems)
    setDraftPOs(posWithItems.filter(po => po.status === 'draft'))

    // Load user names for notes_added_by
    const userIds = [...new Set(posWithItems.map(po => po.notes_added_by).filter(Boolean) as string[])]
    if (userIds.length > 0) {
      const { data: usersData } = await supabase
        .from('users')
        .select('id, name, email')
        .in('id', userIds)
      
      if (usersData) {
        const namesMap: Record<string, string> = {}
        usersData.forEach(user => {
          const name = (user as { name: string | null; email: string | null }).name || (user as { email: string | null }).email || 'Unknown'
          namesMap[user.id] = name
        })
        setUserNamesMap(namesMap)
      }
    }
  }

  useEffect(() => {
    loadRole()
  }, [authUser?.id])

  useEffect(() => {
    if (myRole === 'dev' || myRole === 'master_technician' || myRole === 'assistant' || myRole === 'estimator') {
      const loadInitial = async () => {
        try {
          setPartsPage(0)
          setHasMoreParts(true)
          // Load service types first, then load data for default service type
          await loadServiceTypes()
        } finally {
          setLoading(false)
        }
      }
      loadInitial()
    }
  }, [myRole, estimatorServiceTypeIds])

  // Restore Load All mode preference from localStorage (per user); default on if no preference
  useEffect(() => {
    if (!authUser?.id || typeof window === 'undefined') return
    const stored = localStorage.getItem(LOAD_ALL_MODE_KEY(authUser.id))
    setLoadAllMode(stored !== 'false')
  }, [authUser?.id])

  // Reload data when service type changes
  useEffect(() => {
    if (selectedServiceTypeId && (myRole === 'dev' || myRole === 'master_technician' || myRole === 'assistant' || myRole === 'estimator')) {
      const loadForServiceType = async () => {
        setPartsPage(0)
        setHasMoreParts(true)
        setParts([])     // Clear paginated mode data
        setAllParts([])  // Clear Load All mode data
        await Promise.all([
          loadSupplyHouses(),
          loadPartTypes(),
          loadParts(0, { serviceTypeId: selectedServiceTypeId }),
          loadAllParts(selectedServiceTypeId),
          loadMaterialTemplates(),
          loadPurchaseOrders(),
          loadSupplyHouseStatsByServiceType(),
        ])
      }
      loadForServiceType()
    }
  }, [selectedServiceTypeId])

  useEffect(() => {
    const state = location.state as { refreshPrices?: boolean } | null
    if (!state?.refreshPrices) return
    reloadPartsFirstPage()
  }, [location.state])

  // Debounced search/filter effect
  useEffect(() => {
    const timer = setTimeout(() => {
      reloadPartsFirstPage()
    }, 300) // 300ms debounce for search, immediate for filter changes
    
    return () => clearTimeout(timer)
  }, [searchQuery, filterPartTypeId, filterManufacturer, sortByPriceCountAsc])

  useEffect(() => {
    if (selectedTemplate) {
      loadTemplateItems(selectedTemplate.id)
    }
  }, [selectedTemplate])

  useEffect(() => {
    if (activeTab === 'templates-po') {
      const load = async () => {
        const { data, error } = await supabase
          .from('material_template_items')
          .select('template_id, item_type, part_id')
        if (!error && data) {
          setAllTemplateItemsForStats(data as Array<{ template_id: string; item_type: string; part_id: string | null }>)
        } else {
          setAllTemplateItemsForStats([])
        }
      }
      load()
    }
  }, [activeTab])

  useEffect(() => {
    if (editingPO?.id) {
      // Reload PO to get latest items
      const loadPODetails = async () => {
        const { data: poData } = await supabase
          .from('purchase_orders')
          .select('*')
          .eq('id', editingPO.id)
          .single()
        
        if (poData) {
          const { data: itemsData, error: itemsError } = await supabase
            .from('purchase_order_items')
            .select('*, material_parts(*), supply_houses(*), source_template:material_templates!source_template_id(id, name)')
            .eq('purchase_order_id', editingPO.id)
            .order('sequence_order', { ascending: true })
          
          if (!itemsError && itemsData) {
            const items = (itemsData as unknown as (PurchaseOrderItem & { material_parts: MaterialPart; supply_houses: SupplyHouse | null; source_template?: { id: string; name: string } | null })[]) ?? []
            const itemsWithDetails: POItemWithDetails[] = items.map(item => ({
              ...item,
              part: item.material_parts,
              supply_house: item.supply_houses || undefined,
              source_template: item.source_template ?? null,
            }))
            setEditingPO({ ...poData as PurchaseOrder, items: itemsWithDetails })
          }
        }
      }
      loadPODetails()
    }
  }, [editingPO?.id])

  // Open a specific PO when navigating from Bids (e.g. "View purchase order")
  useEffect(() => {
    const openPOId = (location.state as { openPOId?: string } | null)?.openPOId
    if (!openPOId) return
    setActiveTab('purchase-orders')
    const loadPO = async () => {
      const { data: poData } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', openPOId)
        .single()
      if (poData) {
        const { data: itemsData, error: itemsError } = await supabase
          .from('purchase_order_items')
          .select('*, material_parts(*), supply_houses(*), source_template:material_templates!source_template_id(id, name)')
          .eq('purchase_order_id', openPOId)
          .order('sequence_order', { ascending: true })
        if (!itemsError && itemsData) {
          const items = (itemsData as unknown as (PurchaseOrderItem & { material_parts: MaterialPart; supply_houses: SupplyHouse | null; source_template?: { id: string; name: string } | null })[]) ?? []
          const itemsWithDetails: POItemWithDetails[] = items.map(item => ({
            ...item,
            part: item.material_parts,
            supply_house: item.supply_houses || undefined,
            source_template: item.source_template ?? null,
          }))
          setEditingPO({ ...poData as PurchaseOrder, items: itemsWithDetails })
        } else {
          setEditingPO({ ...poData as PurchaseOrder, items: [] })
        }
      }
      navigate(location.pathname, { replace: true, state: {} })
    }
    loadPO()
  }, [location.state])

  // Close part picker dropdowns when clicking outside
  useEffect(() => {
    if (!templatePartDropdownOpen) return
    const onMouseDown = (e: MouseEvent) => {
      if (templatePartPickerRef.current && !templatePartPickerRef.current.contains(e.target as Node)) {
        setTemplatePartDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [templatePartDropdownOpen])

  useEffect(() => {
    if (!poPartDropdownOpen) return
    const onMouseDown = (e: MouseEvent) => {
      if (poPartPickerRef.current && !poPartPickerRef.current.contains(e.target as Node)) {
        setPoPartDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [poPartDropdownOpen])

  // Infinite scroll for parts pagination
  useEffect(() => {
    if (activeTab !== 'price-book' || loadAllMode) return
    if (!hasMoreParts || loadingPartsPage) return

    const handleScroll = () => {
      if (loadingPartsRef.current) return // Prevent duplicate requests
      
      // Calculate distance from bottom
      const scrollTop = window.scrollY || document.documentElement.scrollTop
      const scrollHeight = document.documentElement.scrollHeight
      const clientHeight = window.innerHeight
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight

      // Load more when within 200px of bottom
      if (distanceFromBottom < 200) {
        loadingPartsRef.current = true
        const nextPage = partsPage + 1
        setPartsPage(nextPage)
        loadParts(nextPage, {
          searchQuery,
          partTypeId: filterPartTypeId,
          manufacturer: filterManufacturer,
          sortByPriceCount: sortByPriceCountAsc,
        }).finally(() => {
          loadingPartsRef.current = false
        })
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [activeTab, hasMoreParts, loadingPartsPage, partsPage, searchQuery, filterPartTypeId, filterManufacturer, loadAllMode])

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>
  }

  if (myRole !== 'dev' && myRole !== 'master_technician' && myRole !== 'assistant' && myRole !== 'estimator') {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Access denied. Only devs, masters, assistants, and estimators can access materials.</div>
  }

  // Filter parts by search query (name, manufacturer, part_type, notes) — used by part pickers
  function filterPartsByQuery(partList: PartWithPrices[], query: string, limit = 50): PartWithPrices[] {
    const q = (query || '').trim().toLowerCase()
    if (!q) return partList.slice(0, limit)
    return partList
      .filter(p => [p.name, p.manufacturer, p.part_type?.name, p.notes].some(f => (f || '').toLowerCase().includes(q)))
      .slice(0, limit)
  }

  // Parts are already filtered and sorted server-side, so just use them directly
  const sortedParts = parts

  // Determine which parts to display (load all mode with client-side filtering/sorting)
  const displayParts = loadAllMode 
    ? (() => {
        // First filter by search query
        const filtered = allParts.filter(part => {
          if (!clientSearchQuery) return true
          const q = clientSearchQuery.toLowerCase()
          return (
            part.name.toLowerCase().includes(q) ||
            part.manufacturer?.toLowerCase().includes(q) ||
            part.part_type?.name?.toLowerCase().includes(q) ||
            part.notes?.toLowerCase().includes(q)
          )
        })
        
        // Then sort by price count if active
        if (sortByPriceCountAsc) {
          return [...filtered].sort((a, b) => {
            return a.prices.length - b.prices.length || a.name.localeCompare(b.name)
          })
        }
        
        return filtered
      })()
    : sortedParts

  // Note: Virtual scrolling with useVirtualizer could be added here for even better
  // performance with 10k+ parts, but the current implementation works well for <5000 parts

  // Get unique manufacturers for filters
  const manufacturers = [...new Set((loadAllMode ? allParts : parts).map(p => p.manufacturer).filter(Boolean))].sort()

  // Filter purchase orders
  const filteredPOs = allPOs.filter(po => {
    const matchesStatus = poStatusFilter === 'all' || po.status === poStatusFilter
    const matchesSearch = !poSearchQuery || po.name.toLowerCase().includes(poSearchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

  // Filter material templates by search (name, description)
  const filteredTemplates = materialTemplates.filter(t => {
    const q = templateSearchQuery.trim().toLowerCase()
    if (!q) return true
    return [t.name, t.description].some(f => (f || '').toLowerCase().includes(q))
  })

  // Template stats: # of templates, % with at least one part item that has no price in price book
  const partIdsWithNoPrice = new Set(parts.filter(p => p.prices.length === 0).map(p => p.id))
  const templatesWithItemsWithNoPrice = materialTemplates.filter(t =>
    allTemplateItemsForStats.some(i =>
      i.template_id === t.id && i.item_type === 'part' && i.part_id != null && partIdsWithNoPrice.has(i.part_id)
    )
  ).length
  const templateStatsTotal = materialTemplates.length
  const templateStatsPctWithNoPrice = templateStatsTotal === 0 ? 0 : Math.round((templatesWithItemsWithNoPrice / templateStatsTotal) * 100)

  // Price Book Tab Functions
  function openAddPart() {
    setEditingPart(null)
    setPartFormInitialName('')
    setPartFormOpen(true)
    setError(null)
  }

  function openAddPartWithName(initialName: string) {
    setEditingPart(null)
    setPartFormInitialName((initialName ?? '').trim())
    setPartFormOpen(true)
    setError(null)
  }

  function openEditPart(part: MaterialPart & { part_type_id?: string }) {
    setEditingPart(part)
    setPartFormOpen(true)
    setError(null)
  }

  async function handlePartSaved(_part: MaterialPart) {
    await reloadPartsFirstPage()
    setPartFormOpen(false)
  }


  // Supply House Management Functions
  function openSupplyHousesModal() {
    setViewingSupplyHouses(true)
    loadSupplyHouseStatsByServiceType()
  }

  function openAddSupplyHouse() {
    setEditingSupplyHouse(null)
    setSupplyHouseName('')
    setSupplyHouseContactName('')
    setSupplyHousePhone('')
    setSupplyHouseEmail('')
    setSupplyHouseAddress('')
    setSupplyHouseNotes('')
    setSupplyHouseFormOpen(true)
    setError(null)
  }

  function openEditSupplyHouse(supplyHouse: SupplyHouse) {
    setEditingSupplyHouse(supplyHouse)
    setSupplyHouseName(supplyHouse.name)
    setSupplyHouseContactName(supplyHouse.contact_name || '')
    setSupplyHousePhone(supplyHouse.phone || '')
    setSupplyHouseEmail(supplyHouse.email || '')
    setSupplyHouseAddress(supplyHouse.address || '')
    setSupplyHouseNotes(supplyHouse.notes || '')
    setSupplyHouseFormOpen(true)
    setError(null)
  }

  function closeSupplyHouseForm() {
    setSupplyHouseFormOpen(false)
    setEditingSupplyHouse(null)
  }

  async function saveSupplyHouse(e: React.FormEvent) {
    e.preventDefault()
    if (!supplyHouseName.trim()) {
      setError('Supply house name is required')
      return
    }
    setSavingSupplyHouse(true)
    setError(null)

    if (editingSupplyHouse) {
      const { error: e } = await supabase
        .from('supply_houses')
        .update({
          name: supplyHouseName.trim(),
          contact_name: supplyHouseContactName.trim() || null,
          phone: supplyHousePhone.trim() || null,
          email: supplyHouseEmail.trim() || null,
          address: supplyHouseAddress.trim() || null,
          notes: supplyHouseNotes.trim() || null,
        })
        .eq('id', editingSupplyHouse.id)
      if (e) {
        setError(e.message)
      } else {
        await Promise.all([
          loadSupplyHouses(),
          reloadPartsFirstPage(),
        ])
        closeSupplyHouseForm()
      }
    } else {
      const { error: e } = await supabase
        .from('supply_houses')
        .insert({
          name: supplyHouseName.trim(),
          contact_name: supplyHouseContactName.trim() || null,
          phone: supplyHousePhone.trim() || null,
          email: supplyHouseEmail.trim() || null,
          address: supplyHouseAddress.trim() || null,
          notes: supplyHouseNotes.trim() || null,
        })
      if (e) {
        setError(e.message)
      } else {
        await Promise.all([
          loadSupplyHouses(),
          reloadPartsFirstPage(),
        ])
        closeSupplyHouseForm()
      }
    }
    setSavingSupplyHouse(false)
  }

  async function deleteSupplyHouse(supplyHouseId: string) {
    // Check if supply house has any prices
    const { data: prices } = await supabase
      .from('material_part_prices')
      .select('id')
      .eq('supply_house_id', supplyHouseId)
      .limit(1)
    
    const hasPrices = prices && prices.length > 0
    const message = hasPrices 
      ? 'Delete this supply house? All prices associated with it will also be removed.'
      : 'Delete this supply house?'
    
    if (!confirm(message)) return
    
    setError(null)
    const { error } = await supabase.from('supply_houses').delete().eq('id', supplyHouseId)
    if (error) {
      setError(error.message)
    } else {
      await Promise.all([
        loadSupplyHouses(),
        reloadPartsFirstPage(),
      ])
    }
  }

  // Template Management Functions
  function openAddTemplate() {
    setEditingTemplate(null)
    setTemplateName('')
    setTemplateDescription('')
    setTemplateFormOpen(true)
    setError(null)
  }

  function openEditTemplate(template: MaterialTemplate) {
    setEditingTemplate(template)
    setTemplateName(template.name)
    setTemplateDescription(template.description || '')
    setTemplateFormOpen(true)
    setError(null)
  }

  function closeTemplateForm() {
    setTemplateFormOpen(false)
  }

  async function saveTemplate(e: React.FormEvent) {
    e.preventDefault()
    if (!templateName.trim()) {
      setError('Assembly name is required')
      return
    }
    setSavingTemplate(true)
    setError(null)

    if (editingTemplate) {
      const { error: e } = await supabase
        .from('material_templates')
        .update({
          name: templateName.trim(),
          description: templateDescription.trim() || null,
        })
        .eq('id', editingTemplate.id)
      if (e) {
        setError(e.message)
      } else {
        await loadMaterialTemplates()
        closeTemplateForm()
      }
    } else {
      const { error: e } = await supabase
        .from('material_templates')
        .insert({
          name: templateName.trim(),
          description: templateDescription.trim() || null,
          service_type_id: selectedServiceTypeId,
        })
      if (e) {
        setError(e.message)
      } else {
        await loadMaterialTemplates()
        closeTemplateForm()
      }
    }
    setSavingTemplate(false)
  }

  async function deleteTemplate(templateId: string) {
    if (!confirm('Delete this assembly? All items will also be removed.')) return
    setError(null)
    const { error } = await supabase.from('material_template_items').delete().eq('template_id', templateId)
    if (error) {
      setError(error.message)
      return
    }
    const { error: e } = await supabase.from('material_templates').delete().eq('id', templateId)
    if (e) {
      setError(e.message)
    } else {
      await loadMaterialTemplates()
      if (selectedTemplate?.id === templateId) {
        setSelectedTemplate(null)
        setTemplateItems([])
      }
    }
  }

  async function addItemToTemplate() {
    if (!selectedTemplate) return
    if (newItemType === 'part' && !newItemPartId) {
      setError('Please select a part')
      return
    }
    if (newItemType === 'template' && !newItemTemplateId) {
      setError('Please select an assembly')
      return
    }
    const quantity = parseInt(newItemQuantity) || 1
    if (quantity < 1) {
      setError('Quantity must be at least 1')
      return
    }

    // Check for circular reference
    if (newItemType === 'template' && newItemTemplateId === selectedTemplate.id) {
      setError('Cannot add an assembly to itself')
      return
    }

    setAddingItemToTemplate(true)
    setError(null)

    // For parts: if part already exists in template, add to quantity instead of inserting duplicate
    if (newItemType === 'part' && newItemPartId) {
      const existing = templateItems.find(
        (i) => i.item_type === 'part' && i.part_id === newItemPartId
      )
      if (existing) {
        const { error: updateErr } = await supabase
          .from('material_template_items')
          .update({ quantity: (existing.quantity ?? 1) + quantity })
          .eq('id', existing.id)
        if (updateErr) {
          setError(updateErr.message)
        } else {
          await loadTemplateItems(selectedTemplate.id)
          setNewItemPartId('')
          setNewItemTemplateId('')
          setNewItemQuantity('1')
          setNewItemNotes('')
        }
        setAddingItemToTemplate(false)
        return
      }
    }

    const maxOrder = templateItems.length === 0 ? 0 : Math.max(...templateItems.map(i => i.sequence_order))
    const { error } = await supabase
      .from('material_template_items')
      .insert({
        template_id: selectedTemplate.id,
        item_type: newItemType,
        part_id: newItemType === 'part' ? newItemPartId : null,
        nested_template_id: newItemType === 'template' ? newItemTemplateId : null,
        quantity: quantity,
        sequence_order: maxOrder + 1,
        notes: newItemNotes.trim() || null,
      })
    
    if (error) {
      setError(error.message)
    } else {
      await loadTemplateItems(selectedTemplate.id)
      setNewItemPartId('')
      setNewItemTemplateId('')
      setNewItemQuantity('1')
      setNewItemNotes('')
    }
    setAddingItemToTemplate(false)
  }

  async function removeItemFromTemplate(itemId: string) {
    if (!confirm('Remove this item from the assembly?')) return
    setError(null)
    const { error } = await supabase.from('material_template_items').delete().eq('id', itemId)
    if (error) {
      setError(error.message)
    } else if (selectedTemplate) {
      await loadTemplateItems(selectedTemplate.id)
    }
  }

  // Purchase Order Functions

  async function createPOFromTemplate(templateId: string) {
    if (!authUser?.id) return
    setCreatingPOFromTemplate(true)
    setError(null)

    const expandedParts = await expandTemplate(supabase, templateId)

    const template = materialTemplates.find(t => t.id === templateId)
    const { data: poData, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        name: `PO: ${template?.name || 'Untitled'}`,
        status: 'draft',
        created_by: authUser.id,
        notes: null,
        service_type_id: selectedServiceTypeId,
      })
      .select('id')
      .single()

    if (poError) {
      setError(`Failed to create PO: ${poError.message}`)
      setCreatingPOFromTemplate(false)
      return
    }

    const addError = await addExpandedPartsToPO(supabase, poData.id, expandedParts, templateId)
    if (addError) {
      setError(addError)
      setCreatingPOFromTemplate(false)
      return
    }

    await loadPurchaseOrders()
    setCreatingPOFromTemplate(false)
    setActiveTab('purchase-orders')
  }

  async function createEmptyPO() {
    if (!authUser?.id) return
    setError(null)
    const currentDate = new Date().toLocaleDateString()
    const { data: poData, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        name: `New Purchase Order [${currentDate}]`,
        status: 'draft',
        created_by: authUser.id,
        notes: null,
        service_type_id: selectedServiceTypeId,
      })
      .select('id')
      .single()

    if (poError) {
      setError(`Failed to create PO: ${poError.message}`)
      return
    }

    await loadPurchaseOrders()
    // Find and set the newly created PO as editingPO
    const { data: newPO } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('id', poData.id)
      .single()
    
    if (newPO) {
      const poWithItems: PurchaseOrderWithItems = { ...newPO as PurchaseOrder, items: [] }
      setEditingPO(poWithItems)
    }
  }

  async function addTemplateToPO(poId: string, templateId: string) {
    if (!authUser?.id) return
    setAddingTemplateToPO(true)
    setError(null)

    const expandedParts = await expandTemplate(supabase, templateId)
    const addError = await addExpandedPartsToPO(supabase, poId, expandedParts, templateId)
    if (addError) {
      setError(addError)
      setAddingTemplateToPO(false)
      setSelectedTemplateForPO('')
      return
    }

    await loadPurchaseOrders()
    // Reload the editing PO
    if (editingPO) {
      const { data: poData } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', poId)
        .single()
      
      if (poData) {
        const { data: itemsData, error: itemsError } = await supabase
          .from('purchase_order_items')
          .select('*, material_parts(*), supply_houses(*), source_template:material_templates!source_template_id(id, name)')
          .eq('purchase_order_id', poId)
          .order('sequence_order', { ascending: true })
        
        if (!itemsError && itemsData) {
          const items = (itemsData as unknown as (PurchaseOrderItem & { material_parts: MaterialPart; supply_houses: SupplyHouse | null; source_template?: { id: string; name: string } | null })[]) ?? []
          const itemsWithDetails: POItemWithDetails[] = items.map(item => ({
            ...item,
            part: item.material_parts,
            supply_house: item.supply_houses || undefined,
            source_template: item.source_template ?? null,
          }))
          setEditingPO({ ...poData as PurchaseOrder, items: itemsWithDetails })
        }
      }
    }
    setAddingTemplateToPO(false)
    setSelectedTemplateForPO('')
  }

  async function addPartToPO(poId: string, partId: string, quantity: number) {
    if (!authUser?.id) return
    if (quantity <= 0) {
      setError('Quantity must be greater than 0')
      return
    }
    setAddingPartToPO(true)
    setError(null)

    // Get best price for the part
    const { data: prices } = await supabase
      .from('material_part_prices')
      .select('*, supply_houses(*)')
      .eq('part_id', partId)
      .order('price', { ascending: true })
      .limit(1)
    
    const firstPrice = prices && prices.length > 0 ? prices[0] : undefined
    const bestPrice = firstPrice != null
      ? (firstPrice as unknown as MaterialPartPrice & { supply_houses: SupplyHouse })
      : null

    // Get current max sequence_order for this PO
    const { data: existingItems } = await supabase
      .from('purchase_order_items')
      .select('sequence_order')
      .eq('purchase_order_id', poId)
      .order('sequence_order', { ascending: false })
      .limit(1)
    
    const maxOrder = existingItems && existingItems.length > 0 && existingItems[0] ? existingItems[0].sequence_order : 0

    // Add item to PO
    const { error: itemError } = await supabase
      .from('purchase_order_items')
      .insert({
        purchase_order_id: poId,
        part_id: partId,
        quantity: quantity,
        selected_supply_house_id: bestPrice?.supply_house_id || null,
        price_at_time: bestPrice?.price || 0,
        sequence_order: maxOrder + 1,
      })

    if (itemError) {
      setError(`Failed to add part: ${itemError.message}`)
      setAddingPartToPO(false)
      return
    }

    await loadPurchaseOrders()
    // Reload the editing PO
    if (editingPO) {
      const { data: poData } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', poId)
        .single()
      
      if (poData) {
        const { data: itemsData, error: itemsError } = await supabase
          .from('purchase_order_items')
          .select('*, material_parts(*), supply_houses(*), source_template:material_templates!source_template_id(id, name)')
          .eq('purchase_order_id', poId)
          .order('sequence_order', { ascending: true })
        
        if (!itemsError && itemsData) {
          const items = (itemsData as unknown as (PurchaseOrderItem & { material_parts: MaterialPart; supply_houses: SupplyHouse | null; source_template?: { id: string; name: string } | null })[]) ?? []
          const itemsWithDetails: POItemWithDetails[] = items.map(item => ({
            ...item,
            part: item.material_parts,
            supply_house: item.supply_houses || undefined,
            source_template: item.source_template ?? null,
          }))
          setEditingPO({ ...poData as PurchaseOrder, items: itemsWithDetails })
        }
      }
    }
    setAddingPartToPO(false)
    setSelectedPartForPO('')
    setPartQuantityForPO('1')
  }

  async function updatePOItem(itemId: string, updates: { quantity?: number; supply_house_id?: string | null; price_at_time?: number; notes?: string | null }) {
    setError(null)
    const { error } = await supabase
      .from('purchase_order_items')
      .update(updates)
      .eq('id', itemId)

    if (error) {
      setError(`Failed to update item: ${error.message}`)
      return
    }

    // Reload the editing PO
    if (editingPO) {
      const { data: itemsData, error: itemsError } = await supabase
        .from('purchase_order_items')
        .select('*, material_parts(*), supply_houses(*), source_template:material_templates!source_template_id(id, name)')
        .eq('purchase_order_id', editingPO.id)
        .order('sequence_order', { ascending: true })
      
      if (!itemsError && itemsData) {
        const items = (itemsData as unknown as (PurchaseOrderItem & { material_parts: MaterialPart; supply_houses: SupplyHouse | null; source_template?: { id: string; name: string } | null })[]) ?? []
        const itemsWithDetails: POItemWithDetails[] = items.map(item => ({
          ...item,
          part: item.material_parts,
          supply_house: item.supply_houses || undefined,
          source_template: item.source_template ?? null,
        }))
        setEditingPO({ ...editingPO, items: itemsWithDetails })
      }
    }
    setEditingPOItem(null)
    setEditingPOItemNotesId(null)
  }

  async function removePOItem(itemId: string) {
    if (!confirm('Remove this item from the purchase order?')) return
    setError(null)
    const { error } = await supabase
      .from('purchase_order_items')
      .delete()
      .eq('id', itemId)

    if (error) {
      setError(`Failed to remove item: ${error.message}`)
      return
    }

    // Reload the editing PO
    if (editingPO) {
      const { data: itemsData, error: itemsError } = await supabase
        .from('purchase_order_items')
        .select('*, material_parts(*), supply_houses(*), source_template:material_templates!source_template_id(id, name)')
        .eq('purchase_order_id', editingPO.id)
        .order('sequence_order', { ascending: true })
      
      if (!itemsError && itemsData) {
        const items = (itemsData as unknown as (PurchaseOrderItem & { material_parts: MaterialPart; supply_houses: SupplyHouse | null; source_template?: { id: string; name: string } | null })[]) ?? []
        const itemsWithDetails: POItemWithDetails[] = items.map(item => ({
          ...item,
          part: item.material_parts,
          supply_house: item.supply_houses || undefined,
          source_template: item.source_template ?? null,
        }))
        setEditingPO({ ...editingPO, items: itemsWithDetails })
      }
    }
  }

  async function loadAvailablePricesForPart(partId: string) {
    setLoadingAvailablePrices(true)
    setError(null)
    const { data, error } = await supabase
      .from('material_part_prices')
      .select('*, supply_houses(*)')
      .eq('part_id', partId)
      .order('price', { ascending: true })
    
    if (error) {
      setError(`Failed to load prices: ${error.message}`)
      setLoadingAvailablePrices(false)
      return
    }

    const pricesList = (data as unknown as (MaterialPartPrice & { supply_houses: SupplyHouse })[]) ?? []
    const availablePrices = pricesList.map(p => ({
      price_id: p.id,
      supply_house_id: p.supply_house_id,
      supply_house_name: p.supply_houses.name,
      price: p.price,
    }))
    
    setAvailablePricesForItem(availablePrices)
    setLoadingAvailablePrices(false)
  }

  async function loadSupplyHouseOptionsForPart(partId: string) {
    setLoadingDraftPOSupplyHouseOptions(true)
    setError(null)
    const { data, error } = await supabase
      .from('material_part_prices')
      .select('*, supply_houses(*)')
      .eq('part_id', partId)
      .order('price', { ascending: true })

    if (error) {
      setError(`Failed to load prices: ${error.message}`)
      setLoadingDraftPOSupplyHouseOptions(false)
      return
    }

    const pricesList = (data as unknown as (MaterialPartPrice & { supply_houses: SupplyHouse })[]) ?? []
    const options = pricesList.map(p => ({
      supply_house_id: p.supply_house_id,
      supply_house_name: p.supply_houses.name,
      price: p.price,
    }))
    setDraftPOSupplyHouseOptionsPartId(partId)
    setDraftPOSupplyHouseOptions(options)
    setLoadingDraftPOSupplyHouseOptions(false)
  }

  async function fetchPricesForPart(partId: string): Promise<Array<{ supply_house_name: string; price: number }>> {
    const { data, error } = await supabase
      .from('material_part_prices')
      .select('*, supply_houses(*)')
      .eq('part_id', partId)
      .order('price', { ascending: true })
    if (error) return []
    const pricesList = (data as unknown as (MaterialPartPrice & { supply_houses: SupplyHouse })[]) ?? []
    return pricesList.map(p => ({
      supply_house_name: p.supply_houses.name,
      price: p.price,
    }))
  }

  async function printPO(po: PurchaseOrderWithItems) {
    const escapeHtml = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const title = escapeHtml(po.name)
    const grandTotal = po.items.reduce((sum, item) => sum + item.price_at_time * item.quantity, 0)
    let tableRows = ''
    if (po.status === 'finalized') {
      tableRows = po.items.map(item => {
        const partName = escapeHtml(item.part.name ?? '')
        const qty = item.quantity
        const sh = item.supply_house?.name ? escapeHtml(item.supply_house.name) : '—'
        const price = formatCurrency(item.price_at_time)
        const total = formatCurrency(item.price_at_time * item.quantity)
        return `<tr><td>${partName}</td><td>${qty}</td><td>${sh}</td><td>$${price}</td><td>$${total}</td></tr>`
      }).join('')
    } else {
      const allPricesPerItem = await Promise.all(po.items.map(item => fetchPricesForPart(item.part.id)))
      po.items.forEach((item, i) => {
        const partName = escapeHtml(item.part.name ?? '')
        const qty = item.quantity
        const prices = allPricesPerItem[i] ?? []
        const allPricesStr = prices.length === 0 ? '—' : prices.map(p => `${escapeHtml(p.supply_house_name)}: $${formatCurrency(p.price)}`).join('; ')
        const chosenStr = item.supply_house?.name ? `${escapeHtml(item.supply_house.name)}: $${formatCurrency(item.price_at_time)}` : '—'
        const total = formatCurrency(item.price_at_time * item.quantity)
        tableRows += `<tr><td>${partName}</td><td>${qty}</td><td>${allPricesStr}</td><td>${chosenStr}</td><td>$${total}</td></tr>`
      })
    }
    const statusLabel = po.status === 'finalized' ? 'Finalized' : 'Draft'
    const dateStr = po.status === 'finalized' && po.finalized_at
      ? new Date(po.finalized_at).toLocaleString()
      : po.created_at ? new Date(po.created_at).toLocaleDateString() : ''
    const theadFinalized = '<tr><th>Part</th><th>Qty</th><th>Supply House</th><th>Price</th><th>Total</th></tr>'
    const theadDraft = '<tr><th>Part</th><th>Qty</th><th>All prices</th><th>Chosen</th><th>Total</th></tr>'
    const thead = po.status === 'finalized' ? theadFinalized : theadDraft
    const footerColspan = po.status === 'finalized' ? 4 : 4
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
      body { font-family: sans-serif; margin: 1in; }
      table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
      th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
      th { background: #f5f5f5; }
      .meta { margin-bottom: 0.5rem; color: #666; }
      @media print { body { margin: 0.5in; } }
    </style></head><body>
      <h1>${title}</h1>
      <div class="meta">${statusLabel}${dateStr ? ` · ${dateStr}` : ''}</div>
      <table>
        <thead>${thead}</thead>
        <tbody>${tableRows}</tbody>
        <tfoot><tr><td colspan="${footerColspan}" style="text-align:right; font-weight:600;">Grand Total</td><td style="font-weight:600;">$${formatCurrency(grandTotal)}</td></tr></tfoot>
      </table>
    </body></html>`
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
    win.onafterprint = () => win.close()
  }

  function printPOForSupplyHouse(po: PurchaseOrderWithItems, taxPercent: number) {
    const escapeHtml = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const title = escapeHtml(po.name)
    const grandTotal = po.items.reduce((sum, item) => sum + item.price_at_time * item.quantity, 0)
    const withTaxAmount = grandTotal * (1 + taxPercent / 100)
    const tableRows = po.items.map(item => {
      const partName = escapeHtml(item.part.name ?? '')
      const qty = item.quantity
      const price = formatCurrency(item.price_at_time)
      const total = formatCurrency(item.price_at_time * item.quantity)
      return `<tr><td>${partName}</td><td>${qty}</td><td>$${price}</td><td>$${total}</td></tr>`
    }).join('')
    const thead = '<tr><th>Part</th><th>Qty</th><th>Price</th><th>Total</th></tr>'
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
      body { font-family: sans-serif; margin: 1in; }
      table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
      th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
      th { background: #f5f5f5; }
      @media print { body { margin: 0.5in; } }
    </style></head><body>
      <h1>${title}</h1>
      <table>
        <thead>${thead}</thead>
        <tbody>${tableRows}</tbody>
        <tfoot><tr><td colspan="3" style="text-align:right; font-weight:600;">Grand Total:</td><td style="font-weight:600;">$${formatCurrency(grandTotal)}</td></tr><tr><td colspan="3" style="text-align:right; font-weight:600;">With Tax ${taxPercent}%:</td><td style="font-weight:600;">$${formatCurrency(withTaxAmount)}</td></tr></tfoot>
      </table>
    </body></html>`
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
    win.onafterprint = () => win.close()
  }

  async function updatePartPriceInBook(priceId: string, newPrice: number, partId?: string) {
    setUpdatingPriceId(priceId)
    setError(null)
    const isRemove = newPrice === 0
    const { error } = isRemove
      ? await supabase.from('material_part_prices').delete().eq('id', priceId)
      : await supabase.from('material_part_prices').update({ price: newPrice }).eq('id', priceId)
    setUpdatingPriceId(null)
    if (error) {
      setError(isRemove ? `Failed to remove price: ${error.message}` : `Failed to update price: ${error.message}`)
      return
    }
    setEditingPricesByPriceId(prev => {
      const next = { ...prev }
      delete next[priceId]
      return next
    })
    const partIdToReload = partId ?? selectedPO?.items.find(i => i.id === editingPOItemSupplyHouseView)?.part.id
    if (partIdToReload) await loadAvailablePricesForPart(partIdToReload)
  }

  async function addPartPriceFromPOModal(partId: string, supplyHouseId: string, price: number) {
    setAddingNewPrice(true)
    setError(null)
    const { error } = await supabase
      .from('material_part_prices')
      .insert({
        part_id: partId,
        supply_house_id: supplyHouseId,
        price,
      })
    setAddingNewPrice(false)
    if (error) {
      setError(`Failed to add price: ${error.message}`)
      return
    }
    setAddPriceSupplyHouseId('')
    setAddPriceValue('')
    await loadAvailablePricesForPart(partId)
  }

  async function updatePOItemSupplyHouse(itemId: string, supplyHouseId: string, price: number) {
    setError(null)

    // Get the supply house name for optimistic update
    const supplyHouse = supplyHouses.find(sh => sh.id === supplyHouseId)

    // Build updated items from selectedPO or editingPO (when dropdown used in draft modal without selectedPO)
    const sourcePO = selectedPO ?? (editingPO?.items.some(i => i.id === itemId) ? editingPO : null)
    const updatedItems = sourcePO
      ? sourcePO.items.map(item => {
          if (item.id === itemId) {
            return {
              ...item,
              selected_supply_house_id: supplyHouseId || null,
              price_at_time: price,
              supply_house: supplyHouse || undefined,
            }
          }
          return item
        })
      : []
    if (selectedPO && sourcePO?.id === selectedPO.id) {
      setSelectedPO({ ...selectedPO, items: updatedItems })
    }
    if (editingPO && sourcePO && editingPO.id === sourcePO.id) {
      setEditingPO({ ...editingPO, items: updatedItems })
    }
    const poIdToUpdate = sourcePO?.id
    setDraftPOs(prev => prev.map(po => po.id === poIdToUpdate ? { ...po, items: updatedItems } : po))
    setAllPOs(prev => prev.map(po => po.id === poIdToUpdate ? { ...po, items: updatedItems } : po))

    const { error } = await supabase
      .from('purchase_order_items')
      .update({
        selected_supply_house_id: supplyHouseId || null,
        price_at_time: price,
      })
      .eq('id', itemId)

    if (error) {
      setError(`Failed to update supply house: ${error.message}`)
      // Revert optimistic update - reload from server
      if (selectedPO) {
        const { data: itemsData, error: itemsError } = await supabase
          .from('purchase_order_items')
          .select('*, material_parts(*), supply_houses(*), source_template:material_templates!source_template_id(id, name)')
          .eq('purchase_order_id', selectedPO.id)
          .order('sequence_order', { ascending: true })
        
        if (!itemsError && itemsData) {
          const items = (itemsData as unknown as (PurchaseOrderItem & { material_parts: MaterialPart; supply_houses: SupplyHouse | null; source_template?: { id: string; name: string } | null })[]) ?? []
          const itemsWithDetails: POItemWithDetails[] = items.map(item => ({
            ...item,
            part: item.material_parts,
            supply_house: item.supply_houses || undefined,
            source_template: item.source_template ?? null,
          }))
          setSelectedPO({ ...selectedPO, items: itemsWithDetails })
          if (editingPO && editingPO.id === selectedPO.id) {
            setEditingPO({ ...editingPO, items: itemsWithDetails })
          }
          setDraftPOs(prev => prev.map(po => po.id === selectedPO.id ? { ...po, items: itemsWithDetails } : po))
          setAllPOs(prev => prev.map(po => po.id === selectedPO.id ? { ...po, items: itemsWithDetails } : po))
        }
      }
      return
    }

    setEditingPOItemSupplyHouseView(null)
    setAvailablePricesForItem([])
    setEditingPricesByPriceId({})
    setAddPriceSupplyHouseId('')
    setAddPriceValue('')
  }

  function formatTimeSince(timestamp: string): string {
    const now = new Date()
    const then = new Date(timestamp)
    const diffMs = now.getTime() - then.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    const diffWeeks = Math.floor(diffMs / 604800000)
    const diffMonths = Math.floor(diffMs / 2592000000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
    if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''} ago`
    if (diffMonths < 12) return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`
    return `${Math.floor(diffMonths / 12)} year${Math.floor(diffMonths / 12) !== 1 ? 's' : ''} ago`
  }

  async function confirmPOItemPrice(itemId: string, partId: string, supplyHouseId: string | null, price: number) {
    if (!authUser?.id) return
    setConfirmingPriceForItem(itemId)
    setError(null)

    const confirmedAt = new Date().toISOString()

    // Optimistically update UI immediately
    if (selectedPO) {
      const updatedItems = selectedPO.items.map(item => 
        item.id === itemId 
          ? { ...item, price_confirmed_at: confirmedAt, price_confirmed_by: authUser.id }
          : item
      )
      setSelectedPO({ ...selectedPO, items: updatedItems })
    }

    // Update PO item confirmation status and create price history entry in parallel
    const [updateResult, historyResult] = await Promise.all([
      supabase
        .from('purchase_order_items')
        .update({
          price_confirmed_at: confirmedAt,
          price_confirmed_by: authUser.id,
        })
        .eq('id', itemId),
      supplyHouseId ? supabase
        .from('material_part_price_history')
        .insert({
          part_id: partId,
          supply_house_id: supplyHouseId,
          old_price: price,
          new_price: price,
          price_change_percent: 0,
          notes: `Price confirmed via PO: ${selectedPO?.name || 'Unknown PO'}`,
          changed_by: authUser.id,
        }) : Promise.resolve({ error: null })
    ])

    if (updateResult.error) {
      setError(`Failed to confirm price: ${updateResult.error.message}`)
      // Revert optimistic update
      if (selectedPO) {
        const revertedItems = selectedPO.items.map(item => 
          item.id === itemId 
            ? { ...item, price_confirmed_at: null, price_confirmed_by: null }
            : item
        )
        setSelectedPO({ ...selectedPO, items: revertedItems })
      }
      setConfirmingPriceForItem(null)
      return
    }

    if (historyResult.error) {
      console.error('Failed to create price history entry:', historyResult.error)
      // Don't fail the whole operation if history entry fails
    }

    setConfirmingPriceForItem(null)
  }

  async function unconfirmPOItemPrice(itemId: string) {
    setConfirmingPriceForItem(itemId)
    setError(null)

    // Optimistically update UI immediately
    if (selectedPO) {
      const updatedItems = selectedPO.items.map(item => 
        item.id === itemId 
          ? { ...item, price_confirmed_at: null, price_confirmed_by: null }
          : item
      )
      setSelectedPO({ ...selectedPO, items: updatedItems })
    }

    const { error } = await supabase
      .from('purchase_order_items')
      .update({
        price_confirmed_at: null,
        price_confirmed_by: null,
      })
      .eq('id', itemId)

    if (error) {
      setError(`Failed to unconfirm price: ${error.message}`)
      // Revert optimistic update - reload from server
      if (selectedPO) {
        const { data: itemsData, error: itemsError } = await supabase
          .from('purchase_order_items')
          .select('*, material_parts(*), supply_houses(*), source_template:material_templates!source_template_id(id, name)')
          .eq('purchase_order_id', selectedPO.id)
          .order('sequence_order', { ascending: true })
        
        if (!itemsError && itemsData) {
          const items = (itemsData as unknown as (PurchaseOrderItem & { material_parts: MaterialPart; supply_houses: SupplyHouse | null; source_template?: { id: string; name: string } | null })[]) ?? []
          const itemsWithDetails: POItemWithDetails[] = items.map(item => ({
            ...item,
            part: item.material_parts,
            supply_house: item.supply_houses || undefined,
            source_template: item.source_template ?? null,
          }))
          setSelectedPO({ ...selectedPO, items: itemsWithDetails })
        }
      }
      setConfirmingPriceForItem(null)
      return
    }

    setConfirmingPriceForItem(null)
  }

  async function updatePOName(poId: string, newName: string) {
    if (!newName.trim()) {
      setError('PO name cannot be empty')
      return
    }
    setError(null)

    // Optimistically update UI
    if (editingPO && editingPO.id === poId) {
      setEditingPO({ ...editingPO, name: newName.trim() })
    }
    if (selectedPO && selectedPO.id === poId) {
      setSelectedPO({ ...selectedPO, name: newName.trim() })
    }

    const { error } = await supabase
      .from('purchase_orders')
      .update({ name: newName.trim() })
      .eq('id', poId)
      .eq('status', 'draft') // Only allow updating draft POs

    if (error) {
      setError(`Failed to update PO name: ${error.message}`)
      // Revert optimistic update
      await loadPurchaseOrders()
      if (editingPO && editingPO.id === poId) {
        const po = allPOs.find(p => p.id === poId)
        if (po) {
          setEditingPO(po)
        }
      }
      if (selectedPO && selectedPO.id === poId) {
        const po = allPOs.find(p => p.id === poId)
        if (po) {
          setSelectedPO(po)
        }
      }
      return
    }

    await loadPurchaseOrders()
    setEditingPOName(null)
    setEditingPONameValue('')
  }

  function startEditPOName(poId: string, currentName: string) {
    setEditingPOName(poId)
    setEditingPONameValue(currentName)
  }

  function cancelEditPOName() {
    setEditingPOName(null)
    setEditingPONameValue('')
  }

  async function duplicatePOAsDraft(poId: string) {
    if (!authUser?.id) return
    setDuplicatingPO(poId)
    setError(null)

    // Load the source PO
    const { data: sourcePO, error: poError } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('id', poId)
      .single()

    if (poError || !sourcePO) {
      setError(`Failed to load source PO: ${poError?.message || 'PO not found'}`)
      setDuplicatingPO(null)
      return
    }

    // Load all items from source PO
    const { data: sourceItems, error: itemsError } = await supabase
      .from('purchase_order_items')
      .select('*')
      .eq('purchase_order_id', poId)
      .order('sequence_order', { ascending: true })

    if (itemsError) {
      setError(`Failed to load PO items: ${itemsError.message}`)
      setDuplicatingPO(null)
      return
    }

    // Create new draft PO
    const { data: newPOData, error: createError } = await supabase
      .from('purchase_orders')
      .insert({
        name: `Copy of ${sourcePO.name}`,
        status: 'draft',
        created_by: authUser.id,
        notes: sourcePO.notes,
        service_type_id: (sourcePO as { service_type_id?: string }).service_type_id ?? selectedServiceTypeId,
      })
      .select('id')
      .single()

    if (createError || !newPOData) {
      setError(`Failed to create duplicate PO: ${createError?.message || 'Unknown error'}`)
      setDuplicatingPO(null)
      return
    }

    // Copy all items to the new PO
    const typedSourceItems = (sourceItems ?? []) as PurchaseOrderItem[]
    if (typedSourceItems.length > 0) {
      for (let i = 0; i < typedSourceItems.length; i++) {
        const item = typedSourceItems[i]
        if (!item) continue
        const { error: itemError } = await supabase
          .from('purchase_order_items')
          .insert({
            purchase_order_id: newPOData.id,
            part_id: item.part_id,
            quantity: item.quantity,
            selected_supply_house_id: item.selected_supply_house_id,
            price_at_time: item.price_at_time,
            sequence_order: item.sequence_order,
            notes: item.notes,
            source_template_id: item.source_template_id ?? null,
            // price_confirmed_at and price_confirmed_by are not copied (reset confirmation status)
          })

        if (itemError) {
          setError(`Failed to copy item: ${itemError.message}`)
          // Delete the partially created PO
          await supabase.from('purchase_orders').delete().eq('id', newPOData.id)
          setDuplicatingPO(null)
          return
        }
      }
    }

    // Reload purchase orders
    await loadPurchaseOrders()

    // Load the new PO with items and set as editingPO
    const { data: newPO, error: loadError } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('id', newPOData.id)
      .single()

    if (!loadError && newPO) {
      const { data: itemsData, error: itemsError2 } = await supabase
        .from('purchase_order_items')
        .select('*, material_parts(*), supply_houses(*), source_template:material_templates!source_template_id(id, name)')
        .eq('purchase_order_id', newPOData.id)
        .order('sequence_order', { ascending: true })

      if (!itemsError2 && itemsData) {
        const items = (itemsData as unknown as (PurchaseOrderItem & { material_parts: MaterialPart; supply_houses: SupplyHouse | null; source_template?: { id: string; name: string } | null })[]) ?? []
        const itemsWithDetails: POItemWithDetails[] = items.map(item => ({
          ...item,
          part: item.material_parts,
          supply_house: item.supply_houses || undefined,
          source_template: item.source_template ?? null,
        }))
        const poWithItems: PurchaseOrderWithItems = { ...newPO as PurchaseOrder, items: itemsWithDetails }
        setEditingPO(poWithItems)
        setSelectedPO(null) // Close the view modal
        setActiveTab('templates-po') // Switch to Assemblies & Purchase Orders tab
      } else {
        const poWithItems: PurchaseOrderWithItems = { ...newPO as PurchaseOrder, items: [] }
        setEditingPO(poWithItems)
        setSelectedPO(null)
        setActiveTab('templates-po')
      }
    }

    setDuplicatingPO(null)
  }

  async function finalizePO(poId: string) {
    if (!confirm('Finalize this purchase order? It will become immutable.')) return
    setError(null)
    const { error } = await supabase
      .from('purchase_orders')
      .update({
        status: 'finalized',
        finalized_at: new Date().toISOString(),
      })
      .eq('id', poId)
    if (error) {
      setError(error.message)
    } else {
      await loadPurchaseOrders()
    }
  }

  async function addNotesToFinalizedPO(poId: string, notes: string) {
    if (!authUser?.id) {
      setError('You must be logged in to add notes.')
      return
    }

    if (!notes.trim()) {
      setError('Notes cannot be empty.')
      return
    }

    setError(null)

    // First verify that notes is currently null (add-only enforcement)
    const { data: currentPO, error: fetchError } = await supabase
      .from('purchase_orders')
      .select('notes, status')
      .eq('id', poId)
      .single()

    if (fetchError || !currentPO) {
      setError(`Failed to load PO: ${fetchError?.message || 'PO not found'}`)
      return
    }

    if (currentPO.status !== 'finalized') {
      setError('Notes can only be added to finalized purchase orders.')
      return
    }

    if (currentPO.notes !== null) {
      setError('Notes have already been added to this purchase order and cannot be modified.')
      return
    }

    // Update notes with tracking information
    const { error: updateError } = await supabase
      .from('purchase_orders')
      .update({
        notes: notes.trim(),
        notes_added_by: authUser.id,
        notes_added_at: new Date().toISOString(),
      })
      .eq('id', poId)
      .eq('status', 'finalized')
      .is('notes', null) // Additional safety check: only update if notes is null

    if (updateError) {
      setError(`Failed to add notes: ${updateError.message}`)
      return
    }

    // Reload purchase orders (this will also reload user names)
    await loadPurchaseOrders()
    
    // Update selectedPO if it's the one we just updated
    // We need to wait a bit for state to update, then fetch the updated PO
    const { data: updatedPOData } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('id', poId)
      .single()
    
    if (updatedPOData && selectedPO && selectedPO.id === poId) {
      // Load items for the updated PO
      const { data: itemsData } = await supabase
        .from('purchase_order_items')
        .select('*, material_parts(*), supply_houses(*), source_template:material_templates!source_template_id(id, name)')
        .eq('purchase_order_id', poId)
        .order('sequence_order', { ascending: true })
      
      if (itemsData) {
        const items = (itemsData as unknown as (PurchaseOrderItem & { material_parts: MaterialPart; supply_houses: SupplyHouse | null; source_template?: { id: string; name: string } | null })[]) ?? []
        const itemsWithDetails: POItemWithDetails[] = items.map(item => ({
          ...item,
          part: item.material_parts,
          supply_house: item.supply_houses || undefined,
          source_template: item.source_template ?? null,
        }))
        const poWithItems: PurchaseOrderWithItems = { ...updatedPOData as PurchaseOrder, items: itemsWithDetails }
        setSelectedPO(poWithItems)
      }
      
      // Load user name if not already in map
      if (updatedPOData.notes_added_by && !userNamesMap[updatedPOData.notes_added_by]) {
        const { data: userData } = await supabase
          .from('users')
          .select('id, name, email')
          .eq('id', updatedPOData.notes_added_by)
          .single()
        
        if (userData) {
          const name = (userData as { name: string | null; email: string | null }).name || (userData as { email: string | null }).email || 'Unknown'
          setUserNamesMap(prev => ({ ...prev, [userData.id]: name }))
        }
      }
    }

    // Reset form
    setAddingNotesToPO(null)
    setNotesValue('')
  }

  async function deletePO(poId: string) {
    if (!confirm('Delete this purchase order?')) return
    setError(null)
    const { error } = await supabase.from('purchase_orders').delete().eq('id', poId)
    if (error) {
      setError(error.message)
    } else {
      await loadPurchaseOrders()
      if (selectedPO?.id === poId) {
        setSelectedPO(null)
      }
    }
  }

  // For estimators with restrictions, only show allowed service types
  const visibleServiceTypes = myRole === 'estimator' && estimatorServiceTypeIds && estimatorServiceTypeIds.length > 0
    ? serviceTypes.filter((st) => estimatorServiceTypeIds.includes(st.id))
    : serviceTypes

  return (
    <div className="pageWrap" style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {error && (
        <div style={{ padding: '0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: 4, marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* Service Type Filter */}
      {visibleServiceTypes.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {visibleServiceTypes.map(st => (
            <button
              key={st.id}
              type="button"
              onClick={() => setSelectedServiceTypeId(st.id)}
              style={{
                padding: '0.5rem 1rem',
                border: selectedServiceTypeId === st.id ? '2px solid #3b82f6' : '1px solid #d1d5db',
                background: selectedServiceTypeId === st.id ? '#eff6ff' : 'white',
                color: selectedServiceTypeId === st.id ? '#3b82f6' : '#374151',
                borderRadius: 6,
                fontWeight: selectedServiceTypeId === st.id ? 600 : 400,
                cursor: 'pointer'
              }}
            >
              {st.name}
            </button>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid #e5e7eb', marginBottom: '2rem' }}>
        <button
          type="button"
          onClick={() => setActiveTab('price-book')}
          style={{
            padding: '0.75rem 1.5rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'price-book' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'price-book' ? '#3b82f6' : '#6b7280',
            fontWeight: activeTab === 'price-book' ? 600 : 400,
            cursor: 'pointer',
          }}
        >
          Price Book
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('templates-po')}
          style={{
            padding: '0.75rem 1.5rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'templates-po' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'templates-po' ? '#3b82f6' : '#6b7280',
            fontWeight: activeTab === 'templates-po' ? 600 : 400,
            cursor: 'pointer',
          }}
        >
          Assemblies & Purchase Orders
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('purchase-orders')}
          style={{
            padding: '0.75rem 1.5rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'purchase-orders' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'purchase-orders' ? '#3b82f6' : '#6b7280',
            fontWeight: activeTab === 'purchase-orders' ? 600 : 400,
            cursor: 'pointer',
          }}
        >
          Purchase Orders
        </button>
      </div>

      {/* Price Book Tab */}
      {activeTab === 'price-book' && (
        <div>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
            <button type="button" onClick={openAddPart} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
              Add Part
            </button>
            <button type="button" onClick={openSupplyHousesModal} style={{ padding: '0.5rem 1rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
              Supply Houses
            </button>
            <input
              type="text"
              placeholder={loadAllMode ? "Search all parts (instant)..." : "Search parts..."}
              value={loadAllMode ? clientSearchQuery : searchQuery}
              onChange={(e) => {
                if (loadAllMode) {
                  setClientSearchQuery(e.target.value)
                } else {
                  setSearchQuery(e.target.value)
                }
              }}
              style={{ 
                flex: 1, 
                padding: '0.5rem', 
                border: '1px solid #d1d5db', 
                borderRadius: 4,
                background: loadAllMode ? '#f0f9ff' : 'white',
              }}
            />
            <select
              value={filterPartTypeId}
              onChange={(e) => setFilterPartTypeId(e.target.value)}
              style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
              disabled={loadAllMode}
            >
              <option value="">All Part Types</option>
              {partTypes.map(ft => (
                <option key={ft.id} value={ft.id}>
                  {ft.name}{ft.category ? ` (${ft.category})` : ''}
                </option>
              ))}
            </select>
            <select
              value={filterManufacturer}
              onChange={(e) => setFilterManufacturer(e.target.value)}
              style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
              disabled={loadAllMode}
            >
              <option value="">All Manufacturers</option>
              {manufacturers.map(m => (
                <option key={m} value={m || ''}>{m || ''}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                if (!loadAllMode) {
                  setLoadAllMode(true)
                  loadAllParts()
                  if (authUser?.id) localStorage.setItem(LOAD_ALL_MODE_KEY(authUser.id), 'true')
                } else {
                  setLoadAllMode(false)
                  setAllParts([])
                  setClientSearchQuery('')
                  reloadPartsFirstPage()
                  if (authUser?.id) localStorage.setItem(LOAD_ALL_MODE_KEY(authUser.id), 'false')
                }
              }}
              disabled={loadingAllParts}
              title={loadAllMode ? "Exit bulk edit mode (paginated)" : "Load all parts for bulk editing"}
              style={{
                padding: '0.5rem',
                background: loadAllMode ? '#3b82f6' : 'white',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                cursor: loadingAllParts ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
              }}
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 640 640"
                style={{ 
                  width: '20px', 
                  height: '20px',
                  fill: loadAllMode ? 'white' : '#6b7280',
                  pointerEvents: 'none',
                }}
              >
                <path d="M320.5 64C335.2 64 348.7 72.1 355.7 85L571.7 485C578.4 497.4 578.1 512.4 570.9 524.5C563.7 536.6 550.6 544 536.6 544L104.6 544C90.5 544 77.5 536.6 70.3 524.5C63.1 512.4 62.8 497.4 69.5 485L285.5 85L288.4 80.4C295.7 70.2 307.6 64 320.5 64zM234.4 313.9L261.2 340.7C267.4 346.9 277.6 346.9 283.8 340.7L327.1 297.4C333.1 291.4 341.2 288 349.7 288L392.5 288L320.4 154.5L234.3 313.9z"/>
              </svg>
            </button>
          </div>

          <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Name</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Manufacturer</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Part Type</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Best Price</th>
                  <th
                    style={{
                      padding: '0.75rem',
                      textAlign: 'left',
                      borderBottom: '1px solid #e5e7eb',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                    onClick={() => setSortByPriceCountAsc(prev => !prev)}
                    title="Sort by number of prices (fewest first)"
                  >
                    #
                    {sortByPriceCountAsc ? ' \u2191' : ''}
                  </th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayParts.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                      {(searchQuery || clientSearchQuery || filterPartTypeId || filterManufacturer) ? 'No parts match your filters' : 'No parts yet. Add your first part or wait for the ledger to load!'}
                    </td>
                  </tr>
                ) : (
                  displayParts.map(part => {
                    const bestPrice = part.prices.length > 0 ? part.prices[0] : null
                    const isExpanded = expandedPartId === part.id
                    const priceCount = part.prices.length
                    return (
                      <Fragment key={part.id}>
                        <tr
                          onClick={() => setExpandedPartId(isExpanded ? null : part.id)}
                          style={{
                            borderBottom: isExpanded ? 'none' : '1px solid #e5e7eb',
                            cursor: 'pointer',
                            background: isExpanded ? '#f3f4f6' : undefined,
                          }}
                          onMouseEnter={(e) => {
                            if (!isExpanded) e.currentTarget.style.background = '#f9fafb'
                          }}
                          onMouseLeave={(e) => {
                            if (!isExpanded) e.currentTarget.style.background = ''
                          }}
                        >
                          <td style={{ padding: '0.75rem' }}>
                            <span style={{ marginRight: '0.5rem', display: 'inline-block', width: '1rem', textAlign: 'center' }}>
                              {isExpanded ? '\u25BC' : '\u25B6'}
                            </span>
                            {part.name}
                          </td>
                          <td style={{ padding: '0.75rem' }}>{part.manufacturer || '-'}</td>
                          <td style={{ padding: '0.75rem' }}>{part.part_type?.name || '-'}</td>
                          <td style={{ padding: '0.75rem' }}>
                            {bestPrice ? `$${bestPrice.price.toFixed(2)} (${bestPrice.supply_house.name})` : ''}
                          </td>
                          <td style={{ padding: '0.75rem' }}>{priceCount}</td>
                          <td style={{ padding: '0.75rem' }} onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); openEditPart(part) }}
                              style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${part.id}-details`} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td
                              colSpan={6}
                              style={{
                                padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                                background: '#f9fafb',
                                whiteSpace: 'pre-wrap',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: '2rem',
                                  alignItems: 'flex-start',
                                  justifyContent: 'space-between',
                                }}
                              >
                                <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                                  <strong>Notes (SKU, etc.)</strong>
                                  <div style={{ marginTop: '0.25rem' }}>{part.notes?.trim() || 'No notes'}</div>
                                </div>
                                <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                                  <strong>Prices</strong>
                                  <div style={{ marginTop: '0.25rem' }}>
                                    {part.prices.length === 0 ? (
                                      <span style={{ color: '#6b7280' }}>No prices yet</span>
                                    ) : (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem' }}>
                                        {part.prices.map((price) => (
                                          <div key={price.id}>
                                            ${price.price.toFixed(2)} {price.supply_house.name}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <div style={{ marginTop: '0.5rem' }}>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setViewingPartPrices(part)
                                      }}
                                      style={{
                                        padding: '0.25rem 0.75rem',
                                        background: '#3b82f6',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: 4,
                                        cursor: 'pointer',
                                        fontSize: '0.875rem',
                                      }}
                                    >
                                      Edit prices
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          {loadAllMode ? (
            loadingAllParts && (
              <div style={{ marginTop: '0.75rem', textAlign: 'center', padding: '1rem', color: '#6b7280' }}>
                Loading all parts... ({allParts.length} loaded)
              </div>
            )
          ) : (
            hasMoreParts && (
              <div style={{ marginTop: '0.75rem', textAlign: 'center', padding: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
                {loadingPartsPage ? 'Loading more parts…' : 'Scroll down to load more'}
              </div>
            )
          )}
        </div>
      )}

      {/* Part Form Modal */}
      <PartFormModal
        isOpen={partFormOpen}
        onClose={() => setPartFormOpen(false)}
        onSave={handlePartSaved}
        editingPart={editingPart}
        initialName={partFormInitialName}
        selectedServiceTypeId={selectedServiceTypeId}
        supplyHouses={supplyHouses}
        partTypes={partTypes}
        serviceTypes={serviceTypes}
      />


      {/* Part Prices Modal */}
      {viewingPartPrices && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: 8, maxWidth: '600px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ marginBottom: '1rem' }}>Prices for {viewingPartPrices.name}</h2>
            <PartPricesManager
              part={viewingPartPrices}
              supplyHouses={supplyHouses}
              onClose={() => {
                setViewingPartPrices(null)
                reloadPartsFirstPage()
              }}
              onPricesUpdated={(updatedPrices) => {
                setParts(prev =>
                  prev.map(p =>
                    p.id === viewingPartPrices.id
                      ? {
                          ...p,
                          prices: updatedPrices,
                        }
                      : p
                  )
                )
              }}
            />
          </div>
        </div>
      )}

      {/* Supply House Management Modal */}
      {viewingSupplyHouses && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: 8, maxWidth: '800px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>Supply Houses</h2>
              <button
                type="button"
                onClick={() => {
                  setViewingSupplyHouses(false)
                  closeSupplyHouseForm()
                }}
                style={{ padding: '0.5rem', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: '1.5rem', padding: '0.75rem', background: '#f9fafb', borderRadius: 4, color: '#6b7280', fontSize: '0.875rem' }}>
              {/* Service Type Statistics Headers */}
              {supplyHouseStatsByServiceType?.serviceTypes.map(st => {
                const pctWith = st.totalParts === 0 ? 0 : Math.round((st.partsWithPrices / st.totalParts) * 100)
                const pctMulti = st.totalParts === 0 ? 0 : Math.round((st.partsWithMultiplePrices / st.totalParts) * 100)
                return (
                  <div key={st.id} style={{ marginBottom: '0.5rem' }}>
                    <strong>{st.name}:</strong> {st.totalParts} items | {pctWith}% have prices | {pctMulti}% have more than 1 price
                  </div>
                )
              })}
              
              {/* Supply House Table */}
              <div style={{ marginTop: '1rem', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: '#f3f4f6' }}>
                      <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '2px solid #d1d5db', fontWeight: 600 }}>
                        Supply House
                      </th>
                      {supplyHouseStatsByServiceType?.serviceTypes.map(st => (
                        <th key={st.id} style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '2px solid #d1d5db', fontWeight: 600 }}>
                          {st.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {supplyHouseStatsByServiceType?.supplyHouses.map(sh => (
                      <tr key={sh.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '0.5rem', fontWeight: 500 }}>{sh.name}</td>
                        {supplyHouseStatsByServiceType.serviceTypes.map(st => {
                          const count = sh.pricesByServiceType[st.id] ?? 0
                          return (
                            <td key={st.id} style={{ padding: '0.5rem', textAlign: 'right', color: count === 0 ? '#9ca3af' : '#374151' }}>
                              {count}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {(!supplyHouseStatsByServiceType || supplyHouseStatsByServiceType.supplyHouses.length === 0) && (
                <div style={{ marginTop: '1rem', textAlign: 'center', color: '#6b7280' }}>
                  No supply houses or service types available.
                </div>
              )}
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <button
                type="button"
                onClick={openAddSupplyHouse}
                style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                + Add Supply House
              </button>
            </div>

            {/* Supply House Form */}
            {supplyHouseFormOpen && (
              <form onSubmit={saveSupplyHouse} style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f9fafb', borderRadius: 4 }}>
                <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>{editingSupplyHouse ? 'Edit Supply House' : 'Add Supply House'}</h3>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Name *</label>
                  <input
                    type="text"
                    value={supplyHouseName}
                    onChange={(e) => setSupplyHouseName(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                  />
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Contact Name</label>
                  <input
                    type="text"
                    value={supplyHouseContactName}
                    onChange={(e) => setSupplyHouseContactName(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                  />
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Phone</label>
                  <input
                    type="tel"
                    value={supplyHousePhone}
                    onChange={(e) => setSupplyHousePhone(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                  />
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Email</label>
                  <input
                    type="email"
                    value={supplyHouseEmail}
                    onChange={(e) => setSupplyHouseEmail(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                  />
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Address</label>
                  <textarea
                    value={supplyHouseAddress}
                    onChange={(e) => setSupplyHouseAddress(e.target.value)}
                    rows={2}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                  />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Notes</label>
                  <textarea
                    value={supplyHouseNotes}
                    onChange={(e) => setSupplyHouseNotes(e.target.value)}
                    rows={2}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
                  {editingSupplyHouse && myRole === 'dev' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (editingSupplyHouse) {
                          deleteSupplyHouse(editingSupplyHouse.id)
                          closeSupplyHouseForm()
                        }
                      }}
                      style={{ padding: '0.5rem 1rem', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer' }}
                    >
                      Delete
                    </button>
                  )}
                  <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
                    <button
                      type="submit"
                      disabled={savingSupplyHouse}
                      style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                    >
                      {savingSupplyHouse ? 'Saving...' : editingSupplyHouse ? 'Update' : 'Add'}
                    </button>
                    <button
                      type="button"
                      onClick={closeSupplyHouseForm}
                      style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Supply Houses List */}
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Name</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Contact</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Phone</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Email</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {supplyHouses.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                        No supply houses yet. Add your first supply house!
                      </td>
                    </tr>
                  ) : (
                    supplyHouses.map(sh => (
                      <tr key={sh.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '0.75rem', fontWeight: 500 }}>{sh.name}</td>
                        <td style={{ padding: '0.75rem' }}>{sh.contact_name || '-'}</td>
                        <td style={{ padding: '0.75rem' }}>{sh.phone || '-'}</td>
                        <td style={{ padding: '0.75rem' }}>{sh.email || '-'}</td>
                        <td style={{ padding: '0.75rem' }}>
                          <button
                            type="button"
                            onClick={() => openEditSupplyHouse(sh)}
                            style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Assemblies & PO Builder Tab */}
      {activeTab === 'templates-po' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          {/* Left Panel: Material Assemblies */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2>Material Assemblies</h2>
              <button
                type="button"
                onClick={openAddTemplate}
                style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                Add Assembly
              </button>
            </div>

            <input
              type="text"
              value={templateSearchQuery}
              onChange={(e) => setTemplateSearchQuery(e.target.value)}
              placeholder="Search assemblies by name or description…"
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '0.75rem' }}
            />

            <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, maxHeight: '600px', overflow: 'auto' }}>
              {materialTemplates.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                  No assemblies yet. Create your first assembly!
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                  No assemblies match
                </div>
              ) : (
                <div>
                  {filteredTemplates.map(template => {
                    const partItems = allTemplateItemsForStats.filter(i => i.template_id === template.id && i.item_type === 'part' && i.part_id != null)
                    const partCount = partItems.length
                    const unpricedCount = partItems.filter(i => i.part_id !== null && partIdsWithNoPrice.has(i.part_id)).length
                    const partsButtonBackground = partCount === 0 ? '#dc2626' : unpricedCount > 0 ? '#ca8a04' : '#3b82f6'
                    const partsButtonColor = partsButtonBackground === '#ca8a04' ? '#1f2937' : 'white'
                    return (
                    <div
                      key={template.id}
                      style={{
                        padding: '1rem',
                        borderBottom: '1px solid #e5e7eb',
                        background: selectedTemplate?.id === template.id ? '#eff6ff' : 'white',
                        cursor: 'pointer',
                      }}
                      onClick={() => setSelectedTemplate(template)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{template.name}</div>
                          {template.description && (
                            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{template.description}</div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedTemplate(template)
                              setTimeout(() => templateItemsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
                            }}
                            style={{ padding: '0.25rem 0.5rem', background: partsButtonBackground, color: partsButtonColor, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                          >
                            Parts
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              openEditTemplate(template)
                            }}
                            style={{ padding: '0.25rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Template Items View */}
            {selectedTemplate && (
              <div ref={templateItemsSectionRef} style={{ marginTop: '1.5rem', border: '1px solid #e5e7eb', borderRadius: 4, padding: '1rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>Items in {selectedTemplate.name}</h3>
                
                <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f9fafb', borderRadius: 4 }}>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Add Item</label>
                    <select
                      value={newItemType}
                      onChange={(e) => setNewItemType(e.target.value as 'part' | 'template')}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '0.5rem' }}
                    >
                      <option value="part">Part</option>
                      <option value="template">Nested Assembly</option>
                    </select>
                  </div>
                  {newItemType === 'part' ? (
                    <div ref={templatePartPickerRef} style={{ position: 'relative', marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                        <input
                          type="text"
                          value={newItemPartId ? (parts.find(p => p.id === newItemPartId)?.name ?? '') : templatePartSearchQuery}
                          onChange={(e) => setTemplatePartSearchQuery(e.target.value)}
                          onFocus={() => setTemplatePartDropdownOpen(true)}
                          onBlur={() => setTimeout(() => setTemplatePartDropdownOpen(false), 150)}
                          onKeyDown={(e) => e.key === 'Escape' && setTemplatePartDropdownOpen(false)}
                          readOnly={!!newItemPartId}
                          placeholder="Search parts by name, manufacturer, type, or notes…"
                          style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: newItemPartId ? '#f3f4f6' : undefined }}
                        />
                        {newItemPartId && (
                          <button
                            type="button"
                            onClick={() => { setNewItemPartId(''); setTemplatePartSearchQuery(''); setTemplatePartDropdownOpen(true) }}
                            style={{ padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      {templatePartDropdownOpen && (
                        <ul
                          style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            top: '100%',
                            margin: 0,
                            marginTop: 2,
                            padding: 0,
                            listStyle: 'none',
                            maxHeight: 240,
                            overflowY: 'auto',
                            border: '1px solid #d1d5db',
                            borderRadius: 4,
                            background: '#fff',
                            zIndex: 50,
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                          }}
                        >
                          {filterPartsByQuery(parts, templatePartSearchQuery).length === 0 ? (
                            <li style={{ padding: '0.75rem', color: '#6b7280' }}>
                              No parts match.{' '}
                              <button
                                type="button"
                                onClick={() => {
                                  openAddPartWithName(templatePartSearchQuery.trim())
                                  setTemplatePartDropdownOpen(false)
                                }}
                                style={{ marginLeft: '0.25rem', padding: '0.25rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
                              >
                                Add Part
                              </button>
                            </li>
                          ) : (
                            filterPartsByQuery(parts, templatePartSearchQuery).map(p => (
                              <li
                                key={p.id}
                                onClick={() => {
                                  setNewItemPartId(p.id)
                                  setTemplatePartSearchQuery('')
                                  setTemplatePartDropdownOpen(false)
                                }}
                                style={{
                                  padding: '0.5rem 0.75rem',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid #f3f4f6',
                                }}
                              >
                                <div style={{ fontWeight: 500 }}>{p.name}</div>
                                {(p.manufacturer || p.part_type?.name) && (
                                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                    {[p.manufacturer, p.part_type?.name].filter(Boolean).join(' · ')}
                                  </div>
                                )}
                              </li>
                            ))
                          )}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <select
                      value={newItemTemplateId}
                      onChange={(e) => setNewItemTemplateId(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '0.5rem' }}
                    >
                      <option value="">Select assembly</option>
                      {materialTemplates.filter(t => t.id !== selectedTemplate.id).map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  )}
                  <input
                    type="number"
                    min="1"
                    value={newItemQuantity}
                    onChange={(e) => setNewItemQuantity(e.target.value)}
                    placeholder="Quantity"
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '0.5rem' }}
                  />
                  <textarea
                    value={newItemNotes}
                    onChange={(e) => setNewItemNotes(e.target.value)}
                    placeholder="Notes (optional)"
                    rows={2}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '0.5rem' }}
                  />
                  <button
                    type="button"
                    onClick={addItemToTemplate}
                    disabled={addingItemToTemplate}
                    style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                  >
                    {addingItemToTemplate ? 'Adding...' : 'Add Item'}
                  </button>
                </div>

                <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#f9fafb' }}>
                      <tr>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Type</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Name</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Qty</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {templateItems.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                            No items yet. Add parts or nested assemblies.
                          </td>
                        </tr>
                      ) : (
                        (templateItems.map(item => {
                          const partWithPrices = item.item_type === 'part' && item.part_id ? parts.find(p => p.id === item.part_id) : null
                          const priceCount = partWithPrices?.prices.length ?? 0
                          const priceIconColor = priceCount === 0 ? '#dc2626' : priceCount === 1 ? '#ca8a04' : '#6b7280'
                          return (
                          <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '0.75rem' }}>{item.item_type === 'part' ? 'Part' : 'Assembly'}</td>
                            <td style={{ padding: '0.75rem' }}>
                              {item.item_type === 'part' ? item.part?.name : item.nested_template?.name}
                            </td>
                            <td style={{ padding: '0.75rem' }}>{item.quantity}</td>
                            <td style={{ padding: '0.75rem' }}>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                {item.item_type === 'part' && item.part && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setViewingPartPrices(item.part!) }}
                                      title="Part prices"
                                      aria-label="Part prices"
                                      style={{ padding: '0.25rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: priceIconColor }}
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={18} height={18} fill="currentColor" aria-hidden="true">
                                        <path d="M128 128C92.7 128 64 156.7 64 192L64 448C64 483.3 92.7 512 128 512L512 512C547.3 512 576 483.3 576 448L576 192C576 156.7 547.3 128 512 128L128 128zM320 224C373 224 416 267 416 320C416 373 373 416 320 416C267 416 224 373 224 320C224 267 267 224 320 224zM512 248C512 252.4 508.4 256.1 504 255.5C475 251.9 452.1 228.9 448.5 200C448 195.6 451.6 192 456 192L504 192C508.4 192 512 195.6 512 200L512 248zM128 392C128 387.6 131.6 383.9 136 384.5C165 388.1 187.9 411.1 191.5 440C192 444.4 188.4 448 184 448L136 448C131.6 448 128 444.4 128 440L128 392zM136 255.5C131.6 256 128 252.4 128 248L128 200C128 195.6 131.6 192 136 192L184 192C188.4 192 192.1 195.6 191.5 200C187.9 229 164.9 251.9 136 255.5zM504 384.5C508.4 384 512 387.6 512 392L512 440C512 444.4 508.4 448 504 448L456 448C451.6 448 447.9 444.4 448.5 440C452.1 411 475.1 388.1 504 384.5z" />
                                      </svg>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); openEditPart(item.part!) }}
                                      title="Edit part"
                                      aria-label="Edit part"
                                      style={{ padding: '0.25rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width={18} height={18} fill="currentColor" aria-hidden="true">
                                        <path d="M362.7 19.3L314.3 67.7 444.3 197.7 492.7 149.3c25-25 25-65.5 0-90.5L453.3 19.3c-25-25-65.5-25-90.5 0zm-71 71L58.6 323.5c-10.4 10.4-18.3 23.3-22.2 37.4L1 481.2C-1.5 489.7 .8 498.8 7 505s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4 27-11.8 37.4-22.2L421.7 220.3 291.7 90.3z" />
                                      </svg>
                                    </button>
                                  </>
                                )}
                                <button
                                  type="button"
                                  onClick={() => removeItemFromTemplate(item.id)}
                                  title="Remove from assembly"
                                  aria-label="Remove from assembly"
                                  style={{ padding: '0.25rem', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={18} height={18} fill="currentColor" aria-hidden="true">
                                    <path d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                          )
                        }))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <p style={{ marginTop: '0.75rem', color: '#6b7280', fontSize: '0.875rem' }}>
              {templateStatsTotal} assemblies | {templateStatsPctWithNoPrice}% of assemblies have unpriced parts
            </p>
          </div>

          {/* Right Panel: Draft Purchase Orders */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2>Draft Purchase Orders</h2>
              <button
                type="button"
                onClick={createEmptyPO}
                style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                Create PO
              </button>
            </div>

            <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, maxHeight: '300px', overflow: 'auto', marginBottom: '1.5rem' }}>
              {draftPOs.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                  No draft purchase orders. Create one from an assembly or manually.
                </div>
              ) : (
                <div>
                  {draftPOs.map(po => {
                    const total = po.items.reduce((sum, item) => sum + (item.price_at_time * item.quantity), 0)
                    return (
                      <div
                        key={po.id}
                        style={{
                          padding: '1rem',
                          borderBottom: '1px solid #e5e7eb',
                          background: editingPO?.id === po.id ? '#eff6ff' : 'white',
                          cursor: 'pointer',
                        }}
                        onClick={async () => {
                          // Clear any edit states when switching POs
                          setEditingPOName(null)
                          setEditingPONameValue('')
                          setEditingPOItem(null)
                          
                          // Load full PO details with items
                          const { data: itemsData, error: itemsError } = await supabase
                            .from('purchase_order_items')
                            .select('*, material_parts(*), supply_houses(*), source_template:material_templates!source_template_id(id, name)')
                            .eq('purchase_order_id', po.id)
                            .order('sequence_order', { ascending: true })
                          
                          if (!itemsError && itemsData) {
const items = (itemsData as unknown as (PurchaseOrderItem & { material_parts: MaterialPart; supply_houses: SupplyHouse | null; source_template?: { id: string; name: string } | null })[]) ?? []
          const itemsWithDetails: POItemWithDetails[] = items.map(item => ({
            ...item,
            part: item.material_parts,
            supply_house: item.supply_houses || undefined,
            source_template: item.source_template ?? null,
          }))
                            setEditingPO({ ...po, items: itemsWithDetails })
                            setSelectedPO({ ...po, items: itemsWithDetails })
                          } else {
                            setEditingPO(po)
                            setSelectedPO(po)
                          }
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{po.name}</div>
                            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                              {po.items.length} items • ${formatCurrency(total)} total
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Selected PO Details Section */}
            {editingPO && editingPO.status === 'draft' && (
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, padding: '1rem', background: '#f9fafb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    {editingPOName === editingPO.id ? (
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <input
                          type="text"
                          value={editingPONameValue}
                          onChange={(e) => setEditingPONameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              updatePOName(editingPO.id, editingPONameValue)
                            } else if (e.key === 'Escape') {
                              cancelEditPOName()
                            }
                          }}
                          autoFocus
                          style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '1.125rem', fontWeight: 600 }}
                        />
                        <button
                          type="button"
                          onClick={() => updatePOName(editingPO.id, editingPONameValue)}
                          style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditPOName}
                          style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <h3 style={{ margin: 0 }}>{editingPO.name}</h3>
                        <button
                          type="button"
                          onClick={() => startEditPOName(editingPO.id, editingPO.name)}
                          style={{ padding: '0.25rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
                        >
                          Edit
                        </button>
                      </div>
                    )}
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      Status: <strong>{editingPO.status}</strong> • {editingPO.items.length} items • ${formatCurrency(editingPO.items.reduce((sum, item) => sum + (item.price_at_time * item.quantity), 0))} total
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPO(null)
                      setEditingPOItem(null)
                      setEditingPOItemNotesId(null)
                      setEditingPOItemNotesValue('')
                      setEditingPOName(null)
                      setEditingPONameValue('')
                    }}
                    style={{ padding: '0.25rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Close
                  </button>
                </div>

                {/* Items Table */}
                {editingPO.items.length > 0 && (
                  <div style={{ marginBottom: '1.5rem', border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ background: '#f9fafb' }}>
                        <tr>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Part</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Qty</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Supply House</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Price</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Total</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>From assembly</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Notes</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editingPO.items.map(item => {
                          if (editingPOItem === item.id) {
                            // Edit mode
                            return (
                              <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb', background: '#fff' }}>
                                <td colSpan={8} style={{ padding: '1rem' }}>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.5rem', alignItems: 'end' }}>
                                    <div>
                                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>Quantity</label>
                                      <input
                                        type="number"
                                        min="1"
                                        value={editingPOItemQuantity}
                                        onChange={(e) => setEditingPOItemQuantity(e.target.value)}
                                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                                      />
                                    </div>
                                    <div>
                                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>Supply House</label>
                                      <select
                                        value={editingPOItemSupplyHouse}
                                        onChange={(e) => setEditingPOItemSupplyHouse(e.target.value)}
                                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                                      >
                                        <option value="">None</option>
                                        {supplyHouses.map(sh => (
                                          <option key={sh.id} value={sh.id}>{sh.name}</option>
                                        ))}
                                      </select>
                                    </div>
                                    <div>
                                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>Price</label>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={editingPOItemPrice}
                                        onChange={(e) => setEditingPOItemPrice(e.target.value)}
                                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                                      />
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const quantity = parseInt(editingPOItemQuantity) || item.quantity
                                          const price = parseFloat(editingPOItemPrice) || item.price_at_time
                                          updatePOItem(item.id, {
                                            quantity,
                                            supply_house_id: editingPOItemSupplyHouse || null,
                                            price_at_time: price,
                                          })
                                        }}
                                        style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                      >
                                        Update
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingPOItem(null)
                                          setEditingPOItemQuantity('')
                                          setEditingPOItemSupplyHouse('')
                                          setEditingPOItemPrice('')
                                        }}
                                        style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )
                          }
                          return (
                            <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                              <td style={{ padding: '0.75rem' }}>{item.part.name}</td>
                              <td style={{ padding: '0.75rem' }}>{item.quantity}</td>
                              <td style={{ padding: '0.75rem' }}>
                                <select
                                  value={item.supply_house?.id ?? ''}
                                  onFocus={() => loadSupplyHouseOptionsForPart(item.part.id)}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    if (val === '') {
                                      updatePOItemSupplyHouse(item.id, '', 0)
                                      return
                                    }
                                    const opts = draftPOSupplyHouseOptionsPartId === item.part.id ? draftPOSupplyHouseOptions : []
                                    const opt = opts.find(o => o.supply_house_id === val)
                                    if (opt) updatePOItemSupplyHouse(item.id, opt.supply_house_id, opt.price)
                                    else if (item.supply_house?.id === val) updatePOItemSupplyHouse(item.id, item.supply_house.id, item.price_at_time)
                                  }}
                                  style={{ minWidth: '10rem', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                                >
                                  {draftPOSupplyHouseOptionsPartId === item.part.id ? (
                                    loadingDraftPOSupplyHouseOptions ? (
                                      <option value={item.supply_house?.id ?? ''}>Loading...</option>
                                    ) : (
                                      <>
                                        <option value="">None</option>
                                        {item.supply_house && !draftPOSupplyHouseOptions.some(o => o.supply_house_id === item.supply_house?.id) && (
                                          <option value={item.supply_house.id}>{item.supply_house.name} - ${formatCurrency(item.price_at_time)}</option>
                                        )}
                                        {draftPOSupplyHouseOptions.map(o => (
                                          <option key={o.supply_house_id} value={o.supply_house_id}>{o.supply_house_name} - ${formatCurrency(o.price)}</option>
                                        ))}
                                      </>
                                    )
                                  ) : (
                                    <option value={item.supply_house?.id ?? ''}>{item.supply_house ? `${item.supply_house.name} - $${formatCurrency(item.price_at_time)}` : 'None'}</option>
                                  )}
                                </select>
                              </td>
                              <td style={{ padding: '0.75rem' }}>${formatCurrency(item.price_at_time)}</td>
                              <td style={{ padding: '0.75rem', fontWeight: 600 }}>${formatCurrency(item.price_at_time * item.quantity)}</td>
                              <td style={{ padding: '0.75rem' }}>
                                {item.source_template ? (
                                  <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: '#eff6ff', color: '#1d4ed8', borderRadius: 4 }} title={`From: ${item.source_template.name}`}>
                                    From: {item.source_template.name}
                                  </span>
                                ) : '—'}
                              </td>
                              <td style={{ padding: '0.75rem', maxWidth: 200 }}>
                                {editingPOItemNotesId === item.id ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <textarea
                                      value={editingPOItemNotesValue}
                                      onChange={(e) => setEditingPOItemNotesValue(e.target.value)}
                                      rows={2}
                                      placeholder="Item notes…"
                                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, resize: 'vertical' }}
                                    />
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          updatePOItem(item.id, { notes: editingPOItemNotesValue.trim() || null })
                                          setEditingPOItemNotesId(null)
                                          setEditingPOItemNotesValue('')
                                        }}
                                        style={{ padding: '0.25rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                      >
                                        Save
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingPOItemNotesId(null)
                                          setEditingPOItemNotesValue('')
                                        }}
                                        style={{ padding: '0.25rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <span style={{ fontSize: '0.875rem' }}>{item.notes?.trim() || '—'}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingPOItemNotesId(item.id)
                                        setEditingPOItemNotesValue(item.notes?.trim() || '')
                                      }}
                                      style={{ marginLeft: '0.5rem', padding: '0.15rem 0.4rem', fontSize: '0.75rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                                    >
                                      Edit
                                    </button>
                                  </>
                                )}
                              </td>
                              <td style={{ padding: '0.75rem' }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingPOItem(item.id)
                                    setEditingPOItemQuantity(item.quantity.toString())
                                    setEditingPOItemSupplyHouse(item.supply_house?.id || '')
                                    setEditingPOItemPrice(item.price_at_time.toString())
                                  }}
                                  style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removePOItem(item.id)}
                                  style={{ padding: '0.25rem 0.5rem', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer' }}
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Add Items Section */}
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, padding: '1rem', background: 'white' }}>
                  <h4 style={{ marginTop: 0, marginBottom: '1rem' }}>Add Items</h4>
                  
                  {/* Add Template */}
                  <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f9fafb', borderRadius: 4 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Add Template</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <select
                        value={selectedTemplateForPO}
                        onChange={(e) => setSelectedTemplateForPO(e.target.value)}
                        style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                      >
                        <option value="">Select assembly...</option>
                        {materialTemplates.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedTemplateForPO) {
                            addTemplateToPO(editingPO.id, selectedTemplateForPO)
                          }
                        }}
                        disabled={!selectedTemplateForPO || addingTemplateToPO}
                        style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                      >
                        {addingTemplateToPO ? 'Adding...' : 'Add Template'}
                      </button>
                    </div>
                  </div>

                  {/* Add Part */}
                  <div style={{ padding: '1rem', background: '#f9fafb', borderRadius: 4 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Add Part</label>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <div ref={poPartPickerRef} style={{ position: 'relative', flex: 1 }}>
                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                          <input
                            type="text"
                            value={selectedPartForPO ? (parts.find(p => p.id === selectedPartForPO)?.name ?? '') : poPartSearchQuery}
                            onChange={(e) => setPoPartSearchQuery(e.target.value)}
                            onFocus={() => setPoPartDropdownOpen(true)}
                            onBlur={() => setTimeout(() => setPoPartDropdownOpen(false), 150)}
                            onKeyDown={(e) => e.key === 'Escape' && setPoPartDropdownOpen(false)}
                            readOnly={!!selectedPartForPO}
                            placeholder="Search parts by name, manufacturer, type, or notes…"
                            style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: selectedPartForPO ? '#f3f4f6' : undefined }}
                          />
                          {selectedPartForPO && (
                            <button
                              type="button"
                              onClick={() => { setSelectedPartForPO(''); setPoPartSearchQuery(''); setPoPartDropdownOpen(true) }}
                              style={{ padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        {poPartDropdownOpen && (
                          <ul
                            style={{
                              position: 'absolute',
                              left: 0,
                              right: 0,
                              top: '100%',
                              margin: 0,
                              marginTop: 2,
                              padding: 0,
                              listStyle: 'none',
                              maxHeight: 240,
                              overflowY: 'auto',
                              border: '1px solid #d1d5db',
                              borderRadius: 4,
                              background: '#fff',
                              zIndex: 50,
                              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                            }}
                          >
                            {filterPartsByQuery(parts, poPartSearchQuery).length === 0 ? (
                              <li style={{ padding: '0.75rem', color: '#6b7280' }}>
                                No parts match.{' '}
                                <button
                                  type="button"
                                  onClick={() => {
                                    openAddPartWithName(poPartSearchQuery.trim())
                                    setPoPartDropdownOpen(false)
                                  }}
                                  style={{ marginLeft: '0.25rem', padding: '0.25rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
                                >
                                  Add Part
                                </button>
                              </li>
                            ) : (
                              filterPartsByQuery(parts, poPartSearchQuery).map(p => (
                                <li
                                  key={p.id}
                                  onClick={() => {
                                    setSelectedPartForPO(p.id)
                                    setPoPartSearchQuery('')
                                    setPoPartDropdownOpen(false)
                                  }}
                                  style={{
                                    padding: '0.5rem 0.75rem',
                                    cursor: 'pointer',
                                    borderBottom: '1px solid #f3f4f6',
                                  }}
                                >
                                  <div style={{ fontWeight: 500 }}>{p.name}</div>
                                  {(p.manufacturer || p.part_type?.name) && (
                                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                      {[p.manufacturer, p.part_type?.name].filter(Boolean).join(' · ')}
                                    </div>
                                  )}
                                </li>
                              ))
                            )}
                          </ul>
                        )}
                      </div>
                      <input
                        type="number"
                        min="1"
                        value={partQuantityForPO}
                        onChange={(e) => setPartQuantityForPO(e.target.value)}
                        placeholder="Qty"
                        style={{ width: '80px', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedPartForPO && partQuantityForPO) {
                          addPartToPO(editingPO.id, selectedPartForPO, parseInt(partQuantityForPO) || 1)
                        }
                      }}
                      disabled={!selectedPartForPO || !partQuantityForPO || addingPartToPO}
                      style={{ padding: '0.5rem 1rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                    >
                      {addingPartToPO ? 'Adding...' : 'Add Part'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Create PO from Template Button (when no editingPO) */}
            {selectedTemplate && !editingPO && (
              <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 4 }}>
                <button
                  type="button"
                  onClick={() => createPOFromTemplate(selectedTemplate.id)}
                  disabled={creatingPOFromTemplate}
                  style={{ width: '100%', padding: '0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
                >
                  {creatingPOFromTemplate ? 'Creating PO...' : `Create Purchase Order from "${selectedTemplate.name}"`}
                </button>
              </div>
            )}

            {/* Add Template to PO Button (when editingPO is set) */}
            {selectedTemplate && editingPO && editingPO.status === 'draft' && (
              <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 4 }}>
                <button
                  type="button"
                  onClick={() => addTemplateToPO(editingPO.id, selectedTemplate.id)}
                  disabled={addingTemplateToPO}
                  style={{ width: '100%', padding: '0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
                >
                  {addingTemplateToPO ? 'Adding Template...' : `Add "${selectedTemplate.name}" Template to PO`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Template Form Modal */}
      {templateFormOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: 8, maxWidth: '500px', width: '90%' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{editingTemplate ? 'Edit Assembly' : 'Add Assembly'}</h2>
            <form onSubmit={saveTemplate}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Name *</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Description</label>
                <textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  rows={3}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
                {editingTemplate && (
                  <button
                    type="button"
                    onClick={() => {
                      if (editingTemplate) {
                        deleteTemplate(editingTemplate.id)
                        closeTemplateForm()
                      }
                    }}
                    style={{ padding: '0.5rem 1rem', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Delete
                  </button>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
                  <button
                    type="button"
                    onClick={closeTemplateForm}
                    style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingTemplate}
                    style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                  >
                    {savingTemplate ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Purchase Orders Tab */}
      {activeTab === 'purchase-orders' && (
        <div>
          {/* Selected PO section (inline, above Search) */}
          {selectedPO && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1.5rem 2rem', background: 'white', marginBottom: '1.5rem' }}>
              <h2 style={{ marginBottom: '1rem' }}>{selectedPO.name}</h2>
              
              {/* Notes section - displayed at top for finalized POs */}
              {selectedPO.status === 'finalized' && (
                <>
                  {selectedPO.notes ? (
                    <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 4 }}>
                      <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: '#0369a1' }}>Notes</div>
                      <div style={{ marginBottom: '0.5rem', whiteSpace: 'pre-wrap' }}>{selectedPO.notes}</div>
                      {selectedPO.notes_added_by && (
                        <div style={{ fontSize: '0.875rem', color: '#6b7280', fontStyle: 'italic' }}>
                          Added by {userNamesMap[selectedPO.notes_added_by] || 'Unknown'} 
                          {selectedPO.notes_added_at && ` on ${new Date(selectedPO.notes_added_at).toLocaleString()}`}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {addingNotesToPO === selectedPO.id ? (
                        <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 4 }}>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Add Notes</label>
                          <textarea
                            value={notesValue}
                            onChange={(e) => setNotesValue(e.target.value)}
                            placeholder="Enter notes (e.g., final bill amount, pickup difficulties)..."
                            rows={4}
                            style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '0.75rem', fontFamily: 'inherit' }}
                          />
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setAddingNotesToPO(null)
                                setNotesValue('')
                              }}
                              style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => addNotesToFinalizedPO(selectedPO.id, notesValue)}
                              disabled={!notesValue.trim()}
                              style={{ padding: '0.5rem 1rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                            >
                              Save Notes
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ marginBottom: '1.5rem' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setAddingNotesToPO(selectedPO.id)
                              setNotesValue('')
                            }}
                            style={{ padding: '0.5rem 1rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                          >
                            Add Notes
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              <div style={{ marginBottom: '1rem', color: '#6b7280' }}>
                Status: <strong>{selectedPO.status}</strong>
                {selectedPO.finalized_at && (
                  <> • Finalized: {new Date(selectedPO.finalized_at).toLocaleString()}</>
                )}
              </div>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden', marginBottom: '1rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ background: '#f9fafb' }}>
                    <tr>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Part</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Qty</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Supply House</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Price</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Total</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>From assembly</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Notes</th>
                      {selectedPO.status === 'draft' && (
                        <>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Confirmed</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPO.items.map(item => {
                      const isEditing = editingPOItemSupplyHouseView === item.id
                      return (
                        <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '0.75rem' }}>{item.part.name}</td>
                          <td style={{ padding: '0.75rem' }}>{item.quantity}</td>
                          <td style={{ padding: '0.75rem' }}>
                            {isEditing ? (
                              <div style={{ maxWidth: '100%', overflow: 'auto' }}>
                                {loadingAvailablePrices ? (
                                  <span style={{ color: '#6b7280' }}>Loading prices...</span>
                                ) : availablePricesForItem.length > 0 ? (
                                  <>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                                      <thead>
                                        <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                          <th style={{ padding: '0.5rem', textAlign: 'left' }}>Supply House</th>
                                          <th style={{ padding: '0.5rem', textAlign: 'left' }}>Current Price</th>
                                          <th style={{ padding: '0.5rem', textAlign: 'left' }}>New Price</th>
                                          <th style={{ padding: '0.5rem', textAlign: 'left' }}>Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {availablePricesForItem.map(row => {
                                          const newPriceStr = editingPricesByPriceId[row.price_id] ?? row.price.toString()
                                          const newPriceNum = parseFloat(newPriceStr)
                                          const isValidPrice = !isNaN(newPriceNum) && newPriceNum >= 0
                                          return (
                                            <tr key={row.price_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                              <td style={{ padding: '0.5rem' }}>{row.supply_house_name}</td>
                                              <td style={{ padding: '0.5rem' }}>${formatCurrency(row.price)}</td>
                                              <td style={{ padding: '0.5rem' }}>
                                                <input
                                                  type="number"
                                                  step="0.01"
                                                  min="0"
                                                  value={newPriceStr}
                                                  onChange={(e) => setEditingPricesByPriceId(prev => ({ ...prev, [row.price_id]: e.target.value }))}
                                                  style={{ width: '6rem', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                                                />
                                              </td>
                                              <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    if (isValidPrice) updatePartPriceInBook(row.price_id, newPriceNum, item.part.id)
                                                  }}
                                                  disabled={!isValidPrice || updatingPriceId === row.price_id}
                                                  style={{ marginRight: '0.25rem', padding: '0.25rem 0.5rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem' }}
                                                >
                                                  {updatingPriceId === row.price_id ? 'Updating…' : (newPriceNum === 0 ? 'Remove from supply house' : 'Update price')}
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const priceToUse = isValidPrice ? newPriceNum : row.price
                                                    updatePOItemSupplyHouse(item.id, row.supply_house_id, priceToUse)
                                                  }}
                                                  style={{ padding: '0.25rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem' }}
                                                >
                                                  Use for PO
                                                </button>
                                              </td>
                                            </tr>
                                          )
                                        })}
                                      </tbody>
                                    </table>
                                    {(() => {
                                      const supplyHousesWithoutPrice = supplyHouses.filter(sh => !availablePricesForItem.some(p => p.supply_house_id === sh.id))
                                      const addPriceNum = parseFloat(addPriceValue)
                                      const canAddPrice = addPriceSupplyHouseId && !isNaN(addPriceNum) && addPriceNum > 0 && !addingNewPrice
                                      return supplyHousesWithoutPrice.length > 0 ? (
                                        <div style={{ padding: '0.5rem 0', borderTop: '1px solid #e5e7eb', marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                          <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>Add price:</span>
                                          <select
                                            value={addPriceSupplyHouseId}
                                            onChange={(e) => setAddPriceSupplyHouseId(e.target.value)}
                                            style={{ padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, minWidth: '140px' }}
                                          >
                                            <option value="">Select supply house</option>
                                            {supplyHousesWithoutPrice.map(sh => (
                                              <option key={sh.id} value={sh.id}>{sh.name}</option>
                                            ))}
                                          </select>
                                          <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={addPriceValue}
                                            onChange={(e) => setAddPriceValue(e.target.value)}
                                            placeholder="Price"
                                            style={{ width: '6rem', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                                          />
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (canAddPrice) addPartPriceFromPOModal(item.part.id, addPriceSupplyHouseId, addPriceNum)
                                            }}
                                            disabled={!canAddPrice}
                                            style={{ padding: '0.25rem 0.5rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem' }}
                                          >
                                            {addingNewPrice ? 'Adding…' : 'Add price'}
                                          </button>
                                        </div>
                                      ) : null
                                    })()}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingPOItemSupplyHouseView(null)
                                        setAvailablePricesForItem([])
                                        setEditingPricesByPriceId({})
                                        setAddPriceSupplyHouseId('')
                                        setAddPriceValue('')
                                      }}
                                      style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', marginTop: '0.5rem' }}
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <span style={{ color: '#6b7280' }}>No prices available.</span>
                                    {supplyHouses.length > 0 && (
                                      <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>Add price:</span>
                                        <select
                                          value={addPriceSupplyHouseId}
                                          onChange={(e) => setAddPriceSupplyHouseId(e.target.value)}
                                          style={{ padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, minWidth: '140px' }}
                                        >
                                          <option value="">Select supply house</option>
                                          {supplyHouses.map(sh => (
                                            <option key={sh.id} value={sh.id}>{sh.name}</option>
                                          ))}
                                        </select>
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={addPriceValue}
                                          onChange={(e) => setAddPriceValue(e.target.value)}
                                          placeholder="Price"
                                          style={{ width: '6rem', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const addPriceNum = parseFloat(addPriceValue)
                                            if (addPriceSupplyHouseId && !isNaN(addPriceNum) && addPriceNum > 0 && !addingNewPrice) {
                                              addPartPriceFromPOModal(item.part.id, addPriceSupplyHouseId, addPriceNum)
                                            }
                                          }}
                                          disabled={!addPriceSupplyHouseId || !addPriceValue || isNaN(parseFloat(addPriceValue)) || parseFloat(addPriceValue) <= 0 || addingNewPrice}
                                          style={{ padding: '0.25rem 0.5rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem' }}
                                        >
                                          {addingNewPrice ? 'Adding…' : 'Add price'}
                                        </button>
                                      </div>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingPOItemSupplyHouseView(null)
                                        setAvailablePricesForItem([])
                                        setEditingPricesByPriceId({})
                                        setAddPriceSupplyHouseId('')
                                        setAddPriceValue('')
                                      }}
                                      style={{ marginLeft: '0.5rem', marginTop: '0.5rem', padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                                    >
                                      Cancel
                                    </button>
                                  </>
                                )}
                              </div>
                            ) : selectedPO.status === 'draft' ? (
                              <select
                                value={item.supply_house?.id ?? ''}
                                onFocus={() => loadSupplyHouseOptionsForPart(item.part.id)}
                                onChange={(e) => {
                                  const val = e.target.value
                                  if (val === '') {
                                    updatePOItemSupplyHouse(item.id, '', 0)
                                    return
                                  }
                                  const opts = draftPOSupplyHouseOptionsPartId === item.part.id ? draftPOSupplyHouseOptions : []
                                  const opt = opts.find(o => o.supply_house_id === val)
                                  if (opt) updatePOItemSupplyHouse(item.id, opt.supply_house_id, opt.price)
                                  else if (item.supply_house?.id === val) updatePOItemSupplyHouse(item.id, item.supply_house.id, item.price_at_time)
                                }}
                                style={{ minWidth: '10rem', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                              >
                                {draftPOSupplyHouseOptionsPartId === item.part.id ? (
                                  loadingDraftPOSupplyHouseOptions ? (
                                    <option value={item.supply_house?.id ?? ''}>Loading...</option>
                                  ) : (
                                    <>
                                      <option value="">None</option>
                                      {item.supply_house && !draftPOSupplyHouseOptions.some(o => o.supply_house_id === item.supply_house?.id) && (
                                        <option value={item.supply_house.id}>{item.supply_house.name} - ${formatCurrency(item.price_at_time)}</option>
                                      )}
                                      {draftPOSupplyHouseOptions.map(o => (
                                        <option key={o.supply_house_id} value={o.supply_house_id}>{o.supply_house_name} - ${formatCurrency(o.price)}</option>
                                      ))}
                                    </>
                                  )
                                ) : (
                                  <option value={item.supply_house?.id ?? ''}>{item.supply_house ? `${item.supply_house.name} - $${formatCurrency(item.price_at_time)}` : 'None'}</option>
                                )}
                              </select>
                            ) : (
                              item.supply_house?.name || '-'
                            )}
                          </td>
                          <td style={{ padding: '0.75rem' }}>${formatCurrency(item.price_at_time)}</td>
                          <td style={{ padding: '0.75rem', fontWeight: 600 }}>${formatCurrency(item.price_at_time * item.quantity)}</td>
                          <td style={{ padding: '0.75rem' }}>
                            {item.source_template ? (
                              <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: '#eff6ff', color: '#1d4ed8', borderRadius: 4 }} title={`From: ${item.source_template.name}`}>
                                From: {item.source_template.name}
                              </span>
                            ) : '—'}
                          </td>
                          <td style={{ padding: '0.75rem', maxWidth: 200 }}>{item.notes?.trim() || '—'}</td>
                          {selectedPO.status === 'draft' && (
                            <td style={{ padding: '0.75rem' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                  <input
                                    type="checkbox"
                                    checked={!!item.price_confirmed_at}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        confirmPOItemPrice(item.id, item.part.id, item.supply_house?.id || null, item.price_at_time)
                                      } else {
                                        unconfirmPOItemPrice(item.id)
                                      }
                                    }}
                                    disabled={confirmingPriceForItem === item.id}
                                    style={{ cursor: confirmingPriceForItem === item.id ? 'not-allowed' : 'pointer' }}
                                  />
                                  {confirmingPriceForItem === item.id && (
                                    <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Updating...</span>
                                  )}
                                </label>
                                {item.price_confirmed_at && (
                                  <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '1.5rem' }}>
                                    {formatTimeSince(item.price_confirmed_at)}
                                  </span>
                                )}
                              </div>
                            </td>
                          )}
                          {selectedPO.status === 'draft' && (
                            <td style={{ padding: '0.75rem' }}>
                              {!isEditing ? (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setEditingPOItemSupplyHouseView(item.id)
                                    await loadAvailablePricesForPart(item.part.id)
                                  }}
                                  style={{ padding: '0.25rem 0.5rem', background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd', borderRadius: 4, cursor: 'pointer' }}
                                >
                                  Update
                                </button>
                              ) : null}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot style={{ background: '#f9fafb' }}>
                    {(() => {
                      const viewedPOGrandTotal = selectedPO.items.reduce((sum, item) => sum + (Number(item.price_at_time) * Number(item.quantity)), 0) || 0
                      const withTaxAmount = viewedPOGrandTotal * (1 + (parseFloat(viewedPOTaxPercent) || 0) / 100)
                      return (
                        <>
                          <tr>
                            <td colSpan={selectedPO.status === 'draft' ? 6 : 5} style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>Grand Total:</td>
                            <td style={{ padding: '0.75rem', fontWeight: 600 }}>
                              ${formatCurrency(viewedPOGrandTotal)}
                            </td>
                          </tr>
                          <tr>
                            <td colSpan={selectedPO.status === 'draft' ? 6 : 5} style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>
                              With Tax{' '}
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={viewedPOTaxPercent}
                                onChange={(e) => setViewedPOTaxPercent(e.target.value)}
                                style={{ width: '6rem', padding: '0.25rem 0.5rem', margin: '0 0.25rem', border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'right' }}
                              />
                              %:
                            </td>
                            <td style={{ padding: '0.75rem', fontWeight: 600 }}>
                              ${formatCurrency(withTaxAmount)}
                            </td>
                          </tr>
                        </>
                      )
                    })()}
                  </tfoot>
                </table>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedPO) {
                      deletePO(selectedPO.id)
                      setSelectedPO(null)
                      setEditingPOItemSupplyHouseView(null)
                      setAvailablePricesForItem([])
                      setEditingPricesByPriceId({})
                      setAddPriceSupplyHouseId('')
                      setAddPriceValue('')
                      if (editingPO?.id === selectedPO.id) {
                        setEditingPO(null)
                      }
                    }
                  }}
                  style={{ padding: '0.5rem 1rem', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer' }}
                >
                  Delete
                </button>
                <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
                  <button
                    type="button"
                    onClick={() => printPO(selectedPO)}
                    style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Print for Review
                  </button>
                  <button
                    type="button"
                    onClick={() => printPOForSupplyHouse(selectedPO, parseFloat(viewedPOTaxPercent) || 0)}
                    style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Print for Supply House
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPO(null)
                      setEditingPOItemSupplyHouseView(null)
                      setAvailablePricesForItem([])
                      setEditingPricesByPriceId({})
                      setAddPriceSupplyHouseId('')
                      setAddPriceValue('')
                    }}
                    style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Close
                  </button>
                  {selectedPO.status === 'finalized' && (
                    <>
                      <button
                        type="button"
                        onClick={() => duplicatePOAsDraft(selectedPO.id)}
                        disabled={duplicatingPO === selectedPO.id}
                        style={{ 
                          padding: '0.5rem 1rem', 
                          background: duplicatingPO === selectedPO.id ? '#9ca3af' : '#059669', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: 4, 
                          cursor: duplicatingPO === selectedPO.id ? 'not-allowed' : 'pointer' 
                        }}
                      >
                        {duplicatingPO === selectedPO.id ? 'Duplicating...' : 'Duplicate as Draft'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          window.location.href = '/projects'
                        }}
                        style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                      >
                        Go to Projects to Add
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search purchase orders..."
              value={poSearchQuery}
              onChange={(e) => setPoSearchQuery(e.target.value)}
              style={{ flex: 1, minWidth: 200, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
            />
            <select
              value={poStatusFilter}
              onChange={(e) => setPoStatusFilter(e.target.value as 'all' | 'draft' | 'finalized')}
              style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="finalized">Finalized</option>
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
              Tax %
              <input
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={viewedPOTaxPercent}
                onChange={(e) => setViewedPOTaxPercent(e.target.value)}
                style={{ width: '5rem', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'right' }}
              />
            </label>
          </div>

          <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Name</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Status</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Items</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Total</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Total with tax</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Created</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPOs.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                      {poSearchQuery || poStatusFilter !== 'all' ? 'No purchase orders match your filters' : 'No purchase orders yet.'}
                    </td>
                  </tr>
                ) : (
                  filteredPOs.map(po => {
                    const total = po.items.reduce((sum, item) => sum + (item.price_at_time * item.quantity), 0)
                    const taxPercent = parseFloat(viewedPOTaxPercent) || 8.25
                    const totalWithTax = total * (1 + taxPercent / 100)
                    return (
                      <tr key={po.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '0.75rem' }}>{po.name}</td>
                        <td style={{ padding: '0.75rem' }}>
                          <span style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: 4,
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            background: po.status === 'finalized' ? '#d1fae5' : '#fef3c7',
                            color: po.status === 'finalized' ? '#065f46' : '#92400e',
                          }}>
                            {po.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem' }}>{po.items.length}</td>
                        <td style={{ padding: '0.75rem', fontWeight: 600 }}>${formatCurrency(total)}</td>
                        <td style={{ padding: '0.75rem', fontWeight: 600 }}>${formatCurrency(totalWithTax)}</td>
                        <td style={{ padding: '0.75rem' }}>
                          {po.created_at ? new Date(po.created_at).toLocaleDateString() : '-'}
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          <button
                            type="button"
                            onClick={() => setSelectedPO(po)}
                            style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                          >
                            View
                          </button>
                          {po.status === 'draft' && (
                            <button
                              type="button"
                              onClick={() => finalizePO(po.id)}
                              style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', background: '#d1fae5', color: '#065f46', border: '1px solid #86efac', borderRadius: 4, cursor: 'pointer' }}
                            >
                              Finalize
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

type PriceHistory = Database['public']['Tables']['material_part_price_history']['Row'] & {
  supply_house: SupplyHouse
}

// Component for managing part prices
function PartPricesManager({
  part,
  supplyHouses,
  onClose,
  onPricesUpdated,
}: {
  part: MaterialPart
  supplyHouses: SupplyHouse[]
  onClose: () => void
  onPricesUpdated: (prices: (MaterialPartPrice & { supply_house: SupplyHouse })[]) => void
}) {
  const [prices, setPrices] = useState<(MaterialPartPrice & { supply_house: SupplyHouse })[]>([])
  const [loading, setLoading] = useState(true)
  const [editingPrice, setEditingPrice] = useState<MaterialPartPrice | null>(null)
  const [selectedSupplyHouse, setSelectedSupplyHouse] = useState('')
  const [price, setPrice] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [viewingPriceHistory, setViewingPriceHistory] = useState<string | null>(null) // supply_house_id being viewed
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  useEffect(() => {
    loadPrices()
  }, [part.id])

  async function loadPrices() {
    setLoading(true)
    const { data, error } = await supabase
      .from('material_part_prices')
      .select('*, supply_houses(*)')
      .eq('part_id', part.id)
      .order('price', { ascending: true })
    
    if (error) {
      console.error('Error loading prices:', error)
    } else {
      const pricesList = (data as unknown as (MaterialPartPrice & { supply_houses: SupplyHouse })[]) ?? []
      const normalized = pricesList.map(p => ({ ...p, supply_house: p.supply_houses }))
      setPrices(normalized)
      onPricesUpdated(normalized)
    }
    setLoading(false)
  }

  function openEditPrice(priceItem: MaterialPartPrice) {
    setEditingPrice(priceItem)
    setSelectedSupplyHouse(priceItem.supply_house_id)
    setPrice(priceItem.price.toString())
    setEffectiveDate(priceItem.effective_date || '')
  }

  async function savePrice(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedSupplyHouse || !price) {
      return
    }
    setSaving(true)
    const priceNum = parseFloat(price)
    if (isNaN(priceNum) || priceNum <= 0) {
      alert('Please enter a valid price')
      setSaving(false)
      return
    }

    if (editingPrice) {
      const { error } = await supabase
        .from('material_part_prices')
        .update({
          price: priceNum,
          effective_date: effectiveDate || null,
        })
        .eq('id', editingPrice.id)
      if (error) {
        alert(`Failed to update price: ${error.message}`)
      } else {
        await loadPrices()
        setEditingPrice(null)
        onClose()
      }
    } else {
      const { error } = await supabase
        .from('material_part_prices')
        .insert({
          part_id: part.id,
          supply_house_id: selectedSupplyHouse,
          price: priceNum,
          effective_date: effectiveDate || null,
        })
      if (error) {
        alert(`Failed to add price: ${error.message}`)
      } else {
        await loadPrices()
        setSelectedSupplyHouse('')
        setPrice('')
        setEffectiveDate('')
        onClose()
      }
    }
    setSaving(false)
  }

  async function deletePrice(priceId: string) {
    if (!confirm('Delete this price?')) return
    const { error } = await supabase.from('material_part_prices').delete().eq('id', priceId)
    if (error) {
      alert(`Failed to delete price: ${error.message}`)
    } else {
      await loadPrices()
      onClose()
    }
  }

  async function loadPriceHistory(supplyHouseId: string) {
    setViewingPriceHistory(supplyHouseId)
    setLoadingHistory(true)
    const { data, error } = await supabase
      .from('material_part_price_history')
      .select('*, supply_houses(*)')
      .eq('part_id', part.id)
      .eq('supply_house_id', supplyHouseId)
      .order('changed_at', { ascending: false })
    
    if (error) {
      console.error('Error loading price history:', error)
      alert(`Failed to load price history: ${error.message}`)
    } else {
      const historyList = (data as unknown as (Database['public']['Tables']['material_part_price_history']['Row'] & { supply_houses: SupplyHouse })[]) ?? []
      setPriceHistory(historyList.map(h => ({ ...h, supply_house: h.supply_houses })))
    }
    setLoadingHistory(false)
  }

  const availableSupplyHouses = supplyHouses.filter(sh => !prices.find(p => p.supply_house_id === sh.id && p.id !== editingPrice?.id))

  return (
    <div>
      {loading ? (
        <p>Loading prices...</p>
      ) : (
        <>
          {(editingPrice || (!editingPrice && availableSupplyHouses.length > 0)) && (
            <form onSubmit={savePrice} style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f9fafb', borderRadius: 4 }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Supply House *</label>
                <select
                  value={selectedSupplyHouse}
                  onChange={(e) => setSelectedSupplyHouse(e.target.value)}
                  required
                  disabled={!!editingPrice}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                >
                  <option value="">Select supply house</option>
                  {availableSupplyHouses.map(sh => (
                    <option key={sh.id} value={sh.id}>{sh.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Price *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Effective Date</label>
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                  >
                    {saving ? 'Saving...' : editingPrice ? 'Update' : 'Add'}
                  </button>
                  {editingPrice && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPrice(null)
                        setSelectedSupplyHouse('')
                        setPrice('')
                        setEffectiveDate('')
                      }}
                      style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
                {editingPrice && (
                  <button
                    type="button"
                    onClick={() => {
                      if (editingPrice) {
                        deletePrice(editingPrice.id)
                      }
                    }}
                    style={{ padding: '0.5rem 1rem', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </form>
          )}

          <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Supply House</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Price</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Effective Date</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {prices.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                      No prices yet. Add prices from different supply houses.
                    </td>
                  </tr>
                ) : (
                  prices.map(p => {
                    const isBest = prices.length > 0 && prices[0] && prices[0].id === p.id
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '0.75rem' }}>{p.supply_house?.name || 'Unknown'}</td>
                        <td style={{ padding: '0.75rem', fontWeight: isBest ? 600 : 400, color: isBest ? '#059669' : 'inherit' }}>
                          ${p.price.toFixed(2)} {isBest && '(Best)'}
                        </td>
                        <td style={{ padding: '0.75rem' }}>{p.effective_date || '-'}</td>
                        <td style={{ padding: '0.75rem' }}>
                          <button
                            type="button"
                            onClick={() => loadPriceHistory(p.supply_house_id || '')}
                            style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd', borderRadius: 4, cursor: 'pointer' }}
                          >
                            History
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditPrice(p)}
                            style={{ padding: '0.25rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Price History View */}
          {viewingPriceHistory && (
            <div style={{ marginTop: '2rem', padding: '1rem', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>Price History</h3>
                <button
                  type="button"
                  onClick={() => {
                    setViewingPriceHistory(null)
                    setPriceHistory([])
                  }}
                  style={{ padding: '0.25rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                >
                  Close History
                </button>
              </div>

              {loadingHistory ? (
                <p>Loading history...</p>
              ) : priceHistory.length === 0 ? (
                <p style={{ color: '#6b7280' }}>No price history available for this supply house.</p>
              ) : (
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#f9fafb' }}>
                      <tr>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Date Changed</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Old Price</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>New Price</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Change %</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Effective Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {priceHistory.map((h) => {
                        const changePercent = h.price_change_percent
                        const isIncrease = changePercent !== null && changePercent > 0
                        const isDecrease = changePercent !== null && changePercent < 0
                        return (
                          <tr key={h.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '0.75rem' }}>
                              {h.changed_at ? new Date(h.changed_at).toLocaleDateString() : '-'}
                            </td>
                            <td style={{ padding: '0.75rem' }}>
                              {h.old_price !== null ? `$${h.old_price.toFixed(2)}` : '-'}
                            </td>
                            <td style={{ padding: '0.75rem', fontWeight: 500 }}>${h.new_price.toFixed(2)}</td>
                            <td style={{ 
                              padding: '0.75rem',
                              fontWeight: 600,
                              color: isIncrease ? '#059669' : isDecrease ? '#dc2626' : '#6b7280'
                            }}>
                              {changePercent !== null 
                                ? `${isIncrease ? '+' : ''}${changePercent.toFixed(2)}%`
                                : '-'
                              }
                            </td>
                            <td style={{ padding: '0.75rem' }}>
                              {h.effective_date || '-'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
      <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onClose}
          style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
        >
          Close
        </button>
      </div>
    </div>
  )
}
