import { type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import type { Database } from '../../types/database'
import { formatCurrency } from '../../lib/format'
import { filterPartsByQuery, filterTemplatesByQuery } from '../../lib/materials/materialsFilters'
import type { AssemblyType, PartType, PartWithPrices } from '../../hooks/useMaterialsCatalog'
import type { MaterialTemplate, TemplateItemWithDetails } from '../../hooks/useMaterialsAssemblies'
import { TemplatePricesManager } from './TemplatePricesManager'

type MaterialPart = Database['public']['Tables']['material_parts']['Row']
type SupplyHouse = Database['public']['Tables']['supply_houses']['Row']

export type MaterialsAssemblyBookTabProps = {
  /** Render gate for the tab body. The Add Item modal renders independently of
   * `active` so an open modal survives a tab switch, exactly as it did when the
   * modal lived unconditionally at page level. */
  active: boolean
  // Assembly engine (useMaterialsAssemblies, parent-owned)
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
  setActiveTab: (tab: 'parts-book' | 'assembly-book' | 'assemblies-po' | 'purchase-orders' | 'supply-houses' | 'po-generator') => void
  materialTemplates: MaterialTemplate[]
  // Parts catalog (useMaterialsCatalog, parent-owned)
  parts: PartWithPrices[]
  allParts: PartWithPrices[]
  partTypes: PartType[]
  assemblyTypes: AssemblyType[]
  supplyHouses: SupplyHouse[]
  // Derived in the page (shared with the PO Builder tab)
  filteredTemplates: MaterialTemplate[]
  calculateAssemblyCost: (templateId: string, parentQuantity?: number) => { total: number; missingPrices: number; partCount: number; nestedCount: number }
  // Item CRUD + template CRUD openers (parent-owned; Template Form modal is shared)
  updateItemQuantity: (itemId: string, newQuantity: number) => Promise<void>
  removeItemFromTemplate: (itemId: string) => Promise<void>
  openAddTemplate: () => void
  openEditTemplate: (template: MaterialTemplate) => void
  // Inline quantity editor (parent-owned; updateItemQuantity flow writes it)
  editingItemQuantityId: string | null
  setEditingItemQuantityId: Dispatch<SetStateAction<string | null>>
  editingItemQuantityValue: string
  setEditingItemQuantityValue: Dispatch<SetStateAction<string>>
  // Shared UI (parent-owned)
  expandedPartId: string | null
  setExpandedPartId: Dispatch<SetStateAction<string | null>>
  setViewingPartPrices: Dispatch<SetStateAction<MaterialPart | null>>
  openAddPartWithName: (initialName: string) => void
  setEditingPart: Dispatch<SetStateAction<MaterialPart | null>>
  setPartFormOpen: Dispatch<SetStateAction<boolean>>
  // Add Item modal cluster (parent-owned: handlePartSaved writes it when the
  // Part Form was opened from this modal — playbook shared-state rule)
  addItemModalOpen: boolean
  setAddItemModalOpen: Dispatch<SetStateAction<boolean>>
  addItemModalType: 'part' | 'template'
  setAddItemModalType: Dispatch<SetStateAction<'part' | 'template'>>
  addItemModalPartId: string
  setAddItemModalPartId: Dispatch<SetStateAction<string>>
  addItemModalTemplateId: string
  setAddItemModalTemplateId: Dispatch<SetStateAction<string>>
  addItemModalSearchQuery: string
  setAddItemModalSearchQuery: Dispatch<SetStateAction<string>>
  addItemModalQuantity: string
  setAddItemModalQuantity: Dispatch<SetStateAction<string>>
  addItemModalDropdownOpen: boolean
  setAddItemModalDropdownOpen: Dispatch<SetStateAction<boolean>>
  addingItemFromModal: boolean
  addItemModalError: string | null
  setAddItemModalError: Dispatch<SetStateAction<string | null>>
  addItemModalFilterPartTypeId: string
  setAddItemModalFilterPartTypeId: Dispatch<SetStateAction<string>>
  addItemModalFilterAssemblyTypeId: string
  setAddItemModalFilterAssemblyTypeId: Dispatch<SetStateAction<string>>
  closeAddItemModal: () => void
  handleAddItemFromModal: () => Promise<void>
}

/**
 * Assembly Book tab — extracted from Materials.tsx (Stage B of the Materials
 * decomposition; see docs/MATERIALS_TABS_ARCHITECTURE.md). Pure JSX consumer:
 * the assembly engine lives in useMaterialsAssemblies, the derived stats and
 * every handler stay in the page (most are shared with the PO Builder tab or
 * written by shared modal flows) and arrive as props.
 */
export function MaterialsAssemblyBookTab(props: MaterialsAssemblyBookTabProps) {
  const {
    active,
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
    setActiveTab,
    materialTemplates,
    parts,
    allParts,
    partTypes,
    assemblyTypes,
    supplyHouses,
    filteredTemplates,
    calculateAssemblyCost,
    updateItemQuantity,
    removeItemFromTemplate,
    openAddTemplate,
    openEditTemplate,
    editingItemQuantityId,
    setEditingItemQuantityId,
    editingItemQuantityValue,
    setEditingItemQuantityValue,
    expandedPartId,
    setExpandedPartId,
    setViewingPartPrices,
    openAddPartWithName,
    setEditingPart,
    setPartFormOpen,
    addItemModalOpen,
    setAddItemModalOpen,
    addItemModalType,
    setAddItemModalType,
    addItemModalPartId,
    setAddItemModalPartId,
    addItemModalTemplateId,
    setAddItemModalTemplateId,
    addItemModalSearchQuery,
    setAddItemModalSearchQuery,
    addItemModalQuantity,
    setAddItemModalQuantity,
    addItemModalDropdownOpen,
    setAddItemModalDropdownOpen,
    addingItemFromModal,
    addItemModalError,
    setAddItemModalError,
    addItemModalFilterPartTypeId,
    setAddItemModalFilterPartTypeId,
    addItemModalFilterAssemblyTypeId,
    setAddItemModalFilterAssemblyTypeId,
    closeAddItemModal,
    handleAddItemFromModal,
  } = props

  return (
    <>
      {active && (
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
      {/* Add Item to Assembly Modal */}
      {addItemModalOpen && selectedTemplate && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={(e) => e.target === e.currentTarget && closeAddItemModal()}
        >
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '2rem', borderRadius: 8, maxWidth: '450px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
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

    </>
  )
}
