import { Fragment, type Dispatch, type SetStateAction } from 'react'
import type { Database } from '../../types/database'
import { computeLoadAllDisplayParts } from '../../lib/materials/materialsFilters'
import type { PartType, PartWithPrices } from '../../hooks/useMaterialsCatalog'

type MaterialPart = Database['public']['Tables']['material_parts']['Row']

export type MaterialsPartsBookTabProps = {
  /** Render gate — always mounted so search/filter/paging state (parent-owned
   * in useMaterialsCatalog) and expansion state survive tab switches. */
  active: boolean
  authUser: { id: string } | null
  // Catalog engine (useMaterialsCatalog, parent-owned)
  parts: PartWithPrices[]
  allParts: PartWithPrices[]
  partTypes: PartType[]
  searchQuery: string
  setSearchQuery: Dispatch<SetStateAction<string>>
  clientSearchQuery: string
  setClientSearchQuery: Dispatch<SetStateAction<string>>
  filterPartTypeId: string
  setFilterPartTypeId: Dispatch<SetStateAction<string>>
  filterManufacturer: string
  setFilterManufacturer: Dispatch<SetStateAction<string>>
  sortByPriceCountAsc: boolean
  setSortByPriceCountAsc: Dispatch<SetStateAction<boolean>>
  hasMoreParts: boolean
  loadingPartsPage: boolean
  loadAllMode: boolean
  setLoadAllMode: Dispatch<SetStateAction<boolean>>
  loadingAllParts: boolean
  setAllParts: Dispatch<SetStateAction<PartWithPrices[]>>
  loadAllParts: (serviceTypeId?: string) => Promise<void>
  reloadPartsFirstPage: () => Promise<void>
  LOAD_ALL_MODE_KEY: (uid: string) => string
  // Shared UI state / modal openers (parent-owned: also used by other tabs & URL params)
  expandedPartId: string | null
  setExpandedPartId: Dispatch<SetStateAction<string | null>>
  setViewingPartPrices: Dispatch<SetStateAction<MaterialPart | null>>
  openAddPart: () => void
  openEditPart: (part: MaterialPart & { part_type_id?: string | null }) => void
  openSupplyHousesModal: () => void
}

/**
 * Parts Book tab (the Price Book) — extracted from Materials.tsx (Stage B of
 * the Materials decomposition; see docs/MATERIALS_TABS_ARCHITECTURE.md). The
 * catalog engine lives in useMaterialsCatalog; the shared modals (Part Form,
 * Part Prices, legacy Supply House Management) stay page-level.
 */
export function MaterialsPartsBookTab({
  active,
  authUser,
  parts,
  allParts,
  partTypes,
  searchQuery,
  setSearchQuery,
  clientSearchQuery,
  setClientSearchQuery,
  filterPartTypeId,
  setFilterPartTypeId,
  filterManufacturer,
  setFilterManufacturer,
  sortByPriceCountAsc,
  setSortByPriceCountAsc,
  hasMoreParts,
  loadingPartsPage,
  loadAllMode,
  setLoadAllMode,
  loadingAllParts,
  setAllParts,
  loadAllParts,
  reloadPartsFirstPage,
  LOAD_ALL_MODE_KEY,
  expandedPartId,
  setExpandedPartId,
  setViewingPartPrices,
  openAddPart,
  openEditPart,
  openSupplyHousesModal,
}: MaterialsPartsBookTabProps) {
  // Parts are already filtered and sorted server-side, so just use them directly
  const sortedParts = parts

  // Determine which parts to display (load all mode with client-side filtering/sorting)
  const displayParts = loadAllMode
    ? computeLoadAllDisplayParts(allParts, { filterPartTypeId, filterManufacturer, clientSearchQuery, sortByPriceCountAsc })
    : sortedParts

  // Get unique manufacturers for filters
  const manufacturers = [...new Set((allParts.length > 0 ? allParts : parts).map(p => p.manufacturer).filter(Boolean))].sort()

  if (!active) return null

  return (
        <div>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
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
                border: '1px solid var(--border-strong)', 
                borderRadius: 4,
                background: loadAllMode ? 'var(--bg-sky-tint)' : 'var(--surface)',
              }}
            />
            <select
              value={filterPartTypeId}
              onChange={(e) => setFilterPartTypeId(e.target.value)}
              style={{ padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
            >
              <option value="">All Part Types</option>
              {partTypes.map(ft => (
                <option key={ft.id} value={ft.id}>
                  {ft.name}
                </option>
              ))}
            </select>
            <select
              value={filterManufacturer}
              onChange={(e) => setFilterManufacturer(e.target.value)}
              style={{ padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
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
                background: loadAllMode ? '#3b82f6' : 'var(--surface)',
                border: '1px solid var(--border-strong)',
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

          {/* overflowX auto, not hidden (v2.1003): on phones the parts table is
              wider than the screen — hidden made the right columns unreachable. */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: 'var(--bg-subtle)' }}>
                <tr>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Name</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Manufacturer</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Part Type</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Best Price</th>
                  <th
                    style={{
                      padding: '0.75rem',
                      textAlign: 'left',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                    onClick={() => setSortByPriceCountAsc(prev => !prev)}
                    title="Sort by number of prices (fewest first)"
                  >
                    #
                    {sortByPriceCountAsc ? ' \u2191' : ''}
                  </th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayParts.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
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
                            borderBottom: isExpanded ? 'none' : '1px solid var(--border)',
                            cursor: 'pointer',
                            background: isExpanded ? 'var(--bg-muted)' : undefined,
                          }}
                          onMouseEnter={(e) => {
                            if (!isExpanded) e.currentTarget.style.background = 'var(--bg-subtle)'
                          }}
                          onMouseLeave={(e) => {
                            if (!isExpanded) e.currentTarget.style.background = ''
                          }}
                        >
                          <td style={{ padding: '0.75rem' }}>
                            <span style={{ marginRight: '0.5rem', display: 'inline-block', width: '1rem', textAlign: 'center' }}>
                              {isExpanded ? '\u25BC' : '\u25B6'}
                            </span>
                            {part?.name ?? '-'}
                          </td>
                          <td style={{ padding: '0.75rem' }}>{part.manufacturer || '-'}</td>
                          <td style={{ padding: '0.75rem' }}>{part.part_type?.name || '-'}</td>
                          <td style={{ padding: '0.75rem' }}>
                            {bestPrice ? `$${bestPrice.price.toFixed(2)} (${bestPrice.supply_house?.name ?? 'Unknown'})` : ''}
                          </td>
                          <td style={{ padding: '0.75rem' }}>{priceCount}</td>
                          <td style={{ padding: '0.75rem' }} onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); openEditPart(part) }}
                              style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${part.id}-details`} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td
                              colSpan={6}
                              style={{
                                padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                                background: 'var(--bg-subtle)',
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
                                      <span style={{ color: 'var(--text-muted)' }}>No prices yet</span>
                                    ) : (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem' }}>
                                        {part.prices.map((price: PartWithPrices['prices'][number]) => (
                                          <div key={price.id}>
                                            ${price.price.toFixed(2)} {price.supply_house?.name ?? 'Unknown'}
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
              <div style={{ marginTop: '0.75rem', textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>
                Loading all parts... ({allParts.length} loaded)
              </div>
            )
          ) : (
            hasMoreParts && (
              <div style={{ marginTop: '0.75rem', textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                {loadingPartsPage ? 'Loading more parts…' : 'Scroll down to load more'}
              </div>
            )
          )}
        </div>
  )
}
