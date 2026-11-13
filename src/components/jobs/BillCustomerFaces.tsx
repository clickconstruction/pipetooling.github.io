/**
 * Bill Customer's three faces (punch list #343, PR 2): under *What Dana will get*, the bill, the email and the text,
 * one at a time. The bill is the box the window always drew, handed in whole. The email is the send's own message in a
 * frame that takes no clicks, with From, To and Subject over it. The text is the bubble as it lands on a phone, or the
 * sheet's own reason no text can go. Words and builders in `lib/billing/billCustomerFaces.ts`; the window holds which
 * face shows and reads the text when its face is first opened.
 */
import type { CSSProperties, ReactNode } from 'react'
import { BILL_FACES, BILL_FACE_WORDS, type BillEmailFace, type BillFace, type BillTextFace } from '../../lib/billing/billCustomerFaces'
import { splitLinks } from '../../lib/tellCustomer/preview'

export type BillTextFaceState = { state: 'idle' | 'loading' | 'failed' } | { state: 'ready'; face: BillTextFace }

export interface BillCustomerFacesProps {
  /** Who is billed, for the heading; null reads *the customer*. */
  who: string | null
  face: BillFace
  onFace: (face: BillFace) => void
  /** The bill's own box, as the window built it. */
  bill: ReactNode
  /** The email as it will read; null while the bill has no amount. */
  email: BillEmailFace | null
  text: BillTextFaceState
}

const heading: CSSProperties = { fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-strong)', textAlign: 'center', margin: '0 0 0.4rem' }
const pills: CSSProperties = { display: 'flex', justifyContent: 'center', gap: '0.4rem', margin: '0 0 0.6rem', flexWrap: 'wrap' }
const pill: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, padding: '0.3rem 0.8rem', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }
const pillOn: CSSProperties = { ...pill, background: 'var(--bg-blue-tint)', border: '1px solid var(--border-blue)', color: 'var(--text-blue-700)' }
const lightBox: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '0.85rem', background: 'var(--bg-page)', color: 'var(--text-strong)', display: 'grid', gap: '0.4rem' }
const headLine: CSSProperties = { margin: 0, fontSize: '0.8125rem', overflowWrap: 'anywhere' }
const frame: CSSProperties = { width: '100%', height: 460, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }
const phone: CSSProperties = { width: '100%', maxWidth: 340, margin: '0 auto', boxSizing: 'border-box', border: '1px solid var(--border-strong)', borderRadius: 24, padding: '1rem 0.85rem 1.1rem', background: 'var(--surface)', display: 'grid', gap: '0.5rem' }
const caption: CSSProperties = { margin: 0, textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }
const bubble: CSSProperties = { margin: 0, maxWidth: '88%', padding: '0.6rem 0.8rem', borderRadius: 18, borderBottomLeftRadius: 6, background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-strong)', fontSize: '0.9rem', lineHeight: 1.4, overflowWrap: 'anywhere' }
const link: CSSProperties = { color: 'var(--text-link)', textDecoration: 'underline' }
const note: CSSProperties = { margin: '0.4rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }

export default function BillCustomerFaces({ who, face, onFace, bill, email, text }: BillCustomerFacesProps) {
  return (
    <div data-testid="bill-customer-faces" data-face={face} style={{ marginBottom: '0.5rem' }}>
      <div style={heading}>{BILL_FACE_WORDS.heading(who)}</div>
      <div style={pills} role="tablist" aria-label={BILL_FACE_WORDS.heading(who)}>
        {BILL_FACES.map((f) => (
          <button key={f} type="button" role="tab" aria-selected={f === face} style={f === face ? pillOn : pill} onClick={() => onFace(f)} data-testid={`bill-customer-face-${f}`}>
            {BILL_FACE_WORDS.pill[f]}
          </button>
        ))}
      </div>

      {/* The bill stays mounted on every face: its preview keeps loading, and a line under edit is not lost to a look at the email. */}
      <div style={{ display: face === 'bill' ? 'block' : 'none' }}>{bill}</div>

      {face === 'email' ? (
        email ? (
          <div data-testid="bill-customer-face-email-box">
            <div data-theme="light" style={lightBox}>
              <p style={headLine}>
                <strong>{BILL_FACE_WORDS.from}:</strong> {email.from}
              </p>
              <p style={headLine}>
                <strong>{BILL_FACE_WORDS.to}:</strong> {email.to || '—'}
              </p>
              <p style={headLine} data-testid="bill-customer-face-email-subject">
                <strong>{BILL_FACE_WORDS.subject}:</strong> {email.subject}
              </p>
              <iframe title={BILL_FACE_WORDS.frameTitle} sandbox="" srcDoc={email.html} style={frame} data-testid="bill-customer-face-email-frame" />
            </div>
            <p style={note}>{BILL_FACE_WORDS.emailNote}</p>
          </div>
        ) : (
          <p style={{ ...note, textAlign: 'center' }}>{BILL_FACE_WORDS.emailNeedsAmount}</p>
        )
      ) : null}

      {face === 'text' ? (
        text.state === 'ready' ? (
          text.face.kind === 'text' ? (
            <div data-testid="bill-customer-face-text-box">
              <div data-theme="light" style={lightBox}>
                <div style={phone}>
                  <p style={caption}>{BILL_FACE_WORDS.textTo(text.face.to)}</p>
                  <p style={bubble} data-testid="bill-customer-face-text-words">
                    {splitLinks(text.face.words).map((part, i) =>
                      part.link ? (
                        <span key={i} style={link}>
                          {part.text}
                        </span>
                      ) : (
                        <span key={i}>{part.text}</span>
                      ),
                    )}
                  </p>
                </div>
              </div>
              <p style={note}>
                {text.face.note} {BILL_FACE_WORDS.textNote}
              </p>
            </div>
          ) : (
            <p data-testid="bill-customer-face-text-hold" style={{ ...note, textAlign: 'center', color: 'var(--text-700)' }}>
              {text.face.words}
            </p>
          )
        ) : (
          <p role="status" style={{ ...note, textAlign: 'center' }}>
            {text.state === 'failed' ? BILL_FACE_WORDS.textFailed : BILL_FACE_WORDS.textLoading}
          </p>
        )
      ) : null}
    </div>
  )
}
