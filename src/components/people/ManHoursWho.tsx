import { Link } from 'react-router-dom'
import { formatManHours as hrs, manHoursPeriodLabel, type ManHoursPeriod, type ManHoursZoom } from '../../lib/manHours/manHoursByPeriod'
import type { ManHoursWhoRow } from '../../lib/manHours/manHoursWho'

/**
 * The Man hours card's "who made it up" list for the picked period (v2.4515),
 * with the doors out of it: a week moves the day table below to that week,
 * waiting hours open the approvals queue, hours on no job open Match sessions.
 * Presentational: `lib/manHours/manHoursWho.ts` builds the rows.
 *
 * Two layouts (v2.4516). `side` stands beside the picture on a wide card, so a
 * click on a bar changes a list in view: the doors sit under the title and the
 * rows scroll inside the panel. `below` is the full-width panel under the
 * table. In both, the name column stays put when the numbers scroll sideways.
 */

const thStyle = {
  textAlign: 'right' as const,
  padding: '0.25rem 0.6rem',
  fontSize: '0.7rem',
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  color: 'var(--text-muted)',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap' as const,
  background: 'var(--surface)',
}

/** The name column: pinned to the left edge of a table that scrolls sideways. */
const pinnedStyle = { position: 'sticky' as const, left: 0, zIndex: 1, background: 'var(--surface)', textAlign: 'left' as const }

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
  layout = 'below',
}: {
  period: ManHoursPeriod
  zoom: ManHoursZoom
  rows: readonly ManHoursWhoRow[]
  layout?: 'side' | 'below'
  /** Moves the day table to the week starting on this day. Offered on the Week zoom only. */
  onShowWeek?: (weekStartYmd: string) => void
}) {
  const label = manHoursPeriodLabel(period, zoom)
  const waiting = period.pendingHours >= 0.5
  const offJob = period.unassignedHours >= 0.5
  const showWeek = zoom === 'week' && onShowWeek
  const side = layout === 'side'
  // The side panel is narrow: less air beside each number. Whole `padding` values, never a longhand over the shorthand.
  const tight = side ? { padding: '0.3rem 0.4rem' } : null
  const tightHead = side ? { padding: '0.25rem 0.4rem' } : null
  const doors =
    showWeek || waiting || offJob ? (
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
    ) : null
  return (
    <section
      aria-label={`Who made up ${label}`}
      data-layout={layout}
      style={{ marginTop: side ? '0.5rem' : '0.6rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '0.5rem 0.65rem' }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
        <strong style={{ color: 'var(--text-strong)', fontSize: '0.875rem' }}>Who made up {label}</strong>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {rows.length} {rows.length === 1 ? 'person' : 'people'}
          {period.soFar ? ' so far' : ''}
        </span>
      </div>
      {side ? doors : null}
      {rows.length === 0 ? (
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>Nobody clocked time in this period.</div>
      ) : (
        <div style={{ overflowX: 'auto', overflowY: side ? 'auto' : undefined, maxHeight: side ? '19.5rem' : undefined, marginTop: '0.35rem' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '0.8125rem' }}>
            <thead>
              <tr>
                {[
                  { label: 'Person', pinned: true },
                  { label: 'Field' },
                  { label: 'Office' },
                  { label: 'Bids' },
                  { label: 'Not on a job', wraps: true },
                  { label: 'Total' },
                ].map((c) => (
                  <th
                    key={c.label}
                    style={{
                      ...thStyle,
                      ...tightHead,
                      ...(c.pinned ? pinnedStyle : null),
                      // In the side panel the header stays while the rows scroll, and the long one may take two lines.
                      ...(side ? { position: 'sticky' as const, top: 0, zIndex: c.pinned ? 2 : 1 } : null),
                      ...(side && c.wraps ? { whiteSpace: 'normal' as const, minWidth: '3.4rem' } : null),
                    }}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.userId}>
                  <td style={{ ...tdStyle, ...pinnedStyle, ...tight }}>
                    {r.name}
                    {r.pendingHours >= 0.5 ? (
                      // Beside the name on the wide panel, under it on the narrow one, so the Total column stays in view.
                      <span style={{ display: side ? 'block' : 'inline', marginLeft: side ? 0 : '0.4rem', fontSize: '0.72rem', color: 'var(--text-amber-800)' }}>{hrs(r.pendingHours)} h waiting</span>
                    ) : null}
                  </td>
                  <td style={{ ...tdStyle, ...tight }}>{hrs(r.fieldHours)}</td>
                  <td style={{ ...tdStyle, ...tight }}>{hrs(r.officeHours)}</td>
                  <td style={{ ...tdStyle, ...tight }}>{hrs(r.bidHours)}</td>
                  <td style={{ ...tdStyle, ...tight }}>{hrs(r.unassignedHours)}</td>
                  <td style={{ ...tdStyle, ...tight, fontWeight: 700 }}>{hrs(r.totalHours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {side ? null : doors}
    </section>
  )
}
