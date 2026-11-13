import { Fragment, useMemo } from 'react'
import { bodyPieces } from '../../../lib/messages/bodyLinks'
import { LinkMark } from './LinkMark'

/**
 * The words of a line as the thread and the message window draw them (v2.6508, Grace's ask on Glenn Gelwin's
 * invitation to bid): a web address is the link's own words in the house link blue with a link mark beside it, one
 * `<a>` that opens in a new tab, so one press reaches it instead of a copy and a paste; a mail client's doubled
 * `url <url>` reads once; the sender's `*bold*` reads bold with the stars gone (`bodyPieces`). The parent keeps
 * `white-space: pre-wrap`, so the words' own line breaks stand. A long address wraps anywhere, so a phone's line never
 * scrolls sideways.
 */
export function MessageBody({ body }: { body: string }) {
  const pieces = useMemo(() => bodyPieces(body), [body])
  return (
    <>
      {pieces.map((p, i) => {
        const inner =
          p.kind === 'link' ? (
            <a data-body-link href={p.href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)', overflowWrap: 'anywhere' }}>
              <LinkMark gap="0.3em" />
              {p.href}
            </a>
          ) : (
            p.text
          )
        // The pieces are the words' own order and never move, so their place is their key.
        return p.bold ? <strong key={i}>{inner}</strong> : <Fragment key={i}>{inner}</Fragment>
      })}
    </>
  )
}
