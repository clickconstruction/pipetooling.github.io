import type { CSSProperties } from 'react'
import { peopleCountColor } from '../../lib/projectsJobHistoryData'
import { crewDayLabel, crewHoursWords, crewQuietWords, crewSummaryWords, type CrewCalendar, type CrewRangeMode } from '../../lib/jobs/jobHistoryCalendar'
import type { LienMonthLine, LienMonthLineTone } from '../../lib/jobs/lienMonthLines'

/**
 * Days on the job (v2.4694): the job window's History tab as a calendar. One
 * line says it (days, span, most people, hours); the people as chips with their
 * day counts — press one and only their days stay lit; a month grid for every
 * month the job had work, the number in a day being how many people clocked in,
 * in the Gantt's own blue scale; weekends sit back, today has a ring, a day
 * still clocked in a corner mark. Press a day for the day window. Since v2.4707 a sub
 * job's month header carries its § 53.056 line (`monthLines`, from the lien timeline the
 * box above draws) — a work month is a notice month, so the two pictures read as one.
 * Presentational; the kernels decide every cell and every line.
 */

type Props = {
  calendar: CrewCalendar
  namesById: Readonly<Record<string, string>>
  todayYmd: string
  loading?: boolean
  range: { mode: CrewRangeMode; start: string; end: string }
  onRangeMode: (mode: CrewRangeMode) => void
  onCustomRange: (start: string, end: string) => void
  pickedUserId: string | null
  onPickUser: (userId: string | null) => void
  onOpenDay: (ymd: string) => void
  /** 'YYYY-MM' → the month's § 53.056 line; null or missing = no line. */
  monthLines?: Record<string, LienMonthLine> | null
}

function lineColor(tone: LienMonthLineTone): string {
  return tone === 'red' ? 'var(--text-red-600)' : tone === 'amber' ? 'var(--text-amber-800)' : tone === 'green' ? 'var(--text-green-800)' : 'var(--text-muted)'
}

const LABEL: CSSProperties = { fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }

function chip(active: boolean): CSSProperties {
  return {
    padding: '0.2rem 0.6rem',
    fontSize: '0.8125rem',
    borderRadius: 999,
    border: `1px solid ${active ? 'var(--text-link)' : 'var(--border-strong)'}`,
    background: active ? 'var(--text-link)' : 'var(--surface)',
    color: active ? '#fff' : 'var(--text-700)',
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
    font: 'inherit',
    lineHeight: 1.3,
  }
}

