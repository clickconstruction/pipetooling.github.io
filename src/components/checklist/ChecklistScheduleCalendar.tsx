import type { CSSProperties } from 'react'
import { checklistScheduleCalendar, type CalendarDay, type ScheduleCalendarInput } from '../../lib/checklistScheduleCalendar'

/**
 * Punch list #217, office-13 (v2.6145): the New task window's schedule drawn, under the weekday buttons and above
 * the green sentence that stays as its caption. This week and the next three, one row a week, Sunday first: every
 * day the task lands filled, the start and the end marked, today ringed, a start off the picked days ringed amber.
 * For *days after it's done* the chain's days are dashed, a guess that moves with each done; for a one-off its day,
 * the due day and a bar between. Each cell says its words on hover. Pure over `checklistScheduleCalendar`; the Edit
 * window draws the same.
 */

const HEAD = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

const rowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: '2.9rem repeat(7, minmax(0, 1fr))', gap: 3, alignItems: 'center' }

function cellStyle(d: CalendarDay): CSSProperties {
  const s: CSSProperties = {
    height: 24,
    borderRadius: 4,
    border: '1px solid var(--border)',
    fontSize: '0.68rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-muted)',
    background: 'var(--surface)',
    cursor: 'default',
  }
  if (d.dim) {
    s.color = 'var(--text-faint)'
    s.borderStyle = 'dashed'
  }
  if (d.between) {
    s.background = 'var(--bg-200)'
    s.borderColor = 'var(--bg-200)'
    s.borderRadius = 0
    s.color = 'var(--text-700)'
  }
  if (d.maybe) {
    s.border = '1px dashed var(--text-strong)'
    s.color = 'var(--text-strong)'
    s.fontWeight = 700
  }
  if (d.end || d.due) {
    s.border = '2px solid var(--text-strong)'
    s.color = 'var(--text-strong)'
    s.fontWeight = 700
    s.borderRadius = 4
  }
  if (d.lands) {
    s.background = 'var(--text-strong)'
    s.color = 'var(--bg-page)'
    s.border = '1px solid var(--text-strong)'
    s.fontWeight = 700
    // The start and the end keep their mark on a filled day: a ring inside the fill.
    if (d.start || d.end) s.boxShadow = 'inset 0 0 0 2px var(--bg-page), inset 0 0 0 3px var(--text-strong)'
  }
  if (d.startOff) {
    s.border = '2px solid var(--text-amber-800)'
    s.color = 'var(--text-amber-800)'
    s.fontWeight = 700
  }
  if (d.today) {
    s.outline = '2px solid var(--text-link)'
    s.outlineOffset = -2
    if (!d.lands && !d.startOff) {
      s.color = 'var(--text-link)'
      s.fontWeight = 700
    }
  }
  return s
}

function noteStyle(tone: 'plain' | 'warn'): CSSProperties {
  return {
    display: 'inline-block',
    borderRadius: 999,
    padding: '0.1rem 0.55rem',
    fontSize: '0.74rem',
    border: tone === 'warn' ? '1px solid var(--text-amber-700)' : '1px solid var(--border)',
    background: tone === 'warn' ? 'var(--bg-amber-100)' : 'var(--bg-subtle)',
    color: tone === 'warn' ? 'var(--text-amber-800)' : 'var(--text-muted)',
  }
}

export function ChecklistScheduleCalendar({ input }: { input: ScheduleCalendarInput }) {
  const cal = checklistScheduleCalendar(input)
  if (!cal) return null
  return (
    <div data-schedule-calendar role="group" aria-label="The next weeks" style={{ display: 'grid', gap: 3, marginTop: '0.6rem' }}>
      <div aria-hidden style={{ ...rowStyle, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', textAlign: 'center' }}>
        <span />
        {HEAD.map((h, i) => (
          <span key={i}>{h}</span>
        ))}
      </div>
      {cal.weeks.map((w) => (
        <div key={w.label} style={rowStyle}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{w.label}</span>
          {w.days.map((d) => (
            <span
              key={d.ymd}
              data-cal-day={d.ymd}
              data-lands={d.lands ? 'true' : undefined}
              data-maybe={d.maybe ? 'true' : undefined}
              data-start={d.start ? (d.startOff ? 'off' : 'on') : undefined}
              data-end={d.end ? 'true' : undefined}
              data-due={d.due ? 'true' : undefined}
              data-today={d.today ? 'true' : undefined}
              role="img"
              aria-label={d.words}
              title={d.words}
              style={cellStyle(d)}
            >
              {d.day}
            </span>
          ))}
        </div>
      ))}
      {cal.notes.length > 0 && (
        <div data-schedule-calendar-notes style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
          {cal.notes.map((n) => (
            <span key={n.words} style={noteStyle(n.tone)}>
              {n.words}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
