/** Settings → Catalogs & trades tab (dev/estimator): Manage Parts (duplicate materials,
 * orphan prices), trades/service types, fixture types, part types, assembly types, and
 * Bids "counts" fixture groups/items.
 * Presentational; all state/handlers live in the parent (Settings.tsx) and arrive as props. */
import type { Dispatch, FormEvent, SetStateAction } from 'react'
import { Link } from 'react-router-dom'
import type { UserRole } from '../../hooks/useAuth'
import type {
  AssemblyType,
  CountsFixtureGroup,
  CountsFixtureGroupItem,
  FixtureType,
  PartType,
  ServiceType,
} from '../../types/settingsRows'

type SettingsCatalogsTabProps = {
  assemblyTypeAssemblyCounts: Record<string, number>
  assemblyTypeError: string | null
  assemblyTypeFormOpen: boolean
  assemblyTypeName: string
  assemblyTypeSaving: boolean
  assemblyTypes: AssemblyType[]
  canDeleteMaterialTypes: boolean
  closeEditAssemblyType: () => void
  closeEditCountsFixtureGroup: () => void
  closeEditCountsFixtureItem: () => void
  closeEditFixtureType: () => void
  closeEditPartType: () => void
  closeEditServiceType: () => void
  countsFixtureGroupError: string | null
  countsFixtureGroupFormOpen: boolean
  countsFixtureGroupItems: CountsFixtureGroupItem[]
  countsFixtureGroupLabel: string
  countsFixtureGroupSaving: boolean
  countsFixtureGroups: CountsFixtureGroup[]
  countsFixtureItemError: string | null
  countsFixtureItemFormOpen: boolean
  countsFixtureItemName: string
  countsFixtureItemSaving: boolean
  deleteAssemblyType: (assemblyType: AssemblyType) => void
  deleteCountsFixtureGroup: (group: CountsFixtureGroup) => void
  deleteCountsFixtureItem: (item: CountsFixtureGroupItem) => void
  deleteFixtureType: (fixtureType: FixtureType) => void
  deletePartType: (partType: PartType) => void
  deleteServiceType: (serviceType: ServiceType) => void
  editingAssemblyType: AssemblyType | null
  editingCountsFixtureGroup: CountsFixtureGroup | null
  editingCountsFixtureGroupForItem: CountsFixtureGroup | null
  editingCountsFixtureItem: CountsFixtureGroupItem | null
  editingFixtureType: FixtureType | null
  editingPartType: PartType | null
  editingServiceType: ServiceType | null
  fixtureTypeError: string | null
  fixtureTypeFormOpen: boolean
  fixtureTypeLaborBookCounts: Record<string, number>
  fixtureTypeName: string
  fixtureTypePriceBookCounts: Record<string, number>
  fixtureTypeSaving: boolean
  fixtureTypeTakeoffBookCounts: Record<string, number>
  fixtureTypes: FixtureType[]
  loadOrphanMaterialPrices: () => void
  managePartsSectionOpen: boolean
  moveAssemblyType: (assemblyType: AssemblyType, direction: 'up' | 'down') => void
  moveCountsFixtureGroup: (group: CountsFixtureGroup, direction: 'up' | 'down') => void
  moveCountsFixtureItem: (item: CountsFixtureGroupItem, direction: 'up' | 'down') => void
  movePartType: (partType: PartType, direction: 'up' | 'down') => void
  moveServiceType: (serviceType: ServiceType, direction: 'up' | 'down') => void
  myRole: UserRole | null
  openEditAssemblyType: (assemblyType: AssemblyType | null) => void
  openEditCountsFixtureGroup: (group: CountsFixtureGroup | null) => void
  openEditCountsFixtureItem: (grp: CountsFixtureGroup, item: CountsFixtureGroupItem | null) => void
  openEditFixtureType: (fixtureType: FixtureType | null) => void
  openEditPartType: (partType: PartType | null) => void
  openEditServiceType: (serviceType: ServiceType | null) => void
  partTypeError: string | null
  partTypeFormOpen: boolean
  partTypeName: string
  partTypePartCounts: Record<string, number>
  partTypeSaving: boolean
  partTypes: PartType[]
  removeAllUnusedAssemblyTypes: () => void
  removeAllUnusedPartTypes: () => void
  removeUnusedFixtureTypes: () => void
  removingUnusedAssemblyTypes: boolean
  removingUnusedFixtureTypes: boolean
  removingUnusedPartTypes: boolean
  saveAssemblyType: (e: FormEvent) => void
  saveCountsFixtureGroup: (e: FormEvent) => void
  saveCountsFixtureItem: (e: FormEvent) => void
  saveFixtureType: (e: FormEvent) => void
  savePartType: (e: FormEvent) => void
  saveServiceType: (e: FormEvent) => void
  selectedServiceTypeForAssemblies: string
  selectedServiceTypeForCountsFixtures: string
  selectedServiceTypeForFixtures: string
  selectedServiceTypeForParts: string
  serviceTypeColor: string
  serviceTypeDescription: string
  serviceTypeError: string | null
  serviceTypeFormOpen: boolean
  serviceTypeLedgerBidPrefix: string
  serviceTypeLedgerJobPrefix: string
  serviceTypeName: string
  serviceTypeSaving: boolean
  serviceTypes: ServiceType[]
  setAssemblyTypeName: Dispatch<SetStateAction<string>>
  setCountsFixtureGroupLabel: Dispatch<SetStateAction<string>>
  setCountsFixtureItemName: Dispatch<SetStateAction<string>>
  setFixtureTypeName: Dispatch<SetStateAction<string>>
  setManagePartsSectionOpen: Dispatch<SetStateAction<boolean>>
  setPartTypeName: Dispatch<SetStateAction<string>>
  setSelectedServiceTypeForAssemblies: Dispatch<SetStateAction<string>>
  setSelectedServiceTypeForCountsFixtures: Dispatch<SetStateAction<string>>
  setSelectedServiceTypeForFixtures: Dispatch<SetStateAction<string>>
  setSelectedServiceTypeForParts: Dispatch<SetStateAction<string>>
  setServiceTypeColor: Dispatch<SetStateAction<string>>
  setServiceTypeDescription: Dispatch<SetStateAction<string>>
  setServiceTypeLedgerBidPrefix: Dispatch<SetStateAction<string>>
  setServiceTypeLedgerJobPrefix: Dispatch<SetStateAction<string>>
  setServiceTypeName: Dispatch<SetStateAction<string>>
  setViewingOrphanPrices: Dispatch<SetStateAction<boolean>>
  visibleServiceTypesForMaterials: ServiceType[]
}

