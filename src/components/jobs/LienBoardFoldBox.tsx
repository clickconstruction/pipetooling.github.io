import { useState, type CSSProperties, type ReactNode } from 'react'

/**
 * A box under the Board's bins that folds to one line (v2.7854, punch list #390, part 1; drawn in #383's option B, the
 * owner's pick of 2026-11-17): *Public jobs · bond claim* and *Off the lien path*. Each was as tall as its rows, 244 px
 * with two jobs, between the chart and the list. Folded it is its name, how many jobs and how much they owe, what
 * still needs a person, and **Show ▾**. Open it is the box as it was, with **Hide ▴**.
 *
 * Closed until pressed, and only for this visit: the box is reference, and the line says when something in it waits on
 * a person. The whole line is the press, a thumb tall on a phone. The words are the bins' own kernels.
 */
export function LienBoardFoldBox({
  marks,
  countMarks,
  title,
  foldWords,
  totalWords,
  needs,
  count,
  isMobile,
  children,
}: {
  /** The box's own marks, as its tests and the desk find it: `data-lien-public-bin`, `data-lien-off-path-bin`. */
  marks: Record<string, string>
  countMarks: Record<string, string>
  title: string
  /** Folded: how many jobs and what they owe, *2 jobs · $9,400 unpaid*. */
  foldWords: string
  /** Open: the money alone, with the count at the line's end, as the box always read. */
  totalWords: string
  /** Folded: what in the box still needs a person, *1 to get the bond*; null with nothing. */
  needs: string | null
  count: number
  isMobile: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const press: CSSProperties = { display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.15rem 0.6rem', width: '100%', minHeight: isMobile ? 44 : undefined, padding: 0, border: 'none', background: 'none', font: 'inherit', textAlign: 'left', cursor: 'pointer', color: 'inherit' }
  return (
    <section {...marks} aria-label={title} data-folded={open ? undefined : 'yes'} style={{ display: 'grid', gap: 0, padding: isMobile ? '0.2rem 0.7rem' : open ? '0.6rem 0.85rem' : '0.35rem 0.85rem', border: '1px dashed var(--border-strong)', borderRadius: 9, background: 'var(--surface)' }}>
      <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 400, paddingBottom: open ? '0.4rem' : 0 }}>
        <button type="button" data-lien-board-box-fold aria-expanded={open} onClick={() => setOpen((v) => !v)} style={press}>
          <span style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{title}</span>
          <span data-lien-board-box-words style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{open ? totalWords : foldWords}</span>
          {!open && needs ? <span data-lien-board-box-needs style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-amber-800)' }}>{needs}</span> : null}
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'baseline', gap: '0.75rem' }}>
            {open ? <span {...countMarks} style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text-strong)' }}>{count}</span> : null}
            <span data-lien-board-box-fold-words style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-link)', whiteSpace: 'nowrap' }}>{open ? 'Hide ▴' : 'Show ▾'}</span>
          </span>
        </button>
      </h4>
      {open ? children : null}
    </section>
  )
}
