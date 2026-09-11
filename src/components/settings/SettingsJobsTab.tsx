/** Settings → Jobs & dispatch tab: dev-only job-creation owner overrides (+ re-assign), default labor
 * rate, and Turnaway trip charge amounts.
 * Presentational; all state/handlers live in the parent (Settings.tsx) and arrive as props
 * (except the self-contained TripChargeAmountsSettingsBlock).
 * The SettingsGroup wrapper and the `myRole === 'dev'` gate stay in the parent. */
import type { Dispatch, FormEvent, SetStateAction } from 'react'
import TripChargeAmountsSettingsBlock from './TripChargeAmountsSettingsBlock'
import HideHcpFieldSettingsBlock from './HideHcpFieldSettingsBlock'
import SubPortalPaySettingsBlock from './SubPortalPaySettingsBlock'
import LegalFirmSettingsBlock from './LegalFirmSettingsBlock'
import JobAddressCityListSettingsBlock from './JobAddressCityListSettingsBlock'
import TxCountyMapSettingsBlock from './TxCountyMapSettingsBlock'
import DevelopmentsSettingsBlock from './DevelopmentsSettingsBlock'

type JobsTabUserRow = { id: string; name: string; email: string; role: string }

export default function SettingsJobsTab({
  jobOwnerOverridesSectionOpen,
  setJobOwnerOverridesSectionOpen,
  saveJobOwnerOverrides,
  users,
  companyOwnerUserId,
  setCompanyOwnerUserId,
  jobOwnerOverridesSaving,
  jobCountByUserId,
  reassignTargetByUserId,
  setReassignTargetByUserId,
  reassignSubmitting,
  setReassignSourceUserId,
  setReassignTargetUserId,
  setReassignConfirmOpen,
  reassignConfirmOpen,
  reassignSourceUserId,
  reassignTargetUserId,
  confirmReassignJobs,
  defaultLaborRateSectionOpen,
  setDefaultLaborRateSectionOpen,
  saveDefaultLaborRate,
  defaultLaborRate,
  setDefaultLaborRate,
  defaultLaborRateSaving,
}: {
  jobOwnerOverridesSectionOpen: boolean
  setJobOwnerOverridesSectionOpen: Dispatch<SetStateAction<boolean>>
  saveJobOwnerOverrides: (e: FormEvent) => void
  users: JobsTabUserRow[]
  companyOwnerUserId: string
  setCompanyOwnerUserId: Dispatch<SetStateAction<string>>
  jobOwnerOverridesSaving: boolean
  jobCountByUserId: Record<string, number>
  reassignTargetByUserId: Record<string, string>
  setReassignTargetByUserId: Dispatch<SetStateAction<Record<string, string>>>
  reassignSubmitting: boolean
  setReassignSourceUserId: Dispatch<SetStateAction<string | null>>
  setReassignTargetUserId: Dispatch<SetStateAction<string | null>>
  setReassignConfirmOpen: Dispatch<SetStateAction<boolean>>
  reassignConfirmOpen: boolean
  reassignSourceUserId: string | null
  reassignTargetUserId: string | null
  confirmReassignJobs: () => void
  defaultLaborRateSectionOpen: boolean
  setDefaultLaborRateSectionOpen: Dispatch<SetStateAction<boolean>>
  saveDefaultLaborRate: (e: FormEvent) => void
  defaultLaborRate: string
  setDefaultLaborRate: Dispatch<SetStateAction<string>>
  defaultLaborRateSaving: boolean
}) {
  return (
    <>
      <HideHcpFieldSettingsBlock />
      <SubPortalPaySettingsBlock />
      <LegalFirmSettingsBlock />
      {/* Company owner account (one company, v2.2972) + bulk job re-assign */}
      <div style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8 }}>
        <button
          type="button"
          onClick={() => setJobOwnerOverridesSectionOpen((prev) => !prev)}
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
          <span style={{ fontSize: '0.75rem' }}>{jobOwnerOverridesSectionOpen ? '▼' : '▶'}</span>
          Company owner account
        </button>
        {jobOwnerOverridesSectionOpen && (
          <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
            <p style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              One company: every new customer, project, job, estimate and prospect is filed under this one account,
              whoever creates it. Nobody picks an owner any more, and it decides nothing about who can see a row.
            </p>
            <form onSubmit={saveJobOwnerOverrides}>
              <div
                style={{
                  marginBottom: '1rem',
                  padding: '0.75rem',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  background: 'var(--bg-subtle)',
                  maxWidth: 640,
                }}
              >
                <label
                  htmlFor="company-owner-account"
                  style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: 4 }}
                >
                  Company owner account
                </label>
                <select
                  id="company-owner-account"
                  value={companyOwnerUserId}
                  onChange={(e) => setCompanyOwnerUserId(e.target.value)}
                  disabled={jobOwnerOverridesSaving}
                  style={{ padding: '0.25rem 0.5rem', minWidth: 220 }}
                >
                  <option value="">Not set — the single leader account, else the creator</option>
                  {users
                    .filter((o) => o.role === 'master_technician' || o.role === 'dev')
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name || o.email}
                      </option>
                    ))}
                </select>
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  A settings row, not a person&rsquo;s choice: change it here when the account that files company
                  rows changes. Existing rows keep the account they were filed under.
                </p>
              </div>
              <button
                type="submit"
                disabled={jobOwnerOverridesSaving}
                style={{ marginBottom: '1rem', padding: '0.5rem 1rem' }}
              >
                {jobOwnerOverridesSaving ? 'Saving…' : 'Save company owner account'}
              </button>
            </form>
            <p style={{ margin: '0 0 0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>Jobs filed under each account</p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', maxWidth: 640 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Account</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Jobs</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Re-assign all to</th>
                  </tr>
                </thead>
                <tbody>
                  {users
                    .filter((u) => ['dev', 'master_technician', 'assistant', 'controller'].includes(u.role))
                    .map((u) => (
                      <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          {u.name || u.email}
                          {u.id === companyOwnerUserId ? (
                            <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>company owner</span>
                          ) : null}
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>{jobCountByUserId[u.id] ?? 0}</td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <select
                              value={reassignTargetByUserId[u.id] ?? ''}
                              onChange={(e) =>
                                setReassignTargetByUserId((prev) => ({
                                  ...prev,
                                  [u.id]: e.target.value,
                                }))
                              }
                              disabled={reassignSubmitting || (jobCountByUserId[u.id] ?? 0) === 0}
                              style={{ padding: '0.25rem 0.5rem', minWidth: 140 }}
                            >
                              <option value="">—</option>
                              {users
                                .filter((o) => ['dev', 'master_technician', 'assistant', 'controller'].includes(o.role) && o.id !== u.id)
                                .map((o) => (
                                  <option key={o.id} value={o.id}>
                                    {o.name || o.email}
                                  </option>
                                ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                const target = reassignTargetByUserId[u.id]
                                if (target) {
                                  setReassignSourceUserId(u.id)
                                  setReassignTargetUserId(target)
                                  setReassignConfirmOpen(true)
                                }
                              }}
                              disabled={
                                reassignSubmitting ||
                                (jobCountByUserId[u.id] ?? 0) === 0 ||
                                !reassignTargetByUserId[u.id]
                              }
                              style={{ padding: '0.25rem 0.5rem', whiteSpace: 'nowrap' }}
                            >
                              Re-assign
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {reassignConfirmOpen && reassignSourceUserId && reassignTargetUserId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 480 }}>
            <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>Re-assign jobs</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>
              Re-assign {jobCountByUserId[reassignSourceUserId] ?? 0} jobs from {users.find((u) => u.id === reassignSourceUserId)?.name || 'Unknown'} to {users.find((u) => u.id === reassignTargetUserId)?.name || 'Unknown'}? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setReassignConfirmOpen(false)
                  setReassignSourceUserId(null)
                  setReassignTargetUserId(null)
                }}
                disabled={reassignSubmitting}
                style={{ padding: '0.5rem 1rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmReassignJobs}
                disabled={reassignSubmitting}
                style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: reassignSubmitting ? 'not-allowed' : 'pointer' }}
              >
                {reassignSubmitting ? 'Re-assigning…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8 }}>
        <button
          type="button"
          aria-expanded={defaultLaborRateSectionOpen}
          onClick={() => setDefaultLaborRateSectionOpen((prev) => !prev)}
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
          <span style={{ fontSize: '0.75rem' }}>{defaultLaborRateSectionOpen ? '▼' : '▶'}</span>
          Default Labor Rate (dev)
        </button>
        {defaultLaborRateSectionOpen && (
          <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
            <p style={{ marginBottom: '1rem', marginTop: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Set the default Labor rate ($/hr) used when adding a new labor job in Jobs → + Labor. Leave blank for no default.
            </p>
            <form onSubmit={saveDefaultLaborRate} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <label htmlFor="default-labor-rate" style={{ fontWeight: 500 }}>Labor rate ($/hr)</label>
              <input
                id="default-labor-rate"
                type="number"
                min={0}
                step={0.01}
                value={defaultLaborRate}
                onChange={(e) => setDefaultLaborRate(e.target.value)}
                placeholder="e.g. 75"
                style={{ width: 120, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
              />
              <button
                type="submit"
                disabled={defaultLaborRateSaving}
                style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: defaultLaborRateSaving ? 'not-allowed' : 'pointer', fontWeight: 500 }}
              >
                {defaultLaborRateSaving ? 'Saving…' : 'Save'}
              </button>
            </form>
          </div>
        )}
      </div>

      <TripChargeAmountsSettingsBlock />

      <JobAddressCityListSettingsBlock />
      <TxCountyMapSettingsBlock />
      <DevelopmentsSettingsBlock />
    </>
  )
}
