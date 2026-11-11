import { useState, type CSSProperties } from 'react'
import type { ProfitPanel } from '../../lib/bridge/profitPanel'
import { Link } from 'react-router-dom'

/**
 * Profit after overhead (v2.6840, punch list #303): the breakdown under the
 * eight week chart behind Money, opened by *What is left after overhead*. It
 * is the Daily profit rate panel (link PR 9) without its card: what a day
 * keeps, where a day's money goes, break-even, the pay weeks, and where each
 * number comes from behind one more press.
 *
 * Since v2.6965 it reads recorded time, as the headline does: the day's
 * figure carries ≈ while waiting hours move it, and the line under it says
 * how many hours are counted and what approved hours alone read. When the
 * recorded hours cannot be read it is the approved reading, with its warning
 * first.
 */

const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const det: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const shortK = (n: number): string => `${n < 0 ? '−' : ''}$${(Math.abs(n) / 1000).toFixed(Math.abs(n) >= 100_000 ? 0 : 1)}k`
const money = (n: number): string => `${n < 0 ? '−' : ''}$${Math.round(Math.abs(n)).toLocaleString('en-US')}`

function Trend({ weeks }: { weeks: ProfitPanel['weeks'] }) {
  const n = Math.max(1, weeks.length)
  const slot = 660 / n
  const cx = (i: number) => 40 + slot * i + slot / 2
  const barW = Math.min(44, slot * 0.6)
  const vals = weeks.flatMap((w) => [w.earnedUsd, w.costsUsd, w.netUsd, 0])
  const yMax = Math.max(1000, ...vals)
  const yMin = Math.min(0, ...vals)
  const py = (v: number) => 20 + ((yMax - v) / (yMax - yMin)) * 180
  const ticks = [yMax, (yMax + yMin) / 2, yMin].map((v) => Math.round(v / 1000) * 1000)
  return (
    <svg viewBox="0 0 720 232" role="img" aria-label="Earned against costs by pay week, with the net as bars" style={{ width: '100%', height: 'auto', display: 'block' }} data-testid="bridge-profit-trend">
      <defs>
        <pattern id="bridgeProfitHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="3" height="6" fill="#fca5a5" />
        </pattern>
      </defs>
      {ticks.map((v) => (
        <g key={v}>
          <line x1="40" x2="700" y1={py(v)} y2={py(v)} stroke="var(--border)" strokeWidth="1" />
          <text x="36" y={py(v)} fontSize="10" fill="var(--text-muted)" textAnchor="end" dominantBaseline="middle">
            {v === 0 ? '0' : shortK(v)}
          </text>
        </g>
      ))}
      <line x1="40" x2="700" y1={py(0)} y2={py(0)} stroke="var(--text-muted)" strokeWidth="1" />
      {weeks.map((w, i) => {
        const top = py(Math.max(w.netUsd, 0))
        const bot = py(Math.min(w.netUsd, 0))
        const fill = w.waiting ? 'url(#bridgeProfitHatch)' : w.netUsd >= 0 ? '#86efac' : '#fca5a5'
        const color = w.netUsd >= 0 ? 'var(--text-green-700)' : 'var(--text-red-700)'
        return (
          <g key={w.start}>
            <rect x={cx(i) - barW / 2} y={top} width={barW} height={Math.max(1, bot - top)} fill={fill} rx="2" />
            <text x={cx(i)} y={w.netUsd >= 0 ? top - 5 : bot + 13} fontSize="11" fontWeight="700" fill={color} textAnchor="middle">
              {w.netUsd >= 0 ? '+' : ''}
              {shortK(w.netUsd)}
              {w.waiting ? ' ≈' : ''}
            </text>
            <text x={cx(i)} y="226" fontSize="10" fill="var(--text-muted)" textAnchor="middle">
              {w.label}
            </text>
          </g>
        )
      })}
      <polyline points={weeks.map((w, i) => `${cx(i).toFixed(1)},${py(w.earnedUsd).toFixed(1)}`).join(' ')} fill="none" stroke="var(--text-green-700)" strokeWidth="2" />
      <polyline points={weeks.map((w, i) => `${cx(i).toFixed(1)},${py(w.costsUsd).toFixed(1)}`).join(' ')} fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeDasharray="4 3" />
    </svg>
  )
}

