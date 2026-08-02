import { useEffect, useRef, useState } from 'react'
import { pageTabStyle } from '../lib/pageTabStyle'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { addExpandedPartsToPO, expandTemplate } from '../lib/materialPOUtils'
import {
  loadPOItemsWithDetails,
  type PurchaseOrderWithItems,
} from '../lib/materials/poItemDetails'
import { calculateAssemblyCost as calculateAssemblyCostKernel } from '../lib/materials/assemblyCost'
import { groupSupplyHouseStats, type SupplyHouseStatsRow } from '../lib/materials/supplyHouseStats'
import { formatCurrency } from '../lib/format'
import {
  filterPartsByQuery,
  filterTemplatesByQuery,
} from '../lib/materials/materialsFilters'
import { useAuth } from '../hooks/useAuth'
import { isAssistantLike } from '../lib/subcontractorLikeRole'
import { Database } from '../types/database'
import { PartFormModal } from '../components/PartFormModal'
import { SupplyHousesTab } from '../components/SupplyHousesTab'
import { MaterialsPoGeneratorTab } from '../components/materials/MaterialsPoGeneratorTab'
import { MaterialsPurchaseOrdersTab } from '../components/materials/MaterialsPurchaseOrdersTab'
import { MaterialsPartsBookTab } from '../components/materials/MaterialsPartsBookTab'
import { useMaterialsPurchaseOrders } from '../hooks/useMaterialsPurchaseOrders'
import { useMaterialsCatalog } from '../hooks/useMaterialsCatalog'
import { useMaterialsAssemblies } from '../hooks/useMaterialsAssemblies'
import { PartPricesManager } from '../components/materials/PartPricesManager'
import { TemplatePricesManager } from '../components/materials/TemplatePricesManager'
import { SupplyHouseForm } from '../components/SupplyHouseForm'

type SupplyHouse = Database['public']['Tables']['supply_houses']['Row']
type MaterialPart = Database['public']['Tables']['material_parts']['Row']
type MaterialPartPrice = Database['public']['Tables']['material_part_prices']['Row']
type MaterialTemplate = Database['public']['Tables']['material_templates']['Row']
type PurchaseOrder = Database['public']['Tables']['purchase_orders']['Row']
type UserRole = 'dev' | 'master_technician' | 'assistant' | 'estimator' | 'primary' | 'superintendent'

interface ServiceType {
  id: string
  name: string
  description: string | null
  color: string | null
  sequence_order: number
  created_at: string
  updated_at: string
}


// POItemWithDetails / PurchaseOrderWithItems now live in lib/materials/poItemDetails

// PoGenerator* types now live in components/materials/MaterialsPoGeneratorTab


// fetchPricesForParts now lives in lib/materials/partPrices; formatCurrency in lib/format

const MATERIALS_TABS = ['parts-book', 'assembly-book', 'assemblies-po', 'purchase-orders', 'supply-houses', 'po-generator'] as const

