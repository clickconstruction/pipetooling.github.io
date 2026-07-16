/** Settings → Data & migration tab: dev-only JSON backup exporters + the deleted-records archive.
 * Presentational; all state/handlers live in the parent (Settings.tsx) and arrive as props.
 * The SettingsGroup wrapper and the `myRole === 'dev'` gate stay in the parent.
 * Exception: DeletedRecordsSection is self-contained (owns its state via useDeletedRecordsArchive) —
 * it is single-surface, so threading its state through Settings.tsx would add props for no benefit. */
import type { Dispatch, SetStateAction } from 'react'
import DeletedRecordsSection from './DeletedRecordsSection'

export default function SettingsDataTab({
  dataBackupSectionOpen,
  setDataBackupSectionOpen,
  exportError,
  exportBackupBusy,
  exportProjectsBackup,
  exportProjectsLoading,
  exportMaterialsBackup,
  exportMaterialsLoading,
  exportBidsBackup,
  exportBidsLoading,
  exportPeopleBackup,
  exportPeopleLoading,
  exportJobsBackup,
  exportJobsLoading,
  exportChecklistBackup,
  exportChecklistLoading,
  exportReportsBackup,
  exportReportsLoading,
  exportProspectsBackup,
  exportProspectsLoading,
  exportSettingsBackup,
  exportSettingsLoading,
  exportAllBackup,
  exportAllLoading,
}: {
  dataBackupSectionOpen: boolean
  setDataBackupSectionOpen: Dispatch<SetStateAction<boolean>>
  exportError: string | null
  exportBackupBusy: boolean
  exportProjectsBackup: () => void
  exportProjectsLoading: boolean
  exportMaterialsBackup: () => void
  exportMaterialsLoading: boolean
  exportBidsBackup: () => void
  exportBidsLoading: boolean
  exportPeopleBackup: () => void
  exportPeopleLoading: boolean
  exportJobsBackup: () => void
  exportJobsLoading: boolean
  exportChecklistBackup: () => void
  exportChecklistLoading: boolean
  exportReportsBackup: () => void
  exportReportsLoading: boolean
  exportProspectsBackup: () => void
  exportProspectsLoading: boolean
  exportSettingsBackup: () => void
  exportSettingsLoading: boolean
  exportAllBackup: () => void
  exportAllLoading: boolean
}) {
  return (
    <>
    <div style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8 }}>
      <button
        type="button"
        aria-expanded={dataBackupSectionOpen}
        onClick={() => setDataBackupSectionOpen((prev) => !prev)}
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
        <span style={{ fontSize: '0.75rem' }}>{dataBackupSectionOpen ? '▼' : '▶'}</span>
        Data backup (dev)
      </button>
      {dataBackupSectionOpen && (
        <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
          <p style={{ marginBottom: '1rem', marginTop: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Export projects, materials, bids, people &amp; access, jobs, checklist, reports, prospects, or settings &amp; reference as JSON for backup. Use &quot;Export all backup&quot; to download everything in one file. Files respect RLS. Export may take several minutes for large datasets and uses significant database resources.
          </p>
          {exportError && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{exportError}</p>}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={exportProjectsBackup}
              disabled={exportBackupBusy}
              style={{ padding: '0.5rem 1rem', background: '#1e40af', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
            >
              {exportProjectsLoading ? 'Exporting…' : 'Export projects backup'}
            </button>
            <button
              type="button"
              onClick={exportMaterialsBackup}
              disabled={exportBackupBusy}
              style={{ padding: '0.5rem 1rem', background: '#065f46', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
            >
              {exportMaterialsLoading ? 'Exporting…' : 'Export materials backup'}
            </button>
            <button
              type="button"
              onClick={exportBidsBackup}
              disabled={exportBackupBusy}
              style={{ padding: '0.5rem 1rem', background: '#7c2d12', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
            >
              {exportBidsLoading ? 'Exporting…' : 'Export bids backup'}
            </button>
            <button
              type="button"
              onClick={exportPeopleBackup}
              disabled={exportBackupBusy}
              style={{ padding: '0.5rem 1rem', background: '#4c1d95', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
            >
              {exportPeopleLoading ? 'Exporting…' : 'Export people backup'}
            </button>
            <button
              type="button"
              onClick={exportJobsBackup}
              disabled={exportBackupBusy}
              style={{ padding: '0.5rem 1rem', background: '#0e7490', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
            >
              {exportJobsLoading ? 'Exporting…' : 'Export jobs backup'}
            </button>
            <button
              type="button"
              onClick={exportChecklistBackup}
              disabled={exportBackupBusy}
              style={{ padding: '0.5rem 1rem', background: '#b45309', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
            >
              {exportChecklistLoading ? 'Exporting…' : 'Export checklist backup'}
            </button>
            <button
              type="button"
              onClick={exportReportsBackup}
              disabled={exportBackupBusy}
              style={{ padding: '0.5rem 1rem', background: '#1e3a8a', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
            >
              {exportReportsLoading ? 'Exporting…' : 'Export reports backup'}
            </button>
            <button
              type="button"
              onClick={exportProspectsBackup}
              disabled={exportBackupBusy}
              style={{ padding: '0.5rem 1rem', background: '#6b21a8', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
            >
              {exportProspectsLoading ? 'Exporting…' : 'Export prospects backup'}
            </button>
            <button
              type="button"
              onClick={exportSettingsBackup}
              disabled={exportBackupBusy}
              style={{ padding: '0.5rem 1rem', background: '#374151', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
            >
              {exportSettingsLoading ? 'Exporting…' : 'Export settings backup'}
            </button>
            <button
              type="button"
              onClick={exportAllBackup}
              disabled={exportBackupBusy}
              style={{ padding: '0.5rem 1rem', background: '#111827', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
            >
              {exportAllLoading ? 'Exporting…' : 'Export all backup'}
            </button>
          </div>
        </div>
      )}
    </div>
    <DeletedRecordsSection />
    </>
  )
}
