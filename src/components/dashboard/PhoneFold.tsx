import { useEffect, useState, type ReactNode } from 'react'
import { readPhoneFoldOpen, writePhoneFoldOpen, type PhoneFoldHeadline, type PhoneFoldTone } from '../../lib/dashboard/phoneFolds'

/**
 * A section as one line on the office person's phone (punch list #30, PR 4a-2):
 * its name and its headline, Open ▾ to read it in place. The section stays
 * mounted while folded — its reads run and its drafts survive — and the device
 * remembers which folds are open. With `fold` false the two wrappers take no
 * box (`display: contents`), so a desktop and a field role see the page as it
 * was.
 *
 * One shape for both states: flipping `fold` must not move the children in the
 * tree. Moved, they mount again and load again, and a section that reports
 * itself empty once loaded (My Inbox turns its own fold off) never settles.
 */

const BARE = { display: 'contents' } as const

const TONE: Record<PhoneFoldTone, string> = {
  quiet: 'var(--text-muted)',
  amber: 'var(--text-amber-800)',
  red: 'var(--text-red-600)',
}

export function PhoneFold({
  fold,
  section,
  userId,
  title,
  headline,
  spaced = false,
  children,
}: {
  fold: boolean
  /** The storage handle — one per section, stable. */
  section: string
  userId: string | null | undefined
  title: string
  headline: PhoneFoldHeadline | null
  /** A margin under the fold, for a page that does not space its own sections. */
  spaced?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(() => readPhoneFoldOpen(userId, section))
  useEffect(() => {
    setOpen(readPhoneFoldOpen(userId, section))
  }, [userId, section])

  const bodyId = `phone-fold-${section}`
  return (
    <section data-phone-fold={fold ? section : undefined} data-open={fold ? (open ? 'yes' : 'no') : undefined} style={fold ? (spaced ? { marginBottom: '0.6rem' } : undefined) : BARE}>
      {fold ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => {
            const next = !open
            setOpen(next)
            writePhoneFoldOpen(userId, section, next)
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            width: '100%',
            minHeight: 48,
            padding: '0.6rem 0.85rem',
            border: '1px solid var(--border)',
            borderRadius: open ? '10px 10px 0 0' : 10,
            background: 'var(--surface)',
            color: 'var(--text)',
            font: 'inherit',
            fontSize: '0.9375rem',
            textAlign: 'left',
            cursor: 'pointer',
            boxSizing: 'border-box',
          }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            <strong>{title}</strong>
            {headline?.words ? <span style={{ color: TONE[headline.tone] }}> · {headline.words}</span> : null}
          </span>
          <span style={{ color: 'var(--text-link)', fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{open ? 'Close ▴' : 'Open ▾'}</span>
        </button>
      ) : null}
      <div id={fold ? bodyId : undefined} hidden={fold && !open} style={fold ? { paddingTop: open ? '0.5rem' : 0 } : BARE}>
        {children}
      </div>
    </section>
  )
}
