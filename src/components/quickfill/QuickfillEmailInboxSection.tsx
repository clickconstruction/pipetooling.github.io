import { useMemo, useState, type CSSProperties } from 'react'
import { useReportQuickfillSectionMetric } from '../../contexts/QuickfillSectionMetricsContext'
import { useToastContext } from '../../contexts/ToastContext'

const NOTE_MAX_CHARS = 10_000

type MarkPalette = { bg: string; border: string }

type QuickfillEmailInboxSectionProps = {
  markButtonPalette: MarkPalette
  onConfirmMark: (trimmedNote: string) => void
}

const hintStyle: CSSProperties = {
  fontSize: '0.875rem',
  color: '#475569',
  margin: '0 0 0.75rem',
  lineHeight: 1.45,
}

const linkStyle: CSSProperties = {
  color: '#2563eb',
  fontWeight: 600,
}

export function QuickfillEmailInboxSection({ markButtonPalette, onConfirmMark }: QuickfillEmailInboxSectionProps) {
  const { showToast } = useToastContext()
  const [inboxNote, setInboxNote] = useState('')

  const itemsNotedCount = useMemo(() => {
    return inboxNote.split(/\r?\n/).filter((line) => line.trim().length > 0).length
  }, [inboxNote])

  useReportQuickfillSectionMetric('email-inbox', itemsNotedCount, false)

  function handleMarkComplete() {
    const trimmed = inboxNote.trim()
    if (!trimmed) {
      showToast('List what is still in your inbox before marking complete.', 'warning')
      return
    }
    const capped = trimmed.length > NOTE_MAX_CHARS ? trimmed.slice(0, NOTE_MAX_CHARS) : trimmed
    onConfirmMark(capped)
    setInboxNote('')
  }

  const promptId = 'quickfill-email-inbox-prompt'

  return (
    <section
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: '1rem 1.25rem',
        background: '#fafafa',
      }}
    >
      <p id={promptId} style={hintStyle}>
        Before marking complete, list what is still in your inbox (one item per line or free text). This is saved in
        mark history—no connection to Gmail.
      </p>
      <div
        style={{
          margin: '0 0 0.35rem',
          fontSize: '0.875rem',
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.35rem',
        }}
      >
        <a href="https://mail.google.com/mail/u/0/#inbox" target="_blank" rel="noopener noreferrer" style={linkStyle}>
          Open Gmail
        </a>
        <span style={{ color: '#94a3b8', userSelect: 'none' }} aria-hidden>
          |
        </span>
        <label
          htmlFor="quickfill-email-inbox-textarea"
          style={{ fontWeight: 600, color: '#374151', cursor: 'pointer', margin: 0 }}
        >
          Still in inbox
        </label>
      </div>
      <textarea
        id="quickfill-email-inbox-textarea"
        value={inboxNote}
        onChange={(e) => setInboxNote(e.target.value)}
        aria-describedby={promptId}
        rows={6}
        style={{
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          padding: '0.65rem',
          borderRadius: 6,
          border: '1px solid #d1d5db',
          fontSize: '0.875rem',
          fontFamily: 'inherit',
          resize: 'vertical',
          minHeight: '6rem',
        }}
      />
      <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={handleMarkComplete}
          style={{
            padding: '0.5rem 0.75rem',
            borderRadius: 6,
            background: markButtonPalette.bg,
            border: `1px solid ${markButtonPalette.border}`,
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
        >
          Mark Email up to date!
        </button>
      </div>
    </section>
  )
}
