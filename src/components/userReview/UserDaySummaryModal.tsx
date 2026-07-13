import { useCallback, useMemo, type CSSProperties, type KeyboardEvent } from 'react'
import {
  associationLabel,
  type ClockSessionForDispatchBand,
} from '../../lib/clockSessionsToDispatchSecondaryBands'
import type { JobScheduleBlockRow } from '../../lib/jobScheduleBlocks'
import { scheduleFormatWindow } from '../../lib/jobScheduleChicago'
import { formatRelativeDayPhrase } from '../../lib/relativeDayPhrase'
import {
  computeSessionDurationMs,
  formatSessionDuration,
  formatSessionTimeRange,
} from '../../lib/userDaySummaryFormat'
import {
  denverCalendarDayKey,
  formatDenverWeekday,
  referenceDateForWorkDateYmd,
} from '../../utils/dateUtils'
import { formatDateMdYDisplay } from './UserScheduleDayRow'

const sectionHeadingStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.75rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--text-muted)',
}

const listStyle: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.1rem',
}

const rowBaseStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.05rem',
  width: '100%',
  padding: '0.4rem 0.5rem',
  borderRadius: 4,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  textAlign: 'left',
  color: 'var(--text-strong)',
  font: 'inherit',
  fontSize: '0.875rem',
  cursor: 'pointer',
  boxSizing: 'border-box',
}

const rowReadOnlyStyle: CSSProperties = {
  ...rowBaseStyle,
  cursor: 'default',
}

const rowTopLineStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: '0.6rem',
  minWidth: 0,
}

const rowTimeStyle: CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--text-strong)',
  fontWeight: 500,
  flexShrink: 0,
}

const rowLabelStyle: CSSProperties = {
  color: 'var(--text-700)',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  flex: 1,
}

const rowTrailingStyle: CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: '0.75rem',
  fontVariantNumeric: 'tabular-nums',
  flexShrink: 0,
}

const rowNoteStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
}

const emptyStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.875rem',
  color: 'var(--text-faint)',
  fontStyle: 'italic',
}

export type UserDaySummaryModalProps = {
  open: boolean
  onClose: () => void
  dayYmd: string
  blocks: JobScheduleBlockRow[]
  sessions: ClockSessionForDispatchBand[]
  jobTitleById: ReadonlyMap<string, string>
  bidTitleById: ReadonlyMap<string, string>
  nowMs: number
  /** When true, clock-session rows render as buttons calling `onSelectSession`. */
  showOpenMyTime: boolean
  onSelectBlock: (block: JobScheduleBlockRow) => void
  onSelectSession: () => void
}

export function UserDaySummaryModal({
  open,
  onClose,
  dayYmd,
  blocks,
  sessions,
  jobTitleById,
  bidTitleById,
  nowMs,
  showOpenMyTime,
  onSelectBlock,
  onSelectSession,
}: UserDaySummaryModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    },
    [onClose],
  )

  const todayYmd = useMemo(() => denverCalendarDayKey(nowMs), [nowMs])

  const sortedBlocks = useMemo(
    () => [...blocks].sort((a, b) => a.time_start.localeCompare(b.time_start)),
    [blocks],
  )

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => a.clocked_in_at.localeCompare(b.clocked_in_at)),
    [sessions],
  )

  if (!open) return null

  const weekday = formatDenverWeekday(referenceDateForWorkDateYmd(dayYmd).getTime())
  const mdY = formatDateMdYDisplay(dayYmd)
  const mdShort = mdY.slice(0, 5)
  const relativePhrase = formatRelativeDayPhrase(dayYmd, todayYmd)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1300,
        padding: '1rem',
        boxSizing: 'border-box',
      }}
      role="presentation"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-day-summary-title"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '1.25rem',
          maxWidth: 520,
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          boxShadow: '0 10px 40px rgba(0,0,0,0.18)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="user-day-summary-title"
          style={{
            margin: 0,
            fontSize: '1.05rem',
            fontWeight: 600,
            color: 'var(--text-strong)',
            display: 'flex',
            alignItems: 'baseline',
            flexWrap: 'wrap',
            gap: '0.35rem',
          }}
        >
          <span>
            {weekday.slice(0, 3)} · {mdShort}
          </span>
          {relativePhrase ? (
            <span style={{ fontSize: '0.8125rem', fontWeight: 400, color: 'var(--text-faint)' }}>
              ({relativePhrase})
            </span>
          ) : null}
        </h2>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
            overflow: 'auto',
            minHeight: 0,
            flex: 1,
          }}
        >
          <section style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <h3 style={sectionHeadingStyle}>Scheduled blocks</h3>
            {sortedBlocks.length === 0 ? (
              <p style={emptyStyle}>No scheduled blocks.</p>
            ) : (
              <ul style={listStyle}>
                {sortedBlocks.map((b) => {
                  const label = jobTitleById.get(b.job_id)?.trim() || '—'
                  const note = (b.note ?? '').trim()
                  return (
                    <li key={b.id}>
                      <button
                        type="button"
                        onClick={() => onSelectBlock(b)}
                        style={rowBaseStyle}
                        title={`Open block · ${label}`}
                        aria-label={`Open block ${label} ${scheduleFormatWindow(b.time_start, b.time_end)}`}
                      >
                        <div style={rowTopLineStyle}>
                          <span style={rowTimeStyle}>
                            {scheduleFormatWindow(b.time_start, b.time_end)}
                          </span>
                          <span style={rowLabelStyle}>{label}</span>
                        </div>
                        {note ? <p style={rowNoteStyle}>{note}</p> : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <h3 style={sectionHeadingStyle}>Clock sessions</h3>
            {sortedSessions.length === 0 ? (
              <p style={emptyStyle}>No clock sessions.</p>
            ) : (
              <ul style={listStyle}>
                {sortedSessions.map((s) => {
                  const label = associationLabel(s, jobTitleById, bidTitleById)
                  const note = (s.notes ?? '').trim()
                  const timeRange = formatSessionTimeRange(
                    s.clocked_in_at,
                    s.clocked_out_at,
                    dayYmd,
                    todayYmd,
                  )
                  const durMs = computeSessionDurationMs(
                    s.clocked_in_at,
                    s.clocked_out_at,
                    nowMs,
                    dayYmd,
                    todayYmd,
                  )
                  const durLabel = durMs != null ? formatSessionDuration(durMs) : null
                  const inner = (
                    <>
                      <div style={rowTopLineStyle}>
                        <span style={rowTimeStyle}>{timeRange}</span>
                        <span style={rowLabelStyle}>{label}</span>
                        {durLabel ? <span style={rowTrailingStyle}>{durLabel}</span> : null}
                      </div>
                      {note ? <p style={rowNoteStyle}>{note}</p> : null}
                    </>
                  )
                  return (
                    <li key={s.id}>
                      {showOpenMyTime ? (
                        <button
                          type="button"
                          onClick={() => onSelectSession()}
                          style={rowBaseStyle}
                          title="Open time and attendance for this day"
                          aria-label={`Open time and attendance · ${timeRange} ${label}`}
                        >
                          {inner}
                        </button>
                      ) : (
                        <div style={rowReadOnlyStyle}>{inner}</div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.4rem 0.85rem',
              fontSize: '0.875rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              background: 'var(--surface)',
              cursor: 'pointer',
              color: 'var(--text-700)',
            }}
            aria-label="Close"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
