/**
 * EmptyState (punch list #184, sweep C): the one shape for an empty list. `main` says what is
 * missing, `next` is the press that fills it, a button or a Link when the press is a page, and
 * `tail` finishes the sentence after the press: *No bids yet. New Bid ▸ adds the first.* The words
 * come from `lib/emptyWords.ts` (the four kinds) or a surface's own kernel (`deckWords`,
 * `lienDesk`). `compact` tightens the padding for a list inside a window. `main` alone is for a
 * sub-list whose next step is the row above it. `check:empty-words` fails a PR that writes a bare
 * *No …* sentence outside this element.
 */
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { EmptyStateWords } from '../lib/emptyWords'

export type { EmptyNext, EmptyStateWords } from '../lib/emptyWords'

const PRESS: CSSProperties = {
  font: 'inherit',
  fontWeight: 600,
  color: 'var(--text-link)',
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  textDecoration: 'none',
}

export function EmptyState({ main, next, tail, compact = false }: EmptyStateWords & { compact?: boolean }) {
  return (
    <p
      data-empty-state
      style={{
        margin: 0,
        padding: compact ? '0.75rem' : '2rem',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: compact ? '0.875rem' : undefined,
      }}
    >
      {main}
      {next ? (
        <>
          {' '}
          {'to' in next ? (
            <Link to={next.to} style={PRESS}>
              {next.label}
            </Link>
          ) : (
            <button type="button" onClick={next.onPress} style={PRESS}>
              {next.label}
            </button>
          )}
        </>
      ) : null}
      {tail ? ` ${tail}` : null}
    </p>
  )
}
