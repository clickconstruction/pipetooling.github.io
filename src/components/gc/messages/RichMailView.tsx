import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { RICH_MAIL_WORDS } from '../../../lib/messages/richMail'
import { sanitizeRichMail } from '../../../lib/messages/richMailDom'
import { loadRichMail, type RichMailRead } from '../../../lib/messages/richMailIo'
import OfflineRetryPanel from '../../OfflineRetryPanel'
import { Btn } from '../gcUi'

/** The sender's pictures, tables and links as the view draws them: never wider than the window, a picture that is off a dashed box. */
const RICH_MAIL_CSS = `
[data-rich-mail] img { max-width: 100%; height: auto; }
[data-rich-mail] img[data-picture-off] { display: inline-block; min-width: 1.5rem; min-height: 1rem; border: 1px dashed var(--border-strong); background: var(--bg-muted); }
[data-rich-mail] table { max-width: 100%; }
[data-rich-mail] a { color: var(--text-link); }
[data-rich-mail] blockquote { margin: 0.5rem 0 0.5rem 0.75rem; padding-left: 0.75rem; border-left: 2px solid var(--border-strong); }
`

const paper: CSSProperties = {
  background: 'var(--surface)',
  color: 'var(--text-base)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.75rem 0.9rem',
  overflowX: 'auto',
  whiteSpace: 'normal',
  fontSize: '0.9rem',
  lineHeight: 1.5,
  position: 'relative',
}

/**
 * An email as the sender laid it out (punch list #259 PR 2, v2.6676): the HTML part the reader kept, read from the
 * bucket (`richMailIo.ts`) and drawn through DOMPurify with the house rules (`richMailDom.ts` over `richMail.ts`).
 * Every picture is off until **Show pictures** is pressed, once per opening; a tracking pixel is gone. Drawn on light
 * paper whatever the theme (`data-theme="light"`), since a mail's own colours assume a white page. A read that fails
 * draws its reason on `OfflineRetryPanel`, idempotent, so a lost signal reads again by itself.
 */
export function RichMailView({ path }: { path: string }) {
  const [read, setRead] = useState<RichMailRead | null>(null)
  const [busy, setBusy] = useState(false)
  const [picturesOn, setPicturesOn] = useState(false)

  const load = useCallback(async () => {
    setBusy(true)
    const r = await loadRichMail(path)
    setRead(r)
    setBusy(false)
  }, [path])

  useEffect(() => {
    setRead(null)
    setPicturesOn(false)
    void load()
  }, [load])

  const drawn = useMemo(() => (read?.ok ? sanitizeRichMail(read.html, picturesOn) : null), [read, picturesOn])

  if (!read) {
    return (
      <p data-rich-mail-reading style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        {RICH_MAIL_WORDS.reading}
      </p>
    )
  }
  if (!read.ok) return <OfflineRetryPanel failure={read.failure} onRetry={load} surface="message-rich-text" idempotent busy={busy} />
  return (
    <div data-theme="light" data-rich-mail-paper style={{ display: 'grid', gap: '0.5rem' }}>
      {drawn && drawn.pictures > 0 && !picturesOn && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <Btn onClick={() => setPicturesOn(true)} title={RICH_MAIL_WORDS.showPicturesTitle}>
            {RICH_MAIL_WORDS.showPictures}
          </Btn>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{RICH_MAIL_WORDS.picturesOff(drawn.pictures)}</span>
        </div>
      )}
      <style>{RICH_MAIL_CSS}</style>
      {/* The HTML is DOMPurify's answer under richMail.ts's rules; nothing in it runs, posts or fetches until Show pictures. */}
      <div data-rich-mail data-pictures={picturesOn ? 'on' : 'off'} style={paper} dangerouslySetInnerHTML={{ __html: drawn?.html ?? '' }} />
    </div>
  )
}
