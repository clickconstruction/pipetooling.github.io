/**
 * A row of a job's Materials sections on a phone (v2.8292): the thing on top, its facts under it, and the one number
 * the section is about as a figure at the row's end, the number over its words as the page's tiles read.
 *
 * The rows stand inside the section's own card, under its heading, where the table stood. A row is not a press: a
 * press a table's cell held is a press inside the row. The left edge marks a row that needs a hand, amber for a gap
 * and red for a part someone could not find, as the table tints its row.
 */
import type { ReactNode } from 'react'
import type { SectionFigure } from '../../lib/materials/jobSectionsPhone'

/** The figure's colour: the theme's own word tokens, which flip in dark. */
const TONE: Record<SectionFigure['tone'], string> = { plain: 'var(--text-strong)', amber: 'var(--text-amber-700)', red: 'var(--text-red-700)', green: 'var(--text-green-700)', blue: 'var(--text-blue-700)' }
/** The edge of a row that needs a hand: the amber and the red the page's badges wear. */
const EDGE = { amber: '#d97706', red: '#dc2626' } as const

export function SectionPhoneRow({ title, maker, figure, edge = null, first = false, children }: {
  title: string
  /** A part's maker, beside its name. */
  maker?: string
  figure?: SectionFigure | null
  edge?: keyof typeof EDGE | null
  /** The first row under the heading draws no line over itself: the heading has one. */
  first?: boolean
  /** The row's quiet lines, and any press the table's cell held. */
  children?: ReactNode
}) {
  return (
    <div
      data-section-phone-row
      data-edge={edge ?? undefined}
      style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 56, padding: '10px 12px 10px 10px', borderStyle: 'solid', borderColor: 'var(--border)', borderWidth: 0, borderTopWidth: first ? 0 : 1, borderLeftWidth: 4, borderLeftColor: edge ? EDGE[edge] : 'transparent', boxSizing: 'border-box', minWidth: 0 }}
    >
      <span style={{ flex: '1 1 auto', minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: '0.95rem', fontWeight: 700, lineHeight: 1.25, color: 'var(--text-strong)', overflowWrap: 'anywhere' }}>
          {title}
          {maker ? <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · {maker}</span> : null}
        </span>
        {children}
      </span>
      {figure ? (
        <span style={{ flex: '0 0 auto', display: 'grid', justifyItems: 'center', gap: 1, minWidth: 48 }} data-section-phone-figure data-tone={figure.tone}>
          <b style={{ color: TONE[figure.tone], fontSize: '1.05rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, whiteSpace: 'nowrap' }}>{figure.figure}</b>
          {figure.words ? <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{figure.words}</span> : null}
        </span>
      ) : null}
    </div>
  )
}

/** The line a table kept for its total: its words on the left, the sum on the right. */
export function SectionPhoneFoot({ words, children }: { words: string; children: ReactNode }) {
  return (
    <div data-section-phone-foot style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, padding: '10px 12px 10px 14px', borderTop: '1px solid var(--border)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-strong)' }}>
      <span>{words}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{children}</span>
    </div>
  )
}

/** The press that draws more of a long list. Its label says how many it will add. */
export function SectionPhoneMore({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)' }}>
      <button type="button" data-section-phone-more onClick={onPress} style={{ width: '100%', minHeight: 44, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', borderRadius: 10, background: 'var(--surface)', color: 'var(--text-link)', font: 'inherit', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }}>{label}</button>
    </div>
  )
}
