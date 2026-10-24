/**
 * Quickfill's Email station (punch list #159, v2.5828, PR 5 of 5): the trend its Mark history window shows. Per counted
 * label the viewer may see, a bar a day for four weeks, red on a day the oldest thread was past the limit, marked under a
 * day someone looked; then two weeks day by day, the days nobody looked included: who looked, how many sat, the oldest,
 * what came and cleared, and what sat past the limit by name. The model is `lib/quickfill/emailTrend.ts`; the reads are
 * the station's (`emailStationIo.ts`) plus the trend's own (`emailTrendIo.ts`).
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { boxWords } from '../../lib/emailIn/readerBoxes'
import { cleanLabels } from '../../lib/emailIn/countedBoxes'
import { emailStation } from '../../lib/quickfill/emailStation'
import { emailTrend } from '../../lib/quickfill/emailTrend'
import { supabaseEmailTrendIo, type EmailTrendData, type EmailTrendIo } from '../../lib/quickfill/emailTrendIo'
import { formatErrorMessage } from '../../utils/errorHandling'

const DEFAULT_IO = supabaseEmailTrendIo()

const h: CSSProperties = { margin: '0 0 0.5rem', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-700)' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.75rem' }
const cell: CSSProperties = { padding: '0.45rem 0.55rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top', textAlign: 'left' }
const num: CSSProperties = { ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }

export function EmailStationTrend({ io = DEFAULT_IO, nowIso }: { io?: EmailTrendIo; nowIso?: string }) {
  const { user } = useAuth()
  const [data, setData] = useState<EmailTrendData | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    io.load().then(
      (d) => live && setData(d),
      (e: unknown) => live && setProblem(formatErrorMessage(e)),
    )
    return () => {
      live = false
    }
  }, [io])

  const now = nowIso ?? new Date().toISOString()
  const trend = useMemo(() => {
    if (!data) return null
    // The station's own rules say which boxes and labels the viewer sees, in its order.
    const station = emailStation({ ...data.station, viewerId: user?.id ?? null, nowIso: now, sinceIso: null })
    if (station.mode !== 'live') return { live: false as const }
    const boxes = station.boxes.map((b) => {
      const row = data.station.rows.find((r) => r.id === b.watchId)!
      return { watchId: b.watchId, words: b.kind === 'shared' ? boxWords(row.address) : b.mine ? 'You' : b.title.replace(/'s mail$/, ''), labels: cleanLabels(row.labels).filter((l) => !row.labels_state?.[l]?.missing) }
    })
    return { live: true as const, limitDays: data.station.limitDays, ...emailTrend({ boxes, days: data.days, threads: data.station.threads, marks: data.marks, limitDays: data.station.limitDays, nowIso: now }) }
    // `now` moves every render; the trend follows the data and the viewer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, user?.id])

  if (problem) return <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-red-700)' }}>{problem}</p>
  if (!trend) return <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading the trend…</p>
  if (!trend.live) return null

  return (
    <div data-email-trend style={{ marginBottom: '1.25rem' }}>
      <h3 style={h}>Last 4 weeks</h3>
      {trend.series.map((s) => {
        const max = Math.max(1, ...s.bars.map((b) => b.count ?? 0))
        return (
          <div key={s.key} data-email-trend-series={s.title} style={{ display: 'grid', gridTemplateColumns: 'minmax(7rem, 9.5rem) 1fr auto', gap: '0.6rem', alignItems: 'end', padding: '0.4rem 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)', lineHeight: 1.25 }}>
              {s.title}
              <div style={{ ...muted, fontWeight: 400 }}>{s.todayCount == null ? 'not counted today' : s.todayOldest != null && s.todayCount > 0 ? `oldest today ${s.todayOldest}d` : 'clean today'}</div>
            </div>
            <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 34 }} aria-hidden="true">
              {s.bars.map((b) => (
                <i
                  key={b.ymd}
                  title={`${b.ymd}: ${b.count ?? 'not counted'}${b.oldestDays != null ? `, oldest ${b.oldestDays}d` : ''}${b.looked ? ', looked' : ''}`}
                  style={{
                    flex: '1 1 0',
                    display: 'block',
                    minHeight: 2,
                    height: b.count == null ? 2 : Math.max(2, Math.round((b.count / max) * 30)),
                    borderRadius: '2px 2px 0 0',
                    background: b.count == null ? 'var(--border)' : b.hot ? '#dc2626' : 'var(--border-strong)',
                    boxShadow: b.looked ? '0 3px 0 0 var(--text-link)' : undefined,
                  }}
                />
              ))}
            </div>
            <div style={{ fontSize: '0.8125rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {s.todayCount ?? '—'}
              {s.todayOldest != null && (
                <>
                  {' · '}
                  <b style={{ color: s.todayOldest > trend.limitDays ? 'var(--text-red-700)' : 'inherit' }}>{s.todayOldest}d</b>
                </>
              )}
            </div>
          </div>
        )
      })}
      <div style={{ ...muted, display: 'flex', gap: '0.9rem', flexWrap: 'wrap', margin: '0.4rem 0 1rem' }}>
        <span>Bars: threads in the label that day.</span>
        <span>
          <i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#dc2626', verticalAlign: -1, marginRight: 4 }} />
          The oldest was past {trend.limitDays} days.
        </span>
        <span>
          <i style={{ display: 'inline-block', width: 10, height: 0, borderBottom: '3px solid var(--text-link)', verticalAlign: 2, marginRight: 4 }} />
          Someone looked.
        </span>
      </div>

      <h3 style={h}>Day by day</h3>
      <p style={{ ...muted, fontSize: '0.8125rem', margin: '0 0 0.5rem' }} data-email-trend-nobody>
        {trend.daysNobodyLooked === 0 ? 'Someone looked on each of the last 14 days.' : `Nobody looked on ${trend.daysNobodyLooked} of the last 14 days.`}
      </p>
      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-subtle)' }}>
              <th style={{ ...cell, fontWeight: 600 }}>Day</th>
              <th style={{ ...cell, fontWeight: 600 }}>Looked</th>
              <th style={{ ...num, fontWeight: 600 }}>Open</th>
              <th style={{ ...num, fontWeight: 600 }}>Oldest</th>
              <th style={{ ...num, fontWeight: 600 }}>Moved</th>
              <th style={{ ...cell, fontWeight: 600 }}>What sat past {trend.limitDays} days</th>
            </tr>
          </thead>
          <tbody>
            {trend.rows.map((r) => (
              <tr key={r.ymd} data-email-trend-day={r.ymd} style={r.looked ? undefined : { background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>
                <td style={{ ...cell, whiteSpace: 'nowrap', fontStyle: r.looked ? 'normal' : 'italic' }}>{r.dayWords}</td>
                <td style={{ ...cell, whiteSpace: 'nowrap' }}>{r.looked ?? 'nobody looked'}</td>
                <td style={num}>{r.open ?? '—'}</td>
                <td style={num}>{r.oldestDays != null ? <b style={{ color: r.oldestDays > trend.limitDays ? 'var(--text-red-700)' : 'inherit' }}>{r.oldestDays}d</b> : '—'}</td>
                <td style={num}>
                  +{r.newCount} · −{r.clearedCount}
                </td>
                <td style={{ ...cell, color: 'var(--text-700)' }}>
                  {r.sat.length === 0
                    ? '—'
                    : r.sat.slice(0, 4).map((t, i) => (
                        <span key={i}>
                          {i > 0 && ' · '}
                          <b style={{ color: 'var(--text-red-700)' }}>{t.days}d</b> {t.from}, {t.subject}
                        </span>
                      ))}
                  {r.sat.length > 4 && ` · +${r.sat.length - 4} more`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
