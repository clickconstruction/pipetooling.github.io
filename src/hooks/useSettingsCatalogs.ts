import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useLedgerDisplayPrefixes } from '../contexts/LedgerDisplayPrefixContext'
import {
  classifyOrphanMaterialPrices,
  countTakeoffEntriesByFixtureType,
  type OrphanedPriceRow,
} from '../lib/settingsCatalogs'
import type {
  AssemblyType,
  CountsFixtureGroup,
  CountsFixtureGroupItem,
  FixtureType,
  PartType,
  ServiceType,
} from '../types/settingsRows'

/**
 * The five Settings → Catalogs & trades CRUD engines (service types, material part
 * types, material assembly types, takeoff/labor/price book names, counts quick-add
 * groups) plus the orphan-material-prices review — extracted verbatim from
 * Settings.tsx (v2.855). Instantiated by the PARENT (not the tab) because
 * `serviceTypes` is cross-tab substrate: the parent's estimator default-selection
 * sync effect and `visibleServiceTypesForMaterials` memo read it, and loadData
 * still calls `loadServiceTypes()` for dev|estimator.
 * `setError` is the parent's shared error state (map quirk #4 — preserve).
 */
export function useSettingsCatalogs({ setError }: { setError: (message: string | null) => void }) {
  const { reload: reloadLedgerPrefixMap } = useLedgerDisplayPrefixes()

  // Service Types state
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
  const [serviceTypeFormOpen, setServiceTypeFormOpen] = useState(false)
  const [editingServiceType, setEditingServiceType] = useState<ServiceType | null>(null)
  const [serviceTypeName, setServiceTypeName] = useState('')
  const [serviceTypeDescription, setServiceTypeDescription] = useState('')
  const [serviceTypeColor, setServiceTypeColor] = useState('')
  const [serviceTypeLedgerJobPrefix, setServiceTypeLedgerJobPrefix] = useState('')
  const [serviceTypeLedgerBidPrefix, setServiceTypeLedgerBidPrefix] = useState('')
  const [serviceTypeSaving, setServiceTypeSaving] = useState(false)
  const [serviceTypeError, setServiceTypeError] = useState<string | null>(null)

  // Fixture Types state
  const [fixtureTypes, setFixtureTypes] = useState<FixtureType[]>([])
  const [selectedServiceTypeForFixtures, setSelectedServiceTypeForFixtures] = useState<string>('')
  const [fixtureTypeFormOpen, setFixtureTypeFormOpen] = useState(false)
  const [editingFixtureType, setEditingFixtureType] = useState<FixtureType | null>(null)
  const [fixtureTypeName, setFixtureTypeName] = useState('')
  const [fixtureTypeSaving, setFixtureTypeSaving] = useState(false)
  const [fixtureTypeError, setFixtureTypeError] = useState<string | null>(null)
  const [fixtureTypePriceBookCounts, setFixtureTypePriceBookCounts] = useState<Record<string, number>>({})
  const [fixtureTypeLaborBookCounts, setFixtureTypeLaborBookCounts] = useState<Record<string, number>>({})
  const [fixtureTypeTakeoffBookCounts, setFixtureTypeTakeoffBookCounts] = useState<Record<string, number>>({})
  const [removingUnusedFixtureTypes, setRemovingUnusedFixtureTypes] = useState(false)

  // Counts Fixtures state (quick-select groups for Bids Counts)
  const [countsFixtureGroups, setCountsFixtureGroups] = useState<CountsFixtureGroup[]>([])
  const [countsFixtureGroupItems, setCountsFixtureGroupItems] = useState<CountsFixtureGroupItem[]>([])
  const [selectedServiceTypeForCountsFixtures, setSelectedServiceTypeForCountsFixtures] = useState<string>('')
  const [countsFixtureGroupFormOpen, setCountsFixtureGroupFormOpen] = useState(false)
  const [editingCountsFixtureGroup, setEditingCountsFixtureGroup] = useState<CountsFixtureGroup | null>(null)
  const [countsFixtureGroupLabel, setCountsFixtureGroupLabel] = useState('')
  const [countsFixtureGroupSaving, setCountsFixtureGroupSaving] = useState(false)
  const [countsFixtureGroupError, setCountsFixtureGroupError] = useState<string | null>(null)
  const [countsFixtureItemFormOpen, setCountsFixtureItemFormOpen] = useState(false)
  const [editingCountsFixtureGroupForItem, setEditingCountsFixtureGroupForItem] = useState<CountsFixtureGroup | null>(null)
  const [editingCountsFixtureItem, setEditingCountsFixtureItem] = useState<CountsFixtureGroupItem | null>(null)
  const [countsFixtureItemName, setCountsFixtureItemName] = useState('')
  const [countsFixtureItemSaving, setCountsFixtureItemSaving] = useState(false)
  const [countsFixtureItemError, setCountsFixtureItemError] = useState<string | null>(null)

  // Part Types state (for Materials)
  const [partTypes, setPartTypes] = useState<PartType[]>([])
  const [selectedServiceTypeForParts, setSelectedServiceTypeForParts] = useState<string>('')
  const [partTypeFormOpen, setPartTypeFormOpen] = useState(false)
  const [editingPartType, setEditingPartType] = useState<PartType | null>(null)
  const [partTypeName, setPartTypeName] = useState('')
  const [partTypeSaving, setPartTypeSaving] = useState(false)
  const [partTypeError, setPartTypeError] = useState<string | null>(null)
  const [partTypePartCounts, setPartTypePartCounts] = useState<Record<string, number>>({})
  const [removingUnusedPartTypes, setRemovingUnusedPartTypes] = useState(false)

  // Assembly Types state (for Materials)
  const [assemblyTypes, setAssemblyTypes] = useState<AssemblyType[]>([])
  const [selectedServiceTypeForAssemblies, setSelectedServiceTypeForAssemblies] = useState<string>('')
  const [assemblyTypeFormOpen, setAssemblyTypeFormOpen] = useState(false)
  const [editingAssemblyType, setEditingAssemblyType] = useState<AssemblyType | null>(null)
  const [assemblyTypeName, setAssemblyTypeName] = useState('')
  const [assemblyTypeSaving, setAssemblyTypeSaving] = useState(false)
  const [assemblyTypeError, setAssemblyTypeError] = useState<string | null>(null)
  const [assemblyTypeAssemblyCounts, setAssemblyTypeAssemblyCounts] = useState<Record<string, number>>({})
  const [removingUnusedAssemblyTypes, setRemovingUnusedAssemblyTypes] = useState(false)

  // Manage Parts / orphan prices state
  const [managePartsSectionOpen, setManagePartsSectionOpen] = useState(false)
  const [viewingOrphanPrices, setViewingOrphanPrices] = useState(false)
  const [orphanPrices, setOrphanPrices] = useState<OrphanedPriceRow[]>([])
  const [loadingOrphanPrices, setLoadingOrphanPrices] = useState(false)
  const [orphanError, setOrphanError] = useState<string | null>(null)

  async function loadOrphanMaterialPrices() {
    setOrphanError(null)
    setLoadingOrphanPrices(true)
    try {
      const { data, error } = await supabase
        .from('material_part_prices')
        .select('*, material_parts(*), supply_houses(*)')
      if (error) {
        setOrphanError(error.message)
        setOrphanPrices([])
        return
      }
      const rows = (data as any[]) ?? []
      setOrphanPrices(classifyOrphanMaterialPrices(rows))
    } catch (e) {
      setOrphanError(e instanceof Error ? e.message : 'Failed to load orphaned prices')
      setOrphanPrices([])
    } finally {
      setLoadingOrphanPrices(false)
    }
  }

  async function deleteOrphanPrice(id: string) {
    if (!id) return
    const { error } = await supabase.from('material_part_prices').delete().eq('id', id)
    if (error) {
      setOrphanError(error.message)
      return
    }
    setOrphanPrices((prev) => prev.filter((p) => p.id !== id))
  }

  async function deleteAllOrphanPrices() {
    if (orphanPrices.length === 0) return
    if (!confirm('Delete ALL orphaned material prices listed here? A dev can put them back for 90 days from Settings → Data & migration → Recently deleted.')) return
    const ids = orphanPrices.map((p) => p.id)
    const { error } = await supabase.from('material_part_prices').delete().in('id', ids)
    if (error) {
      setOrphanError(error.message)
      return
    }
    setOrphanPrices([])
  }

  // Service Types functions
  async function loadServiceTypes() {
    const { data, error: eServiceTypes } = await supabase
      .from('service_types' as any)
      .select('*')
      .order('sequence_order', { ascending: true })
    
    if (eServiceTypes) {
      console.error('Error loading service types:', eServiceTypes)
    } else {
      setServiceTypes((data as unknown as ServiceType[]) ?? [])
    }
  }

  function openEditServiceType(serviceType: ServiceType | null) {
    setEditingServiceType(serviceType)
    setServiceTypeName(serviceType?.name || '')
    setServiceTypeDescription(serviceType?.description || '')
    setServiceTypeColor(serviceType?.color || '')
    setServiceTypeLedgerJobPrefix((serviceType?.ledger_job_prefix ?? '').trim())
    setServiceTypeLedgerBidPrefix((serviceType?.ledger_bid_prefix ?? '').trim())
    setServiceTypeError(null)
    setServiceTypeFormOpen(true)
  }

  function closeEditServiceType() {
    setEditingServiceType(null)
    setServiceTypeName('')
    setServiceTypeDescription('')
    setServiceTypeColor('')
    setServiceTypeLedgerJobPrefix('')
    setServiceTypeLedgerBidPrefix('')
    setServiceTypeError(null)
    setServiceTypeFormOpen(false)
  }

  async function saveServiceType(e: FormEvent) {
    e.preventDefault()
    
    setServiceTypeSaving(true)
    setServiceTypeError(null)
    
    if (!serviceTypeName.trim()) {
      setServiceTypeError('Name is required')
      setServiceTypeSaving(false)
      return
    }

    const jobPx = serviceTypeLedgerJobPrefix.trim()
    const bidPx = serviceTypeLedgerBidPrefix.trim()
    const MAX_PREFIX = 4
    if (jobPx.length > MAX_PREFIX || bidPx.length > MAX_PREFIX) {
      setServiceTypeError(`Ledger prefixes must be at most ${MAX_PREFIX} characters`)
      setServiceTypeSaving(false)
      return
    }
    const normPx = (s: string) => s.trim().toLowerCase()
    const others = serviceTypes.filter((st) => !editingServiceType || st.id !== editingServiceType.id)
    if (jobPx && others.some((st) => normPx(st.ledger_job_prefix ?? '') === normPx(jobPx))) {
      setServiceTypeError('Another service type already uses this job ledger prefix')
      setServiceTypeSaving(false)
      return
    }
    if (bidPx && others.some((st) => normPx(st.ledger_bid_prefix ?? '') === normPx(bidPx))) {
      setServiceTypeError('Another service type already uses this bid ledger prefix')
      setServiceTypeSaving(false)
      return
    }
    if (editingServiceType) {
      // Update existing service type
      const { error: e } = await supabase
        .from('service_types' as any)
        .update({
          name: serviceTypeName.trim(),
          description: serviceTypeDescription.trim() || null,
          color: serviceTypeColor.trim() || null,
          ledger_job_prefix: jobPx || null,
          ledger_bid_prefix: bidPx || null,
        } as any)
        .eq('id', editingServiceType.id)
      
      setServiceTypeSaving(false)
      
      if (e) {
        setServiceTypeError(e.message)
      } else {
        await loadServiceTypes()
        void reloadLedgerPrefixMap()
        closeEditServiceType()
      }
    } else {
      // Create new service type
      const maxSeq = serviceTypes.reduce((max, st) => Math.max(max, st.sequence_order), 0)
      const { error: e } = await supabase
        .from('service_types' as any)
        .insert({
          name: serviceTypeName.trim(),
          description: serviceTypeDescription.trim() || null,
          color: serviceTypeColor.trim() || null,
          ledger_job_prefix: jobPx || null,
          ledger_bid_prefix: bidPx || null,
          sequence_order: maxSeq + 1,
        } as any)
      
      setServiceTypeSaving(false)
      
      if (e) {
        setServiceTypeError(e.message)
      } else {
        await loadServiceTypes()
        void reloadLedgerPrefixMap()
        closeEditServiceType()
      }
    }
  }

  async function deleteServiceType(serviceType: ServiceType) {
    if (!confirm(`Are you sure you want to delete "${serviceType.name}"? This will fail if any items are assigned to this service type.`)) {
      return
    }
    
    const { error: e } = await supabase
      .from('service_types' as any)
      .delete()
      .eq('id', serviceType.id)
    
    if (e) {
      if (e.message.includes('violates foreign key constraint')) {
        setError(`Cannot delete service type "${serviceType.name}" because it has associated items. Please reassign or delete those items first.`)
      } else {
        setError(e.message)
      }
    } else {
      await loadServiceTypes()
    }
  }

  async function moveServiceType(serviceType: ServiceType, direction: 'up' | 'down') {
    const currentIndex = serviceTypes.findIndex(st => st.id === serviceType.id)
    if (currentIndex === -1) return
    
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= serviceTypes.length) return
    
    const targetServiceType = serviceTypes[targetIndex]
    if (!targetServiceType) return
    
    // Swap sequence orders
    await supabase
      .from('service_types' as any)
      .update({ sequence_order: targetServiceType.sequence_order } as any)
      .eq('id', serviceType.id)
    
    await supabase
      .from('service_types' as any)
      .update({ sequence_order: serviceType.sequence_order } as any)
      .eq('id', targetServiceType.id)
    
    await loadServiceTypes()
  }

  // Fixture Types functions
  async function loadFixtureTypes() {
    if (!selectedServiceTypeForFixtures) {
      setFixtureTypes([])
      return
    }
    
    const { data, error: eFixtureTypes } = await supabase
      .from('fixture_types' as any)
      .select('*')
      .eq('service_type_id', selectedServiceTypeForFixtures)
      .order('name', { ascending: true })
    
    if (eFixtureTypes) {
      console.error('Error loading fixture types:', eFixtureTypes)
    } else {
      setFixtureTypes((data as unknown as FixtureType[]) ?? [])
    }
  }

  async function loadFixtureTypeCounts() {
    if (!selectedServiceTypeForFixtures) {
      setFixtureTypePriceBookCounts({})
      setFixtureTypeLaborBookCounts({})
      setFixtureTypeTakeoffBookCounts({})
      return
    }
    
    const fixtureTypeIds = fixtureTypes.map(ft => ft.id)
    
    if (fixtureTypeIds.length === 0) {
      setFixtureTypePriceBookCounts({})
      setFixtureTypeLaborBookCounts({})
      setFixtureTypeTakeoffBookCounts({})
      return
    }
    
    // Query price book, labor book, and takeoff book in parallel
    const [priceBookResult, laborBookResult, takeoffVersionsResult] = await Promise.all([
      supabase
        .from('price_book_entries')
        .select('fixture_type_id')
        .in('fixture_type_id', fixtureTypeIds),
      supabase
        .from('labor_book_entries')
        .select('fixture_type_id')
        .in('fixture_type_id', fixtureTypeIds),
      supabase
        .from('takeoff_book_versions')
        .select('id')
        .eq('service_type_id', selectedServiceTypeForFixtures)
    ])
    
    // Count price book entries
    const priceBookCounts: Record<string, number> = {}
    fixtureTypeIds.forEach(id => priceBookCounts[id] = 0)
    priceBookResult.data?.forEach(row => {
      if (row.fixture_type_id) {
        priceBookCounts[row.fixture_type_id] = (priceBookCounts[row.fixture_type_id] || 0) + 1
      }
    })
    setFixtureTypePriceBookCounts(priceBookCounts)
    
    // Count labor book entries
    const laborBookCounts: Record<string, number> = {}
    fixtureTypeIds.forEach(id => laborBookCounts[id] = 0)
    laborBookResult.data?.forEach(row => {
      if (row.fixture_type_id) {
        laborBookCounts[row.fixture_type_id] = (laborBookCounts[row.fixture_type_id] || 0) + 1
      }
    })
    setFixtureTypeLaborBookCounts(laborBookCounts)
    
    // Count takeoff book entries (matched by fixture_name or alias_names)
    let takeoffBookCounts: Record<string, number> = {}
    fixtureTypeIds.forEach(id => takeoffBookCounts[id] = 0)
    const versionIds = (takeoffVersionsResult.data ?? []).map(v => v.id)
    if (versionIds.length > 0) {
      const takeoffEntriesResult = await supabase
        .from('takeoff_book_entries')
        .select('fixture_name, alias_names')
        .in('version_id', versionIds)
      takeoffBookCounts = countTakeoffEntriesByFixtureType(takeoffEntriesResult.data ?? [], fixtureTypes)
      if (takeoffEntriesResult.error) console.error('Error loading takeoff book counts:', takeoffEntriesResult.error)
    }
    setFixtureTypeTakeoffBookCounts(takeoffBookCounts)
    
    // Log any errors
    if (priceBookResult.error) console.error('Error loading price book counts:', priceBookResult.error)
    if (laborBookResult.error) console.error('Error loading labor book counts:', laborBookResult.error)
    if (takeoffVersionsResult.error) console.error('Error loading takeoff book versions:', takeoffVersionsResult.error)
  }

  function openEditFixtureType(fixtureType: FixtureType | null) {
    setEditingFixtureType(fixtureType)
    setFixtureTypeName(fixtureType?.name || '')
    setFixtureTypeError(null)
    setFixtureTypeFormOpen(true)
  }

  function closeEditFixtureType() {
    setEditingFixtureType(null)
    setFixtureTypeName('')
    setFixtureTypeError(null)
    setFixtureTypeFormOpen(false)
  }

  async function saveFixtureType(e: FormEvent) {
    e.preventDefault()
    
    if (!selectedServiceTypeForFixtures) {
      setFixtureTypeError('Please select a service type first')
      return
    }
    
    setFixtureTypeSaving(true)
    setFixtureTypeError(null)
    
    if (!fixtureTypeName.trim()) {
      setFixtureTypeError('Name is required')
      setFixtureTypeSaving(false)
      return
    }
    
    if (editingFixtureType) {
      // Update existing fixture type
      const { error: e } = await supabase
        .from('fixture_types' as any)
        .update({
          name: fixtureTypeName.trim(),
          category: null,
        } as any)
        .eq('id', editingFixtureType.id)
      
      setFixtureTypeSaving(false)
      
      if (e) {
        setFixtureTypeError(e.message)
      } else {
        await loadFixtureTypes()
        closeEditFixtureType()
      }
    } else {
      // Create new fixture type
      const maxSeq = fixtureTypes.reduce((max, ft) => Math.max(max, ft.sequence_order), 0)
      const { error: e } = await supabase
        .from('fixture_types' as any)
        .insert({
          service_type_id: selectedServiceTypeForFixtures,
          name: fixtureTypeName.trim(),
          category: null,
          sequence_order: maxSeq + 1,
        } as any)
      
      setFixtureTypeSaving(false)
      
      if (e) {
        setFixtureTypeError(e.message)
      } else {
        await loadFixtureTypes()
        closeEditFixtureType()
      }
    }
  }

  async function removeUnusedFixtureTypes() {
    const unused = fixtureTypes.filter(ft => {
      const takeoff = fixtureTypeTakeoffBookCounts[ft.id] ?? 0
      const labor = fixtureTypeLaborBookCounts[ft.id] ?? 0
      const price = fixtureTypePriceBookCounts[ft.id] ?? 0
      return takeoff === 0 && labor === 0 && price === 0
    })
    if (unused.length === 0) {
      setError('No unused book names found. All have at least one takeoff, labor, or price entry.')
      return
    }
    if (!confirm(`Remove ${unused.length} book name${unused.length === 1 ? '' : 's'} with 0 takeoff, 0 labor, 0 price?\n\n${unused.map(ft => ft.name).join(', ')}`)) return
    setRemovingUnusedFixtureTypes(true)
    setError(null)
    for (const ft of unused) {
      const { error: e } = await supabase.from('fixture_types' as any).delete().eq('id', ft.id)
      if (e) {
        setError(`Failed to delete "${ft.name}": ${e.message}`)
        break
      }
    }
    setRemovingUnusedFixtureTypes(false)
    await loadFixtureTypes()
    // Counts will reload via useEffect when fixtureTypes updates
  }

  async function deleteFixtureType(fixtureType: FixtureType) {
    if (!confirm(`Are you sure you want to delete "${fixtureType.name}"? This will fail if any items are assigned to this book name.`)) {
      return
    }
    
    const { error: e } = await supabase
      .from('fixture_types' as any)
      .delete()
      .eq('id', fixtureType.id)
    
    if (e) {
      if (e.message.includes('violates foreign key constraint')) {
        setError(`Cannot delete book name "${fixtureType.name}" because it has associated items. Please reassign or delete those items first.`)
      } else {
        setError(e.message)
      }
    } else {
      await loadFixtureTypes()
    }
  }

  // Counts Fixtures functions
  async function loadCountsFixtureGroups() {
    if (!selectedServiceTypeForCountsFixtures) {
      setCountsFixtureGroups([])
      setCountsFixtureGroupItems([])
      return
    }
    const { data: groupsData, error: eGroups } = await supabase
      .from('counts_fixture_groups')
      .select('id, service_type_id, label, sequence_order')
      .eq('service_type_id', selectedServiceTypeForCountsFixtures)
      .order('sequence_order', { ascending: true })
    if (eGroups) {
      setCountsFixtureGroups([])
      setCountsFixtureGroupItems([])
      return
    }
    const groups = (groupsData as CountsFixtureGroup[]) ?? []
    setCountsFixtureGroups(groups)
    if (groups.length === 0) {
      setCountsFixtureGroupItems([])
      return
    }
    const groupIds = groups.map((g) => g.id)
    const { data: itemsData, error: eItems } = await supabase
      .from('counts_fixture_group_items')
      .select('id, group_id, name, sequence_order')
      .in('group_id', groupIds)
      .order('sequence_order', { ascending: true })
    if (eItems) {
      setCountsFixtureGroupItems([])
      return
    }
    setCountsFixtureGroupItems((itemsData as CountsFixtureGroupItem[]) ?? [])
  }

  useEffect(() => {
    if (selectedServiceTypeForCountsFixtures) {
      void loadCountsFixtureGroups()
    } else {
      setCountsFixtureGroups([])
      setCountsFixtureGroupItems([])
    }
  }, [selectedServiceTypeForCountsFixtures])

  function openEditCountsFixtureGroup(group: CountsFixtureGroup | null) {
    setEditingCountsFixtureGroup(group)
    setCountsFixtureGroupLabel(group?.label ?? '')
    setCountsFixtureGroupError(null)
    setCountsFixtureGroupFormOpen(true)
  }

  function closeEditCountsFixtureGroup() {
    setEditingCountsFixtureGroup(null)
    setCountsFixtureGroupLabel('')
    setCountsFixtureGroupError(null)
    setCountsFixtureGroupFormOpen(false)
  }

  async function saveCountsFixtureGroup(e: FormEvent) {
    e.preventDefault()
    if (!selectedServiceTypeForCountsFixtures) return
    setCountsFixtureGroupSaving(true)
    setCountsFixtureGroupError(null)
    if (!countsFixtureGroupLabel.trim()) {
      setCountsFixtureGroupError('Label is required')
      setCountsFixtureGroupSaving(false)
      return
    }
    if (editingCountsFixtureGroup) {
      const { error: err } = await supabase
        .from('counts_fixture_groups')
        .update({ label: countsFixtureGroupLabel.trim() })
        .eq('id', editingCountsFixtureGroup.id)
      setCountsFixtureGroupSaving(false)
      if (err) setCountsFixtureGroupError(err.message)
      else { await loadCountsFixtureGroups(); closeEditCountsFixtureGroup() }
    } else {
      const maxSeq = countsFixtureGroups.reduce((max, g) => Math.max(max, g.sequence_order), 0)
      const { error: err } = await supabase
        .from('counts_fixture_groups')
        .insert({ service_type_id: selectedServiceTypeForCountsFixtures, label: countsFixtureGroupLabel.trim(), sequence_order: maxSeq + 1 })
      setCountsFixtureGroupSaving(false)
      if (err) setCountsFixtureGroupError(err.message)
      else { await loadCountsFixtureGroups(); closeEditCountsFixtureGroup() }
    }
  }

  async function deleteCountsFixtureGroup(group: CountsFixtureGroup) {
    if (!confirm(`Delete group "${group.label}" and all its fixtures?`)) return
    const { error: err } = await supabase.from('counts_fixture_groups').delete().eq('id', group.id)
    if (err) setError(err.message)
    else await loadCountsFixtureGroups()
  }

  async function moveCountsFixtureGroup(group: CountsFixtureGroup, direction: 'up' | 'down') {
    const idx = countsFixtureGroups.findIndex((g) => g.id === group.id)
    if (idx === -1) return
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= countsFixtureGroups.length) return
    const target = countsFixtureGroups[targetIdx]
    if (!target) return
    await supabase.from('counts_fixture_groups').update({ sequence_order: target.sequence_order }).eq('id', group.id)
    await supabase.from('counts_fixture_groups').update({ sequence_order: group.sequence_order }).eq('id', target.id)
    await loadCountsFixtureGroups()
  }

  function openEditCountsFixtureItem(grp: CountsFixtureGroup, item: CountsFixtureGroupItem | null) {
    setEditingCountsFixtureGroupForItem(grp)
    setEditingCountsFixtureItem(item)
    setCountsFixtureItemName(item?.name ?? '')
    setCountsFixtureItemError(null)
    setCountsFixtureItemFormOpen(true)
  }

  function closeEditCountsFixtureItem() {
    setEditingCountsFixtureGroupForItem(null)
    setEditingCountsFixtureItem(null)
    setCountsFixtureItemName('')
    setCountsFixtureItemError(null)
    setCountsFixtureItemFormOpen(false)
  }

  async function saveCountsFixtureItem(e: FormEvent) {
    e.preventDefault()
    if (!editingCountsFixtureGroupForItem) return
    setCountsFixtureItemSaving(true)
    setCountsFixtureItemError(null)
    if (!countsFixtureItemName.trim()) {
      setCountsFixtureItemError('Name is required')
      setCountsFixtureItemSaving(false)
      return
    }
    if (editingCountsFixtureItem) {
      const { error: err } = await supabase
        .from('counts_fixture_group_items')
        .update({ name: countsFixtureItemName.trim() })
        .eq('id', editingCountsFixtureItem.id)
      setCountsFixtureItemSaving(false)
      if (err) setCountsFixtureItemError(err.message)
      else { await loadCountsFixtureGroups(); closeEditCountsFixtureItem() }
    } else {
      const groupItems = countsFixtureGroupItems.filter((i) => i.group_id === editingCountsFixtureGroupForItem.id)
      const maxSeq = groupItems.reduce((max, i) => Math.max(max, i.sequence_order), 0)
      const { error: err } = await supabase
        .from('counts_fixture_group_items')
        .insert({ group_id: editingCountsFixtureGroupForItem.id, name: countsFixtureItemName.trim(), sequence_order: maxSeq + 1 })
      setCountsFixtureItemSaving(false)
      if (err) setCountsFixtureItemError(err.message)
      else { await loadCountsFixtureGroups(); closeEditCountsFixtureItem() }
    }
  }

  async function deleteCountsFixtureItem(item: CountsFixtureGroupItem) {
    if (!confirm(`Delete "${item.name}"?`)) return
    const { error: err } = await supabase.from('counts_fixture_group_items').delete().eq('id', item.id)
    if (err) setError(err.message)
    else await loadCountsFixtureGroups()
  }

  async function moveCountsFixtureItem(item: CountsFixtureGroupItem, direction: 'up' | 'down') {
    const groupItems = countsFixtureGroupItems.filter((i) => i.group_id === item.group_id).sort((a, b) => a.sequence_order - b.sequence_order)
    const idx = groupItems.findIndex((i) => i.id === item.id)
    if (idx === -1) return
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= groupItems.length) return
    const target = groupItems[targetIdx]
    if (!target) return
    await supabase.from('counts_fixture_group_items').update({ sequence_order: target.sequence_order }).eq('id', item.id)
    await supabase.from('counts_fixture_group_items').update({ sequence_order: item.sequence_order }).eq('id', target.id)
    await loadCountsFixtureGroups()
  }

  // Part Types functions (for Materials)
  async function loadPartTypes() {
    if (!selectedServiceTypeForParts) {
      setPartTypes([])
      return
    }
    
    const { data, error: ePartTypes } = await supabase
      .from('part_types' as any)
      .select('*')
      .eq('service_type_id', selectedServiceTypeForParts)
      .order('sequence_order', { ascending: true })
    
    if (ePartTypes) {
      console.error('Error loading part types:', ePartTypes)
    } else {
      setPartTypes((data as unknown as PartType[]) ?? [])
    }
  }

  async function loadPartTypePartCounts() {
    if (!selectedServiceTypeForParts) {
      setPartTypePartCounts({})
      return
    }
    
    // Get all part types for this service type
    const partTypeIds = partTypes.map(pt => pt.id)
    
    if (partTypeIds.length === 0) {
      setPartTypePartCounts({})
      return
    }
    
    // Query material_parts grouped by part_type_id
    const { data, error } = await supabase
      .from('material_parts')
      .select('part_type_id')
      .in('part_type_id', partTypeIds)
    
    if (error) {
      console.error('Error loading part counts:', error)
      return
    }
    
    // Count parts per part type
    const counts: Record<string, number> = {}
    partTypeIds.forEach(id => counts[id] = 0)
    
    data?.forEach(row => {
      if (row.part_type_id) {
        counts[row.part_type_id] = (counts[row.part_type_id] || 0) + 1
      }
    })
    
    setPartTypePartCounts(counts)
  }

  function openEditPartType(partType: PartType | null) {
    setEditingPartType(partType)
    setPartTypeName(partType?.name || '')
    setPartTypeError(null)
    setPartTypeFormOpen(true)
  }

  function closeEditPartType() {
    setEditingPartType(null)
    setPartTypeName('')
    setPartTypeError(null)
    setPartTypeFormOpen(false)
  }

  async function savePartType(e: FormEvent) {
    e.preventDefault()
    
    if (!selectedServiceTypeForParts) {
      setPartTypeError('Please select a service type first')
      return
    }
    
    setPartTypeSaving(true)
    setPartTypeError(null)
    
    if (!partTypeName.trim()) {
      setPartTypeError('Name is required')
      setPartTypeSaving(false)
      return
    }
    
    if (editingPartType) {
      // Update existing part type
      const { error: e } = await supabase
        .from('part_types' as any)
        .update({
          name: partTypeName.trim(),
          category: null,
        } as any)
        .eq('id', editingPartType.id)
      
      setPartTypeSaving(false)
      
      if (e) {
        setPartTypeError(e.message)
      } else {
        await loadPartTypes()
        closeEditPartType()
      }
    } else {
      // Create new part type
      const maxSeq = partTypes.reduce((max, pt) => Math.max(max, pt.sequence_order), 0)
      const { error: e } = await supabase
        .from('part_types' as any)
        .insert({
          service_type_id: selectedServiceTypeForParts,
          name: partTypeName.trim(),
          category: null,
          sequence_order: maxSeq + 1,
        } as any)
      
      setPartTypeSaving(false)
      
      if (e) {
        setPartTypeError(e.message)
      } else {
        await loadPartTypes()
        closeEditPartType()
      }
    }
  }

  async function deletePartType(partType: PartType) {
    if (!confirm(`Are you sure you want to delete "${partType.name}"? This will fail if any parts are assigned to this material part type.`)) {
      return
    }
    
    const { error: e } = await supabase
      .from('part_types' as any)
      .delete()
      .eq('id', partType.id)
    
    if (e) {
      if (e.message.includes('violates foreign key constraint')) {
        setError(`Cannot delete material part type "${partType.name}" because it has associated parts. Please reassign or delete those parts first.`)
      } else {
        setError(e.message)
      }
    } else {
      await loadPartTypes()
    }
  }

  async function removeAllUnusedPartTypes() {
    // Filter part types with 0 parts
    const unusedPartTypes = partTypes.filter(pt => (partTypePartCounts[pt.id] || 0) === 0)
    
    if (unusedPartTypes.length === 0) {
      setError('No unused material part types to remove')
      return
    }
    
    // Confirm with user
    const partTypeNames = unusedPartTypes.map(pt => pt.name).join(', ')
    const confirmed = confirm(
      `This will delete ${unusedPartTypes.length} unused material part type(s):\n\n${partTypeNames}\n\nAre you sure?`
    )
    
    if (!confirmed) return
    
    setRemovingUnusedPartTypes(true)
    setError(null)
    
    // Delete each unused part type
    const deletePromises = unusedPartTypes.map(pt =>
      supabase
        .from('part_types' as any)
        .delete()
        .eq('id', pt.id)
    )
    
    const results = await Promise.all(deletePromises)
    const errors = results.filter(r => r.error)
    
    setRemovingUnusedPartTypes(false)
    
    if (errors.length > 0) {
      setError(`Failed to delete ${errors.length} material part type(s). They may have parts assigned.`)
    } else {
      // Success - reload the list
      await loadPartTypes()
    }
  }

  async function movePartType(partType: PartType, direction: 'up' | 'down') {
    const currentIndex = partTypes.findIndex(pt => pt.id === partType.id)
    if (currentIndex === -1) return
    
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= partTypes.length) return
    
    const targetPartType = partTypes[targetIndex]
    if (!targetPartType) return
    
    // Swap sequence orders
    await supabase
      .from('part_types' as any)
      .update({ sequence_order: targetPartType.sequence_order } as any)
      .eq('id', partType.id)
    
    await supabase
      .from('part_types' as any)
      .update({ sequence_order: partType.sequence_order } as any)
      .eq('id', targetPartType.id)
    
    await loadPartTypes()
  }

  // Assembly Types functions (for Materials)
  async function loadAssemblyTypes() {
    if (!selectedServiceTypeForAssemblies) {
      setAssemblyTypes([])
      return
    }
    
    const { data, error: eAssemblyTypes } = await supabase
      .from('assembly_types' as any)
      .select('*')
      .eq('service_type_id', selectedServiceTypeForAssemblies)
      .order('sequence_order', { ascending: true })
    
    if (eAssemblyTypes) {
      console.error('Error loading assembly types:', eAssemblyTypes)
    } else {
      setAssemblyTypes((data as unknown as AssemblyType[]) ?? [])
    }
  }

  async function loadAssemblyTypeAssemblyCounts() {
    if (!selectedServiceTypeForAssemblies) {
      setAssemblyTypeAssemblyCounts({})
      return
    }
    
    // Get all assembly types for this service type
    const assemblyTypeIds = assemblyTypes.map(at => at.id)
    
    if (assemblyTypeIds.length === 0) {
      setAssemblyTypeAssemblyCounts({})
      return
    }
    
    // Query material_templates grouped by assembly_type_id
    const { data, error } = await supabase
      .from('material_templates')
      .select('assembly_type_id')
      .in('assembly_type_id', assemblyTypeIds)
    
    if (error) {
      console.error('Error loading assembly counts:', error)
      return
    }
    
    // Count assemblies per assembly type
    const counts: Record<string, number> = {}
    assemblyTypeIds.forEach(id => counts[id] = 0)
    
    data?.forEach(row => {
      if (row.assembly_type_id) {
        counts[row.assembly_type_id] = (counts[row.assembly_type_id] || 0) + 1
      }
    })
    
    setAssemblyTypeAssemblyCounts(counts)
  }

  function openEditAssemblyType(assemblyType: AssemblyType | null) {
    setEditingAssemblyType(assemblyType)
    setAssemblyTypeName(assemblyType?.name || '')
    setAssemblyTypeError(null)
    setAssemblyTypeFormOpen(true)
  }

  function closeEditAssemblyType() {
    setEditingAssemblyType(null)
    setAssemblyTypeName('')
    setAssemblyTypeError(null)
    setAssemblyTypeFormOpen(false)
  }

  async function saveAssemblyType(e: FormEvent) {
    e.preventDefault()
    
    if (!selectedServiceTypeForAssemblies) {
      setAssemblyTypeError('Please select a service type first')
      return
    }
    
    setAssemblyTypeSaving(true)
    setAssemblyTypeError(null)
    
    if (!assemblyTypeName.trim()) {
      setAssemblyTypeError('Name is required')
      setAssemblyTypeSaving(false)
      return
    }
    
    if (editingAssemblyType) {
      // Update existing assembly type
      const { error: e } = await supabase
        .from('assembly_types' as any)
        .update({
          name: assemblyTypeName.trim(),
          category: null,
        } as any)
        .eq('id', editingAssemblyType.id)
      
      setAssemblyTypeSaving(false)
      
      if (e) {
        setAssemblyTypeError(e.message)
      } else {
        await loadAssemblyTypes()
        closeEditAssemblyType()
      }
    } else {
      // Create new assembly type
      const maxSeq = assemblyTypes.reduce((max, at) => Math.max(max, at.sequence_order), 0)
      const { error: e } = await supabase
        .from('assembly_types' as any)
        .insert({
          service_type_id: selectedServiceTypeForAssemblies,
          name: assemblyTypeName.trim(),
          category: null,
          sequence_order: maxSeq + 1,
        } as any)
      
      setAssemblyTypeSaving(false)
      
      if (e) {
        setAssemblyTypeError(e.message)
      } else {
        await loadAssemblyTypes()
        closeEditAssemblyType()
      }
    }
  }

  async function deleteAssemblyType(assemblyType: AssemblyType) {
    if (!confirm(`Are you sure you want to delete "${assemblyType.name}"? This will remove the type from any assemblies using it.`)) {
      return
    }
    
    const { error: e } = await supabase
      .from('assembly_types' as any)
      .delete()
      .eq('id', assemblyType.id)
    
    if (e) {
      if (e.message.includes('violates foreign key constraint')) {
        setError(`Cannot delete assembly type "${assemblyType.name}" due to database constraints.`)
      } else {
        setError(e.message)
      }
    } else {
      await loadAssemblyTypes()
    }
  }

  async function removeAllUnusedAssemblyTypes() {
    // Filter assembly types with 0 assemblies
    const unusedAssemblyTypes = assemblyTypes.filter(at => (assemblyTypeAssemblyCounts[at.id] || 0) === 0)
    
    if (unusedAssemblyTypes.length === 0) {
      setError('No unused assembly types to remove')
      return
    }
    
    // Confirm with user
    const assemblyTypeNames = unusedAssemblyTypes.map(at => at.name).join(', ')
    const confirmed = confirm(
      `This will delete ${unusedAssemblyTypes.length} unused assembly type(s):\n\n${assemblyTypeNames}\n\nAre you sure?`
    )
    
    if (!confirmed) return
    
    setRemovingUnusedAssemblyTypes(true)
    setError(null)
    
    // Delete each unused assembly type
    const deletePromises = unusedAssemblyTypes.map(at =>
      supabase
        .from('assembly_types' as any)
        .delete()
        .eq('id', at.id)
    )
    
    const results = await Promise.all(deletePromises)
    const errors = results.filter(r => r.error)
    
    setRemovingUnusedAssemblyTypes(false)
    
    if (errors.length > 0) {
      setError(`Failed to delete ${errors.length} assembly type(s). They may have assemblies assigned.`)
    } else {
      await loadAssemblyTypes()
    }
  }

  async function moveAssemblyType(assemblyType: AssemblyType, direction: 'up' | 'down') {
    const currentIndex = assemblyTypes.findIndex(at => at.id === assemblyType.id)
    if (currentIndex === -1) return
    
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= assemblyTypes.length) return
    
    const targetAssemblyType = assemblyTypes[targetIndex]
    if (!targetAssemblyType) return
    
    // Swap sequence orders
    await supabase
      .from('assembly_types' as any)
      .update({ sequence_order: targetAssemblyType.sequence_order } as any)
      .eq('id', assemblyType.id)
    
    await supabase
      .from('assembly_types' as any)
      .update({ sequence_order: assemblyType.sequence_order } as any)
      .eq('id', targetAssemblyType.id)
    
    await loadAssemblyTypes()
  }

  useEffect(() => {
    if (selectedServiceTypeForFixtures) {
      loadFixtureTypes()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedServiceTypeForFixtures])

  useEffect(() => {
    if (selectedServiceTypeForParts) {
      loadPartTypes()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedServiceTypeForParts])

  useEffect(() => {
    if (partTypes.length > 0) {
      loadPartTypePartCounts()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partTypes])

  useEffect(() => {
    if (selectedServiceTypeForAssemblies) {
      loadAssemblyTypes()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedServiceTypeForAssemblies])

  useEffect(() => {
    if (assemblyTypes.length > 0) {
      loadAssemblyTypeAssemblyCounts()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assemblyTypes])

  useEffect(() => {
    if (fixtureTypes.length > 0) {
      loadFixtureTypeCounts()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixtureTypes])

  // NOTE (map quirk #5): the parts-load and part-counts effects appeared TWICE
  // verbatim in Settings.tsx. The duplicates are preserved here so the move stays
  // behavior-identical (harmless double-fires); removing them is a separate,
  // dedicated no-behavior-change commit.
  useEffect(() => {
    if (selectedServiceTypeForParts) {
      loadPartTypes()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedServiceTypeForParts])

  useEffect(() => {
    if (partTypes.length > 0) {
      loadPartTypePartCounts()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partTypes])

  return {
    // service types
    serviceTypes,
    loadServiceTypes,
    serviceTypeFormOpen,
    editingServiceType,
    serviceTypeName,
    setServiceTypeName,
    serviceTypeDescription,
    setServiceTypeDescription,
    serviceTypeColor,
    setServiceTypeColor,
    serviceTypeLedgerJobPrefix,
    setServiceTypeLedgerJobPrefix,
    serviceTypeLedgerBidPrefix,
    setServiceTypeLedgerBidPrefix,
    serviceTypeSaving,
    serviceTypeError,
    openEditServiceType,
    closeEditServiceType,
    saveServiceType,
    deleteServiceType,
    moveServiceType,
    // fixture types (book names)
    fixtureTypes,
    selectedServiceTypeForFixtures,
    setSelectedServiceTypeForFixtures,
    fixtureTypeFormOpen,
    editingFixtureType,
    fixtureTypeName,
    setFixtureTypeName,
    fixtureTypeSaving,
    fixtureTypeError,
    fixtureTypePriceBookCounts,
    fixtureTypeLaborBookCounts,
    fixtureTypeTakeoffBookCounts,
    removingUnusedFixtureTypes,
    openEditFixtureType,
    closeEditFixtureType,
    saveFixtureType,
    removeUnusedFixtureTypes,
    deleteFixtureType,
    // counts quick-add groups
    countsFixtureGroups,
    countsFixtureGroupItems,
    selectedServiceTypeForCountsFixtures,
    setSelectedServiceTypeForCountsFixtures,
    countsFixtureGroupFormOpen,
    editingCountsFixtureGroup,
    countsFixtureGroupLabel,
    setCountsFixtureGroupLabel,
    countsFixtureGroupSaving,
    countsFixtureGroupError,
    countsFixtureItemFormOpen,
    editingCountsFixtureGroupForItem,
    editingCountsFixtureItem,
    countsFixtureItemName,
    setCountsFixtureItemName,
    countsFixtureItemSaving,
    countsFixtureItemError,
    openEditCountsFixtureGroup,
    closeEditCountsFixtureGroup,
    saveCountsFixtureGroup,
    deleteCountsFixtureGroup,
    moveCountsFixtureGroup,
    openEditCountsFixtureItem,
    closeEditCountsFixtureItem,
    saveCountsFixtureItem,
    deleteCountsFixtureItem,
    moveCountsFixtureItem,
    // part types
    partTypes,
    selectedServiceTypeForParts,
    setSelectedServiceTypeForParts,
    partTypeFormOpen,
    editingPartType,
    partTypeName,
    setPartTypeName,
    partTypeSaving,
    partTypeError,
    partTypePartCounts,
    removingUnusedPartTypes,
    openEditPartType,
    closeEditPartType,
    savePartType,
    deletePartType,
    removeAllUnusedPartTypes,
    movePartType,
    // assembly types
    assemblyTypes,
    selectedServiceTypeForAssemblies,
    setSelectedServiceTypeForAssemblies,
    assemblyTypeFormOpen,
    editingAssemblyType,
    assemblyTypeName,
    setAssemblyTypeName,
    assemblyTypeSaving,
    assemblyTypeError,
    assemblyTypeAssemblyCounts,
    removingUnusedAssemblyTypes,
    openEditAssemblyType,
    closeEditAssemblyType,
    saveAssemblyType,
    deleteAssemblyType,
    removeAllUnusedAssemblyTypes,
    moveAssemblyType,
    // manage parts / orphan prices
    managePartsSectionOpen,
    setManagePartsSectionOpen,
    viewingOrphanPrices,
    setViewingOrphanPrices,
    orphanPrices,
    setOrphanPrices,
    loadingOrphanPrices,
    orphanError,
    setOrphanError,
    loadOrphanMaterialPrices,
    deleteOrphanPrice,
    deleteAllOrphanPrices,
  }
}
