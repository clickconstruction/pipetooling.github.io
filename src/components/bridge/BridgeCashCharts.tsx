import type { NetPositionDay } from '../../lib/bridge/netPosition'
import type { CashForecast } from '../../lib/bridge/cashForecast'

/**
 * The Bridge's two charts (v2.2726): net position behind today (solid) and
 * the cash forecast ahead (dashed, with bills ▼ and receipts ▲ on their
 * dates and the floor dotted). Presentational SVG; theme tokens for chrome.
 */

const W = 1100
const ML = 62
const MR = 14
const MT = 16
const MB = 30

const money = (n: number): string => (n === 0 ? '$0' : `${n < 0 ? '−' : ''}$${Math.round(Math.abs(n) / 1000)}k`)

function niceStep(range: number): number {
  const raw = range / 4
  const pow = 10 ** Math.floor(Math.log10(Math.max(1, raw)))
  return [1, 2, 2.5, 5, 10].map((k) => k * pow).find((s) => s >= raw) ?? raw
}

function frame(vals: number[], H: number) {
  const rawMin = Math.min(...vals)
  const rawMax = Math.max(...vals)
  const pad = Math.max(2000, (rawMax - rawMin) * 0.12)
  const min = rawMin - pad
  const max = rawMax + pad
  const y = (v: number) => MT + (1 - (v - min) / (max - min)) * (H - MT - MB)
  const step = niceStep(max - min)
  const grid: number[] = []
  for (let g = Math.ceil(min / step) * step; g <= max; g += step) grid.push(g)
  return { min, max, y, grid }
}

function Grid({ grid, y }: { grid: number[]; y: (v: number) => number }) {
  return (
    <>
      {grid.map((g) => (
        <g key={g}>
          <line x1={ML} y1={y(g)} x2={W - MR} y2={y(g)} stroke="var(--border)" strokeWidth={g === 0 ? 1.5 : 1} />
          <text x={ML - 6} y={y(g) + 3.5} textAnchor="end" fill="var(--text-faint)" fontSize={10} fontFamily="ui-monospace, monospace">
            {money(g)}
          </text>
        </g>
      ))}
    </>
  )
}

export function BridgeNetPositionChart({ history }: { history: NetPositionDay[] }) {
  const H = 200
  if (history.length === 0) return null
  const n = history.length
  const { y, grid } = frame(history.map((d) => d.netUsd), H)
  const x = (i: number) => ML + (i / Math.max(1, n - 1)) * (W - ML - MR)
  const path = history.map((d, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(d.netUsd).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Net position over the last eight weeks" style={{ display: 'block', width: '100%', height: 'auto' }}>
      <Grid grid={grid} y={y} />
      {history.map((d, i) =>
        d.offset % 7 === 0 ? (
          <text key={d.ymd} x={x(i)} y={H - 10} textAnchor="middle" fill="var(--text-faint)" fontSize={10} fontFamily="ui-monospace, monospace">
            {d.offset === 0 ? 'TODAY' : `${d.offset / 7}w`}
          </text>
        ) : null,
      )}
      <path d={path} fill="none" stroke="var(--text-strong)" strokeWidth={2} />
      {history.map((d, i) => (
        <g key={`t${d.ymd}`}>
          <title>{`${d.ymd} · net ${money(d.netUsd)} = cash ${money(d.cashUsd)} + owed to you ${money(d.arUsd)} − owed by you ${money(d.apUsd)}`}</title>
          <rect x={x(i) - (W - ML - MR) / n / 2} y={MT} width={(W - ML - MR) / n} height={H - MT - MB} fill="transparent" />
        </g>
      ))}
    </svg>
  )
}

export function BridgeCashChart({ forecast, cashTodayUsd }: { forecast: CashForecast; cashTodayUsd: number }) {
  const H = 230
  const n = forecast.days.length
  if (n === 0) return null
  const { y, grid } = frame([cashTodayUsd, ...forecast.days.map((d) => d.cashUsd), forecast.floorUsd], H)
  const x = (o: number) => ML + (o / n) * (W - ML - MR)
  const path = [`M ${x(0).toFixed(1)} ${y(cashTodayUsd).toFixed(1)}`, ...forecast.days.map((d) => `L ${x(d.offset).toFixed(1)} ${y(d.cashUsd).toFixed(1)}`)].join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Cash forecast for the next eight weeks with bills and receipts on their dates" style={{ display: 'block', width: '100%', height: 'auto' }}>
      <Grid grid={grid} y={y} />
      {Array.from({ length: Math.floor(n / 7) + 1 }, (_, i) => i * 7).map((o) => (
        <text key={o} x={x(o)} y={H - 10} textAnchor="middle" fill="var(--text-faint)" fontSize={10} fontFamily="ui-monospace, monospace">
          {o === 0 ? 'TODAY' : `+${o / 7}w`}
        </text>
      ))}
      <line x1={ML} y1={y(forecast.floorUsd)} x2={W - MR} y2={y(forecast.floorUsd)} stroke="#dc2626" strokeWidth={1.5} strokeDasharray="2 4" />
      <text x={W - MR} y={y(forecast.floorUsd) - 5} textAnchor="end" fill="#dc2626" fontSize={10.5} fontFamily="ui-monospace, monospace">
        floor {money(forecast.floorUsd)}
      </text>
      <path d={path} fill="none" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="6 4" />
      {forecast.days.map((d) => (
        <g key={d.ymd}>
          <title>{`${d.ymd} · cash ${money(d.cashUsd)}${d.billsUsd ? ` · bills −$${Math.round(d.billsUsd).toLocaleString('en-US')}` : ''}${d.receiptsUsd ? ` · receipts +$${Math.round(d.receiptsUsd).toLocaleString('en-US')}` : ''}`}</title>
          <rect x={x(d.offset) - (W - ML - MR) / n / 2} y={MT} width={(W - ML - MR) / n} height={H - MT - MB} fill="transparent" />
          {d.billsUsd > 0 && (
            <text x={x(d.offset)} y={H - MB - 4} textAnchor="middle" fill="#dc2626" fontSize={11}>
              ▼
            </text>
          )}
          {d.receiptsUsd > 0 && (
            <text x={x(d.offset)} y={MT + 10} textAnchor="middle" fill="#16a34a" fontSize={11}>
              ▲
            </text>
          )}
        </g>
      ))}
      <circle cx={x(forecast.lowest.offset)} cy={y(forecast.lowest.cashUsd)} r={4} fill="#8b5cf6" stroke="var(--surface)" strokeWidth={2} />
    </svg>
  )
}
