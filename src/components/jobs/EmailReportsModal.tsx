import { useEffect, useState } from 'react'
import type { UserRole } from '../../hooks/useAuth'
import type { ScopeMasterChoice } from '../../hooks/useRecurringReportScopeMasters'
import { RecurringDigestsPanel } from './RecurringDigestsPanel'
import { ReportEmailRecipientsPanel } from '../dashboard/ReportEmailRecipientsPanel'

export type EmailReportsTab = 'digests' | 'every'

const TABS: ReadonlyArray<{ key: EmailReportsTab; label: string; sub: string }> = [
  { key: 'digests', label: 'Digests', sub: 'a bundle on a schedule' },
  { key: 'every', label: 'Every report', sub: 'one email per report, as filed' },
]

/**
 * Email reports — the one door to both report-email streams (v2.3570, "Email reports, one
 * modal", PR 1 / Option A). Jobs → Reports' two toolbar buttons (*Recurring Email Reports*,
 * *Report email recipients*) became this one modal: a one-sentence intro naming the two kinds,
 * then two tabs holding the two bodies unchanged — `RecurringDigestsPanel` and
 * `ReportEmailRecipientsPanel`. The Dashboard's Recent Reports mail button opens it on
 * *Every report* (`initialTab`). Only the tab that shows is mounted, so each panel loads
 * exactly as its modal did.
 */
export function EmailReportsModal({
  open,
  onClose,
  initialTab = 'digests',
  authUserId,
  authRole,
  scopeMasterChoices,
}: {
  open: boolean
  onClose: () => void
  initialTab?: EmailReportsTab
  authUserId: string | undefined
  authRole: UserRole | null
  scopeMasterChoices: readonly ScopeMasterChoice[]
}) {
  const [tab, setTab] = useState<EmailReportsTab>(initialTab)
  // Each opening lands on the door's tab (the Dashboard asks for Every report; Reports for Digests).
  useEffect(() => {
    if (open) setTab(initialTab)
  }, [open, initialTab])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        overflowY: 'auto',
      }}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-reports-heading"
        style={{
          background: 'var(--surface)',
          borderRadius: 10,
          maxWidth: 900,
          width: '100%',
          maxHeight: '92vh',
          overflow: 'auto',
          padding: '1.25rem 1.5rem',
          boxShadow: '0 22px 50px rgba(0,0,0,.2)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <h2 id="email-reports-heading" style={{ margin: 0, fontSize: '1.25rem' }}>
            Email reports
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              flexShrink: 0,
              background: 'var(--bg-muted)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              cursor: 'pointer',
              padding: '0.35rem 0.6rem',
            }}
          >
            Close
          </button>
        </div>
        <p style={{ margin: '0.5rem 0 0.9rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Who gets report email, and what. A <strong>digest</strong> bundles a window of job activity on a schedule;{' '}
          <strong>every report</strong> sends each report the moment it&rsquo;s filed.
        </p>
        <div role="tablist" aria-label="Kind of report email" style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
          {TABS.map((t) => {
            const on = tab === t.key
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(t.key)}
                style={{
                  font: 'inherit',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 2,
                  padding: '0.5rem 0.9rem',
                  background: 'none',
                  border: 'none',
                  borderBottom: on ? '2px solid var(--text-link)' : '2px solid transparent',
                  marginBottom: -1,
                  cursor: 'pointer',
                  color: on ? 'var(--text-strong)' : 'var(--text-muted)',
                }}
              >
                <span style={{ fontWeight: 600 }}>{t.label}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.sub}</span>
              </button>
            )
          })}
        </div>
        {tab === 'digests' ? (
          <RecurringDigestsPanel authUserId={authUserId} authRole={authRole} scopeMasterChoices={scopeMasterChoices} />
        ) : (
          <ReportEmailRecipientsPanel authUserId={authUserId} />
        )}
      </div>
    </div>
  )
}
