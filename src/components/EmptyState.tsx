/**
 * EmptyState (punch list #184, sweep C): the one shape for an empty list. `main` says what is
 * missing, `next` is the press that fills it, a button or a Link when the press is a page, and
 * `tail` finishes the sentence after the press: *No bids yet. New Bid ▸ adds the first.* The words
 * come from `lib/emptyWords.ts` (the four kinds) or a surface's own kernel (`deckWords`,
 * `lienDesk`). `compact` tightens the padding for a list inside a window. `main` alone is for a
 * sub-list whose next step is the row above it. `orNext` is a second way out, drawn after *or*:
 * *No bids match ‘Ridgway’. Clear the search or Show every bid* (v2.5986). `check:empty-words`
 * fails a PR that writes a bare *No …* sentence outside this element. `finger` is for a list whose
 * only way in is this press: the press is then 44 px tall, where it is otherwise the height of its words.
 *
 * The sentence is two units (v2.6113): `main` is one, the press with its `tail` and the *or* press
 * the other, each an inline block. When the two fit on one line nothing shows; when they do not,
 * the second drops whole to the next line, so *Nothing scheduled today.* stands alone on the first
 * line and *+ Add job puts a job on your day.* on the second, never *day.* by itself.
 */
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { EmptyNext, EmptyStateWords } from '../lib/emptyWords'

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

/** A press that is the only way in takes a finger. Its words stay on the sentence's own line. */
const FINGER: CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 0.35rem' }

/** One unit of the sentence: it moves to the next line whole, and wraps inside only when it is longer than the line. */
const UNIT: CSSProperties = { display: 'inline-block' }

export function EmptyState({ main, next, tail, orNext, compact = false, finger = false }: EmptyStateWords & { compact?: boolean; finger?: boolean }) {
  const hasRest = Boolean(next || tail || orNext)
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
      <span data-empty-unit="main" style={UNIT}>
        {main}
      </span>
      {hasRest ? (
        <>
          {' '}
          <span data-empty-unit="next" style={UNIT}>
            {next ? <EmptyPress next={next} finger={finger} /> : null}
            {tail ? (next ? ` ${tail}` : tail) : null}
            {orNext ? (
              <>
                {next || tail ? ' or ' : 'or '}
                <EmptyPress next={orNext} finger={finger} />
              </>
            ) : null}
          </span>
        </>
      ) : null}
    </p>
  )
}

function EmptyPress({ next, finger }: { next: EmptyNext; finger: boolean }) {
  const style = finger ? { ...PRESS, ...FINGER } : PRESS
  return 'to' in next ? (
    <Link to={next.to} style={style}>
      {next.label}
    </Link>
  ) : (
    <button type="button" onClick={next.onPress} style={style}>
      {next.label}
    </button>
  )
}
