/**
 * Equipment pre-use check (punch list #270, SPIKE): one level as a gauge, drawn the way the real one is — a fuel tank
 * with its quarters, a sight glass with the line the oil should sit on, a dipstick with ADD and FULL, a dial with a
 * needle over a red and a green zone. Which look, and where on the machine to read it, is the machine's own list.
 * The crew drags the fill (or the needle) to where it sits and reads the words under it; last time's level is a
 * small tick. A thumb's guess lands as a fraction of the gauge, which is all a tank ever gives.
 */
import { useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { levelWords, type LevelDef } from '../../lib/machines/machines'

const H = 150
const W = 44

export interface LevelGaugeProps {
  def: LevelDef
  value: number | undefined
  last: number | undefined
  readOnly: boolean
  onChange: (v: number) => void
  /** The fleet card's preview. */
  small?: boolean
  /** Drawn this many times its usual size (the full-screen editor on a phone). */
  scale?: number
  /** On a phone a tap opens the full-screen editor instead of setting the fill under a thumb that hides it. */
  onOpen?: () => void
  /** Under the words, how full it is as a number, for the full-screen editor's precision. */
  showPercent?: boolean
}

export function LevelGauge({ def, value, last, readOnly, onChange, small, scale: scaleIn, onOpen, showPercent }: LevelGaugeProps) {
  const w = levelWords(def, value)
  const box = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const scale = scaleIn ?? (small ? 0.6 : 1)
  const unset = value == null
  const h = Math.round(H * scale)
  const dial = def.look === 'dial'
  function at(e: PointerEvent<HTMLDivElement>): number {
    const r = box.current?.getBoundingClientRect()
    if (!r) return 0
    let pct: number
    if (dial) {
      // the needle turns about the bottom middle: left is empty, right is full
      const cx = r.left + r.width / 2
      const cy = r.top + (r.height * 62) / 76
      const deg = (Math.atan2(cy - e.clientY, e.clientX - cx) * 180) / Math.PI
      pct = (1 - Math.max(0, Math.min(180, deg)) / 180) * 100
    } else {
      pct = (1 - (e.clientY - r.top) / r.height) * 100
    }
    return Math.max(0, Math.min(100, Math.round(pct)))
  }
  function down(e: PointerEvent<HTMLDivElement>) {
    if (readOnly) return
    if (onOpen) {
      onOpen()
      return
    }
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    onChange(at(e))
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return
    onChange(at(e))
  }
  function up() {
    dragging.current = false
  }
  function key(e: KeyboardEvent<HTMLDivElement>) {
    if (readOnly) return
    if (onOpen && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      onOpen()
      return
    }
    const v = value ?? 50
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') onChange(Math.min(100, v + 5))
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') onChange(Math.max(0, v - 5))
  }
  const fill = value ?? 0
  const stick = def.look === 'stick'
  const sliderProps = {
    ref: box,
    role: 'slider' as const,
    tabIndex: readOnly ? -1 : 0,
    'aria-label': def.name,
    'aria-valuemin': 0,
    'aria-valuemax': 100,
    'aria-valuenow': value ?? undefined,
    'aria-valuetext': w.word,
    onPointerDown: down,
    onPointerMove: move,
    onPointerUp: up,
    onPointerCancel: up,
    onKeyDown: key,
  }
  const setHint = readOnly ? 'not read' : onOpen ? 'Tap to set' : 'Drag to set'
  const words = (
    <span style={{ display: 'grid', justifyItems: 'center', gap: '0.1rem' }}>
      <span style={{ fontSize: scale > 1.5 ? '1.375rem' : small ? '0.7rem' : '0.75rem', fontWeight: 700, textAlign: 'center', lineHeight: 1.15, maxWidth: scale > 1.5 ? 320 : 130, color: unset ? (readOnly ? 'var(--text-muted)' : 'var(--text-blue-700)') : w.low ? 'var(--text-amber-800)' : 'var(--text-green-700)' }}>
        {unset ? setHint : w.word}
      </span>
      {showPercent && !unset ? <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{value}% full</span> : null}
    </span>
  )
  // the unset gauge wears a chip that says what to do, so nobody wonders whether it is a picture
  const tapChip = unset && !readOnly ? <span aria-hidden style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', padding: '0.15rem 0.4rem', borderRadius: 999, background: '#2563eb', color: '#fff', fontSize: scale > 1.5 ? '0.875rem' : '0.6rem', fontWeight: 700, whiteSpace: 'nowrap', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }}>{onOpen ? 'Tap' : '↕ Drag'}</span> : null
  // the full-screen editor carries its own title, so the big gauge wears none
  const head = scale > 1.5 ? null : (
    <div style={{ display: 'grid', justifyItems: 'center', gap: '0.1rem', maxWidth: 150 }}>
      <b style={{ fontSize: small ? '0.75rem' : '0.8125rem', textAlign: 'center', lineHeight: 1.15 }}>{def.name}</b>
      {def.where && !small ? <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.2 }}>{def.where}</span> : null}
    </div>
  )

  if (dial) {
    // a half dial: the red zone to `lowBelow`, the green past it, the needle at the level
    const dw = Math.round(120 * scale)
    const dh = Math.round(68 * scale)
    const cx = 60
    const cy = 62
    const r = 50
    const pt = (pct: number, rad = r) => {
      const a = Math.PI * (1 - pct / 100)
      return [cx + rad * Math.cos(a), cy - rad * Math.sin(a)] as const
    }
    const arc = (from: number, to: number, rad = r) => {
      const [x1, y1] = pt(from, rad)
      const [x2, y2] = pt(to, rad)
      // a half dial: no piece of it is over 180°, so the large-arc flag stays 0
      return `M ${x1} ${y1} A ${rad} ${rad} 0 0 1 ${x2} ${y2}`
    }
    const [nx, ny] = pt(fill, r - 6)
    const [lx1, ly1] = last != null ? pt(last, r + 3) : [0, 0]
    const [lx2, ly2] = last != null ? pt(last, r + 9) : [0, 0]
    return (
      <div style={{ display: 'grid', justifyItems: 'center', gap: '0.3rem', minWidth: 0 }} data-level-gauge={def.key} data-level-value={value ?? ''}>
        {head}
        <div {...sliderProps} style={{ position: 'relative', width: dw + 16, height: dh + 6, touchAction: 'none', cursor: readOnly ? 'default' : 'pointer', borderRadius: 8 }}>
          {tapChip}
          <svg viewBox="-10 0 140 76" width={dw + 16} height={dh + 6} aria-hidden style={{ display: 'block', overflow: 'visible' }}>
            <path d={arc(0, 100)} fill="none" stroke="var(--border-strong)" strokeWidth={14} strokeLinecap="butt" />
            <path d={arc(0, def.lowBelow)} fill="none" stroke="#dc2626" strokeWidth={14} opacity={0.85} />
            <path d={arc(def.lowBelow, 100)} fill="none" stroke="#16a34a" strokeWidth={14} opacity={0.85} />
            {def.marks.map((m) => {
              const [tx, ty] = pt(m.at, r + 14)
              return (
                <text key={m.label} x={tx} y={ty + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--text-strong)">
                  {m.label}
                </text>
              )
            })}
            {last != null ? <line x1={lx1} y1={ly1} x2={lx2} y2={ly2} stroke="var(--text-muted)" strokeWidth={2} /> : null}
            {value != null ? (
              <>
                <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="var(--text-strong)" strokeWidth={3} strokeLinecap="round" />
                <circle cx={cx} cy={cy} r={5} fill="var(--text-strong)" />
              </>
            ) : (
              <circle cx={cx} cy={cy} r={5} fill="var(--border-strong)" />
            )}
          </svg>
        </div>
        {words}
      </div>
    )
  }

  const bar: CSSProperties = { position: 'relative', width: Math.round((stick ? 18 : W) * scale), height: h, borderRadius: stick ? 4 : def.look === 'tank' ? 8 : 10, border: `2px solid ${value == null ? 'var(--border-strong)' : def.color}`, background: 'var(--bg-subtle)', overflow: 'visible', touchAction: 'none', cursor: readOnly ? 'default' : 'ns-resize', boxSizing: 'border-box', marginLeft: stick ? Math.round(13 * scale) : 0 }
  return (
    <div style={{ display: 'grid', justifyItems: 'center', gap: '0.3rem', minWidth: 0 }} data-level-gauge={def.key} data-level-value={value ?? ''}>
      {head}
      <div style={{ display: 'grid', gridTemplateColumns: `${Math.round(W * scale)}px auto`, gap: '0.25rem', alignItems: 'stretch' }}>
        <div {...sliderProps} style={bar}>
          {/* the fill, from the bottom */}
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${fill}%`, background: def.color, opacity: value == null ? 0 : 0.85, borderRadius: 'inherit', transition: dragging.current ? 'none' : 'height 80ms' }} aria-hidden />
          {/* the gauge's own marks */}
          {def.marks.map((m) => (
            <div key={m.label} aria-hidden style={{ position: 'absolute', left: m.line ? -6 : 0, right: m.line ? -6 : 0, bottom: `${m.at}%`, borderTop: m.line ? '3px solid var(--text-strong)' : '1.5px solid var(--text-muted)', opacity: m.line ? 0.9 : 0.6 }} />
          ))}
          {/* last time's level, a tick on the left */}
          {last != null ? <div aria-hidden title="last time" style={{ position: 'absolute', left: -10, bottom: `calc(${last}% - 4px)`, width: 0, height: 0, borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderLeft: '6px solid var(--text-muted)' }} /> : null}
          {/* the level's own line, so a guess is seen */}
          {value != null ? <div aria-hidden style={{ position: 'absolute', left: -2, right: -2, bottom: `calc(${fill}% - 1px)`, borderTop: `2px solid var(--text-strong)` }} /> : null}
          {tapChip}
        </div>
        <div style={{ position: 'relative', width: scale > 1.5 ? 90 : small ? 34 : 48, height: h, fontSize: scale > 1.5 ? '1rem' : small ? '0.55rem' : '0.65rem', color: 'var(--text-muted)' }} aria-hidden>
          {def.marks.map((m) => (
            <span key={m.label} style={{ position: 'absolute', left: 0, bottom: `calc(${m.at}% - 0.5em)`, fontWeight: m.line ? 700 : 500, color: m.line ? 'var(--text-strong)' : undefined, whiteSpace: 'nowrap' }}>
              {m.label}
            </span>
          ))}
        </div>
      </div>
      {words}
    </div>
  )
}

export default LevelGauge
