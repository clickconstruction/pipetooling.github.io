import { useId, useMemo, useState } from 'react'
import { useMeasuredWidth } from '../../hooks/useMeasuredWidth'
import { manHoursPeriodLabel, manHoursPeriodShortLabel, type ManHoursPeriod, type ManHoursZoom } from '../../lib/manHours/manHoursByPeriod'
import {
  MAN_HOURS_SIDES,
  buildManHoursBars,
  buildManHoursShareLine,
  manHoursLabeledColumns,
  manHoursSideHours,
  type ManHoursChartBox,
} from '../../lib/manHours/manHoursChart'

/**
 * The Man hours card's picture (v2.4514): hours per period as stacked bars,
 * and under them the office share as its own line on the same columns. Two
 * charts, one scale each. Presentational: `lib/manHours/manHoursChart.ts`
 * places every mark; the card's table holds the same numbers for a reader who
 * cannot use the picture.
 *
 * Drawn at real pixel size (v2.4516): the chart measures its own width and
 * lays the columns out in it, so type and bar height are the same on a phone
 * and on a wide window, nothing scrolls sideways, and a narrow chart names
 * every nth column counted back from the newest.
 */

/** The width the chart draws at before it has measured itself (and in a test DOM, which has no layout). */
const FALLBACK_WIDTH = 760
const MIN_WIDTH = 260
const BARS_HEIGHT = 220
const SHARE_HEIGHT = 92

const hrs = (h: number): string => `${Math.round(h).toLocaleString('en-US')} h`
const pct = (share: number | null): string => (share == null ? '—' : `${Math.round(share * 100)}%`)

