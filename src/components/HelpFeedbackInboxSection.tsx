/**
 * Dev-only inbox card for /help guide feedback. Self-contained (owns its hook
 * and open/expand state) so mounting it is a one-liner on the Dashboard and
 * the Checklist Review tab; renders nothing for non-dev users.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useHelpFeedbackInbox, type HelpFeedbackInboxRow } from '../hooks/useHelpFeedbackInbox'
import { ageChipStyle, describeAge, HELP_FEEDBACK_AGE } from '../lib/ageState'
import { EmptyState } from './EmptyState'
import { HELP_FEEDBACK_EMPTY } from '../lib/dashboard/dashboardEmptyWords'
import { noteContextChips, openThatPagePath, parseNoteContext, type NoteContextChip } from '../lib/tellTheDev/noteContext'
import { noteKindChip, wordlessNoteLine } from '../lib/tellTheDev/starts'
import { noteBrief } from '../lib/tellTheDev/brief'
import { useToastContext } from '../contexts/ToastContext'

/** The kind's chip: a fault reads red, confusion amber, a want blue, a guide's note plain. */
function kindChipStyle(kind: string): React.CSSProperties {
  const tone =
    kind === 'broken'
      ? { color: 'var(--text-red-700)', background: 'var(--bg-red-tint)', border: '1px solid var(--border-red)' }
      : kind === 'confusing'
        ? { color: 'var(--text-amber-700)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)' }
        : kind === 'want'
          ? { color: 'var(--text-blue-700)', background: 'var(--bg-blue-tint)', border: '1px solid var(--border-blue)' }
          : { color: 'var(--text-muted)', background: 'var(--bg-muted)', border: '1px solid var(--border)' }
  return { ...tone, fontSize: '0.72rem', fontWeight: 700, padding: '0.08rem 0.5rem', borderRadius: 999, whiteSpace: 'nowrap', marginRight: 6 }
}

function contextChipStyle(chip: NoteContextChip): React.CSSProperties {
  const tone =
    chip.tone === 'trouble'
      ? { color: 'var(--text-red-700)', background: 'var(--bg-red-tint)', border: '1px solid var(--border-red)' }
      : chip.tone === 'page'
        ? { color: 'var(--text-blue-700)', background: 'var(--bg-blue-tint)', border: '1px solid var(--border-blue)' }
        : { color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--border)' }
  return { ...tone, fontSize: '0.72rem', fontWeight: 600, padding: '0.08rem 0.5rem', borderRadius: 999, overflowWrap: 'anywhere' }
}

function formatDatetime(iso: string | null): string {
  if (!iso) return 'unknown'
  const date = new Date(iso)
  const weekday = date.toLocaleDateString(undefined, { weekday: 'short' })
  const dateTime = date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  return `${weekday}, ${dateTime}`
}

