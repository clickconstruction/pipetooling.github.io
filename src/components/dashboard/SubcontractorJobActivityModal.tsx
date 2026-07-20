import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  subcontractorActivityLabelForRpcKind,
  subcontractorActivitySourceLabel,
  subcontractorActivitySourceMeaning,
  SUBCONTRACTOR_ACTIVITY_SOURCE_ORDER,
} from '../../lib/subcontractorJobActivityCopy'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'

type ActivityRow = { activity_at: string; kind: string; summary: string }

export type Props = {
  open: boolean
  onClose: () => void
  jobId: string
  /** jobs_ledger.hcp_number for title */
  hcpNumber: string
  jobName: string
}

function formatActivityInstant(iso: string): string {
  const d = new Date(iso)
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: APP_CALENDAR_TZ,
    }).format(d)
  } catch {
    return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  }
}

export default function SubcontractorJobActivityModal({ open, onClose, jobId, hcpNumber, jobName }: Props) {
  const [rows, setRows] = useState<ActivityRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const data = await withSupabaseRetry(
        async () =>
          supabase.rpc('list_my_accessible_job_activity_events', {
            p_job_id: jobId,
            p_limit: 10,
          }),
        'list_my_accessible_job_activity_events modal',
      )
      setRows((data as ActivityRow[]) ?? [])
    } catch (e: unknown) {
      setErrorMessage(formatErrorMessage(e, 'Failed to load activity'))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [jobId])

  useEffect(() => {
    if (!open || !jobId) {
      setRows(null)
      setErrorMessage(null)
      return
    }
    void load()
  }, [open, jobId, load])

  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const subtitle = `${hcpNumber} · ${jobName}`

  /** Badge fill + label color per RPC `kind` (stronger than pastels for contrast on light cards). */
  const BADGE_BY_KIND: Record<string, { bg: string; color: string }> = {
    thread_note: { bg: '#bfdbfe', color: 'var(--text-blue-800)' },
    field_report: { bg: 'var(--bg-green-200)', color: 'var(--text-green-800)' },
    clock: { bg: '#ddd6fe', color: '#6d28d9' },
    schedule: { bg: '#fde68a', color: 'var(--text-amber-800)' },
  }
  const DEFAULT_BADGE = { bg: 'var(--bg-200)', color: 'var(--text-700)' }

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 58,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sub-job-activity-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          maxWidth: 520,
          width: '100%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        }}
      >
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '0.75rem',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <div>
            <h2 id="sub-job-activity-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
              Activity on this job
            </h2>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.35rem 0.65rem',
              fontSize: '0.875rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              background: 'var(--surface)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
            aria-label="Close"
          >
            Close
          </button>
        </header>

        <div style={{ overflow: 'auto', padding: '1rem 1.25rem 1.25rem', fontSize: '0.875rem' }}>
          <section style={{ marginBottom: '1.25rem' }}>
            <h3
              style={{
                margin: '0 0 0.5rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--text-700)',
                textAlign: 'center',
              }}
            >
              Types of activity
            </h3>
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: 'none',
              }}
            >
              {SUBCONTRACTOR_ACTIVITY_SOURCE_ORDER.map((src) => (
                <li
                  key={src}
                  style={{
                    marginBottom: '0.65rem',
                    paddingBottom: '0.65rem',
                    borderBottom: '1px solid var(--border)',
                    color: 'var(--text-700)',
                    lineHeight: 1.45,
                  }}
                >
                  <strong>{subcontractorActivitySourceLabel[src]}</strong>
                  {' - '}
                  {subcontractorActivitySourceMeaning[src]}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)' }}>
              Recent activity
              {!loading && rows != null ? ` (${rows.length})` : null}
            </h3>

            {loading && <p style={{ color: 'var(--text-muted)' }}>Loading…</p>}
            {!loading && errorMessage && (
              <p role="alert" style={{ color: 'var(--text-red-700)', margin: 0 }}>
                {errorMessage}
              </p>
            )}
            {!loading && !errorMessage && rows && rows.length === 0 && (
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>No activity of these types appears for you yet on this job.</p>
            )}
            {!loading && rows != null && rows.length > 0 && (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {rows.map((row, idx) => {
                  const badge = BADGE_BY_KIND[row.kind.trim()] ?? DEFAULT_BADGE
                  return (
                    <li
                      key={`${row.activity_at}-${row.kind}-${idx}`}
                      style={{
                        marginBottom: '0.75rem',
                        padding: '0.65rem 0.75rem',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        background: 'var(--bg-page)',
                      }}
                    >
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.35rem', marginBottom: '0.35rem' }}>
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            letterSpacing: '0.02em',
                            textTransform: 'uppercase',
                            padding: '0.15rem 0.4rem',
                            borderRadius: 4,
                            background: badge.bg,
                            color: badge.color,
                          }}
                        >
                          {subcontractorActivityLabelForRpcKind(row.kind)}
                        </span>
                        <time dateTime={row.activity_at} style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {formatActivityInstant(row.activity_at)}
                        </time>
                      </div>
                      <div style={{ color: 'var(--text-gray-800)', lineHeight: 1.4, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                        {row.summary}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
