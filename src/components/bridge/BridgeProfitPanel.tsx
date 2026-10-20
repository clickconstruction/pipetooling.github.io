import type { CSSProperties } from 'react'
import type { ProfitPanel } from '../../lib/bridge/profitPanel'
import { Link } from 'react-router-dom'

/**
 * The Daily profit rate panel (link PR 9): opens under the three cards when
 * the profit card is pressed. Four parts: the trend by pay week, where a
 * day's money goes, where each number comes from, and break-even.
 */

const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const det: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const cap: CSSProperties = { fontSize: '0.62rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }
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

export function BridgeProfitPanel({ panel, onClose }: { panel: ProfitPanel; onClose: () => void }) {
  return (
    <section style={{ background: 'var(--surface)', border: '2px solid #2563eb', borderRadius: 10, padding: '0.8rem 1rem', marginTop: '0.6rem', display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(260px, 1fr)', gap: '0.6rem 1.4rem', alignItems: 'start' }} data-testid="bridge-profit-panel">
      <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'baseline', gap: '0.8rem' }}>
        <span style={label}>Earned against costs, by pay week</span>
        <span style={det}>the net is the bar; a hatched week is missing hours that wait for approval</span>
        <button type="button" onClick={onClose} aria-label="Close" style={{ marginLeft: 'auto', width: 24, height: 24, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer', font: 'inherit', lineHeight: 1 }}>
          ×
        </button>
      </div>
      <Trend weeks={panel.weeks} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.9rem', ...det }}>
          <span>
            <span style={{ display: 'inline-block', width: 18, height: 3, background: 'var(--text-green-700)', verticalAlign: 'middle' }} /> earned
          </span>
          <span>
            <span style={{ display: 'inline-block', width: 18, height: 0, borderTop: '2px dashed var(--text-muted)', verticalAlign: 'middle' }} /> costs, jobs + overhead
          </span>
          <span>
            <span style={{ display: 'inline-block', width: 12, height: 12, background: '#86efac', verticalAlign: 'middle', borderRadius: 2 }} /> net, the week made money
          </span>
          <span>
            <span style={{ display: 'inline-block', width: 12, height: 12, background: '#fca5a5', verticalAlign: 'middle', borderRadius: 2 }} /> net, it lost
          </span>
        </div>
        <div data-testid="bridge-profit-eight">{panel.eightWeeks}</div>
        <div style={{ padding: '0.45rem 0.6rem', borderRadius: 6, border: `1px solid ${panel.noteTone === 'green' ? 'var(--text-green-700)' : panel.noteTone === 'amber' ? 'var(--text-amber-800)' : 'var(--border)'}`, color: panel.noteTone === 'green' ? 'var(--text-green-700)' : panel.noteTone === 'amber' ? 'var(--text-amber-800)' : 'var(--text)' }} data-testid="bridge-profit-note">
          {panel.note}
        </div>
      </div>
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)', gap: '0.6rem 1.4rem', paddingTop: '0.6rem', borderTop: '1px solid var(--border)' }}>
        <div>
          <div style={label}>Where a day's money goes</div>
          <div style={{ ...det, marginBottom: 4 }}>the 14-day average, per day: what the field earned, less what it cost, is the number on the card</div>
          <Waterfall bars={panel.waterfall} />
        </div>
        <div>
          <div style={label}>Where each number comes from, and what can make it wrong</div>
          <div style={{ display: 'grid', gridTemplateColumns: '76px minmax(0, 1.1fr) minmax(0, 1fr) auto', gap: '0.2rem 0.6rem', fontSize: '0.78rem', alignItems: 'baseline', marginTop: 4 }}>
            <span style={cap}>input</span>
            <span style={cap}>read from</span>
            <span style={cap}>what can be wrong</span>
            <span />
            {panel.sources.map((r) => (
              <span key={r.input} style={{ display: 'contents' }}>
                <span style={{ borderTop: '1px solid var(--border)', paddingTop: 4, fontWeight: 700 }}>{r.input}</span>
                <span style={{ borderTop: '1px solid var(--border)', paddingTop: 4, color: 'var(--text-muted)' }}>{r.from}</span>
                <span style={{ borderTop: '1px solid var(--border)', paddingTop: 4, color: r.tone === 'green' ? 'var(--text-green-700)' : 'var(--text-amber-800)' }}>{r.risk}</span>
                <Link to={r.door.to} style={{ borderTop: '1px solid var(--border)', paddingTop: 4, whiteSpace: 'nowrap' }}>
                  {r.door.label}
                </Link>
              </span>
            ))}
          </div>
        </div>
        <div style={{ gridColumn: '1 / -1', fontSize: '0.85rem', padding: '0.45rem 0.6rem', borderRadius: 6, background: 'var(--bg-blue-tint, transparent)', border: '1px solid var(--border)' }} data-testid="bridge-profit-breakeven">
          {panel.breakEven}
        </div>
      </div>
    </section>
  )
}
