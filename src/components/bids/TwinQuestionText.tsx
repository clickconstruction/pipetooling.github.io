import { Fragment } from 'react'

import { bidRefHref, resolveBidRefId, sourceBidLabel, splitBidRefs, trailingBidRef, type SourceBidRef } from '../../lib/bids/twinQuestionBidRefs'

/**
 * A robot's question with every "b474" turned into a link to that bid's board
 * row (v2.3174 — Wendi: "can you make the bid number a link so i can have
 * some context to what it's talking about?"). Opens in a new tab so the answer
 * box she was typing in stays put. A reference nobody can resolve renders as
 * plain text.
 *
 * v2.3187: when the bid named is the robot's own ZZ Twin copy, a second link
 * beside it — "ours b214" — lands on the human bid it shadows or backtests,
 * the row with her counts and her price.
 */
export function TwinQuestionText({
  text,
  bidIdByNumber,
  aboutBidId,
  aboutBidNumber,
  sourceByBidId,
}: {
  text: string
  /** bid_number → id, from one lookup of every number the open questions mention. */
  bidIdByNumber: Readonly<Record<string, string>>
  /** The row's own `about_bid_id`, used when the question names exactly one bid. */
  aboutBidId?: string | null
  /** That bid's number, so a question that only says "this bid" still gets a trailing link. */
  aboutBidNumber?: string | null
  /** Twin bid id → the human bid it pairs with (`twin_source_bid_id`), for the "ours" link. */
  sourceByBidId?: Readonly<Record<string, SourceBidRef>>
}) {
  const trailing = trailingBidRef(text, aboutBidId, aboutBidNumber)
  const linkStyle = { color: 'var(--text-link)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 2 } as const
  const ours = (bidId: string) => {
    const src = sourceByBidId?.[bidId]
    if (!src) return null
    return (
      <>
        {' '}
        <a
          href={bidRefHref(src.id)}
          target="_blank"
          rel="noreferrer"
          title={`The robot's bid is a copy of ours — open b${src.number}, the bid with our counts and our price`}
          style={{ ...linkStyle, fontSize: '0.85em', fontWeight: 500, color: 'var(--text-green-700)' }}
        >
          {sourceBidLabel(src)}
        </a>
      </>
    )
  }
  return (
    <>
      {splitBidRefs(text).map((seg, i) => {
        if (seg.kind === 'text') return <Fragment key={i}>{seg.text}</Fragment>
        const id = resolveBidRefId(seg.number, text, bidIdByNumber, aboutBidId)
        if (!id) return <Fragment key={i}>{seg.text}</Fragment>
        return (
          <Fragment key={i}>
            <a
              href={bidRefHref(id)}
              target="_blank"
              rel="noreferrer"
              title={`Open ${seg.text} on the Bid Board`}
              style={linkStyle}
            >
              {seg.text}
            </a>
            {ours(id)}
          </Fragment>
        )
      })}
      {trailing ? (
        <>
          {' '}
          <span style={{ color: 'var(--text-faint)' }}>·</span>{' '}
          <a href={bidRefHref(trailing.id)} target="_blank" rel="noreferrer" title={`Open ${trailing.label} on the Bid Board`} style={{ ...linkStyle, fontSize: '0.85em' }}>
            {trailing.label}
          </a>
          {ours(trailing.id)}
        </>
      ) : null}
    </>
  )
}
