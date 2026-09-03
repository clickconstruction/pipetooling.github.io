import type { CourseModel } from '../../lib/bridge/courseModel'

/**
 * The chart at the center of the Bridge (v2.2677): cumulative net behind
 * today (solid), the projection ahead (dashed), the destination (dotted), and
 * hazards on the date they land. Presentational SVG; theme tokens for
 * chrome, literal saturated colors for the three lines.
 */

const W = 1100
const H = 300
const ML = 60
const MR = 14
const MT = 16
const MB = 30

const money = (n: number): string => (n === 0 ? '$0' : `${n < 0 ? '−' : ''}$${Math.round(Math.abs(n) / 1000)}k`)

function niceStep(range: number): number {
  const raw = range / 4
  const pow = 10 ** Math.floor(Math.log10(Math.max(1, raw)))
  return [1, 2, 2.5, 5, 10].map((k) => k * pow).find((s) => s >= raw) ?? raw
}

export function BridgeCourseChart({
  model,
  daysBack,
  daysAhead,
  hazards,
}: {
  model: CourseModel
  daysBack: number
  daysAhead: number
  hazards: ReadonlyArray<{ offset: number; label: string; usd: number }>
}) {
  const vals = [...model.track.map((d) => d.cumulativeUsd), ...model.projection.map((p) => p.cumulativeUsd), model.targetEndUsd ?? 0, 0]
  const rawMin = Math.min(...vals)
  const rawMax = Math.max(...vals)
  const pad = Math.max(1000, (rawMax - rawMin) * 0.1)
  const min = rawMin - pad
  const max = rawMax + pad
  const x = (offset: number) => ML + ((offset + daysBack) / (daysBack + daysAhead)) * (W - ML - MR)
  const y = (v: number) => MT + (1 - (v - min) / (max - min)) * (H - MT - MB)
  const step = niceStep(max - min)
  const grid: number[] = []
  for (let g = Math.ceil(min / step) * step; g <= max; g += step) grid.push(g)
  const trackPath = model.track.map((d, i) => `${i ? 'L' : 'M'} ${x(d.offset).toFixed(1)} ${y(d.cumulativeUsd).toFixed(1)}`).join(' ')
  const startV = model.track.length ? (model.track[model.track.length - 1] as { cumulativeUsd: number }).cumulativeUsd : 0
  const projPath = [`M ${x(0).toFixed(1)} ${y(startV).toFixed(1)}`, ...model.projection.map((p) => `L ${x(p.offset).toFixed(1)} ${y(p.cumulativeUsd).toFixed(1)}`)].join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Cumulative net: track behind today, projection ahead, target line, hazards on their dates" style={{ display: 'block', width: '100%', height: 'auto' }}>
      {grid.map((g) => (
        <g key={g}>
          <line x1={ML} y1={y(g)} x2={W - MR} y2={y(g)} stroke={g === 0 ? 'var(--border-strong, var(--border))' : 'var(--border)'} strokeWidth={g === 0 ? 1.5 : 1} />
          <text x={ML - 6} y={y(g) + 3.5} textAnchor="end" fill="var(--text-faint)" fontSize={10} fontFamily="ui-monospace, monospace">
            {money(g)}
          </text>
        </g>
      ))}
      {Array.from({ length: Math.floor((daysBack + daysAhead) / 7) + 1 }, (_, i) => -daysBack + i * 7).map((o) => (
        <g key={o}>
          <line x1={x(o)} y1={H - MB} x2={x(o)} y2={H - MB + 4} stroke="var(--border)" />
          {o % 14 === 0 && (
            <text x={x(o)} y={H - 10} textAnchor="middle" fill="var(--text-faint)" fontSize={10} fontFamily="ui-monospace, monospace">
              {o === 0 ? 'TODAY' : `${o > 0 ? '+' : ''}${o / 7}w`}
            </text>
          )}
        </g>
      ))}
      {model.targetEndUsd != null && (
        <>
          <line x1={x(0)} y1={y(startV)} x2={x(daysAhead)} y2={y(model.targetEndUsd)} stroke="#16a34a" strokeWidth={1.5} strokeDasharray="2 4" />
          <text x={x(daysAhead) - 4} y={y(model.targetEndUsd) - 6} textAnchor="end" fill="#16a34a" fontSize={10.5} fontFamily="ui-monospace, monospace">
            target {money(model.targetEndUsd)}
          </text>
        </>
      )}
      <path d={trackPath} fill="none" stroke="var(--text-strong)" strokeWidth={2} />
      <path d={projPath} fill="none" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="6 4" />
      <line x1={x(0)} y1={MT} x2={x(0)} y2={H - MB} stroke="var(--text-muted)" strokeWidth={1.2} />
      {hazards
        .filter((h) => h.offset >= 0 && h.offset <= daysAhead)
        .map((h) => (
          <g key={`${h.offset}-${h.label}`}>
            <title>{`+${h.offset}d · ${h.label} · $${Math.round(h.usd).toLocaleString('en-US')}`}</title>
            <text x={x(h.offset)} y={H - MB - 4} textAnchor="middle" fill="#dc2626" fontSize={11}>
              ▼
            </text>
          </g>
        ))}
      {model.track.map((d) => (
        <g key={d.ymd}>
          <title>{`${d.ymd} · earned $${Math.round(d.earnedUsd).toLocaleString('en-US')} · direct $${Math.round(d.directUsd).toLocaleString('en-US')} · overhead $${Math.round(d.overheadUsd).toLocaleString('en-US')} · cumulative ${money(d.cumulativeUsd)}`}</title>
          <rect x={x(d.offset) - ((W - ML - MR) / (daysBack + daysAhead)) / 2} y={MT} width={(W - ML - MR) / (daysBack + daysAhead)} height={H - MT - MB} fill="transparent" />
        </g>
      ))}
    </svg>
  )
}
