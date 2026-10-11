import type { CSSProperties } from 'react'
import type { DialReading } from '../../lib/bridge/dial'
import { STAGE_META } from '../../lib/bridge/stageFlow'
import { DIAL_WORDS } from '../../lib/bridge/dial'

/**
 * The dial (link PR 5): a slider for the pressed stage's pace with marks on
 * the track, the exploit / elevate zones, the number with a unit under it,
 * the pile over twelve weeks, and the three readings. The cards above move
 * with it (the page passes the dial's flow to them).
 */

const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const det: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }

const toneBox = (tone: 'red' | 'amber' | 'green' | 'grey'): CSSProperties => ({
  fontSize: '0.82rem',
  padding: '0.4rem 0.6rem',
  borderRadius: 6,
  border: `1px solid ${tone === 'red' ? 'var(--text-red-700)' : tone === 'amber' ? 'var(--text-amber-800)' : tone === 'green' ? 'var(--text-green-700)' : 'var(--border)'}`,
  color: tone === 'red' ? 'var(--text-red-700)' : tone === 'amber' ? 'var(--text-amber-800)' : tone === 'green' ? 'var(--text-green-700)' : 'var(--text)',
  background: 'var(--surface)',
})

export function BridgeDial({ reading, moved, onChange, onReset }: { reading: DialReading; moved: boolean; onChange: (usd: number) => void; onReset: () => void }) {
  const { spec } = reading
  const span = Math.max(1, spec.maxUsd - spec.minUsd)
  const pct = (usd: number) => Math.max(0, Math.min(100, ((usd - spec.minUsd) / span) * 100))
  const words = DIAL_WORDS[spec.stage]
  const name = STAGE_META[spec.stage].name
  // Marks: a label within 16 points of the one before it drops to a second row.
  let prev = -100
  let prevRow = 1
  const marks = [...reading.marks]
    .sort((a, b) => a.usd - b.usd)
    .map((m) => {
      const p = pct(m.usd)
      const row = p - prev < 16 ? 1 - prevRow : 0
      prev = p
      prevRow = row
      return { ...m, p, row, shift: p < 8 ? 'none' : p > 92 ? 'translateX(-100%)' : 'translateX(-50%)' }
    })
  const yMax = Math.max(1, ...reading.spark.newSeries, ...reading.spark.oldSeries)
  const px = (t: number) => 6 + (t / 12) * 200
  const py = (v: number) => 58 - (v / yMax) * 50
  const pts = (arr: number[]) => arr.map((v, t) => `${px(t).toFixed(1)},${py(v).toFixed(1)}`).join(' ')
  const sparkColor = reading.spark.tone === 'red' ? 'var(--text-red-700)' : reading.spark.tone === 'amber' ? 'var(--text-amber-800)' : 'var(--text-green-700)'
  const endY = py(reading.spark.newSeries[12] ?? 0)
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.9rem', marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }} data-testid="bridge-dial">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 1rem', alignItems: 'baseline' }}>
        <label htmlFor="bridge-dial-rate" style={label}>
          Exploit before you elevate · {name} · {words.label}
        </label>
        <span style={det}>drag it; the cards above move with it</span>
        {moved && (
          <button type="button" onClick={onReset} style={{ marginLeft: 'auto', font: 'inherit', fontSize: '0.75rem', padding: '2px 10px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }} data-testid="bridge-dial-reset">
            back to today
          </button>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto 240px', gap: '0.5rem 1.6rem', alignItems: 'start' }}>
        <div>
          <div style={{ position: 'relative', height: 54 }}>
            <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: 12, height: 8, borderRadius: 4, background: `linear-gradient(90deg, var(--bg-blue-tint, var(--border)) 0 ${Math.round(reading.zone.exploitShare * 100)}%, var(--bg-amber-tint, var(--border)) ${Math.round(reading.zone.exploitShare * 100)}% 100%)` }} />
            {marks.map((m) => (
              <span key={m.label} style={{ display: 'contents' }}>
                <span aria-hidden style={{ position: 'absolute', top: 9, left: `${m.p}%`, width: 2, height: 14, marginLeft: -1, background: 'var(--text-muted)', pointerEvents: 'none' }} />
                <span style={{ position: 'absolute', top: 26 + m.row * 13, left: `${m.p}%`, transform: m.shift, fontSize: '0.62rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', lineHeight: 1.2, pointerEvents: 'none' }} data-testid="bridge-dial-mark">
                  {m.label}
                </span>
              </span>
            ))}
            <input id="bridge-dial-rate" type="range" min={spec.minUsd} max={spec.maxUsd} step={spec.stepUsd} value={reading.usd} onChange={(e) => onChange(Number(e.target.value))} aria-label={`${name}, ${words.label}`} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: 32, margin: 0, background: 'transparent' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', ...det }}>
            <span>{reading.zone.left}</span>
            <span>{reading.zone.right}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right', minWidth: 110 }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, whiteSpace: 'nowrap', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }} data-testid="bridge-dial-value">
            {reading.valueText}
          </div>
          <div style={{ ...det, whiteSpace: 'nowrap' }}>{reading.unitText}</div>
        </div>
        <div>
          <svg viewBox="0 0 260 70" role="img" aria-label="The pile over the next twelve weeks at the chosen pace" style={{ width: '100%', height: 'auto', display: 'block' }}>
            <line x1="6" y1="58" x2="206" y2="58" stroke="var(--border)" strokeWidth="1" />
            <polyline points={pts(reading.spark.oldSeries)} fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeDasharray="3 3" />
            <polyline points={pts(reading.spark.newSeries)} fill="none" stroke={sparkColor} strokeWidth="2.5" strokeLinejoin="round" />
            <text x="210" y={endY} fontSize="11" fontWeight="700" fill={sparkColor} dominantBaseline="middle">
              {reading.spark.endText}
            </text>
            <text x="6" y="68" fontSize="9" fill="var(--text-muted)">
              now
            </text>
            <text x="206" y="68" fontSize="9" fill="var(--text-muted)" textAnchor="end">
              12 weeks
            </text>
          </svg>
          <div style={{ ...det, textAlign: 'right' }}>{reading.spark.pileWord} at this pace · dotted: at today's</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.5rem' }}>
        {reading.lines.map((l) => (
          <div key={l.head} style={toneBox(l.tone)} data-testid={`bridge-dial-${l.head.replace(' ', '-')}`}>
            <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.75, marginBottom: 2 }}>{l.head}</div>
            {l.text}
          </div>
        ))}
      </div>
    </div>
  )
}