export default function JobHistoryCrewCalendar({ calendar, namesById, todayYmd, loading = false, range, onRangeMode, onCustomRange, pickedUserId, onPickUser, onOpenDay, monthLines = null }: Props) {
  const summary = loading && calendar.daysWorked === 0 ? 'Loading…' : crewSummaryWords(calendar, todayYmd)
  return (
    <section data-job-history-crew-calendar aria-label="Days on the job" style={{ border: '1px solid var(--border)', borderRadius: 9, padding: '0.6rem 0.8rem 0.55rem', background: 'var(--surface)', display: 'grid', gap: '0.55rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.3rem 0.9rem' }}>
        <span style={LABEL}>Days on the job</span>
        <span data-crew-summary style={{ fontSize: '0.875rem', color: 'var(--text-strong)' }}>{summary}</span>
        <span style={{ flex: '1 1 auto' }} />
        <span role="group" aria-label="Days on the job range" style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center' }}>
          <button type="button" aria-pressed={range.mode === 'whole'} onClick={() => onRangeMode('whole')} style={chip(range.mode === 'whole')}>Whole job</button>
          <button type="button" aria-pressed={range.mode === 90} onClick={() => onRangeMode(90)} style={chip(range.mode === 90)}>Last 90d</button>
          <button type="button" aria-pressed={range.mode === 365} onClick={() => onRangeMode(365)} style={chip(range.mode === 365)}>Last 365d</button>
          <button type="button" aria-pressed={range.mode === 'custom'} onClick={() => onRangeMode('custom')} style={chip(range.mode === 'custom')}>Dates…</button>
        </span>
      </div>
      {range.mode === 'custom' ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 0.8rem', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--text-700)' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            From
            <input type="date" value={range.start} max={range.end || undefined} aria-label="Days on the job from" onChange={(e) => onCustomRange(e.target.value, range.end)} style={{ font: 'inherit', padding: '0.2rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)' }} />
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            To
            <input type="date" value={range.end} min={range.start || undefined} aria-label="Days on the job to" onChange={(e) => onCustomRange(range.start, e.target.value)} style={{ font: 'inherit', padding: '0.2rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)' }} />
          </label>
        </div>
      ) : null}

      {calendar.people.length > 0 ? (
        <div data-crew-people style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.3rem 0.4rem' }}>
          <span style={{ ...LABEL, marginRight: '0.2rem' }}>Who</span>
          {calendar.people.map((p) => {
            const active = pickedUserId === p.userId
            return (
              <button
                key={p.userId}
                type="button"
                data-crew-person={p.userId}
                aria-pressed={active}
                onClick={() => onPickUser(active ? null : p.userId)}
                title={active ? 'Show everyone' : `Light only ${namesById[p.userId] || 'their'} days`}
                style={{ ...chip(active), display: 'inline-flex', gap: '0.35rem', alignItems: 'baseline' }}
              >
                <span>{namesById[p.userId] || 'Someone'}</span>
                <span style={{ fontSize: '0.72rem', color: active ? 'rgba(255,255,255,0.85)' : 'var(--text-muted)' }}>
                  {p.days} d{p.minutes > 0 ? ` · ${crewHoursWords(p.minutes)}` : ''}
                </span>
              </button>
            )
          })}
          {pickedUserId ? (
            <button type="button" onClick={() => onPickUser(null)} style={{ border: 'none', background: 'none', color: 'var(--text-link)', font: 'inherit', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
              everyone
            </button>
          ) : (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginLeft: '0.2rem' }}>press a name to light their days</span>
          )}
        </div>
      ) : null}

      {calendar.months.length > 0 ? (
        <div data-crew-months style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(215px, 1fr))', gap: '0.9rem 1rem' }}>
          {calendar.months.map((m) => {
            const quiet = crewQuietWords(m.quietMonthsBefore)
            return (
              <div key={m.key} data-crew-month={m.key} style={{ display: 'grid', gap: '0.25rem', alignContent: 'start' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-strong)' }}>{m.name}</span>
                  {quiet ? <span data-crew-quiet style={{ fontSize: '0.68rem', color: 'var(--text-faint)' }}>{quiet}</span> : null}
                </div>
                {monthLines && monthLines[m.key] ? (
                  <div data-crew-month-lien data-tone={monthLines[m.key]!.tone} style={{ fontSize: '0.7rem', fontWeight: 600, lineHeight: 1.2, color: lineColor(monthLines[m.key]!.tone), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={monthLines[m.key]!.words}>
                    {monthLines[m.key]!.words}
                  </div>
                ) : null}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 2 }}>
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, i) => (
                    <div key={i} aria-hidden style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-faint)', textAlign: 'center', letterSpacing: '0.04em' }}>{w}</div>
                  ))}
                  {Array.from({ length: m.leadBlanks }, (_, i) => (
                    <span key={`b${i}`} aria-hidden />
                  ))}
                  {m.days.map((d) => {
                    const colors = peopleCountColor(d.people)
                    const worked = d.people > 0
                    const base: CSSProperties = {
                      position: 'relative',
                      height: 32,
                      minHeight: 32,
                      boxSizing: 'border-box',
                      borderRadius: 4,
                      border: `1px solid ${worked ? colors.background : d.weekend ? 'transparent' : 'var(--border)'}`,
                      background: worked ? colors.background : d.weekend ? 'var(--bg-subtle)' : 'var(--surface)',
                      color: worked ? colors.foreground : 'var(--text-faint)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.8125rem',
                      fontWeight: 800,
                      padding: 0,
                      font: 'inherit',
                      opacity: d.dimmed ? 0.28 : 1,
                      boxShadow: d.today ? 'inset 0 0 0 2px var(--text-link)' : undefined,
                      backgroundImage: d.open ? 'linear-gradient(135deg, var(--text-amber-800) 0 6px, transparent 6px)' : undefined,
                      cursor: worked ? 'pointer' : 'default',
                    }
                    const inner = (
                      <>
                        <span aria-hidden style={{ position: 'absolute', left: 3, top: 1, fontSize: '0.55rem', fontWeight: 600, opacity: worked ? 0.75 : 1, lineHeight: 1 }}>{d.n}</span>
                        {worked ? <span aria-hidden style={{ fontSize: '0.8125rem', fontWeight: 800 }}>{d.people}</span> : null}
                      </>
                    )
                    return worked ? (
                      <button key={d.ymd} type="button" data-crew-day={d.ymd} data-crew-people={d.people} aria-label={crewDayLabel(d, namesById)} title={crewDayLabel(d, namesById)} onClick={() => onOpenDay(d.ymd)} style={base}>
                        {inner}
                      </button>
                    ) : (
                      <span key={d.ymd} data-crew-day={d.ymd} data-crew-people={0} title={crewDayLabel(d, namesById)} style={base}>
                        {inner}
                      </span>
                    )
                  })}
                </div>
                <div data-crew-month-foot style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {m.daysWorked} {m.daysWorked === 1 ? 'day' : 'days'}
                  {m.minutes > 0 ? ` · ${crewHoursWords(m.minutes)}` : ''}
                </div>
              </div>
            )
          })}
        </div>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.2rem 1rem', fontSize: '0.68rem', color: 'var(--text-faint)' }}>
        <span>the number is how many people clocked in that day · press a day for who, their hours and what it cost</span>
        <span style={{ whiteSpace: 'nowrap' }}>▢ weekend · ○ today · ◤ still clocked in</span>
      </div>
    </section>
  )
}