export function HelpFeedbackInboxSection() {
  const {
    helpFeedbackEligible,
    rows,
    loading,
    closingId,
    closeHelpFeedback,
    reopenHelpFeedback,
  } = useHelpFeedbackInbox()
  const [sectionOpen, setSectionOpen] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [closeNoteDraft, setCloseNoteDraft] = useState('')
  const { showToast } = useToastContext()

  if (!helpFeedbackEligible) return null

  const openCount = rows.filter((r) => r.status === 'open').length

  // An empty inbox compresses to a single slim line — no body, no full-size header.
  if (!loading && rows.length === 0) {
    return (
      <div
        style={{
          marginBottom: '0.5rem',
          border: '1px solid var(--border)',
          borderRadius: 8,
          background: 'var(--bg-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.3rem 1rem',
          color: 'var(--text-muted)',
          fontSize: '0.8125rem',
        }}
      >
        <span style={{ fontWeight: 600 }}>Notes to the dev</span>
        <span>{HELP_FEEDBACK_EMPTY.main}</span>
      </div>
    )
  }

  function renderRow(row: HelpFeedbackInboxRow) {
    const isClosed = row.status === 'closed'
    const expanded = expandedId === row.id
    const fromLabel = row.sender?.name?.trim() || row.sender?.email?.trim() || 'Unknown'
    const busy = closingId === row.id
    // Age chip on OPEN rows (punch list #184 sweep B): HELP_FEEDBACK_AGE, a week amber, two red.
    const openAge = isClosed ? null : describeAge(row.created_at, undefined, HELP_FEEDBACK_AGE)
    // A note from a page (punch list #380) carries its page and state; a guide's note carries neither.
    const noteContext = parseNoteContext(row.context)
    const pagePath = openThatPagePath(row.page_path)
    const words = row.body?.trim() ?? ''
    return (
      <li
        key={row.id}
        style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--border)', background: isClosed ? 'var(--bg-muted)' : undefined }}
      >
        <div
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setExpandedId(expanded ? null : row.id)
            }
          }}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('a')) return
            setExpandedId(expanded ? null : row.id)
            setCloseNoteDraft('')
          }}
          style={{ cursor: 'pointer' }}
        >
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 4 }}>
            <span aria-hidden style={{ marginRight: 6 }}>{expanded ? '▼' : '▶'}</span>
            <span style={kindChipStyle(row.kind)}>{noteKindChip(row.kind)}</span>
            From {fromLabel}
            {row.created_at ? <span style={{ marginLeft: '0.5rem' }}>· {formatDatetime(row.created_at)}</span> : null}
            {openAge ? (
              <span
                title={formatDatetime(row.created_at)}
                style={{ marginLeft: '0.35rem', fontSize: '0.72rem', fontWeight: 600, padding: '0.08rem 0.45rem', borderRadius: 7, whiteSpace: 'nowrap', ...ageChipStyle(openAge.state) }}
              >
                {openAge.label}
              </span>
            ) : null}
            {row.guide_slug ? (
            <Link
              to={`/help?g=${encodeURIComponent(row.guide_slug)}`}
              onClick={(e) => e.stopPropagation()}
              style={{
                marginLeft: '0.5rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-blue-700)',
                background: 'var(--bg-blue-tint)',
                border: '1px solid var(--border-blue)',
                borderRadius: 999,
                padding: '0.1rem 0.55rem',
                textDecoration: 'none',
              }}
            >
              {row.guide_slug}
            </Link>
            ) : null}
          </div>
          {words ? (
            <div style={{ fontWeight: 500, whiteSpace: 'pre-wrap' }}>{row.body}</div>
          ) : (
            <div style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>{wordlessNoteLine(row.kind)}</div>
          )}
          {noteContext ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
              {noteContextChips(noteContext).map((chip, i) => (
                <span key={`${chip.text}-${i}`} style={contextChipStyle(chip)}>
                  {chip.text}
                </span>
              ))}
            </div>
          ) : null}
          {isClosed && row.closed_note?.trim() ? (
            <div style={{ marginTop: 4, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Closed{row.closed_by?.name?.trim() ? ` by ${row.closed_by.name}` : ''}: {row.closed_note}
            </div>
          ) : null}
        </div>
        {expanded && (
          <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {pagePath ? (
              <Link
                to={pagePath}
                style={{ padding: '0.35rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-base)', textDecoration: 'none', background: 'var(--surface)' }}
              >
                Open that page
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => {
                const brief = noteBrief({ kind: row.kind, body: row.body, page_path: row.page_path, created_at: row.created_at, context: noteContext })
                void navigator.clipboard
                  .writeText(brief)
                  .then(() => showToast('Copied. Paste it into a coding session.', 'success'))
                  .catch(() => showToast('The browser would not copy it. Select the note and copy it by hand.', 'warning'))
              }}
              style={{ padding: '0.35rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-base)', background: 'var(--surface)', cursor: 'pointer' }}
            >
              Copy as a brief
            </button>
            {!isClosed ? (
              <>
                <input
                  type="text"
                  value={closeNoteDraft}
                  onChange={(e) => setCloseNoteDraft(e.target.value)}
                  placeholder="Answer, one line. The sender reads it."
                  style={{ flex: 1, minWidth: 180, padding: '0.4rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    void closeHelpFeedback(row.id, closeNoteDraft)
                    setCloseNoteDraft('')
                  }}
                  style={{ padding: '0.4rem 0.85rem', background: '#15803d', color: 'white', border: 'none', borderRadius: 4, cursor: busy ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: 500 }}
                >
                  {busy ? 'Closing…' : 'Answer and close'}
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void reopenHelpFeedback(row.id)}
                style={{ padding: '0.4rem 0.85rem', background: 'var(--surface)', color: 'var(--text-blue-700)', border: '1px solid #93c5fd', borderRadius: 4, cursor: busy ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: 500 }}
              >
                {busy ? '…' : 'Reopen'}
              </button>
            )}
          </div>
        )}
      </li>
    )
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', marginBottom: '1rem' }}>
      <button
        type="button"
        aria-expanded={sectionOpen}
        onClick={() => setSectionOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          width: '100%',
          padding: '0.75rem 1rem',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '1rem',
          fontWeight: 600,
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: '0.75rem' }} aria-hidden>{sectionOpen ? '▼' : '▶'}</span>
        Notes to the dev
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            color: openCount > 0 ? 'var(--text-amber-700)' : 'var(--text-muted)',
            background: openCount > 0 ? 'var(--bg-amber-tint)' : 'var(--bg-muted)',
            border: `1px solid ${openCount > 0 ? 'var(--border-amber)' : 'var(--border)'}`,
            borderRadius: 999,
            padding: '0.05rem 0.5rem',
          }}
        >
          {openCount}
        </span>
      </button>
      {sectionOpen && (
        <div style={{ padding: '0 1rem 0.75rem', borderTop: '1px solid var(--border)' }}>
          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
          ) : rows.length === 0 ? (
            <EmptyState compact {...HELP_FEEDBACK_EMPTY} />
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>{rows.map(renderRow)}</ul>
          )}
        </div>
      )}
    </div>
  )
}
