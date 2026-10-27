/**
 * The card behind a ? (punch list #187, PR 3): the Messages legend's shape (v2.5802) made general.
 * One row a part with its name and one sentence, an optional color stripe, the door to the guide
 * as the last row, and Close. The door opens the guide in a new tab, as the Lien desk's § Rules
 * does, so the desk and anything half typed on it stay. Rows and words: `lib/help/deskLegend.ts`.
 */
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { PhoneSheet } from '../PhoneSheet'
import { LEGEND_WORDS, legendGuideHref, legendRowsFor, type DeskLegend, type LegendRow } from '../../lib/help/deskLegend'

const card: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '0.6rem 0.85rem', background: 'var(--surface)', display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: '0.75rem', rowGap: '0.35rem', alignItems: 'baseline', fontSize: '0.85rem', color: 'var(--text-700)' }
const close: CSSProperties = { border: 0, background: 'none', color: 'var(--text-link)', fontWeight: 600, fontSize: '0.85rem', fontFamily: 'inherit', cursor: 'pointer', padding: 0, marginLeft: 'auto' }
const door: CSSProperties = { gridColumn: '1 / -1', display: 'flex', gap: '0.6rem', alignItems: 'baseline', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '0.45rem', marginTop: '0.15rem' }

export interface LegendCardProps {
  rows: LegendRow[]
  label: string
  onClose: () => void
  /** The door row; none draws the card without one, as Messages' does. */
  guide?: { href: string; title: string }
  testId?: string
  style?: CSSProperties
}

export function LegendCard({ rows, label, onClose, guide, testId = 'legend-card', style }: LegendCardProps) {
  // At phone width the name sits above its sentence (the mock-up's sheet), so a sentence is not squeezed into a column a
  // third of the screen wide. Checked live on 2026-10-26: two columns on a 375 px phone drew the Lien desk's card 832 px tall.
  const stacked = useNarrowViewport640()
  return (
    <section aria-label={label} data-testid={testId} data-stacked={stacked ? '' : undefined} style={{ ...card, ...(stacked ? { gridTemplateColumns: '1fr', rowGap: '0.15rem' } : null), ...style }}>
      {rows.map((r) => (
        <div key={r.key} style={{ display: 'contents' }}>
          <span style={{ fontWeight: 700, color: 'var(--text-strong)', whiteSpace: stacked ? 'normal' : 'nowrap', borderLeft: `3px solid ${r.accent ?? 'var(--border-strong)'}`, paddingLeft: '0.5rem', ...(stacked ? { marginTop: '0.4rem' } : null) }}>{r.label}</span>
          <span style={stacked ? { paddingLeft: 'calc(0.5rem + 3px)' } : undefined}>{r.note}</span>
        </div>
      ))}
      <div style={door}>
        {guide ? (
          <a href={guide.href} target="_blank" rel="noopener noreferrer" title={LEGEND_WORDS.guideTip} data-testid={`${testId}-guide`} style={{ color: 'var(--text-link)', fontWeight: 600, textDecoration: 'none' }}>
            {LEGEND_WORDS.readGuide(guide.title)}
          </a>
        ) : null}
        <button type="button" onClick={onClose} title={LEGEND_WORDS.closeTip} style={close}>
          {LEGEND_WORDS.close}
        </button>
      </div>
    </section>
  )
}

/**
 * A desk's card from its legend: the rows for this width and the door with `via=legend`. On a phone it rises as a sheet
 * from the bottom over the desk (`PhoneSheet`, z 1300, above every desk's window), as the mock-up draws it, so the desk
 * under it does not move; at a desk it sits under the bar.
 */
export function DeskLegendCard({ legend, phone, onClose, style }: { legend: DeskLegend; phone: boolean; onClose: () => void; style?: CSSProperties }) {
  const cardEl = <LegendCard rows={legendRowsFor(legend, phone)} label={legend.label} onClose={onClose} guide={{ href: legendGuideHref(legend), title: legend.guide.title }} testId={`legend-card-${legend.key}`} style={phone ? { border: 0, padding: '0 0.25rem 0.5rem', background: 'transparent' } : style} />
  if (!phone) return cardEl
  // Through a portal: a desk's window may clip a fixed child, and the sheet belongs to the screen, not the desk.
  const sheet = (
    <PhoneSheet label={legend.label} title={legend.label} onClose={onClose} dataAttrs={{ 'data-legend-sheet': legend.key }}>
      {cardEl}
    </PhoneSheet>
  )
  return typeof document === 'undefined' ? sheet : createPortal(sheet, document.body)
}
