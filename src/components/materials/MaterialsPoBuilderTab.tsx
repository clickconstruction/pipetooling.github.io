import { type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import type { Database } from '../../types/database'
import { formatCurrency } from '../../lib/format'
import { filterPartsByQuery, filterTemplatesByQuery } from '../../lib/materials/materialsFilters'
import type { AssemblyType, PartType, PartWithPrices } from '../../hooks/useMaterialsCatalog'
import type { MaterialTemplate, TemplateItemWithDetails } from '../../hooks/useMaterialsAssemblies'
import { loadPOItemsWithDetails, type PurchaseOrderWithItems } from '../../lib/materials/poItemDetails'
import { supabase } from '../../lib/supabase'
import { TemplatePricesManager } from './TemplatePricesManager'

type SupplyHouse = Database['public']['Tables']['supply_houses']['Row']

type MaterialsTabKey = 'parts-book' | 'assembly-book' | 'assemblies-po' | 'purchase-orders' | 'supply-houses' | 'po-generator'

export type MaterialsPoBuilderTabProps = {
  active: boolean
  setActiveTab: (tab: MaterialsTabKey) => void
  setSearchParams: (update: (prev: URLSearchParams) => URLSearchParams, opts?: { replace?: boolean }) => void
  // Assembly engine (parent-owned)
  selectedTemplate: MaterialTemplate | null
  setSelectedTemplate: Dispatch<SetStateAction<MaterialTemplate | null>>
  templateItems: TemplateItemWithDetails[]
  templateSearchQuery: string
  setTemplateSearchQuery: Dispatch<SetStateAction<string>>
  filterAssemblyTypeIds: string[]
  setFilterAssemblyTypeIds: Dispatch<SetStateAction<string[]>>
  filterIncludeEmpty: boolean
  setFilterIncludeEmpty: Dispatch<SetStateAction<boolean>>
  filterAssemblyTypeDropdownOpen: boolean
  setFilterAssemblyTypeDropdownOpen: Dispatch<SetStateAction<boolean>>
  filterAssemblyTypeDropdownRef: MutableRefObject<HTMLDivElement | null>
  // PO engine (parent-owned)
  editingPO: PurchaseOrderWithItems | null
  setEditingPO: Dispatch<SetStateAction<PurchaseOrderWithItems | null>>
  setSelectedPO: Dispatch<SetStateAction<PurchaseOrderWithItems | null>>
  draftPOs: PurchaseOrderWithItems[]
  materialTemplates: MaterialTemplate[]
  // Catalog (parent-owned)
  parts: PartWithPrices[]
  allParts: PartWithPrices[]
  partTypes: PartType[]
  assemblyTypes: AssemblyType[]
  supplyHouses: SupplyHouse[]
  allTemplateItemsForStats: Array<{ template_id: string; item_type: string; part_id: string | null; nested_template_id: string | null; quantity: number }>
  // Derived in the page (shared with Assembly Book)
  filteredTemplates: MaterialTemplate[]
  partIdsWithNoPrice: Set<string>
  templateStatsTotal: number
  templateStatsPctWithNoPrice: number
  // Template CRUD openers (Template Form modal stays page-level)
  // Template add-item form (parent-owned)
  newItemType: 'part' | 'template'
  setNewItemType: Dispatch<SetStateAction<'part' | 'template'>>
  newItemPartId: string
  setNewItemPartId: Dispatch<SetStateAction<string>>
  templatePartSearchQuery: string
  setTemplatePartSearchQuery: Dispatch<SetStateAction<string>>
  templatePartDropdownOpen: boolean
  setTemplatePartDropdownOpen: Dispatch<SetStateAction<boolean>>
  templatePartPickerRef: MutableRefObject<HTMLDivElement | null>
  templateItemsSectionRef: MutableRefObject<HTMLDivElement | null>
  editingPODetailRef: MutableRefObject<HTMLDivElement | null>
  newItemTemplateId: string
  setNewItemTemplateId: Dispatch<SetStateAction<string>>
  newItemTemplateSearchQuery: string
  setNewItemTemplateSearchQuery: Dispatch<SetStateAction<string>>
  newItemTemplateDropdownOpen: boolean
  setNewItemTemplateDropdownOpen: Dispatch<SetStateAction<boolean>>
  newItemFilterAssemblyTypeId: string
  setNewItemFilterAssemblyTypeId: Dispatch<SetStateAction<string>>
  newItemQuantity: string
  setNewItemQuantity: Dispatch<SetStateAction<string>>
  newItemNotes: string
  setNewItemNotes: Dispatch<SetStateAction<string>>
  addingItemToTemplate: boolean
  addItemToTemplate: () => Promise<void>
  // PO creation + draft editing (parent-owned)
  creatingPOFromTemplate: boolean
  addingTemplateToPO: boolean
  createPOFromTemplate: (templateId: string) => Promise<void>
  createEmptyPO: () => Promise<void>
  addTemplateToPO: (poId: string, templateId: string) => Promise<void>
  editingPOItem: string | null
  setEditingPOItem: Dispatch<SetStateAction<string | null>>
  editingPOItemQuantity: string
  setEditingPOItemQuantity: Dispatch<SetStateAction<string>>
  editingPOItemSupplyHouse: string
  setEditingPOItemSupplyHouse: Dispatch<SetStateAction<string>>
  editingPOItemPrice: string
  setEditingPOItemPrice: Dispatch<SetStateAction<string>>
  editingPOItemNotesId: string | null
  setEditingPOItemNotesId: Dispatch<SetStateAction<string | null>>
  editingPOItemNotesValue: string
  setEditingPOItemNotesValue: Dispatch<SetStateAction<string>>
  editingPOName: string | null
  setEditingPOName: Dispatch<SetStateAction<string | null>>
  editingPONameValue: string
  setEditingPONameValue: Dispatch<SetStateAction<string>>
  draftPOSearch: string
  setDraftPOSearch: Dispatch<SetStateAction<string>>
  updatePOItem: (itemId: string, updates: { quantity?: number; supply_house_id?: string | null; price_at_time?: number; notes?: string | null }) => Promise<void>
  removePOItem: (itemId: string) => Promise<void>
  updatePOName: (poId: string, newName: string) => Promise<void>
  startEditPOName: (poId: string, currentName: string) => void
  cancelEditPOName: () => void
  // Draft supply-house options (parent-owned; shared with Purchase Orders tab)
  draftPOSupplyHouseOptionsPartId: string | null
  draftPOSupplyHouseOptions: Array<{ supply_house_id: string; supply_house_name: string; price: number }>
  loadingDraftPOSupplyHouseOptions: boolean
  loadSupplyHouseOptionsForPart: (partId: string) => Promise<void>
  updatePOItemSupplyHouse: (itemId: string, supplyHouseId: string, price: number) => Promise<void>
  // Shared UI
  openAddPartWithName: (initialName: string) => void
  openEditPart: (part: Database['public']['Tables']['material_parts']['Row'] & { part_type_id?: string | null }) => void
  removeItemFromTemplate: (itemId: string) => Promise<void>
  setViewingPartPrices: Dispatch<SetStateAction<Database['public']['Tables']['material_parts']['Row'] | null>>
}

/**
 * PO Builder (assemblies-po) tab — the final extraction of the Materials
 * decomposition (docs/MATERIALS_TABS_ARCHITECTURE.md). Pure JSX consumer:
 * it sits at the intersection of the assembly and PO engines, so every piece
 * of state and every handler is parent-owned (most shared with Assembly Book,
 * Purchase Orders, or the shared modals) and arrives as props. The Template
 * Form modal stays page-level.
 */
export function MaterialsPoBuilderTab(props: MaterialsPoBuilderTabProps) {
  const {
    active,
    setActiveTab,
    setSearchParams,
    selectedTemplate,
    setSelectedTemplate,
    templateItems,
    templateSearchQuery,
    setTemplateSearchQuery,
    filterAssemblyTypeIds,
    setFilterAssemblyTypeIds,
    filterIncludeEmpty,
    setFilterIncludeEmpty,
    filterAssemblyTypeDropdownOpen,
    setFilterAssemblyTypeDropdownOpen,
    filterAssemblyTypeDropdownRef,
    editingPO,
    setEditingPO,
    setSelectedPO,
    draftPOs,
    materialTemplates,
    parts,
    allParts,
    partTypes,
    assemblyTypes,
    supplyHouses,
    allTemplateItemsForStats,
    filteredTemplates,
    partIdsWithNoPrice,
    templateStatsTotal,
    templateStatsPctWithNoPrice,
    newItemType,
    setNewItemType,
    newItemPartId,
    setNewItemPartId,
    templatePartSearchQuery,
    setTemplatePartSearchQuery,
    templatePartDropdownOpen,
    setTemplatePartDropdownOpen,
    templatePartPickerRef,
    templateItemsSectionRef,
    editingPODetailRef,
    newItemTemplateId,
    setNewItemTemplateId,
    newItemTemplateSearchQuery,
    setNewItemTemplateSearchQuery,
    newItemTemplateDropdownOpen,
    setNewItemTemplateDropdownOpen,
    newItemFilterAssemblyTypeId,
    setNewItemFilterAssemblyTypeId,
    newItemQuantity,
    setNewItemQuantity,
    newItemNotes,
    setNewItemNotes,
    addingItemToTemplate,
    addItemToTemplate,
    creatingPOFromTemplate,
    addingTemplateToPO,
    createPOFromTemplate,
    createEmptyPO,
    addTemplateToPO,
    editingPOItem,
    setEditingPOItem,
    editingPOItemQuantity,
    setEditingPOItemQuantity,
    editingPOItemSupplyHouse,
    setEditingPOItemSupplyHouse,
    editingPOItemPrice,
    setEditingPOItemPrice,
    editingPOItemNotesId,
    setEditingPOItemNotesId,
    editingPOItemNotesValue,
    setEditingPOItemNotesValue,
    editingPOName,
    setEditingPOName,
    editingPONameValue,
    setEditingPONameValue,
    draftPOSearch,
    setDraftPOSearch,
    updatePOItem,
    removePOItem,
    updatePOName,
    startEditPOName,
    cancelEditPOName,
    draftPOSupplyHouseOptionsPartId,
    draftPOSupplyHouseOptions,
    loadingDraftPOSupplyHouseOptions,
    loadSupplyHouseOptionsForPart,
    updatePOItemSupplyHouse,
    setViewingPartPrices,
    openAddPartWithName,
    openEditPart,
    removeItemFromTemplate,
  } = props

  const draftPOSearchLower = draftPOSearch.trim().toLowerCase()
  const filteredDraftPOs = draftPOSearchLower
    ? draftPOs.filter(po => (po.name ?? '').toLowerCase().includes(draftPOSearchLower))
    : draftPOs

  if (!active) return null

  return (
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

  )
}
