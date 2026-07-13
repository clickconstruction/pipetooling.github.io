import type { CSSProperties } from 'react'
import { JOB_SCHEDULE_TIMEZONE, scheduleFormatTimeHm as formatHm } from '../../lib/jobScheduleChicago'
import { scheduleBlockToRange as toRange } from '../../lib/jobScheduleOverlap'

/** 4:00–20:00 Central spans 960 minutes. */
const WINDOW_START_MIN = 4 * 60
const WINDOW_END_MIN = 20 * 60
const WINDOW_SPAN = WINDOW_END_MIN - WINDOW_START_MIN

/** Below this width (% of track), show only times in the bar; full text stays on `title`. */
const NARROW_PCT = 8

const TRACK_HEIGHT_PX = 80
const BAR_TOP_PX = 8
const BAR_HEIGHT_PX = TRACK_HEIGHT_PX - BAR_TOP_PX * 2

/** Same blue family for both variants: this job = stronger fill/border; other = muted (not gray slab). */
const SEGMENT_THIS_JOB_BG = 'rgba(37, 99, 235, 0.30)'
const SEGMENT_THIS_JOB_BORDER = '#2563eb'
const SEGMENT_OTHER_BG = 'rgba(37, 99, 235, 0.12)'
const SEGMENT_OTHER_BORDER = 'rgba(37, 99, 235, 0.40)'

export type ScheduleTimelineSegment = {
  id: string
  jobId: string
  timeStart: string
  timeEnd: string
  /** Short text inside the bar (e.g. first name). */
  label: string
  /** Optional full name for native `title`; falls back to `label`. */
  tooltipName?: string
  variant: 'this_job' | 'other'
}

function pctFromMinutes(m: number): number {
  return ((m - WINDOW_START_MIN) / WINDOW_SPAN) * 100
}

const ellipsisLine: CSSProperties = {
  minWidth: 0,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

type Props = {
  segments: ScheduleTimelineSegment[]
  currentJobId: string
  onSegmentClick?: (seg: ScheduleTimelineSegment) => void
}

function SegmentInner({
  label,
  timeStr,
  narrow,
}: {
  label: string
  timeStr: string
  narrow: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: narrow ? 'center' : 'flex-start',
        minWidth: 0,
        width: '100%',
        height: '100%',
        gap: narrow ? 0 : 1,
      }}
    >
      {!narrow ? (
        <div style={{ ...ellipsisLine, fontWeight: 600 }}>{label}</div>
      ) : null}
      <div style={{ ...ellipsisLine }}>{timeStr}</div>
    </div>
  )
}

export function ScheduleDayTimeline({ segments, currentJobId, onSegmentClick }: Props) {
  return (
    <div style={{ marginTop: '0.75rem' }}>
      <div
        style={{
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          marginBottom: 4,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>4:00 AM</span>
        <span style={{ fontWeight: 600 }}>Central (schedule window)</span>
        <span>8:00 PM</span>
      </div>
      <div
        style={{
          position: 'relative',
          height: TRACK_HEIGHT_PX,
          background: 'var(--bg-muted)',
          borderRadius: 6,
          border: '1px solid var(--border)',
        }}
      >
        {segments.map((seg) => {
          const r = toRange(seg.timeStart, seg.timeEnd)
          const left = Math.max(0, pctFromMinutes(r.startMin))
          const width = Math.max(
            0.5,
            pctFromMinutes(Math.min(r.endMin, WINDOW_END_MIN)) - left,
          )
          const narrow = width < NARROW_PCT
          const timeStr = `${formatHm(seg.timeStart)}–${formatHm(seg.timeEnd)}`
          const { bg, border } =
            seg.variant === 'this_job'
              ? { bg: SEGMENT_THIS_JOB_BG, border: SEGMENT_THIS_JOB_BORDER }
              : { bg: SEGMENT_OTHER_BG, border: SEGMENT_OTHER_BORDER }
          const interactive = Boolean(onSegmentClick && seg.jobId !== currentJobId)
          const commonStyle = {
            position: 'absolute' as const,
            left: `${left}%`,
            width: `${width}%`,
            top: BAR_TOP_PX,
            height: BAR_HEIGHT_PX,
            minWidth: 0,
            background: bg,
            border: `1px solid ${border}`,
            borderRadius: 4,
            boxSizing: 'border-box' as const,
            overflow: 'hidden' as const,
            padding: '2px 4px',
            fontSize: '0.6875rem',
            fontFamily: 'inherit',
            fontWeight: 400,
            color: 'var(--text-strong)',
            lineHeight: 1.15,
            cursor: interactive ? ('pointer' as const) : undefined,
          }
          const nameForTitle = seg.tooltipName ?? seg.label
          const title = `${nameForTitle} · ${timeStr} (${JOB_SCHEDULE_TIMEZONE})${
            interactive ? ' — open schedule' : ''
          }`
          if (interactive && onSegmentClick) {
            return (
              <button
                key={seg.id}
                type="button"
                title={title}
                onClick={() => onSegmentClick(seg)}
                style={{
                  ...commonStyle,
                  margin: 0,
                  textAlign: 'left' as const,
                  display: 'flex',
                  cursor: 'pointer',
                }}
              >
                <SegmentInner label={seg.label} timeStr={timeStr} narrow={narrow} />
              </button>
            )
          }
          return (
            <div key={seg.id} title={title} style={{ ...commonStyle, display: 'flex' }}>
              <SegmentInner label={seg.label} timeStr={timeStr} narrow={narrow} />
            </div>
          )
        })}
        {segments.length === 0 ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.8125rem',
              color: 'var(--text-faint)',
            }}
          >
            No blocks this day
          </div>
        ) : null}
      </div>
    </div>
  )
}
