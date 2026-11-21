/**
 * A place's words in a list (punch list #413): one line stays as it is, and a long description
 * shows its short form with a press that opens the whole of it. One component for every list a
 * place shows in, so a description reads the same on the map's window and on the shared page.
 * The cut and its words are `paintedPlaceWords.ts`'s.
 */
import { useState, type CSSProperties } from 'react'
import { PLACE_WORDS_LESS, PLACE_WORDS_MORE, placeWordsAreLong, shortPlaceWords } from '../../lib/paintedMap/paintedPlaceWords'

type Props = {
  words: string | null | undefined
  /** The name of the place, so the press says whose words it opens to a screen reader. */
  name?: string
  style?: CSSProperties
}

const more: CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer', minHeight: 44, display: 'inline-flex', alignItems: 'center' }

export function PaintedPlaceWords({ words, name, style }: Props) {
  const [open, setOpen] = useState(false)
  const text = (words ?? '').trim()
  if (!text) return null
  const long = placeWordsAreLong(text)
  return (
    <span data-place-words={long && !open ? 'short' : 'whole'} style={{ display: 'grid', justifyItems: 'start', minWidth: 0, ...style }}>
      <span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{long && !open ? shortPlaceWords(text) : text}</span>
      {long ? (
        <button
          type="button"
          aria-expanded={open}
          aria-label={name ? `${open ? PLACE_WORDS_LESS : PLACE_WORDS_MORE}: ${name}` : undefined}
          style={more}
          onClick={(e) => {
            e.stopPropagation()
            setOpen((o) => !o)
          }}
        >
          {open ? PLACE_WORDS_LESS : PLACE_WORDS_MORE}
        </button>
      ) : null}
    </span>
  )
}
