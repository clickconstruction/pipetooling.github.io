import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  cardStatus,
  commentCount,
  stripStamp,
  type ChecklistCardEvent,
} from '../../lib/checklistCardEvents'

export type ChecklistInstanceCardInstance = {
  id: string
  completed_at: string | null
  reviewed_at: string | null
}

type ChecklistInstanceCardProps = {
  instance: ChecklistInstanceCardInstance
  /** Rendered title (parent supplies ChecklistTitleWithLinks). */
  title: ReactNode
  /** Oldest-first events for this instance. */
  events: ChecklistCardEvent[]
  nameById: Record<string, string>
  currentUserId: string | null
  onToggleComplete: () => void
  /** Resolves true on success; the card clears its draft only then. */
  onPostComment: (body: string) => Promise<boolean>
  /** Right-side extras (mute, FWD) — parent keeps their behavior. */
  actions?: ReactNode
}

/**
 * The Phase-2 mobile-first checklist card (v2.1843): big tap-target complete
 * toggle, a status strip built from the instance + its event stream, a
 * reopened-reason callout, and a collapsed comment thread with an inline
 * composer — replacing the always-open notes textarea.
 */
export function ChecklistInstanceCard({
  instance,
  title,
  events,
  nameById,
  currentUserId,
  onToggleComplete,
  onPostComment,
  actions,
}: ChecklistInstanceCardProps) {
  const [threadOpen, setThreadOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const composerRef = useRef<HTMLInputElement | null>(null)
  const [focusComposerPending, setFocusComposerPending] = useState(false)

  useEffect(() => {
    if (focusComposerPending && threadOpen) {
      composerRef.current?.focus()
      setFocusComposerPending(false)
    }
  }, [focusComposerPending, threadOpen])

  const status = cardStatus(instance, events)
  const comments = commentCount(events)
  const isCompleted = !!instance.completed_at

  const name = (id: string | null | undefined): string => {
    if (!id) return 'Someone'
    if (id === currentUserId) return 'You'
    return nameById[id] ?? 'Someone'
  }

  async function post() {
    const body = draft.trim()
    if (!body || posting) return
    setPosting(true)
    try {
      const ok = await onPostComment(body)
      if (ok) setDraft('')
    } finally {
      setPosting(false)
    }
  }

  const reopenedCallout =
    status.kind === 'reopened' ? (
      <div
        style={{
          margin: '0.5rem 0 0',
          padding: '0.45rem 0.6rem',
          background: 'var(--bg-amber-tint)',
          border: '1px solid var(--border-amber-soft)',
          borderRadius: 6,
          fontSize: '0.8125rem',
          color: 'var(--text-amber-800)',
        }}
      >
        <div style={{ fontWeight: 600 }}>
          Reopened by {name(status.byUserId)} · {stripStamp(status.at)}
        </div>
        {status.reason ? (
          <div style={{ marginTop: 2, color: 'var(--text-700)' }}>
            “{status.reason}”
          </div>
        ) : null}
      </div>
    ) : null

  const statusStrip =
    status.kind === 'waiting_review' ? (
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
        Done {stripStamp(status.at)} · <span style={{ color: 'var(--text-link)' }}>waiting on review</span>
      </div>
    ) : status.kind === 'signed_off' ? (
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
        Done · signed off by {name(status.byUserId)} {stripStamp(status.at)}
      </div>
    ) : null

  return (
    <li
      style={{
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '0.7rem 0.75rem',
        marginBottom: '0.5rem',
        listStyle: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        <button
          type="button"
          onClick={onToggleComplete}
          aria-pressed={isCompleted}
          aria-label={isCompleted ? 'Mark not done' : 'Mark done'}
          style={{
            width: 28,
            height: 28,
            flexShrink: 0,
            borderRadius: 8,
            border: isCompleted ? 'none' : '2px solid var(--border-strong)',
            background: isCompleted ? '#16a34a' : 'var(--surface)',
            color: 'white',
            fontSize: '0.9rem',
            lineHeight: 1,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isCompleted ? '✓' : ''}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 500,
              ...(isCompleted ? { color: 'var(--text-muted)', textDecoration: 'line-through' } : {}),
            }}
          >
            {title}
          </div>
          {statusStrip}
          {reopenedCallout}
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setThreadOpen((o) => !o)}
              aria-expanded={threadOpen}
              style={{
                padding: '0.2rem 0.55rem',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: threadOpen ? 'var(--bg-blue-tint)' : 'var(--bg-muted)',
                color: comments > 0 ? 'var(--text-700)' : 'var(--text-muted)',
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              💬 {comments > 0 ? comments : ''} {comments === 1 ? 'note' : 'notes'}
            </button>
            {!threadOpen ? (
              <button
                type="button"
                onClick={() => {
                  setThreadOpen(true)
                  setFocusComposerPending(true)
                }}
                style={{
                  padding: '0.2rem 0.55rem',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-muted)',
                  color: 'var(--text-muted)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                Add note
              </button>
            ) : null}
          </div>
          {threadOpen ? (
            <div style={{ marginTop: '0.55rem' }}>
              {events.length > 0 ? (
                <div
                  style={{
                    borderLeft: '2px solid var(--border)',
                    paddingLeft: '0.6rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.3rem',
                    marginBottom: '0.5rem',
                  }}
                >
                  {events.map((e) => {
                    if (e.event_type === 'comment') {
                      return (
                        <div key={e.id} style={{ fontSize: '0.8125rem', color: 'var(--text-700)', lineHeight: 1.45 }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{name(e.actor_user_id)}</span>{' '}
                          <span style={{ color: 'var(--text-muted)' }}>{stripStamp(e.created_at)}</span> — {e.body}
                        </div>
                      )
                    }
                    const label =
                      e.event_type === 'completed'
                        ? 'completed'
                        : e.event_type === 'reopened'
                          ? 'reopened'
                          : e.event_type === 'accepted'
                            ? 'signed off'
                            : e.event_type
                    return (
                      <div key={e.id} style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {name(e.actor_user_id)} {label} · {stripStamp(e.created_at)}
                        {e.event_type === 'completed' && e.body ? <> — “{e.body}”</> : null}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No activity yet.</p>
              )}
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <input
                  ref={composerRef}
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void post()
                  }}
                  placeholder="Add a note…"
                  disabled={posting}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '0.4rem 0.55rem',
                    fontSize: '0.875rem',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 6,
                  }}
                />
                <button
                  type="button"
                  onClick={() => void post()}
                  disabled={posting || !draft.trim()}
                  style={{
                    padding: '0.4rem 0.8rem',
                    borderRadius: 6,
                    border: 'none',
                    background: posting || !draft.trim() ? '#9ca3af' : '#3b82f6',
                    color: 'white',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    cursor: posting || !draft.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  {posting ? '…' : 'Post'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
        {actions ? (
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, alignItems: 'flex-start' }}>{actions}</div>
        ) : null}
      </div>
    </li>
  )
}
