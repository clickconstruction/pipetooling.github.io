import { Fragment, useMemo, type CSSProperties } from 'react'
import { bodyContactPieces, canTextPoint, contactPointWords, mapHref, PRESS_LABEL, PRESS_WORDS_UI, type ContactPoint } from '../../../lib/messages/bodyContacts'
import type { CallThrough } from '../../../lib/quo/dial'
import { CallButton } from '../../messages/CallButton'
import { LinkMark } from './LinkMark'

/** The presses a contact point offers, as the thread window answers them (`useContactPointActs`). */
export interface ContactPointActs {
  /** Call: the button dials by itself; this hears it, with the way it went. */
  onCall: (point: ContactPoint, through: CallThrough) => void
  /** Text or Email: opens the reply box in the thread the number or the address belongs to. */
  onReply: (point: ContactPoint, kind: 'text' | 'email') => void
  /** Open the map: the link opens it; this hears it. */
  onMap: (point: ContactPoint) => void
}

/** The site every Call here is pressed from, for the ledger (v2.5904). */
export const BODY_CALL_SITE = 'message-words'

const pressStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.25rem',
  padding: '0.1rem 0.5rem',
  borderRadius: 999,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text-blue-700)',
  font: 'inherit',
  fontSize: '0.8rem',
  fontWeight: 600,
  lineHeight: 1.4,
  cursor: 'pointer',
  textDecoration: 'none',
  verticalAlign: 'baseline',
}

/**
 * The words of a message with its contact points as presses (v2.6513, `bodyContacts.ts`): a phone number draws the
 * house Call ▾ (Quo or my phone, `CallButton`) and, where the number can take a text, **Text**; an email address
 * **Email**; a street address **Open the map**. Text and Email need the thread's acts; with none (a window with no
 * thread around it) the words stay words, Call and the map still work on their own. A web address is the link `MessageBody`
 * draws (v2.6508): the house link blue with the link mark, opening in a new tab; the sender's bold reads bold. The
 * parent keeps `white-space: pre-wrap`, so the words' own line breaks stand.
 */
export function MessageBodyContacts({ body, acts }: { body: string; acts?: ContactPointActs | null }) {
  const pieces = useMemo(() => bodyContactPieces(body), [body])
  return (
    <>
      {pieces.map((p, i) => {
        let inner
        if (p.kind === 'link') {
          inner = (
            <a data-body-link href={p.href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)', overflowWrap: 'anywhere' }}>
              <LinkMark gap="0.3em" />
              {p.href}
            </a>
          )
        } else if (p.kind === 'contact') {
          inner = <ContactPointPresses point={p.point} acts={acts ?? null} />
        } else {
          inner = p.text
        }
        // The pieces are the words' own order and never move, so their place is their key.
        return p.bold ? <strong key={i}>{inner}</strong> : <Fragment key={i}>{inner}</Fragment>
      })}
    </>
  )
}

/** One contact point: its words, then its presses right after them, wrapping with the words on a phone. */
function ContactPointPresses({ point, acts }: { point: ContactPoint; acts: ContactPointActs | null }) {
  const words = contactPointWords(point)
  return (
    <span data-contact-point={point.kind} style={{ display: 'inline', overflowWrap: 'anywhere' }}>
      <span data-contact-point-words>{words}</span>{' '}
      <span style={{ display: 'inline-flex', gap: '0.3rem', verticalAlign: 'baseline', flexWrap: 'wrap' }}>
        {point.kind === 'phone' && (
          <>
            <CallButton
              number={point.number}
              name={null}
              style={pressStyle}
              site={BODY_CALL_SITE}
              title={PRESS_WORDS_UI.tips.call}
              testId="body-call"
              onPress={(through) => acts?.onCall(point, through)}
            />
            {acts && canTextPoint(point) && (
              <button type="button" style={pressStyle} title={PRESS_WORDS_UI.tips.text} data-testid="body-text" onClick={() => acts.onReply(point, 'text')}>
                {PRESS_LABEL.text}
              </button>
            )}
          </>
        )}
        {point.kind === 'email' && acts && (
          <button type="button" style={pressStyle} title={PRESS_WORDS_UI.tips.email} data-testid="body-email" onClick={() => acts.onReply(point, 'email')}>
            {PRESS_LABEL.email}
          </button>
        )}
        {point.kind === 'address' && (
          <a href={mapHref(point.words)} target="_blank" rel="noopener noreferrer" style={pressStyle} title={PRESS_WORDS_UI.tips.map} data-testid="body-map" onClick={() => acts?.onMap(point)}>
            {PRESS_LABEL.map}
          </a>
        )}
      </span>
    </span>
  )
}
