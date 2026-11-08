/**
 * Eight weeks as bars: each bar a pay week's recorded hours against the hours the person could
 * work, the dashed line the 100 percent mark, the current week hatched because it is still
 * running. The colours are the band's: red over, green full, blue steady, amber light, grey
 * nothing. Pure drawing over `PersonWeek[]`; the title on each bar carries the numbers.
 */
import type { CSSProperties } from 'react'
import { formatPayWeekLabel } from '../../lib/payWeekAnchor'
import { hoursOfWords, type PersonWeek } from '../../lib/people/utilization'
import { BAND_FILL } from '../../lib/people/utilizationColors'

const BAR_W = 10
const GAP = 4
const H = 36
/** A bar is cut at 150 percent so one wild week does not flatten the rest. */
const CAP_PCT = 150

export function UtilizationWeekBars({ weeks, height = H, style }: { weeks: readonly PersonWeek[]; height?: number; style?: CSSProperties }) {
  const width = weeks.length * (BAR_W + GAP) - GAP
  const lineY = Math.round(height - (100 / CAP_PCT) * (height - 2))
  const hatchId = `util-hatch-${Math.random().toString(36).slice(2, 8)}`
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${weeks.length} weeks of hours against the hours they can work`} style={{ display: 'block', overflow: 'visible', ...style }}>
      <defs>
        <pattern id={hatchId} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="2" height="4" fill="currentColor" />
        </pattern>
      </defs>
      <line x1={0} x2={width} y1={lineY + 0.5} y2={lineY + 0.5} stroke="var(--text-muted)" strokeDasharray="2 2" strokeWidth={1} />
      {weeks.map((w, i) => {
        const x = i * (BAR_W + GAP)
        const pct = Math.min(CAP_PCT, Math.max(0, w.pct ?? 0))
        const barH = w.workedHours > 0 ? Math.max(2, Math.round((pct / CAP_PCT) * (height - 2))) : 0
        const fill = BAND_FILL[w.band]
        const title = `${formatPayWeekLabel(w.week)}: ${hoursOfWords(w.workedHours, w.availableHours)}${w.pct != null ? `, ${w.pct} percent` : ''}${w.longDays ? `, ${w.longDays} long day${w.longDays === 1 ? '' : 's'}` : ''}${w.partial ? ' (this week so far)' : ''}`
        return (
          <g key={w.week.start}>
            <title>{title}</title>
            <rect x={x} y={0} width={BAR_W} height={height} fill="var(--bg-subtle)" rx={2} />
            {barH > 0 ? <rect x={x} y={height - barH} width={BAR_W} height={barH} fill={fill} rx={2} opacity={w.partial ? 0.55 : 1} /> : null}
            {w.partial && barH > 0 ? <rect x={x} y={height - barH} width={BAR_W} height={barH} fill={`url(#${hatchId})`} rx={2} style={{ color: 'var(--surface)' }} opacity={0.6} /> : null}
          </g>
        )
      })}
    </svg>
  )
}
