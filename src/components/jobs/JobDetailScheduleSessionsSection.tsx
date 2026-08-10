import { useMemo } from 'react'
import type { JobDetailClockSessionRow } from '../../lib/fetchClockSessionsForJobLedger'
import { formatJobDetailModalDateWithWeekdayFromYmd } from '../../lib/formatJobDetailModalDateYmd'
import {
  filterJobDetailClockSessions,
  filterJobDetailScheduleBlocks,
} from '../../lib/jobDetailScheduleSessionsFilter'
import {
  computeJobDetailSessionGroups,
  formatJobDetailTotalHours,
} from '../../lib/jobDetailSessionTotals'
import type { JobScheduleBlockWithAssigneeName } from '../../lib/jobScheduleBlocks'
import {
  scheduleFormatDateLongNoWeekday,
  scheduleFormatWindow,
} from '../../lib/jobScheduleChicago'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'

type Props = {
  /** When true, omit the outer "Schedule and recorded time" heading (parent supplies collapse control). */
  hideTitle?: boolean
  loading: boolean
  error: string | null
  scheduleBlocks: JobScheduleBlockWithAssigneeName[]
  clockSessions: JobDetailClockSessionRow[]
  scheduleTruncated: boolean
  sessionsTruncated: boolean
  /** Client-side filter for calendar blocks and clock sessions (Job Detail header search). */
  filterQuery?: string
}

