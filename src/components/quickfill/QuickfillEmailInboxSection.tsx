import { useMemo, useState, type CSSProperties } from 'react'
import { useReportQuickfillSectionMetric } from '../../contexts/QuickfillSectionMetricsContext'
import { useToastContext } from '../../contexts/ToastContext'

const NOTE_MAX_CHARS = 10_000

const DEFAULT_GMAIL_HREF = 'https://mail.google.com/mail/u/0/#inbox'

type MarkPalette = { bg: string; border: string }

export type QuickfillEmailInboxSectionProps = {
  metricSectionId: string
  markButtonPalette: MarkPalette
  onConfirmMark: (trimmedNote: string) => void
  fieldLabel?: string
  description?: string
  markButtonLabel?: string
  emptyNoteToast?: string
  gmailHref?: string
}

const introRowStyle: CSSProperties = {
  margin: '0 0 0.75rem',
  fontSize: '0.875rem',
  lineHeight: 1.45,
  color: '#475569',
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  gap: '0.35rem',
}

const linkStyle: CSSProperties = {
  color: '#2563eb',
  fontWeight: 600,
}

export function QuickfillEmailInboxSection({
  metricSectionId,
  markButtonPalette,
  onConfirmMark,
  fieldLabel = 'Still in inbox',
  description = ' - Before marking complete, list what is still in your inbox (one item per line or free text).',
  markButtonLabel = 'Mark Email up to date!',
  emptyNoteToast = 'List what is still in your inbox before marking complete.',
  gmailHref = DEFAULT_GMAIL_HREF,
}: QuickfillEmailInboxSectionProps) {
  const { showToast } = useToastContext()
  const [inboxNote, setInboxNote] = useState('')

  const itemsNotedCount = useMemo(() => {
    return inboxNote.split(/\r?\n/).filter((line) => line.trim().length > 0).length
  }, [inboxNote])

  useReportQuickfillSectionMetric(metricSectionId, itemsNotedCount, false)

  function handleMarkComplete() {
    const trimmed = inboxNote.trim()
    if (!trimmed) {
      showToast(emptyNoteToast, 'warning')
      return
    }
    const capped = trimmed.length > NOTE_MAX_CHARS ? trimmed.slice(0, NOTE_MAX_CHARS) : trimmed
    onConfirmMark(capped)
    setInboxNote('')
  }

  const promptId = `quickfill-${metricSectionId}-prompt`
  const textareaId = `quickfill-${metricSectionId}-textarea`

  return (
    <section
      style={{
        borderRadius: 8,
        padding: '1rem 1.25rem',
        background: '#fafafa',
      }}
    >
      <div id={promptId} style={introRowStyle}>
        <a href={gmailHref} target="_blank" rel="noopener noreferrer" style={linkStyle}>
          Open Gmail
        </a>
        <span style={{ color: '#94a3b8', userSelect: 'none' }} aria-hidden>
          |
        </span>
        <label htmlFor={textareaId} style={{ fontWeight: 600, color: '#374151', cursor: 'pointer', margin: 0 }}>
          {fieldLabel}
        </label>
        <span>{description}</span>
      </div>
      <textarea
        id={textareaId}
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
          {markButtonLabel}
        </button>
      </div>
    </section>
  )
}
