import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { OwedPanel } from '../../lib/bridge/owedPanel'

/**
 * The Money owed panel (link PR 10): owed to you by how late beside owed by
 * you by when due, the balance as a waterfall, the sources table, the net
 * position line.
 */

const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const det: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const cap: CSSProperties = { fontSize: '0.62rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const shortK = (n: number): string => `${n < 0 ? '−' : ''}$${Math.abs(n) >= 1000 ? `${(Math.abs(n) / 1000).toFixed(Math.abs(n) >= 100_000 ? 0 : 1)}k` : Math.round(Math.abs(n)).toLocaleString('en-US')}`
const FILL: Record<OwedPanel['aging'][number]['fill'], string> = { blue: '#93c5fd', amber: '#fcd34d', red: '#f87171', grey: 'var(--border)' }

function Bars({ rows, testId }: { rows: OwedPanel['aging']; testId: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '84px minmax(0, 1fr) auto', gap: '0.35rem 0.5rem', alignItems: 'center' }} data-testid={testId}>
      {rows.map((r) => (
        <span key={r.label} style={{ display: 'contents' }}>
          <span style={det}>{r.label}</span>
          <span aria-hidden style={{ height: 16, borderRadius: 3, background: FILL[r.fill], width: `${Math.max(1, r.w)}%` }} />
          <span style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
            <b>{shortK(r.usd)}</b>
            {r.count != null && <span style={det}> · {r.count} {r.count === 1 ? 'invoice' : 'invoices'}</span>}
          </span>
        </span>
      ))}
    </div>
  )
}

function Waterfall({ bars }: { bars: OwedPanel['waterfall'] }) {
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
  return (
    <svg viewBox="0 0 520 200" role="img" aria-label="Waterfall from cash through owed to you and owed by you to net position, then the unbilled work" style={{ width: '100%', height: 'auto', display: 'block' }} data-testid="bridge-owed-waterfall">
      <line x1="10" x2="510" y1={py(0)} y2={py(0)} stroke="var(--text-muted)" strokeWidth="1" />
      {points.map((p, i) => {
        const cxp = 10 + (500 / n) * i + 500 / (2 * n)
        const top = Math.min(py(p.from), py(p.to))
        const bot = Math.max(py(p.from), py(p.to))
        const fill = p.kind === 'total' ? '#93c5fd' : p.usd >= 0 ? '#86efac' : 'var(--border)'
        const color = p.kind === 'total' ? '#1d4ed8' : p.usd >= 0 ? 'var(--text-green-700)' : 'var(--text-muted)'
        return (
          <g key={p.label}>
            <rect x={cxp - 24} y={top} width={48} height={Math.max(1.5, bot - top)} fill={fill} rx="2" />
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

export function BridgeOwedPanel({ panel, onClose }: { panel: OwedPanel; onClose: () => void }) {
  return (
    <section style={{ background: 'var(--surface)', border: '2px solid #2563eb', borderRadius: 10, padding: '0.8rem 1rem', marginTop: '0.6rem', display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(260px, 1fr)', gap: '0.6rem 1.4rem', alignItems: 'start' }} data-testid="bridge-owed-panel">
      <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'baseline', gap: '0.8rem' }}>
        <span style={label}>Money owed, both ways</span>
        <span style={det}>owed to you by how late it is; owed by you by when it falls due</span>
        <button type="button" onClick={onClose} aria-label="Close" style={{ marginLeft: 'auto', width: 24, height: 24, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer', font: 'inherit', lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, flex: '0 0 auto' }}>
          ×
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.5rem 1.4rem' }}>
        <div>
          <div style={{ ...cap, marginBottom: 4 }}>Owed to you · by how late</div>
          <Bars rows={panel.aging} testId="bridge-owed-aging" />
        </div>
        <div>
          <div style={{ ...cap, marginBottom: 4 }}>Owed by you · by when due</div>
          <Bars rows={panel.due} testId="bridge-owed-due" />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
        <div data-testid="bridge-owed-late">{panel.lateLine}</div>
        <div>{panel.netLine}</div>
        <div style={{ padding: '0.45rem 0.6rem', borderRadius: 6, border: '1px solid var(--text-amber-800)', color: 'var(--text-amber-800)' }}>{panel.closing}</div>
      </div>
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)', gap: '0.6rem 1.4rem', paddingTop: '0.6rem', borderTop: '1px solid var(--border)' }}>
        <div>
          <div style={label}>Where the money sits</div>
          <div style={{ ...det, marginBottom: 4 }}>cash, plus what is owed to you, less what you owe, is the net position; the finished work not yet billed is the money behind it</div>
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
      </div>
    </section>
  )
}
