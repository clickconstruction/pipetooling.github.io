import { useIsNarrowScreen } from '../../hooks/useIsNarrowScreen'
import { STRIP_LEGEND, layoutFlowStrip, type FlowStrip } from '../../lib/bridge/flowStrip'
import type { StageId } from '../../lib/bridge/stageFlow'

/**
 * The strip of pipe on the Bridge's first screen (v2.6847, punch list #303, PR 3): the five
 * steps as one line of pipe. How wide a section is says how many dollars it moves in a week.
 * The block on top says how much work waits in front of it. The slowest step is lit. A press
 * on a section opens that step's desk.
 *
 * The drawing is for the eye; each section's press carries the words for a screen reader.
 */

const BOX = { width: 100, pile: 16, pipe: 30, joint: 3 }

export function BridgeFlowStrip({ strip, onOpen }: { strip: FlowStrip; onOpen: (id: StageId) => void }) {
  const narrow = useIsNarrowScreen()
  const layout = layoutFlowStrip(strip.sections, BOX)
  // The drawing's height on the page: shorter on a phone, where the strip is one line of the first screen.
  const drawn = narrow ? 42 : 58
  return (
    <section aria-label={strip.label} data-testid="bridge-flow-strip" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: narrow ? '6px 6px 2px' : '8px 10px 4px', marginTop: narrow ? 8 : 12, minWidth: 0 }}>
      <div style={{ fontSize: narrow ? '0.62rem' : '0.7rem', color: 'var(--text-muted)', lineHeight: 1.2, marginBottom: 2 }} data-testid="bridge-flow-strip-legend">
        {narrow ? STRIP_LEGEND.short : STRIP_LEGEND.long}
      </div>
      {/* The drawing sits behind the presses, so a press is its whole column: the pipe and the words under it. */}
      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${layout.width} ${layout.height}`} preserveAspectRatio="none" aria-hidden width="100%" height={drawn} style={{ display: 'block', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
          <polygon points={layout.points} style={{ fill: 'var(--bg-200)', stroke: 'var(--border-strong)', strokeWidth: 0.6, vectorEffect: 'non-scaling-stroke' }} />
          {layout.cells.map((c, i) => {
            const s = strip.sections[i]
            if (!s) return null
            return (
              <g key={c.id}>
                {s.lit && <rect x={c.x} y={c.top} width={c.width} height={c.bottom - c.top} fill="#dc2626" />}
                {/* A step that does not read is drawn faint, at the thinnest. */}
                {s.paceUsd == null && <rect x={c.x} y={c.top} width={c.width} height={c.bottom - c.top} style={{ fill: 'var(--surface)', opacity: 0.6 }} />}
                {c.block && <rect x={c.block.x} y={c.block.y} width={c.block.width} height={c.block.height} rx={0.6} style={s.lit ? { fill: '#dc2626', opacity: 0.55 } : { fill: 'var(--text-muted)', opacity: 0.45 }} />}
              </g>
            )
          })}
        </svg>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${strip.sections.length}, minmax(0, 1fr))` }}>
          {strip.sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onOpen(s.id)}
              aria-label={`${s.label} Open its desk.`}
              data-testid={`bridge-strip-${s.id}`}
              style={{ font: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', gap: 0, minWidth: 0, padding: `${drawn + 3}px 1px 4px`, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'center', lineHeight: 1.2 }}
            >
              <b style={{ fontSize: narrow ? '0.72rem' : '0.82rem', color: s.lit ? 'var(--text-red-700)' : 'var(--text-strong)' }}>{s.name}</b>
              <span style={{ fontSize: narrow ? '0.62rem' : '0.74rem', color: s.lit ? 'var(--text-red-700)' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{s.paceText}</span>
              {(s.lit || !narrow) && s.weeksText && <span style={{ fontSize: narrow ? '0.62rem' : '0.72rem', fontWeight: s.lit ? 700 : 400, color: s.lit ? 'var(--text-red-700)' : 'var(--text-muted)' }}>{s.weeksText}</span>}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
