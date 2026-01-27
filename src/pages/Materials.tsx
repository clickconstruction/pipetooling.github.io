import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Database } from '../types/database'

type SupplyHouse = Database['public']['Tables']['supply_houses']['Row']
type MaterialPart = Database['public']['Tables']['material_parts']['Row']
type MaterialPartPrice = Database['public']['Tables']['material_part_prices']['Row']
type MaterialTemplate = Database['public']['Tables']['material_templates']['Row']
type MaterialTemplateItem = Database['public']['Tables']['material_template_items']['Row']
type PurchaseOrder = Database['public']['Tables']['purchase_orders']['Row']
type PurchaseOrderItem = Database['public']['Tables']['purchase_order_items']['Row']
type UserRole = 'dev' | 'master_technician' | 'assistant'

type PartWithPrices = MaterialPart & {
  prices: (MaterialPartPrice & { supply_house: SupplyHouse })[]
}

type TemplateItemWithDetails = MaterialTemplateItem & {
  part?: MaterialPart
  nested_template?: MaterialTemplate
}

type POItemWithDetails = PurchaseOrderItem & {
  part: MaterialPart
  supply_house?: SupplyHouse
}

type PurchaseOrderWithItems = PurchaseOrder & {
  items: POItemWithDetails[]
}

export default function Materials() {
  const { user: authUser } = useAuth()
  const [myRole, setMyRole] = useState<UserRole | null>(null)
  const [activeTab, setActiveTab] = useState<'price-book' | 'templates-po' | 'purchase-orders'>('price-book')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Price Book state
  const [parts, setParts] = useState<PartWithPrices[]>([])
  const [supplyHouses, setSupplyHouses] = useState<SupplyHouse[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterFixtureType, setFilterFixtureType] = useState<string>('')
  const [filterManufacturer, setFilterManufacturer] = useState<string>('')
  const [editingPart, setEditingPart] = useState<MaterialPart | null>(null)
  const [partFormOpen, setPartFormOpen] = useState(false)
  const [partName, setPartName] = useState('')
  const [partManufacturer, setPartManufacturer] = useState('')
  const [partFixtureType, setPartFixtureType] = useState('')
  const [partNotes, setPartNotes] = useState('')
  const [savingPart, setSavingPart] = useState(false)
  const [viewingPartPrices, setViewingPartPrices] = useState<MaterialPart | null>(null)

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
  const [templateItems, setTemplateItems] = useState<TemplateItemWithDetails[]>([])
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
  const [newItemTemplateId, setNewItemTemplateId] = useState('')
  const [newItemQuantity, setNewItemQuantity] = useState('1')
  const [newItemNotes, setNewItemNotes] = useState('')
  const [creatingPOFromTemplate, setCreatingPOFromTemplate] = useState(false)
  const [addingTemplateToPO, setAddingTemplateToPO] = useState(false)
  const [addingPartToPO, setAddingPartToPO] = useState(false)
  const [selectedTemplateForPO, setSelectedTemplateForPO] = useState('')
  const [selectedPartForPO, setSelectedPartForPO] = useState('')
  const [partQuantityForPO, setPartQuantityForPO] = useState('1')
  const [editingPOItem, setEditingPOItem] = useState<string | null>(null)
  const [editingPOItemQuantity, setEditingPOItemQuantity] = useState('')
  const [editingPOItemSupplyHouse, setEditingPOItemSupplyHouse] = useState('')
  const [editingPOItemPrice, setEditingPOItemPrice] = useState('')
  const [editingPOItemSupplyHouseView, setEditingPOItemSupplyHouseView] = useState<string | null>(null)
  const [availablePricesForItem, setAvailablePricesForItem] = useState<Array<{ supply_house_id: string; supply_house_name: string; price: number }>>([])
  const [loadingAvailablePrices, setLoadingAvailablePrices] = useState(false)
  const [selectedSupplyHouseForUpdate, setSelectedSupplyHouseForUpdate] = useState<{ supply_house_id: string; price: number } | null>(null)
  const [confirmingPriceForItem, setConfirmingPriceForItem] = useState<string | null>(null)
  const [editingPOName, setEditingPOName] = useState<string | null>(null)
  const [editingPONameValue, setEditingPONameValue] = useState('')
  const [duplicatingPO, setDuplicatingPO] = useState<string | null>(null)
  const [addingNotesToPO, setAddingNotesToPO] = useState<string | null>(null)
  const [notesValue, setNotesValue] = useState('')

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
      .select('role')
      .eq('id', authUser.id)
      .single()
    if (eMe) {
      setError(eMe.message)
      setLoading(false)
      return
    }
    const role = (me as { role: UserRole } | null)?.role ?? null
    setMyRole(role)
    if (role !== 'dev' && role !== 'master_technician') {
      setLoading(false)
      return
    }
    setLoading(false)
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

  async function loadParts() {
    const { data: partsData, error: partsError } = await supabase
      .from('material_parts')
      .select('*')
      .order('name')
    
    if (partsError) {
      setError(`Failed to load parts: ${partsError.message}`)
      return
    }

    const { data: pricesData, error: pricesError } = await supabase
      .from('material_part_prices')
      .select('*, supply_houses(*)')
      .order('price', { ascending: true })
    
    if (pricesError) {
      setError(`Failed to load prices: ${pricesError.message}`)
      return
    }

    const partsList = (partsData as MaterialPart[]) ?? []
    const pricesList = (pricesData as (MaterialPartPrice & { supply_houses: SupplyHouse })[]) ?? []

    const partsWithPrices: PartWithPrices[] = partsList.map(part => ({
      ...part,
      prices: pricesList
        .filter(p => p.part_id === part.id)
        .map(p => ({
          ...p,
          supply_house: p.supply_houses,
        }))
        .sort((a, b) => a.price - b.price)
    }))

    setParts(partsWithPrices)
  }

  async function loadMaterialTemplates() {
    const { data, error } = await supabase
      .from('material_templates')
      .select('*')
      .order('name')
    if (error) {
      setError(`Failed to load templates: ${error.message}`)
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
      setError(`Failed to load template items: ${itemsError.message}`)
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
    const { data: poData, error: poError } = await supabase
      .from('purchase_orders')
      .select('*')
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
          .select('*, material_parts(*), supply_houses(*)')
          .eq('purchase_order_id', po.id)
          .order('sequence_order', { ascending: true })
        
        if (itemsError) {
          return { ...po, items: [] }
        }

        const items = (itemsData as (PurchaseOrderItem & { material_parts: MaterialPart; supply_houses: SupplyHouse | null })[]) ?? []
        const itemsWithDetails: POItemWithDetails[] = items.map(item => ({
          ...item,
          part: item.material_parts,
          supply_house: item.supply_houses || undefined,
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
    if (myRole === 'dev' || myRole === 'master_technician') {
      loadSupplyHouses()
      loadParts()
      loadMaterialTemplates()
      loadPurchaseOrders()
    }
  }, [myRole])

  useEffect(() => {
    if (selectedTemplate) {
      loadTemplateItems(selectedTemplate.id)
    }
  }, [selectedTemplate])

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
            .select('*, material_parts(*), supply_houses(*)')
            .eq('purchase_order_id', editingPO.id)
            .order('sequence_order', { ascending: true })
          
          if (!itemsError && itemsData) {
            const items = (itemsData as (PurchaseOrderItem & { material_parts: MaterialPart; supply_houses: SupplyHouse | null })[]) ?? []
            const itemsWithDetails: POItemWithDetails[] = items.map(item => ({
              ...item,
              part: item.material_parts,
              supply_house: item.supply_houses || undefined,
            }))
            setEditingPO({ ...poData as PurchaseOrder, items: itemsWithDetails })
          }
        }
      }
      loadPODetails()
    }
  }, [editingPO?.id])

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>
  }

  if (myRole !== 'dev' && myRole !== 'master_technician' && myRole !== 'assistant') {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Access denied. Only devs, masters, and assistants can access materials.</div>
  }

  // Filter parts based on search and filters
  const filteredParts = parts.filter(part => {
    const matchesSearch = !searchQuery || 
      part.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      part.manufacturer?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      part.fixture_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      part.notes?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFixtureType = !filterFixtureType || part.fixture_type === filterFixtureType
    const matchesManufacturer = !filterManufacturer || part.manufacturer === filterManufacturer
    return matchesSearch && matchesFixtureType && matchesManufacturer
  })

  // Get unique fixture types and manufacturers for filters
  const fixtureTypes = [...new Set(parts.map(p => p.fixture_type).filter(Boolean))].sort()
  const manufacturers = [...new Set(parts.map(p => p.manufacturer).filter(Boolean))].sort()

  // Filter purchase orders
  const filteredPOs = allPOs.filter(po => {
    const matchesStatus = poStatusFilter === 'all' || po.status === poStatusFilter
    const matchesSearch = !poSearchQuery || po.name.toLowerCase().includes(poSearchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

  // Price Book Tab Functions
  function openAddPart() {
    setEditingPart(null)
    setPartName('')
    setPartManufacturer('')
    setPartFixtureType('')
    setPartNotes('')
    setPartFormOpen(true)
    setError(null)
  }

  function openEditPart(part: MaterialPart) {
    setEditingPart(part)
    setPartName(part.name)
    setPartManufacturer(part.manufacturer || '')
    setPartFixtureType(part.fixture_type || '')
    setPartNotes(part.notes || '')
    setPartFormOpen(true)
    setError(null)
  }

  function closePartForm() {
    setPartFormOpen(false)
  }

  async function savePart(e: React.FormEvent) {
    e.preventDefault()
    if (!partName.trim()) {
      setError('Part name is required')
      return
    }
    setSavingPart(true)
    setError(null)

    if (editingPart) {
      const { error: e } = await supabase
        .from('material_parts')
        .update({
          name: partName.trim(),
          manufacturer: partManufacturer.trim() || null,
          fixture_type: partFixtureType.trim() || null,
          notes: partNotes.trim() || null,
        })
        .eq('id', editingPart.id)
      if (e) {
        setError(e.message)
      } else {
        await loadParts()
        closePartForm()
      }
    } else {
      const { error: e } = await supabase
        .from('material_parts')
        .insert({
          name: partName.trim(),
          manufacturer: partManufacturer.trim() || null,
          fixture_type: partFixtureType.trim() || null,
          notes: partNotes.trim() || null,
        })
      if (e) {
        setError(e.message)
      } else {
        await loadParts()
        closePartForm()
      }
    }
    setSavingPart(false)
  }

  async function deletePart(partId: string) {
    if (!confirm('Delete this part? All prices will also be removed.')) return
    setError(null)
    const { error } = await supabase.from('material_parts').delete().eq('id', partId)
    if (error) {
      setError(error.message)
    } else {
      await loadParts()
    }
  }

  // Supply House Management Functions
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
        await loadSupplyHouses()
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
        await loadSupplyHouses()
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
      await loadSupplyHouses()
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
      setError('Template name is required')
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
    if (!confirm('Delete this template? All items will also be removed.')) return
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
      setError('Please select a template')
      return
    }
    const quantity = parseInt(newItemQuantity) || 1
    if (quantity < 1) {
      setError('Quantity must be at least 1')
      return
    }

    // Check for circular reference
    if (newItemType === 'template' && newItemTemplateId === selectedTemplate.id) {
      setError('Cannot add a template to itself')
      return
    }

    setAddingItemToTemplate(true)
    setError(null)

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
    if (!confirm('Remove this item from the template?')) return
    setError(null)
    const { error } = await supabase.from('material_template_items').delete().eq('id', itemId)
    if (error) {
      setError(error.message)
    } else if (selectedTemplate) {
      await loadTemplateItems(selectedTemplate.id)
    }
  }

  // Purchase Order Functions
  
  // Expand template recursively to get all parts (reusable function)
  async function expandTemplate(tid: string, multiplier: number = 1): Promise<Array<{ part_id: string; quantity: number }>> {
    const { data: items } = await supabase
      .from('material_template_items')
      .select('*')
      .eq('template_id', tid)
    
    if (!items) return []

    const result: Array<{ part_id: string; quantity: number }> = []
    for (const item of items) {
      if (item.item_type === 'part' && item.part_id) {
        result.push({ part_id: item.part_id, quantity: item.quantity * multiplier })
      } else if (item.item_type === 'template' && item.nested_template_id) {
        const nested = await expandTemplate(item.nested_template_id, item.quantity * multiplier)
        result.push(...nested)
      }
    }
    return result
  }

  async function createPOFromTemplate(templateId: string) {
    if (!authUser?.id) return
    setCreatingPOFromTemplate(true)
    setError(null)

    const expandedParts = await expandTemplate(templateId)
    
    // Get best prices for each part
    const poItemsWithPrices: Array<{ part_id: string; quantity: number; supply_house_id: string | null; price: number }> = []
    for (const { part_id, quantity } of expandedParts) {
      const { data: prices } = await supabase
        .from('material_part_prices')
        .select('*, supply_houses(*)')
        .eq('part_id', part_id)
        .order('price', { ascending: true })
        .limit(1)
      
      if (prices && prices.length > 0) {
        const bestPrice = prices[0] as MaterialPartPrice & { supply_houses: SupplyHouse }
        poItemsWithPrices.push({
          part_id,
          quantity,
          supply_house_id: bestPrice.supply_house_id,
          price: bestPrice.price,
        })
      } else {
        poItemsWithPrices.push({
          part_id,
          quantity,
          supply_house_id: null,
          price: 0,
        })
      }
    }

    // Create PO
    const template = materialTemplates.find(t => t.id === templateId)
    const { data: poData, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        name: `PO: ${template?.name || 'Untitled'}`,
        status: 'draft',
        created_by: authUser.id,
        notes: null,
      })
      .select('id')
      .single()

    if (poError) {
      setError(`Failed to create PO: ${poError.message}`)
      setCreatingPOFromTemplate(false)
      return
    }

    // Add items to PO
    for (let i = 0; i < poItemsWithPrices.length; i++) {
      const item = poItemsWithPrices[i]
      if (!item) continue
      const { error: itemError } = await supabase
        .from('purchase_order_items')
        .insert({
          purchase_order_id: poData.id,
          part_id: item.part_id,
          quantity: item.quantity,
          selected_supply_house_id: item.supply_house_id,
          price_at_time: item.price,
          sequence_order: i + 1,
        })
      if (itemError) {
        setError(`Failed to add item: ${itemError.message}`)
        break
      }
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

    const expandedParts = await expandTemplate(templateId)
    
    // Get best prices for each part
    const poItemsWithPrices: Array<{ part_id: string; quantity: number; supply_house_id: string | null; price: number }> = []
    for (const { part_id, quantity } of expandedParts) {
      const { data: prices } = await supabase
        .from('material_part_prices')
        .select('*, supply_houses(*)')
        .eq('part_id', part_id)
        .order('price', { ascending: true })
        .limit(1)
      
      if (prices && prices.length > 0) {
        const bestPrice = prices[0] as MaterialPartPrice & { supply_houses: SupplyHouse }
        poItemsWithPrices.push({
          part_id,
          quantity,
          supply_house_id: bestPrice.supply_house_id,
          price: bestPrice.price,
        })
      } else {
        poItemsWithPrices.push({
          part_id,
          quantity,
          supply_house_id: null,
          price: 0,
        })
      }
    }

    // Get current max sequence_order for this PO
    const { data: existingItems } = await supabase
      .from('purchase_order_items')
      .select('sequence_order')
      .eq('purchase_order_id', poId)
      .order('sequence_order', { ascending: false })
      .limit(1)
    
    const maxOrder = existingItems && existingItems.length > 0 && existingItems[0] ? existingItems[0].sequence_order : 0

    // Add items to PO
    for (let i = 0; i < poItemsWithPrices.length; i++) {
      const item = poItemsWithPrices[i]
      if (!item) continue
      const { error: itemError } = await supabase
        .from('purchase_order_items')
        .insert({
          purchase_order_id: poId,
          part_id: item.part_id,
          quantity: item.quantity,
          selected_supply_house_id: item.supply_house_id,
          price_at_time: item.price,
          sequence_order: maxOrder + i + 1,
        })
      if (itemError) {
        setError(`Failed to add item: ${itemError.message}`)
        break
      }
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
          .select('*, material_parts(*), supply_houses(*)')
          .eq('purchase_order_id', poId)
          .order('sequence_order', { ascending: true })
        
        if (!itemsError && itemsData) {
          const items = (itemsData as (PurchaseOrderItem & { material_parts: MaterialPart; supply_houses: SupplyHouse | null })[]) ?? []
          const itemsWithDetails: POItemWithDetails[] = items.map(item => ({
            ...item,
            part: item.material_parts,
            supply_house: item.supply_houses || undefined,
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
    
    const bestPrice = prices && prices.length > 0 
      ? (prices[0] as MaterialPartPrice & { supply_houses: SupplyHouse })
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
          .select('*, material_parts(*), supply_houses(*)')
          .eq('purchase_order_id', poId)
          .order('sequence_order', { ascending: true })
        
        if (!itemsError && itemsData) {
          const items = (itemsData as (PurchaseOrderItem & { material_parts: MaterialPart; supply_houses: SupplyHouse | null })[]) ?? []
          const itemsWithDetails: POItemWithDetails[] = items.map(item => ({
            ...item,
            part: item.material_parts,
            supply_house: item.supply_houses || undefined,
          }))
          setEditingPO({ ...poData as PurchaseOrder, items: itemsWithDetails })
        }
      }
    }
    setAddingPartToPO(false)
    setSelectedPartForPO('')
    setPartQuantityForPO('1')
  }

  async function updatePOItem(itemId: string, updates: { quantity?: number; supply_house_id?: string | null; price_at_time?: number }) {
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
        .select('*, material_parts(*), supply_houses(*)')
        .eq('purchase_order_id', editingPO.id)
        .order('sequence_order', { ascending: true })
      
      if (!itemsError && itemsData) {
        const items = (itemsData as (PurchaseOrderItem & { material_parts: MaterialPart; supply_houses: SupplyHouse | null })[]) ?? []
        const itemsWithDetails: POItemWithDetails[] = items.map(item => ({
          ...item,
          part: item.material_parts,
          supply_house: item.supply_houses || undefined,
        }))
        setEditingPO({ ...editingPO, items: itemsWithDetails })
      }
    }
    setEditingPOItem(null)
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
        .select('*, material_parts(*), supply_houses(*)')
        .eq('purchase_order_id', editingPO.id)
        .order('sequence_order', { ascending: true })
      
      if (!itemsError && itemsData) {
        const items = (itemsData as (PurchaseOrderItem & { material_parts: MaterialPart; supply_houses: SupplyHouse | null })[]) ?? []
        const itemsWithDetails: POItemWithDetails[] = items.map(item => ({
          ...item,
          part: item.material_parts,
          supply_house: item.supply_houses || undefined,
        }))
        setEditingPO({ ...editingPO, items: itemsWithDetails })
      }
    }
  }

  async function loadAvailablePricesForPart(partId: string, currentItem?: POItemWithDetails) {
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

    const pricesList = (data as (MaterialPartPrice & { supply_houses: SupplyHouse })[]) ?? []
    const availablePrices = pricesList.map(p => ({
      supply_house_id: p.supply_house_id,
      supply_house_name: p.supply_houses.name,
      price: p.price,
    }))
    
    setAvailablePricesForItem(availablePrices)
    // Set initial selected value to current supply house
    if (currentItem) {
      const currentPrice = availablePrices.find(p => p.supply_house_id === currentItem.supply_house?.id)
      if (currentPrice) {
        setSelectedSupplyHouseForUpdate({ supply_house_id: currentPrice.supply_house_id, price: currentPrice.price })
      } else {
        setSelectedSupplyHouseForUpdate(null)
      }
    }
    setLoadingAvailablePrices(false)
  }

  async function updatePOItemSupplyHouse(itemId: string, supplyHouseId: string, price: number) {
    setError(null)

    // Get the supply house name for optimistic update
    const supplyHouse = supplyHouses.find(sh => sh.id === supplyHouseId)
    
    // Optimistically update UI
    if (selectedPO) {
      const updatedItems = selectedPO.items.map(item => {
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
      setSelectedPO({ ...selectedPO, items: updatedItems })
    }

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
          .select('*, material_parts(*), supply_houses(*)')
          .eq('purchase_order_id', selectedPO.id)
          .order('sequence_order', { ascending: true })
        
        if (!itemsError && itemsData) {
          const items = (itemsData as (PurchaseOrderItem & { material_parts: MaterialPart; supply_houses: SupplyHouse | null })[]) ?? []
          const itemsWithDetails: POItemWithDetails[] = items.map(item => ({
            ...item,
            part: item.material_parts,
            supply_house: item.supply_houses || undefined,
          }))
          setSelectedPO({ ...selectedPO, items: itemsWithDetails })
        }
      }
      return
    }

    setEditingPOItemSupplyHouseView(null)
    setAvailablePricesForItem([])
    setSelectedSupplyHouseForUpdate(null)
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
          .select('*, material_parts(*), supply_houses(*)')
          .eq('purchase_order_id', selectedPO.id)
          .order('sequence_order', { ascending: true })
        
        if (!itemsError && itemsData) {
          const items = (itemsData as (PurchaseOrderItem & { material_parts: MaterialPart; supply_houses: SupplyHouse | null })[]) ?? []
          const itemsWithDetails: POItemWithDetails[] = items.map(item => ({
            ...item,
            part: item.material_parts,
            supply_house: item.supply_houses || undefined,
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
      })
      .select('id')
      .single()

    if (createError || !newPOData) {
      setError(`Failed to create duplicate PO: ${createError?.message || 'Unknown error'}`)
      setDuplicatingPO(null)
      return
    }

    // Copy all items to the new PO
    if (sourceItems && sourceItems.length > 0) {
      for (let i = 0; i < sourceItems.length; i++) {
        const item = sourceItems[i]
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
        .select('*, material_parts(*), supply_houses(*)')
        .eq('purchase_order_id', newPOData.id)
        .order('sequence_order', { ascending: true })

      if (!itemsError2 && itemsData) {
        const items = (itemsData as (PurchaseOrderItem & { material_parts: MaterialPart; supply_houses: SupplyHouse | null })[]) ?? []
        const itemsWithDetails: POItemWithDetails[] = items.map(item => ({
          ...item,
          part: item.material_parts,
          supply_house: item.supply_houses || undefined,
        }))
        const poWithItems: PurchaseOrderWithItems = { ...newPO as PurchaseOrder, items: itemsWithDetails }
        setEditingPO(poWithItems)
        setSelectedPO(null) // Close the view modal
        setActiveTab('templates-po') // Switch to Templates & Purchase Orders tab
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
        .select('*, material_parts(*), supply_houses(*)')
        .eq('purchase_order_id', poId)
        .order('sequence_order', { ascending: true })
      
      if (itemsData) {
        const items = (itemsData as (PurchaseOrderItem & { material_parts: MaterialPart; supply_houses: SupplyHouse | null })[]) ?? []
        const itemsWithDetails: POItemWithDetails[] = items.map(item => ({
          ...item,
          part: item.material_parts,
          supply_house: item.supply_houses || undefined,
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

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Materials</h1>

      {error && (
        <div style={{ padding: '0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: 4, marginBottom: '1rem' }}>
          {error}
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
          Templates & Purchase Orders
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
            <button type="button" onClick={() => setViewingSupplyHouses(true)} style={{ padding: '0.5rem 1rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
              Manage Supply Houses
            </button>
            <input
              type="text"
              placeholder="Search parts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
            />
            <select
              value={filterFixtureType}
              onChange={(e) => setFilterFixtureType(e.target.value)}
              style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
            >
              <option value="">All Fixture Types</option>
              {fixtureTypes.map(ft => (
                <option key={ft} value={ft || ''}>{ft || ''}</option>
              ))}
            </select>
            <select
              value={filterManufacturer}
              onChange={(e) => setFilterManufacturer(e.target.value)}
              style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
            >
              <option value="">All Manufacturers</option>
              {manufacturers.map(m => (
                <option key={m} value={m || ''}>{m || ''}</option>
              ))}
            </select>
          </div>

          <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Name</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Manufacturer</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Fixture Type</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Best Price</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredParts.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                      {searchQuery || filterFixtureType || filterManufacturer ? 'No parts match your filters' : 'No parts yet. Add your first part!'}
                    </td>
                  </tr>
                ) : (
                  filteredParts.map(part => {
                    const bestPrice = part.prices.length > 0 ? part.prices[0] : null
                    return (
                      <tr key={part.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '0.75rem' }}>{part.name}</td>
                        <td style={{ padding: '0.75rem' }}>{part.manufacturer || '-'}</td>
                        <td style={{ padding: '0.75rem' }}>{part.fixture_type || '-'}</td>
                        <td style={{ padding: '0.75rem' }}>
                          {bestPrice ? `$${bestPrice.price.toFixed(2)} (${bestPrice.supply_house.name})` : 'No prices'}
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          <button
                            type="button"
                            onClick={() => setViewingPartPrices(part)}
                            style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                          >
                            Prices
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditPart(part)}
                            style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
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
        </div>
      )}

      {/* Part Form Modal */}
      {partFormOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: 8, maxWidth: '500px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{editingPart ? 'Edit Part' : 'Add Part'}</h2>
            <form onSubmit={savePart}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Name *</label>
                <input
                  type="text"
                  value={partName}
                  onChange={(e) => setPartName(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Manufacturer</label>
                <input
                  type="text"
                  value={partManufacturer}
                  onChange={(e) => setPartManufacturer(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Fixture Type</label>
                <select
                  value={partFixtureType}
                  onChange={(e) => setPartFixtureType(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                >
                  <option value="">Select fixture type...</option>
                  <option value="Fitting">Fitting</option>
                  <option value="Pipe">Pipe</option>
                  <option value="Drain">Drain</option>
                  <option value="Sink">Sink</option>
                  <option value="Faucet">Faucet</option>
                  <option value="Toilet">Toilet</option>
                  <option value="Shower">Shower</option>
                  <option value="Bathtub">Bathtub</option>
                  <option value="Valve">Valve</option>
                  <option value="Water Heater">Water Heater</option>
                  <option value="Vent">Vent</option>
                  <option value="Trap">Trap</option>
                  <option value="Elbow">Elbow</option>
                  <option value="Tee">Tee</option>
                  <option value="Coupling">Coupling</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Notes (SKU, etc.)</label>
                <textarea
                  value={partNotes}
                  onChange={(e) => setPartNotes(e.target.value)}
                  rows={3}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
                {editingPart && (
                  <button
                    type="button"
                    onClick={() => {
                      if (editingPart) {
                        deletePart(editingPart.id)
                        closePartForm()
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
                    onClick={closePartForm}
                    style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingPart}
                    style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                  >
                    {savingPart ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Part Prices Modal */}
      {viewingPartPrices && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: 8, maxWidth: '600px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ marginBottom: '1rem' }}>Prices for {viewingPartPrices.name}</h2>
            <PartPricesManager part={viewingPartPrices} supplyHouses={supplyHouses} onClose={() => setViewingPartPrices(null)} />
          </div>
        </div>
      )}

      {/* Supply House Management Modal */}
      {viewingSupplyHouses && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: 8, maxWidth: '800px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>Manage Supply Houses</h2>
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
                  {editingSupplyHouse && (
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

      {/* Templates & PO Builder Tab */}
      {activeTab === 'templates-po' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          {/* Left Panel: Material Templates */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2>Material Templates</h2>
              <button
                type="button"
                onClick={openAddTemplate}
                style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                Add Template
              </button>
            </div>

            <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, maxHeight: '600px', overflow: 'auto' }}>
              {materialTemplates.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                  No templates yet. Create your first template!
                </div>
              ) : (
                <div>
                  {materialTemplates.map(template => (
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
                              openEditTemplate(template)
                            }}
                            style={{ padding: '0.25rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Template Items View */}
            {selectedTemplate && (
              <div style={{ marginTop: '1.5rem', border: '1px solid #e5e7eb', borderRadius: 4, padding: '1rem' }}>
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
                      <option value="template">Nested Template</option>
                    </select>
                  </div>
                  {newItemType === 'part' ? (
                    <select
                      value={newItemPartId}
                      onChange={(e) => setNewItemPartId(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '0.5rem' }}
                    >
                      <option value="">Select part</option>
                      {parts.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={newItemTemplateId}
                      onChange={(e) => setNewItemTemplateId(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '0.5rem' }}
                    >
                      <option value="">Select template</option>
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
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Quantity</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {templateItems.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                            No items yet. Add parts or nested templates.
                          </td>
                        </tr>
                      ) : (
                        templateItems.map(item => (
                          <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '0.75rem' }}>{item.item_type === 'part' ? 'Part' : 'Template'}</td>
                            <td style={{ padding: '0.75rem' }}>
                              {item.item_type === 'part' ? item.part?.name : item.nested_template?.name}
                            </td>
                            <td style={{ padding: '0.75rem' }}>{item.quantity}</td>
                            <td style={{ padding: '0.75rem' }}>
                              <button
                                type="button"
                                onClick={() => removeItemFromTemplate(item.id)}
                                style={{ padding: '0.25rem 0.5rem', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer' }}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
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
                  No draft purchase orders. Create one from a template or manually.
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
                            .select('*, material_parts(*), supply_houses(*)')
                            .eq('purchase_order_id', po.id)
                            .order('sequence_order', { ascending: true })
                          
                          if (!itemsError && itemsData) {
                            const items = (itemsData as (PurchaseOrderItem & { material_parts: MaterialPart; supply_houses: SupplyHouse | null })[]) ?? []
                            const itemsWithDetails: POItemWithDetails[] = items.map(item => ({
                              ...item,
                              part: item.material_parts,
                              supply_house: item.supply_houses || undefined,
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
                              {po.items.length} items • ${total.toFixed(2)} total
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
                      Status: <strong>{editingPO.status}</strong> • {editingPO.items.length} items • ${editingPO.items.reduce((sum, item) => sum + (item.price_at_time * item.quantity), 0).toFixed(2)} total
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPO(null)
                      setEditingPOItem(null)
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
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Quantity</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Supply House</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Price</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Total</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editingPO.items.map(item => {
                          if (editingPOItem === item.id) {
                            // Edit mode
                            return (
                              <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb', background: '#fff' }}>
                                <td colSpan={6} style={{ padding: '1rem' }}>
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
                              <td style={{ padding: '0.75rem' }}>{item.supply_house?.name || '-'}</td>
                              <td style={{ padding: '0.75rem' }}>${item.price_at_time.toFixed(2)}</td>
                              <td style={{ padding: '0.75rem', fontWeight: 600 }}>${(item.price_at_time * item.quantity).toFixed(2)}</td>
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
                        <option value="">Select template...</option>
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
                      <select
                        value={selectedPartForPO}
                        onChange={(e) => setSelectedPartForPO(e.target.value)}
                        style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                      >
                        <option value="">Select part...</option>
                        {parts.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
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
            <h2 style={{ marginBottom: '1.5rem' }}>{editingTemplate ? 'Edit Template' : 'Add Template'}</h2>
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
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search purchase orders..."
              value={poSearchQuery}
              onChange={(e) => setPoSearchQuery(e.target.value)}
              style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
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
          </div>

          <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Name</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Status</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Items</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Total</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Created</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPOs.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                      {poSearchQuery || poStatusFilter !== 'all' ? 'No purchase orders match your filters' : 'No purchase orders yet.'}
                    </td>
                  </tr>
                ) : (
                  filteredPOs.map(po => {
                    const total = po.items.reduce((sum, item) => sum + (item.price_at_time * item.quantity), 0)
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
                        <td style={{ padding: '0.75rem', fontWeight: 600 }}>${total.toFixed(2)}</td>
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

          {/* PO Detail Modal */}
          {selectedPO && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ background: 'white', padding: '2rem', borderRadius: 8, maxWidth: '800px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
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
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Quantity</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Supply House</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Price</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Total</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Confirmed</th>
                        {selectedPO.status === 'draft' && (
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
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
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                  {loadingAvailablePrices ? (
                                    <span style={{ color: '#6b7280' }}>Loading prices...</span>
                                  ) : availablePricesForItem.length > 0 ? (
                                    <>
                                      <select
                                        value={selectedSupplyHouseForUpdate?.supply_house_id || item.supply_house?.id || ''}
                                        onChange={(e) => {
                                          const selectedPrice = availablePricesForItem.find(p => p.supply_house_id === e.target.value)
                                          if (selectedPrice) {
                                            setSelectedSupplyHouseForUpdate({ supply_house_id: selectedPrice.supply_house_id, price: selectedPrice.price })
                                          } else {
                                            setSelectedSupplyHouseForUpdate({ supply_house_id: '', price: 0 })
                                          }
                                        }}
                                        style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, minWidth: '200px' }}
                                      >
                                        {availablePricesForItem.map(price => (
                                          <option key={price.supply_house_id} value={price.supply_house_id}>
                                            {price.supply_house_name} - ${price.price.toFixed(2)}
                                            {price.supply_house_id === item.supply_house?.id ? ' (current)' : ''}
                                          </option>
                                        ))}
                                        {!item.supply_house && (
                                          <option value="">No Supply House - $0.00</option>
                                        )}
                                      </select>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (selectedSupplyHouseForUpdate) {
                                            updatePOItemSupplyHouse(item.id, selectedSupplyHouseForUpdate.supply_house_id, selectedSupplyHouseForUpdate.price)
                                          }
                                        }}
                                        disabled={!selectedSupplyHouseForUpdate || (selectedSupplyHouseForUpdate.supply_house_id === item.supply_house?.id && selectedSupplyHouseForUpdate.price === item.price_at_time)}
                                        style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                      >
                                        Update
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingPOItemSupplyHouseView(null)
                                          setAvailablePricesForItem([])
                                          setSelectedSupplyHouseForUpdate(null)
                                        }}
                                        style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                                      >
                                        Cancel
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <span style={{ color: '#6b7280' }}>No prices available</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingPOItemSupplyHouseView(null)
                                          setAvailablePricesForItem([])
                                          setSelectedSupplyHouseForUpdate(null)
                                        }}
                                        style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                                      >
                                        Cancel
                                      </button>
                                    </>
                                  )}
                                </div>
                              ) : (
                                item.supply_house?.name || '-'
                              )}
                            </td>
                            <td style={{ padding: '0.75rem' }}>${item.price_at_time.toFixed(2)}</td>
                            <td style={{ padding: '0.75rem', fontWeight: 600 }}>${(item.price_at_time * item.quantity).toFixed(2)}</td>
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
                            {selectedPO.status === 'draft' && (
                              <td style={{ padding: '0.75rem' }}>
                                {!isEditing ? (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      setEditingPOItemSupplyHouseView(item.id)
                                      await loadAvailablePricesForPart(item.part.id, item)
                                    }}
                                    style={{ padding: '0.25rem 0.5rem', background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd', borderRadius: 4, cursor: 'pointer' }}
                                  >
                                    Change
                                  </button>
                                ) : null}
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot style={{ background: '#f9fafb' }}>
                      <tr>
                        <td colSpan={selectedPO.status === 'draft' ? 6 : 5} style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>Grand Total:</td>
                        <td style={{ padding: '0.75rem', fontWeight: 600 }}>
                          ${selectedPO.items.reduce((sum, item) => sum + (item.price_at_time * item.quantity), 0).toFixed(2)}
                        </td>
                      </tr>
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
                        setSelectedSupplyHouseForUpdate(null)
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
                      onClick={() => {
                        setSelectedPO(null)
                        setEditingPOItemSupplyHouseView(null)
                        setAvailablePricesForItem([])
                        setSelectedSupplyHouseForUpdate(null)
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
                            // Navigate to projects page - user can then go to workflow and add PO there
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
            </div>
          )}
        </div>
      )}
    </div>
  )
}

type PriceHistory = Database['public']['Tables']['material_part_price_history']['Row'] & {
  supply_house: SupplyHouse
}

// Component for managing part prices
function PartPricesManager({ part, supplyHouses, onClose }: { part: MaterialPart; supplyHouses: SupplyHouse[]; onClose: () => void }) {
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
      const pricesList = (data as (MaterialPartPrice & { supply_houses: SupplyHouse })[]) ?? []
      setPrices(pricesList.map(p => ({ ...p, supply_house: p.supply_houses })))
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
      const historyList = (data as (Database['public']['Tables']['material_part_price_history']['Row'] & { supply_houses: SupplyHouse })[]) ?? []
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
