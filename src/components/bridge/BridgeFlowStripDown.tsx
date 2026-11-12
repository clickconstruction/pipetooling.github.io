import { useState } from 'react'
import { useIsNarrowScreen } from '../../hooks/useIsNarrowScreen'
import type { MarketWorth } from '../../lib/bridge/bidWins'
import type { FlowStrip } from '../../lib/bridge/flowStrip'
import { STRIP_DOWN_LEGEND, STRIP_DOWN_MARKET_PRESS, layoutFlowStripDown, marketDetailBlocks, stripDownLines, withMarketWorth } from '../../lib/bridge/flowStripDown'
import type { StageId } from '../../lib/bridge/stageFlow'

/**
 * The strip of pipe, standing up (punch list #318): the five steps as one pipe
 * running down, each step's words beside its section. How wide a section is says how many dollars
 * it moves in a week. The bar under a step's words says how much work waits in front of it. The
 * slowest step is lit. A press on a row opens that step's desk.
 *
 * The drawing is for the eye; each row's press carries the words for a screen reader.
 */

export function BridgeFlowStripDown({ strip: read, onOpen, market = null }: { strip: FlowStrip; onOpen: (id: StageId) => void; /** What Market is worth, the bids and the estimates each through its won coefficient. */ market?: MarketWorth | null }) {
  const narrow = useIsNarrowScreen()
  const [marketOpen, setMarketOpen] = useState(false)
  // Market is drawn at what it is worth once that is read; until then, at the dollars asked, as before.
  const strip = withMarketWorth(read, market?.perWeekUsd ?? null)
  const worth = market != null && market.perWeekUsd != null
  // One section's height and the pipe's width on the page. A row holds Market's four lines, and leaves air under a
  // wait bar so the bar reads with its own step and not as a rule over the next one.
  const row = narrow ? 68 : 74
  const pipe = narrow ? 76 : 104
  const joint = narrow ? 12 : 14
  const layout = layoutFlowStripDown(strip.sections, { row, pipe, joint })
  // The longest bar, for the step with the most weeks waiting.
  const barMax = narrow ? 150 : 170
  return (
    <section aria-label={strip.label} data-testid="bridge-flow-strip" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: narrow ? '8px 10px' : '10px 12px', marginTop: narrow ? 8 : 12, minWidth: 0 }}>
      <div style={{ fontSize: narrow ? '0.66rem' : '0.72rem', color: 'var(--text-muted)', lineHeight: 1.2, marginBottom: 6 }} data-testid="bridge-flow-strip-legend">
        {STRIP_DOWN_LEGEND}
      </div>
      {/* The drawing sits behind the presses, so a press is its whole row: the pipe and the words beside it. */}
      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden width={layout.width} height={layout.height} style={{ display: 'block', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
          <polygon points={layout.points} style={{ fill: 'var(--bg-200)', stroke: 'var(--border-strong)', strokeWidth: 1 }} />
          {layout.cells.map((c, i) => {
            const s = strip.sections[i]
            if (!s) return null
            return (
              <g key={c.id}>
                {s.lit && <rect x={c.left} y={c.y} width={c.right - c.left} height={c.height} fill="#dc2626" />}
                {/* A step that does not read is drawn faint, at the thinnest. */}
                {s.paceUsd == null && <rect x={c.left} y={c.y} width={c.right - c.left} height={c.height} style={{ fill: 'var(--surface)', opacity: 0.6 }} />}
              </g>
            )
          })}
        </svg>
        <div style={{ display: 'grid' }}>
          {strip.sections.map((s) => {
            const lines = stripDownLines(s)
            return (
              // Each step's words start at the top of its own run of pipe, so the five names fall at even steps.
              <button
                key={s.id}
                type="button"
                onClick={() => onOpen(s.id)}
                aria-label={`${s.label} Open its desk.`}
                data-testid={`bridge-strip-${s.id}`}
                style={{ font: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start', gap: 1, minWidth: 0, height: row, padding: `${joint / 2}px 0 0 ${pipe + (narrow ? 12 : 16)}px`, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', lineHeight: 1.2 }}
              >
                <b style={{ fontSize: narrow ? '0.84rem' : '0.92rem', color: s.lit ? 'var(--text-red-700)' : 'var(--text-strong)' }}>{lines.title}</b>
                <span style={{ fontSize: narrow ? '0.74rem' : '0.8rem', color: s.lit ? 'var(--text-red-700)' : 'var(--text-700)', fontVariantNumeric: 'tabular-nums' }}>{s.id === 'market' && worth ? market.pace : lines.pace}</span>
                {s.id === 'market' &&
                  worth &&
                  market.parts.map((part) => (
                    <span key={part} style={{ fontSize: narrow ? '0.7rem' : '0.76rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }} data-testid="bridge-strip-market-part">
                      {part}
                    </span>
                  ))}
                {lines.weeks && (
                  <>
                    <span style={{ fontSize: narrow ? '0.7rem' : '0.76rem', fontWeight: s.lit ? 700 : 400, color: s.lit ? 'var(--text-red-700)' : 'var(--text-muted)' }}>{lines.weeks}</span>
                    {/* The bar under the words: as long as the weeks, so the steps can be compared down the column. */}
                    <span aria-hidden style={{ display: 'block', height: 4, marginTop: 2, width: Math.max(6, Math.round(s.pile * barMax)), borderRadius: 2, background: s.lit ? '#dc2626' : 'var(--text-muted)', opacity: s.lit ? 1 : 0.55 }} />
                  </>
                )}
              </button>
            )
          })}
        </div>
      </div>
      {worth && (
        <div style={{ marginTop: 6 }}>
          <button type="button" onClick={() => setMarketOpen((o) => !o)} aria-expanded={marketOpen} data-testid="bridge-strip-market-toggle" style={{ font: 'inherit', fontSize: narrow ? '0.72rem' : '0.76rem', padding: 0, minHeight: 32, border: 'none', background: 'transparent', color: 'var(--text-link)', cursor: 'pointer' }}>
            {STRIP_DOWN_MARKET_PRESS} {marketOpen ? '▴' : '›'}
          </button>
          {marketOpen && (
            // The bids' lines, then the estimates' lines, with air between. A line that wraps hangs under its own start.
            <div style={{ margin: '2px 0 0', display: 'grid', gap: 10, fontSize: narrow ? '0.74rem' : '0.8rem', lineHeight: 1.35, color: 'var(--text-700)' }} data-testid="bridge-strip-market-detail">
              {marketDetailBlocks(market.detail).map((block) => (
                <ul key={block[0]} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 3 }} data-testid="bridge-strip-market-detail-block">
                  {block.map((d, i) => (
                    <li key={d} style={{ paddingLeft: '0.75rem', textIndent: '-0.75rem', ...(i === 0 ? { fontWeight: 600, color: 'var(--text-strong)' } : null) }}>
                      {d}
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
