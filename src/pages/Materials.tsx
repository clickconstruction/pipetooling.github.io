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
import { useAuth } from '../hooks/useAuth'
import { useConfirmDialog } from '../contexts/ConfirmDialogContext'
import { isAssistantLike } from '../lib/subcontractorLikeRole'
import { Database } from '../types/database'
import { PartFormModal } from '../components/PartFormModal'
import { SupplyHousesTab } from '../components/SupplyHousesTab'
import { MaterialsPoGeneratorTab } from '../components/materials/MaterialsPoGeneratorTab'
import { MaterialsJobAccountsTab } from '../components/materials/MaterialsJobAccountsTab'
import { MaterialsPurchaseOrdersTab } from '../components/materials/MaterialsPurchaseOrdersTab'
import { MaterialsPartsBookTab } from '../components/materials/MaterialsPartsBookTab'
import { MaterialsAssemblyBookTab } from '../components/materials/MaterialsAssemblyBookTab'
import { MaterialsPoBuilderTab } from '../components/materials/MaterialsPoBuilderTab'
import { useMaterialsPurchaseOrders } from '../hooks/useMaterialsPurchaseOrders'
import { useMaterialsCatalog } from '../hooks/useMaterialsCatalog'
import { useMaterialsAssemblies } from '../hooks/useMaterialsAssemblies'
import { PartPricesManager } from '../components/materials/PartPricesManager'
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

const MATERIALS_TABS = ['parts-book', 'assembly-book', 'assemblies-po', 'purchase-orders', 'supply-houses', 'job-accounts', 'po-generator'] as const

