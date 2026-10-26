/**
 * The card behind a ? (punch list #187, PR 3): the Messages legend's shape (v2.5802) made general.
 * One row a part with its name and one sentence, an optional color stripe, the door to the guide
 * as the last row, and Close. The door opens the guide in a new tab, as the Lien desk's § Rules
 * does, so the desk and anything half typed on it stay. Rows and words: `lib/help/deskLegend.ts`.
 */
import type { CSSProperties } from 'react'
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
  return (
    <section aria-label={label} data-testid={testId} style={{ ...card, ...style }}>
      {rows.map((r) => (
        <div key={r.key} style={{ display: 'contents' }}>
          <span style={{ fontWeight: 700, color: 'var(--text-strong)', whiteSpace: 'nowrap', borderLeft: `3px solid ${r.accent ?? 'var(--border-strong)'}`, paddingLeft: '0.5rem' }}>{r.label}</span>
          <span>{r.note}</span>
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

/** A desk's card from its legend: the rows for this width and the door with `via=legend`. */
export function DeskLegendCard({ legend, phone, onClose, style }: { legend: DeskLegend; phone: boolean; onClose: () => void; style?: CSSProperties }) {
  return <LegendCard rows={legendRowsFor(legend, phone)} label={legend.label} onClose={onClose} guide={{ href: legendGuideHref(legend), title: legend.guide.title }} testId={`legend-card-${legend.key}`} style={style} />
}
