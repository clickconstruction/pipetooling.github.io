import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  buildJobCalendarModel,
  jobCalendarAddMonths,
  jobCalendarMonthGrid,
  jobCalendarMonthLabel,
  JOB_CALENDAR_PERSON_COLORS,
  type JobCalendarAppointment,
  type JobCalendarJobIdentity,
  type JobCalendarModel,
} from '../../lib/jobCalendarModal'
import { fetchJobScheduleBlocksForJob } from '../../lib/jobScheduleBlocks'
import { fetchClockSessionsForJobLedger } from '../../lib/fetchClockSessionsForJobLedger'
import {
  scheduleFormatWindow,
  scheduleTodayDateKey,
} from '../../lib/jobScheduleChicago'
import { renderStagesThreadFullscreenJobHeader } from './jobsStagesRowShared'

/**
 * Job Calendar (Jobs → Stages → click the "j:" Field / job-activity date):
 * month mini-calendar of which days the job sits on whose calendar (one
 * colored dot per person; ✓ under days actually worked), with the full
 * Upcoming / Past appointment list beneath. Read-only; Schedule… and week
 * dispatch actions reuse the caller's existing role-gated flows.
 */

const WEEKDAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function formatApptDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y || 1970, (m || 1) - 1, d || 1).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function AppointmentRow({
  appt,
  dimmed,
  highlight,
  rowRef,
}: {
  appt: JobCalendarAppointment
  dimmed: boolean
  highlight: boolean
  rowRef?: (el: HTMLLIElement | null) => void
}) {
  return (
    <li
      ref={rowRef}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'baseline',
        columnGap: '0.6rem',
        rowGap: 2,
        padding: '0.4rem 0.35rem',
        borderBottom: '1px solid var(--border)',
        fontSize: '0.8125rem',
        opacity: dimmed ? 0.65 : 1,
        background: highlight ? 'var(--bg-amber-100)' : 'transparent',
        borderRadius: highlight ? 4 : 0,
      }}
    >
      <span style={{ fontWeight: 600, color: 'var(--text-strong)', whiteSpace: 'nowrap' }}>
        {formatApptDate(appt.ymd)}
      </span>
      <span style={{ color: 'var(--text-700)', whiteSpace: 'nowrap' }}>
        {scheduleFormatWindow(appt.timeStart, appt.timeEnd)}
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
        {appt.people.map((p) => (
          <span key={p.userId} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}>
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: JOB_CALENDAR_PERSON_COLORS[p.colorIndex],
                flexShrink: 0,
              }}
            />
            <span style={{ color: 'var(--text-700)' }}>{p.name}</span>
          </span>
        ))}
      </span>
      {appt.note ? (
        <span style={{ color: 'var(--text-muted)', flexBasis: '100%', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {appt.note}
        </span>
      ) : null}
    </li>
  )
}

