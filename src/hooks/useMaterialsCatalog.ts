import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import { fetchPricesForParts } from '../lib/materials/partPrices'
import { loadPartsCatalog } from '../lib/materials/partsCatalog'

type SupplyHouse = Database['public']['Tables']['supply_houses']['Row']
type MaterialPart = Database['public']['Tables']['material_parts']['Row']
type MaterialPartPrice = Database['public']['Tables']['material_part_prices']['Row']

export interface PartType {
  id: string
  service_type_id: string
  name: string
  category: string | null
  sequence_order: number
  created_at: string
  updated_at: string
}

export interface AssemblyType {
  id: string
  service_type_id: string
  name: string
  category: string | null
  sequence_order: number
  created_at: string
  updated_at: string
}

export type PartWithPrices = MaterialPart & {
  prices: (MaterialPartPrice & { supply_house: SupplyHouse })[]
  part_type?: PartType
}

const PARTS_PAGE_SIZE = 50

/**
 * The Materials page's parts-catalog engine (docs/MATERIALS_TABS_ARCHITECTURE.md
 * seam #1): the paginated `parts` / Load-All `allParts` caches, search/filter/
 * sort state, pagination + infinite-scroll plumbing, the per-user Load-All
 * localStorage preference (v2.46 disk-IO optimization — default OFF), and the
 * partTypes/assemblyTypes/supplyHouses reference caches.
 *
 * Parent-owned because pickers on the Assembly Book / PO Builder tabs and the
 * shared modals read `parts`/`allParts`. The parent destructures the returned
 * object so pre-extraction references keep their names. `activeTab` gates the
 * infinite-scroll effect exactly as before.
 */
