import { lienBinFoldPress } from '../../lib/jobs/lienBinFold'

/**
 * The header of the Board's two boxes under the lien affidavits, and the press that folds each (punch list #390,
 * part 1). Folded, a box is this one line: its name, how many jobs and how much they owe, what still needs a person
 * in amber, and *Show ▾*. Open, the same line ends in *Hide ▴* over the box as it always read.
 *
 * The whole line is the press, so a phone has the box's full width to tap. The words are `lienBinFold.ts`.
 */
export function LienBinFoldHeader({ title, words, ask, open, onToggle, isMobile, controls }: { title: string; words: string; ask: string | null; open: boolean; onToggle: () => void; isMobile: boolean; controls: string }) {
  const press = lienBinFoldPress(open)
  const padX = isMobile ? '0.7rem' : '0.85rem'
  const padY = isMobile ? '0.55rem' : '0.6rem'
  return (
    <h4 style={{ margin: 0, font: 'inherit' }}>
      <button
        type="button"
        data-lien-bin-fold={open ? 'open' : 'folded'}
        aria-expanded={open}
        aria-controls={open ? controls : undefined}
        onClick={onToggle}
        style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.15rem 0.6rem', width: '100%', minHeight: isMobile ? 44 : undefined, padding: `${padY} ${padX} ${open ? '0.4rem' : padY}`, border: 'none', borderRadius: 9, background: 'none', font: 'inherit', textAlign: 'left', cursor: 'pointer', alignContent: 'center' }}
      >
        <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-strong)' }}>{title}</span>
        <span data-lien-bin-fold-words style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{words}</span>
        {!open && ask ? (
          <span data-lien-bin-fold-ask style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-amber-800)' }}>{ask}</span>
        ) : null}
        <span style={{ marginLeft: 'auto', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-link)', whiteSpace: 'nowrap' }}>
          {press.label} <span aria-hidden="true">{press.mark}</span>
        </span>
      </button>
    </h4>
  )
}
