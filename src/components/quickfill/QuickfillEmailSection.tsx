import { useMemo, useState, type CSSProperties } from 'react'
import { useReportQuickfillSectionMetric } from '../../contexts/QuickfillSectionMetricsContext'
import { useToastContext } from '../../contexts/ToastContext'

/**
 * Quickfill → Email (v2.2185): Inbox · Follow Up · Next Actions as three rows of
 * ONE section with one mark (was three sections — the same widget three times,
 * each with its own chip, mark, and a button label that didn't match its
 * title). Keeps the `email-inbox` section id so history and saved order carry
 * over. The mark still wants a note: at least one row says what's still there
 * (or "clear"); the saved note is the rows joined with their labels.
 */

const NOTE_MAX_CHARS = 10_000

type MarkPalette = { bg: string; border: string }

export const QUICKFILL_EMAIL_ROWS = [
  { key: 'inbox', label: 'Inbox', linkLabel: 'Open Gmail', href: 'https://mail.google.com/mail/u/0/#inbox', placeholder: 'Still in inbox — one per line, or free text' },
  { key: 'follow-up', label: 'Follow Up', linkLabel: 'Open label', href: 'https://mail.google.com/mail/u/0/#label/Follow+Up', placeholder: 'Still in Follow Up' },
  { key: 'next-actions', label: 'Next Actions', linkLabel: 'Open label', href: 'https://mail.google.com/mail/u/0/#label/Next+Actions', placeholder: 'Still in Next Actions' },
] as const

type RowKey = (typeof QUICKFILL_EMAIL_ROWS)[number]['key']

/** The note the mark saves: "Inbox: …" / "Follow Up: …" for each non-empty row. Exported for the test. */
export function composeEmailMarkNote(notes: Record<RowKey, string>): string {
  const parts: string[] = []
  for (const r of QUICKFILL_EMAIL_ROWS) {
    const t = notes[r.key].trim()
    if (t) parts.push(`${r.label}: ${t}`)
  }
  const joined = parts.join('\n')
  return joined.length > NOTE_MAX_CHARS ? joined.slice(0, NOTE_MAX_CHARS) : joined
}

export function countEmailNoteLines(notes: Record<RowKey, string>): number {
  let n = 0
  for (const r of QUICKFILL_EMAIL_ROWS) n += notes[r.key].split(/\r?\n/).filter((l) => l.trim().length > 0).length
  return n
}

const linkStyle: CSSProperties = { color: 'var(--text-link)', fontWeight: 600, fontSize: '0.8125rem', textDecoration: 'none' }

export function QuickfillEmailSection({
  metricSectionId,
  markButtonPalette,
  onConfirmMark,
}: {
  metricSectionId: string
  markButtonPalette: MarkPalette
  onConfirmMark: (trimmedNote: string) => void
}) {
  const { showToast } = useToastContext()
  const [notes, setNotes] = useState<Record<RowKey, string>>({ inbox: '', 'follow-up': '', 'next-actions': '' })
  const lines = useMemo(() => countEmailNoteLines(notes), [notes])
  useReportQuickfillSectionMetric(metricSectionId, lines, false)

  function handleMark() {
    const note = composeEmailMarkNote(notes)
    if (!note) {
      showToast('Say what is still in Inbox, Follow Up, or Next Actions (or "clear") before marking.', 'warning')
      return
    }
    onConfirmMark(note)
    setNotes({ inbox: '', 'follow-up': '', 'next-actions': '' })
  }

  return (
    <section style={{ borderRadius: 8, padding: '0.75rem 1rem 1rem', background: 'var(--bg-page)' }}>
      {QUICKFILL_EMAIL_ROWS.map((r, i) => {
        const taId = `quickfill-email-${r.key}-textarea`
        return (
          <div
            key={r.key}
            style={{
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              padding: '0.55rem 0',
              borderTop: i === 0 ? 'none' : '1px solid var(--border)',
            }}
          >
            <div style={{ flex: '0 0 8.5rem', minWidth: 0 }}>
              <label htmlFor={taId} style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
                {r.label}
              </label>
              <a href={r.href} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                {r.linkLabel} →
              </a>
            </div>
            <textarea
              id={taId}
              value={notes[r.key]}
              onChange={(e) => setNotes((prev) => ({ ...prev, [r.key]: e.target.value }))}
              placeholder={r.placeholder}
              rows={2}
              style={{
                flex: '1 1 14rem',
                minWidth: 0,
                boxSizing: 'border-box',
                padding: '0.5rem 0.6rem',
                borderRadius: 6,
                border: '1px solid var(--border-strong)',
                fontSize: '0.875rem',
                fontFamily: 'inherit',
                resize: 'vertical',
                minHeight: '2.6rem',
              }}
            />
          </div>
        )
      })}
      <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={handleMark}
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
