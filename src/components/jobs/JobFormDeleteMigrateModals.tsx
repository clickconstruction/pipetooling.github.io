import { useJobMigrate } from './useJobMigrate'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { TeamLaborRow } from '../../utils/teamLabor'
import { formatCurrency } from '../../lib/jobs/jobFormMoney'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'

type JobFormDeleteMigrateModalsProps = {
  editing: JobWithDetails | null
  deleteJobConfirmOpen: boolean
  setDeleteJobConfirmOpen: (open: boolean) => void
  deletingId: string | null
  migrate: ReturnType<typeof useJobMigrate>
  hasMigrateableCosts: boolean
  costCheckErrored: boolean
  costSnapshotStillLoading: boolean
  reassignRequired: boolean
  partsCostStyleTotal: number
  materialsBilledTotalForMigrate: number
  editJobTeamLaborRow: TeamLaborRow | null
  editJobSubLaborData: { count: number; total: number } | null
  confirmDeleteJob: () => Promise<void>
  migrateJobLedgerCostsAndDelete: (fromId: string, toId: string) => Promise<boolean>
  nestedOverlayZIndex: number
  migrateOverlayZIndex: number
}

/**
 * The Delete-job confirm + Migrate-costs-and-delete modal pair for the Edit-Job
 * modal (§19/§20 in JOB_FORM_MODAL_ARCHITECTURE.md). The delete confirm shows
 * the 90-day restore note and, when the cost gate trips (hasMigrateableCosts or
 * an errored cost check), replaces Delete with "Reassign to another job…" which
 * opens the migrate modal (target search via the useJobMigrate hook, Source /
 * Target summary preview, then the irreversible migrate_job_ledger_costs_and_
 * delete RPC). Extracted verbatim from JobFormModal — the hook, the cost-gate
 * memos, and both money-path handlers stay in the shell; the whole hook object
 * flows in as `migrate`.
 */