export function useMaterialsCatalog({
  activeTab,
  authUserId,
  selectedServiceTypeId,
  setError,
}: {
  activeTab: string
  authUserId: string | undefined
  selectedServiceTypeId: string
  setError: (message: string | null) => void
}) {
  const [partTypes, setPartTypes] = useState<PartType[]>([])
  const [parts, setParts] = useState<PartWithPrices[]>([])
  const [supplyHouses, setSupplyHouses] = useState<SupplyHouse[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPartTypeId, setFilterPartTypeId] = useState<string>('')
  const [filterManufacturer, setFilterManufacturer] = useState<string>('')
  const [sortByPriceCountAsc, setSortByPriceCountAsc] = useState(false)
  const [partsPage, setPartsPage] = useState(0)
  const [hasMoreParts, setHasMoreParts] = useState(true)
  const [loadingPartsPage, setLoadingPartsPage] = useState(false)
  const loadingPartsRef = useRef(false)
  const LOAD_ALL_MODE_KEY = (uid: string) => `materials_loadAllMode_${uid}`
  const [loadAllMode, setLoadAllMode] = useState(false)
  const [allParts, setAllParts] = useState<PartWithPrices[]>([])
  const [loadingAllParts, setLoadingAllParts] = useState(false)
  const [clientSearchQuery, setClientSearchQuery] = useState('')
  const [assemblyTypes, setAssemblyTypes] = useState<AssemblyType[]>([])

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

  async function loadAssemblyTypes() {
    if (!selectedServiceTypeId) {
      setAssemblyTypes([])
      return
    }
    
    const { data, error } = await supabase
      .from('assembly_types' as any)
      .select('*')
      .eq('service_type_id', selectedServiceTypeId)
      .order('sequence_order', { ascending: true })
    
    if (error) {
      console.error('Failed to load assembly types:', error)
      setAssemblyTypes([])
      return
    }
    
    setAssemblyTypes((data as unknown as AssemblyType[]) ?? [])
  }

  async function loadSupplyHouses() {
    const { data, error } = await supabase
      .from('supply_houses')
      .select('*')
      .order('name')
    if (error) {
      const fallback = await supabase.from('supply_houses').select('id, name, contact_name, phone, email, address, notes, website_url, created_at, updated_at').order('name')
      if (fallback.error) {
        setError(`Failed to load supply houses: ${error.message}`)
        return
      }
      setSupplyHouses((fallback.data ?? []).map((h) => ({ ...h, monthly_payment_day: null })) as SupplyHouse[])
    } else {
      setSupplyHouses((data as SupplyHouse[]) ?? [])
    }
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

    // If sorting by price count (and no part/manufacturer filters), use RPC function to get ordered part IDs first
    if (options?.sortByPriceCount && !options?.partTypeId && !options?.manufacturer) {
      const { data: orderedParts, error: orderError } = await supabase
        .rpc('get_parts_ordered_by_price_count' as any, { ascending_order: true, filter_service_type_id: serviceType })
      
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
      
      // Batch-fetch prices for all parts in one query
      const pricesByPartId = await fetchPricesForParts(supabase, orderedPartsList.map(p => p.id))
      const partsWithPrices: PartWithPrices[] = orderedPartsList.map(part => ({
        ...part,
        prices: pricesByPartId.get(part.id) ?? [],
      }))
      
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

    // Batch-fetch prices for all parts in one query
    const pricesByPartId = await fetchPricesForParts(supabase, partsList.map(p => p.id))
    const partsWithPrices: PartWithPrices[] = partsList.map(part => ({
      ...part,
      prices: pricesByPartId.get(part.id) ?? [],
    }))

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
      // Every part, paged past PostgREST's 1,000-row cap (v2.2755) — the
      // assembly/template pickers read this list and Plumbing is past the cap.
      const rawPartsList = await loadPartsCatalog<MaterialPart & { part_types?: unknown }>(supabase, serviceType)
      const partsList = rawPartsList.map(p => ({
        ...p,
        part_type: p.part_types
      })) as MaterialPart[]
      
      // Batch-fetch all prices in one or few queries
      const pricesByPartId = await fetchPricesForParts(supabase, partsList.map(p => p.id))
      const partsWithPrices: PartWithPrices[] = partsList.map(part => ({
        ...part,
        prices: pricesByPartId.get(part.id) ?? [],
      }))
      
      setAllParts(partsWithPrices)
    } catch (err: any) {
      setError(`Failed to load all parts: ${err.message}`)
    } finally {
      setLoadingAllParts(false)
    }
  }

  const reloadPartsFirstPage = useCallback(async () => {
    setPartsPage(0)
    setHasMoreParts(true)
    await loadParts(0, {
      searchQuery,
      partTypeId: filterPartTypeId,
      manufacturer: filterManufacturer,
      sortByPriceCount: sortByPriceCountAsc,
    })
  }, [searchQuery, filterPartTypeId, filterManufacturer, sortByPriceCountAsc])

  useEffect(() => {
    if (!authUserId || typeof window === 'undefined') return
    const stored = localStorage.getItem(LOAD_ALL_MODE_KEY(authUserId))
    setLoadAllMode(stored === 'true')
  }, [authUserId])


  useEffect(() => {
    const timer = setTimeout(() => {
      if (loadAllMode) return // loadAllMode filters client-side, no reload needed
      reloadPartsFirstPage()
    }, 300) // 300ms debounce for search typing
    
    return () => clearTimeout(timer)
  }, [searchQuery, filterPartTypeId, filterManufacturer, sortByPriceCountAsc, loadAllMode])

  useEffect(() => {
    if (activeTab !== 'parts-book' || loadAllMode) return
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

  return {
    partTypes,
    setPartTypes,
    parts,
    setParts,
    supplyHouses,
    setSupplyHouses,
    searchQuery,
    setSearchQuery,
    filterPartTypeId,
    setFilterPartTypeId,
    filterManufacturer,
    setFilterManufacturer,
    sortByPriceCountAsc,
    setSortByPriceCountAsc,
    partsPage,
    setPartsPage,
    hasMoreParts,
    setHasMoreParts,
    loadingPartsPage,
    loadAllMode,
    setLoadAllMode,
    allParts,
    setAllParts,
    loadingAllParts,
    clientSearchQuery,
    setClientSearchQuery,
    assemblyTypes,
    setAssemblyTypes,
    LOAD_ALL_MODE_KEY,
    loadPartTypes,
    loadAssemblyTypes,
    loadSupplyHouses,
    loadParts,
    loadAllParts,
    reloadPartsFirstPage,
  }
}
