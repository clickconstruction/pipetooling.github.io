import { useId, useMemo, useState } from 'react'
import { manHoursPeriodLabel, manHoursPeriodShortLabel, type ManHoursPeriod, type ManHoursZoom } from '../../lib/manHours/manHoursByPeriod'
import {
  MAN_HOURS_SIDES,
  buildManHoursBars,
  buildManHoursShareLine,
  manHoursSideHours,
  type ManHoursChartBox,
} from '../../lib/manHours/manHoursChart'

/**
 * The Man hours card's picture (v2.4514): hours per period as stacked bars,
 * and under them the office share as its own line on the same columns. Two
 * charts, one scale each. Presentational: `lib/manHours/manHoursChart.ts`
 * places every mark; the card's table holds the same numbers for a reader who
 * cannot use the picture.
 */

const W = 760
const BARS: ManHoursChartBox = { width: W, height: 220, left: 44, right: 10, top: 10, bottom: 24 }
const SHARE: ManHoursChartBox = { width: W, height: 92, left: 44, right: 10, top: 22, bottom: 8 }

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
  const [hoverKey, setHoverKey] = useState<string | null>(null)
  const bars = useMemo(() => buildManHoursBars(periods, BARS), [periods])
  const share = useMemo(() => buildManHoursShareLine(periods, SHARE), [periods])
  const hover = hoverKey ? (periods.find((p) => p.key === hoverKey) ?? null) : null
  const hoverColumn = hoverKey ? (bars.columns.find((c) => c.key === hoverKey) ?? null) : null
  const anyOpen = periods.some((p) => p.soFar)

  const columnLabel = (p: ManHoursPeriod): string =>
    `${manHoursPeriodLabel(p, zoom)}${p.soFar ? ' so far' : ''}: field ${hrs(p.fieldHours)}, office ${hrs(p.officeHours)}, bids ${hrs(p.bidHours)}, not on a job ${hrs(p.unassignedHours)}, total ${hrs(p.totalHours)}, office share ${pct(p.officeShare)}`

  // The tooltip stands beside the column, never on it: to its right in the left half, to its left in the right half.
  const tipOnRight = hoverColumn ? hoverColumn.centerX < W * 0.55 : true
  const tipLeftPct = hoverColumn ? ((tipOnRight ? hoverColumn.slotX + hoverColumn.slotWidth : hoverColumn.slotX) / W) * 100 : 0
  const tipShift = tipOnRight ? '6px' : 'calc(-100% - 6px)'

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.9rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        {MAN_HOURS_SIDES.map((s) => (
          <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center' }}>
            <Swatch color={s.color} hatch={s.key === 'unassigned'} />
            {s.label}
          </span>
        ))}
        {anyOpen ? <span>A faded bar is a period that is not over yet.</span> : null}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <div style={{ position: 'relative', minWidth: 620 }} onMouseLeave={() => setHoverKey(null)}>
          <div style={{ ...captionStyle, marginTop: '0.4rem' }}>Hours</div>
          <svg
            viewBox={`0 0 ${W} ${BARS.height}`}
            role="img"
            aria-label="Hours per period, stacked by field, office, bids and not on a job. The table below holds the same numbers."
            style={{ display: 'block', width: '100%', height: 'auto' }}
          >
            <defs>
              <pattern id={hatchId} width={5} height={5} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width={5} height={5} fill="var(--bg-page)" />
                <rect width={2} height={5} fill="var(--text-faint)" />
              </pattern>
            </defs>
            {bars.axis.ticks.map((t) => (
              <g key={t}>
                <line x1={BARS.left} x2={W - BARS.right} y1={bars.yOf(t)} y2={bars.yOf(t)} stroke="var(--border)" strokeWidth={t === 0 ? 1.2 : 0.6} />
                <text x={BARS.left - 6} y={bars.yOf(t) + 3.5} textAnchor="end" fill="var(--text-faint)" fontSize={10}>
                  {t.toLocaleString('en-US')}
                </text>
              </g>
            ))}
            {bars.columns.map((c, i) => {
              const p = periods[i] as ManHoursPeriod
              const on = c.key === hoverKey
              const picked = c.key === selectedKey
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
                  <rect
                    x={c.slotX + 1}
                    y={BARS.top}
                    width={Math.max(0, c.slotWidth - 2)}
                    height={BARS.height - BARS.top - BARS.bottom}
                    rx={4}
                    fill={picked ? 'var(--bg-blue-tint)' : on ? 'var(--bg-muted)' : 'transparent'}
                  />
                  <g opacity={p.soFar ? 0.6 : 1}>
                    {c.segments.map((s) => {
                      const fill = s.side === 'unassigned' ? `url(#${hatchId})` : (MAN_HOURS_SIDES.find((m) => m.key === s.side)?.color ?? 'var(--text-faint)')
                      // A 2px stroke in the card's ground is the gap between segments and between bars.
                      const common = { fill, stroke: 'var(--bg-page)', strokeWidth: 2 }
                      return s.top ? (
                        <path key={s.side} data-side={s.side} d={roundedTop(c.barX, s.y, c.barWidth, Math.max(1, s.height), 4)} {...common} />
                      ) : (
                        <rect key={s.side} data-side={s.side} x={c.barX} y={s.y} width={c.barWidth} height={Math.max(1, s.height)} {...common} />
                      )
                    })}
                  </g>
                  <text x={c.centerX} y={BARS.height - 8} textAnchor="middle" fill={on || picked ? 'var(--text-strong)' : 'var(--text-faint)'} fontSize={10} fontWeight={on || picked ? 700 : 400}>
                    {manHoursPeriodShortLabel(p, zoom)}
                  </text>
                </g>
              )
            })}
          </svg>

          <div style={{ ...captionStyle, marginTop: '0.35rem' }}>Office share of hours</div>
          <svg
            viewBox={`0 0 ${W} ${SHARE.height}`}
            role="img"
            aria-label="Office share of hours per period: office plus bids, out of all time on a job or a bid. The table below holds the same numbers."
            style={{ display: 'block', width: '100%', height: 'auto' }}
          >
            {share.ticks.map((t, i) => (
              <g key={t}>
                <line x1={SHARE.left} x2={W - SHARE.right} y1={share.yOf(t)} y2={share.yOf(t)} stroke="var(--border)" strokeWidth={i === 0 ? 1.2 : 0.6} />
                <text x={SHARE.left - 6} y={share.yOf(t) + 3.5} textAnchor="end" fill="var(--text-faint)" fontSize={10}>
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
                    <text x={pt.x} y={pt.y - 9} textAnchor="middle" fill="var(--text-strong)" fontSize={10.5} fontWeight={600}>
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
                height={SHARE.height}
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
                left: `${tipLeftPct}%`,
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
    </div>
  )
}
