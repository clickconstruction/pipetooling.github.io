import type { CSSProperties } from 'react'
import { partSearchQuery, partSearchUrl, splitTrailingWord } from '../../lib/bids/partSearchUrl'
import { TakeoffPartSearchIcon } from '../icons/TakeoffPartSearchIcon'

/**
 * Look this part up on Google (v2.4055): a plain link (so middle-click, ⌘-click and
 * "open in new tab" all work) that opens a search for the part name as written, in a
 * new tab. Faint at rest, blue on hover (`.takeoff-part-search` in index.css).
 * Renders nothing when there is no name to search.
 */
export function TakeoffPartSearchLink({ name, style }: { name: string | null | undefined; style?: CSSProperties }) {
  const href = partSearchUrl(name)
  if (!href) return null
  const q = partSearchQuery(name)
  return (
    <a
      className="takeoff-part-search"
      data-testid="takeoff-part-search"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Search Google for ${q}`}
      title="Search Google for this part"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      style={style}
    >
      <TakeoffPartSearchIcon />
    </a>
  )
}

/**
 * A part name with the search icon in line at the end of the text. The icon is bound
 * to the last word with `white-space: nowrap`, so a long name that wraps carries the
 * icon down with it instead of leaving it alone on a line.
 */
export function PartNameWithSearch({ name }: { name: string }) {
  const { head, tail } = splitTrailingWord(name)
  return (
    <>
      {head ? `${head} ` : ''}
      <span style={{ whiteSpace: 'nowrap' }}>
        {tail}
        <TakeoffPartSearchLink name={name} />
      </span>
    </>
  )
}
