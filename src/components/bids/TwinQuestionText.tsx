import { Fragment } from 'react'

import { bidRefHref, resolveBidRefId, splitBidRefs, trailingBidRef } from '../../lib/bids/twinQuestionBidRefs'

/**
 * A robot's question with every "b474" turned into a link to that bid's board
 * row (v2.3174 — Wendi: "can you make the bid number a link so i can have
 * some context to what it's talking about?"). Opens in a new tab so the answer
 * box she was typing in stays put. A reference nobody can resolve renders as
 * plain text.
 */
export function TwinQuestionText({
  text,
  bidIdByNumber,
  aboutBidId,
  aboutBidNumber,
}: {
  text: string
  /** bid_number → id, from one lookup of every number the open questions mention. */
  bidIdByNumber: Readonly<Record<string, string>>
  /** The row's own `about_bid_id`, used when the question names exactly one bid. */
  aboutBidId?: string | null
  /** That bid's number, so a question that only says "this bid" still gets a trailing link. */
  aboutBidNumber?: string | null
}) {
  const trailing = trailingBidRef(text, aboutBidId, aboutBidNumber)
  const linkStyle = { color: 'var(--text-link)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 2 } as const
  return (
    <>
      {splitBidRefs(text).map((seg, i) => {
        if (seg.kind === 'text') return <Fragment key={i}>{seg.text}</Fragment>
        const id = resolveBidRefId(seg.number, text, bidIdByNumber, aboutBidId)
        if (!id) return <Fragment key={i}>{seg.text}</Fragment>
        return (
          <a
            key={i}
            href={bidRefHref(id)}
            target="_blank"
            rel="noreferrer"
            title={`Open ${seg.text} on the Bid Board`}
            style={linkStyle}
          >
            {seg.text}
          </a>
        )
      })}
      {trailing ? (
        <>
          {' '}
          <span style={{ color: 'var(--text-faint)' }}>·</span>{' '}
          <a href={bidRefHref(trailing.id)} target="_blank" rel="noreferrer" title={`Open ${trailing.label} on the Bid Board`} style={{ ...linkStyle, fontSize: '0.85em' }}>
            {trailing.label}
          </a>
        </>
      ) : null}
    </>
  )
}
