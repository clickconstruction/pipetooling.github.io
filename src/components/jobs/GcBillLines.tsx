import { useState, type ReactNode } from 'react'
import type { GcReviewRow } from '../../lib/gcReviewRollup'
import { fetchJobActivityEventsForJobLedger } from '../../lib/fetchJobActivityEventsForJobLedger'
import type { JobActivityEventRpcRow } from '../../lib/jobActivityEventsFromRpc'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { formatCurrency } from '../../lib/jobs/jobFormMoney'

export type GcBillLine = GcReviewRow & { promisedYmd?: string | null }

type Props = {
  rows: ReadonlyArray<GcBillLine>
  /** The job link opens Job Detail on top; the window underneath keeps what was typed or ticked. */
  onOpenJobDetail?: (jobId: string) => void
  /** Something ahead of the job — the certify checklist's tick box. */
  leading?: (row: GcBillLine) => ReactNode
  /** Rows still to deal with read heavier. Default: every row. */
  pending?: (row: GcBillLine) => boolean
  /** Who was billed, after the job. */
  showCustomer?: boolean
  /** Many lines under something else (the call sheet): smaller type, the job and the customer give way so the age and the amount always show. */
  compact?: boolean
  /** Today in the company calendar — a promised date before it reads late. Omitted, no promise is shown. */
  todayYmd?: string
}

const eventStamp = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''

/**
 * A GC's bills as lines to dig into (the certify checklist, the call sheet):
 * the job, when it was billed and how long ago (red at 90 days), what is
 * still owed, and under the line what paid the bill (v2.4044). The job link opens Job Detail on top; the chevron drops the
 * job's recent activity under the line (list_job_activity_events, the latest
 * four, newest first) — read once per job and kept while the list is open.
 */
export default function GcBillLines({ rows, onOpenJobDetail, leading, pending, showCustomer, compact, todayYmd }: Props) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [activityByJob, setActivityByJob] = useState<Record<string, { loading: boolean; rows: JobActivityEventRpcRow[] }>>({})

  function toggleActivity(row: GcBillLine) {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? '0.2rem' : '0.35rem', fontSize: compact ? '0.8125rem' : undefined }}>
      {rows.map((r) => {
        const old = r.ageDays != null && r.ageDays >= 90
        const isExpanded = expandedKey === r.key
        const activity = activityByJob[r.jobId]
        const heavy = pending ? pending(r) : true
        const promised = todayYmd && r.promisedYmd ? { label: formatYmdMonthDay(r.promisedYmd), late: r.promisedYmd < todayYmd } : null
        return (
          <div key={r.key} data-testid="gc-bill-line" style={{ border: `1px solid ${isExpanded ? 'var(--border-strong)' : 'var(--border)'}`, borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: compact ? '0.25rem 0.6rem' : '0.45rem 0.6rem', background: 'var(--bg-subtle)' }}>
              {leading?.(r)}
              {onOpenJobDetail ? (
                <button
                  type="button"
                  onClick={() => onOpenJobDetail(r.jobId)}
                  title={`${r.jobAddress ? `${r.jobAddress}\n` : ''}Open Job Detail on top — this window keeps your progress`}
                  style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', font: 'inherit', fontWeight: 600, color: 'var(--text-blue-700)', textDecoration: 'underline', textUnderlineOffset: '2px', whiteSpace: 'nowrap', ...(compact ? { minWidth: '5rem', flex: '0 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left' as const } : null) }}
                >
                  {r.hcp} · {r.jobName || '—'}
                </button>
              ) : (
                <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {r.hcp} · {r.jobName || '—'}
                </span>
              )}
              {compact ? (
                <>
                  {showCustomer && r.customerName && r.customerName !== '—' ? (
                    <span title={r.customerName} style={{ minWidth: 0, flex: '0 1 auto', fontSize: '0.72rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.customerName}
                    </span>
                  ) : null}
                  <span style={{ flex: 'none', fontSize: '0.72rem', color: old ? 'var(--text-red-600)' : 'var(--text-muted)', fontWeight: old ? 700 : 400, whiteSpace: 'nowrap' }}>
                    {r.ageDays != null ? `billed ${r.referenceDateDisplay} · ${r.ageDays}d` : 'no bill-out date'}
                  </span>
                </>
              ) : (
                <span style={{ minWidth: 0, fontSize: '0.72rem', color: old ? 'var(--text-red-600)' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {showCustomer && r.customerName && r.customerName !== '—' ? <span style={{ color: 'var(--text-muted)' }}>{r.customerName} · </span> : null}
                  {r.ageDays != null ? `billed ${r.referenceDateDisplay} · ${r.ageDays}d` : 'no bill-out date'}
                </span>
              )}
              {r.inCollections ? (
                <span style={{ flex: 'none', padding: '0.05rem 0.35rem', fontSize: '0.6875rem', fontWeight: 600, borderRadius: 4, background: 'var(--bg-red-tint)', color: 'var(--text-red-700)', whiteSpace: 'nowrap' }}>Collections</span>
              ) : null}
              {promised ? (
                <span
                  title={promised.late ? 'The date they gave for this job has passed and it is still owed' : 'The date they gave for this job'}
                  style={{ flex: 'none', padding: '0.05rem 0.4rem', fontSize: '0.6875rem', fontWeight: 600, borderRadius: 9999, whiteSpace: 'nowrap', background: promised.late ? 'var(--bg-orange-tint)' : 'var(--bg-green-tint)', color: promised.late ? 'var(--text-red-700)' : 'var(--text-green-800)' }}
                >
                  said {promised.label}
                  {promised.late ? ' · late' : ''}
                </span>
              ) : null}
              <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', fontSize: '0.8125rem', fontWeight: heavy ? 600 : 400, whiteSpace: 'nowrap' }}>${formatCurrency(r.remaining)}</span>
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
            {r.paidBy ? (
              <div data-testid="gc-bill-paid-by" style={{ padding: `0 0.6rem ${compact ? '0.25rem' : '0.4rem'} ${leading ? '2.3rem' : '0.6rem'}`, background: 'var(--bg-subtle)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {r.paidBy}
              </div>
            ) : null}
            {isExpanded && (
              <div style={{ padding: `0.45rem 0.6rem 0.55rem ${leading ? '2.3rem' : '0.6rem'}`, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {!activity || activity.loading ? (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Loading activity…</span>
                ) : activity.rows.length === 0 ? (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>No activity recorded on this job yet.</span>
                ) : (
                  activity.rows.map((ev) => (
                    <div key={ev.id} style={{ fontSize: '0.72rem', lineHeight: 1.45 }}>
                      <span style={{ color: 'var(--text-faint)' }}>{eventStamp(ev.occurred_at)}</span> <strong style={{ color: 'var(--text-700)' }}>{ev.actor_name || '—'}</strong>{' '}
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
  )
}