function Waterfall({ bars }: { bars: ProfitPanel['waterfall'] }) {
  let run = 0
  const points = bars.map((b) => {
    const from = b.kind === 'total' ? 0 : run
    const to = b.kind === 'total' ? b.usd : run + b.usd
    if (b.kind !== 'total') run = to
    return { ...b, from, to }
  })
  const vals = points.flatMap((p) => [p.from, p.to])
  const yMax = Math.max(1, ...vals)
  const yMin = Math.min(0, ...vals)
  const py = (v: number) => 16 + ((yMax - v) / (yMax - yMin)) * 160
  const n = points.length
  return (
    <svg viewBox="0 0 520 200" role="img" aria-label="Waterfall from earned per day through each cost to the daily profit rate" style={{ width: '100%', height: 'auto', display: 'block' }} data-testid="bridge-profit-waterfall">
      <line x1="10" x2="510" y1={py(0)} y2={py(0)} stroke="var(--text-muted)" strokeWidth="1" />
      {points.map((p, i) => {
        const cxp = 10 + (500 / n) * i + 500 / (2 * n)
        const top = Math.min(py(p.from), py(p.to))
        const bot = Math.max(py(p.from), py(p.to))
        const fill = p.kind === 'total' ? (p.usd < 0 ? '#fca5a5' : '#86efac') : p.usd >= 0 ? '#86efac' : 'var(--border)'
        const color = p.kind === 'total' ? (p.usd < 0 ? 'var(--text-red-700)' : 'var(--text-green-700)') : p.usd >= 0 ? 'var(--text-green-700)' : 'var(--text-muted)'
        return (
          <g key={p.label}>
            <rect x={cxp - 30} y={top} width={60} height={Math.max(1, bot - top)} fill={fill} rx="2" />
            <text x={cxp} y={top - 4} fontSize="11" fontWeight="700" fill={color} textAnchor="middle">
              {p.usd < 0 ? '−' : p.kind === 'total' ? '+' : ''}
              {money(Math.abs(p.usd))}
            </text>
            <text x={cxp} y="194" fontSize="10" fill="var(--text-muted)" textAnchor="middle">
              {p.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function BridgeProfitPanel({ panel }: { panel: ProfitPanel }) {
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const made = panel.left.usd >= 0
  const warn = panel.warn && (
    <div style={{ fontSize: '0.84rem', padding: '0.4rem 0.6rem', borderRadius: 8, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', border: '1px solid var(--border-amber)' }} data-testid="bridge-profit-warn">
      {panel.warn}
    </div>
  )
  return (
    <section style={{ border: '1px solid var(--border-strong)', borderRadius: 10, padding: '0.7rem 0.9rem', marginTop: '0.5rem', display: 'grid', gap: '0.55rem', minWidth: 0 }} data-testid="bridge-profit-panel">
      <div style={label}>Profit after overhead · last {panel.left.days} days</div>
      {/* A reading that is low stands behind its warning; a reading that counts the waiting hours leads with its figure. */}
      {panel.reading === 'approved' && warn}
      <div style={{ fontSize: '1.35rem', fontWeight: 800, lineHeight: 1.15, color: made ? 'var(--text-green-700)' : 'var(--text-red-700)', fontVariantNumeric: 'tabular-nums' }} data-testid="bridge-profit-left">
        {money(panel.left.usd)}
        {panel.left.approx ? ' ≈' : ''} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>a day {made ? 'left after every cost' : 'short after every cost'}</span>
      </div>
      {panel.reading === 'recorded' && warn}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: '0.6rem 1.4rem', alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={label}>Where a day's money goes</div>
          <Waterfall bars={panel.waterfall} />
          <div style={{ fontSize: '0.84rem', marginTop: 4 }} data-testid="bridge-profit-breakeven">
            {panel.breakEven}
          </div>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={label}>Earned against costs, by pay week</div>
          <Trend weeks={panel.weeks} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.9rem', ...det }}>
            <span>
              <span style={{ display: 'inline-block', width: 18, height: 3, background: 'var(--text-green-700)', verticalAlign: 'middle' }} /> earned
            </span>
            <span>
              <span style={{ display: 'inline-block', width: 18, height: 0, borderTop: '2px dashed var(--text-muted)', verticalAlign: 'middle' }} /> costs
            </span>
            <span>the bar is what was left; a hatched week still has hours waiting</span>
          </div>
          <div style={{ fontSize: '0.84rem', marginTop: 4 }} data-testid="bridge-profit-eight">
            {panel.eightWeeks}
          </div>
        </div>
      </div>
      <div>
        <button type="button" onClick={() => setSourcesOpen((o) => !o)} aria-expanded={sourcesOpen} data-testid="bridge-profit-sources-toggle" style={{ font: 'inherit', fontSize: '0.8rem', padding: 0, minHeight: 32, border: 'none', background: 'transparent', color: 'var(--text-link)', cursor: 'pointer' }}>
          Where each number comes from {sourcesOpen ? '▴' : '›'}
        </button>
        {sourcesOpen && (
          <ul style={{ listStyle: 'none', margin: '0.2rem 0 0', padding: 0, fontSize: '0.8rem' }} data-testid="bridge-profit-sources">
            {panel.sources.map((r) => (
              <li key={r.input} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.1rem 0.8rem', alignItems: 'baseline', padding: '0.35rem 0', borderTop: '1px solid var(--border)' }}>
                <b style={{ flex: '0 0 5.5rem' }}>{r.input}</b>
                <span style={{ flex: '1 1 14rem', minWidth: 0, color: 'var(--text-muted)' }}>{r.from}</span>
                <span style={{ flex: '1 1 12rem', minWidth: 0, color: r.tone === 'green' ? 'var(--text-green-700)' : 'var(--text-amber-800)' }}>{r.risk}</span>
                <Link to={r.door.to} style={{ whiteSpace: 'nowrap' }}>
                  {r.door.label} ›
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
