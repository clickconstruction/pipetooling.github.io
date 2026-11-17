import { Fragment, useCallback, useEffect, useState } from 'react'
import { EmptyState } from '../EmptyState'
import { supabase } from '../../lib/supabase'
import { loadProspectTeamActivity, type ProspectTeamRow } from '../../lib/prospectTeamActivity'
import { getOrderedDateKeysLast30Days } from '../../lib/prospectTeamActivityChartData'
import { callingWeekEmptyWords } from '../../lib/prospects/deckWords'
import type { ProspectKind, ProspectKindWords } from '../../lib/prospects/prospectKinds'
import type { Prospect } from '../../lib/prospects/prospectRow'
import { formatWeekHours, weekRange, type WeekReport } from '../../lib/prospects/prospectWeekReport'
import { loadProspectWeekReport } from '../../lib/prospects/prospectWeekReportIo'
import { sourceSuccess } from '../../lib/prospects/subsLane'

/**
 * The Activity tab of a Prospects lane (dev and the assistant-like): the week report, Source success on a lane
 * that is not Customers, and Marked / Updated by day. Moved out of `src/pages/Prospects.tsx` with its two reads.
 * The page mounts it while the tab is up, so it reads on entry and again when the lane or the week changes, as
 * the page's effects did. The week the pager is on stays with the page, so it survives a visit to another tab.
 */
