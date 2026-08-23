import { useState } from 'react'
import type { GcReviewGroup, GcReviewRow } from '../../lib/gcReviewRollup'
import { buildGcCertSnapshot } from '../../lib/jobs/gcReviewCertification'
import { insertGcReviewCertification } from '../../lib/gcReviewCertifications'
import { fetchJobActivityEventsForJobLedger } from '../../lib/fetchJobActivityEventsForJobLedger'
import type { JobActivityEventRpcRow } from '../../lib/jobActivityEventsFromRpc'
import { formatCurrency } from '../../lib/jobs/jobFormMoney'

/**
 * Wednesday GC certification checklist (v2.1983, from the owner's mockup):
 * every row in the GC's group is checked off one by one before the group can
 * be certified. Each row's chevron drops down the job's recent activity
 * inline (list_job_activity_events, newest first), and the job link opens
 * Job Detail ON TOP (the Detail modal's overlay outranks this one) — the
 * checklist keeps its check state while the certifier digs in and comes back.
 * Certify / Draft Message unlock only when every row is checked (v2.2131:
 * "Certify & send…" renamed — it certifies, then opens the statement email
 * dialog as a draft; nothing sends until the user clicks Send statement).
 */
export default function GcReviewCertifyModal({
  group,
  weekStartYmd,
  authUserId,
  authUserName,
  onClose,
  onCertified,
  onOpenJobDetail,
}: {
  group: GcReviewGroup
  weekStartYmd: string
  authUserId: string
  authUserName: string
  onClose: () => void
  /** Insert succeeded — shell reloads certs; andSend chains into the Email dialog. */
  onCertified: (opts: { andSend: boolean }) => void
  onOpenJobDetail?: (jobId: string) => void
}) {
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set())
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [activityByJob, setActivityByJob] = useState<Record<string, { loading: boolean; rows: JobActivityEventRpcRow[] }>>({})
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allChecked = group.rows.length > 0 && checked.size === group.rows.length
  const weekLabel = new Date(`${weekStartYmd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  function toggleRow(key: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleActivity(row: GcReviewRow) {
    const opening = expandedKey !== row.key
    setExpandedKey(opening ? row.key : null)
    if (opening && !activityByJob[row.jobId]) {
      setActivityByJob((prev) => ({ ...prev, [row.jobId]: { loading: true, rows: [] } }))
      void fetchJobActivityEventsForJobLedger(row.jobId).then(({ data }) => {
        // Oldest-first from the RPC — the dropdown shows the latest few, newest first.
        setActivityByJob((prev) => ({ ...prev, [row.jobId]: { loading: false, rows: data.slice(-4).reverse() } }))
      })
    }
  }

  async function certify(andSend: boolean) {
    if (!group.gcId || saving || !allChecked) return
    setSaving(true)
    setError(null)
    try {
      await insertGcReviewCertification({
        week_start: weekStartYmd,
        gc_customer_id: group.gcId,
        certified_by: authUserId,
        certified_by_name: authUserName,
        job_count: group.jobCount,
        total: group.subtotal,
        snapshot: buildGcCertSnapshot(group),
        note: note.trim(),
      })
      onCertified({ andSend })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the certification.')
      setSaving(false)
    }
  }

  const eventStamp = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
        ' ' +
        new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : ''

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Certify ${group.gcName}`}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70 }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose()
      }}
    >
      <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '1.4rem', width: 'min(620px, calc(100vw - 2rem))', maxHeight: '85vh', overflow: 'auto', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Certify {group.gcName}</h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Week of Mon, {weekLabel}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span aria-hidden style={{ flex: 1, display: 'flex', height: 7, borderRadius: 4, overflow: 'hidden', background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
            <span style={{ width: `${group.rows.length ? Math.round((checked.size / group.rows.length) * 100) : 0}%`, background: 'var(--text-green-600)' }} />
          </span>
          <span style={{ fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            <strong>
              {checked.size} of {group.rows.length}
            </strong>{' '}
            reviewed · ${formatCurrency(group.subtotal)}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Check off each bill as you confirm it belongs to this GC and the amount is right. Open the activity or the job itself if anything looks off.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {group.rows.map((r) => {
            const isChecked = checked.has(r.key)
            const isExpanded = expandedKey === r.key
            const activity = activityByJob[r.jobId]
            return (
              <div key={r.key} style={{ border: `1px solid ${isExpanded ? 'var(--border-strong)' : 'var(--border)'}`, borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.45rem 0.6rem', background: 'var(--bg-subtle)' }}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleRow(r.key)}
                    aria-label={`Reviewed ${r.hcp} ${r.jobName}`}
                    style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
                  />
                  {onOpenJobDetail ? (
                    <button
                      type="button"
                      onClick={() => onOpenJobDetail(r.jobId)}
                      title="Open Job Detail on top — the checklist keeps your progress"
                      style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', font: 'inherit', fontWeight: 600, color: 'var(--text-blue-700)', textDecoration: 'underline', textUnderlineOffset: '2px', whiteSpace: 'nowrap' }}
                    >
                      {r.hcp} · {r.jobName || '—'}
                    </button>
                  ) : (
                    <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {r.hcp} · {r.jobName || '—'}
                    </span>
                  )}
                  <span style={{ fontSize: '0.72rem', color: r.ageDays != null && r.ageDays >= 90 ? 'var(--text-red-600)' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.ageDays != null ? `billed ${r.referenceDateDisplay} · ${r.ageDays}d` : 'no bill-out date'}
                  </span>
                  <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', fontSize: '0.8125rem', fontWeight: isChecked ? 400 : 600, whiteSpace: 'nowrap' }}>
                    ${formatCurrency(r.remaining)}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleActivity(r)}
                    aria-expanded={isExpanded}
                    aria-label={`Recent activity for ${r.hcp}`}
                    title="Recent activity"
                    style={{ padding: '0.1rem 0.3rem', border: 'none', background: 'none', cursor: 'pointer', color: isExpanded ? 'var(--text-link)' : 'var(--text-muted)', flexShrink: 0 }}
                  >
                    {isExpanded ? '▴' : '▾'}
                  </button>
                </div>
                {isExpanded && (
                  <div style={{ padding: '0.45rem 0.6rem 0.55rem 2.3rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {!activity || activity.loading ? (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Loading activity…</span>
                    ) : activity.rows.length === 0 ? (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>No activity recorded on this job yet.</span>
                    ) : (
                      activity.rows.map((ev) => (
                        <div key={ev.id} style={{ fontSize: '0.72rem', lineHeight: 1.45 }}>
                          <span style={{ color: 'var(--text-faint)' }}>{eventStamp(ev.occurred_at)}</span>{' '}
                          <strong style={{ color: 'var(--text-700)' }}>{ev.actor_name || '—'}</strong>{' '}
                          <span style={{ color: 'var(--text-muted)' }}>{ev.summary || ev.event_type}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label htmlFor="gc-cert-note" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Note (optional)
          </label>
          <input
            id="gc-cert-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything the next certifier should know"
            style={{ padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--bg-page)', color: 'inherit', font: 'inherit', fontSize: '0.8125rem' }}
          />
        </div>

        {error && <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-red-600)' }}>{error}</p>}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {allChecked ? 'All bills reviewed — ready to certify.' : `Check off all ${group.rows.length} bills to certify`}
          </span>
          <span style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="button" onClick={() => void certify(false)} disabled={!allChecked || saving} style={{ fontWeight: 600, opacity: allChecked ? 1 : 0.5 }}>
              {saving ? 'Saving…' : 'Certify'}
            </button>
            <button
              type="button"
              onClick={() => void certify(true)}
              disabled={!allChecked || saving}
              style={{
                fontWeight: 700,
                border: 'none',
                background: allChecked ? '#2563eb' : 'var(--bg-muted)',
                color: allChecked ? '#ffffff' : 'var(--text-faint)',
              }}
            >
              Draft Message
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}
