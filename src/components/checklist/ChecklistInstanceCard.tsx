import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import {
  cardStatus,
  commentCount,
  stripStamp,
  type ChecklistCardEvent,
} from '../../lib/checklistCardEvents'
import { ChecklistItemActivity, type ChecklistItemActivityItem } from './ChecklistItemActivity'

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
  /**
   * v2.2336: 'card' is the mobile-first sunlight-pass layout (default, unchanged);
   * 'row' is the desktop ledger — one compact line per item, statuses as chips,
   * quiet actions that brighten on hover. Same state, handlers, and thread.
   */
  variant?: 'card' | 'row'
  /**
   * v2.2017: when set, tapping the title toggles the thread, and the open
   * thread renders the task's FULL history (the shared ChecklistItemActivity
   * spine, all occurrences) instead of just this instance's events. New notes
   * still land on THIS occurrence via `commentInstanceId`.
   */
  fullHistory?: {
    item: ChecklistItemActivityItem
    showInstanceDays: boolean
    setError: (s: string | null) => void
    onPosted?: (instanceId: string, body: string) => void
    /** ✓ Complete / ✓ Post & complete in the thread composer (v2.2039). */
    onComplete?: (inst: { id: string; scheduledDate: string }) => Promise<boolean>
  }
}

/**
 * The mobile-first checklist card (v2.1843, sunlight pass v2.1854): this
 * surface is used one-handed on dim phones outdoors, so the note action is a
 * single 48px right-half button (＋ Add a note → 💬 Notes N) with 2px
 * `--text-600` borders (the app has no dark border token) and near-black
 * text — border weight and type
 * size carry the design, not color tints, because tints are the first thing
 * glare erases. The only saturated elements are the blue note-count badge,
 * the blue "Waiting on review" chip, and the Post button.
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
  variant = 'card',
  fullHistory,
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

  const actionBarButtonBase = {
    flex: 1,
    minHeight: 48,
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: '0.4rem',
    borderRadius: 10,
    border: '2px solid var(--text-600)',
    background: 'var(--surface)',
    color: 'var(--text-strong)',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '0 0.5rem',
  }

  const reopenedCallout =
    status.kind === 'reopened' ? (
      <div
        style={{
          margin: '0.6rem 0 0',
          padding: '0.55rem 0.7rem',
          background: 'var(--bg-amber-tint)',
          border: '2px solid #d97706',
          borderRadius: 10,
          color: 'var(--text-amber-800)',
        }}
      >
        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
          Reopened by {name(status.byUserId)} · {stripStamp(status.at)}
        </div>
        {status.reason ? (
          <div style={{ marginTop: 3, fontSize: '0.9375rem', color: 'var(--text-700)', lineHeight: 1.45 }}>
            “{status.reason}”
          </div>
        ) : null}
      </div>
    ) : null

  const statusStrip =
    status.kind === 'waiting_review' ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            padding: '0.25rem 0.6rem',
            borderRadius: 8,
            background: '#2563eb',
            color: 'white',
          }}
        >
          Waiting on review
        </span>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>Done {stripStamp(status.at)}</span>
      </div>
    ) : status.kind === 'signed_off' ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            padding: '0.25rem 0.6rem',
            borderRadius: 8,
            background: '#16a34a',
            color: 'white',
          }}
        >
          Signed off
        </span>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>
          by {name(status.byUserId)} {stripStamp(status.at)}
        </span>
      </div>
    ) : null

  const rowChipBase = {
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '2px 9px',
    borderRadius: 999,
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  }

  /** Desktop ledger row (v2.2336): one line — checkbox, title, status chips, quiet actions. */
  const rowBody = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minHeight: 36 }}>
      <button
        type="button"
        onClick={onToggleComplete}
        aria-pressed={isCompleted}
        aria-label={isCompleted ? 'Mark not done' : 'Mark done'}
        style={{
          width: 22,
          height: 22,
          flexShrink: 0,
          borderRadius: 6,
          border: isCompleted ? 'none' : '2px solid var(--text-600)',
          background: isCompleted ? '#16a34a' : 'var(--surface)',
          color: 'white',
          fontSize: '0.8rem',
          lineHeight: 1,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isCompleted ? '✓' : ''}
      </button>
      <div
        {...(fullHistory
          ? {
              role: 'button' as const,
              tabIndex: 0,
              'aria-expanded': threadOpen,
              'aria-label': `${threadOpen ? 'Hide' : 'Show'} activity for ${fullHistory.item.title}`,
              onClick: (e: MouseEvent<HTMLDivElement>) => {
                if ((e.target as HTMLElement).closest('a')) return
                setThreadOpen((o) => !o)
              },
              onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setThreadOpen((o) => !o)
                }
              },
            }
          : {})}
        style={{
          flex: 1,
          minWidth: 0,
          fontWeight: 500,
          fontSize: '0.9375rem',
          lineHeight: 1.35,
          ...(fullHistory ? { cursor: 'pointer' } : {}),
          ...(isCompleted ? { color: 'var(--text-muted)', textDecoration: 'line-through' } : {}),
        }}
      >
        {title}
      </div>
      {status.kind === 'waiting_review' ? (
        <span style={{ ...rowChipBase, background: '#2563eb', color: 'white' }} title={`Done ${stripStamp(status.at)}`}>
          Waiting on review
        </span>
      ) : null}
      {status.kind === 'signed_off' ? (
        <span style={{ ...rowChipBase, background: '#16a34a', color: 'white' }} title={`by ${name(status.byUserId)} ${stripStamp(status.at)}`}>
          Signed off
        </span>
      ) : null}
      {status.kind === 'reopened' ? (
        <span
          style={{
            ...rowChipBase,
            background: 'var(--bg-amber-tint)',
            color: 'var(--text-amber-800)',
            border: '1px solid var(--border-amber)',
          }}
          title={status.reason ? `Reopened by ${name(status.byUserId)}: “${status.reason}”` : `Reopened by ${name(status.byUserId)}`}
        >
          Reopened · {stripStamp(status.at)}
        </span>
      ) : null}
      {comments > 0 ? (
        <button
          type="button"
          onClick={() => setThreadOpen((o) => !o)}
          aria-expanded={threadOpen}
          style={{
            ...rowChipBase,
            background: 'var(--bg-blue-tint)',
            color: 'var(--text-blue-700)',
            border: threadOpen ? '1px solid #2563eb' : '1px solid transparent',
            cursor: 'pointer',
          }}
        >
          {comments} note{comments === 1 ? '' : 's'}
        </button>
      ) : (
        <button
          type="button"
          className="myInboxRowActions"
          onClick={() => {
            if (threadOpen) {
              setThreadOpen(false)
              return
            }
            setThreadOpen(true)
            setFocusComposerPending(true)
          }}
          aria-expanded={threadOpen}
          style={{
            ...rowChipBase,
            background: 'var(--surface)',
            color: 'var(--text-600)',
            border: '1px solid var(--border-strong)',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          ＋ Note
        </button>
      )}
      {actions ? (
        <span className="myInboxRowActions" style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
          {actions}
        </span>
      ) : null}
    </div>
  )

  return (
    <li
      className={variant === 'row' ? 'myInboxRow' : undefined}
      style={
        variant === 'row'
          ? { borderBottom: '1px solid var(--border-rule)', padding: '0.35rem 0.25rem', listStyle: 'none' }
          : { border: '1.5px solid var(--border-strong)', borderRadius: 12, padding: '0.75rem', marginBottom: '0.7rem', listStyle: 'none' }
      }
    >
      {variant === 'row' ? (
        rowBody
      ) : (
      <>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        <button
          type="button"
          onClick={onToggleComplete}
          aria-pressed={isCompleted}
          aria-label={isCompleted ? 'Mark not done' : 'Mark done'}
          style={{
            width: 34,
            height: 34,
            flexShrink: 0,
            borderRadius: 9,
            border: isCompleted ? 'none' : '2.5px solid var(--text-600)',
            background: isCompleted ? '#16a34a' : 'var(--surface)',
            color: 'white',
            fontSize: '1.1rem',
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
            {...(fullHistory
              ? {
                  role: 'button' as const,
                  tabIndex: 0,
                  'aria-expanded': threadOpen,
                  'aria-label': `${threadOpen ? 'Hide' : 'Show'} activity for ${fullHistory.item.title}`,
                  onClick: (e: MouseEvent<HTMLDivElement>) => {
                    // Links inside the title stay links — don't toggle on them.
                    if ((e.target as HTMLElement).closest('a')) return
                    setThreadOpen((o) => !o)
                  },
                  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setThreadOpen((o) => !o)
                    }
                  },
                }
              : {})}
            style={{
              fontWeight: 500,
              fontSize: '1rem',
              lineHeight: 1.35,
              marginTop: 2,
              ...(fullHistory ? { cursor: 'pointer' } : {}),
              ...(isCompleted ? { color: 'var(--text-muted)', textDecoration: 'line-through' } : {}),
            }}
          >
            {title}
          </div>
          {statusStrip}
          {reopenedCallout}
        </div>
        {actions ? (
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, alignItems: 'flex-start' }}>{actions}</div>
        ) : null}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.7rem' }}>
        {/* ONE note action, always on the RIGHT half (owner calls, v2.1858 +
            v2.1864): the left half under the complete toggle stays dead space
            so a thumb aiming at notes can't graze the checkbox. Zero notes →
            "＋ Add a note" (opens the thread and focuses the composer); once a
            note exists → "💬 Notes N" (the open thread carries the composer,
            so a separate add button is redundant). */}
        <span aria-hidden="true" style={{ flex: 1 }} />
        {comments > 0 ? (
          <button
            type="button"
            onClick={() => setThreadOpen((o) => !o)}
            aria-expanded={threadOpen}
            style={{
              ...actionBarButtonBase,
              ...(threadOpen ? { background: 'var(--bg-blue-tint)', borderColor: '#2563eb' } : {}),
            }}
          >
            💬 Notes
            <span
              style={{
                background: '#2563eb',
                color: 'white',
                fontSize: '0.875rem',
                fontWeight: 600,
                minWidth: 24,
                height: 24,
                borderRadius: 12,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 0.3rem',
              }}
            >
              {comments}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (threadOpen) {
                setThreadOpen(false)
                return
              }
              setThreadOpen(true)
              setFocusComposerPending(true)
            }}
            aria-expanded={threadOpen}
            style={actionBarButtonBase}
          >
            ＋ Add a note
          </button>
        )}
      </div>
      </>
      )}
      {threadOpen && fullHistory ? (
        <div style={{ marginTop: '0.65rem' }}>
          <ChecklistItemActivity
            item={fullHistory.item}
            authUserId={currentUserId}
            showInstanceDays={fullHistory.showInstanceDays}
            setError={fullHistory.setError}
            commentInstanceId={instance.id}
            onPosted={fullHistory.onPosted}
            onComplete={fullHistory.onComplete}
          />
        </div>
      ) : null}
      {threadOpen && !fullHistory ? (
        <div style={{ marginTop: '0.65rem' }}>
          {events.length > 0 ? (
            <div
              style={{
                borderLeft: '3px solid var(--border-strong)',
                paddingLeft: '0.65rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
                marginBottom: '0.6rem',
              }}
            >
              {events.map((e) => {
                if (e.event_type === 'comment') {
                  return (
                    <div key={e.id} style={{ fontSize: '0.9375rem', color: 'var(--text-700)', lineHeight: 1.45 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{name(e.actor_user_id)}</span>{' '}
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{stripStamp(e.created_at)}</span>{' '}
                      — {e.body}
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
                  <div key={e.id} style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    {name(e.actor_user_id)} {label} · {stripStamp(e.created_at)}
                    {e.event_type === 'completed' && e.body ? <> — “{e.body}”</> : null}
                  </div>
                )
              })}
            </div>
          ) : (
            <p style={{ margin: '0 0 0.6rem', fontSize: '0.9375rem', color: 'var(--text-muted)' }}>No activity yet.</p>
          )}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
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
                height: 48,
                boxSizing: 'border-box',
                padding: '0 0.75rem',
                fontSize: '1rem',
                border: '2px solid var(--text-600)',
                borderRadius: 10,
              }}
            />
            <button
              type="button"
              onClick={() => void post()}
              disabled={posting || !draft.trim()}
              style={{
                height: 48,
                padding: '0 1.25rem',
                borderRadius: 10,
                border: 'none',
                background: posting || !draft.trim() ? '#9ca3af' : '#2563eb',
                color: 'white',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: posting || !draft.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {posting ? '…' : 'Post'}
            </button>
          </div>
        </div>
      ) : null}
    </li>
  )
}
