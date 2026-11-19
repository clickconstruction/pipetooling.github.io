/**
 * Bids → Pricing: two small pieces at the Workbench's grid, moved out of `BidsPricingTab` as they
 * were drawn (decomposition queue row 1). Neither reads the solver's values. Both draw and report;
 * the tab keeps every state and every write.
 *
 * - `PricingBookMatchBar`: the line above the grid. It names the open price's book, opens the
 *   price book, fills the rows whose names match a book entry, and opens the Percent row window.
 * - `PricingRowKindAndTags`: under a row's name, its kind (dashed while it is the app's guess)
 *   and the estimator's tags, with the box that adds one (punch list #128).
 */
import { cleanTag, type RowKind } from '../../lib/bids/rowKinds'
import { RowKindChip } from './RowKindChip'

export function PricingBookMatchBar({
  bookName,
  entryCount,
  matchCount,
  filling,
  onOpenBook,
  onFill,
  onPercentRow,
}: {
  /** The open price's name. */
  bookName: string
  entryCount: number
  /** Unassigned rows whose name matches a book entry (`matchCountRowsToBookEntries`). */
  matchCount: number
  filling: boolean
  onOpenBook: () => void
  onFill: () => void
  /** ＋ Percent row: a row priced as a percent of other rows. Absent where the tab cannot make one. */
  onPercentRow?: () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.55rem', flexWrap: 'wrap' }}>
      <span style={{ fontSize: '0.63rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Price book</span>
      <button
        type="button"
        onClick={onOpenBook}
        title="Open the price book — switch books, edit entries"
        style={{ font: 'inherit', fontSize: '0.78rem', color: 'var(--text-700)', border: '1px solid var(--border-strong)', borderRadius: 999, background: 'var(--surface)', padding: '0.18rem 0.7rem', cursor: 'pointer' }}
      >
        {bookName} · {entryCount} entr{entryCount === 1 ? 'y' : 'ies'} <b style={{ color: 'var(--text-link)' }}>{'\u25b8'}</b>
      </button>
      <button
        type="button"
        disabled={filling || matchCount === 0}
        onClick={onFill}
        title={matchCount === 0 ? 'No unassigned rows exactly match a book entry name' : 'Assign each matching row its book entry — prices fill from the book'}
        style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '0.28rem 0.7rem', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', cursor: matchCount === 0 ? 'not-allowed' : 'pointer', opacity: filling || matchCount === 0 ? 0.55 : 1 }}
      >
        {filling ? 'Filling…' : matchCount === 0 ? '0 unassigned rows match the book' : `Fill ${matchCount} matching from book`}
      </button>
      {onPercentRow ? (
        <button
          type="button"
          data-tour="percent-row"
          onClick={onPercentRow}
          title="Add a row priced as a percent of other rows, such as Connections at a percent of the pipe"
          style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 700, padding: '0.22rem 0.7rem', borderRadius: 6, border: '1.5px solid #2563eb', background: 'var(--surface)', color: 'var(--text-blue-700)', cursor: 'pointer' }}
        >
          ＋ Percent row
        </button>
      ) : null}
    </div>
  )
}

export function PricingRowKindAndTags({
  rowName,
  kind,
  guessed,
  tags,
  tagBoxOpen,
  onKind,
  onRemoveTag,
  onAddTag,
  onOpenTagBox,
  onCloseTagBox,
}: {
  /** The fixture's name, or "row". */
  rowName: string
  kind: RowKind
  /** The kind is the app's guess from the name, not a saved choice. */
  guessed: boolean
  tags: string[]
  /** This row's tag box is the one open. */
  tagBoxOpen: boolean
  onKind: (kind: RowKind) => void
  onRemoveTag: (tag: string) => void
  /** A cleaned, non-empty tag from the box. */
  onAddTag: (tag: string) => void
  onOpenTagBox: () => void
  onCloseTagBox: () => void
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', alignItems: 'center', marginTop: '0.2rem', fontWeight: 400 }}>
      <RowKindChip kind={kind} guessed={guessed} rowName={rowName} onChange={onKind} />
      {tags.map((tag) => (
        <button
          key={tag}
          type="button"
          title="Remove this tag"
          onClick={() => onRemoveTag(tag)}
          style={{ font: 'inherit', fontSize: '0.68rem', padding: '0 0.45rem', borderRadius: 999, border: '1px solid transparent', background: 'rgba(59, 130, 246, 0.14)', color: 'var(--text-link)', cursor: 'pointer' }}
        >
          {tag} <span style={{ color: 'var(--text-muted)' }}>×</span>
        </button>
      ))}
      {tagBoxOpen ? (
        <input
          type="text"
          list="pricing-row-tags"
          placeholder="a tag, then Enter"
          autoFocus
          aria-label={`Add a tag to ${rowName}`}
          onBlur={onCloseTagBox}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation()
              onCloseTagBox()
              return
            }
            if (e.key !== 'Enter') return
            e.preventDefault()
            e.stopPropagation()
            const tag = cleanTag(e.currentTarget.value)
            if (!tag) return
            onAddTag(tag)
            e.currentTarget.value = ''
          }}
          style={{ font: 'inherit', fontSize: '0.68rem', width: '9em', padding: '0.05rem 0.5rem', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)' }}
        />
      ) : (
        <button
          type="button"
          aria-label={`Add a tag to ${rowName}`}
          title="Add a tag"
          onClick={onOpenTagBox}
          style={{ font: 'inherit', fontSize: '0.72rem', fontWeight: 700, lineHeight: 1, width: '1.15rem', height: '1.15rem', padding: 0, borderRadius: 999, border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        >
          +
        </button>
      )}
    </div>
  )
}
