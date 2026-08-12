import { formatDateRangeLabel } from '../../utils/dateRangeLabel'
import { HOURS_TAB_SECTION_ANCHOR_STYLE } from './peopleHoursTabShared'

export interface PeopleHoursWeekRangeProps {
  narrowViewport: boolean
  hoursDateStart: string
  hoursDateEnd: string
  setHoursDateStart: (value: string) => void
  setHoursDateEnd: (value: string) => void
  shiftHoursWeek: (delta: number) => void
  /** Earliest visible date (assistant hours window). Null/absent = unlimited history. */
  minDateYmd?: string | null
}

export function PeopleHoursWeekRange({
  narrowViewport,
  hoursDateStart,
  hoursDateEnd,
  setHoursDateStart,
  setHoursDateEnd,
  shiftHoursWeek,
  minDateYmd = null,
}: PeopleHoursWeekRangeProps) {
  const atFloor = minDateYmd != null && hoursDateStart <= minDateYmd
  const floorHint = minDateYmd != null && (
    <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center', width: '100%' }}>
      Hours history before{' '}
      {new Date(minDateYmd + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}{' '}
      is not available for your role.
    </p>
  )
  return (
    <section id="people-hours-week" aria-labelledby="people-hours-week-heading" style={HOURS_TAB_SECTION_ANCHOR_STYLE}>
      <h3
        id="people-hours-week-heading"
        style={{
          margin: '0 0 0.75rem 0',
          fontSize: '0.875rem',
          fontWeight: 600,
          color: 'var(--text-strong)',
          lineHeight: 1.25,
          textAlign: 'left',
        }}
      >
        Week range
      </h3>
      {narrowViewport ? (
        <div
          style={{
            marginBottom: '0.5rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'center', width: '100%', flexWrap: 'wrap' }}>
            <button
              type="button"
              aria-label="Previous week"
              onClick={() => shiftHoursWeek(-1)}
              disabled={atFloor}
              title={atFloor ? 'Earlier weeks are not available for your role' : undefined}
              style={{ padding: '0.35rem 0.65rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: atFloor ? 'not-allowed' : 'pointer', fontSize: '1.125rem', lineHeight: 1, opacity: atFloor ? 0.45 : 1 }}
            >
              ‹
            </button>
            <span style={{ fontSize: '0.875rem', textAlign: 'center', minWidth: 0 }}>
              {formatDateRangeLabel(hoursDateStart, hoursDateEnd)}
            </span>
            <button
              type="button"
              aria-label="Next week"
              onClick={() => shiftHoursWeek(1)}
              style={{ padding: '0.35rem 0.65rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer', fontSize: '1.125rem', lineHeight: 1 }}
            >
              ›
            </button>
          </div>
          <details style={{ marginTop: '0.35rem', width: '100%', maxWidth: '100%' }}>
            <summary style={{ fontSize: '0.8125rem', cursor: 'pointer', color: 'var(--text-700)', textAlign: 'center' }}>
              Custom dates
            </summary>
            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                flexWrap: 'wrap',
                marginTop: '0.5rem',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <label
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '0.875rem', textAlign: 'center' }}>Start</span>
                <input type="date" value={hoursDateStart} min={minDateYmd ?? undefined} onChange={(e) => setHoursDateStart(e.target.value)} style={{ padding: '0.35rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
              </label>
              <label
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '0.875rem', textAlign: 'center' }}>End</span>
                <input type="date" value={hoursDateEnd} min={minDateYmd ?? undefined} onChange={(e) => setHoursDateEnd(e.target.value)} style={{ padding: '0.35rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
              </label>
            </div>
          </details>
          {floorHint}
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            alignItems: 'center',
            marginBottom: '0.5rem',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <button
            type="button"
            onClick={() => shiftHoursWeek(-1)}
            disabled={atFloor}
            title={atFloor ? 'Earlier weeks are not available for your role' : undefined}
            style={{ padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: atFloor ? 'not-allowed' : 'pointer', fontSize: '0.875rem', opacity: atFloor ? 0.45 : 1 }}
          >
            ← last week
          </button>
          <label
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '0.875rem', textAlign: 'center' }}>Start</span>
            <input type="date" value={hoursDateStart} min={minDateYmd ?? undefined} onChange={(e) => setHoursDateStart(e.target.value)} style={{ padding: '0.35rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
          </label>
          <label
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '0.875rem', textAlign: 'center' }}>End</span>
            <input type="date" value={hoursDateEnd} min={minDateYmd ?? undefined} onChange={(e) => setHoursDateEnd(e.target.value)} style={{ padding: '0.35rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
          </label>
          <button
            type="button"
            onClick={() => shiftHoursWeek(1)}
            style={{ padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer', fontSize: '0.875rem' }}
          >
            next week →
          </button>
          {floorHint}
        </div>
      )}
    </section>
  )
}