export function JobCalendarModal({
  job,
  onClose,
  canOpenJobScheduleModal,
  canOpenWeekDispatch = true,
  onOpenSchedule,
  onOpenWeekDispatch,
}: {
  job: JobCalendarJobIdentity
  onClose: () => void
  canOpenJobScheduleModal: boolean
  /** Hide the week-dispatch button for viewers without dispatch access (Job Mode techs). */
  canOpenWeekDispatch?: boolean
  /** Receives the highlighted day (null when none) so Schedule opens on it. */
  onOpenSchedule: (selectedYmd: string | null) => void
  /** Receives the highlighted day (null when none) so dispatch opens that week. */
  onOpenWeekDispatch: (selectedYmd: string | null) => void
}) {
  const todayYmd = scheduleTodayDateKey()
  const [model, setModel] = useState<JobCalendarModel | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [month, setMonth] = useState<{ year: number; month: number } | null>(null)
  const [selectedYmd, setSelectedYmd] = useState<string | null>(null)
  const rowRefsByYmd = useRef<Record<string, HTMLLIElement | null>>({})

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [blocks, sessions] = await Promise.all([
        fetchJobScheduleBlocksForJob(job.id),
        fetchClockSessionsForJobLedger(job.id),
      ])
      if (cancelled) return
      if (blocks.error) {
        setLoadError(blocks.error)
        return
      }
      // Sessions are a best-effort overlay — a sessions error only loses the ✓ marks.
      setTruncated(blocks.data.length > 100)
      const m = buildJobCalendarModel(blocks.data, sessions.data, todayYmd)
      setModel(m)
      setMonth(m.initialMonth)
    })()
    return () => {
      cancelled = true
    }
  }, [job.id, todayYmd])

  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // Click selects/highlights any day (re-click deselects); days with
  // appointments also scroll the list to themselves.
  const jumpToDay = useCallback((ymd: string) => {
    setSelectedYmd((prev) => (prev === ymd ? null : ymd))
    rowRefsByYmd.current[ymd]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [])

  const weeks = useMemo(
    () => (month ? jobCalendarMonthGrid(month.year, month.month) : []),
    [month],
  )

  const dayCellButtonBase: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    padding: '0.2rem 0',
    border: 'none',
    background: 'transparent',
    borderRadius: 6,
    font: 'inherit',
    fontSize: '0.75rem',
    lineHeight: 1.2,
    minHeight: 34,
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
        padding: '1rem',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Job calendar"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: 10,
          padding: '1rem',
          width: 'min(560px, 100%)',
          maxHeight: 'min(90vh, 46rem)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
          <div style={{ flex: 1, minWidth: 0 }}>{renderStagesThreadFullscreenJobHeader(job)}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ border: 'none', background: 'none', fontSize: '1.5rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}
          >
            ×
          </button>
        </div>

        {loadError ? (
          <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>{loadError}</p>
        ) : !model || !month ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
        ) : (
          <>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-700)', marginBottom: '0.25rem' }}>
              {model.summary.dayCount > 0 ? (
                <>
                  {model.summary.dayCount} scheduled day{model.summary.dayCount !== 1 ? 's' : ''} ·{' '}
                  {model.summary.peopleCount} {model.summary.peopleCount === 1 ? 'person' : 'people'}
                  {model.summary.firstYmd && model.summary.lastYmd ? (
                    <>
                      {' · '}
                      {formatApptDate(model.summary.firstYmd)} – {formatApptDate(model.summary.lastYmd)}
                    </>
                  ) : null}
                </>
              ) : (
                'Nothing on anyone’s calendar yet.'
              )}
              {model.summary.next ? (
                <div style={{ color: 'var(--text-muted)' }}>
                  Next: {formatApptDate(model.summary.next.ymd)} ·{' '}
                  {scheduleFormatWindow(model.summary.next.timeStart, model.summary.next.timeEnd)} ·{' '}
                  {model.summary.next.people.map((p) => p.name).join(', ')}
                </div>
              ) : null}
            </div>

            {/* Month header: ‹ month › + person legend */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem', margin: '0.25rem 0' }}>
              <button
                type="button"
                onClick={() => setMonth(jobCalendarAddMonths(month.year, month.month, -1))}
                aria-label="Previous month"
                style={{ padding: '0.1rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}
              >
                ‹
              </button>
              <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-strong)', minWidth: '7.5rem', textAlign: 'center' }}>
                {jobCalendarMonthLabel(month.year, month.month)}
              </span>
              <button
                type="button"
                onClick={() => setMonth(jobCalendarAddMonths(month.year, month.month, 1))}
                aria-label="Next month"
                style={{ padding: '0.1rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}
              >
                ›
              </button>
              <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginLeft: 'auto' }}>
                {model.people.map((p) => (
                  <span key={p.userId} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--text-700)' }}>
                    <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: JOB_CALENDAR_PERSON_COLORS[p.colorIndex] }} />
                    {p.name}
                  </span>
                ))}
              </span>
            </div>

            {/* Month grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: '0.5rem' }}>
              {WEEKDAY_HEADERS.map((h) => (
                <span key={h} style={{ textAlign: 'center', fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {h}
                </span>
              ))}
              {weeks.flat().map((day) => {
                const dots = model.scheduledColorIdxByYmd[day.ymd] ?? []
                const worked = model.workedYmds.has(day.ymd)
                const isToday = day.ymd === todayYmd
                const hasContent = dots.length > 0 || worked
                const isSelected = selectedYmd === day.ymd
                return (
                  <button
                    key={day.ymd}
                    type="button"
                    onClick={() => jumpToDay(day.ymd)}
                    title={
                      hasContent
                        ? 'Highlight this day (shows it in the list below)'
                        : 'Highlight this day — Schedule… and week dispatch will open on it'
                    }
                    style={{
                      ...dayCellButtonBase,
                      // Only days with activity read dark; quiet in-month days go faint like spill days.
                      color: day.inMonth && hasContent ? 'var(--text-strong)' : 'var(--text-faint)',
                      background: isSelected ? 'var(--bg-amber-100)' : 'transparent',
                      outline: isToday ? '2px solid #2563eb' : undefined,
                      outlineOffset: isToday ? -2 : undefined,
                      cursor: 'pointer',
                    }}
                  >
                    <span>{Number(day.ymd.slice(8))}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, minHeight: 8 }}>
                      {dots.slice(0, 4).map((ci) => (
                        <span key={ci} aria-hidden style={{ width: 6, height: 6, borderRadius: 999, background: JOB_CALENDAR_PERSON_COLORS[ci] }} />
                      ))}
                      {worked ? (
                        <span aria-label="Worked (approved clock session)" title="Worked (approved clock session)" style={{ fontSize: '0.6rem', fontWeight: 700, color: '#16a34a', lineHeight: 1 }}>
                          ✓
                        </span>
                      ) : null}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Appointment list */}
            <div style={{ overflowY: 'auto', minHeight: 0, flex: 1, borderTop: '1px solid var(--border)' }}>
              {truncated ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: '0.4rem 0 0' }}>
                  Showing the first 100 appointments.
                </p>
              ) : null}
              {model.upcoming.length > 0 ? (
                <>
                  <p style={{ margin: '0.5rem 0 0.15rem', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Upcoming
                  </p>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {model.upcoming.map((a) => (
                      <AppointmentRow
                        key={a.key}
                        appt={a}
                        dimmed={false}
                        highlight={selectedYmd === a.ymd}
                        rowRef={(el) => {
                          if (rowRefsByYmd.current[a.ymd] == null || el != null) rowRefsByYmd.current[a.ymd] = el
                        }}
                      />
                    ))}
                  </ul>
                </>
              ) : null}
              {model.past.length > 0 ? (
                <>
                  <p style={{ margin: '0.5rem 0 0.15rem', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Past
                  </p>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {model.past.map((a) => (
                      <AppointmentRow
                        key={a.key}
                        appt={a}
                        dimmed
                        highlight={selectedYmd === a.ymd}
                        rowRef={(el) => {
                          if (rowRefsByYmd.current[a.ymd] == null || el != null) rowRefsByYmd.current[a.ymd] = el
                        }}
                      />
                    ))}
                  </ul>
                </>
              ) : null}
              {model.upcoming.length === 0 && model.past.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0.75rem 0' }}>
                  No appointments yet — use Schedule to put this job on someone’s calendar.
                </p>
              ) : null}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: '0.75rem' }}>
              {selectedYmd ? (
                <span style={{ marginRight: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Selected: {formatApptDate(selectedYmd)}
                </span>
              ) : null}
              {canOpenWeekDispatch ? (
              <button
                type="button"
                onClick={() => onOpenWeekDispatch(selectedYmd)}
                title={selectedYmd ? `Open the dispatch week containing ${formatApptDate(selectedYmd)}` : undefined}
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, background: 'var(--surface)', color: 'var(--text-blue-700)', border: '1px solid #2563eb', borderRadius: 6, cursor: 'pointer' }}
              >
                Open week dispatch
              </button>
              ) : null}
              {canOpenJobScheduleModal ? (
                <button
                  type="button"
                  onClick={() => onOpenSchedule(selectedYmd)}
                  title={selectedYmd ? `Schedule this job on ${formatApptDate(selectedYmd)}` : undefined}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, background: '#15803d', color: '#ffffff', border: '1px solid #166534', borderRadius: 6, cursor: 'pointer' }}
                >
                  {selectedYmd ? `Schedule ${formatApptDate(selectedYmd)}…` : 'Schedule…'}
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
