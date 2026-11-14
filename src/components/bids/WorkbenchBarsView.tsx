import type { CSSProperties } from 'react'
import type { WorkbenchBar, WorkbenchBarSegment, WorkbenchBarSegmentKind, WorkbenchBars, WorkbenchDoor, WorkbenchLegendItem } from '../../lib/bids/workbenchBars'

/**
 * The Workbench's margin as two bars (punch list #217, bids-2, a prototype): the bars `workbenchBars`
 * returns, a revenue bar over a cost bar on one scale, the marks under each, and the legend under the
 * cost bar carrying each caveat with its door (`onDoor`). Reads the kernel's fractions only; every
 * word on it is the kernel's. The sent figure and labor wear the Bid Board's blues, materials a
 * lighter blue, the book's drift an amber hatch, a row with no cost a dashed outline, the margin the
 * green the Legal desk keeps for what we keep; the neutrals are tokens.
 */

const HATCH_AMBER = 'repeating-linear-gradient(135deg, #fde68a 0 5px, #fef3c7 5px 10px)'
const DASHED: CSSProperties = { background: 'transparent', color: 'var(--text-muted)', outline: '1px dashed var(--border-strong)', outlineOffset: -2 }

function fill(kind: WorkbenchBarSegmentKind): CSSProperties {
  switch (kind) {
    case 'sent':
      return { background: '#3b82f6', color: '#fff' }
    case 'today':
      return { background: '#60a5fa', color: '#fff' }
    case 'short':
      return DASHED
    case 'labor':
      return { background: '#60a5fa', color: '#fff' }
    case 'materials':
      return { background: '#bfdbfe', color: 'var(--text-on-bright-solid)' }
    case 'drift':
      return { background: HATCH_AMBER, color: 'var(--text-amber-900)' }
    case 'other':
      return { background: 'var(--bg-muted)', color: 'var(--text-700)' }
    case 'nocost':
      return DASHED
    case 'margin':
      return { background: 'var(--bg-green-200)', color: 'var(--text-green-800)' }
  }
}

function swatch(kind: WorkbenchBarSegmentKind | 'none'): CSSProperties | null {
  if (kind === 'none') return null
  const base: CSSProperties = { display: 'inline-block', width: 12, height: 10, borderRadius: 2, verticalAlign: '-1px', marginRight: 4, boxSizing: 'border-box' }
  if (kind === 'nocost' || kind === 'short') return { ...base, border: '1px dashed var(--border-strong)' }
  return { ...base, ...fill(kind) }
}

const MARK_INK: Record<'sent' | 'stamp', string> = { sent: 'var(--text-strong)', stamp: 'var(--text-muted)' }

function Bar({ bar }: { bar: WorkbenchBar }) {
  return (
    <div data-workbench-bar={bar.key} style={{ display: 'grid', gap: 2, minWidth: 0 }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{bar.caption}</div>
      <div style={{ display: 'flex', height: bar.key === 'revenue' ? 22 : 26, borderRadius: 5, overflow: 'hidden', border: '1px solid var(--border-strong)', background: 'var(--surface)' }}>
        {bar.segments.map((s: WorkbenchBarSegment) => (
          <span
            key={s.key}
            data-workbench-segment={s.kind}
            title={s.title}
            style={{ ...fill(s.kind), flex: `${Math.max(s.fraction, 0.004)} 1 0`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', borderRight: '1px solid var(--surface)', minWidth: 0 }}
          >
            {s.fraction >= 0.08 ? s.label : ''}
          </span>
        ))}
      </div>
      {bar.marks.length > 0 ? (
        <div style={{ position: 'relative', height: 18 }}>
          {bar.marks.map((m) => (
            <span
              key={m.key}
              data-workbench-mark={m.kind}
              style={{ position: 'absolute', left: `${m.fraction * 100}%`, top: 0, transform: m.fraction > 0.85 ? 'translateX(-100%)' : m.fraction < 0.1 ? 'none' : 'translateX(-50%)', fontSize: '0.64rem', lineHeight: 1.2, whiteSpace: 'nowrap', color: MARK_INK[m.kind], fontStyle: m.kind === 'stamp' ? 'italic' : 'normal' }}
            >
              <span aria-hidden style={{ display: 'block', width: 2, height: 6, margin: m.fraction > 0.85 ? '0 0 1px auto' : m.fraction < 0.1 ? '0 auto 1px 0' : '0 auto 1px', background: MARK_INK[m.kind], opacity: m.kind === 'stamp' ? 0.6 : 1 }} />
              {m.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function Door({ item, onDoor }: { item: WorkbenchLegendItem; onDoor: (door: WorkbenchDoor) => void }) {
  if (!item.door) return null
  const { kind, words } = item.door
  return (
    <button
      type="button"
      data-workbench-door={kind}
      onClick={() => onDoor(kind)}
      style={{ font: 'inherit', fontSize: 'inherit', fontWeight: 700, padding: 0, border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2, marginLeft: '0.3rem', whiteSpace: 'nowrap' }}
    >
      ↗ {words}
    </button>
  )
}

export function WorkbenchBarsView({ bars, onDoor }: { bars: WorkbenchBars; onDoor: (door: WorkbenchDoor) => void }) {
  return (
    <div data-testid="workbench-bars" title={bars.words} style={{ display: 'grid', gap: 8, minWidth: 0 }}>
      <span role="img" aria-label={bars.words} style={{ display: 'contents' }}>
        {bars.bars.map((b) => <Bar key={b.key} bar={b} />)}
      </span>
      <div data-workbench-legend style={{ display: 'flex', gap: '0.25rem 1rem', flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>
        {bars.legend.map((l) => {
          const [head, ...rest] = l.words.split(' · ')
          const sw = swatch(l.swatch)
          return (
            <span key={l.key} data-workbench-legend-item={l.key} style={{ whiteSpace: 'nowrap' }}>
              {sw ? <i aria-hidden style={sw} /> : null}
              <b style={{ color: 'var(--text-700)' }}>{head}</b>
              {rest.length > 0 ? <span style={{ color: l.tone === 'guess' ? 'var(--text-amber-700)' : undefined }}> · {rest.join(' · ')}</span> : null}
              <Door item={l} onDoor={onDoor} />
            </span>
          )
        })}
      </div>
      {bars.warn ? (
        <div>
          <span data-workbench-warn style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.15rem 0.6rem', borderRadius: 999, border: '1px solid var(--border-amber)', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-700)', fontSize: '0.72rem', fontWeight: 700 }}>
            ⚠ {bars.warn.words}
            <Door item={bars.warn} onDoor={onDoor} />
          </span>
        </div>
      ) : null}
    </div>
  )
}