export function ProspectsActivityTab({
  kind,
  kindWords,
  hideZz,
  laneRows,
  weekOffset,
  setWeekOffset,
}: {
  kind: ProspectKind
  kindWords: ProspectKindWords
  /** The ZZ rule for prospects: test rows stay out of the counts for every role but dev. */
  hideZz: boolean
  /** Every row of the lane, for Source success. The page loads it for a lane that is not Customers. */
  laneRows: readonly Prospect[]
  /** Weeks back from this one. */
  weekOffset: number
  setWeekOffset: (update: (offset: number) => number) => void
}) {
  const [teamDataByDate, setTeamDataByDate] = useState<Record<string, ProspectTeamRow[]>>({})
  const [teamLoading, setTeamLoading] = useState(false)
  const [weekReport, setWeekReport] = useState<WeekReport | null>(null)
  const [weekLoading, setWeekLoading] = useState(false)

  const loadTeamActivity = useCallback(async () => {
    setTeamLoading(true)
    try {
      // The lane's own 30 days (v2.5563); Quickfill's team chart keeps every kind.
      const result = await loadProspectTeamActivity(supabase, kind, { hideZz })
      setTeamDataByDate(result)
    } catch {
      setTeamDataByDate({})
    } finally {
      setTeamLoading(false)
    }
  }, [kind, hideZz])

  useEffect(() => {
    loadTeamActivity()
  }, [loadTeamActivity])

  const loadWeekReport = useCallback(async (offset: number) => {
    setWeekLoading(true)
    try {
      setWeekReport(await loadProspectWeekReport(kind, offset))
    } catch {
      setWeekReport(null)
    } finally {
      setWeekLoading(false)
    }
  }, [kind])

  useEffect(() => {
    void loadWeekReport(weekOffset)
  }, [weekOffset, loadWeekReport])

  return (
    <div style={{ padding: '1rem 0' }}>
      <section style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 700 }}>
            {kind === 'customer' ? '' : `${kindWords.activity} · `}
            {weekOffset === 0 ? 'This week' : 'Week of'} — {weekRange(Date.now(), weekOffset).label}
          </h2>
          <div style={{ display: 'flex', gap: '0.375rem' }}>
            <button
              type="button"
              onClick={() => setWeekOffset((o) => o + 1)}
              style={{ padding: '0.2rem 0.6rem', fontSize: '0.8125rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer', color: 'inherit' }}
            >
              ‹ previous week
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset((o) => Math.max(0, o - 1))}
              disabled={weekOffset === 0}
              style={{ padding: '0.2rem 0.6rem', fontSize: '0.8125rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: weekOffset === 0 ? 'default' : 'pointer', opacity: weekOffset === 0 ? 0.5 : 1, color: 'inherit' }}
            >
              next week ›
            </button>
          </div>
        </div>
        {weekLoading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
        ) : !weekReport || weekReport.perUser.length === 0 ? (
          <EmptyState compact {...callingWeekEmptyWords(weekOffset, () => setWeekOffset((o) => o + 1))} />
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              {[...weekReport.perUser, ...(weekReport.perUser.length > 1 ? [weekReport.team] : [])].map((s) => (
                <div key={s.userId} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.75rem 0.875rem', background: 'var(--surface)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>{s.name}</div>
                  <div style={{ fontSize: '1.375rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{s.calls} {s.calls === 1 ? 'call' : 'calls'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {s.answered} answered{s.answerRate != null ? ` · ${Math.round(s.answerRate * 100)}%` : ''}
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-subtle)', overflow: 'hidden', marginTop: '0.375rem' }}>
                    <div style={{ height: '100%', width: `${Math.round((s.answerRate ?? 0) * 100)}%`, background: '#3b82f6' }} />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>
                    {formatWeekHours(s.timerSeconds)} on calls · {s.callbacks} {s.callbacks === 1 ? 'callback' : 'callbacks'} set ·{' '}
                    <span style={{ color: s.conversions > 0 ? 'var(--text-violet-700)' : undefined, fontWeight: s.conversions > 0 ? 700 : undefined }}>
                      {s.conversions} {kindWords.landedCount}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '0.5rem 1rem', background: 'var(--bg-subtle)', fontWeight: 600, fontSize: '0.875rem' }}>Daily detail</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600 }}>Day</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600 }}>User</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>Calls</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>Answered</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>Time</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>Callbacks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weekReport.daily.map((d) => (
                      <tr key={`${d.dateKey}|${d.userId}`} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}>
                          {new Date(d.dateKey + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>{d.name}</td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{d.calls}</td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{d.answered}</td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{d.timerSeconds > 0 ? formatWeekHours(d.timerSeconds) : '—'}</td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{d.callbacks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>
      {kind !== 'customer' && (
        <section style={{ marginBottom: '2rem' }}>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-muted)' }}>Source success — {kindWords.tab}, every row of the lane</h3>
          {sourceSuccess(laneRows).length === 0 ? (
            <EmptyState compact main="Nothing added yet." />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(8rem, 12rem) minmax(0, 1fr) 5rem', gap: '0.375rem 0.75rem', alignItems: 'center', fontSize: '0.875rem', maxWidth: 560 }}>
              {sourceSuccess(laneRows).map((s) => (
                <Fragment key={s.source}>
                  <span>{s.source}</span>
                  <span style={{ height: 8, borderRadius: 999, background: 'var(--bg-muted)', position: 'relative', overflow: 'hidden' }}>
                    <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${s.total ? Math.round((s.landed / s.total) * 100) : 0}%`, background: '#16a34a', borderRadius: 999 }} />
                  </span>
                  <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-700)' }}>{s.landed} of {s.total}</span>
                </Fragment>
              ))}
            </div>
          )}
        </section>
      )}
      <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-muted)' }}>Marked / Updated by day — last 30 days</h3>
      {teamLoading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {(() => {
            // Newest day first; the chart's helper reads the same 30 days oldest first.
            const dates = [...getOrderedDateKeysLast30Days()].reverse()
            return dates
              .map((dk) => {
                const rows = teamDataByDate[dk] ?? []
                const visibleRows = rows.filter((r) => r.cards_marked > 0 || r.cards_updated > 0)
                if (rows.length === 0 || visibleRows.length === 0) return null
                const d = new Date(dk + 'T12:00:00')
                const dateLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                return (
                  <section key={dk} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ padding: '0.5rem 1rem', background: 'var(--bg-subtle)', fontWeight: 600, fontSize: '0.9375rem' }}>
                      {dateLabel}
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600 }}>User</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>Marked</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>Updated</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleRows.map((r) => (
                            <tr key={r.user_id} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '0.5rem 0.75rem' }}>{r.name}</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.cards_marked}</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.cards_updated}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
              )
            })
          })()}
        </div>
      )}
    </div>
  )
}
