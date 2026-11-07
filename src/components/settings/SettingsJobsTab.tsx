/** Settings → Jobs, bills and liens, the dev's cards whose state lives in the page (punch list #261): the company owner
 * account with its re-assign table and confirm window, and the default labor rate. `settingsJobsDevCards` hands
 * each back by its slug for `SettingsJobsBillingGroups` to place under its heading, and the confirm window apart,
 * since it is drawn over the page. The self-contained dev cards (the rate card, the trip charges, the law firms…)
 * the page builds itself. State and handlers stay in `Settings.tsx` (`useSettingsJobsAdmin`) and arrive as props. */
import type { Dispatch, FormEvent, ReactNode, SetStateAction } from 'react'
import type { JobsBillingCardElements } from './SettingsJobsBillingGroups'

type JobsTabUserRow = { id: string; name: string; email: string; role: string }

export interface SettingsJobsDevCardsProps {
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
  saveDefaultLaborRate: (e: FormEvent) => void
  defaultLaborRate: string
  setDefaultLaborRate: Dispatch<SetStateAction<string>>
  defaultLaborRateSaving: boolean
}

const OFFICE_ROLES = ['dev', 'master_technician', 'assistant', 'controller']

export function CompanyOwnerAccountCard(p: SettingsJobsDevCardsProps) {
  return (
    <div style={{ padding: '1rem' }}>
      <p style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        One company: every new customer, project, job, estimate and prospect is filed under this one account,
        whoever creates it. Nobody picks an owner any more, and it decides nothing about who can see a row.
      </p>
      <form onSubmit={p.saveJobOwnerOverrides}>
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
          <label htmlFor="company-owner-account" style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: 4 }}>
            Company owner account
          </label>
          <select
            id="company-owner-account"
            value={p.companyOwnerUserId}
            onChange={(e) => p.setCompanyOwnerUserId(e.target.value)}
            disabled={p.jobOwnerOverridesSaving}
            style={{ padding: '0.25rem 0.5rem', minWidth: 220 }}
          >
            <option value="">Not set — the single leader account, else the creator</option>
            {p.users
              .filter((o) => o.role === 'master_technician' || o.role === 'dev')
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name || o.email}
                </option>
              ))}
          </select>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            A settings row, not a person&rsquo;s choice: change it here when the account that files company rows changes.
            Existing rows keep the account they were filed under.
          </p>
        </div>
        <button type="submit" disabled={p.jobOwnerOverridesSaving} style={{ marginBottom: '1rem', padding: '0.5rem 1rem' }}>
          {p.jobOwnerOverridesSaving ? 'Saving…' : 'Save company owner account'}
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
            {p.users
              .filter((u) => OFFICE_ROLES.includes(u.role))
              .map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    {u.name || u.email}
                    {u.id === p.companyOwnerUserId ? (
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>company owner</span>
                    ) : null}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>{p.jobCountByUserId[u.id] ?? 0}</td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <select
                        value={p.reassignTargetByUserId[u.id] ?? ''}
                        onChange={(e) =>
                          p.setReassignTargetByUserId((prev) => ({
                            ...prev,
                            [u.id]: e.target.value,
                          }))
                        }
                        disabled={p.reassignSubmitting || (p.jobCountByUserId[u.id] ?? 0) === 0}
                        style={{ padding: '0.25rem 0.5rem', minWidth: 140 }}
                      >
                        <option value="">—</option>
                        {p.users
                          .filter((o) => OFFICE_ROLES.includes(o.role) && o.id !== u.id)
                          .map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name || o.email}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          const target = p.reassignTargetByUserId[u.id]
                          if (target) {
                            p.setReassignSourceUserId(u.id)
                            p.setReassignTargetUserId(target)
                            p.setReassignConfirmOpen(true)
                          }
                        }}
                        disabled={p.reassignSubmitting || (p.jobCountByUserId[u.id] ?? 0) === 0 || !p.reassignTargetByUserId[u.id]}
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
  )
}

/** The confirm window over the page, drawn apart from the card since it covers everything. */
export function ReassignJobsConfirm(p: SettingsJobsDevCardsProps) {
  if (!p.reassignConfirmOpen || !p.reassignSourceUserId || !p.reassignTargetUserId) return null
  const source = p.reassignSourceUserId
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, paddingTop: 'var(--app-top-chrome, 0px)' }}>
      <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 480 }}>
        <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>Re-assign jobs</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>
          Re-assign {p.jobCountByUserId[source] ?? 0} jobs from {p.users.find((u) => u.id === source)?.name || 'Unknown'} to{' '}
          {p.users.find((u) => u.id === p.reassignTargetUserId)?.name || 'Unknown'}? This cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => {
              p.setReassignConfirmOpen(false)
              p.setReassignSourceUserId(null)
              p.setReassignTargetUserId(null)
            }}
            disabled={p.reassignSubmitting}
            style={{ padding: '0.5rem 1rem' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={p.confirmReassignJobs}
            disabled={p.reassignSubmitting}
            style={{ padding: '0.5rem 1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: p.reassignSubmitting ? 'not-allowed' : 'pointer' }}
          >
            {p.reassignSubmitting ? 'Re-assigning…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function DefaultLaborRateCard(p: SettingsJobsDevCardsProps) {
  return (
    <div style={{ padding: '1rem' }}>
      <p style={{ marginBottom: '1rem', marginTop: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        Set the default Labor rate ($/hr) used when adding a new labor job in Jobs → + Labor. Leave blank for no default.
      </p>
      <form onSubmit={p.saveDefaultLaborRate} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <label htmlFor="default-labor-rate" style={{ fontWeight: 500 }}>
          Labor rate ($/hr)
        </label>
        <input
          id="default-labor-rate"
          type="number"
          min={0}
          step={0.01}
          value={p.defaultLaborRate}
          onChange={(e) => p.setDefaultLaborRate(e.target.value)}
          placeholder="e.g. 75"
          style={{ width: 120, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
        />
        <button
          type="submit"
          disabled={p.defaultLaborRateSaving}
          style={{ padding: '0.5rem 1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: p.defaultLaborRateSaving ? 'not-allowed' : 'pointer', fontWeight: 500 }}
        >
          {p.defaultLaborRateSaving ? 'Saving…' : 'Save'}
        </button>
      </form>
    </div>
  )
}

/** The page-owned dev cards by slug, and the confirm window apart. */
export function settingsJobsDevCards(p: SettingsJobsDevCardsProps): { cards: JobsBillingCardElements; modal: ReactNode } {
  return {
    cards: {
      'company-owner': <CompanyOwnerAccountCard {...p} />,
      'labor-rate': <DefaultLaborRateCard {...p} />,
    },
    modal: <ReassignJobsConfirm {...p} />,
  }
}