/** A bar segment with its top two corners rounded: the data end, anchored to the stack below. */
function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, h, w / 2))
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`
}

const captionStyle = { fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }
const hatchSwatch = 'repeating-linear-gradient(45deg, var(--text-faint) 0 2px, transparent 2px 4px)'

function Swatch({ color, hatch }: { color: string; hatch?: boolean }) {
  return (
    <i
      aria-hidden
      style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, marginRight: 5, background: hatch ? hatchSwatch : color, border: hatch ? '1px solid var(--text-faint)' : 'none' }}
    />
  )
}

export function ManHoursChart({
  periods,
  zoom,
  selectedKey = null,
  onSelect,
}: {
  periods: readonly ManHoursPeriod[]
  zoom: ManHoursZoom
  /** The period the card's "who" list reads; its column is marked. */
  selectedKey?: string | null
  /** A click (or Enter / Space) on a column picks that period. */
  onSelect?: (key: string) => void
}) {
  const hatchId = useId()
  const [plotRef, measuredWidth] = useMeasuredWidth<HTMLDivElement>()
  const width = Math.max(MIN_WIDTH, Math.round(measuredWidth ?? FALLBACK_WIDTH))
  const [hoverKey, setHoverKey] = useState<string | null>(null)
  const barsBox = useMemo<ManHoursChartBox>(() => ({ width, height: BARS_HEIGHT, left: 44, right: 8, top: 10, bottom: 24 }), [width])
  const shareBox = useMemo<ManHoursChartBox>(() => ({ width, height: SHARE_HEIGHT, left: 44, right: 8, top: 22, bottom: 8 }), [width])
  const bars = useMemo(() => buildManHoursBars(periods, barsBox), [periods, barsBox])
  const share = useMemo(() => buildManHoursShareLine(periods, shareBox), [periods, shareBox])
  const labeled = useMemo(() => {
    const forced = [hoverKey, selectedKey].map((key) => periods.findIndex((p) => p.key === key)).filter((i) => i >= 0)
    return manHoursLabeledColumns(periods.length, bars.columns[0]?.slotWidth ?? 0, zoom, forced)
  }, [periods, bars.columns, zoom, hoverKey, selectedKey])
  const hover = hoverKey ? (periods.find((p) => p.key === hoverKey) ?? null) : null
  const hoverColumn = hoverKey ? (bars.columns.find((c) => c.key === hoverKey) ?? null) : null
  const anyOpen = periods.some((p) => p.soFar)

  const columnLabel = (p: ManHoursPeriod): string =>
    `${manHoursPeriodLabel(p, zoom)}${p.soFar ? ' so far' : ''}: field ${hrs(p.fieldHours)}, office ${hrs(p.officeHours)}, bids ${hrs(p.bidHours)}, not on a job ${hrs(p.unassignedHours)}, total ${hrs(p.totalHours)}, office share ${pct(p.officeShare)}`

  // The tooltip stands beside the column, never on it: to its right in the left half, to its left in the right half.
  const tipOnRight = hoverColumn ? hoverColumn.centerX < width * 0.55 : true
  const tipLeft = hoverColumn ? (tipOnRight ? hoverColumn.centerX + hoverColumn.bandWidth / 2 : hoverColumn.centerX - hoverColumn.bandWidth / 2) : 0
  const tipShift = tipOnRight ? '6px' : 'calc(-100% - 6px)'

  return (
    <div style={{ marginTop: '0.5rem', minWidth: 0 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.9rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        {MAN_HOURS_SIDES.map((s) => (
          <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center' }}>
            <Swatch color={s.color} hatch={s.key === 'unassigned'} />
            {s.label}
          </span>
        ))}
        {anyOpen ? <span>A faded bar is a period that is not over yet.</span> : null}
      </div>

      <div ref={plotRef} style={{ position: 'relative' }} onMouseLeave={() => setHoverKey(null)}>
        <div style={{ ...captionStyle, marginTop: '0.4rem' }}>Hours</div>
        <svg
          viewBox={`0 0 ${width} ${BARS_HEIGHT}`}
          role="img"
          aria-label="Hours per period, stacked by field, office, bids and not on a job. The table below holds the same numbers."
          style={{ display: 'block', width: '100%', height: BARS_HEIGHT }}
        >
          <defs>
            <pattern id={hatchId} width={5} height={5} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width={5} height={5} fill="var(--bg-page)" />
              <rect width={2} height={5} fill="var(--text-faint)" />
            </pattern>
          </defs>
          {bars.axis.ticks.map((t) => (
            <g key={t}>
              <line x1={barsBox.left} x2={width - barsBox.right} y1={bars.yOf(t)} y2={bars.yOf(t)} stroke="var(--border)" strokeWidth={t === 0 ? 1.2 : 0.6} />
              <text x={barsBox.left - 6} y={bars.yOf(t) + 3.5} textAnchor="end" fill="var(--text-faint)" fontSize={11}>
                {t.toLocaleString('en-US')}
              </text>
            </g>
          ))}
          {bars.columns.map((c, i) => {
            const p = periods[i] as ManHoursPeriod
            const on = c.key === hoverKey
            const picked = c.key === selectedKey
            // The band behind a picked or hovered bar, and the same color as the 2px gap around its segments.
            const ground = picked ? 'var(--bg-blue-tint)' : on ? 'var(--bg-muted)' : 'var(--bg-page)'
            return (
              <g
                key={c.key}
                tabIndex={0}
                role={onSelect ? 'button' : 'img'}
                aria-pressed={onSelect ? picked : undefined}
                aria-label={columnLabel(p)}
                data-period={c.key}
                style={{ outline: 'none', cursor: onSelect ? 'pointer' : 'default' }}
                onMouseMove={() => setHoverKey(c.key)}
                onFocus={() => setHoverKey(c.key)}
                onBlur={() => setHoverKey(null)}
                onClick={onSelect ? () => onSelect(c.key) : undefined}
                onKeyDown={
                  onSelect
                    ? (e) => {
                        if (e.key !== 'Enter' && e.key !== ' ') return
                        e.preventDefault()
                        onSelect(c.key)
                      }
                    : undefined
                }
              >
                {/* The whole slot takes the pointer; only the band is painted. */}
                <rect x={c.slotX} y={0} width={c.slotWidth} height={BARS_HEIGHT} fill="transparent" />
                <rect data-band x={c.bandX} y={barsBox.top} width={c.bandWidth} height={BARS_HEIGHT - barsBox.top - barsBox.bottom} rx={4} fill={picked || on ? ground : 'transparent'} />
                <g opacity={p.soFar ? 0.6 : 1}>
                  {c.segments.map((s) => {
                    const fill = s.side === 'unassigned' ? `url(#${hatchId})` : (MAN_HOURS_SIDES.find((m) => m.key === s.side)?.color ?? 'var(--text-faint)')
                    const common = { fill, stroke: ground, strokeWidth: 2 }
                    return s.top ? (
                      <path key={s.side} data-side={s.side} d={roundedTop(c.barX, s.y, c.barWidth, Math.max(1, s.height), 4)} {...common} />
                    ) : (
                      <rect key={s.side} data-side={s.side} x={c.barX} y={s.y} width={c.barWidth} height={Math.max(1, s.height)} {...common} />
                    )
                  })}
                </g>
                {labeled[i] ? (
                  <text x={c.centerX} y={BARS_HEIGHT - 8} textAnchor="middle" fill={on || picked ? 'var(--text-strong)' : 'var(--text-faint)'} fontSize={11} fontWeight={on || picked ? 700 : 400}>
                    {manHoursPeriodShortLabel(p, zoom)}
                  </text>
                ) : null}
              </g>
            )
          })}
        </svg>

        <div style={{ ...captionStyle, marginTop: '0.35rem' }}>Office share of hours</div>
        <svg
          viewBox={`0 0 ${width} ${SHARE_HEIGHT}`}
          role="img"
          aria-label="Office share of hours per period: office plus bids, out of all time on a job or a bid. The table below holds the same numbers."
          style={{ display: 'block', width: '100%', height: SHARE_HEIGHT }}
        >
          {share.ticks.map((t, i) => (
            <g key={t}>
              <line x1={shareBox.left} x2={width - shareBox.right} y1={share.yOf(t)} y2={share.yOf(t)} stroke="var(--border)" strokeWidth={i === 0 ? 1.2 : 0.6} />
              <text x={shareBox.left - 6} y={share.yOf(t) + 3.5} textAnchor="end" fill="var(--text-faint)" fontSize={11}>
                {Math.round(t * 100)}%
              </text>
            </g>
          ))}
          {share.points.length > 1 ? (
            <polyline points={share.points.map((pt) => `${pt.x},${pt.y}`).join(' ')} fill="none" stroke="var(--man-hours-office)" strokeWidth={2} strokeLinejoin="round" />
          ) : null}
          {share.points.map((pt) => {
            const on = pt.key === hoverKey || pt.key === selectedKey
            return (
              <g key={pt.key}>
                <circle cx={pt.x} cy={pt.y} r={on ? 5.5 : 4} fill="var(--man-hours-office)" stroke="var(--bg-page)" strokeWidth={2} opacity={pt.soFar ? 0.6 : 1} />
                {pt.labeled || on ? (
                  <text x={pt.x} y={pt.y - 9} textAnchor="middle" fill="var(--text-strong)" fontSize={11.5} fontWeight={600}>
                    {pct(pt.share)}
                  </text>
                ) : null}
              </g>
            )
          })}
          {bars.columns.map((c) => (
            <rect
              key={c.key}
              x={c.slotX}
              y={0}
              width={c.slotWidth}
              height={SHARE_HEIGHT}
              fill="transparent"
              style={{ cursor: onSelect ? 'pointer' : 'default' }}
              onMouseMove={() => setHoverKey(c.key)}
              onClick={onSelect ? () => onSelect(c.key) : undefined}
            />
          ))}
        </svg>

        {hover && hoverColumn ? (
          <div
            role="status"
            style={{
              position: 'absolute',
              left: tipLeft,
              top: 28,
              transform: `translateX(${tipShift})`,
              pointerEvents: 'none',
              background: 'var(--surface)',
              border: '1px solid var(--border-strong)',
              color: 'var(--text-strong)',
              borderRadius: 6,
              padding: '0.4rem 0.55rem',
              fontSize: '0.75rem',
              lineHeight: 1.45,
              whiteSpace: 'nowrap',
              boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
              zIndex: 3,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <strong>
              {manHoursPeriodLabel(hover, zoom)}
              {hover.soFar ? ' (so far)' : ''}
            </strong>
            {MAN_HOURS_SIDES.filter((s) => s.key !== 'unassigned' || hover.unassignedHours >= 0.5).map((s) => (
              <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  <Swatch color={s.color} hatch={s.key === 'unassigned'} />
                  {s.label}
                </span>
                <span>{hrs(manHoursSideHours(hover, s.key))}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontWeight: 700 }}>
              <span>Total</span>
              <span>{hrs(hover.totalHours)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Office share</span>
              <span>{pct(hover.officeShare)}</span>
            </div>
            {hover.pendingHours >= 0.5 ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', color: 'var(--text-amber-800)' }}>
                <span>Waiting for approval</span>
                <span>{hrs(hover.pendingHours)}</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