export function JobFormDeleteMigrateModals({
  editing,
  deleteJobConfirmOpen,
  setDeleteJobConfirmOpen,
  deletingId,
  migrate,
  hasMigrateableCosts,
  costCheckErrored,
  costSnapshotStillLoading,
  reassignRequired,
  partsCostStyleTotal,
  materialsBilledTotalForMigrate,
  editJobTeamLaborRow,
  editJobSubLaborData,
  confirmDeleteJob,
  migrateJobLedgerCostsAndDelete,
  nestedOverlayZIndex,
  migrateOverlayZIndex,
}: JobFormDeleteMigrateModalsProps) {
  const {
    migrateJobModalOpen,
    setMigrateJobModalOpen,
    migrateTargetSearch,
    setMigrateTargetSearch,
    migrateTargetCandidates,
    setMigrateTargetCandidates,
    migrateTargetSearchLoading,
    migrateTargetJobId,
    setMigrateTargetJobId,
    migrateTargetPreviewLoading,
    migrateTargetPreview,
    migratingJob,
  } = migrate

  return (
    <>
      {deleteJobConfirmOpen && editing && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: nestedOverlayZIndex,
          }}
          onClick={() => {
            if (deletingId === editing.id) return
            setDeleteJobConfirmOpen(false)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="job-form-delete-job-confirm-title"
            style={{
              background: 'var(--surface)',
              padding: '1.5rem',
              borderRadius: 8,
              minWidth: 360,
              maxWidth: 480,
              maxHeight: '90vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="job-form-delete-job-confirm-title"
              style={{ margin: '0 0 0.75rem', fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-strong)' }}
            >
              Delete job from Billing?
            </h2>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-700)', lineHeight: 1.5, marginBottom: '1rem' }}>
              <p style={{ margin: '0 0 0.5rem' }}>
                <strong>HCP:</strong> {effectiveJobLedgerNumber(editing.hcp_number, editing.click_number) || '—'}{' '}
                <strong>Job:</strong> {(editing.job_name ?? '').trim() || '—'}
              </p>
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                This removes the job from Billing along with everything on it — invoices, payments, costs and
                reports. A dev can put it back for 90 days from <strong>Settings → Data &amp; migration → Recently
                deleted</strong>.
              </p>
              {hasMigrateableCosts && !costSnapshotStillLoading ? (
                <div
                  style={{
                    marginTop: '0.85rem',
                    padding: '0.65rem 0.75rem',
                    background: 'var(--bg-amber-tint)',
                    border: '1px solid var(--border-amber-soft)',
                    borderRadius: 6,
                  }}
                >
                  <p style={{ margin: '0 0 0.4rem', fontWeight: 600, color: 'var(--text-amber-800)' }}>
                    This job has costs attached
                  </p>
                  <ul style={{ margin: '0 0 0.5rem', paddingLeft: '1.1rem' }}>
                    <li>
                      Parts, card charges &amp; supply invoices: ${formatCurrency(partsCostStyleTotal)}
                    </li>
                    <li>Billed materials: ${formatCurrency(materialsBilledTotalForMigrate)}</li>
                    {editJobTeamLaborRow &&
                    (editJobTeamLaborRow.jobCost > 0 || editJobTeamLaborRow.manHours > 0) ? (
                      <li>
                        Team labor (est.): ${formatCurrency(editJobTeamLaborRow.jobCost)} ·{' '}
                        {editJobTeamLaborRow.manHours} hrs
                      </li>
                    ) : null}
                  </ul>
                  <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                    To delete this job you must first reassign these to another job — otherwise card
                    charges &amp; supply-invoice splits would be unlinked and tally parts &amp; materials
                    removed along with it.
                  </p>
                </div>
              ) : null}
              {costCheckErrored && !hasMigrateableCosts && !costSnapshotStillLoading ? (
                <div
                  style={{
                    marginTop: '0.85rem',
                    padding: '0.65rem 0.75rem',
                    background: 'var(--bg-amber-tint)',
                    border: '1px solid var(--border-amber-soft)',
                    borderRadius: 6,
                  }}
                >
                  <p style={{ margin: 0, color: 'var(--text-amber-800)' }}>
                    Couldn’t verify this job’s costs. To avoid losing any, reassign it to another job
                    instead of deleting.
                  </p>
                </div>
              ) : null}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  if (deletingId === editing.id) return
                  setDeleteJobConfirmOpen(false)
                }}
                disabled={deletingId === editing.id}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'var(--bg-muted)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 6,
                  cursor: deletingId === editing.id ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Cancel
              </button>
              {costSnapshotStillLoading ? (
                <button
                  type="button"
                  disabled
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#9ca3af',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'not-allowed',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }}
                >
                  Checking costs…
                </button>
              ) : reassignRequired ? (
                <button
                  type="button"
                  onClick={() => {
                    if (deletingId === editing.id) return
                    setMigrateTargetSearch('')
                    setMigrateTargetJobId(null)
                    setMigrateTargetCandidates([])
                    setDeleteJobConfirmOpen(false)
                    setMigrateJobModalOpen(true)
                  }}
                  disabled={deletingId === editing.id}
                  style={{
                    padding: '0.5rem 1rem',
                    background: deletingId === editing.id ? '#9ca3af' : '#1d4ed8',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    cursor: deletingId === editing.id ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }}
                >
                  Reassign to another job…
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void confirmDeleteJob()}
                  disabled={deletingId === editing.id}
                  style={{
                    padding: '0.5rem 1rem',
                    background: deletingId === editing.id ? '#9ca3af' : '#b91c1c',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    cursor: deletingId === editing.id ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }}
                >
                  {deletingId === editing.id ? 'Deleting…' : 'Delete'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {migrateJobModalOpen && editing && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: migrateOverlayZIndex,
            padding: '1rem',
          }}
          onClick={() => {
            if (migratingJob) return
            setMigrateJobModalOpen(false)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="job-form-migrate-delete-title"
            style={{
              background: 'var(--surface)',
              padding: '1.5rem',
              borderRadius: 8,
              minWidth: 360,
              maxWidth: 520,
              maxHeight: '90vh',
              overflow: 'auto',
              width: '100%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="job-form-migrate-delete-title"
              style={{ margin: '0 0 0.75rem', fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-strong)' }}
            >
              Migrate costs and delete this job
            </h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-700)', lineHeight: 1.5 }}>
              Move labor, parts, materials, Specific Work, and related rows to another job, add this job’s{' '}
              <strong>Job total (revenue)</strong> to the target’s total, then remove{' '}
              <strong>HCP {effectiveJobLedgerNumber(editing.hcp_number, editing.click_number) || '—'}</strong> —{' '}
              <strong>{(editing.job_name ?? '').trim() || '—'}</strong>. <strong>Moving the costs cannot be
              reversed.</strong>
            </p>
            <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-amber-800)', lineHeight: 1.45 }}>
              This job’s own invoices and recorded payments are deleted with it — only costs, labor, and revenue
              move to the target. A dev can restore the deleted job and those invoices/payments for 90 days
              (<strong>Settings → Data &amp; migration → Recently deleted</strong>), but anything moved to the target
              stays there.
            </p>
            {editJobSubLaborData != null && editJobSubLaborData.count > 0 ? (
              <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-amber-800)', lineHeight: 1.45 }}>
                Subcontractor labor on this HCP is tracked separately from this billing job; it is not changed by
                migrate-delete. Update People Labor if the HCP should follow the target job.
              </p>
            ) : null}
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)', marginBottom: 6 }}>
              Target job
            </label>
            <input
              type="search"
              value={migrateTargetSearch}
              onChange={(e) => {
                setMigrateTargetSearch(e.target.value)
                setMigrateTargetJobId(null)
              }}
              placeholder="Search HCP, name, or address (2+ characters)"
              disabled={migratingJob}
              style={{
                width: '100%',
                padding: '0.5rem 0.65rem',
                borderRadius: 6,
                border: '1px solid var(--border-strong)',
                fontSize: '0.875rem',
                marginBottom: 8,
              }}
            />
            {migrateTargetSearchLoading ? (
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Searching…</p>
            ) : null}
            {migrateTargetSearch.trim().length >= 2 && migrateTargetCandidates.length === 0 && !migrateTargetSearchLoading ? (
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No jobs match.</p>
            ) : null}
            <ul
              style={{
                listStyle: 'none',
                margin: '0 0 1rem',
                padding: 0,
                maxHeight: 200,
                overflow: 'auto',
                border: '1px solid var(--border)',
                borderRadius: 6,
              }}
            >
              {migrateTargetCandidates.map((j) => (
                <li key={j.id}>
                  <button
                    type="button"
                    disabled={migratingJob}
                    onClick={() => setMigrateTargetJobId(j.id)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.5rem 0.65rem',
                      border: 'none',
                      borderBottom: '1px solid var(--border)',
                      background: migrateTargetJobId === j.id ? 'var(--bg-blue-tint)' : 'var(--surface)',
                      cursor: migratingJob ? 'not-allowed' : 'pointer',
                      fontSize: '0.8125rem',
                    }}
                  >
                    <strong>{effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—'}</strong> — {(j.job_name ?? '').trim() || '—'}
                    <div style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{(j.job_address ?? '').trim() || '—'}</div>
                  </button>
                </li>
              ))}
            </ul>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)', marginBottom: 8 }}>Summary</div>
              <table style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '4px 8px 4px 0', color: 'var(--text-muted)', fontWeight: 600 }} />
                    <th style={{ textAlign: 'right', padding: '4px 4px', color: 'var(--text-muted)', fontWeight: 600 }}>Source</th>
                    <th style={{ textAlign: 'right', padding: '4px 0 4px 4px', color: 'var(--text-muted)', fontWeight: 600 }}>Target</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '4px 8px 4px 0', color: 'var(--text-700)' }}>Parts-style costs</td>
                    <td style={{ textAlign: 'right', padding: '4px 4px' }}>${formatCurrency(partsCostStyleTotal)}</td>
                    <td style={{ textAlign: 'right', padding: '4px 0 4px 4px' }}>
                      {migrateTargetPreviewLoading
                        ? '…'
                        : migrateTargetPreview
                          ? `$${formatCurrency(migrateTargetPreview.supply + migrateTargetPreview.tally + migrateTargetPreview.mercury)}`
                          : '—'}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '4px 8px 4px 0', color: 'var(--text-700)' }}>Billed materials</td>
                    <td style={{ textAlign: 'right', padding: '4px 4px' }}>
                      ${formatCurrency(materialsBilledTotalForMigrate)}
                    </td>
                    <td style={{ textAlign: 'right', padding: '4px 0 4px 4px' }}>—</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '4px 8px 4px 0', color: 'var(--text-700)' }}>Team labor (est.)</td>
                    <td style={{ textAlign: 'right', padding: '4px 4px' }}>
                      {editJobTeamLaborRow
                        ? `$${formatCurrency(editJobTeamLaborRow.jobCost)}`
                        : '—'}
                    </td>
                    <td style={{ textAlign: 'right', padding: '4px 0 4px 4px' }}>
                      {migrateTargetPreviewLoading
                        ? '…'
                        : migrateTargetPreview
                          ? `$${formatCurrency(migrateTargetPreview.teamCost)}`
                          : '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => {
                  if (migratingJob) return
                  setMigrateJobModalOpen(false)
                }}
                disabled={migratingJob}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'var(--bg-muted)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 6,
                  cursor: migratingJob ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={migratingJob || !migrateTargetJobId}
                onClick={() => {
                  if (!editing?.id || !migrateTargetJobId) return
                  void migrateJobLedgerCostsAndDelete(editing.id, migrateTargetJobId)
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background: migratingJob || !migrateTargetJobId ? '#9ca3af' : '#b91c1c',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: migratingJob || !migrateTargetJobId ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                {migratingJob ? 'Working…' : 'Confirm migrate and delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
