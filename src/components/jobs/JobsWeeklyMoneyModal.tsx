import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry, formatErrorMessage } from '../../utils/errorHandling'
import { roleGateRefusalMessage } from '../../lib/roleGate'
import { addDaysYmd } from '../../lib/emailSchedule/emailScheduleWeek'
import { chicagoYmdOf } from '../../lib/gcStatementStandingCopies'
import { mondayOfWeekYmd, weekLabel } from '../../lib/jobs/stagesWeeklyMovement'
import { useAuth } from '../../hooks/useAuth'
import { salaryZonedWallClockToUtcMs } from '../../lib/salaryZonedWallClock'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import {
  cancelWeeklyMoneySend,
  listMyPendingWeeklyMoneySends,
  scheduleWeeklyMoneySend,
  type PendingWeeklyMoneySend,
} from '../../lib/weeklyMoneyEmailRequests'
import { openHtmlPrintWindow } from '../../lib/jobsDocuments/printWindow'
import {
  buildWeekCloseConfidenceLine,
  fetchWeekCloseCounts,
  type MoneyfillQueueCount,
} from '../../lib/moneyfillWeekClose'
import {
  buildWeeklyMoneyReportHtml,
  buildWeeklyMoneyView,
  formatWeeklyMoneyPlain,
  formatWeeklyMoneySigned,
  weeklyMoneyNetForLens,
  type WeeklyMoneyJobRow,
  type WeeklyMoneyLens,
  type WeeklyMoneyPayload,
} from '../../lib/jobs/weeklyMoneyMovement'

/**
 * Weekly Money Movement (v2.1443 — WEEKLY_MONEY_PLAN.md Phase 2): per-job
 * money out vs money in for a Mon–Sun Central week under Earned / Cash lenses.
 * Self-fetching via get_weekly_money_movement_payload (the single source of
 * truth — dev/controller gated server-side). Sibling of JobsWeeklyMovementModal.
 */

type JobsWeeklyMoneyModalProps = {
  open: boolean
  onClose: () => void
  showToast: (msg: string, kind: 'success' | 'error') => void
  /** Recipient pool for scheduled sends — filtered to dev/controller (RLS mirror). */
  users: Array<{ id: string; name: string; email?: string | null; role?: string }>
}

const sectionHeadStyle: React.CSSProperties = {
  margin: '0 0 0.25rem',
  padding: '0.3rem 0.5rem',
  background: 'var(--bg-subtle)',
  borderRadius: 6,
  fontSize: '0.8125rem',
  fontWeight: 600,
}

const thStyle: React.CSSProperties = {
  textAlign: 'right',
  fontSize: '0.625rem',
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  fontWeight: 600,
  padding: '0.15rem 0.4rem',
}

function pctCell(r: WeeklyMoneyJobRow): string {
  if (r.pctDelta != null) return `${r.pctStart ?? 0}% → ${r.pctEnd}%`
  if (r.flagNoPctSignal) return 'no report'
  return '—'
}