export default function Materials() {
  const { user: authUser } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [myRole, setMyRole] = useState<UserRole | null>(null)
  const [activeTab, setActiveTab] = useState<
    'parts-book' | 'assembly-book' | 'assemblies-po' | 'purchase-orders' | 'supply-houses' | 'po-generator'
  >('parts-book')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Service Types state
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
  const [selectedServiceTypeId, setSelectedServiceTypeId] = useState<string>('')
  const [estimatorServiceTypeIds, setEstimatorServiceTypeIds] = useState<string[] | null>(null)
  const [primaryServiceTypeIds, setPrimaryServiceTypeIds] = useState<string[] | null>(null)
  const [superintendentServiceTypeIds, setSuperintendentServiceTypeIds] = useState<string[] | null>(null)

  // Parts catalog engine (parts/allParts caches, search/filter/sort, pagination,
  // Load-All persistence, partTypes/assemblyTypes/supplyHouses) — see the hook.
  const {
    partTypes,
    parts,
    setParts,
    supplyHouses,
    searchQuery,
    setSearchQuery,
    filterPartTypeId,
    setFilterPartTypeId,
    filterManufacturer,
    setFilterManufacturer,
    sortByPriceCountAsc,
    setSortByPriceCountAsc,
    setPartsPage,
    hasMoreParts,
    loadingPartsPage,
    loadAllMode,
    setLoadAllMode,
    allParts,
    setAllParts,
    loadingAllParts,
    clientSearchQuery,
    setClientSearchQuery,
    assemblyTypes,
    LOAD_ALL_MODE_KEY,
    loadPartTypes,
    loadAssemblyTypes,
    loadSupplyHouses,
    loadParts,
    loadAllParts,
    reloadPartsFirstPage,
    setHasMoreParts,
  } = useMaterialsCatalog({
    activeTab,
    authUserId: authUser?.id,
    selectedServiceTypeId,
    setError,
  })

  // Parts Book state
  const [editingPart, setEditingPart] = useState<MaterialPart | null>(null)
  const [partFormOpen, setPartFormOpen] = useState(false)
  const [partFormInitialName, setPartFormInitialName] = useState('')
  const [viewingPartPrices, setViewingPartPrices] = useState<MaterialPart | null>(null)
  const [expandedPartId, setExpandedPartId] = useState<string | null>(null)
  const [editingItemQuantityId, setEditingItemQuantityId] = useState<string | null>(null)
  const [editingItemQuantityValue, setEditingItemQuantityValue] = useState('')
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

  // Load All Mode state - persisted per user in localStorage, default off to reduce disk IO

  // Supply House Management state
  const [viewingSupplyHouses, setViewingSupplyHouses] = useState(false)
  const [supplyHouseFormOpen, setSupplyHouseFormOpen] = useState(false)
  const [editingSupplyHouse, setEditingSupplyHouse] = useState<SupplyHouse | null>(null)
  const [supplyHouseName, setSupplyHouseName] = useState('')
  const [supplyHouseContactName, setSupplyHouseContactName] = useState('')
  const [supplyHousePhone, setSupplyHousePhone] = useState('')
  const [supplyHouseEmail, setSupplyHouseEmail] = useState('')
  const [supplyHouseAddress, setSupplyHouseAddress] = useState('')
  const [supplyHouseWebsiteUrl, setSupplyHouseWebsiteUrl] = useState('')
  const [supplyHouseNotes, setSupplyHouseNotes] = useState('')
  const [supplyHouseMonthlyPaymentDay, setSupplyHouseMonthlyPaymentDay] = useState('')
  const [savingSupplyHouse, setSavingSupplyHouse] = useState(false)

  // Templates & PO Builder state
  // NAMING: the UI calls these ASSEMBLIES everywhere (Assembly Book,
  // "From assembly", Bids Takeoff). Code identifiers and the DB stay on the
  // original material_templates naming — DB is append-only and the
  // identifiers match it on purpose. See docs/GLOSSARY.md → Assembly.
  // Assembly cluster engine (templates cache, shared selectedTemplate/templateItems,
  // shared filters incl. the dual-tab dropdown ref, stats caches) — see the hook.
  const {
    materialTemplates,
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
  } = useMaterialsAssemblies({ selectedServiceTypeId, setError })
  const [draftPOSearch, setDraftPOSearch] = useState('')
  // PO engine (allPOs/draftPOs/selectedPO/editingPO/userNamesMap + loadPurchaseOrders)
  // now lives in useMaterialsPurchaseOrders, destructured below the error state.
  const [templateFormOpen, setTemplateFormOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<MaterialTemplate | null>(null)
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [templateAssemblyTypeId, setTemplateAssemblyTypeId] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [addingItemToTemplate, setAddingItemToTemplate] = useState(false)
  const [newItemType, setNewItemType] = useState<'part' | 'template'>('part')
  const [newItemPartId, setNewItemPartId] = useState('')
  const [templatePartSearchQuery, setTemplatePartSearchQuery] = useState('')
  const [templatePartDropdownOpen, setTemplatePartDropdownOpen] = useState(false)
  const [newItemTemplateId, setNewItemTemplateId] = useState('')
  const [newItemTemplateSearchQuery, setNewItemTemplateSearchQuery] = useState('')
  const [newItemTemplateDropdownOpen, setNewItemTemplateDropdownOpen] = useState(false)
  const [newItemFilterAssemblyTypeId, setNewItemFilterAssemblyTypeId] = useState('')
  const [newItemQuantity, setNewItemQuantity] = useState('1')
  const [newItemNotes, setNewItemNotes] = useState('')
  const [creatingPOFromTemplate, setCreatingPOFromTemplate] = useState(false)
  const [addingTemplateToPO, setAddingTemplateToPO] = useState(false)
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
  const [editingPOName, setEditingPOName] = useState<string | null>(null)
  const [editingPONameValue, setEditingPONameValue] = useState('')

  // Add Item Modal (Assembly Book)
  const [addItemModalOpen, setAddItemModalOpen] = useState(false)
  const [addItemModalType, setAddItemModalType] = useState<'part' | 'template'>('part')
  const [addItemModalPartId, setAddItemModalPartId] = useState('')
  const [addItemModalTemplateId, setAddItemModalTemplateId] = useState('')
  const [addItemModalSearchQuery, setAddItemModalSearchQuery] = useState('')
  const [addItemModalQuantity, setAddItemModalQuantity] = useState('1')
  const [addItemModalDropdownOpen, setAddItemModalDropdownOpen] = useState(false)
  const [addingItemFromModal, setAddingItemFromModal] = useState(false)
  const [addItemModalError, setAddItemModalError] = useState<string | null>(null)
  const [addItemModalFilterPartTypeId, setAddItemModalFilterPartTypeId] = useState('')
  const [addItemModalFilterAssemblyTypeId, setAddItemModalFilterAssemblyTypeId] = useState('')

  const templatePartPickerRef = useRef<HTMLDivElement>(null)
  const templateItemsSectionRef = useRef<HTMLDivElement>(null)
  const editingPODetailRef = useRef<HTMLDivElement>(null)
  const selectedPODetailRef = useRef<HTMLDivElement>(null)

  // Purchase Orders state (poStatusFilter/poSearchQuery/viewedPOTaxPercent/notes/
  // duplicate/confirm state moved into MaterialsPurchaseOrdersTab)
  const {
    allPOs,
    setAllPOs,
    draftPOs,
    setDraftPOs,
    selectedPO,
    setSelectedPO,
    editingPO,
    setEditingPO,
    userNamesMap,
    setUserNamesMap,
    loadPurchaseOrders,
  } = useMaterialsPurchaseOrders({ selectedServiceTypeId, onError: setError })

  // poGen* state cluster moved into MaterialsPoGeneratorTab

  async function loadRole() {
    if (!authUser?.id) {
      setLoading(false)
      return
    }
    const { data: me, error: eMe } = await supabase
      .from('users')
      .select('role, estimator_service_type_ids, primary_service_type_ids, superintendent_service_type_ids')
      .eq('id', authUser.id)
      .single()
    if (eMe) {
      setError(eMe.message)
      setLoading(false)
      return
    }
    const role = (me as { role: UserRole; estimator_service_type_ids?: string[] | null; primary_service_type_ids?: string[] | null; superintendent_service_type_ids?: string[] | null } | null)?.role ?? null
    const estIds = (me as { estimator_service_type_ids?: string[] | null } | null)?.estimator_service_type_ids
    const primIds = (me as { primary_service_type_ids?: string[] | null } | null)?.primary_service_type_ids
    const supIds = (me as { superintendent_service_type_ids?: string[] | null } | null)?.superintendent_service_type_ids
    setMyRole(role)
    if (role === 'estimator' && estIds && estIds.length > 0) {
      setEstimatorServiceTypeIds(estIds)
    } else {
      setEstimatorServiceTypeIds(null)
    }
    if (role === 'primary' && primIds && primIds.length > 0) {
      setPrimaryServiceTypeIds(primIds)
    } else {
      setPrimaryServiceTypeIds(null)
    }
    if (role === 'superintendent' && supIds && supIds.length > 0) {
      setSuperintendentServiceTypeIds(supIds)
    } else {
      setSuperintendentServiceTypeIds(null)
    }
    if (role !== 'dev' && role !== 'master_technician' && !isAssistantLike(role) && role !== 'estimator' && role !== 'primary' && role !== 'superintendent') {
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
    
    // For estimators or primaries with restrictions, filter to allowed types
    let visibleTypes = types
    if (estimatorServiceTypeIds && estimatorServiceTypeIds.length > 0) {
      visibleTypes = types.filter((st) => estimatorServiceTypeIds.includes(st.id))
    } else if (primaryServiceTypeIds && primaryServiceTypeIds.length > 0) {
      visibleTypes = types.filter((st) => primaryServiceTypeIds.includes(st.id))
    } else if (superintendentServiceTypeIds && superintendentServiceTypeIds.length > 0) {
      visibleTypes = types.filter((st) => superintendentServiceTypeIds.includes(st.id))
    }
    const firstId = visibleTypes[0]?.id
    if (firstId) {
      // Set or adjust selected: use first allowed, or keep current if still valid
      setSelectedServiceTypeId((prev) => {
        if (!prev || !visibleTypes.some((st) => st.id === prev)) return firstId
        return prev
      })
    }
  }


  async function loadSupplyHouseStatsByServiceType() {
    const { data, error } = await supabase
      .rpc('get_supply_house_stats_by_service_type' as any)

    if (error) {
      console.error('Failed to load supply house stats:', error)
      return
    }

    const rows = (data as unknown as SupplyHouseStatsRow[] | null) ?? []
    setSupplyHouseStatsByServiceType(groupSupplyHouseStats(rows))
  }

  async function handleNavigateToPOFromSupplyHouses(poId: string) {
    setActiveTab('purchase-orders')
    const { data: poData } = await supabase.from('purchase_orders').select('*').eq('id', poId).single()
    if (poData) {
      const itemsWithDetails = await loadPOItemsWithDetails(supabase, poId)
      const poWithItems: PurchaseOrderWithItems = { ...(poData as PurchaseOrder), items: itemsWithDetails ?? [] }
      setEditingPO(poWithItems)
      setSelectedPO(poWithItems)
      setDraftPOs(prev => (prev.some(p => p.id === poId) ? prev : [poWithItems, ...prev]))
      setAllPOs(prev => (prev.some(p => p.id === poId) ? prev : [poWithItems, ...prev]))
      await loadPurchaseOrders()
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          selectedPODetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
      })
    }
  }

  useEffect(() => {
    loadRole()
  }, [authUser?.id])

  useEffect(() => {
    let tab = searchParams.get('tab')
    // Back-compat: the Materials "Price Book" tab slug was renamed to "parts-book".
    if (tab === 'price-book') {
      tab = 'parts-book'
      setActiveTab('parts-book')
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'parts-book')
        return next
      }, { replace: true })
      return
    }
    // Back-compat: the "Templates & PO" tab slug was renamed to "assemblies-po"
    // when the Assembly vocabulary converged (v2.1258). Old pins keep working.
    if (tab === 'templates-po') {
      tab = 'assemblies-po'
      setActiveTab('assemblies-po')
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'assemblies-po')
        return next
      }, { replace: true })
      return
    }
    const restrictedPrimarySuper =
      tab === 'supply-houses' ||
      tab === 'po-generator' ||
      tab === 'assemblies-po' ||
      tab === 'purchase-orders'
    if ((myRole === 'primary' || myRole === 'superintendent') && restrictedPrimarySuper) {
      setActiveTab('parts-book')
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'parts-book')
        return next
      }, { replace: true })
    } else if (myRole === 'estimator' && (tab === 'supply-houses' || tab === 'po-generator')) {
      setActiveTab('parts-book')
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'parts-book')
        return next
      }, { replace: true })
    } else if (tab && MATERIALS_TABS.includes(tab as typeof MATERIALS_TABS[number])) {
      setActiveTab(tab as typeof activeTab)
    } else if (!tab) {
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'parts-book')
        return next
      }, { replace: true })
    }
  }, [searchParams, myRole])

  useEffect(() => {
    if (searchParams.get('addPart') === 'true') {
      setPartFormOpen(true)
      setEditingPart(null)
      setPartFormInitialName('')
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.delete('addPart')
        return next
      }, { replace: true })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (searchParams.get('addAssembly') === 'true') {
      setEditingTemplate(null)
      setTemplateName('')
      setTemplateDescription('')
      setTemplateAssemblyTypeId('')
      setTemplateFormOpen(true)
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.delete('addAssembly')
        return next
      }, { replace: true })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (myRole === 'dev' || myRole === 'master_technician' || isAssistantLike(myRole) || myRole === 'estimator' || myRole === 'primary' || myRole === 'superintendent') {
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
  }, [myRole, estimatorServiceTypeIds, primaryServiceTypeIds, superintendentServiceTypeIds])

  // Restore Load All mode preference from localStorage (per user); default off so filter dropdowns work
  // Reload data when service type or loadAllMode changes
  useEffect(() => {
    if (selectedServiceTypeId && (myRole === 'dev' || myRole === 'master_technician' || isAssistantLike(myRole) || myRole === 'estimator' || myRole === 'primary' || myRole === 'superintendent')) {
      setFilterPartTypeId('')
      setFilterManufacturer('')
      const loadForServiceType = async () => {
        setPartsPage(0)
        setHasMoreParts(true)
        setParts([])     // Clear paginated mode data
        setAllParts([])  // Clear Load All mode data
        const commonLoads = [
          loadSupplyHouses(),
          loadPartTypes(),
          loadAssemblyTypes(),
          loadMaterialTemplates(),
          loadPurchaseOrders(),
          loadSupplyHouseStatsByServiceType(),
        ]
        if (loadAllMode) {
          await Promise.all([...commonLoads, loadAllParts(selectedServiceTypeId)])
        } else {
          await Promise.all([...commonLoads, loadParts(0, { serviceTypeId: selectedServiceTypeId })])
        }
      }
      loadForServiceType()
    }
  }, [selectedServiceTypeId, loadAllMode])

  useEffect(() => {
    const state = location.state as { refreshPrices?: boolean } | null
    if (!state?.refreshPrices) return
    reloadPartsFirstPage()
  }, [location.state])

  // Debounced search effect (filters apply immediately)

  useEffect(() => {
    if (selectedTemplate) {
      loadTemplateItems(selectedTemplate.id)
    }
  }, [selectedTemplate])

  useEffect(() => {
    if (activeTab === 'assemblies-po' || activeTab === 'assembly-book') {
      loadAllTemplateItemsForStats()
    }
  }, [activeTab, selectedServiceTypeId])



  // Open a specific PO when navigating from Jobs Parts, Bids, Quickfill (state or ?po= URL param)
  useEffect(() => {
    const openPOId = (location.state as { openPOId?: string } | null)?.openPOId ?? searchParams.get('po')
    if (!openPOId) return
    setActiveTab('purchase-orders')
    const loadPO = async () => {
      const { data: poData } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', openPOId)
        .single()
      if (poData) {
        const itemsWithDetails = await loadPOItemsWithDetails(supabase, openPOId)
        if (itemsWithDetails) {
          const poWithItems = { ...poData as PurchaseOrder, items: itemsWithDetails }
          setEditingPO(poWithItems)
          setSelectedPO(poWithItems)
          setDraftPOs((prev) => (prev.some((p) => p.id === openPOId) ? prev : [poWithItems, ...prev]))
          setAllPOs((prev) => (prev.some((p) => p.id === openPOId) ? prev : [poWithItems, ...prev]))
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              selectedPODetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            })
          })
        } else {
          const poWithItems = { ...poData as PurchaseOrder, items: [] }
          setEditingPO(poWithItems)
          setSelectedPO(poWithItems)
          setDraftPOs((prev) => (prev.some((p) => p.id === openPOId) ? prev : [poWithItems, ...prev]))
          setAllPOs((prev) => (prev.some((p) => p.id === openPOId) ? prev : [poWithItems, ...prev]))
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              selectedPODetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            })
          })
        }
      }
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.delete('po')
        return next
      }, { replace: true })
      if ((location.state as { openPOId?: string } | null)?.openPOId) {
        navigate('/materials?tab=purchase-orders', { replace: true, state: {} })
      }
    }
    loadPO()
  }, [location.state, searchParams])

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


  // Infinite scroll for parts pagination

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>
  }

  if (myRole !== 'dev' && myRole !== 'master_technician' && !isAssistantLike(myRole) && myRole !== 'estimator' && myRole !== 'primary' && myRole !== 'superintendent') {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Access denied. Only devs, masters, assistants, estimators, primaries, and superintendents can access materials.</div>
  }

  // filterPartsByQuery / filterTemplatesByQuery now live in lib/materials/materialsFilters



  // Templates with at least one item (part or nested assembly)
  const templateIdsWithItems = new Set(allTemplateItemsForStats.map(i => i.template_id))

  // Filter material templates by search (name, description)
  const draftPOSearchLower = draftPOSearch.trim().toLowerCase()
  const filteredDraftPOs = draftPOSearchLower
    ? draftPOs.filter(po => (po.name ?? '').toLowerCase().includes(draftPOSearchLower))
    : draftPOs

  const filteredTemplates = materialTemplates.filter(t => {
    const isEmpty = !templateIdsWithItems.has(t.id)
    const hasActiveFilter = filterIncludeEmpty || filterAssemblyTypeIds.length > 0
    const matchesEmpty = filterIncludeEmpty && isEmpty
    const matchesType = filterAssemblyTypeIds.length > 0 && t.assembly_type_id && filterAssemblyTypeIds.includes(t.assembly_type_id)
    if (hasActiveFilter && !matchesEmpty && !matchesType) return false
    
    // Search filter
    const q = templateSearchQuery.trim().toLowerCase()
    if (!q) return true
    
    // Include assembly type name in search
    const assemblyTypeName = assemblyTypes.find(at => at.id === t.assembly_type_id)?.name || ''
    return [t.name, t.description, assemblyTypeName].some(f => 
      (f || '').toLowerCase().includes(q)
    )
  })

  // Template stats: # of templates, % with at least one part item that has no price in the Parts Book
  const partIdsWithNoPrice = new Set(parts.filter(p => p.prices.length === 0).map(p => p.id))
  const templatesWithItemsWithNoPrice = materialTemplates.filter(t =>
    allTemplateItemsForStats.some(i =>
      i.template_id === t.id && i.item_type === 'part' && i.part_id != null && partIdsWithNoPrice.has(i.part_id)
    )
  ).length
  const templateStatsTotal = materialTemplates.length
  const templateStatsPctWithNoPrice = templateStatsTotal === 0 ? 0 : Math.round((templatesWithItemsWithNoPrice / templateStatsTotal) * 100)

  // Assembly cost calculation helper
  // Thin wrapper over the lib kernel, closing over the page's stats cache +
  // lowest-price map so call sites keep their (templateId, parentQuantity) shape.
  function calculateAssemblyCost(
    templateId: string,
    parentQuantity: number = 1,
    visited: Set<string> = new Set()
  ): { total: number; missingPrices: number; partCount: number; nestedCount: number } {
    return calculateAssemblyCostKernel(templateId, allTemplateItemsForStats, partIdToLowestPrice, parentQuantity, visited)
  }

  // Parts Book Tab Functions
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

  function openEditPart(part: MaterialPart & { part_type_id?: string | null }) {
    setEditingPart(part)
    setPartFormOpen(true)
    setError(null)
  }

  async function handlePartSaved(part: MaterialPart) {
    await reloadPartsFirstPage()
    if (loadAllMode) {
      await loadAllParts()
    }
    setPartFormOpen(false)
    if (addItemModalOpen && selectedTemplate && addItemModalType === 'part') {
      setAddItemModalPartId(part.id)
      setAddItemModalSearchQuery('')
      setAddItemModalDropdownOpen(false)
    }
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
    setSupplyHouseWebsiteUrl('')
    setSupplyHouseNotes('')
    setSupplyHouseMonthlyPaymentDay('')
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
    setSupplyHouseWebsiteUrl(supplyHouse.website_url || '')
    setSupplyHouseNotes(supplyHouse.notes || '')
    setSupplyHouseMonthlyPaymentDay(supplyHouse.monthly_payment_day != null ? String(supplyHouse.monthly_payment_day) : '')
    setSupplyHouseFormOpen(true)
    setError(null)
  }

  function closeSupplyHouseForm() {
    setSupplyHouseFormOpen(false)
    setEditingSupplyHouse(null)
  }

  async function saveSupplyHouseFromFormData(data: { name: string; contact_name: string; phone: string; email: string; address: string; website_url: string | null; notes: string; monthly_payment_day: number | null }) {
    if (!data.name.trim()) {
      setError('Supply house name is required')
      return
    }
    setSavingSupplyHouse(true)
    setError(null)

    if (editingSupplyHouse) {
      const { error: err } = await supabase
        .from('supply_houses')
        .update({
          name: data.name.trim(),
          contact_name: data.contact_name.trim() || null,
          phone: data.phone.trim() || null,
          email: data.email.trim() || null,
          address: data.address.trim() || null,
          website_url: data.website_url,
          notes: data.notes.trim() || null,
          monthly_payment_day: data.monthly_payment_day,
        })
        .eq('id', editingSupplyHouse.id)
      if (err) {
        setError(err.message)
      } else {
        await Promise.all([loadSupplyHouses(), reloadPartsFirstPage(), loadSupplyHouseStatsByServiceType()])
        closeSupplyHouseForm()
      }
    } else {
      const { error: err } = await supabase
        .from('supply_houses')
        .insert({
          name: data.name.trim(),
          contact_name: data.contact_name.trim() || null,
          phone: data.phone.trim() || null,
          email: data.email.trim() || null,
          address: data.address.trim() || null,
          website_url: data.website_url,
          notes: data.notes.trim() || null,
          monthly_payment_day: data.monthly_payment_day,
        })
      if (err) {
        setError(err.message)
      } else {
        await Promise.all([loadSupplyHouses(), reloadPartsFirstPage(), loadSupplyHouseStatsByServiceType()])
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
    setTemplateAssemblyTypeId('')
    setTemplateFormOpen(true)
    setError(null)
  }

  function openEditTemplate(template: MaterialTemplate) {
    setEditingTemplate(template)
    setTemplateName(template.name)
    setTemplateDescription(template.description || '')
    setTemplateAssemblyTypeId(template.assembly_type_id || '')
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
          assembly_type_id: templateAssemblyTypeId || null,
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
          assembly_type_id: templateAssemblyTypeId || null,
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

  async function updateItemQuantity(itemId: string, newQuantity: number) {
    if (newQuantity < 1) {
      setError('Quantity must be at least 1')
      return
    }

    const { error } = await supabase
      .from('material_template_items')
      .update({ quantity: newQuantity })
      .eq('id', itemId)

    if (error) {
      setError(error.message)
    } else {
      if (selectedTemplate) {
        await loadTemplateItems(selectedTemplate.id)
      }
      setEditingItemQuantityId(null)
      setEditingItemQuantityValue('')
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
          await loadAllTemplateItemsForStats()
          setNewItemPartId('')
          setNewItemTemplateId('')
          setNewItemTemplateSearchQuery('')
          setNewItemFilterAssemblyTypeId('')
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
      await loadAllTemplateItemsForStats()
      setNewItemPartId('')
      setNewItemTemplateId('')
      setNewItemTemplateSearchQuery('')
      setNewItemFilterAssemblyTypeId('')
      setNewItemQuantity('1')
      setNewItemNotes('')
    }
    setAddingItemToTemplate(false)
  }

  function closeAddItemModal() {
    setAddItemModalOpen(false)
    setAddItemModalPartId('')
    setAddItemModalTemplateId('')
    setAddItemModalSearchQuery('')
    setAddItemModalQuantity('1')
    setAddItemModalDropdownOpen(false)
    setAddItemModalError(null)
    setAddItemModalFilterPartTypeId('')
    setAddItemModalFilterAssemblyTypeId('')
  }

  async function handleAddItemFromModal() {
    if (!selectedTemplate) return
    if (addItemModalType === 'part' && !addItemModalPartId) {
      setAddItemModalError('Please select a part')
      return
    }
    if (addItemModalType === 'template' && !addItemModalTemplateId) {
      setAddItemModalError('Please select an assembly')
      return
    }
    const quantity = parseInt(addItemModalQuantity) || 1
    if (quantity < 1) {
      setAddItemModalError('Quantity must be at least 1')
      return
    }
    if (addItemModalType === 'template' && addItemModalTemplateId === selectedTemplate.id) {
      setAddItemModalError('Cannot add an assembly to itself')
      return
    }

    setAddingItemFromModal(true)
    setAddItemModalError(null)

    const partId = addItemModalType === 'part' ? addItemModalPartId : null
    const templateId = addItemModalType === 'template' ? addItemModalTemplateId : null

    if (addItemModalType === 'part' && partId) {
      const existing = templateItems.find((i) => i.item_type === 'part' && i.part_id === partId)
      if (existing) {
        const { error: updateErr } = await supabase
          .from('material_template_items')
          .update({ quantity: (existing.quantity ?? 1) + quantity })
          .eq('id', existing.id)
        if (updateErr) {
          setError(updateErr.message)
        } else {
          await loadTemplateItems(selectedTemplate.id)
          await loadAllTemplateItemsForStats()
          closeAddItemModal()
        }
        setAddingItemFromModal(false)
        return
      }
    }

    const maxOrder = templateItems.length === 0 ? 0 : Math.max(...templateItems.map(i => i.sequence_order))
    const { error } = await supabase
      .from('material_template_items')
      .insert({
        template_id: selectedTemplate.id,
        item_type: addItemModalType,
        part_id: partId,
        nested_template_id: templateId,
        quantity: quantity,
        sequence_order: maxOrder + 1,
        notes: null,
      })

    if (error) {
      setAddItemModalError(error.message)
    } else {
      await loadTemplateItems(selectedTemplate.id)
      await loadAllTemplateItemsForStats()
      closeAddItemModal()
    }
    setAddingItemFromModal(false)
  }

  async function removeItemFromTemplate(itemId: string) {
    if (!confirm('Remove this item from the assembly?')) return
    setError(null)
    // Optimistic update: remove from UI immediately
    setTemplateItems(prev => prev.filter(i => i.id !== itemId))
    const { error } = await supabase.from('material_template_items').delete().eq('id', itemId)
    if (error) {
      setError(error.message)
      if (selectedTemplate) {
        await loadTemplateItems(selectedTemplate.id)
      }
    } else if (selectedTemplate) {
      await loadAllTemplateItemsForStats()
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
        const itemsWithDetails = await loadPOItemsWithDetails(supabase, poId)
        if (itemsWithDetails) {
          setEditingPO({ ...poData as PurchaseOrder, items: itemsWithDetails })
        }
      }
    }
    setAddingTemplateToPO(false)
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
      const itemsWithDetails = await loadPOItemsWithDetails(supabase, editingPO.id)
      if (itemsWithDetails) {
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
      const itemsWithDetails = await loadPOItemsWithDetails(supabase, editingPO.id)
      if (itemsWithDetails) {
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
        const itemsWithDetails = await loadPOItemsWithDetails(supabase, selectedPO.id)
        if (itemsWithDetails) {
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


  // For estimators or primaries with restrictions, only show allowed service types
  const visibleServiceTypes = (myRole === 'estimator' && estimatorServiceTypeIds && estimatorServiceTypeIds.length > 0)
    ? serviceTypes.filter((st) => estimatorServiceTypeIds.includes(st.id))
    : (myRole === 'primary' && primaryServiceTypeIds && primaryServiceTypeIds.length > 0)
      ? serviceTypes.filter((st) => primaryServiceTypeIds.includes(st.id))
      : (myRole === 'superintendent' && superintendentServiceTypeIds && superintendentServiceTypeIds.length > 0)
        ? serviceTypes.filter((st) => superintendentServiceTypeIds.includes(st.id))
        : serviceTypes

  return (
    <div className="pageWrap" style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {error && (
        <div style={{ padding: '0.75rem', background: 'var(--bg-red-100)', color: 'var(--text-red-800)', borderRadius: 4, marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* Service Type Filter — hidden on Supply Houses, which doesn't filter by service type */}
      {visibleServiceTypes.length > 0 && activeTab !== 'supply-houses' && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {visibleServiceTypes.map(st => (
            <button
              key={st.id}
              type="button"
              onClick={() => setSelectedServiceTypeId(st.id)}
              style={{
                padding: '0.5rem 1rem',
                border: selectedServiceTypeId === st.id ? '2px solid #3b82f6' : '1px solid var(--border-strong)',
                background: selectedServiceTypeId === st.id ? 'var(--bg-blue-tint)' : 'var(--surface)',
                color: selectedServiceTypeId === st.id ? 'var(--text-blue-500)' : 'var(--text-700)',
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
      <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: '2rem', overflow: 'hidden' }}>
        <div style={{ flex: 1, minWidth: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ display: 'flex', gap: '1rem', width: 'max-content', alignItems: 'center' }}>
        {myRole !== 'estimator' && myRole !== 'primary' && myRole !== 'superintendent' && (
          <>
          <button
            type="button"
            onClick={() => {
              setActiveTab('supply-houses')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'supply-houses')
                return next
              })
            }}
            style={pageTabStyle(activeTab === 'supply-houses')}
          >
            Supply Houses
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('po-generator')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'po-generator')
                return next
              })
            }}
            style={pageTabStyle(activeTab === 'po-generator')}
          >
            PO Generator
          </button>
          <span style={{ color: 'var(--text-faint)', padding: '0 0.1rem', position: 'relative', top: '-1px', fontSize: '0.875rem' }}>|</span>
          </>
        )}
        <button
          type="button"
          onClick={() => {
            setActiveTab('parts-book')
            setSearchParams((p) => {
              const next = new URLSearchParams(p)
              next.set('tab', 'parts-book')
              return next
            })
          }}
          style={pageTabStyle(activeTab === 'parts-book')}
        >
          Parts Book
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('assembly-book')
            setSearchParams((p) => {
              const next = new URLSearchParams(p)
              next.set('tab', 'assembly-book')
              return next
            })
          }}
          style={pageTabStyle(activeTab === 'assembly-book')}
        >
          Assembly Book
        </button>
        {myRole !== 'primary' && myRole !== 'superintendent' && (
          <>
          <button
            type="button"
            onClick={() => {
              setActiveTab('assemblies-po')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'assemblies-po')
                return next
              })
            }}
            style={pageTabStyle(activeTab === 'assemblies-po')}
          >
            PO Builder
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('purchase-orders')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'purchase-orders')
                return next
              })
            }}
            style={pageTabStyle(activeTab === 'purchase-orders')}
          >
            Purchase Orders
          </button>
          </>
        )}
          </div>
        </div>
      </div>

      {/* Parts Book Tab — always mounted so expansion state survives tab switches */}
      <MaterialsPartsBookTab
        active={activeTab === 'parts-book'}
        authUser={authUser}
        parts={parts}
        allParts={allParts}
        partTypes={partTypes}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        clientSearchQuery={clientSearchQuery}
        setClientSearchQuery={setClientSearchQuery}
        filterPartTypeId={filterPartTypeId}
        setFilterPartTypeId={setFilterPartTypeId}
        filterManufacturer={filterManufacturer}
        setFilterManufacturer={setFilterManufacturer}
        sortByPriceCountAsc={sortByPriceCountAsc}
        setSortByPriceCountAsc={setSortByPriceCountAsc}
        hasMoreParts={hasMoreParts}
        loadingPartsPage={loadingPartsPage}
        loadAllMode={loadAllMode}
        setLoadAllMode={setLoadAllMode}
        loadingAllParts={loadingAllParts}
        setAllParts={setAllParts}
        loadAllParts={loadAllParts}
        reloadPartsFirstPage={reloadPartsFirstPage}
        LOAD_ALL_MODE_KEY={LOAD_ALL_MODE_KEY}
        expandedPartId={expandedPartId}
        setExpandedPartId={setExpandedPartId}
        setViewingPartPrices={setViewingPartPrices}
        openAddPart={openAddPart}
        openEditPart={openEditPart}
        openSupplyHousesModal={openSupplyHousesModal}
      />

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
          <div style={{ background: 'var(--surface)', padding: '2rem', borderRadius: 8, maxWidth: '600px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ marginBottom: '1rem' }}>Prices for {viewingPartPrices.name}</h2>
            <PartPricesManager
              part={viewingPartPrices}
              supplyHouses={supplyHouses}
              onClose={() => {
                setViewingPartPrices(null)
                reloadPartsFirstPage()
              }}
              onPricesUpdated={(updatedPrices) => {
                const partId = viewingPartPrices.id
                setParts(prev =>
                  prev.map(p =>
                    p.id === partId ? { ...p, prices: updatedPrices } : p
                  )
                )
                setAllParts(prev =>
                  prev.map(p =>
                    p.id === partId ? { ...p, prices: updatedPrices } : p
                  )
                )
                setTemplateItems(prev =>
                  prev.map(item =>
                    item.part_id === partId && item.part
                      ? { ...item, part: { ...item.part, prices: updatedPrices } }
                      : item
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
          <div style={{ background: 'var(--surface)', padding: '2rem', borderRadius: 8, maxWidth: '800px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>Supply Houses</h2>
              <button
                type="button"
                onClick={() => {
                  setViewingSupplyHouses(false)
                  closeSupplyHouseForm()
                }}
                style={{ padding: '0.5rem', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: '1.5rem', padding: '0.75rem', background: 'var(--bg-subtle)', borderRadius: 4, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
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
                    <tr style={{ background: 'var(--bg-muted)' }}>
                      <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '2px solid var(--border-strong)', fontWeight: 600 }}>
                        Supply House
                      </th>
                      {supplyHouseStatsByServiceType?.serviceTypes.map(st => (
                        <th key={st.id} style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '2px solid var(--border-strong)', fontWeight: 600 }}>
                          {st.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {supplyHouseStatsByServiceType?.supplyHouses.map(sh => (
                      <tr key={sh.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.5rem', fontWeight: 500 }}>{sh.name}</td>
                        {supplyHouseStatsByServiceType.serviceTypes.map(st => {
                          const count = sh.pricesByServiceType[st.id] ?? 0
                          return (
                            <td key={st.id} style={{ padding: '0.5rem', textAlign: 'right', color: count === 0 ? 'var(--text-faint)' : 'var(--text-700)' }}>
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
                <div style={{ marginTop: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
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
              <SupplyHouseForm
                editingSupplyHouse={editingSupplyHouse}
                name={supplyHouseName}
                contactName={supplyHouseContactName}
                phone={supplyHousePhone}
                email={supplyHouseEmail}
                address={supplyHouseAddress}
                websiteUrl={supplyHouseWebsiteUrl}
                notes={supplyHouseNotes}
                monthlyPaymentDay={supplyHouseMonthlyPaymentDay}
                onChange={(field, value) => {
                  switch (field) {
                    case 'name': setSupplyHouseName(value); break
                    case 'contact_name': setSupplyHouseContactName(value); break
                    case 'phone': setSupplyHousePhone(value); break
                    case 'email': setSupplyHouseEmail(value); break
                    case 'address': setSupplyHouseAddress(value); break
                    case 'website_url': setSupplyHouseWebsiteUrl(value); break
                    case 'notes': setSupplyHouseNotes(value); break
                    case 'monthly_payment_day': setSupplyHouseMonthlyPaymentDay(value); break
                  }
                }}
                onSubmit={saveSupplyHouseFromFormData}
                onClose={closeSupplyHouseForm}
                onDelete={editingSupplyHouse ? async () => { await deleteSupplyHouse(editingSupplyHouse.id); closeSupplyHouseForm(); } : undefined}
                saving={savingSupplyHouse}
                myRole={myRole}
                variant="inline"
              />
            )}

            {/* Supply Houses List */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: 'var(--bg-subtle)' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Name</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Contact</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Phone</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Email</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {supplyHouses.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No supply houses yet. Add your first supply house!
                      </td>
                    </tr>
                  ) : (
                    supplyHouses.map(sh => (
                      <tr key={sh.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.75rem', fontWeight: 500 }}>{sh.name}</td>
                        <td style={{ padding: '0.75rem' }}>{sh.contact_name || '-'}</td>
                        <td style={{ padding: '0.75rem' }}>{sh.phone || '-'}</td>
                        <td style={{ padding: '0.75rem' }}>{sh.email || '-'}</td>
                        <td style={{ padding: '0.75rem' }}>
                          <button
                            type="button"
                            onClick={() => openEditSupplyHouse(sh)}
                            style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
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

      {/* Assembly Book Tab */}
      {activeTab === 'assembly-book' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2>Assembly Book</h2>
            <button
              type="button"
              onClick={openAddTemplate}
              style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
            >
              + Add Assembly
            </button>
          </div>

          {/* Filter and Search */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <div ref={filterAssemblyTypeDropdownRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setFilterAssemblyTypeDropdownOpen(!filterAssemblyTypeDropdownOpen)}
                style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, minWidth: '200px', background: 'var(--surface)', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span>
                  {!filterIncludeEmpty && filterAssemblyTypeIds.length === 0
                    ? 'All Assembly Types'
                    : filterIncludeEmpty && filterAssemblyTypeIds.length === 0
                      ? 'Empty'
                      : filterIncludeEmpty && filterAssemblyTypeIds.length === 1
                        ? `Empty, ${assemblyTypes.find(at => at.id === filterAssemblyTypeIds[0])?.name ?? '1 type'}`
                        : filterIncludeEmpty && filterAssemblyTypeIds.length > 1
                          ? `Empty, ${filterAssemblyTypeIds.length} types`
                          : filterAssemblyTypeIds.length === 1
                            ? assemblyTypes.find(at => at.id === filterAssemblyTypeIds[0])?.name ?? '1 type'
                            : `${filterAssemblyTypeIds.length} types selected`}
                </span>
                <span style={{ marginLeft: '0.5rem', opacity: 0.6 }}>▾</span>
              </button>
              {filterAssemblyTypeDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: 4,
                    background: 'var(--surface)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 4,
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    zIndex: 50,
                    minWidth: '220px',
                    maxHeight: '280px',
                    overflowY: 'auto',
                  }}
                >
                  <label
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                  >
                    <input
                      type="checkbox"
                      checked={filterIncludeEmpty}
                      onChange={(e) => setFilterIncludeEmpty(e.target.checked)}
                    />
                    <span style={{ fontSize: '0.875rem' }}>Empty</span>
                  </label>
                  {assemblyTypes.map(at => (
                    <label
                      key={at.id}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                    >
                      <input
                        type="checkbox"
                        checked={filterAssemblyTypeIds.includes(at.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilterAssemblyTypeIds(prev => [...prev, at.id])
                          } else {
                            setFilterAssemblyTypeIds(prev => prev.filter(id => id !== at.id))
                          }
                        }}
                      />
                      <span style={{ fontSize: '0.875rem' }}>{at.name}</span>
                    </label>
                  ))}
                  {assemblyTypes.length === 0 && (
                    <div style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>No assembly types</div>
                  )}
                </div>
              )}
            </div>
            
            <input
              type="text"
              value={templateSearchQuery}
              onChange={(e) => setTemplateSearchQuery(e.target.value)}
              placeholder="Search assemblies by name, description, or type..."
              style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
            />
          </div>

          {/* Assembly List */}
          <div style={{ display: 'grid', gridTemplateColumns: selectedTemplate ? '1fr 1.5fr' : '1fr', gap: '2rem' }}>
            {/* Left: Assembly List */}
            <div>
              {filteredTemplates.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  {materialTemplates.length === 0 ? 'No assemblies yet. Create your first assembly!' : 'No assemblies match your filters.'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {filteredTemplates.map(template => {
                    const costData = calculateAssemblyCost(template.id)
                    const isSelected = selectedTemplate?.id === template.id
                    const assemblyType = assemblyTypes.find(at => at.id === template.assembly_type_id)
                    
                    // Pricing status badge
                    let statusBg = 'var(--bg-muted)'
                    let statusColor = 'var(--text-muted)'
                    let statusText = 'Empty'

                    if (costData.partCount === 0 && costData.nestedCount === 0) {
                      statusBg = 'var(--bg-muted)'
                      statusColor = 'var(--text-muted)'
                      statusText = 'Empty'
                    } else if (costData.missingPrices === 0) {
                      statusBg = 'var(--bg-green-100)'
                      statusColor = 'var(--text-green-800)'
                      statusText = 'All Priced'
                    } else if (costData.missingPrices > 0 && costData.total > 0) {
                      statusBg = 'var(--bg-amber-100)'
                      statusColor = 'var(--text-amber-800)'
                      statusText = `${costData.missingPrices} Missing`
                    } else {
                      statusBg = 'var(--bg-red-100)'
                      statusColor = 'var(--text-red-800)'
                      statusText = 'No Prices'
                    }
                    
                    return (
                      <div
                        key={template.id}
                        onClick={() => setSelectedTemplate(isSelected ? null : template)}
                        style={{
                          padding: '1rem',
                          border: `2px solid ${isSelected ? '#3b82f6' : 'var(--border)'}`,
                          borderRadius: 8,
                          background: isSelected ? 'var(--bg-blue-tint)' : 'var(--surface)',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                          <div style={{ flex: 1 }}>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>{template.name}</h3>
                            {template.description && (
                              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{template.description}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              openEditTemplate(template)
                            }}
                            style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
                          >
                            Edit
                          </button>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          {assemblyType && (
                            <span style={{ padding: '0.125rem 0.5rem', fontSize: '0.75rem', background: 'var(--bg-indigo-100)', color: 'var(--text-indigo-800)', borderRadius: 4, fontWeight: 500 }}>
                              {assemblyType.name}
                            </span>
                          )}
                          <span style={{ padding: '0.125rem 0.5rem', fontSize: '0.75rem', background: statusBg, color: statusColor, borderRadius: 4, fontWeight: 500 }}>
                            {statusText}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {costData.partCount} part{costData.partCount !== 1 ? 's' : ''}
                            {costData.nestedCount > 0 && `, ${costData.nestedCount} nested`}
                          </span>
                          {costData.total > 0 && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-green-600)', fontWeight: 600 }}>
                              ${formatCurrency(costData.total)}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Right: Assembly Details */}
            {selectedTemplate && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '1.5rem', background: 'var(--surface)' }}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <h2 style={{ margin: 0, marginBottom: '0.5rem' }}>{selectedTemplate.name}</h2>
                  {selectedTemplate.description && (
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>{selectedTemplate.description}</p>
                  )}
                </div>

                {/* Parts Section */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Parts</h3>
                    <button
                      type="button"
                      onClick={() => {
                        setAddItemModalType('part')
                        setAddItemModalPartId('')
                        setAddItemModalTemplateId('')
                        setAddItemModalSearchQuery('')
                        setAddItemModalQuantity('1')
                        setAddItemModalDropdownOpen(false)
                        setAddItemModalError(null)
                        setAddItemModalFilterPartTypeId('')
                        setAddItemModalFilterAssemblyTypeId('')
                        setAddItemModalOpen(true)
                      }}
                      style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
                    >
                      Add Parts
                    </button>
                  </div>
                  {templateItems.filter(item => item.item_type === 'part').length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-subtle)', borderRadius: 4, fontSize: '0.875rem' }}>
                      No parts in this assembly
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {templateItems.filter(item => item.item_type === 'part').map(item => {
                        const part = item.part ?? parts.find(p => p.id === item.part_id) ?? allParts.find(p => p.id === item.part_id)
                        const hasPrice = part && part.prices && part.prices.length > 0
                        const lowestPrice = hasPrice && part.prices ? Math.min(...part.prices.map(pr => pr.price)) : 0
                        const isExpanded = expandedPartId === part?.id
                        
                        return (
                          <div key={item.id} style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                            <div 
                              onClick={() => setExpandedPartId(isExpanded ? null : (part?.id || null))}
                              style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                padding: '0.75rem', 
                                background: isExpanded ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)',
                                cursor: 'pointer',
                                transition: 'background 0.15s'
                              }}
                            >
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{part?.name || 'Unknown Part'}</div>
                                {(part?.manufacturer || part?.part_type?.name) && (
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                                    {[part.manufacturer, part.part_type?.name].filter(Boolean).join(' · ')}
                                  </div>
                                )}
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                                  Qty: {item.quantity}
                                  {item.notes && ` · ${item.notes}`}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right', marginLeft: '1rem' }}>
                                {hasPrice ? (
                                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-green-600)' }}>
                                    ${formatCurrency(lowestPrice * item.quantity)}
                                    <div style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                                      ${formatCurrency(lowestPrice)} ea
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-red-600)' }}>
                                    No price
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* Expanded price details */}
                            {isExpanded && part && (
                              <div style={{ padding: '1rem', background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
                                {/* Quantity Editor */}
                                <div style={{ marginBottom: '0.75rem' }}>
                                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-700)' }}>Quantity in Assembly:</span>
                                    {editingItemQuantityId === item.id ? (
                                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                        <input
                                          type="number"
                                          min="1"
                                          value={editingItemQuantityValue}
                                          onChange={(e) => setEditingItemQuantityValue(e.target.value)}
                                          onClick={(e) => e.stopPropagation()}
                                          autoFocus
                                          style={{ width: '80px', padding: '0.25rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
                                        />
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            const qty = parseInt(editingItemQuantityValue)
                                            if (qty >= 1) {
                                              updateItemQuantity(item.id, qty)
                                            }
                                          }}
                                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
                                        >
                                          Save
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setEditingItemQuantityId(null)
                                            setEditingItemQuantityValue('')
                                          }}
                                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-green-600)' }}>{item.quantity}</span>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setEditingItemQuantityId(item.id)
                                            setEditingItemQuantityValue(item.quantity.toString())
                                          }}
                                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
                                        >
                                          Edit
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                  <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-700)' }}>Prices at Supply Houses</h4>
                                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setViewingPartPrices(part)
                                        setExpandedPartId(null)
                                      }}
                                      style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
                                    >
                                      Edit Prices
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setEditingPart(part)
                                        setPartFormOpen(true)
                                        setExpandedPartId(null)
                                      }}
                                      style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
                                    >
                                      Edit Part
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        removeItemFromTemplate(item.id)
                                        setExpandedPartId(null)
                                      }}
                                      title="Remove from assembly"
                                      aria-label="Remove from assembly"
                                      style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', background: 'var(--bg-red-100)', color: 'var(--text-red-800)', border: '1px solid var(--border-red)', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                                
                                {(part.prices?.length ?? 0) === 0 ? (
                                  <div style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-red-600)', background: 'var(--bg-red-100)', borderRadius: 4, fontSize: '0.75rem' }}>
                                    No prices available for this part
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    {(part.prices ?? [])
                                      .sort((a, b) => a.price - b.price)
                                      .map(price => {
                                        const supplyHouseName = price.supply_house?.name ?? supplyHouses.find(sh => sh.id === price.supply_house_id)?.name ?? 'Unknown'
                                        const isLowest = price.price === lowestPrice
                                        
                                        return (
                                          <div 
                                            key={price.id} 
                                            style={{ 
                                              display: 'flex', 
                                              justifyContent: 'space-between', 
                                              alignItems: 'center',
                                              padding: '0.5rem',
                                              background: isLowest ? 'var(--bg-emerald-100)' : 'var(--bg-subtle)',
                                              borderRadius: 4,
                                              fontSize: '0.75rem'
                                            }}
                                          >
                                            <span style={{ fontWeight: 500, color: 'var(--text-700)' }}>
                                              {supplyHouseName}
                                              {isLowest && (
                                                <span style={{ marginLeft: '0.5rem', padding: '0.125rem 0.375rem', background: '#059669', color: 'white', borderRadius: 3, fontSize: '0.625rem', fontWeight: 600 }}>
                                                  LOWEST
                                                </span>
                                              )}
                                            </span>
                                            <span style={{ fontWeight: 600, color: isLowest ? 'var(--text-green-600)' : 'var(--text-muted)' }}>
                                              ${formatCurrency(price.price)}
                                            </span>
                                          </div>
                                        )
                                      })}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Nested Assemblies Section */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Nested Assemblies</h3>
                    <button
                      type="button"
                      onClick={() => {
                        setAddItemModalType('template')
                        setAddItemModalPartId('')
                        setAddItemModalTemplateId('')
                        setAddItemModalSearchQuery('')
                        setAddItemModalQuantity('1')
                        setAddItemModalDropdownOpen(false)
                        setAddItemModalError(null)
                        setAddItemModalFilterPartTypeId('')
                        setAddItemModalFilterAssemblyTypeId('')
                        setAddItemModalOpen(true)
                      }}
                      style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
                    >
                      Add Nested Assembly
                    </button>
                  </div>
                  {templateItems.filter(item => item.item_type === 'template').length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-subtle)', borderRadius: 4, fontSize: '0.875rem' }}>
                      No nested assemblies
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {templateItems.filter(item => item.item_type === 'template').map(item => {
                        const nestedTemplate = materialTemplates.find(t => t.id === item.nested_template_id)
                        const nestedCost = nestedTemplate ? calculateAssemblyCost(nestedTemplate.id, item.quantity) : { total: 0, missingPrices: 0, partCount: 0, nestedCount: 0 }
                        
                        return (
                          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'var(--bg-sky-tint)', borderRadius: 4, border: '1px solid var(--border-blue)' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{nestedTemplate?.name || 'Unknown Assembly'}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                                Qty: {item.quantity} · {nestedCost.partCount} part{nestedCost.partCount !== 1 ? 's' : ''}
                                {nestedCost.nestedCount > 0 && `, ${nestedCost.nestedCount} nested`}
                                {item.notes && ` · ${item.notes}`}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', marginLeft: '1rem' }}>
                              {nestedCost.total > 0 ? (
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0284c7' }}>
                                  ${formatCurrency(nestedCost.total)}
                                </div>
                              ) : (
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-red-600)' }}>
                                  {nestedCost.missingPrices > 0 ? `${nestedCost.missingPrices} missing` : 'No prices'}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Cost Summary */}
                {(() => {
                  const costData = calculateAssemblyCost(selectedTemplate.id)
                  const partsOnly = templateItems.filter(item => item.item_type === 'part').reduce((sum, item) => {
                    const part = item.part ?? parts.find(p => p.id === item.part_id) ?? allParts.find(p => p.id === item.part_id)
                    const prices = part?.prices
                    if (part && prices && prices.length > 0) {
                      const lowestPrice = Math.min(...prices.map(pr => pr.price))
                      return sum + (lowestPrice * item.quantity)
                    }
                    return sum
                  }, 0)
                  const nestedOnly = costData.total - partsOnly
                  
                  return (
                    <div style={{ padding: '1rem', background: 'var(--bg-subtle)', borderRadius: 4, border: '1px solid var(--border)' }}>
                      <h3 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Cost Summary</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Direct Parts:</span>
                          <span style={{ fontWeight: 500 }}>${formatCurrency(partsOnly)}</span>
                        </div>
                        {nestedOnly > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Nested Assemblies:</span>
                            <span style={{ fontWeight: 500 }}>${formatCurrency(nestedOnly)}</span>
                          </div>
                        )}
                        <div style={{ borderTop: '1px solid var(--border-strong)', paddingTop: '0.5rem', marginTop: '0.25rem', display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 600 }}>Total Estimated Cost:</span>
                          <span style={{ fontWeight: 700, color: 'var(--text-green-600)', fontSize: '1rem' }}>${formatCurrency(costData.total)}</span>
                        </div>
                        {costData.missingPrices > 0 && (
                          <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'var(--bg-amber-100)', borderRadius: 4, color: 'var(--text-amber-800)', fontSize: '0.75rem' }}>
                            ⚠ {costData.missingPrices} part{costData.missingPrices !== 1 ? 's' : ''} missing price{costData.missingPrices !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()}

                {/* Supply house bundle prices */}
                <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-subtle)', borderRadius: 4, border: '1px solid var(--border)' }}>
                  <h3 style={{ marginTop: 0, marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Supply house prices</h3>
                  <p style={{ marginTop: 0, marginBottom: '0.75rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                    A bundle price a supply house quotes for this whole assembly (e.g. a discount without a per-part breakdown). Used when adding this assembly as a bundle on a bid takeoff.
                  </p>
                  <TemplatePricesManager template={selectedTemplate} supplyHouses={supplyHouses} />
                </div>

                {/* Quick Actions */}
                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTemplate(null)
                      setActiveTab('parts-book')
                    }}
                    style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
                  >
                    View Parts Book
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Assemblies & PO Builder Tab */}
      {activeTab === 'assemblies-po' && (
        <div className="po-builder-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '2rem' }}>
          {/* Left Panel: Material Assemblies */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2>Material Assemblies</h2>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div ref={filterAssemblyTypeDropdownRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setFilterAssemblyTypeDropdownOpen(!filterAssemblyTypeDropdownOpen)}
                  style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, minWidth: '180px', background: 'var(--surface)', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span>
                    {!filterIncludeEmpty && filterAssemblyTypeIds.length === 0
                      ? 'All Assembly Types'
                      : filterIncludeEmpty && filterAssemblyTypeIds.length === 0
                        ? 'Empty'
                        : filterIncludeEmpty && filterAssemblyTypeIds.length === 1
                          ? `Empty, ${assemblyTypes.find(at => at.id === filterAssemblyTypeIds[0])?.name ?? '1 type'}`
                          : filterIncludeEmpty && filterAssemblyTypeIds.length > 1
                            ? `Empty, ${filterAssemblyTypeIds.length} types`
                            : filterAssemblyTypeIds.length === 1
                              ? assemblyTypes.find(at => at.id === filterAssemblyTypeIds[0])?.name ?? '1 type'
                              : `${filterAssemblyTypeIds.length} types selected`}
                  </span>
                  <span style={{ marginLeft: '0.5rem', opacity: 0.6 }}>▾</span>
                </button>
                {filterAssemblyTypeDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      marginTop: 4,
                      background: 'var(--surface)',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 4,
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      zIndex: 50,
                      minWidth: '220px',
                      maxHeight: '280px',
                      overflowY: 'auto',
                    }}
                  >
                    <label
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                    >
                      <input
                        type="checkbox"
                        checked={filterIncludeEmpty}
                        onChange={(e) => setFilterIncludeEmpty(e.target.checked)}
                      />
                      <span style={{ fontSize: '0.875rem' }}>Empty</span>
                    </label>
                    {assemblyTypes.map(at => (
                      <label
                        key={at.id}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                      >
                        <input
                          type="checkbox"
                          checked={filterAssemblyTypeIds.includes(at.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFilterAssemblyTypeIds(prev => [...prev, at.id])
                            } else {
                              setFilterAssemblyTypeIds(prev => prev.filter(id => id !== at.id))
                            }
                          }}
                        />
                        <span style={{ fontSize: '0.875rem' }}>{at.name}</span>
                      </label>
                    ))}
                    {assemblyTypes.length === 0 && (
                      <div style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>No assembly types</div>
                    )}
                  </div>
                )}
              </div>
              
              <input
                type="text"
                value={templateSearchQuery}
                onChange={(e) => setTemplateSearchQuery(e.target.value)}
                placeholder="Search assemblies by name or description…"
                style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
              />
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0 0 0.75rem' }}>
              Build POs here — add or edit assemblies in{' '}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('assembly-book')
                  setSearchParams((prev) => {
                    const next = new URLSearchParams(prev)
                    next.set('tab', 'assembly-book')
                    return next
                  })
                }}
                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', textDecoration: 'underline dotted', cursor: 'pointer', font: 'inherit' }}
              >
                Assembly Book →
              </button>
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: 4, maxHeight: '600px', overflow: 'auto' }}>
              {materialTemplates.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No assemblies yet. Create your first assembly!
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
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
                    const assemblyType = assemblyTypes.find(at => at.id === template.assembly_type_id)
                    // Estimated cost at each part's lowest supply-house price (direct parts
                    // only, mirroring partCount above). null while any part is unpriced or
                    // unresolved so we never show a misleading partial number.
                    const assemblyEstimatedCost = (() => {
                      if (partItems.length === 0) return null
                      let sum = 0
                      for (const i of partItems) {
                        const part = parts.find(pp => pp.id === i.part_id) ?? allParts.find(pp => pp.id === i.part_id)
                        const prices = (part?.prices ?? []).map(pr => Number(pr.price)).filter(n => Number.isFinite(n) && n > 0)
                        if (prices.length === 0) return null
                        sum += Math.min(...prices) * i.quantity
                      }
                      return sum
                    })()
                    const canQuickAddToPO = editingPO != null && editingPO.status === 'draft'
                    return (
                    <div
                      key={template.id}
                      style={{
                        padding: '1rem',
                        borderBottom: '1px solid var(--border)',
                        background: selectedTemplate?.id === template.id ? 'var(--bg-blue-tint)' : 'var(--surface)',
                        cursor: 'pointer',
                      }}
                      onClick={() => setSelectedTemplate(template)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '0.5rem' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {template.name}
                            {assemblyType && (
                              <span style={{ padding: '0.125rem 0.5rem', fontSize: '0.75rem', background: 'var(--bg-indigo-100)', color: 'var(--text-indigo-800)', borderRadius: 4, fontWeight: 500 }}>
                                {assemblyType.name}
                              </span>
                            )}
                            {assemblyEstimatedCost != null && (
                              <span
                                title="Estimated at each part's lowest supply-house price (direct parts only — nested assemblies not included)"
                                style={{ marginLeft: 'auto', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-green-600)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
                              >
                                ${formatCurrency(assemblyEstimatedCost)}
                              </span>
                            )}
                          </div>
                          {template.description && (
                            // Clamped to two lines — full text on hover; expand by opening Parts.
                            <div
                              title={template.description}
                              style={{ fontSize: '0.875rem', color: 'var(--text-muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                            >
                              {template.description}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <button
                              type="button"
                              disabled={!canQuickAddToPO || addingTemplateToPO}
                              title={canQuickAddToPO ? `Add every part in "${template.name}" to the selected draft PO` : 'Select or create a draft PO first'}
                              onClick={(e) => {
                                e.stopPropagation()
                                if (canQuickAddToPO && editingPO) addTemplateToPO(editingPO.id, template.id)
                              }}
                              style={{ padding: '0.25rem 0.6rem', background: canQuickAddToPO ? '#3b82f6' : 'var(--bg-muted)', color: canQuickAddToPO ? 'white' : 'var(--text-faint)', border: 'none', borderRadius: 4, cursor: canQuickAddToPO ? 'pointer' : 'not-allowed', fontWeight: 600 }}
                            >
                              → Add to PO
                            </button>
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
                          </div>
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
              <div ref={templateItemsSectionRef} style={{ marginTop: '1.5rem', border: '1px solid var(--border)', borderRadius: 4, padding: '1rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>Items in {selectedTemplate.name}</h3>

                <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden', marginBottom: '1rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'var(--bg-subtle)' }}>
                      <tr>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Type</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Part/Assembly Type</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Name</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Qty</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {templateItems.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            No items yet. Add parts or nested assemblies.
                          </td>
                        </tr>
                      ) : (
                        (templateItems.map(item => {
                          const partWithPrices = item.item_type === 'part' && item.part_id ? (parts.find(p => p.id === item.part_id) ?? allParts.find(p => p.id === item.part_id)) : null
                          const priceCount = partWithPrices?.prices.length ?? 0
                          const priceIconColor = priceCount === 0 ? '#dc2626' : priceCount === 1 ? '#ca8a04' : '#6b7280'
                          const partTypeName = item.item_type === 'part' ? (item.part?.part_type?.name ?? partTypes.find(pt => pt.id === item.part?.part_type_id)?.name) : null
                          const assemblyTypeName = item.item_type === 'template' && item.nested_template?.assembly_type_id
                            ? assemblyTypes.find(at => at.id === item.nested_template?.assembly_type_id)?.name
                            : null
                          return (
                          <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.75rem' }}>{item.item_type === 'part' ? 'Part' : 'Assembly'}</td>
                            <td style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                              {partTypeName ?? assemblyTypeName ?? '—'}
                            </td>
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
                                      style={{ padding: '0.25rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: priceIconColor }}
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
                                      style={{ padding: '0.25rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
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
                                  style={{ padding: '0.25rem', background: 'var(--bg-red-100)', color: 'var(--text-red-800)', border: '1px solid var(--border-red)', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
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

                <div style={{ padding: '1rem', background: 'var(--bg-subtle)', borderRadius: 4 }}>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Add Item</label>
                    <select
                      value={newItemType}
                      onChange={(e) => {
                        const v = e.target.value as 'part' | 'template'
                        setNewItemType(v)
                        if (v === 'part') {
                          setNewItemTemplateId('')
                          setNewItemTemplateSearchQuery('')
                          setNewItemTemplateDropdownOpen(false)
                          setNewItemFilterAssemblyTypeId('')
                        } else {
                          setNewItemPartId('')
                          setTemplatePartSearchQuery('')
                          setTemplatePartDropdownOpen(false)
                        }
                      }}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, marginBottom: '0.5rem' }}
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
                          value={newItemPartId ? (parts.find(p => p.id === newItemPartId) ?? allParts.find(p => p.id === newItemPartId))?.name ?? '' : templatePartSearchQuery}
                          onChange={(e) => setTemplatePartSearchQuery(e.target.value)}
                          onFocus={() => setTemplatePartDropdownOpen(true)}
                          onBlur={() => setTimeout(() => setTemplatePartDropdownOpen(false), 150)}
                          onKeyDown={(e) => e.key === 'Escape' && setTemplatePartDropdownOpen(false)}
                          readOnly={!!newItemPartId}
                          placeholder="Search parts by name, manufacturer, type, or notes…"
                          style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: newItemPartId ? 'var(--bg-muted)' : undefined }}
                        />
                        {newItemPartId && (
                          <button
                            type="button"
                            onClick={() => { setNewItemPartId(''); setTemplatePartSearchQuery(''); setTemplatePartDropdownOpen(true) }}
                            style={{ padding: '0.25rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer', whiteSpace: 'nowrap' }}
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
                            border: '1px solid var(--border-strong)',
                            borderRadius: 4,
                            background: 'var(--surface)',
                            zIndex: 50,
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                          }}
                        >
                          {filterPartsByQuery(allParts.length > 0 ? allParts : parts, templatePartSearchQuery).length === 0 ? (
                            <li style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>
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
                            filterPartsByQuery(allParts.length > 0 ? allParts : parts, templatePartSearchQuery).map(p => (
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
                                  borderBottom: '1px solid var(--border)',
                                }}
                              >
                                <div style={{ fontWeight: 500 }}>{p.name}</div>
                                {(p.manufacturer || p.part_type?.name) && (
                                  <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
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
                    <div style={{ marginBottom: '0.5rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>Filter by type</label>
                      <select
                        value={newItemFilterAssemblyTypeId}
                        onChange={(e) => { setNewItemFilterAssemblyTypeId(e.target.value); setNewItemTemplateDropdownOpen(true) }}
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, marginBottom: '0.5rem' }}
                      >
                        <option value="">All Assembly Types</option>
                        {assemblyTypes.map(at => (
                          <option key={at.id} value={at.id}>{at.name}</option>
                        ))}
                      </select>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>Search</label>
                      <div style={{ position: 'relative' }}>
                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                          <input
                            type="text"
                            value={newItemTemplateId ? (materialTemplates.find(t => t.id === newItemTemplateId)?.name ?? '') : newItemTemplateSearchQuery}
                            onChange={(e) => setNewItemTemplateSearchQuery(e.target.value)}
                            onFocus={() => setNewItemTemplateDropdownOpen(true)}
                            onBlur={() => setTimeout(() => setNewItemTemplateDropdownOpen(false), 150)}
                            onKeyDown={(e) => e.key === 'Escape' && setNewItemTemplateDropdownOpen(false)}
                            readOnly={!!newItemTemplateId}
                            placeholder="Search assemblies by name, description, or type…"
                            style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: newItemTemplateId ? 'var(--bg-muted)' : undefined }}
                          />
                          {newItemTemplateId && (
                            <button
                              type="button"
                              onClick={() => { setNewItemTemplateId(''); setNewItemTemplateSearchQuery(''); setNewItemTemplateDropdownOpen(true) }}
                              style={{ padding: '0.25rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        {newItemTemplateDropdownOpen && (
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
                              border: '1px solid var(--border-strong)',
                              borderRadius: 4,
                              background: 'var(--surface)',
                              zIndex: 50,
                              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                            }}
                          >
                            {(() => {
                              const base = materialTemplates.filter(t => t.id !== selectedTemplate.id)
                              const filteredByType = newItemFilterAssemblyTypeId ? base.filter(t => t.assembly_type_id === newItemFilterAssemblyTypeId) : base
                              const filtered = filterTemplatesByQuery(filteredByType, newItemTemplateSearchQuery, assemblyTypes)
                              return filtered.length === 0 ? (
                                <li style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>No assemblies match.</li>
                              ) : (
                                filtered.map(t => {
                                  const typeName = t.assembly_type_id ? assemblyTypes.find(at => at.id === t.assembly_type_id)?.name : null
                                  return (
                                    <li
                                      key={t.id}
                                      onClick={() => {
                                        setNewItemTemplateId(t.id)
                                        setNewItemTemplateSearchQuery('')
                                        setNewItemTemplateDropdownOpen(false)
                                      }}
                                      style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                                    >
                                      <div style={{ fontWeight: 500 }}>{t.name}</div>
                                      {typeName && (
                                        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{typeName}</div>
                                      )}
                                    </li>
                                  )
                                })
                              )
                            })()}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}
                  <input
                    type="number"
                    min="1"
                    value={newItemQuantity}
                    onChange={(e) => setNewItemQuantity(e.target.value)}
                    placeholder="Quantity"
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, marginBottom: '0.5rem' }}
                  />
                  <textarea
                    value={newItemNotes}
                    onChange={(e) => setNewItemNotes(e.target.value)}
                    placeholder="Notes (optional)"
                    rows={2}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, marginBottom: '0.5rem' }}
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
              </div>
            )}
            {selectedTemplate && (
              <div style={{ marginTop: '1.5rem', border: '1px solid var(--border)', borderRadius: 4, padding: '1rem' }}>
                <h3 style={{ marginBottom: '0.5rem' }}>Supply house prices</h3>
                <p style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  A bundle price a supply house quotes for this whole assembly (e.g. a discount without a per-part breakdown). Used when adding this assembly as a bundle on a bid takeoff.
                </p>
                <TemplatePricesManager template={selectedTemplate} supplyHouses={supplyHouses} />
              </div>
            )}
            <p style={{ marginTop: '0.75rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              {templateStatsTotal} assemblies | {templateStatsPctWithNoPrice}% of assemblies have unpriced parts
            </p>
          </div>

          {/* Right Panel: Templates and Purchase Orders */}
          <div>
            {/* Create PO from Template Button (when no editingPO) */}
            {selectedTemplate && !editingPO && (
              <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--bg-sky-tint)', border: '1px solid var(--border-sky)', borderRadius: 4 }}>
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
              <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--bg-sky-tint)', border: '1px solid var(--border-sky)', borderRadius: 4 }}>
                <button
                  type="button"
                  onClick={() => addTemplateToPO(editingPO.id, selectedTemplate.id)}
                  disabled={addingTemplateToPO}
                  style={{ width: '100%', padding: '0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
                >
                  {addingTemplateToPO ? 'Adding Assembly...' : `Add "${selectedTemplate.name}" Assembly to PO`}
                </button>
              </div>
            )}

            {/* Draft Purchase Orders */}
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

            {draftPOs.length > 0 && (
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <input
                  type="text"
                  value={draftPOSearch}
                  onChange={(e) => setDraftPOSearch(e.target.value)}
                  placeholder="Search drafts by name…"
                  style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                />
              </div>
            )}
            <div style={{ border: '1px solid var(--border)', borderRadius: 4, marginBottom: '1.5rem' }}>
              {draftPOs.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ marginBottom: '0.75rem' }}>No draft purchase orders yet.</div>
                  <button
                    type="button"
                    onClick={createEmptyPO}
                    style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
                  >
                    Create PO
                  </button>
                </div>
              ) : filteredDraftPOs.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No drafts match "{draftPOSearch.trim()}"
                </div>
              ) : (
                <div>
                  {filteredDraftPOs.map(po => {
                    const total = po.items.reduce((sum, item) => sum + (item.price_at_time * item.quantity), 0)
                    return (
                      <div
                        key={po.id}
                        style={{
                          padding: '1rem',
                          borderBottom: '1px solid var(--border)',
                          background: editingPO?.id === po.id ? 'var(--bg-blue-tint)' : 'var(--surface)',
                          cursor: 'pointer',
                        }}
                        onClick={async () => {
                          // Clear any edit states when switching POs
                          setEditingPOName(null)
                          setEditingPONameValue('')
                          setEditingPOItem(null)
                          
                          // Load full PO details with items
                          const itemsWithDetails = await loadPOItemsWithDetails(supabase, po.id)
                          if (itemsWithDetails) {
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
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                              <span>
                                {po.items.filter(i => Number(i.price_at_time ?? 0) > 0).length} of {po.items.length} priced • ${formatCurrency(total)}
                              </span>
                              <span
                                title={po.created_at ? `Created ${new Date(po.created_at).toLocaleString()}` : undefined}
                                style={{ whiteSpace: 'nowrap' }}
                              >
                                {po.created_at ? new Date(po.created_at).toLocaleDateString() : ''}
                              </span>
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
              <div ref={editingPODetailRef} style={{ border: '1px solid var(--border)', borderRadius: 4, padding: '1rem', background: 'var(--bg-subtle)' }}>
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
                          style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '1.125rem', fontWeight: 600 }}
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
                          style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
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
                          style={{ padding: '0.25rem 0.5rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
                        >
                          Rename
                        </button>
                      </div>
                    )}
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      {editingPO.items.filter(i => Number(i.price_at_time ?? 0) > 0).length} of {editingPO.items.length} priced • ${formatCurrency(editingPO.items.reduce((sum, item) => sum + (item.price_at_time * item.quantity), 0))} total
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
                    style={{ padding: '0.25rem 0.5rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Close
                  </button>
                </div>

                {/* Items Table */}
                {editingPO.items.length > 0 && (
                  <div style={{ marginBottom: '1.5rem', border: '1px solid var(--border)', borderRadius: 4, overflowX: 'auto' }}>
                    <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
                      <thead style={{ background: 'var(--bg-subtle)' }}>
                        <tr>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Part</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Qty</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Supply House</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Price</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Total</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>From assembly</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Notes</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editingPO.items.map(item => {
                          if (editingPOItem === item.id) {
                            // Edit mode
                            return (
                              <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                                <td colSpan={8} style={{ padding: '1rem' }}>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.5rem', alignItems: 'end' }}>
                                    <div>
                                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>Quantity</label>
                                      <input
                                        type="number"
                                        min="1"
                                        value={editingPOItemQuantity}
                                        onChange={(e) => setEditingPOItemQuantity(e.target.value)}
                                        style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                                      />
                                    </div>
                                    <div>
                                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>Supply House</label>
                                      <select
                                        value={editingPOItemSupplyHouse}
                                        onChange={(e) => setEditingPOItemSupplyHouse(e.target.value)}
                                        style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
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
                                        style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
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
                                        style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
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
                            <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '0.75rem' }}>{item.part?.name ?? '-'}</td>
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
                                  style={{ minWidth: '10rem', padding: '0.25rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
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
                                  <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)', borderRadius: 4 }} title={`From: ${item.source_template?.name ?? 'Unknown'}`}>
                                    From: {item.source_template?.name ?? 'Unknown'}
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
                                      style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, resize: 'vertical' }}
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
                                        style={{ padding: '0.25rem 0.5rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
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
                                      style={{ marginLeft: '0.5rem', padding: '0.15rem 0.4rem', fontSize: '0.75rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
                                    >
                                      Notes
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
                                  style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removePOItem(item.id)}
                                  style={{ padding: '0.25rem 0.5rem', background: 'var(--bg-red-100)', color: 'var(--text-red-800)', border: '1px solid var(--border-red)', borderRadius: 4, cursor: 'pointer' }}
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
              </div>
            )}
          </div>
        </div>
      )}

      {/* Template Form Modal */}
      {templateFormOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--surface)', padding: '2rem', borderRadius: 8, maxWidth: '500px', width: '90%' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{editingTemplate ? 'Edit Assembly' : 'Add Assembly'}</h2>
            <form onSubmit={saveTemplate}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Name *</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Description</label>
                <textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  rows={3}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Assembly Type</label>
                <select
                  value={templateAssemblyTypeId}
                  onChange={(e) => setTemplateAssemblyTypeId(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                >
                  <option value="">No type</option>
                  {assemblyTypes.map(at => (
                    <option key={at.id} value={at.id}>{at.name}</option>
                  ))}
                </select>
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
                    style={{ padding: '0.5rem 1rem', background: 'var(--bg-red-100)', color: 'var(--text-red-800)', border: '1px solid var(--border-red)', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Delete
                  </button>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
                  <button
                    type="button"
                    onClick={closeTemplateForm}
                    style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
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

      {/* Add Item to Assembly Modal */}
      {addItemModalOpen && selectedTemplate && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={(e) => e.target === e.currentTarget && closeAddItemModal()}
        >
          <div style={{ background: 'var(--surface)', padding: '2rem', borderRadius: 8, maxWidth: '450px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: '1rem' }}>Add Item to {selectedTemplate.name}</h2>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Type</label>
              <select
                value={addItemModalType}
                onChange={(e) => {
                  setAddItemModalType(e.target.value as 'part' | 'template')
                  setAddItemModalPartId('')
                  setAddItemModalTemplateId('')
                  setAddItemModalSearchQuery('')
                  setAddItemModalDropdownOpen(false)
                  setAddItemModalFilterPartTypeId('')
                  setAddItemModalFilterAssemblyTypeId('')
                }}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
              >
                <option value="part">Part</option>
                <option value="template">Nested Assembly</option>
              </select>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Filter by type</label>
              {addItemModalType === 'part' ? (
                <select
                  value={addItemModalFilterPartTypeId}
                  onChange={(e) => setAddItemModalFilterPartTypeId(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                >
                  <option value="">All Part Types</option>
                  {partTypes.map(pt => (
                    <option key={pt.id} value={pt.id}>{pt.name}</option>
                  ))}
                </select>
              ) : (
                <select
                  value={addItemModalFilterAssemblyTypeId}
                  onChange={(e) => setAddItemModalFilterAssemblyTypeId(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                >
                  <option value="">All Assembly Types</option>
                  {assemblyTypes.map(at => (
                    <option key={at.id} value={at.id}>{at.name}</option>
                  ))}
                </select>
              )}
            </div>

            {addItemModalType === 'part' ? (
              <div style={{ position: 'relative', marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Search</label>
                <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={addItemModalPartId ? (parts.find(p => p.id === addItemModalPartId) ?? allParts.find(p => p.id === addItemModalPartId))?.name ?? '' : addItemModalSearchQuery}
                    onChange={(e) => setAddItemModalSearchQuery(e.target.value)}
                    onFocus={() => setAddItemModalDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setAddItemModalDropdownOpen(false), 150)}
                    onKeyDown={(e) => e.key === 'Escape' && setAddItemModalDropdownOpen(false)}
                    readOnly={!!addItemModalPartId}
                    placeholder="Search parts by name, manufacturer, type, or notes…"
                    style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: addItemModalPartId ? 'var(--bg-muted)' : undefined }}
                  />
                  {addItemModalPartId && (
                    <button
                      type="button"
                      onClick={() => { setAddItemModalPartId(''); setAddItemModalSearchQuery(''); setAddItemModalDropdownOpen(true) }}
                      style={{ padding: '0.25rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      Clear
                    </button>
                  )}
                </div>
                {addItemModalDropdownOpen && (
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
                      border: '1px solid var(--border-strong)',
                      borderRadius: 4,
                      background: 'var(--surface)',
                      zIndex: 50,
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                  >
                    {(() => {
                      const baseParts = allParts.length > 0 ? allParts : parts
                      const filteredByType = addItemModalFilterPartTypeId
                        ? baseParts.filter(p => p.part_type_id === addItemModalFilterPartTypeId)
                        : baseParts
                      return filterPartsByQuery(filteredByType, addItemModalSearchQuery)
                    })().length === 0 ? (
                      <li style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>
                        No parts match.{' '}
                        <button
                          type="button"
                          onClick={() => {
                            openAddPartWithName(addItemModalSearchQuery.trim())
                        setAddItemModalDropdownOpen(false)
                      }}
                      style={{ marginLeft: '0.25rem', padding: '0.25rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
                    >
                      Add Part
                    </button>
                  </li>
                ) : (
                      (() => {
                        const baseParts = allParts.length > 0 ? allParts : parts
                        const filteredByType = addItemModalFilterPartTypeId
                          ? baseParts.filter(p => p.part_type_id === addItemModalFilterPartTypeId)
                          : baseParts
                        return filterPartsByQuery(filteredByType, addItemModalSearchQuery)
                      })().map(p => (
                        <li
                          key={p.id}
                          onClick={() => {
                            setAddItemModalPartId(p.id)
                            setAddItemModalSearchQuery('')
                            setAddItemModalDropdownOpen(false)
                          }}
                          style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                        >
                          <div style={{ fontWeight: 500 }}>{p.name}</div>
                          {(p.manufacturer || p.part_type?.name) && (
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
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
              <div style={{ position: 'relative', marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Search</label>
                <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={addItemModalTemplateId ? (materialTemplates.find(t => t.id === addItemModalTemplateId)?.name ?? '') : addItemModalSearchQuery}
                    onChange={(e) => setAddItemModalSearchQuery(e.target.value)}
                    onFocus={() => setAddItemModalDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setAddItemModalDropdownOpen(false), 150)}
                    onKeyDown={(e) => e.key === 'Escape' && setAddItemModalDropdownOpen(false)}
                    readOnly={!!addItemModalTemplateId}
                    placeholder="Search assemblies by name, description, or type…"
                    style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: addItemModalTemplateId ? 'var(--bg-muted)' : undefined }}
                  />
                  {addItemModalTemplateId && (
                    <button
                      type="button"
                      onClick={() => { setAddItemModalTemplateId(''); setAddItemModalSearchQuery(''); setAddItemModalDropdownOpen(true) }}
                      style={{ padding: '0.25rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      Clear
                    </button>
                  )}
                </div>
                {addItemModalDropdownOpen && (
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
                      border: '1px solid var(--border-strong)',
                      borderRadius: 4,
                      background: 'var(--surface)',
                      zIndex: 50,
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                  >
                    {(() => {
                      const base = materialTemplates.filter(t => t.id !== selectedTemplate.id)
                      const filteredByType = addItemModalFilterAssemblyTypeId ? base.filter(t => t.assembly_type_id === addItemModalFilterAssemblyTypeId) : base
                      const filtered = filterTemplatesByQuery(filteredByType, addItemModalSearchQuery, assemblyTypes)
                      return filtered.length === 0 ? (
                        <li style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>No assemblies match.</li>
                      ) : (
                        filtered.map(t => {
                          const typeName = t.assembly_type_id ? assemblyTypes.find(at => at.id === t.assembly_type_id)?.name : null
                          return (
                            <li
                              key={t.id}
                              onClick={() => {
                                setAddItemModalTemplateId(t.id)
                                setAddItemModalSearchQuery('')
                                setAddItemModalDropdownOpen(false)
                              }}
                              style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                            >
                              <div style={{ fontWeight: 500 }}>{t.name}</div>
                              {typeName && (
                                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{typeName}</div>
                              )}
                            </li>
                          )
                        })
                      )
                    })()}
                  </ul>
                )}
              </div>
            )}

            {addItemModalError && (
              <div style={{ marginBottom: '1rem', padding: '0.5rem', background: 'var(--bg-red-100)', color: 'var(--text-red-800)', borderRadius: 4, fontSize: '0.875rem' }}>
                {addItemModalError}
              </div>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Quantity</label>
              <input
                type="number"
                min={1}
                value={addItemModalQuantity}
                onChange={(e) => setAddItemModalQuantity(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={closeAddItemModal}
                style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddItemFromModal}
                disabled={addingItemFromModal || (addItemModalType === 'part' && !addItemModalPartId) || (addItemModalType === 'template' && !addItemModalTemplateId)}
                style={{
                  padding: '0.5rem 1rem',
                  background: (addItemModalType === 'part' && addItemModalPartId) || (addItemModalType === 'template' && addItemModalTemplateId) ? '#3b82f6' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: (addItemModalType === 'part' && addItemModalPartId) || (addItemModalType === 'template' && addItemModalTemplateId) ? 'pointer' : 'not-allowed',
                }}
              >
                {addingItemFromModal ? 'Adding...' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Purchase Orders Tab — always mounted so search/filter/tax state survives tab switches */}
      <MaterialsPurchaseOrdersTab
        active={activeTab === 'purchase-orders'}
        authUser={authUser}
        supplyHouses={supplyHouses}
        setError={setError}
        setActiveTab={setActiveTab}
        selectedPODetailRef={selectedPODetailRef}
        allPOs={allPOs}
        selectedPO={selectedPO}
        setSelectedPO={setSelectedPO}
        editingPO={editingPO}
        setEditingPO={setEditingPO}
        userNamesMap={userNamesMap}
        setUserNamesMap={setUserNamesMap}
        loadPurchaseOrders={loadPurchaseOrders}
        editingPOItemSupplyHouseView={editingPOItemSupplyHouseView}
        setEditingPOItemSupplyHouseView={setEditingPOItemSupplyHouseView}
        availablePricesForItem={availablePricesForItem}
        setAvailablePricesForItem={setAvailablePricesForItem}
        loadingAvailablePrices={loadingAvailablePrices}
        editingPricesByPriceId={editingPricesByPriceId}
        setEditingPricesByPriceId={setEditingPricesByPriceId}
        updatingPriceId={updatingPriceId}
        addPriceSupplyHouseId={addPriceSupplyHouseId}
        setAddPriceSupplyHouseId={setAddPriceSupplyHouseId}
        addPriceValue={addPriceValue}
        setAddPriceValue={setAddPriceValue}
        addingNewPrice={addingNewPrice}
        selectedServiceTypeId={selectedServiceTypeId}
        draftPOSupplyHouseOptionsPartId={draftPOSupplyHouseOptionsPartId}
        draftPOSupplyHouseOptions={draftPOSupplyHouseOptions}
        loadingDraftPOSupplyHouseOptions={loadingDraftPOSupplyHouseOptions}
        updatePOItemSupplyHouse={updatePOItemSupplyHouse}
        loadAvailablePricesForPart={loadAvailablePricesForPart}
        loadSupplyHouseOptionsForPart={loadSupplyHouseOptionsForPart}
        updatePartPriceInBook={updatePartPriceInBook}
        addPartPriceFromPOModal={addPartPriceFromPOModal}
      />

      {/* PO Generator Tab — always mounted so form state survives tab switches (renders null when inactive) */}
      <MaterialsPoGeneratorTab
        active={activeTab === 'po-generator'}
        myRole={myRole}
        supplyHouses={supplyHouses}
        selectedServiceTypeId={selectedServiceTypeId}
        onError={setError}
      />

      {/* Supply Houses Tab */}
      {activeTab === 'supply-houses' && (myRole === 'dev' || myRole === 'master_technician' || isAssistantLike(myRole)) && (
        <SupplyHousesTab
          supplyHouses={supplyHouses}
          onSupplyHousesChange={loadSupplyHouses}
          myRole={myRole}
          selectedServiceTypeId={selectedServiceTypeId}
          onNavigateToPO={handleNavigateToPOFromSupplyHouses}
        />
      )}
    </div>
  )
}
