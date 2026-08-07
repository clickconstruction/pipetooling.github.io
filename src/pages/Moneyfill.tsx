import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { QuickfillNoncardAttributionSection } from '../components/quickfill/QuickfillNoncardAttributionSection'
import { useAuth } from '../hooks/useAuth'
import { useQuickfillNoncardAttribution } from '../hooks/useQuickfillNoncardAttribution'
import { addDaysYmd } from '../lib/emailSchedule/emailScheduleWeek'
import { weekLabel } from '../lib/jobs/stagesWeeklyMovement'
import {
  fetchWeekCloseCounts,
  previousCompleteWeekMonday,
  summarizeWeekClose,
  type MoneyfillQueueCount,
} from '../lib/moneyfillWeekClose'

/**
 * Moneyfill — the controller/dev counterpart to Quickfill: financial queues
 * worked to zero, organized as a WEEKLY CLOSE (v2.1444, WEEKLY_MONEY_PLAN.md
 * Phase 3a). The close-week header shows how many queues are at zero for the
 * chosen Mon–Sun Central week (defaults to the previous complete week — the
 * week you close Monday morning); each queue card below is week-scoped where
 * that makes sense and links to the existing fix surface. The same counts
 * feed the Weekly Money Movement report's confidence footer via
 * `moneyfillWeekClose.ts` — one implementation, two surfaces.
 *
 * Page visibility is role-gated (dev + controller); queue bodies stay
 * capability-probed (e.g. bank transfers needs the banking_attributors grant).
 */
export default function Moneyfill() {
  const { role } = useAuth()
  const noncard = useQuickfillNoncardAttribution()
  const [weekMonday, setWeekMonday] = useState(() => previousCompleteWeekMonday())
  const [counts, setCounts] = useState<MoneyfillQueueCount[] | null>(null)

  useEffect(() => {
    let cancelled = false
    setCounts(null)
    void fetchWeekCloseCounts(weekMonday).then(
      (c) => {
        if (!cancelled) setCounts(c)
      },
      () => {
        if (!cancelled) setCounts([])
      },
    )
    return () => {
      cancelled = true
    }
  }, [weekMonday])

  const summary = useMemo(() => (counts ? summarizeWeekClose(counts) : null), [counts])

  if (role != null && role !== 'dev' && role !== 'controller') {
    return <Navigate to="/dashboard" replace />
  }
  if (role == null) return null

  const navBtnStyle: React.CSSProperties = {
    padding: '0.15rem 0.6rem',
    border: '1px solid var(--border-strong)',
    borderRadius: 4,
    background: 'var(--surface)',
    cursor: 'pointer',
    color: 'var(--text-700)',
    fontSize: '0.8125rem',
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1200, margin: '0 auto', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem', textAlign: 'center' }}>Moneyfill</h1>

      <section
        aria-label="Weekly close"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.9rem 1.25rem', marginBottom: '1rem' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '1.0625rem', fontWeight: 600, margin: 0 }}>
            Close out: Week of {weekLabel(weekMonday)}
          </h2>
          <button type="button" aria-label="Previous week" style={navBtnStyle} onClick={() => setWeekMonday((m) => addDaysYmd(m, -7))}>
            ‹
          </button>
          <button type="button" aria-label="Next week" style={navBtnStyle} onClick={() => setWeekMonday((m) => addDaysYmd(m, 7))}>
            ›
          </button>
          <span style={{ marginLeft: 'auto', fontSize: '0.8125rem', color: 'var(--text-muted)' }} role="status">
            {summary ? (
              <>
                <b style={{ color: 'var(--text-700)' }}>
                  {summary.queuesAtZero} of {summary.totalQueues}
                </b>{' '}
                queue{summary.totalQueues === 1 ? '' : 's'} at zero
                {summary.unattributedDollars > 0 ? (
                  <>
                    {' '}·{' '}
                    <b style={{ color: 'var(--text-red-700)' }}>
                      ${summary.unattributedDollars.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </b>{' '}
                    still unattributed
                  </>
                ) : null}
                {summary.partial ? ' · some queues unavailable' : ''}
              </>
            ) : (
              'Checking queues…'
            )}
          </span>
        </div>
        {summary && summary.totalQueues > 0 ? (
          <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-subtle)', marginTop: '0.6rem', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.round((summary.queuesAtZero / summary.totalQueues) * 100)}%`,
                background: '#15803d',
                transition: 'width 200ms',
              }}
            />
          </div>
        ) : null}
        {counts && counts.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.7rem' }}>
            {counts.map((c) => (
              <span
                key={c.key}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  border: '1px solid var(--border-strong)',
                  borderRadius: 999,
                  padding: '0.15rem 0.6rem',
                  color: 'var(--text-muted)',
                  background: 'var(--surface)',
                }}
              >
                {c.label}
                <b style={{ color: c.count == null ? 'var(--text-faint)' : c.count === 0 ? '#15803d' : 'var(--text-red-700)', fontVariantNumeric: 'tabular-nums' }}>
                  {c.count == null
                    ? '—'
                    : c.dollars != null && c.dollars > 0
                      ? `$${Math.abs(c.dollars).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                      : c.count}
                </b>
              </span>
            ))}
          </div>
        ) : null}
        <p style={{ margin: '0.6rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          The Weekly Money Movement report is only as true as these queues are empty — same counts, same week.
        </p>
      </section>

      <section
        aria-label="Bank transfers needing attribution"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem 1.25rem' }}
      >
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 0.75rem' }}>
          Bank transfers needing attribution
        </h2>
        {noncard.eligible ? (
          <QuickfillNoncardAttributionSection rows={noncard.rows} loading={noncard.loading} refetch={noncard.refetch} />
        ) : noncard.loading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            This queue needs the banking-attribution grant. Ask a dev to add you to it, then reload.
          </div>
        )}
      </section>
    </div>
  )
}
