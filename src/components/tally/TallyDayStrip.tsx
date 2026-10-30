import type { CSSProperties } from 'react'
import { formatDenverTimeOnly } from '../../utils/dateUtils'
import { tallyTickPlaceWords, type TallyDayStrip as TallyDayStripModel, type TallyTickPlace } from '../../lib/tally/tallyDayStrip'

/**
 * The holder's day drawn at the top of a Team queue day card (punch list #217, jobs-money-3; a
 * prototype behind the queue's *Day strip* switch). Sessions are bars in their job's colour with
 * the job's number, schedule blocks hollow bars above them, each charge a tick at its swipe with
 * its amount over it, the hours under. A press on a tick goes to the charge's line. The shape is
 * the My time day editor's sessions on an hours axis (`MyTimeDayClusterVisual`) laid sideways;
 * that editor's strip is a slider with its own split state, so the drawing is redone here as a
 * plain picture over `tallyDayStrip.ts`.
 */

const LABEL_ROW_H = 14
const SCHEDULED_LANE_H = 8
const BAR_LANE_H = 22
const HOURS_H = 14
const LANES_TOP = LABEL_ROW_H * 2 + 2
const LANES_H = SCHEDULED_LANE_H + 3 + BAR_LANE_H

const money = (n: number) =>
  Math.abs(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** A label at `pct` stays on the strip: the first ones hang right, the last ones left. */
function labelShift(pct: number): string {
  if (pct < 8) return 'translateX(0)'
  if (pct > 92) return 'translateX(-100%)'
  return 'translateX(-50%)'
}

/** A bar's width as a share of the strip, never under half a percent so a short session still shows. */
function barWidthPct(b: { startPct: number; endPct: number }): number {
  return Math.max(0.5, Math.round((b.endPct - b.startPct) * 10) / 10)
}

function tickColour(place: TallyTickPlace): string {
  return place.kind === 'inside' || place.kind === 'scheduled' ? 'var(--text-strong)' : 'var(--text-amber-800)'
}

export type TallyDayStripProps = {
  strip: TallyDayStripModel
  holderName: string
  /** The job's short name for a bar and the words: "JP101". */
  name: (jobId: string) => string
  onPressTick: (chargeId: string) => void
}

export function TallyDayStrip({ strip, holderName, name, onPressTick }: TallyDayStripProps) {
  const lanes: CSSProperties = { position: 'absolute', left: 0, right: 0 }
  return (
    <div
      data-testid="tally-day-strip"
      role="group"
      aria-label={`${holderName}’s day, ${formatDenverTimeOnly(strip.startMs)} to ${formatDenverTimeOnly(strip.endMs)}`}
      style={{ position: 'relative', height: LANES_TOP + LANES_H + HOURS_H, margin: '0.5rem 0 0.2rem', fontFamily: 'inherit' }}
    >
      {/* The amounts over the ticks: two rows when two swipes sit close, one label with a count for a crowd. */}
      {strip.labels.map((l, i) => (
        <span
          key={`label-${i}`}
          aria-hidden
          data-testid="tally-day-strip-label"
          style={{
            position: 'absolute',
            left: `${l.pct}%`,
            top: l.row * LABEL_ROW_H,
            transform: labelShift(l.pct),
            whiteSpace: 'nowrap',
            fontSize: '0.6875rem',
            fontWeight: 700,
            lineHeight: `${LABEL_ROW_H}px`,
            fontVariantNumeric: 'tabular-nums',
            color: 'var(--text-strong)',
            pointerEvents: 'none',
          }}
        >
          {l.count === 1 ? money(l.amount) : `${l.count} · ${money(l.amount)}`}
        </span>
      ))}

      {/* Schedule blocks: hollow bars in the job's colour. */}
      <div style={{ ...lanes, top: LANES_TOP, height: SCHEDULED_LANE_H }} aria-hidden>
        {strip.bars
          .filter((b) => b.kind === 'scheduled')
          .map((b, i) => (
            <div
              key={`sched-${b.jobId}-${i}`}
              data-testid="tally-day-strip-bar"
              data-kind="scheduled"
              data-job={b.jobId}
              title={`Scheduled on ${name(b.jobId)}, ${formatDenverTimeOnly(b.startMs)} to ${formatDenverTimeOnly(b.endMs)}`}
              style={{
                position: 'absolute',
                left: `${b.startPct}%`,
                width: `${barWidthPct(b)}%`,
                top: 0,
                height: SCHEDULED_LANE_H,
                boxSizing: 'border-box',
                border: `1px dashed var(--timeline-job-${b.colour})`,
                borderRadius: 3,
                background: 'transparent',
              }}
            />
          ))}
      </div>

      {/* Clock sessions: solid bars with the job's number; the day's axis under them. */}
      <div style={{ ...lanes, top: LANES_TOP + SCHEDULED_LANE_H + 3, height: BAR_LANE_H, borderBottom: '1px solid var(--border)' }}>
        {strip.bars
          .filter((b) => b.kind === 'clocked')
          .map((b, i) => (
            <div
              key={`clock-${b.jobId}-${i}`}
              data-testid="tally-day-strip-bar"
              data-kind="clocked"
              data-job={b.jobId}
              data-open={b.open ? 'true' : undefined}
              title={
                b.open
                  ? `${name(b.jobId)}, clocked in ${formatDenverTimeOnly(b.startMs)}, no clock-out`
                  : `${name(b.jobId)}, ${formatDenverTimeOnly(b.startMs)} to ${formatDenverTimeOnly(b.endMs)}`
              }
              style={{
                position: 'absolute',
                left: `${b.startPct}%`,
                width: `${barWidthPct(b)}%`,
                top: 0,
                height: BAR_LANE_H - 2,
                boxSizing: 'border-box',
                borderRadius: 4,
                background: `var(--timeline-job-${b.colour})`,
                color: 'var(--surface)',
                borderRight: b.open ? '3px dotted var(--surface)' : undefined,
                padding: '0 5px',
                fontSize: '0.6875rem',
                fontWeight: 700,
                lineHeight: `${BAR_LANE_H - 2}px`,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {name(b.jobId)}
            </div>
          ))}
        {strip.nowPct != null ? (
          <div
            aria-hidden
            data-testid="tally-day-strip-now"
            style={{ position: 'absolute', left: `${strip.nowPct}%`, top: -SCHEDULED_LANE_H - 3, bottom: 0, width: 1, background: 'var(--text-blue-700)' }}
          />
        ) : null}
      </div>

      {/* Each charge a tick at its swipe; the press goes to its line. */}
      {strip.ticks.map((t) => (
        <button
          key={`tick-${t.chargeId}`}
          type="button"
          data-testid="tally-day-strip-tick"
          data-place={t.place.kind}
          aria-label={`${formatDenverTimeOnly(t.ms)}, ${money(t.amount)}, ${tallyTickPlaceWords(t.place, name)}`}
          onClick={() => onPressTick(t.chargeId)}
          style={{
            position: 'absolute',
            left: `${t.pct}%`,
            top: LANES_TOP - 4,
            height: LANES_H + 8,
            width: 22,
            transform: 'translateX(-50%)',
            padding: 0,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <span aria-hidden style={{ width: 7, height: 7, borderRadius: 7, background: tickColour(t.place), flexShrink: 0 }} />
          <span aria-hidden style={{ width: 2, flex: 1, background: tickColour(t.place) }} />
        </button>
      ))}

      {/* The hours. */}
      <div style={{ ...lanes, top: LANES_TOP + LANES_H, height: HOURS_H }} aria-hidden>
        {strip.hours.map((h) => (
          <span
            key={`hour-${h.hour}`}
            style={{
              position: 'absolute',
              left: `${h.pct}%`,
              top: 0,
              transform: h.label ? labelShift(h.pct) : 'translateX(-50%)',
              fontSize: '0.625rem',
              lineHeight: `${HOURS_H}px`,
              color: 'var(--text-faint)',
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
              borderLeft: h.label ? undefined : '1px solid var(--border)',
              height: h.label ? undefined : 4,
            }}
          >
            {h.label ?? ''}
          </span>
        ))}
      </div>
    </div>
  )
}
