import { useState } from 'react'
import { useMasterAdoptions } from '../../hooks/useMasterAdoptions'

/**
 * Settings → People & accounts → "Sharing and Adoption" (dev|master).
 * Self-contained: owns its state via useMasterAdoptions (loads on mount).
 * Four sub-blocks: Adopt Assistants (assistants list includes controllers),
 * Adopt Primaries, Adopt Superintendents, Share with other Master.
 * Dev extra: a master picker (rendered identically above each adoption block)
 * to manage another master's adoptions; sharing always acts as self.
 */
export default function SettingsSharingAdoptionSection({
  isDev,
  authUserId,
}: {
  isDev: boolean
  authUserId: string | null
}) {
  const [roleSharingSectionOpen, setRoleSharingSectionOpen] = useState(false)
  const {
    assistants,
    adoptedAssistantIds,
    adoptionSaving,
    adoptionError,
    primaries,
    adoptedPrimaryIds,
    primaryAdoptionSaving,
    primaryAdoptionError,
    superintendents,
    adoptedSuperintendentIds,
    superintendentAdoptionSaving,
    superintendentAdoptionError,
    selectedMasterIdForAdoptions,
    masters,
    sharedMasterIds,
    sharingSaving,
    sharingError,
    adoptionMasterId,
    toggleAdoption,
    togglePrimaryAdoption,
    toggleSuperintendentAdoption,
    toggleSharing,
    handleAdoptionMasterChange,
  } = useMasterAdoptions(authUserId, isDev)

  return (
    <div style={{ marginTop: '2rem', marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8 }}>
      <button
        type="button"
        onClick={() => setRoleSharingSectionOpen((prev) => !prev)}
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
        <span style={{ fontSize: '0.75rem' }}>{roleSharingSectionOpen ? '▼' : '▶'}</span>
        Sharing and Adoption
      </button>
      {roleSharingSectionOpen && (
      <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
      <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>Adopt Assistants</h2>
      {isDev && (
        <p style={{ marginBottom: '0.75rem', color: 'var(--text-muted)' }}>
          <label htmlFor="adoption-master-select" style={{ marginRight: '0.5rem' }}>Manage adoptions for:</label>
          <select
            id="adoption-master-select"
            value={selectedMasterIdForAdoptions ?? ''}
            onChange={(e) => handleAdoptionMasterChange(e.target.value || null)}
            style={{ padding: '0.25rem 0.5rem', borderRadius: 4, border: '1px solid var(--border-strong)', minWidth: 200 }}
          >
            <option value="">Myself</option>
            {masters.map((m) => (
              <option key={m.id} value={m.id}>{m.name || m.email || m.id}</option>
            ))}
          </select>
        </p>
      )}
      <p style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>
        {isDev && adoptionMasterId && adoptionMasterId !== authUserId
          ? `Adopt or unadopt assistants for the selected master. Changes apply to that master's access.`
          : 'Adopt assistants to give them access to your customers and projects. Assistants can create projects and assign them to you. Assistants cannot see financial totals.'}
      </p>
      {adoptionError && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{adoptionError}</p>}
      {assistants.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No assistants found.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 640 }}>
          {assistants.map((assistant) => {
            const isAdopted = adoptedAssistantIds.has(assistant.id)
            return (
              <label
                key={assistant.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  cursor: adoptionSaving ? 'not-allowed' : 'pointer',
                  background: isAdopted ? 'var(--bg-green-tint)' : 'var(--surface)',
                }}
              >
                <input
                  type="checkbox"
                  checked={isAdopted}
                  onChange={() => toggleAdoption(assistant.id, isAdopted)}
                  disabled={adoptionSaving}
                  style={{ cursor: adoptionSaving ? 'not-allowed' : 'pointer' }}
                />
                <span style={{ flex: 1 }}>
                  <span style={{ fontWeight: 500 }}>{assistant.name || assistant.email}</span>
                  {assistant.email && assistant.name && (
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                      ({assistant.email})
                    </span>
                  )}
                </span>
                {isAdopted && (
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-green-600)', fontWeight: 500 }}>
                    Adopted
                  </span>
                )}
              </label>
            )
          })}
        </div>
      )}
      <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Adopt Primaries</h2>
      {isDev && (
        <p style={{ marginBottom: '0.75rem', color: 'var(--text-muted)' }}>
          <label htmlFor="adoption-master-select-primaries" style={{ marginRight: '0.5rem' }}>Manage adoptions for:</label>
          <select
            id="adoption-master-select-primaries"
            value={selectedMasterIdForAdoptions ?? ''}
            onChange={(e) => handleAdoptionMasterChange(e.target.value || null)}
            style={{ padding: '0.25rem 0.5rem', borderRadius: 4, border: '1px solid var(--border-strong)', minWidth: 200 }}
          >
            <option value="">Myself</option>
            {masters.map((m) => (
              <option key={m.id} value={m.id}>{m.name || m.email || m.id}</option>
            ))}
          </select>
        </p>
      )}
      <p style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>
        {isDev && adoptionMasterId && adoptionMasterId !== authUserId
          ? `Adopt or unadopt primaries for the selected master. Changes apply to that master's access.`
          : 'Adopt primaries to associate them with your organization. Primaries can add materials to jobs in the Jobs Billing tab.'}
      </p>
      {primaryAdoptionError && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{primaryAdoptionError}</p>}
      {primaries.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No primaries found.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 640 }}>
          {primaries.map((primary) => {
            const isAdopted = adoptedPrimaryIds.has(primary.id)
            return (
              <label
                key={primary.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  cursor: primaryAdoptionSaving ? 'not-allowed' : 'pointer',
                  background: isAdopted ? 'var(--bg-green-tint)' : 'var(--surface)',
                }}
              >
                <input
                  type="checkbox"
                  checked={isAdopted}
                  onChange={() => togglePrimaryAdoption(primary.id, isAdopted)}
                  disabled={primaryAdoptionSaving}
                  style={{ cursor: primaryAdoptionSaving ? 'not-allowed' : 'pointer' }}
                />
                <span style={{ flex: 1 }}>
                  <span style={{ fontWeight: 500 }}>{primary.name || primary.email}</span>
                  {primary.email && primary.name && (
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                      ({primary.email})
                    </span>
                  )}
                </span>
                {isAdopted && (
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-green-600)', fontWeight: 500 }}>
                    Adopted
                  </span>
                )}
              </label>
            )
          })}
        </div>
      )}
      <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Adopt Superintendents</h2>
      {isDev && (
        <p style={{ marginBottom: '0.75rem', color: 'var(--text-muted)' }}>
          <label htmlFor="adoption-master-select-superintendents" style={{ marginRight: '0.5rem' }}>Manage adoptions for:</label>
          <select
            id="adoption-master-select-superintendents"
            value={selectedMasterIdForAdoptions ?? ''}
            onChange={(e) => handleAdoptionMasterChange(e.target.value || null)}
            style={{ padding: '0.25rem 0.5rem', borderRadius: 4, border: '1px solid var(--border-strong)', minWidth: 200 }}
          >
            <option value="">Myself</option>
            {masters.map((m) => (
              <option key={m.id} value={m.id}>{m.name || m.email || m.id}</option>
            ))}
          </select>
        </p>
      )}
      <p style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>
        {isDev && adoptionMasterId && adoptionMasterId !== authUserId
          ? `Adopt or unadopt superintendents for the selected master. Changes apply to that master's access.`
          : 'Adopt superintendents to grant them access to your projects, workflows, jobs, and bids. Superintendents run jobs and manage subcontractors.'}
      </p>
      {superintendentAdoptionError && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{superintendentAdoptionError}</p>}
      {superintendents.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No superintendents found.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 640 }}>
          {superintendents.map((sup) => {
            const isAdopted = adoptedSuperintendentIds.has(sup.id)
            return (
              <label
                key={sup.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  cursor: superintendentAdoptionSaving ? 'not-allowed' : 'pointer',
                  background: isAdopted ? 'var(--bg-green-tint)' : 'var(--surface)',
                }}
              >
                <input
                  type="checkbox"
                  checked={isAdopted}
                  onChange={() => toggleSuperintendentAdoption(sup.id, isAdopted)}
                  disabled={superintendentAdoptionSaving}
                  style={{ cursor: superintendentAdoptionSaving ? 'not-allowed' : 'pointer' }}
                />
                <span style={{ flex: 1 }}>
                  <span style={{ fontWeight: 500 }}>{sup.name || sup.email}</span>
                  {sup.email && sup.name && (
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                      ({sup.email})
                    </span>
                  )}
                </span>
                {isAdopted && (
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-green-600)', fontWeight: 500 }}>
                    Adopted
                  </span>
                )}
              </label>
            )
          })}
        </div>
      )}
      <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Share with other Master</h2>
      <p style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>
        Share your customers and projects with another master. They will see your jobs with assistant-level access (cannot see financial totals).
      </p>
      {sharingError && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{sharingError}</p>}
      {masters.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No other masters found.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 640 }}>
          {masters.map((master) => {
            const isShared = sharedMasterIds.has(master.id)
            return (
              <label
                key={master.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  cursor: sharingSaving ? 'not-allowed' : 'pointer',
                  background: isShared ? 'var(--bg-green-tint)' : 'var(--surface)',
                }}
              >
                <input
                  type="checkbox"
                  checked={isShared}
                  onChange={() => toggleSharing(master.id, isShared)}
                  disabled={sharingSaving}
                  style={{ cursor: sharingSaving ? 'not-allowed' : 'pointer' }}
                />
                <span style={{ flex: 1 }}>
                  <span style={{ fontWeight: 500 }}>{master.name || master.email}</span>
                  {master.email && master.name && (
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                      ({master.email})
                    </span>
                  )}
                </span>
                {isShared && (
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-green-600)', fontWeight: 500 }}>
                    Shared
                  </span>
                )}
              </label>
            )
          })}
        </div>
      )}
      </div>
      )}
    </div>
  )
}