export default function Materials() {
  const { user: authUser } = useAuth()
  const confirmDialog = useConfirmDialog()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [myRole, setMyRole] = useState<UserRole | null>(null)
  const [activeTab, setActiveTab] = useState<
    'parts-book' | 'assembly-book' | 'assemblies-po' | 'purchase-orders' | 'supply-houses' | 'job-accounts' | 'po-generator'
  >('parts-book')
  /** Set when Job Accounts sends the user to a specific house on the Supply Houses tab. */
  const [supplyHouseToAutoOpen, setSupplyHouseToAutoOpen] = useState<string | null>(null)
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
      tab === 'job-accounts' ||
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
    } else if (myRole === 'estimator' && (tab === 'supply-houses' || tab === 'job-accounts' || tab === 'po-generator')) {
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

  // "Save & add another": refresh the lists but keep the modal open for the next part.
  async function handlePartSavedAndAddAnother(_part: MaterialPart) {
    await reloadPartsFirstPage()
    if (loadAllMode) {
      await loadAllParts()
    }
    setPartFormInitialName('')
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
    
    if (!(await confirmDialog({ message, confirmLabel: 'Delete', danger: true }))) return
    
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
    if (!(await confirmDialog({ message: 'Delete this assembly? All items will also be removed.', confirmLabel: 'Delete', danger: true }))) return
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
    if (!(await confirmDialog({ message: 'Remove this item from the assembly?', confirmLabel: 'Remove', danger: true }))) return
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
    if (!(await confirmDialog({ message: 'Remove this item from the purchase order?', confirmLabel: 'Remove', danger: true }))) return
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

      {/* Service Type Filter — hidden on Supply Houses and Job Accounts, which don't filter by service type */}
      {visibleServiceTypes.length > 0 && activeTab !== 'supply-houses' && activeTab !== 'job-accounts' && (
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
              setActiveTab('job-accounts')
              setSearchParams((p) => {
                const next = new URLSearchParams(p)
                next.set('tab', 'job-accounts')
                return next
              })
            }}
            style={pageTabStyle(activeTab === 'job-accounts')}
          >
            Job Accounts
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
        onSaveAndAddAnother={handlePartSavedAndAddAnother}
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
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '2rem', borderRadius: 8, maxWidth: '600px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
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
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '2rem', borderRadius: 8, maxWidth: '800px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
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

      {/* Assembly Book Tab (+ its Add Item modal, which renders independently
          of the active tab so an open modal survives tab switches) */}
      <MaterialsAssemblyBookTab
        active={activeTab === 'assembly-book'}
        selectedTemplate={selectedTemplate}
        setSelectedTemplate={setSelectedTemplate}
        templateItems={templateItems}
        templateSearchQuery={templateSearchQuery}
        setTemplateSearchQuery={setTemplateSearchQuery}
        filterAssemblyTypeIds={filterAssemblyTypeIds}
        setFilterAssemblyTypeIds={setFilterAssemblyTypeIds}
        filterIncludeEmpty={filterIncludeEmpty}
        setFilterIncludeEmpty={setFilterIncludeEmpty}
        filterAssemblyTypeDropdownOpen={filterAssemblyTypeDropdownOpen}
        setFilterAssemblyTypeDropdownOpen={setFilterAssemblyTypeDropdownOpen}
        filterAssemblyTypeDropdownRef={filterAssemblyTypeDropdownRef}
        materialTemplates={materialTemplates}
        parts={parts}
        allParts={allParts}
        partTypes={partTypes}
        assemblyTypes={assemblyTypes}
        supplyHouses={supplyHouses}
        filteredTemplates={filteredTemplates}
        calculateAssemblyCost={calculateAssemblyCost}
        updateItemQuantity={updateItemQuantity}
        removeItemFromTemplate={removeItemFromTemplate}
        openAddTemplate={openAddTemplate}
        openEditTemplate={openEditTemplate}
        editingItemQuantityId={editingItemQuantityId}
        setEditingItemQuantityId={setEditingItemQuantityId}
        editingItemQuantityValue={editingItemQuantityValue}
        setEditingItemQuantityValue={setEditingItemQuantityValue}
        expandedPartId={expandedPartId}
        setExpandedPartId={setExpandedPartId}
        setViewingPartPrices={setViewingPartPrices}
        openAddPartWithName={openAddPartWithName}
        setEditingPart={setEditingPart}
        setPartFormOpen={setPartFormOpen}
        setActiveTab={setActiveTab}
        addItemModalOpen={addItemModalOpen}
        setAddItemModalOpen={setAddItemModalOpen}
        addItemModalType={addItemModalType}
        setAddItemModalType={setAddItemModalType}
        addItemModalPartId={addItemModalPartId}
        setAddItemModalPartId={setAddItemModalPartId}
        addItemModalTemplateId={addItemModalTemplateId}
        setAddItemModalTemplateId={setAddItemModalTemplateId}
        addItemModalSearchQuery={addItemModalSearchQuery}
        setAddItemModalSearchQuery={setAddItemModalSearchQuery}
        addItemModalQuantity={addItemModalQuantity}
        setAddItemModalQuantity={setAddItemModalQuantity}
        addItemModalDropdownOpen={addItemModalDropdownOpen}
        setAddItemModalDropdownOpen={setAddItemModalDropdownOpen}
        addingItemFromModal={addingItemFromModal}
        addItemModalError={addItemModalError}
        setAddItemModalError={setAddItemModalError}
        addItemModalFilterPartTypeId={addItemModalFilterPartTypeId}
        setAddItemModalFilterPartTypeId={setAddItemModalFilterPartTypeId}
        addItemModalFilterAssemblyTypeId={addItemModalFilterAssemblyTypeId}
        setAddItemModalFilterAssemblyTypeId={setAddItemModalFilterAssemblyTypeId}
        closeAddItemModal={closeAddItemModal}
        handleAddItemFromModal={handleAddItemFromModal}
      />

      {/* PO Builder (assemblies-po) Tab */}
      <MaterialsPoBuilderTab
        active={activeTab === 'assemblies-po'}
        setActiveTab={setActiveTab}
        setSearchParams={setSearchParams}
        selectedTemplate={selectedTemplate}
        setSelectedTemplate={setSelectedTemplate}
        templateItems={templateItems}
        templateSearchQuery={templateSearchQuery}
        setTemplateSearchQuery={setTemplateSearchQuery}
        filterAssemblyTypeIds={filterAssemblyTypeIds}
        setFilterAssemblyTypeIds={setFilterAssemblyTypeIds}
        filterIncludeEmpty={filterIncludeEmpty}
        setFilterIncludeEmpty={setFilterIncludeEmpty}
        filterAssemblyTypeDropdownOpen={filterAssemblyTypeDropdownOpen}
        setFilterAssemblyTypeDropdownOpen={setFilterAssemblyTypeDropdownOpen}
        filterAssemblyTypeDropdownRef={filterAssemblyTypeDropdownRef}
        editingPO={editingPO}
        setEditingPO={setEditingPO}
        setSelectedPO={setSelectedPO}
        draftPOs={draftPOs}
        materialTemplates={materialTemplates}
        parts={parts}
        allParts={allParts}
        partTypes={partTypes}
        assemblyTypes={assemblyTypes}
        supplyHouses={supplyHouses}
        filteredTemplates={filteredTemplates}
        partIdsWithNoPrice={partIdsWithNoPrice}
        templateStatsTotal={templateStatsTotal}
        templateStatsPctWithNoPrice={templateStatsPctWithNoPrice}
        newItemType={newItemType}
        setNewItemType={setNewItemType}
        newItemPartId={newItemPartId}
        setNewItemPartId={setNewItemPartId}
        templatePartSearchQuery={templatePartSearchQuery}
        setTemplatePartSearchQuery={setTemplatePartSearchQuery}
        templatePartDropdownOpen={templatePartDropdownOpen}
        setTemplatePartDropdownOpen={setTemplatePartDropdownOpen}
        templatePartPickerRef={templatePartPickerRef}
        templateItemsSectionRef={templateItemsSectionRef}
        editingPODetailRef={editingPODetailRef}
        newItemTemplateId={newItemTemplateId}
        setNewItemTemplateId={setNewItemTemplateId}
        newItemTemplateSearchQuery={newItemTemplateSearchQuery}
        setNewItemTemplateSearchQuery={setNewItemTemplateSearchQuery}
        newItemTemplateDropdownOpen={newItemTemplateDropdownOpen}
        setNewItemTemplateDropdownOpen={setNewItemTemplateDropdownOpen}
        newItemFilterAssemblyTypeId={newItemFilterAssemblyTypeId}
        setNewItemFilterAssemblyTypeId={setNewItemFilterAssemblyTypeId}
        newItemQuantity={newItemQuantity}
        setNewItemQuantity={setNewItemQuantity}
        newItemNotes={newItemNotes}
        setNewItemNotes={setNewItemNotes}
        addingItemToTemplate={addingItemToTemplate}
        addItemToTemplate={addItemToTemplate}
        creatingPOFromTemplate={creatingPOFromTemplate}
        addingTemplateToPO={addingTemplateToPO}
        createPOFromTemplate={createPOFromTemplate}
        createEmptyPO={createEmptyPO}
        addTemplateToPO={addTemplateToPO}
        editingPOItem={editingPOItem}
        setEditingPOItem={setEditingPOItem}
        editingPOItemQuantity={editingPOItemQuantity}
        setEditingPOItemQuantity={setEditingPOItemQuantity}
        editingPOItemSupplyHouse={editingPOItemSupplyHouse}
        setEditingPOItemSupplyHouse={setEditingPOItemSupplyHouse}
        editingPOItemPrice={editingPOItemPrice}
        setEditingPOItemPrice={setEditingPOItemPrice}
        editingPOItemNotesId={editingPOItemNotesId}
        setEditingPOItemNotesId={setEditingPOItemNotesId}
        editingPOItemNotesValue={editingPOItemNotesValue}
        setEditingPOItemNotesValue={setEditingPOItemNotesValue}
        editingPOName={editingPOName}
        setEditingPOName={setEditingPOName}
        editingPONameValue={editingPONameValue}
        setEditingPONameValue={setEditingPONameValue}
        draftPOSearch={draftPOSearch}
        setDraftPOSearch={setDraftPOSearch}
        updatePOItem={updatePOItem}
        removePOItem={removePOItem}
        updatePOName={updatePOName}
        startEditPOName={startEditPOName}
        cancelEditPOName={cancelEditPOName}
        draftPOSupplyHouseOptionsPartId={draftPOSupplyHouseOptionsPartId}
        draftPOSupplyHouseOptions={draftPOSupplyHouseOptions}
        loadingDraftPOSupplyHouseOptions={loadingDraftPOSupplyHouseOptions}
        loadSupplyHouseOptionsForPart={loadSupplyHouseOptionsForPart}
        updatePOItemSupplyHouse={updatePOItemSupplyHouse}
        setViewingPartPrices={setViewingPartPrices}
        openAddPartWithName={openAddPartWithName}
        openEditPart={openEditPart}
        removeItemFromTemplate={removeItemFromTemplate}
        allTemplateItemsForStats={allTemplateItemsForStats}
      />

      {/* Template Form Modal */}
      {templateFormOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '2rem', borderRadius: 8, maxWidth: '500px', width: '90%' }}>
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

      {/* Job Accounts Tab — always mounted so loaded data survives tab switches (renders null when inactive) */}
      <MaterialsJobAccountsTab
        active={activeTab === 'job-accounts'}
        myRole={myRole}
        onOpenSupplyHouse={(houseId) => {
          setSupplyHouseToAutoOpen(houseId)
          setActiveTab('supply-houses')
          setSearchParams((p) => {
            const next = new URLSearchParams(p)
            next.set('tab', 'supply-houses')
            return next
          })
        }}
      />

      {/* Supply Houses Tab */}
      {activeTab === 'supply-houses' && (myRole === 'dev' || myRole === 'master_technician' || isAssistantLike(myRole)) && (
        <SupplyHousesTab
          supplyHouses={supplyHouses}
          onSupplyHousesChange={loadSupplyHouses}
          myRole={myRole}
          selectedServiceTypeId={selectedServiceTypeId}
          onNavigateToPO={handleNavigateToPOFromSupplyHouses}
          autoOpenHouseId={supplyHouseToAutoOpen}
          onAutoOpenHouseHandled={() => setSupplyHouseToAutoOpen(null)}
        />
      )}
    </div>
  )
}
