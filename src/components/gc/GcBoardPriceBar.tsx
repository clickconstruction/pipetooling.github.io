import type { CSSProperties } from 'react'
import { BAR_STANDINGS, type BoardPriceBar, type BoardPriceBarKind, type BoardPriceBarSegment } from '../../lib/gc/boardPriceBar'
import { GcPriceTrigger } from './GcPriceCard'
import type { PriceCardHandle } from './usePriceCard'

/**
 * A bidding row's price as a bar (punch list #217, gc-messages-5, a prototype): the segments
 * `boardPriceBar` returns on the row's own line, the numbers inside them the only words the bar
 * carries, and a legend under it naming each part and its trades. Every segment is a door to the
 * price card on the trades it draws (`onArm` tells the card which group to light). The quoted part
 * is the Bid Board's blue; our budget is a neutral hatch, a hole a dashed outline, the overhead the
 * muted grey; the neutrals are tokens.
 */

const HATCH = 'repeating-linear-gradient(135deg, var(--bg-200) 0 5px, var(--bg-muted) 5px 10px)'

function fill(kind: BoardPriceBarKind): CSSProperties {
  switch (kind) {
    case 'quoted':
      return { background: '#93c5fd', color: 'var(--text-on-bright-solid)' }
    case 'budget':
      return { background: HATCH, color: 'var(--text-700)' }
    case 'hole':
      return { background: 'transparent', color: 'var(--text-muted)', boxShadow: 'inset 0 0 0 1px var(--border-strong)', outline: '1px dashed var(--border-strong)', outlineOffset: -2 }
    case 'overhead':
      return { background: 'var(--bg-muted)', color: 'var(--text-700)' }
  }
}

function swatch(kind: BoardPriceBarKind): CSSProperties {
  const base: CSSProperties = { display: 'inline-block', width: 12, height: 10, borderRadius: 2, verticalAlign: '-1px', marginRight: 4, boxSizing: 'border-box' }
  if (kind === 'hole') return { ...base, border: '1px dashed var(--border-strong)' }
  return { ...base, ...fill(kind), boxShadow: 'none', outline: 'none' }
}

export function GcBoardPriceBar({ bar, card, onArm, testId }: { bar: BoardPriceBar; card: PriceCardHandle; onArm: (kind: BoardPriceBarKind) => void; testId?: string }) {
  return (
    <div data-testid={testId ?? 'gc-board-price-bar'} data-gc-board-price-bar style={{ gridColumn: '1 / -1', display: 'grid', gap: '0.3rem', minWidth: 0 }} title={bar.words}>
      <div role="img" aria-label={bar.words} style={{ display: 'flex', height: 22, borderRadius: 5, overflow: 'hidden', border: '1px solid var(--border-strong)', background: 'var(--surface)' }}>
        {bar.segments.map((s: BoardPriceBarSegment) => (
          <GcPriceTrigger
            key={s.kind}
            card={card}
            label={`${s.title}. Show ${BAR_STANDINGS[s.kind].length > 0 ? 'those trades' : 'each trade'}.`}
            onArm={() => onArm(s.kind)}
            style={{
              ...fill(s.kind),
              flex: `${Math.max(s.fraction, 0.004)} 1 0`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.7rem',
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              minWidth: 0,
              borderRight: '1px solid var(--surface)',
              borderRadius: 0,
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            <span data-gc-board-price-segment={s.kind} style={{ overflow: 'hidden', textOverflow: 'clip' }}>
              {s.fraction >= 0.07 ? s.label : ''}
            </span>
          </GcPriceTrigger>
        ))}
      </div>
      <div data-gc-board-price-legend style={{ display: 'flex', gap: '0.25rem 1rem', flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>
        {bar.legend.map((l) => (
          <span key={l.kind}>
            <i aria-hidden style={swatch(l.kind)} />
            <b style={{ color: 'var(--text-700)' }}>{l.words.split(' · ')[0]}</b>
            {l.words.includes(' · ') ? ` · ${l.words.split(' · ').slice(1).join(' · ')}` : ''}
          </span>
        ))}
      </div>
    </div>
  )
}
