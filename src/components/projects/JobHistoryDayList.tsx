import { peopleCountColor } from '../../lib/projectsJobHistoryData'
import { jobHistoryDayListSummary, jobHistoryGapLabel, type JobHistoryDayList as DayList } from '../../lib/jobs/jobHistoryDayList'
import { APP_CALENDAR_TZ, formatWorkDateYmdMonthDayShort, referenceDateForWorkDateYmd } from '../../utils/dateUtils'

/**
 * The job window's History tab on a phone (v2.3235): one row per day worked,
 * newest first, the people-count square in the grid's own blue scale, a
 * one-line gap where days went by with no work. Tap a row for the day detail
 * the grid's numbered cell opens. Presentational; the kernel decides the rows.
 */
type Props = {
  list: DayList
  namesById: Readonly<Record<string, string>>
  todayYmd: string
  onOpenDay: (ymd: string) => void
}

const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: APP_CALENDAR_TZ })

export function JobHistoryDayList({ list, namesById, todayYmd, onOpenDay }: Props) {
  return (
    <div data-testid="job-history-day-list">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.25rem 0 0.4rem' }}>
        <span>{jobHistoryDayListSummary(list)}</span>
      </div>
      {list.rows.length === 0 ? null : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, borderTop: '1px solid var(--border)' }}>
          {list.rows.map((r) => {
            const colors = peopleCountColor(r.people)
            const names = r.userIds.map((id) => namesById[id]).filter((n): n is string => !!n)
            const isToday = r.ymd === todayYmd
            const gap = jobHistoryGapLabel(r.gapBefore)
            const quiet = jobHistoryGapLabel(r.quietAfter)
            return (
              <li key={r.ymd}>
                {quiet ? (
                  <div style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-faint)', borderBottom: '1px dashed var(--border)', textAlign: 'center' }}>
                    — {quiet} since —
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => onOpenDay(r.ymd)}
                  title="Who was there and what it cost"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    gap: '0.75rem',
                    alignItems: 'center',
                    width: '100%',
                    padding: '0.6rem 0.5rem',
                    border: 0,
                    borderBottom: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'inherit',
                    font: 'inherit',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ minWidth: 0 }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-strong)', fontSize: '0.95rem' }}>
                      {weekday.format(referenceDateForWorkDateYmd(r.ymd))}, {formatWorkDateYmdMonthDayShort(r.ymd)}
                      {isToday ? <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · today</span> : null}
                    </span>
                    <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {names.length ? names.join(', ') : `${r.people} ${r.people === 1 ? 'person' : 'people'}`}
                      {r.open ? <span style={{ color: 'var(--text-amber-700)', fontWeight: 600 }}> · still clocked in</span> : null}
                    </span>
                  </span>
                  <span
                    aria-label={`${r.people} ${r.people === 1 ? 'person' : 'people'}`}
                    style={{
                      minWidth: 34,
                      height: 26,
                      padding: '0 0.4rem',
                      borderRadius: 6,
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      fontVariantNumeric: 'tabular-nums',
                      background: colors.background,
                      color: colors.foreground,
                    }}
                  >
                    {r.people}
                  </span>
                </button>
                {gap ? (
                  <div style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-faint)', borderBottom: '1px dashed var(--border)', textAlign: 'center' }}>
                    — {gap} —
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
