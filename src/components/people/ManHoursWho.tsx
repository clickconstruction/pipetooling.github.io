import { Link } from 'react-router-dom'
import { manHoursPeriodLabel, type ManHoursPeriod, type ManHoursZoom } from '../../lib/manHours/manHoursByPeriod'
import type { ManHoursWhoRow } from '../../lib/manHours/manHoursWho'

/**
 * The Man hours card's "who made it up" list for the picked period (v2.4515),
 * with the doors out of it: a week moves the day table below to that week,
 * waiting hours open the approvals queue, hours on no job open Match sessions.
 * Presentational: `lib/manHours/manHoursWho.ts` builds the rows.
 */

const hrs = (h: number): string => (h >= 0.5 ? Math.round(h).toLocaleString('en-US') : '—')

const thStyle = {
  textAlign: 'right' as const,
  padding: '0.25rem 0.6rem',
  fontSize: '0.7rem',
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  color: 'var(--text-muted)',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap' as const,
}

const tdStyle = {
  padding: '0.3rem 0.6rem',
  textAlign: 'right' as const,
  whiteSpace: 'nowrap' as const,
  fontVariantNumeric: 'tabular-nums' as const,
  borderBottom: '1px solid var(--border)',
  color: 'var(--text-strong)',
}

const doorStyle = {
  display: 'inline-block',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  background: 'var(--surface)',
  color: 'var(--text-strong)',
  fontFamily: 'inherit',
  fontSize: '0.8125rem',
  fontWeight: 600,
  padding: '0.25rem 0.6rem',
  cursor: 'pointer',
  textDecoration: 'none',
}

const amberDoorStyle = { ...doorStyle, border: '1px solid var(--border-amber)', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' }

export function ManHoursWho({
  period,
  zoom,
  rows,
  onShowWeek,
}: {
  period: ManHoursPeriod
  zoom: ManHoursZoom
  rows: readonly ManHoursWhoRow[]
  /** Moves the day table to the week starting on this day. Offered on the Week zoom only. */
  onShowWeek?: (weekStartYmd: string) => void
}) {
  const label = manHoursPeriodLabel(period, zoom)
  const waiting = period.pendingHours >= 0.5
  const offJob = period.unassignedHours >= 0.5
  const showWeek = zoom === 'week' && onShowWeek
  return (
    <section
      aria-label={`Who made up ${label}`}
      style={{ marginTop: '0.6rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '0.5rem 0.65rem' }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
        <strong style={{ color: 'var(--text-strong)', fontSize: '0.875rem' }}>Who made up {label}</strong>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {rows.length} {rows.length === 1 ? 'person' : 'people'}
          {period.soFar ? ' so far' : ''}
        </span>
      </div>
      {rows.length === 0 ? (
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>Nobody clocked time in this period.</div>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: '0.35rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, textAlign: 'left' }}>Person</th>
                <th style={thStyle}>Field</th>
                <th style={thStyle}>Office</th>
                <th style={thStyle}>Bids</th>
                <th style={thStyle}>Not on a job</th>
                <th style={thStyle}>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.userId}>
                  <td style={{ ...tdStyle, textAlign: 'left' }}>
                    {r.name}
                    {r.pendingHours >= 0.5 ? <span style={{ marginLeft: '0.4rem', fontSize: '0.72rem', color: 'var(--text-amber-800)' }}>{hrs(r.pendingHours)} h waiting</span> : null}
                  </td>
                  <td style={tdStyle}>{hrs(r.fieldHours)}</td>
                  <td style={tdStyle}>{hrs(r.officeHours)}</td>
                  <td style={tdStyle}>{hrs(r.bidHours)}</td>
                  <td style={tdStyle}>{hrs(r.unassignedHours)}</td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{hrs(r.totalHours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showWeek || waiting || offJob ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
          {showWeek ? (
            <button type="button" onClick={() => onShowWeek(period.start)} style={doorStyle}>
              Show these days in the table below
            </button>
          ) : null}
          {waiting ? (
            <Link to="/people?tab=hours&approvals=1" style={amberDoorStyle} title="Opens the Hours approvals queue. It lists every waiting session, not only this period's.">
              Approve waiting hours · {hrs(period.pendingHours)} h
            </Link>
          ) : null}
          {offJob ? (
            <Link to="/people?tab=hours&match=1" style={doorStyle} title="Opens Match sessions on the Hours tab. It lists every session with no job or bid, not only this period's.">
              Match hours to a job · {hrs(period.unassignedHours)} h
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
