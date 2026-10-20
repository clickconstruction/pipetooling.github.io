import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { PanelBar, PanelSourceRow } from '../../lib/bridge/netCashPanels'

/**
 * A breakdown behind a chart (link PR 11): a waterfall, the sources table,
 * and one closing line. Used by the net position and cash sections.
 */

const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const det: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const cap: CSSProperties = { fontSize: '0.62rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const shortK = (n: number): string => `${n < 0 ? '−' : ''}$${Math.abs(n) >= 1000 ? `${(Math.abs(n) / 1000).toFixed(Math.abs(n) >= 100_000 ? 0 : 1)}k` : Math.round(Math.abs(n)).toLocaleString('en-US')}`

const FILL: Record<NonNullable<PanelBar['fill']>, string> = { green: '#86efac', grey: 'var(--border)', amber: '#fcd34d', blue: '#93c5fd', red: '#fca5a5' }

export function BreakdownWaterfall({ bars, testId }: { bars: PanelBar[]; testId: string }) {
  let run = 0
  const points = bars.map((b) => {
    const from = b.kind === 'total' ? 0 : run
    const to = b.kind === 'total' ? b.usd : run + b.usd
    run = to
    return { ...b, from, to }
  })
  const vals = points.flatMap((p) => [p.from, p.to])
  const yMax = Math.max(1, ...vals)
  const yMin = Math.min(0, ...vals)
  const py = (v: number) => 16 + ((yMax - v) / (yMax - yMin)) * 160
  const n = points.length
  const w = Math.min(60, (500 / n) * 0.7)
  return (
    <svg viewBox="0 0 520 200" role="img" aria-label="A waterfall from the first bar through each step to the last" style={{ width: '100%', height: 'auto', display: 'block' }} data-testid={testId}>
      <line x1="10" x2="510" y1={py(0)} y2={py(0)} stroke="var(--text-muted)" strokeWidth="1" />
      {points.map((p, i) => {
        const cxp = 10 + (500 / n) * i + 500 / (2 * n)
        const top = Math.min(py(p.from), py(p.to))
        const bot = Math.max(py(p.from), py(p.to))
        const fill = p.fill ? FILL[p.fill] : p.kind === 'total' ? FILL.blue : p.usd >= 0 ? FILL.green : p.usd < 0 && p.label !== 'cash' ? FILL.grey : FILL.red
        const color = p.kind === 'total' ? '#1d4ed8' : p.usd >= 0 ? 'var(--text-green-700)' : 'var(--text-muted)'
        return (
          <g key={`${p.label}-${i}`}>
            <rect x={cxp - w / 2} y={top} width={w} height={Math.max(1.5, bot - top)} fill={fill} rx="2" />
            <text x={cxp} y={top - 4} fontSize="10" fontWeight="700" fill={color} textAnchor="middle">
              {p.usd < 0 ? '−' : ''}
              {shortK(Math.abs(p.usd))}
            </text>
            <text x={cxp} y="194" fontSize="9" fill="var(--text-muted)" textAnchor="middle">
              {p.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function BreakdownSources({ rows }: { rows: PanelSourceRow[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '90px minmax(0, 1.1fr) minmax(0, 1fr) auto', gap: '0.2rem 0.6rem', fontSize: '0.78rem', alignItems: 'baseline', marginTop: 4 }}>
      <span style={cap}>input</span>
      <span style={cap}>read from</span>
      <span style={cap}>what can be wrong</span>
      <span />
      {rows.map((r) => (
        <span key={r.input} style={{ display: 'contents' }}>
          <span style={{ borderTop: '1px solid var(--border)', paddingTop: 4, fontWeight: 700 }}>{r.input}</span>
          <span style={{ borderTop: '1px solid var(--border)', paddingTop: 4, color: 'var(--text-muted)' }}>{r.from}</span>
          <span style={{ borderTop: '1px solid var(--border)', paddingTop: 4, color: r.tone === 'green' ? 'var(--text-green-700)' : r.tone === 'red' ? 'var(--text-red-700)' : 'var(--text-amber-800)' }}>{r.risk}</span>
          <Link to={r.door.to} style={{ borderTop: '1px solid var(--border)', paddingTop: 4, whiteSpace: 'nowrap' }}>
            {r.door.label}
          </Link>
        </span>
      ))}
    </div>
  )
}

export function BridgeBreakdownPanel({ title, sub, bars, sources, closing, testId }: { title: string; sub: string; bars: PanelBar[]; sources: PanelSourceRow[]; closing: string; testId: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)', gap: '0.6rem 1.4rem', paddingTop: '0.6rem', marginTop: '0.5rem', borderTop: '1px solid var(--border)' }} data-testid={testId}>
      <div>
        <div style={label}>{title}</div>
        <div style={{ ...det, marginBottom: 4 }}>{sub}</div>
        <BreakdownWaterfall bars={bars} testId={`${testId}-waterfall`} />
      </div>
      <div>
        <div style={label}>Where each number comes from, and what can make it wrong</div>
        <BreakdownSources rows={sources} />
      </div>
      <div style={{ gridColumn: '1 / -1', fontSize: '0.85rem', padding: '0.45rem 0.6rem', borderRadius: 6, background: 'var(--bg-blue-tint, transparent)', border: '1px solid var(--border)' }} data-testid={`${testId}-closing`}>
        {closing}
      </div>
    </div>
  )
}
