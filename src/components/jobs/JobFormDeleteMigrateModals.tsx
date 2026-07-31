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
  migrateJobLedgerCostsToBidAndDelete: (fromId: string, toBidId: string) => Promise<boolean>
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
  migrateJobLedgerCostsToBidAndDelete,
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
    migrateTargetKind,
    setMigrateTargetKind,
    migrateBidSearch,
    setMigrateBidSearch,
    migrateBidCandidates,
    migrateBidSearchLoading,
    migrateTargetBidId,
    setMigrateTargetBidId,
    migrateBidDryRun,
    migrateBidDryRunLoading,
    createMigrateTargetBid,
    creatingMigrateBid,
    createMigrateBidError,
  } = migrate

  const targetingBid = migrateTargetKind === 'bid'
  const confirmDisabled = migratingJob || (targetingBid ? !migrateTargetBidId : !migrateTargetJobId)
  // Inline "create the target bid" escape hatch: needs 2+ chars of search text
  // (that text becomes the project name) and the source job's service type
  // (bids.service_type_id is required).
  const bidCreateName = migrateBidSearch.trim()
  const canCreateTargetBid = bidCreateName.length >= 2 && !migrateBidSearchLoading && editing?.service_type_id != null
  // Only rows the RPC reported as non-zero are worth showing; a wall of "0"s
  // buries the ones that matter.
  const dryRunDropped = Object.entries(migrateBidDryRun?.dropped ?? {}).filter(([, n]) => Number(n) > 0)
  const dryRunMoved = Object.entries(migrateBidDryRun?.moved ?? {}).filter(([, n]) => Number(n) > 0)
  const prettyCountKey = (k: string) => k.replace(/_/g, ' ')

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
                    To delete this job you must first reassign these to another job — or to a bid, if the
                    work really belonged to one. Otherwise card charges &amp; supply-invoice splits would be
                    unlinked and tally parts &amp; materials removed along with it.
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
            {targetingBid ? (
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-700)', lineHeight: 1.5 }}>
                Move labor, parts, materials and field reports onto a bid, then remove{' '}
                <strong>HCP {effectiveJobLedgerNumber(editing.hcp_number, editing.click_number) || '—'}</strong> —{' '}
                <strong>{(editing.job_name ?? '').trim() || '—'}</strong>. <strong>Moving the costs cannot be
                reversed.</strong>
              </p>
            ) : (
              <>
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
              </>
            )}
            {editJobSubLaborData != null && editJobSubLaborData.count > 0 ? (
              <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-amber-800)', lineHeight: 1.45 }}>
                Subcontractor labor on this HCP is tracked separately from this billing job; it is not changed by
                migrate-delete. Update People Labor if the HCP should follow the target job.
              </p>
            ) : null}
            <div role="group" aria-label="Move costs to" style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {([
                { kind: 'job' as const, label: 'Another job' },
                { kind: 'bid' as const, label: 'A bid' },
              ]).map(({ kind, label }) => {
                const active = migrateTargetKind === kind
                return (
                  <button
                    key={kind}
                    type="button"
                    aria-pressed={active}
                    disabled={migratingJob}
                    onClick={() => setMigrateTargetKind(kind)}
                    style={{
                      flex: 1,
                      padding: '0.4rem 0.65rem',
                      borderRadius: 6,
                      border: `1px solid ${active ? '#2563eb' : 'var(--border-strong)'}`,
                      background: active ? 'var(--bg-blue-tint)' : 'var(--surface)',
                      color: active ? 'var(--text-link)' : 'var(--text-700)',
                      fontWeight: active ? 600 : 400,
                      fontSize: '0.8125rem',
                      cursor: migratingJob ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            {targetingBid ? (
              <p style={{ margin: '0 0 0.85rem', fontSize: '0.8125rem', color: 'var(--text-amber-800)', lineHeight: 1.45 }}>
                Use this when the time and spending really belonged to a bid, not a job. Costs, team labor and
                field reports move to the bid. <strong>This job’s revenue does not</strong> — a bid has no revenue
                total to add it to. Anything with no place on a bid is listed below before you confirm.
              </p>
            ) : null}
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)', marginBottom: 6 }}>
              {targetingBid ? 'Target bid' : 'Target job'}
            </label>
            {targetingBid ? (
              <input
                type="search"
                value={migrateBidSearch}
                onChange={(e) => {
                  setMigrateBidSearch(e.target.value)
                  setMigrateTargetBidId(null)
                }}
                placeholder="Search bid number, project, or address (2+ characters)"
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
            ) : (
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
            )}
            {targetingBid && migrateBidSearchLoading ? (
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Searching…</p>
            ) : null}
            {targetingBid && migrateBidSearch.trim().length >= 2 && migrateBidCandidates.length === 0 && !migrateBidSearchLoading ? (
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                No bids match{canCreateTargetBid ? ' — you can create one below.' : '.'}
              </p>
            ) : null}
            {targetingBid ? (
              <ul style={{ listStyle: 'none', margin: '0 0 1rem', padding: 0, maxHeight: 200, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 6 }}>
                {migrateBidCandidates.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      disabled={migratingJob}
                      onClick={() => setMigrateTargetBidId(b.id)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.5rem 0.65rem',
                        border: 'none',
                        borderBottom: '1px solid var(--border)',
                        background: migrateTargetBidId === b.id ? 'var(--bg-blue-tint)' : 'var(--surface)',
                        cursor: migratingJob ? 'not-allowed' : 'pointer',
                        fontSize: '0.8125rem',
                      }}
                    >
                      <strong>{(b.bid_number ?? '').trim() || '—'}</strong> — {(b.project_name ?? '').trim() || '—'}
                      <div style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                        {(b.customer_name ?? '').trim() || '—'}
                        {(b.address ?? '').trim() ? ` · ${b.address}` : ''}
                      </div>
                    </button>
                  </li>
                ))}
                {canCreateTargetBid && editing ? (
                  <li key="__create-bid__">
                    <button
                      type="button"
                      disabled={migratingJob || creatingMigrateBid}
                      onClick={() => {
                        void createMigrateTargetBid({
                          projectName: bidCreateName,
                          serviceTypeId: editing.service_type_id!,
                          customerId: editing.customer_id ?? null,
                          address: (editing.job_address ?? '').trim() || null,
                        })
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.5rem 0.65rem',
                        border: 'none',
                        borderBottom: '1px solid var(--border)',
                        background: 'var(--surface)',
                        cursor: migratingJob || creatingMigrateBid ? 'not-allowed' : 'pointer',
                        fontSize: '0.8125rem',
                      }}
                    >
                      <strong style={{ color: 'var(--text-blue-800)' }}>
                        {creatingMigrateBid ? 'Creating bid…' : <>+ Create new bid &ldquo;{bidCreateName}&rdquo;</>}
                      </strong>
                      <div style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                        Starts a {(editing.serviceType?.name ?? 'same-service')} bid with this job&rsquo;s
                        {editing.customer_id ? ' customer and' : ''} address — finish it on Bids later.
                      </div>
                    </button>
                  </li>
                ) : null}
              </ul>
            ) : null}
            {targetingBid && createMigrateBidError ? (
              <p style={{ margin: '-0.5rem 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>
                {createMigrateBidError}
              </p>
            ) : null}
            {!targetingBid && migrateTargetSearchLoading ? (
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Searching…</p>
            ) : null}
            {!targetingBid && migrateTargetSearch.trim().length >= 2 && migrateTargetCandidates.length === 0 && !migrateTargetSearchLoading ? (
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No jobs match.</p>
            ) : null}
            {!targetingBid ? (
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
            ) : null}
            {targetingBid ? (
              // The RPC's own dry run: it performs the migration, reports it and
              // rolls back, so these counts are exactly what Confirm will do.
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)', marginBottom: 8 }}>
                  What moves to the bid
                </div>
                {!migrateTargetBidId ? (
                  <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Pick a bid to preview.</p>
                ) : migrateBidDryRunLoading ? (
                  <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Checking…</p>
                ) : !migrateBidDryRun?.ok ? (
                  <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>
                    {migrateBidDryRun?.error?.trim() || 'Could not preview this move.'}
                  </p>
                ) : (
                  <>
                    <ul style={{ margin: '0 0 0.75rem', paddingLeft: '1.1rem', fontSize: '0.8125rem', color: 'var(--text-700)' }}>
                      {dryRunMoved.length === 0 ? (
                        <li style={{ color: 'var(--text-muted)' }}>Nothing to move.</li>
                      ) : (
                        dryRunMoved.map(([k, n]) => (
                          <li key={k}>
                            {prettyCountKey(k)}: <strong>{String(n)}</strong>
                          </li>
                        ))
                      )}
                    </ul>
                    <div
                      style={{
                        padding: '0.65rem 0.75rem',
                        background: 'var(--bg-amber-tint)',
                        border: '1px solid var(--border-amber-soft)',
                        borderRadius: 6,
                      }}
                    >
                      <p style={{ margin: '0 0 0.4rem', fontWeight: 600, color: 'var(--text-amber-800)', fontSize: '0.8125rem' }}>
                        Permanently deleted with the job
                      </p>
                      <ul style={{ margin: '0 0 0.4rem', paddingLeft: '1.1rem', fontSize: '0.8125rem', color: 'var(--text-700)' }}>
                        <li>
                          Job total (revenue): <strong>${formatCurrency(Number(migrateBidDryRun.revenue_dropped ?? 0))}</strong>
                        </li>
                        {dryRunDropped.map(([k, n]) => (
                          <li key={k}>
                            {prettyCountKey(k)}: <strong>{String(n)}</strong>
                          </li>
                        ))}
                      </ul>
                      <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                        These have no place on a bid. A dev can restore the whole job for 90 days from
                        Settings → Data &amp; migration → Recently deleted, but anything moved to the bid stays there.
                      </p>
                    </div>
                  </>
                )}
              </div>
            ) : (
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
            )}
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
                disabled={confirmDisabled}
                onClick={() => {
                  if (!editing?.id) return
                  if (targetingBid) {
                    if (!migrateTargetBidId) return
                    void migrateJobLedgerCostsToBidAndDelete(editing.id, migrateTargetBidId)
                    return
                  }
                  if (!migrateTargetJobId) return
                  void migrateJobLedgerCostsAndDelete(editing.id, migrateTargetJobId)
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background: confirmDisabled ? '#9ca3af' : '#b91c1c',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: confirmDisabled ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                {migratingJob ? 'Working…' : targetingBid ? 'Confirm move to bid and delete' : 'Confirm migrate and delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
