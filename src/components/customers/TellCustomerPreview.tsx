/**
 * What the customer sees (v2.5794): the window Preview opens over the Tell the customer sheet, the sheet still open
 * under it. The email as the page built it, in a frame, with From, To and Subject; the text as it lands on their
 * phone, the link filled by a sample. Escape, × and Back close this window alone: the Escape is taken here in the
 * capture phase, so the sheet's own listener never sees it. Words and the fill in `lib/tellCustomer/preview.ts`.
 */
import { useEffect, type CSSProperties } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { PREVIEW_WORDS, previewKinds, splitLinks, textPreview, type PreviewEmail, type PreviewKind } from '../../lib/tellCustomer/preview'
import { TELL_WORDS } from '../../lib/tellCustomer/tellCustomer'

export interface TellCustomerPreviewProps {
  first: string | null
  kind: PreviewKind
  onKind: (kind: PreviewKind) => void
  /** The email the page built, or null when none goes. */
  email: PreviewEmail | null
  emailTo: string | null
  /** The box's words, or null when no text goes. */
  textWords: string | null
  number: string | null
  onClose: () => void
}

const pills: CSSProperties = { display: 'flex', gap: '0.4rem', margin: '0.75rem 0 0.25rem' }
const pill: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, padding: '0.3rem 0.8rem', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }
const pillOn: CSSProperties = { ...pill, background: 'var(--bg-blue-tint)', borderColor: 'var(--border-blue)', color: 'var(--text-blue-700)' }
const muted: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0.3rem 0 0.6rem' }
const lightBox: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '0.85rem', background: 'var(--bg-page)', color: 'var(--text-strong)', display: 'grid', gap: '0.4rem' }
const headLine: CSSProperties = { margin: 0, fontSize: '0.875rem', overflowWrap: 'anywhere' }
const frame: CSSProperties = { width: '100%', height: 520, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }
const phone: CSSProperties = { maxWidth: 360, margin: '0 auto', border: '1px solid var(--border-strong)', borderRadius: 24, padding: '1rem 0.85rem 1.1rem', background: 'var(--surface)', display: 'grid', gap: '0.5rem' }
const caption: CSSProperties = { margin: 0, textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }
const bubble: CSSProperties = { margin: 0, maxWidth: '85%', padding: '0.6rem 0.8rem', borderRadius: 18, borderBottomLeftRadius: 6, background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-strong)', fontSize: '0.9375rem', lineHeight: 1.4, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }
const link: CSSProperties = { color: 'var(--text-link)', textDecoration: 'underline' }
const note: CSSProperties = { margin: '0.4rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }
const noteWarn: CSSProperties = { ...note, color: 'var(--text-amber-800)', fontWeight: 600 }
const backBtn: CSSProperties = { minHeight: 46, padding: '0 0.9rem', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontWeight: 600, cursor: 'pointer' }

export function TellCustomerPreview({ first, kind, onKind, email, emailTo, textWords, number, onClose }: TellCustomerPreviewProps) {
  // Escape closes this window alone: taken in the capture phase, before the sheet's own window listener runs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      e.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const kinds = previewKinds({ email: Boolean(email), text: textWords !== null })
  const shown: PreviewKind | null = kinds.includes(kind) ? kind : kinds[0] ?? null
  const text = textWords !== null ? textPreview(textWords) : null
  const footer = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
      <button type="button" style={backBtn} onClick={onClose} data-testid="tell-preview-back">
        {PREVIEW_WORDS.back}
      </button>
    </div>
  )
  return (
    <ResponsiveModalShell title={PREVIEW_WORDS.title(first)} onRequestClose={onClose} footer={footer} zIndex={1250} maxWidthDesktop={640}>
      <div data-testid="tell-preview" data-kind={shown ?? ''}>
        {kinds.length > 1 ? (
          <div style={pills} role="tablist">
            {kinds.map((k) => (
              <button key={k} type="button" role="tab" aria-selected={k === shown} style={k === shown ? pillOn : pill} onClick={() => onKind(k)} data-testid={`tell-preview-pill-${k}`}>
                {PREVIEW_WORDS.pill(k)}
              </button>
            ))}
          </div>
        ) : null}
        <p style={muted}>{PREVIEW_WORDS.stays}</p>
        {shown === 'email' && email ? (
          <div data-theme="light" style={lightBox} data-testid="tell-preview-email">
            <p style={headLine}>
              <strong>{PREVIEW_WORDS.from}:</strong> {email.from}
              {email.replyTo ? (
                <>
                  {' · '}
                  <strong>{PREVIEW_WORDS.replyTo}:</strong> {email.replyTo}
                </>
              ) : null}
            </p>
            <p style={headLine}>
              <strong>{PREVIEW_WORDS.to}:</strong> {emailTo ?? ''}
            </p>
            <p style={headLine} data-testid="tell-preview-subject">
              <strong>{PREVIEW_WORDS.subject}:</strong> {email.subject}
            </p>
            <iframe title={PREVIEW_WORDS.frameTitle} sandbox="" srcDoc={email.html} style={frame} data-testid="tell-preview-frame" />
          </div>
        ) : null}
        {shown === 'text' && text ? (
          <div data-theme="light" style={lightBox} data-testid="tell-preview-text">
            <div style={phone}>
              <p style={caption} data-testid="tell-preview-caption">
                {number ? (
                  <>
                    {PREVIEW_WORDS.textTo(number)}
                    <br />
                  </>
                ) : null}
                {PREVIEW_WORDS.textFrom}
              </p>
              <p style={bubble} data-testid="tell-preview-words">
                {splitLinks(text.words).map((p, i) =>
                  p.link ? (
                    <span key={i} style={link}>
                      {p.text}
                    </span>
                  ) : (
                    <span key={i}>{p.text}</span>
                  ),
                )}
              </p>
            </div>
            {text.sample ? (
              <p style={note} data-testid="tell-preview-sample">
                {PREVIEW_WORDS.sampleLink}
              </p>
            ) : null}
            {text.left.length ? <p style={noteWarn}>{TELL_WORDS.blanksLeft(text.left)}</p> : null}
          </div>
        ) : null}
      </div>
    </ResponsiveModalShell>
  )
}
