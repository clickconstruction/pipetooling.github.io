import { useEffect, useState, type CSSProperties } from 'react'
import type { UserRole } from '../../hooks/useAuth'
import type { ScopeMasterChoice } from '../../hooks/useRecurringReportScopeMasters'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import { describeScheduleWhen } from '../../lib/reports/digestScheduleFields'
import type { EmailReportPerson } from '../../lib/reports/emailReportPeople'
import { useEmailReportsData, type ScheduleRow } from './emailReports/useEmailReportsData'
import { EmailReportPersonEditor } from './emailReports/EmailReportPersonEditor'
import { DigestScheduleEditor } from './emailReports/DigestScheduleEditor'
import { DigestPreviewToolbar } from './emailReports/DigestPreviewToolbar'

const chipBase: CSSProperties = { display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap', marginRight: 4, marginBottom: 3 }
const digestChip: CSSProperties = { ...chipBase, background: 'var(--bg-blue-tint)', color: 'var(--text-link)' }
const everyChip: CSSProperties = { ...chipBase, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-700)' }
const dash = <span style={{ color: 'var(--text-faint)' }}>—</span>
const smallBtn: CSSProperties = { padding: '0.3rem 0.6rem', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: '0.8125rem' }
const linkBtn: CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem' }

type View = { kind: 'list' } | { kind: 'person'; person: EmailReportPerson | null } | { kind: 'schedule'; schedule: ScheduleRow | null }

/**
 * Email reports — one list, by person (v2.3595, "Email reports, one modal" Option B; the
 * two-tab shell of v2.3570 is gone). One row per person who gets report email: a Digest chip
 * per schedule they are on (their own slice: scope · filter · costs) and an Every-report chip
 * (whose reports), Edit opens both settings for that person, *+ Add person* starts a row. The
 * schedules themselves — name, days, time — are a line under the table (names open the
 * schedule editor; New… makes one); the preview / test-send sandbox folds under it. The
 * Dashboard's Recent Reports mail button opens the same list.
 */
export function EmailReportsModal({
  open,
  onClose,
  authUserId,
  authRole,
  scopeMasterChoices,
}: {
  open: boolean
  onClose: () => void
  authUserId: string | undefined
  authRole: UserRole | null
  scopeMasterChoices: readonly ScopeMasterChoice[]
}) {
  const [view, setView] = useState<View>({ kind: 'list' })
  useEffect(() => {
    if (open) setView({ kind: 'list' })
  }, [open])
  if (!open) return null
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-reports-heading"
        style={{ background: 'var(--surface)', borderRadius: 10, maxWidth: 900, width: '100%', maxHeight: '92vh', overflow: 'auto', padding: '1.25rem 1.5rem', boxShadow: '0 22px 50px rgba(0,0,0,.2)' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <h2 id="email-reports-heading" style={{ margin: 0, fontSize: '1.25rem' }}>Email reports</h2>
          <button type="button" onClick={onClose} style={{ flexShrink: 0, background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: '0.35rem 0.6rem' }}>
            Close
          </button>
        </div>
        <p style={{ margin: '0.5rem 0 0.9rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          One row per person. A <strong>digest</strong> bundles a window of job activity on a schedule; <strong>every report</strong> sends each report the moment it&rsquo;s filed. Edit a row to change either.
        </p>
        <EmailReportsBody view={view} setView={setView} authUserId={authUserId} authRole={authRole} scopeMasterChoices={scopeMasterChoices} />
      </div>
    </div>
  )
}

function EmailReportsBody({
  view,
  setView,
  authUserId,
  authRole,
  scopeMasterChoices,
}: {
  view: View
  setView: (v: View) => void
  authUserId: string | undefined
  authRole: UserRole | null
  scopeMasterChoices: readonly ScopeMasterChoice[]
}) {
  const data = useEmailReportsData(authUserId)
  const canConfigure = authRole === 'dev' || authRole === 'master_technician' || isAssistantLike(authRole)
  if (!canConfigure) return <p style={{ color: 'var(--text-muted)' }}>Only dev, leader, or assistant can configure report email.</p>
  if (data.error) return <p style={{ color: 'var(--text-red-700)' }}>{data.error}</p>

  const back = async () => {
    await data.reload()
    setView({ kind: 'list' })
  }

  if (view.kind === 'person') {
    return (
      <EmailReportPersonEditor
        person={view.person}
        roster={data.roster}
        schedules={data.schedules}
        subscriptions={data.subscriptions}
        teamLeads={data.teamLeads}
        people={data.people}
        authUserId={authUserId}
        onDone={back}
        onCancel={() => setView({ kind: 'list' })}
      />
    )
  }
  if (view.kind === 'schedule') {
    return <DigestScheduleEditor schedule={view.schedule} scopeMasterId={scopeMasterChoices[0]?.id ?? null} authUserId={authUserId} onDone={back} onCancel={() => setView({ kind: 'list' })} />
  }

  return (
    <div data-testid="email-reports-list">
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <span style={digestChip}>Digest</span>
        <span style={everyChip}>Every report</span>
      </div>
      {data.loading && data.people.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : data.people.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nobody gets report email yet. Add a person below.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <th style={{ padding: '6px 6px 6px 0', fontWeight: 600 }}>Person</th>
              <th style={{ padding: 6, fontWeight: 600 }}>Digest</th>
              <th style={{ padding: 6, fontWeight: 600 }}>Every report</th>
              <th style={{ padding: 6 }} />
            </tr>
          </thead>
          <tbody>
            {data.people.map((p) => (
              <tr key={p.key} data-testid="email-report-person-row" style={{ borderTop: '1px solid var(--border)', verticalAlign: 'top' }}>
                <td style={{ padding: '8px 6px 8px 0' }}>
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.outside ? `outside address · ${p.email}` : p.email}</div>
                </td>
                <td style={{ padding: 8 }} title={p.outside ? 'Digests go to app users only' : undefined}>
                  {p.digests.length === 0 ? dash : p.digests.map((d) => (
                    <span key={d.rowId} style={digestChip}>{d.scheduleName} · {d.text}</span>
                  ))}
                </td>
                <td style={{ padding: 8 }}>{p.everyReport ? <span style={everyChip}>{p.everyReport.text}</span> : dash}</td>
                <td style={{ padding: 8, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button type="button" onClick={() => setView({ kind: 'person', person: p })} style={smallBtn} aria-label={`Edit ${p.name}`}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button type="button" onClick={() => setView({ kind: 'person', person: null })} style={{ marginTop: '0.6rem', padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 600, border: '1px dashed var(--border-strong)', borderRadius: 6, background: 'none', color: 'var(--text-link)', cursor: 'pointer', width: '100%' }}>
        + Add person
      </button>

      <p data-testid="email-reports-schedules" style={{ margin: '0.9rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        <strong style={{ color: 'var(--text-700)' }}>Schedules:</strong>{' '}
        {data.schedules.length === 0 ? <span>none yet · </span> : null}
        {data.schedules.map((s, i) => (
          <span key={s.id}>
            {i > 0 ? ' · ' : ''}
            <button type="button" onClick={() => setView({ kind: 'schedule', schedule: s })} style={linkBtn} title={`${describeScheduleWhen(s)}${s.enabled ? '' : ' · off'}`}>
              {s.name}
            </button>
            <span> {describeScheduleWhen(s)}{s.enabled ? '' : ' · off'}</span>
          </span>
        ))}
        {data.schedules.length > 0 ? ' · ' : ''}
        <button type="button" onClick={() => setView({ kind: 'schedule', schedule: null })} style={linkBtn} disabled={scopeMasterChoices.length === 0}>New…</button>
      </p>

      <details style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
        <summary style={{ cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-700)' }}>Preview or send a test</summary>
        <div style={{ marginTop: 10 }}>
          {scopeMasterChoices.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Could not resolve a scope leader account.</p>
          ) : (
            <DigestPreviewToolbar scopeMasterChoices={scopeMasterChoices} roster={data.roster} authUserId={authUserId} />
          )}
        </div>
      </details>
    </div>
  )
}
