import { useState, type ReactNode } from 'react'
import { stripStamp, type ChecklistCardEvent } from '../../lib/checklistCardEvents'
import { overdueAgeLabel, type LedgerInstance } from '../../lib/checklistHistoryLedger'

/**
 * The Outstanding section at the bottom of the Today tab (v2.1864): overdue
 * tasks that still need doing — one-offs and show-until-completed items whose
 * date has passed. Rows are actionable: the same complete toggle as Today's
 * cards, plus tap-to-expand card history with a composer. Renders nothing
 * when the list is empty.
 */
export function ChecklistOutstandingSection({
  instances,
  eventsByInstance,
  nameById,
  currentUserId,
  todayStr,
  titleFor,
  onToggleComplete,
  onPostComment,
}: {
  instances: LedgerInstance[]
  eventsByInstance: Map<string, ChecklistCardEvent[]>
  nameById: Record<string, string>
  currentUserId: string | null
  todayStr: string
  titleFor: (inst: LedgerInstance) => ReactNode
  onToggleComplete: (inst: LedgerInstance) => void
  onPostComment: (inst: LedgerInstance, body: string) => Promise<boolean>
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)

  if (instances.length === 0) return null

  const name = (id: string | null | undefined): string => {
    if (!id) return 'Someone'
    if (id === currentUserId) return 'You'
    return nameById[id] ?? 'Someone'
  }

  async function post(inst: LedgerInstance) {
    const body = draft.trim()
    if (!body || posting) return
    setPosting(true)
    try {
      const ok = await onPostComment(inst, body)
      if (ok) setDraft('')
    } finally {
      setPosting(false)
    }
  }

  return (
    <section style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Outstanding</h2>
        <span
          style={{
            fontSize: '0.78rem',
            fontWeight: 600,
            padding: '0.15rem 0.6rem',
            borderRadius: 999,
            background: 'var(--bg-red-100)',
            border: '1px solid #dc2626',
            color: 'var(--text-red-700)',
          }}
        >
          {instances.length} need{instances.length === 1 ? 's' : ''} doing
        </span>
      </div>
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          border: '1.5px solid #dc2626',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {instances.map((inst) => {
          const events = eventsByInstance.get(inst.id) ?? []
          const notes = events.filter((e) => e.event_type === 'comment').length
          const expanded = expandedId === inst.id
          return (
            <li key={inst.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0.75rem' }}>
                <button
                  type="button"
                  onClick={() => onToggleComplete(inst)}
                  aria-label="Mark done"
                  style={{
                    width: 30,
                    height: 30,
                    flexShrink: 0,
                    borderRadius: 8,
                    border: '2.5px solid var(--text-600)',
                    background: 'var(--surface)',
                    cursor: 'pointer',
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setExpandedId(expanded ? null : inst.id)
                    setDraft('')
                  }}
                  aria-expanded={expanded}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    color: 'var(--text-strong)',
                  }}
                >
                  <span style={{ display: 'block', fontSize: '0.9375rem' }}>{titleFor(inst)}</span>
                  <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-red-700)', marginTop: 2 }}>
                    {overdueAgeLabel(inst.scheduled_date, todayStr)}
                    {notes > 0 ? (
                      <span style={{ color: 'var(--text-muted)' }}> · 💬 {notes} {notes === 1 ? 'note' : 'notes'}</span>
                    ) : null}
                  </span>
                </button>
                <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  {expanded ? '▾' : '▸'}
                </span>
              </div>
              {expanded ? (
                <div style={{ padding: '0 0.75rem 0.7rem 3.1rem' }}>
                  {events.length > 0 ? (
                    <div
                      style={{
                        borderLeft: '3px solid var(--border-strong)',
                        paddingLeft: '0.65rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.35rem',
                        margin: '0 0 0.6rem',
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
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void post(inst)
                      }}
                      placeholder="Add a note…"
                      disabled={posting}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        height: 44,
                        boxSizing: 'border-box',
                        padding: '0 0.7rem',
                        fontSize: '1rem',
                        border: '2px solid var(--text-600)',
                        borderRadius: 10,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => void post(inst)}
                      disabled={posting || !draft.trim()}
                      style={{
                        height: 44,
                        padding: '0 1rem',
                        borderRadius: 10,
                        border: 'none',
                        background: posting || !draft.trim() ? '#9ca3af' : '#2563eb',
                        color: 'white',
                        fontSize: '0.9375rem',
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
        })}
      </ul>
    </section>
  )
}