export default function SettingsCatalogsTab({
  assemblyTypeAssemblyCounts,
  assemblyTypeError,
  assemblyTypeFormOpen,
  assemblyTypeName,
  assemblyTypeSaving,
  assemblyTypes,
  canDeleteMaterialTypes,
  closeEditAssemblyType,
  closeEditCountsFixtureGroup,
  closeEditCountsFixtureItem,
  closeEditFixtureType,
  closeEditPartType,
  closeEditServiceType,
  countsFixtureGroupError,
  countsFixtureGroupFormOpen,
  countsFixtureGroupItems,
  countsFixtureGroupLabel,
  countsFixtureGroupSaving,
  countsFixtureGroups,
  countsFixtureItemError,
  countsFixtureItemFormOpen,
  countsFixtureItemName,
  countsFixtureItemSaving,
  deleteAssemblyType,
  deleteCountsFixtureGroup,
  deleteCountsFixtureItem,
  deleteFixtureType,
  deletePartType,
  deleteServiceType,
  editingAssemblyType,
  editingCountsFixtureGroup,
  editingCountsFixtureGroupForItem,
  editingCountsFixtureItem,
  editingFixtureType,
  editingPartType,
  editingServiceType,
  fixtureTypeError,
  fixtureTypeFormOpen,
  fixtureTypeLaborBookCounts,
  fixtureTypeName,
  fixtureTypePriceBookCounts,
  fixtureTypeSaving,
  fixtureTypeTakeoffBookCounts,
  fixtureTypes,
  loadOrphanMaterialPrices,
  managePartsSectionOpen,
  moveAssemblyType,
  moveCountsFixtureGroup,
  moveCountsFixtureItem,
  movePartType,
  moveServiceType,
  myRole,
  openEditAssemblyType,
  openEditCountsFixtureGroup,
  openEditCountsFixtureItem,
  openEditFixtureType,
  openEditPartType,
  openEditServiceType,
  partTypeError,
  partTypeFormOpen,
  partTypeName,
  partTypePartCounts,
  partTypeSaving,
  partTypes,
  removeAllUnusedAssemblyTypes,
  removeAllUnusedPartTypes,
  removeUnusedFixtureTypes,
  removingUnusedAssemblyTypes,
  removingUnusedFixtureTypes,
  removingUnusedPartTypes,
  saveAssemblyType,
  saveCountsFixtureGroup,
  saveCountsFixtureItem,
  saveFixtureType,
  savePartType,
  saveServiceType,
  selectedServiceTypeForAssemblies,
  selectedServiceTypeForCountsFixtures,
  selectedServiceTypeForFixtures,
  selectedServiceTypeForParts,
  serviceTypeColor,
  serviceTypeDescription,
  serviceTypeError,
  serviceTypeFormOpen,
  serviceTypeLedgerBidPrefix,
  serviceTypeLedgerJobPrefix,
  serviceTypeName,
  serviceTypeSaving,
  serviceTypes,
  setAssemblyTypeName,
  setCountsFixtureGroupLabel,
  setCountsFixtureItemName,
  setFixtureTypeName,
  setManagePartsSectionOpen,
  setPartTypeName,
  setSelectedServiceTypeForAssemblies,
  setSelectedServiceTypeForCountsFixtures,
  setSelectedServiceTypeForFixtures,
  setSelectedServiceTypeForParts,
  setServiceTypeColor,
  setServiceTypeDescription,
  setServiceTypeLedgerBidPrefix,
  setServiceTypeLedgerJobPrefix,
  setServiceTypeName,
  setViewingOrphanPrices,
  visibleServiceTypesForMaterials,
}: SettingsCatalogsTabProps) {
  return (
    <>
        <div style={{ marginTop: '2rem', marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8 }}>
          <button
            type="button"
            onClick={() => setManagePartsSectionOpen((prev) => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              margin: 0,
              padding: '1rem',
              width: '100%',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 600,
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: '0.75rem' }}>{managePartsSectionOpen ? '▼' : '▶'}</span>
            Manage Parts
          </button>
          {managePartsSectionOpen && (
          <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
          <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>Duplicate Materials</h2>
          <p style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Find and delete duplicate material parts in the Parts Book (matching names or 80%+ similarity).
          </p>
          <Link
            to="/duplicates"
            style={{ padding: '0.5rem 1rem', background: '#f59e0b', color: 'white', border: 'none', borderRadius: 4, textDecoration: 'none', fontWeight: 500, display: 'inline-block' }}
          >
            View Duplicate Materials
          </Link>
          {myRole === 'dev' && (
        <>
          <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Service Types</h2>
          <p style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Manage service types for categorizing bids and materials (Plumbing, Electrical, HVAC, etc.). These filters appear on the Materials and Bids pages.
          </p>
          
          <div style={{ marginBottom: '1rem' }}>
            <button
              type="button"
              onClick={() => openEditServiceType(null)}
              style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
            >
              + Add Service Type
            </button>
          </div>

          {serviceTypes.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {serviceTypes.map((st, idx) => (
                <div key={st.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '1rem', background: 'var(--surface)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{st.name}</h3>
                        {st.color && (
                          <div style={{ width: '1rem', height: '1rem', borderRadius: '50%', background: st.color, border: '1px solid var(--border-strong)' }}></div>
                        )}
                      </div>
                      {st.description && (
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{st.description}</p>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => moveServiceType(st, 'up')}
                        disabled={idx === 0}
                        style={{
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.875rem',
                          background: idx === 0 ? 'var(--bg-muted)' : 'var(--bg-200)',
                          border: '1px solid var(--border-strong)',
                          borderRadius: 4,
                          cursor: idx === 0 ? 'not-allowed' : 'pointer'
                        }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveServiceType(st, 'down')}
                        disabled={idx === serviceTypes.length - 1}
                        style={{
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.875rem',
                          background: idx === serviceTypes.length - 1 ? 'var(--bg-muted)' : 'var(--bg-200)',
                          border: '1px solid var(--border-strong)',
                          borderRadius: 4,
                          cursor: idx === serviceTypes.length - 1 ? 'not-allowed' : 'pointer'
                        }}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditServiceType(st)}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteServiceType(st)}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'var(--bg-red-100)', color: 'var(--text-red-800)', border: '1px solid #fecaca' }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontStyle: 'italic' }}>No service types created yet.</p>
          )}

          {serviceTypeFormOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '1.5rem', maxWidth: '500px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
                <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>
                  {editingServiceType ? 'Edit Service Type' : 'Add Service Type'}
                </h3>
                
                {serviceTypeError && (
                  <div style={{ padding: '0.75rem', background: 'var(--bg-red-100)', color: 'var(--text-red-800)', borderRadius: 4, marginBottom: '1rem', fontSize: '0.875rem' }}>
                    {serviceTypeError}
                  </div>
                )}
                
                <form onSubmit={saveServiceType}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
                      Name *
                    </label>
                    <input
                      type="text"
                      value={serviceTypeName}
                      onChange={(e) => setServiceTypeName(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                      required
                      autoFocus
                    />
                  </div>
                  
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
                      Description
                    </label>
                    <textarea
                      value={serviceTypeDescription}
                      onChange={(e) => setServiceTypeDescription(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, minHeight: '80px' }}
                    />
                  </div>
                  
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
                      Job ledger prefix (HCP #)
                    </label>
                    <input
                      type="text"
                      value={serviceTypeLedgerJobPrefix}
                      onChange={(e) => setServiceTypeLedgerJobPrefix(e.target.value)}
                      placeholder="e.g. JP — leave empty for J"
                      maxLength={4}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                    />
                    <p style={{ margin: '0.35rem 0 0', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                      Shown before the job number in the app. Empty uses the default <strong>J</strong>. Max 4 characters.
                    </p>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
                      Bid ledger prefix (bid #)
                    </label>
                    <input
                      type="text"
                      value={serviceTypeLedgerBidPrefix}
                      onChange={(e) => setServiceTypeLedgerBidPrefix(e.target.value)}
                      placeholder="e.g. BP — leave empty for B"
                      maxLength={4}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                    />
                    <p style={{ margin: '0.35rem 0 0', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                      Shown before the bid number in the app. Empty uses the default <strong>B</strong>. Max 4 characters.
                    </p>
                  </div>
                  
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="color"
                        value={serviceTypeColor || '#3b82f6'}
                        onChange={(e) => setServiceTypeColor(e.target.value)}
                        style={{ width: '60px', height: '40px', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
                      />
                      <input
                        type="text"
                        value={serviceTypeColor}
                        onChange={(e) => setServiceTypeColor(e.target.value)}
                        placeholder="#3b82f6"
                        style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                      />
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={closeEditServiceType}
                      disabled={serviceTypeSaving}
                      style={{ padding: '0.5rem 1rem' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={serviceTypeSaving}
                      style={{
                        padding: '0.5rem 1rem',
                        background: serviceTypeSaving ? '#d1d5db' : '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        cursor: serviceTypeSaving ? 'not-allowed' : 'pointer',
                        fontWeight: 500
                      }}
                    >
                      {serviceTypeSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {(myRole === 'dev' || myRole === 'estimator') && (
        <>
          <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Material Part Types</h2>
          <p style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Manage material part types for each service type. Material part types are used in the Materials system to categorize material parts (pipes, fittings, valves, etc.). This is separate from Takeoff, Labor, and Price Book Names which are used in Bids/Books for installed fixtures.
          </p>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Select Service Type *
            </label>
            <select
              value={selectedServiceTypeForParts}
              onChange={(e) => setSelectedServiceTypeForParts(e.target.value)}
              style={{ padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, minWidth: '200px' }}
            >
              <option value="">-- Select a service type --</option>
              {visibleServiceTypesForMaterials.map((st) => (
                <option key={st.id} value={st.id}>{st.name}</option>
              ))}
            </select>
          </div>

          {selectedServiceTypeForParts && (
            <>
              {myRole === 'estimator' && visibleServiceTypesForMaterials.length > 1 && (
                <p style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  Showing part types for <strong>{serviceTypes.find(st => st.id === selectedServiceTypeForParts)?.name ?? 'this service type'}</strong>. Change the service type above to see types for other trades.
                </p>
              )}
              <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => openEditPartType(null)}
                  style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
                >
                  + Add Material Part Type
                </button>
                
                {canDeleteMaterialTypes && (
                <button
                  type="button"
                  onClick={removeAllUnusedPartTypes}
                  disabled={removingUnusedPartTypes || partTypes.filter(pt => (partTypePartCounts[pt.id] || 0) === 0).length === 0}
                  style={{
                    padding: '0.5rem 1rem',
                    background: removingUnusedPartTypes ? '#d1d5db' : '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor: removingUnusedPartTypes || partTypes.filter(pt => (partTypePartCounts[pt.id] || 0) === 0).length === 0 ? 'not-allowed' : 'pointer',
                    fontWeight: 500,
                    opacity: partTypes.filter(pt => (partTypePartCounts[pt.id] || 0) === 0).length === 0 ? 0.5 : 1
                  }}
                  title={partTypes.filter(pt => (partTypePartCounts[pt.id] || 0) === 0).length === 0 ? 'No unused material part types' : `Remove ${partTypes.filter(pt => (partTypePartCounts[pt.id] || 0) === 0).length} unused material part type(s)`}
                >
                  {removingUnusedPartTypes ? 'Removing...' : 'Remove All Unused Material Part Types'}
                </button>
                )}
              </div>

              {partTypes.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {partTypes.map((pt, idx) => (
                    <div key={pt.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '1rem', background: 'var(--surface)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{pt.name}</h3>
                            <span 
                              style={{ 
                                padding: '0.125rem 0.5rem', 
                                fontSize: '0.75rem', 
                                background: (partTypePartCounts[pt.id] ?? 0) > 0 ? '#d1fae5' : 'var(--bg-muted)',
                                color: (partTypePartCounts[pt.id] ?? 0) > 0 ? '#065f46' : 'var(--text-muted)',
                                borderRadius: 4,
                                fontWeight: 500
                              }}
                              title={`${partTypePartCounts[pt.id] || 0} material part${partTypePartCounts[pt.id] === 1 ? '' : 's'} assigned`}
                            >
                              {partTypePartCounts[pt.id] || 0} part{partTypePartCounts[pt.id] === 1 ? '' : 's'}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => movePartType(pt, 'up')}
                            disabled={idx === 0}
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.875rem',
                              background: idx === 0 ? 'var(--bg-muted)' : 'var(--bg-200)',
                              border: '1px solid var(--border-strong)',
                              borderRadius: 4,
                              cursor: idx === 0 ? 'not-allowed' : 'pointer'
                            }}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => movePartType(pt, 'down')}
                            disabled={idx === partTypes.length - 1}
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.875rem',
                              background: idx === partTypes.length - 1 ? 'var(--bg-muted)' : 'var(--bg-200)',
                              border: '1px solid var(--border-strong)',
                              borderRadius: 4,
                              cursor: idx === partTypes.length - 1 ? 'not-allowed' : 'pointer'
                            }}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditPartType(pt)}
                            style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                          >
                            Edit
                          </button>
                          {canDeleteMaterialTypes && (
                          <button
                            type="button"
                            onClick={() => deletePartType(pt)}
                            style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                          >
                            Delete
                          </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  No material part types yet. Click "Add Material Part Type" to create one.
                </div>
              )}
            </>
          )}

          {partTypeFormOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ background: 'var(--surface)', padding: '2rem', borderRadius: 8, maxWidth: '500px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
                <h2 style={{ marginBottom: '1rem' }}>{editingPartType ? 'Edit Material Part Type' : 'Add Material Part Type'}</h2>
                
                <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-muted)', borderRadius: 4 }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    Service Type: <strong>{serviceTypes.find(st => st.id === selectedServiceTypeForParts)?.name}</strong>
                  </span>
                </div>
                
                {partTypeError && (
                  <div style={{ padding: '0.75rem', marginBottom: '1rem', background: 'var(--bg-red-tint)', border: '1px solid #fecaca', borderRadius: 4, color: 'var(--text-red-700)' }}>
                    {partTypeError}
                  </div>
                )}
                
                <form onSubmit={savePartType}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
                      Name *
                    </label>
                    <input
                      type="text"
                      value={partTypeName}
                      onChange={(e) => setPartTypeName(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                      required
                      autoFocus
                      placeholder="e.g., Pipe, Fitting, Valve, Sink, Faucet"
                    />
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={closeEditPartType}
                      disabled={partTypeSaving}
                      style={{ padding: '0.5rem 1rem' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={partTypeSaving}
                      style={{
                        padding: '0.5rem 1rem',
                        background: partTypeSaving ? '#d1d5db' : '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        cursor: partTypeSaving ? 'not-allowed' : 'pointer',
                        fontWeight: 500
                      }}
                    >
                      {partTypeSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {(myRole === 'dev' || myRole === 'estimator') && (
        <>
          <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Material Assembly Types</h2>
          <p style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Manage assembly types for each service type. Assembly types are used in the Materials system to categorize material assemblies/templates (e.g., Bathroom, Kitchen, Utility). This helps organize and filter assemblies.
          </p>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Select Service Type *
            </label>
            <select
              value={selectedServiceTypeForAssemblies}
              onChange={(e) => setSelectedServiceTypeForAssemblies(e.target.value)}
              style={{ padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, minWidth: '200px' }}
            >
              <option value="">-- Select a service type --</option>
              {visibleServiceTypesForMaterials.map((st) => (
                <option key={st.id} value={st.id}>{st.name}</option>
              ))}
            </select>
          </div>

          {selectedServiceTypeForAssemblies && (
            <>
              {myRole === 'estimator' && visibleServiceTypesForMaterials.length > 1 && (
                <p style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  Showing assembly types for <strong>{serviceTypes.find(st => st.id === selectedServiceTypeForAssemblies)?.name ?? 'this service type'}</strong>. Change the service type above to see types for other trades.
                </p>
              )}
              <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => openEditAssemblyType(null)}
                  style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
                >
                  + Add Assembly Type
                </button>
                
                {canDeleteMaterialTypes && (
                <button
                  type="button"
                  onClick={removeAllUnusedAssemblyTypes}
                  disabled={removingUnusedAssemblyTypes || assemblyTypes.filter(at => (assemblyTypeAssemblyCounts[at.id] || 0) === 0).length === 0}
                  style={{
                    padding: '0.5rem 1rem',
                    background: removingUnusedAssemblyTypes ? '#d1d5db' : '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor: removingUnusedAssemblyTypes || assemblyTypes.filter(at => (assemblyTypeAssemblyCounts[at.id] || 0) === 0).length === 0 ? 'not-allowed' : 'pointer',
                    fontWeight: 500,
                    opacity: assemblyTypes.filter(at => (assemblyTypeAssemblyCounts[at.id] || 0) === 0).length === 0 ? 0.5 : 1
                  }}
                  title={assemblyTypes.filter(at => (assemblyTypeAssemblyCounts[at.id] || 0) === 0).length === 0 ? 'No unused assembly types' : `Remove ${assemblyTypes.filter(at => (assemblyTypeAssemblyCounts[at.id] || 0) === 0).length} unused assembly type(s)`}
                >
                  {removingUnusedAssemblyTypes ? 'Removing...' : 'Remove All Unused Assembly Types'}
                </button>
                )}
              </div>

              {assemblyTypes.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {assemblyTypes.map((at, idx) => (
                    <div key={at.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '1rem', background: 'var(--surface)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{at.name}</h3>
                            <span 
                              style={{ 
                                padding: '0.125rem 0.5rem', 
                                fontSize: '0.75rem', 
                                background: (assemblyTypeAssemblyCounts[at.id] ?? 0) > 0 ? '#d1fae5' : 'var(--bg-muted)',
                                color: (assemblyTypeAssemblyCounts[at.id] ?? 0) > 0 ? '#065f46' : 'var(--text-muted)',
                                borderRadius: 4,
                                fontWeight: 500
                              }}
                              title={`${assemblyTypeAssemblyCounts[at.id] || 0} assembl${assemblyTypeAssemblyCounts[at.id] === 1 ? 'y' : 'ies'} assigned`}
                            >
                              {assemblyTypeAssemblyCounts[at.id] || 0} assembl{assemblyTypeAssemblyCounts[at.id] === 1 ? 'y' : 'ies'}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => moveAssemblyType(at, 'up')}
                            disabled={idx === 0}
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.875rem',
                              background: idx === 0 ? 'var(--bg-muted)' : 'var(--bg-200)',
                              border: '1px solid var(--border-strong)',
                              borderRadius: 4,
                              cursor: idx === 0 ? 'not-allowed' : 'pointer'
                            }}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveAssemblyType(at, 'down')}
                            disabled={idx === assemblyTypes.length - 1}
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.875rem',
                              background: idx === assemblyTypes.length - 1 ? 'var(--bg-muted)' : 'var(--bg-200)',
                              border: '1px solid var(--border-strong)',
                              borderRadius: 4,
                              cursor: idx === assemblyTypes.length - 1 ? 'not-allowed' : 'pointer'
                            }}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditAssemblyType(at)}
                            style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                          >
                            Edit
                          </button>
                          {canDeleteMaterialTypes && (
                          <button
                            type="button"
                            onClick={() => deleteAssemblyType(at)}
                            style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                          >
                            Delete
                          </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  No assembly types yet. Click "Add Assembly Type" to create one.
                </div>
              )}
            </>
          )}

          {assemblyTypeFormOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ background: 'var(--surface)', padding: '2rem', borderRadius: 8, maxWidth: '500px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
                <h2 style={{ marginBottom: '1rem' }}>{editingAssemblyType ? 'Edit Assembly Type' : 'Add Assembly Type'}</h2>
                
                <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-muted)', borderRadius: 4 }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    Service Type: <strong>{serviceTypes.find(st => st.id === selectedServiceTypeForAssemblies)?.name}</strong>
                  </span>
                </div>
                
                {assemblyTypeError && (
                  <div style={{ padding: '0.75rem', marginBottom: '1rem', background: 'var(--bg-red-tint)', border: '1px solid #fecaca', borderRadius: 4, color: 'var(--text-red-700)' }}>
                    {assemblyTypeError}
                  </div>
                )}
                
                <form onSubmit={saveAssemblyType}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
                      Name *
                    </label>
                    <input
                      type="text"
                      value={assemblyTypeName}
                      onChange={(e) => setAssemblyTypeName(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                      required
                      autoFocus
                      placeholder="e.g., Bathroom, Kitchen, Utility, Commercial"
                    />
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={closeEditAssemblyType}
                      disabled={assemblyTypeSaving}
                      style={{ padding: '0.5rem 1rem' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={assemblyTypeSaving}
                      style={{
                        padding: '0.5rem 1rem',
                        background: assemblyTypeSaving ? '#d1d5db' : '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        cursor: assemblyTypeSaving ? 'not-allowed' : 'pointer',
                        fontWeight: 500
                      }}
                    >
                      {assemblyTypeSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {myRole === 'dev' && (
        <>
          <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Takeoff, Labor, and Price Book Names</h2>
          <p style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Book names are the fixture and tie-in names (e.g., Toilet, Kitchen Sink, Water Heater) used across the Takeoff, Labor, and Price books. Each row shows a name with badges indicating how many entries in each book use it. These names appear in Bids Counts and when adding or editing book entries. New names can also be created automatically when adding book entries. Note: Materials uses Material Part Types for categorizing parts and supplies.
          </p>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Select Service Type *
            </label>
            <select
              value={selectedServiceTypeForFixtures}
              onChange={(e) => setSelectedServiceTypeForFixtures(e.target.value)}
              style={{ padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, minWidth: '200px' }}
            >
              <option value="">-- Select a service type --</option>
              {serviceTypes.map((st) => (
                <option key={st.id} value={st.id}>{st.name}</option>
              ))}
            </select>
          </div>

          {selectedServiceTypeForFixtures && (
            <>
              <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => openEditFixtureType(null)}
                  style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
                >
                  + Add Book Name
                </button>
                <button
                  type="button"
                  onClick={() => removeUnusedFixtureTypes()}
                  disabled={removingUnusedFixtureTypes}
                  title="Remove book names with 0 takeoff, 0 labor, 0 price"
                  style={{ padding: '0.5rem 1rem', background: removingUnusedFixtureTypes ? '#d1d5db' : 'var(--bg-muted)', color: 'inherit', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: removingUnusedFixtureTypes ? 'not-allowed' : 'pointer'
                  }}
                >
                  {removingUnusedFixtureTypes ? 'Removing…' : 'Remove unused book names (0 takeoff, 0 labor, 0 price)'}
                </button>
              </div>

              {fixtureTypes.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {fixtureTypes.map((ft) => (
                    <div key={ft.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '1rem', background: 'var(--surface)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{ft.name}</h3>
                            <span 
                              style={{ 
                                padding: '0.125rem 0.5rem', 
                                fontSize: '0.75rem', 
                                background: (fixtureTypeTakeoffBookCounts[ft.id] ?? 0) > 0 ? '#ede9fe' : 'var(--bg-muted)',
                                color: (fixtureTypeTakeoffBookCounts[ft.id] ?? 0) > 0 ? '#5b21b6' : 'var(--text-muted)',
                                borderRadius: 4,
                                fontWeight: 500
                              }}
                              title="Takeoff book entries"
                            >
                              {fixtureTypeTakeoffBookCounts[ft.id] || 0} takeoff
                            </span>
                            <span 
                              style={{ 
                                padding: '0.125rem 0.5rem', 
                                fontSize: '0.75rem', 
                                background: (fixtureTypeLaborBookCounts[ft.id] ?? 0) > 0 ? '#dbeafe' : 'var(--bg-muted)',
                                color: (fixtureTypeLaborBookCounts[ft.id] ?? 0) > 0 ? '#1e40af' : 'var(--text-muted)',
                                borderRadius: 4,
                                fontWeight: 500
                              }}
                              title="Labor book entries"
                            >
                              {fixtureTypeLaborBookCounts[ft.id] || 0} labor
                            </span>
                            <span 
                              style={{ 
                                padding: '0.125rem 0.5rem', 
                                fontSize: '0.75rem', 
                                background: (fixtureTypePriceBookCounts[ft.id] ?? 0) > 0 ? '#d1fae5' : 'var(--bg-muted)',
                                color: (fixtureTypePriceBookCounts[ft.id] ?? 0) > 0 ? '#065f46' : 'var(--text-muted)',
                                borderRadius: 4,
                                fontWeight: 500
                              }}
                              title="Price book entries"
                            >
                              {fixtureTypePriceBookCounts[ft.id] || 0} price
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => openEditFixtureType(ft)}
                            style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteFixtureType(ft)}
                            style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  No book names yet. Click "Add Book Name" to create one.
                </div>
              )}
            </>
          )}

          {fixtureTypeFormOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ background: 'var(--surface)', padding: '2rem', borderRadius: 8, maxWidth: '500px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
                <h2 style={{ marginBottom: '1rem' }}>{editingFixtureType ? 'Edit Book Name' : 'Add Book Name'}</h2>
                
                <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-muted)', borderRadius: 4 }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    Service Type: <strong>{serviceTypes.find(st => st.id === selectedServiceTypeForFixtures)?.name}</strong>
                  </span>
                </div>
                
                {fixtureTypeError && (
                  <div style={{ padding: '0.75rem', marginBottom: '1rem', background: 'var(--bg-red-tint)', border: '1px solid #fecaca', borderRadius: 4, color: 'var(--text-red-700)' }}>
                    {fixtureTypeError}
                  </div>
                )}
                
                <form onSubmit={saveFixtureType}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
                      Name *
                    </label>
                    <input
                      type="text"
                      value={fixtureTypeName}
                      onChange={(e) => setFixtureTypeName(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                      required
                      autoFocus
                      placeholder="e.g., Toilet, Kitchen Sink, Water Heater"
                    />
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={closeEditFixtureType}
                      disabled={fixtureTypeSaving}
                      style={{ padding: '0.5rem 1rem' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={fixtureTypeSaving}
                      style={{
                        padding: '0.5rem 1rem',
                        background: fixtureTypeSaving ? '#d1d5db' : '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        cursor: fixtureTypeSaving ? 'not-allowed' : 'pointer',
                        fontWeight: 500
                      }}
                    >
                      {fixtureTypeSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {myRole === 'dev' && (
        <>
          <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Counts Quick-add Names</h2>
          <p style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Quick-select fixture groups shown when adding count rows in Bids. Each service type (Plumbing, Electrical, HVAC) has its own set of groups and fixtures.
          </p>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Select Service Type *</label>
            <select
              value={selectedServiceTypeForCountsFixtures}
              onChange={(e) => setSelectedServiceTypeForCountsFixtures(e.target.value)}
              style={{ padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, minWidth: '200px' }}
            >
              <option value="">-- Select a service type --</option>
              {serviceTypes.map((st) => (
                <option key={st.id} value={st.id}>{st.name}</option>
              ))}
            </select>
          </div>
          {selectedServiceTypeForCountsFixtures && (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <button
                  type="button"
                  onClick={() => openEditCountsFixtureGroup(null)}
                  style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
                >
                  + Add Group
                </button>
              </div>
              {countsFixtureGroups.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {countsFixtureGroups.map((grp, gIdx) => (
                    <div key={grp.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '1rem', background: 'var(--surface)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '1rem' }}>{grp.label}</span>
                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                          <button type="button" onClick={() => moveCountsFixtureGroup(grp, 'up')} disabled={gIdx === 0} style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}>↑</button>
                          <button type="button" onClick={() => moveCountsFixtureGroup(grp, 'down')} disabled={gIdx === countsFixtureGroups.length - 1} style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}>↓</button>
                          <button type="button" onClick={() => openEditCountsFixtureGroup(grp)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}>Edit</button>
                          <button type="button" onClick={() => openEditCountsFixtureItem(grp, null)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>+ Fixture</button>
                          <button type="button" onClick={() => deleteCountsFixtureGroup(grp)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Delete</button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {countsFixtureGroupItems
                          .filter((i) => i.group_id === grp.id)
                          .sort((a, b) => a.sequence_order - b.sequence_order)
                          .map((item, iIdx) => (
                            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <button type="button" onClick={() => moveCountsFixtureItem(item, 'up')} disabled={iIdx === 0} style={{ padding: '0.125rem 0.25rem', fontSize: '0.75rem' }}>↑</button>
                              <button type="button" onClick={() => moveCountsFixtureItem(item, 'down')} disabled={iIdx === countsFixtureGroupItems.filter((x) => x.group_id === grp.id).length - 1} style={{ padding: '0.125rem 0.25rem', fontSize: '0.75rem' }}>↓</button>
                              <span style={{ padding: '0.25rem 0.5rem', background: 'var(--bg-muted)', borderRadius: 4, fontSize: '0.875rem' }}>{item.name}</span>
                              <button type="button" onClick={() => openEditCountsFixtureItem(grp, item)} style={{ padding: '0.125rem 0.25rem', fontSize: '0.75rem' }}>Edit</button>
                              <button type="button" onClick={() => deleteCountsFixtureItem(item)} style={{ padding: '0.125rem 0.25rem', fontSize: '0.75rem', color: 'var(--text-red-600)' }}>×</button>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  No groups yet. Click "Add Group" to create one (e.g. Bathrooms:, Kitchen:).
                </div>
              )}
            </>
          )}
          {countsFixtureGroupFormOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, maxWidth: 400, width: '90%' }}>
                <h3 style={{ margin: '0 0 1rem' }}>{editingCountsFixtureGroup ? 'Edit Group' : 'Add Group'}</h3>
                {countsFixtureGroupError && <div style={{ marginBottom: '0.75rem', padding: '0.5rem', background: 'var(--bg-red-tint)', color: 'var(--text-red-700)', borderRadius: 4, fontSize: '0.875rem' }}>{countsFixtureGroupError}</div>}
                <form onSubmit={saveCountsFixtureGroup}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Group label (e.g. Bathrooms:, Kitchen:)</label>
                  <input type="text" value={countsFixtureGroupLabel} onChange={(e) => setCountsFixtureGroupLabel(e.target.value)} placeholder="Bathrooms:" style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, marginBottom: '1rem' }} required />
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={closeEditCountsFixtureGroup} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
                    <button type="submit" disabled={countsFixtureGroupSaving} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{countsFixtureGroupSaving ? 'Saving...' : 'Save'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}
          {countsFixtureItemFormOpen && editingCountsFixtureGroupForItem && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, maxWidth: 400, width: '90%' }}>
                <h3 style={{ margin: '0 0 1rem' }}>{editingCountsFixtureItem ? 'Edit Fixture' : 'Add Fixture'}</h3>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Group: {editingCountsFixtureGroupForItem.label}</p>
                {countsFixtureItemError && <div style={{ marginBottom: '0.75rem', padding: '0.5rem', background: 'var(--bg-red-tint)', color: 'var(--text-red-700)', borderRadius: 4, fontSize: '0.875rem' }}>{countsFixtureItemError}</div>}
                <form onSubmit={saveCountsFixtureItem}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Fixture name</label>
                  <input type="text" value={countsFixtureItemName} onChange={(e) => setCountsFixtureItemName(e.target.value)} placeholder="e.g. Toilets, Kitchen sinks" style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, marginBottom: '1rem' }} required />
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={closeEditCountsFixtureItem} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
                    <button type="submit" disabled={countsFixtureItemSaving} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{countsFixtureItemSaving ? 'Saving...' : 'Save'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
          <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Maintenance: Materials prices</h2>
          <p style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Review and clean up material prices that don&apos;t match any part or supply house (these won&apos;t appear in the Parts Book).
          </p>
          <button
            type="button"
            onClick={() => {
              setViewingOrphanPrices(true)
              loadOrphanMaterialPrices()
            }}
            style={{ padding: '0.5rem 1rem', background: '#92400e', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
          >
            Review orphaned material prices
          </button>
          </div>
          )}
        </div>
    </>
  )
}
