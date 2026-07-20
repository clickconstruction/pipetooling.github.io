import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry, formatErrorMessage } from '../../utils/errorHandling'
import { formatActiveSeconds } from '../../utils/formatActiveSeconds'
import {
  buildPersonActivityDetail,
  formatAppActivityPageLabel,
  type PersonActivityDailyRow,
  type PersonActivityPageRow,
} from '../../lib/appActivityPage'

const WINDOW_DAYS = 90

export type PersonActivityDetailModalProps = {
  userId: string
  personName: string
  zIndex: number
  onClose: () => void
}

function timeShort(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function dayLabel(ymd: string): string {
  const d = new Date(ymd + 'T12:00:00')
  return `${d.toLocaleDateString(undefined, { weekday: 'short' })} ${d.getMonth() + 1}/${d.getDate()}`
}

/**
 * Per-person app-activity drilldown: 90 days of daily active time (UTC buckets) with each day's
 * per-page split from user_app_activity_page_daily. Page data accrues from v2.619 onward, so
 * historical days may show a total with no page rows.
 */
export function PersonActivityDetailModal({ userId, personName, zIndex, onClose }: PersonActivityDetailModalProps) {
  const [dailyRows, setDailyRows] = useState<PersonActivityDailyRow[] | null>(null)
  const [pageRows, setPageRows] = useState<PersonActivityPageRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const n = new Date()
    const start = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() - (WINDOW_DAYS - 1)))
      .toISOString()
      .slice(0, 10)
    void (async () => {
      try {
        const [daily, pages] = await Promise.all([
          withSupabaseRetry(
            async () =>
              await supabase
                .from('user_app_activity_daily')
                .select('activity_date, active_seconds, first_seen_at, last_seen_at')
                .eq('user_id', userId)
                .gte('activity_date', start)
                .order('activity_date', { ascending: false }),
            'person activity daily',
          ),
          withSupabaseRetry(
            async () =>
              await supabase
                .from('user_app_activity_page_daily')
                .select('activity_date, page, active_seconds')
                .eq('user_id', userId)
                .gte('activity_date', start),
            'person activity pages',
          ),
        ])
        if (cancelled) return
        setDailyRows((daily ?? []) as PersonActivityDailyRow[])
        setPageRows((pages ?? []) as PersonActivityPageRow[])
      } catch (e) {
        if (!cancelled) setError(formatErrorMessage(e, 'Could not load activity.'))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  const detail = useMemo(
    () => (dailyRows ? buildPersonActivityDetail(dailyRows, pageRows) : null),
    [dailyRows, pageRows],
  )

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex,
        padding: '1rem',
        boxSizing: 'border-box',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="person-activity-detail-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
        }}
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          maxWidth: 640,
          width: '100%',
          maxHeight: '88vh',
          overflow: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 id="person-activity-detail-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>
              Activity — {personName}
            </h3>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Last {WINDOW_DAYS} days · {detail ? formatActiveSeconds(detail.totalSeconds) : '…'} total. UTC calendar
              days; page split collects from deploy day onward.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            aria-label="Close"
            style={{ padding: '0.35rem 0.65rem', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: '0.75rem 1.25rem 1rem' }}>
          {error ? (
            <p style={{ margin: 0, color: 'var(--text-red-700)', fontSize: '0.875rem' }}>{error}</p>
          ) : !detail ? (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
          ) : detail.days.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>No activity in the last {WINDOW_DAYS} days.</p>
          ) : (
            <>
              {detail.pageTotals.length > 0 ? (
                <div style={{ marginBottom: '0.9rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                    Where ({WINDOW_DAYS}d)
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {detail.pageTotals.map((p) => (
                      <span
                        key={p.page}
                        style={{
                          fontSize: '0.75rem',
                          background: 'var(--bg-blue-tint)',
                          border: '1px solid #bfdbfe',
                          color: 'var(--text-blue-800)',
                          borderRadius: 9999,
                          padding: '0.15rem 0.6rem',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatAppActivityPageLabel(p.page)} {formatActiveSeconds(p.seconds)}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {detail.days.map((day) => (
                <details key={day.date} style={{ borderBottom: '1px solid var(--border)', padding: '0.3rem 0' }}>
                  <summary
                    style={{
                      cursor: day.pages.length > 0 ? 'pointer' : 'default',
                      listStyle: day.pages.length > 0 ? undefined : 'none',
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '0.6rem',
                      fontSize: '0.8125rem',
                    }}
                  >
                    <span style={{ fontWeight: 600, minWidth: '5.5rem' }}>{dayLabel(day.date)}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatActiveSeconds(day.activeSeconds)}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      {day.firstSeenAt && day.lastSeenAt
                        ? `${timeShort(day.firstSeenAt)} – ${timeShort(day.lastSeenAt)}`
                        : ''}
                    </span>
                    {day.pages.length > 0 ? (
                      <span style={{ color: 'var(--text-faint)', fontSize: '0.6875rem', marginLeft: 'auto' }}>
                        {day.pages.length} page{day.pages.length === 1 ? '' : 's'}
                      </span>
                    ) : null}
                  </summary>
                  {day.pages.length > 0 ? (
                    <ul style={{ listStyle: 'none', margin: '0.3rem 0 0.2rem', padding: '0 0 0 5.5rem' }}>
                      {day.pages.map((p) => (
                        <li key={p.page} style={{ fontSize: '0.75rem', color: 'var(--text-700)', display: 'flex', gap: '0.5rem' }}>
                          <span style={{ flex: 1 }}>{formatAppActivityPageLabel(p.page)}</span>
                          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatActiveSeconds(p.seconds)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </details>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