function JobRows({ rows, lens }: { rows: WeeklyMoneyJobRow[]; lens: WeeklyMoneyLens }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
      <thead>
        <tr>
          <th style={{ ...thStyle, textAlign: 'left' }}>Job</th>
          <th style={thStyle}>% done</th>
          <th style={thStyle}>Value created</th>
          <th style={thStyle}>Money out</th>
          <th style={thStyle}>Money in</th>
          <th style={thStyle}>Net</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const net = weeklyMoneyNetForLens(r, lens)
          return (
            <tr key={r.jobId} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={{ padding: '0.3rem 0.4rem' }}>
                {r.display}
                {r.flagSpendNoProgress ? (
                  <span style={{ marginLeft: 6, fontSize: '0.625rem', fontWeight: 700, color: 'var(--text-amber-700)', background: 'var(--bg-subtle)', borderRadius: 999, padding: '1px 6px', whiteSpace: 'nowrap' }}>
                    spend, no progress
                  </span>
                ) : null}
                {r.flagNoJobTotal ? (
                  <span style={{ marginLeft: 6, fontSize: '0.625rem', fontWeight: 700, color: 'var(--text-amber-700)', background: 'var(--bg-subtle)', borderRadius: 999, padding: '1px 6px', whiteSpace: 'nowrap' }}>
                    no job total
                  </span>
                ) : null}
                {r.address ? (
                  <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-faint)' }}>{r.address}</span>
                ) : null}
              </td>
              <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right', whiteSpace: 'nowrap', color: r.pctDelta != null ? 'var(--text-700)' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {pctCell(r)}
              </td>
              <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: r.valueCreated != null ? 'inherit' : 'var(--text-muted)' }}>
                {r.valueCreated != null ? formatWeeklyMoneyPlain(r.valueCreated) : '—'}
              </td>
              <td
                style={{ padding: '0.3rem 0.4rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-red-700)', fontWeight: 600 }}
                title={`Labor ${formatWeeklyMoneyPlain(r.outLabor)} · Subs ${formatWeeklyMoneyPlain(r.outSubs)} · Materials ${formatWeeklyMoneyPlain(r.outMaterials)}`}
              >
                {formatWeeklyMoneyPlain(r.moneyOut)}
              </td>
              <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: r.moneyIn > 0 ? '#15803d' : 'var(--text-muted)', fontWeight: r.moneyIn > 0 ? 600 : 400 }}>
                {r.moneyIn > 0 ? formatWeeklyMoneyPlain(r.moneyIn) : '—'}
              </td>
              <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: net == null ? '#b45309' : net >= 0 ? '#15803d' : 'var(--text-red-700)' }}>
                {net != null ? formatWeeklyMoneySigned(net) : '?'}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export function JobsWeeklyMoneyModal({ open, onClose, showToast, users }: JobsWeeklyMoneyModalProps) {
  const [mondayYmd, setMondayYmd] = useState(() => mondayOfWeekYmd(chicagoYmdOf(new Date())))
  const [lens, setLens] = useState<WeeklyMoneyLens>('earned')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<WeeklyMoneyPayload | null>(null)
  const [closeCounts, setCloseCounts] = useState<MoneyfillQueueCount[] | null>(null)
  const { user: authUser } = useAuth()
  /** Share section (v2.1449): scheduled sends of the previous-complete-week report. */
  const [shareRecipientId, setShareRecipientId] = useState('')
  const [shareDate, setShareDate] = useState(() => addDaysYmd(mondayOfWeekYmd(chicagoYmdOf(new Date())), 7))
  const [shareTime, setShareTime] = useState('07:00')
  const [shareWeekly, setShareWeekly] = useState(true)
  const [shareBusy, setShareBusy] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const [pendingSends, setPendingSends] = useState<PendingWeeklyMoneySend[]>([])
  useEffect(() => {
    if (!open) return
    let cancelled = false
    void listMyPendingWeeklyMoneySends().then(
      (rows) => {
        if (!cancelled) setPendingSends(rows)
      },
      () => {},
    )
    return () => {
      cancelled = true
    }
  }, [open])
  const refreshPending = () => {
    void listMyPendingWeeklyMoneySends().then(setPendingSends, () => {})
  }
  const pickableRecipients = users
    .filter((u) => ['dev', 'controller'].includes(u.role ?? '') && (u.email ?? '').includes('@'))
    .sort((a, b) => a.name.localeCompare(b.name))
  const recipientName = (id: string) => users.find((u) => u.id === id)?.name ?? '—'
  const submitShare = () => {
    const hm = /^(\d{1,2}):(\d{2})$/.exec(shareTime.trim())
    if (!shareRecipientId || !/^\d{4}-\d{2}-\d{2}$/.test(shareDate) || !hm) {
      setShareError('Pick a person, date, and time.')
      return
    }
    const ms = salaryZonedWallClockToUtcMs(shareDate, Number(hm[1]), Number(hm[2]), 0, APP_CALENDAR_TZ)
    if (ms == null || ms <= Date.now()) {
      setShareError('Pick a time in the future (Central).')
      return
    }
    setShareBusy(true)
    setShareError(null)
    void scheduleWeeklyMoneySend({
      requestedBy: authUser?.id ?? '',
      recipientUserId: shareRecipientId,
      sendAtIso: new Date(ms).toISOString(),
      repeatWeekly: shareWeekly,
    }).then(
      () => {
        setShareBusy(false)
        setShareRecipientId('')
        refreshPending()
      },
      (e: unknown) => {
        setShareBusy(false)
        setShareError(e instanceof Error ? e.message : 'Could not schedule — try again.')
      },
    )
  }

  // Confidence footer: the SAME queue counts Moneyfill's weekly close shows
  // (moneyfillWeekClose.ts — plan invariant #5). Best-effort; null hides it.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setCloseCounts(null)
    void fetchWeekCloseCounts(mondayYmd).then(
      (c) => {
        if (!cancelled) setCloseCounts(c)
      },
      () => {},
    )
    return () => {
      cancelled = true
    }
  }, [open, mondayYmd])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const data = await withSupabaseRetry(
          () => supabase.rpc('get_weekly_money_movement_payload', { p_week_monday: mondayYmd }),
          'load weekly money movement',
        )
        if (!cancelled) {
          setPayload(data as unknown as WeeklyMoneyPayload)
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          // The RPC refuses non dev/controller callers with `RAISE EXCEPTION
          // 'not allowed'` — say whose report it is, never the raw string
          // (v2.2882, C25 J5-6).
          setError(roleGateRefusalMessage(e, 'this report') ?? formatErrorMessage(e))
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, mondayYmd])

  if (!open) return null
  const label = weekLabel(mondayYmd)
  const view = payload && payload.week_monday === mondayYmd ? buildWeeklyMoneyView(payload, lens) : null

  const kpi = (k: string, v: string, tone?: 'pos' | 'neg') => (
    <div style={{ padding: '0.4rem 0.6rem', borderRight: '1px solid var(--border)', flex: 1, minWidth: 108 }}>
      <div style={{ fontSize: '0.625rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>{k}</div>
      <div style={{ fontSize: '1.0625rem', fontWeight: 650, fontVariantNumeric: 'tabular-nums', color: tone === 'pos' ? '#15803d' : tone === 'neg' ? 'var(--text-red-700)' : 'inherit' }}>{v}</div>
    </div>
  )

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Weekly money movement — money out and in per job"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div style={{ background: 'var(--surface)', padding: '1.25rem 1.5rem', borderRadius: 8, minWidth: 360, maxWidth: 760, width: 'calc(100vw - 2rem)', maxHeight: '85vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 2 }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', flex: 1, minWidth: 0 }}>Weekly money movement</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)' }}>
            ×
          </button>
        </div>
        <p style={{ margin: '0 0 0.6rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Money out into each job and money in from it this week, with the % progress the spend bought.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setMondayYmd((m) => addDaysYmd(m, -7))} aria-label="Previous week" style={{ padding: '0.2rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-700)' }}>
            ‹
          </button>
          <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Week of {label}</span>
          <button type="button" onClick={() => setMondayYmd((m) => addDaysYmd(m, 7))} aria-label="Next week" style={{ padding: '0.2rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-700)' }}>
            ›
          </button>
          <span role="group" aria-label="Lens" style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden', fontSize: '0.75rem', fontWeight: 600 }}>
            {(['earned', 'cash'] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLens(l)}
                aria-pressed={lens === l}
                style={{ padding: '0.2rem 0.75rem', border: 'none', cursor: 'pointer', background: lens === l ? '#3b82f6' : 'var(--surface)', color: lens === l ? 'white' : 'var(--text-muted)' }}
              >
                {l === 'earned' ? 'Earned' : 'Cash'}
              </button>
            ))}
          </span>
          <button
            type="button"
            disabled={!view}
            onClick={() => {
              if (!view) return
              if (!openHtmlPrintWindow(buildWeeklyMoneyReportHtml(view, label, lens))) {
                showToast('Allow pop-ups to print the report.', 'error')
              }
            }}
            title="Print this week's money movement (choose Save as PDF to download)"
            style={{ padding: '0.25rem 0.7rem', fontSize: '0.8125rem', fontWeight: 500, border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-700)' }}
          >
            <span aria-hidden>🖨</span> Print
          </button>
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '0.6rem 0.75rem', marginBottom: '1rem' }}>
          <p style={{ margin: '0 0 0.15rem', fontSize: '0.8125rem', fontWeight: 600 }}>Email this report</p>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Each send covers the previous complete week, rebuilt fresh at send time. Recipients: devs and controllers
            only (job costs include wages).
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <select
              value={shareRecipientId}
              onChange={(e) => setShareRecipientId(e.target.value)}
              disabled={shareBusy}
              aria-label="Send to"
              style={{ flex: 1, minWidth: 140, padding: '0.3rem 0.45rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem' }}
            >
              <option value="">Send to…</option>
              {pickableRecipients.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} — {(u.role ?? '').replace('_', ' ')}
                </option>
              ))}
            </select>
            <input type="date" value={shareDate} onChange={(e) => setShareDate(e.target.value)} disabled={shareBusy} aria-label="First send date" style={{ padding: '0.25rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem' }} />
            <input type="time" value={shareTime} onChange={(e) => setShareTime(e.target.value)} disabled={shareBusy} aria-label="Send time (Central)" style={{ padding: '0.25rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem' }} />
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={shareWeekly} onChange={() => setShareWeekly((w) => !w)} disabled={shareBusy} style={{ margin: 0 }} />
              Repeat weekly
            </label>
            <button
              type="button"
              onClick={submitShare}
              disabled={shareBusy || !shareRecipientId}
              style={{ marginLeft: 'auto', padding: '0.25rem 0.7rem', fontSize: '0.8125rem', fontWeight: 500, border: 'none', borderRadius: 4, background: '#3b82f6', color: 'white', cursor: shareBusy ? 'wait' : 'pointer' }}
            >
              {shareBusy ? 'Scheduling…' : 'Schedule'}
            </button>
          </div>
          {shareError ? <p style={{ margin: '0.4rem 0 0', fontSize: '0.75rem', color: 'var(--text-red-700)' }}>{shareError}</p> : null}
          {pendingSends.length > 0 ? (
            <div style={{ marginTop: '0.5rem' }}>
              {pendingSends.map((r) => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', padding: '0.1rem 0' }}>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    → {recipientName(r.recipient_user_id)}
                  </span>
                  <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(r.send_at).toLocaleString('en-US', { timeZone: APP_CALENDAR_TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    {r.repeat_weekly ? ' · weekly' : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      void cancelWeeklyMoneySend(r.id).then(refreshPending, refreshPending)
                    }}
                    title="Cancel this scheduled send (ends a weekly chain)"
                    style={{ padding: '0.05rem 0.45rem', fontSize: '0.6875rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-700)' }}
                  >
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {loading ? (
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }} role="status">
            Loading the week…
          </p>
        ) : error ? (
          <p style={{ margin: 0, color: 'var(--text-red-700)', fontSize: '0.875rem' }}>{error}</p>
        ) : view ? (
          <>
            <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, marginBottom: '0.9rem', flexWrap: 'wrap' }}>
              {kpi('Money out', formatWeeklyMoneyPlain(view.kpis.moneyOut), 'neg')}
              {kpi('Money in', formatWeeklyMoneyPlain(view.kpis.moneyIn), 'pos')}
              {kpi('Net cash', formatWeeklyMoneySigned(view.kpis.netCash), view.kpis.netCash >= 0 ? 'pos' : 'neg')}
              {kpi('Value created', formatWeeklyMoneyPlain(view.kpis.valueCreated))}
              {kpi('Earned net', formatWeeklyMoneySigned(view.kpis.earnedNet), view.kpis.earnedNet >= 0 ? 'pos' : 'neg')}
            </div>
            {view.rows.length === 0 ? (
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>No money movement this week.</p>
            ) : (
              <>
                {view.made.length > 0 ? (
                  <div style={{ marginBottom: '1rem' }}>
                    <p style={sectionHeadStyle}>
                      <span style={{ color: '#15803d' }}>Made money this week</span>
                      <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · {view.made.length} job{view.made.length === 1 ? '' : 's'}</span>
                    </p>
                    <JobRows rows={view.made} lens={lens} />
                  </div>
                ) : null}
                {view.lost.length > 0 ? (
                  <div style={{ marginBottom: '1rem' }}>
                    <p style={sectionHeadStyle}>
                      <span style={{ color: 'var(--text-red-700)' }}>Lost money this week</span>
                      <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · {view.lost.length} job{view.lost.length === 1 ? '' : 's'}</span>
                    </p>
                    <JobRows rows={view.lost} lens={lens} />
                  </div>
                ) : null}
              </>
            )}
            {(() => {
              const line = closeCounts ? buildWeekCloseConfidenceLine(closeCounts) : null
              if (!line) return null
              return (
                <p style={{ margin: '0 0 0.4rem', padding: '0.45rem 0.6rem', borderRadius: 6, background: 'var(--bg-subtle)', fontSize: '0.75rem', color: 'var(--text-amber-700)' }}>
                  <b style={{ letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: '0.625rem' }}>Confidence</b>{' '}
                  — {line} → <a href="/moneyfill" style={{ color: 'var(--text-amber-700)', fontWeight: 700 }}>work Moneyfill to zero</a>
                </p>
              )
            })()}
            <p style={{ margin: 0, padding: '0.4rem 0.5rem', borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <b style={{ color: 'var(--text-700)' }}>Not on jobs:</b>{' '}
              Office + bid labor {formatWeeklyMoneyPlain(view.overhead.office_labor_cost + view.overhead.bid_labor_cost)}
              {' '}({(view.overhead.office_labor_hours + view.overhead.bid_labor_hours).toFixed(1)} h)
              {' '}· Office job charges {formatWeeklyMoneyPlain(view.overhead.office_job_charges)}
            </p>
          </>
        ) : null}
      </div>
    </div>
  )
}
