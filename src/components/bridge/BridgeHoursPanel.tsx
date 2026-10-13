import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { HoursPanel } from '../../lib/bridge/hoursPanel'

/**
 * The Crew hours panel (link PR 10): hours by pay week stacked by what the
 * app has read, this week's hours as a waterfall, the sources table, the
 * rule line.
 */

const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const det: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const cap: CSSProperties = { fontSize: '0.62rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const hrs = (h: number): string => `${Math.round(h).toLocaleString('en-US')}h`

function Stack({ weeks }: { weeks: HoursPanel['weeks'] }) {
  const n = Math.max(1, weeks.length)
  const slot = 660 / n
  const cx = (i: number) => 40 + slot * i + slot / 2
  const barW = Math.min(44, slot * 0.6)
  const yMax = Math.max(10, ...weeks.map((w) => w.total)) * 1.12
  const py = (v: number) => 200 - (v / yMax) * 180
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round((yMax * f) / 10) * 10)
  return (
    <svg viewBox="0 0 720 232" role="img" aria-label="Hours by week: approved field, waiting for approval, office" style={{ width: '100%', height: 'auto', display: 'block' }} data-testid="bridge-hours-stack">
      <defs>
        <pattern id="bridgeHoursHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="3" height="6" fill="#93c5fd" />
        </pattern>
      </defs>
      {ticks.map((v) => (
        <g key={v}>
          <line x1="40" x2="700" y1={py(v)} y2={py(v)} stroke="var(--border)" strokeWidth="1" />
          <text x="36" y={py(v)} fontSize="10" fill="var(--text-muted)" textAnchor="end" dominantBaseline="middle">
            {v}h
          </text>
        </g>
      ))}
      {weeks.map((w, i) => {
        const x = cx(i) - barW / 2
        let base = 0
        const parts: Array<[number, string]> = [
          [w.approvedField, '#2563eb'],
          [w.waitingField, 'url(#bridgeHoursHatch)'],
          [w.office, 'var(--border)'],
        ]
        return (
          <g key={w.start}>
            {parts.map(([v, fill], k) => {
              if (!(v > 0)) return null
              const y = py(base + v)
              const h = py(base) - y
              base += v
              return <rect key={k} x={x} y={y} width={barW} height={h} fill={fill} />
            })}
            <text x={cx(i)} y={py(w.total) - 5} fontSize="11" fontWeight="700" fill="var(--text)" textAnchor="middle">
              {hrs(w.total)}
            </text>
            <text x={cx(i)} y="226" fontSize="10" fill="var(--text-muted)" textAnchor="middle">
              {w.label}
              {w.current ? '…' : ''}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function Waterfall({ bars }: { bars: HoursPanel['waterfall'] }) {
  let run = 0
  const points = bars.map((b) => {
    const total = b.kind === 'total'
    const part = b.kind === 'part'
    const from = total || part ? 0 : run
    const to = total || part ? b.hours : run + b.hours
    if (!part) run = to
    return { ...b, from, to }
  })
  const yMax = Math.max(10, ...points.flatMap((p) => [p.from, p.to])) * 1.15
  const py = (v: number) => 16 + ((yMax - v) / yMax) * 160
  const n = points.length
  return (
    <svg viewBox="0 0 520 200" role="img" aria-label="Waterfall from hours clocked through hours waiting to hours the page reads, split field and office" style={{ width: '100%', height: 'auto', display: 'block' }} data-testid="bridge-hours-waterfall">
      <defs>
        <pattern id="bridgeHoursHatch2" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="3" height="6" fill="#93c5fd" />
        </pattern>
      </defs>
      <line x1="10" x2="510" y1={py(0)} y2={py(0)} stroke="var(--text-muted)" strokeWidth="1" />
      {points.map((p, i) => {
        const cxp = 10 + (500 / n) * i + 500 / (2 * n)
        const top = Math.min(py(p.from), py(p.to))
        const bot = Math.max(py(p.from), py(p.to))
        const fill = p.fill === 'hatch' ? 'url(#bridgeHoursHatch2)' : p.fill === 'blue' ? (p.kind === 'part' ? '#2563eb' : '#93c5fd') : 'var(--border)'
        const color = p.fill === 'hatch' ? 'var(--text-amber-800)' : p.kind === 'total' ? '#1d4ed8' : 'var(--text)'
        return (
          <g key={p.label}>
            <rect x={cxp - 30} y={top} width={60} height={Math.max(1.5, bot - top)} fill={fill} rx="2" />
            <text x={cxp} y={top - 4} fontSize="11" fontWeight="700" fill={color} textAnchor="middle">
              {p.hours < 0 ? '−' : ''}
              {hrs(Math.abs(p.hours))}
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

export function BridgeHoursPanel({ panel, onClose }: { panel: HoursPanel; onClose: () => void }) {
  return (
    <section style={{ background: 'var(--surface)', border: '2px solid #2563eb', borderRadius: 10, padding: '0.8rem 1rem', marginTop: '0.6rem', display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(260px, 1fr)', gap: '0.6rem 1.4rem', alignItems: 'start' }} data-testid="bridge-hours-panel">
      <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'baseline', gap: '0.8rem' }}>
        <span style={label}>Hours by week, by what the app has read</span>
        <span style={det}>approved field hours, hours waiting for approval, office and bids</span>
        <button type="button" onClick={onClose} aria-label="Close" style={{ marginLeft: 'auto', width: 24, height: 24, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer', font: 'inherit', lineHeight: 1 }}>
          ×
        </button>
      </div>
      <Stack weeks={panel.weeks} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.9rem', ...det }}>
          <span>
            <span style={{ display: 'inline-block', width: 12, height: 12, background: '#2563eb', verticalAlign: 'middle', borderRadius: 2 }} /> field, approved
          </span>
          <span>
            <span style={{ display: 'inline-block', width: 12, height: 12, background: 'repeating-linear-gradient(45deg, #93c5fd 0 3px, var(--surface) 3px 6px)', verticalAlign: 'middle', borderRadius: 2 }} /> field, waiting for approval
          </span>
          <span>
            <span style={{ display: 'inline-block', width: 12, height: 12, background: 'var(--border)', verticalAlign: 'middle', borderRadius: 2 }} /> office and bids
          </span>
        </div>
        <div data-testid="bridge-hours-eight">{panel.eightWeeks}</div>
        <div style={{ padding: '0.45rem 0.6rem', borderRadius: 6, border: `1px solid ${panel.noteTone === 'green' ? 'var(--text-green-700)' : 'var(--text-amber-800)'}`, color: panel.noteTone === 'green' ? 'var(--text-green-700)' : 'var(--text-amber-800)' }}>{panel.note}</div>
      </div>
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)', gap: '0.6rem 1.4rem', paddingTop: '0.6rem', borderTop: '1px solid var(--border)' }}>
        <div>
          <div style={label}>Where this week's hours went</div>
          <div style={{ ...det, marginBottom: 4 }}>every hour clocked this pay week, less what still waits for approval, is what the page can read</div>
          <Waterfall bars={panel.waterfall} />
        </div>
        <div>
          <div style={label}>Where each number comes from, and what can make it wrong</div>
          <div style={{ display: 'grid', gridTemplateColumns: '90px minmax(0, 1.1fr) minmax(0, 1fr) auto', gap: '0.2rem 0.6rem', fontSize: '0.78rem', alignItems: 'baseline', marginTop: 4 }}>
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
        <div style={{ gridColumn: '1 / -1', fontSize: '0.85rem', padding: '0.45rem 0.6rem', borderRadius: 6, background: 'var(--bg-blue-tint, transparent)', border: '1px solid var(--border)' }} data-testid="bridge-hours-rule">
          {panel.rule}
        </div>
      </div>
    </section>
  )
}