function formatClockTimeOnlyChicago(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      timeZone: APP_CALENDAR_TZ,
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

function formatDurationHours(inIso: string | null, outIso: string | null): string | null {
  if (!inIso || !outIso) return null
  const a = new Date(inIso).getTime()
  const b = new Date(outIso).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null
  const h = (b - a) / 3600000
  return `${h.toLocaleString('en-US', { maximumFractionDigits: 1 })} h`
}

function sessionStatusLabel(s: JobDetailClockSessionRow): string | null {
  if (s.rejected_at) return 'Rejected'
  if (s.clocked_out_at && !s.approved_at) return 'Pending approval'
  return null
}

const listBoxStyle = {
  maxHeight: 320,
  overflowY: 'auto' as const,
  border: '1px solid var(--border)',
  borderRadius: 4,
  fontSize: '0.875rem',
}

export function JobDetailScheduleSessionsSection({
  hideTitle = false,
  loading,
  error,
  scheduleBlocks,
  clockSessions,
  scheduleTruncated,
  sessionsTruncated,
  filterQuery = '',
}: Props) {
  const filteredScheduleBlocks = useMemo(
    () => filterJobDetailScheduleBlocks(scheduleBlocks, filterQuery),
    [scheduleBlocks, filterQuery],
  )
  const filteredClockSessions = useMemo(
    () => filterJobDetailClockSessions(clockSessions, filterQuery),
    [clockSessions, filterQuery],
  )
  const filterActive = filterQuery.trim().length > 0
  const sessionGroups = useMemo(
    () => computeJobDetailSessionGroups(filteredClockSessions),
    [filteredClockSessions],
  )

  return (
    <div style={{ marginTop: hideTitle ? 0 : '1rem' }}>
      {hideTitle ? null : (
        <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.5rem' }}>Schedule and recorded time</div>
      )}

      {loading ? <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading schedule and sessions…</p> : null}
      {error && !loading ? (
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--text-red-700)', whiteSpace: 'pre-wrap' }}>{error}</p>
      ) : null}

      <div style={{ fontWeight: 600, fontSize: '0.8125rem', marginBottom: '0.35rem', color: 'var(--text-700)' }}>Calendar blocks</div>
      {scheduleBlocks.length === 0 && !loading ? (
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--text-faint)' }}>No schedule blocks for this job.</p>
      ) : scheduleBlocks.length > 0 && filteredScheduleBlocks.length === 0 && filterActive ? (
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>No rows match this filter.</p>
      ) : scheduleBlocks.length > 0 ? (
        <div style={{ ...listBoxStyle, marginBottom: '0.75rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'var(--bg-subtle)', position: 'sticky', top: 0 }}>
              <tr>
                <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>
                  Date
                </th>
                <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>
                  Time
                </th>
                <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>
                  Assignee
                </th>
                <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>
                  Note
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredScheduleBlocks.map((b, idx) => {
                const note = (b.note ?? '').trim()
                const noteShort = note.length > 80 ? `${note.slice(0, 80)}…` : note
                return (
                  <tr key={b.id} style={{ borderBottom: idx < filteredScheduleBlocks.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '0.5rem 0.625rem', verticalAlign: 'top' }}>
                      {scheduleFormatDateLongNoWeekday(b.work_date)}
                    </td>
                    <td style={{ padding: '0.5rem 0.625rem', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                      {scheduleFormatWindow(b.time_start, b.time_end)}
                    </td>
                    <td style={{ padding: '0.5rem 0.625rem', verticalAlign: 'top' }}>
                      {(b.users?.name ?? '').trim() || b.assignee_user_id}
                    </td>
                    <td
                      style={{ padding: '0.5rem 0.625rem', verticalAlign: 'top', color: 'var(--text-600)' }}
                      title={note.length > 80 ? note : undefined}
                    >
                      {noteShort || '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      {scheduleTruncated ? (
        <p style={{ margin: '-0.5rem 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Showing first {scheduleBlocks.length} loaded blocks; more may exist in dispatch.
        </p>
      ) : null}

      <div style={{ fontWeight: 600, fontSize: '0.8125rem', marginBottom: '0.35rem', color: 'var(--text-700)' }}>Clock sessions</div>
      {clockSessions.length === 0 && !loading ? (
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-faint)' }}>No clock sessions on this job.</p>
      ) : clockSessions.length > 0 && filteredClockSessions.length === 0 && filterActive ? (
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>No rows match this filter.</p>
      ) : clockSessions.length > 0 ? (
        <div style={listBoxStyle}>
          {sessionGroups.map((g) => (
            <div key={g.name}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: '0.5rem',
                  background: 'var(--bg-subtle)',
                  borderBottom: '1px solid var(--border)',
                  padding: '0.45rem 0.625rem',
                  fontWeight: 600,
                }}
              >
                <span>{g.name}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-600)', fontWeight: 400 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-700)' }}>{formatJobDetailTotalHours(g.totalHours)}</span>
                  {' · '}
                  {g.sessions.length} {g.sessions.length === 1 ? 'session' : 'sessions'}
                  {g.openCount > 0 ? ` · ${g.openCount} open` : ''}
                </span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {g.sessions.map((s) => {
                  const status = sessionStatusLabel(s)
                  const dur = formatDurationHours(s.clocked_in_at, s.clocked_out_at)
                  const workDateLine = formatJobDetailModalDateWithWeekdayFromYmd(s.work_date) ?? s.work_date ?? '—'
                  const notes = (s.notes ?? '').trim()
                  const timeStart = formatClockTimeOnlyChicago(s.clocked_in_at)
                  const timeEnd = s.clocked_out_at ? formatClockTimeOnlyChicago(s.clocked_out_at) : '—'
                  return (
                    <li
                      key={s.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        columnGap: '0.75rem',
                        rowGap: 2,
                        alignItems: 'baseline',
                        padding: '0.45rem 0.625rem',
                        borderBottom: '1px solid var(--border)',
                        fontSize: '0.875rem',
                      }}
                    >
                      <div style={{ fontWeight: 500 }}>
                        {workDateLine}
                        {status ? (
                          <span
                            style={{
                              marginLeft: '0.45rem',
                              display: 'inline-block',
                              fontSize: '0.6875rem',
                              fontWeight: 600,
                              borderRadius: 999,
                              padding: '0.05rem 0.5rem',
                              verticalAlign: '1px',
                              background: status === 'Rejected' ? 'var(--bg-red-100)' : 'var(--bg-amber-100)',
                              color: status === 'Rejected' ? 'var(--text-red-700)' : 'var(--text-amber-800)',
                            }}
                          >
                            {status}
                          </span>
                        ) : null}
                      </div>
                      <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, textAlign: 'right' }}>
                        {dur ?? '—'}
                      </div>
                      <div
                        style={{
                          gridColumn: '1',
                          color: 'var(--text-600)',
                          fontSize: '0.8125rem',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {timeStart} – {timeEnd}
                      </div>
                      {notes ? (
                        <div
                          style={{
                            gridColumn: '1 / -1',
                            fontSize: '0.8125rem',
                            color: 'var(--text-muted)',
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {notes}
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
          {sessionGroups.length >= 2 ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '0.5rem',
                background: 'var(--bg-subtle)',
                padding: '0.45rem 0.625rem',
                fontSize: '0.8125rem',
                color: 'var(--text-600)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span>Total recorded</span>
              <span style={{ fontWeight: 600, color: 'var(--text-700)' }}>
                {formatJobDetailTotalHours(sessionGroups.reduce((sum, g) => sum + g.totalHours, 0))}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
      {sessionsTruncated ? (
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Showing first {clockSessions.length} loaded sessions; more may exist.
        </p>
      ) : null}
    </div>
  )
}
