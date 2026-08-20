import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { stripStamp, type ChecklistCardEvent } from '../../lib/checklistCardEvents'
import type { BridgeChip, BridgeState } from '../../lib/roadmapBridge'

type UserRow = { id: string; name: string; email: string }

type TaskForCard = { id: string; title: string; assigneeIds: string[] }

type Props = {
  open: boolean
  task: TaskForCard | null
  groupTitle: string
  /** Bridge row for this task (undefined when not materialized yet). */
  bridge: BridgeState | undefined
  chip: BridgeChip
  users: UserRow[]
  currentUserId: string | null
  canEditStructure: boolean
  /** Oldest-first events for the bridged instance. */
  loadEvents: (instanceId: string) => Promise<ChecklistCardEvent[]>
  /** Resolves true on success; the composer clears its draft only then. */
  postComment: (instanceId: string, body: string) => Promise<boolean>
  onSave: (title: string, assigneeUserIds: string[]) => Promise<boolean>
  /** Jump to the Today tab (the live checklist card). */
  onOpenTodayTab?: () => void
  onClose: () => void
  /** e.g. roadmap canvas in Fullscreen API — modals must mount inside the fullscreen element */
  portalContainer?: HTMLElement | null
}

/**
 * The roadmap task card (v2.1901): opening a task on the canvas leads with the
 * bridged checklist card's conversation — status chips, the events-spine
 * activity thread, and a note composer — instead of jumping straight to a
 * mutation form. Title/assignee editing folds into a collapsed section for
 * structure editors; everyone else gets a read-plus-notes view. Notes posted
 * here land on the same card the assignee sees on their Today list.
 */
export function ChecklistTechTreeTaskCardModal({
  open,
  task,
  groupTitle,
  bridge,
  chip,
  users,
  currentUserId,
  canEditStructure,
  loadEvents,
  postComment,
  onSave,
  onOpenTodayTab,
  onClose,
  portalContainer,
}: Props) {
  const [events, setEvents] = useState<ChecklistCardEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [assignees, setAssignees] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)

  const instanceId = bridge?.instanceId ?? null

  useEffect(() => {
    if (!open || !task) return
    setDraft('')
    setEditOpen(false)
    setTitle(task.title)
    const m: Record<string, boolean> = {}
    for (const id of task.assigneeIds) m[id] = true
    setAssignees(m)
  }, [open, task])

  useEffect(() => {
    if (!open || !instanceId) {
      setEvents([])
      return
    }
    let cancelled = false
    setEventsLoading(true)
    void loadEvents(instanceId)
      .then((evs) => {
        if (!cancelled) setEvents(evs)
      })
      .finally(() => {
        if (!cancelled) setEventsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, instanceId, loadEvents])

  const nameById = useMemo(() => {
    const m: Record<string, string> = {}
    for (const u of users) m[u.id] = u.name || u.email
    return m
  }, [users])

  const usersOrderedForDisplay = useMemo(() => {
    if (!currentUserId) return users
    const me = users.find((u) => u.id === currentUserId)
    if (!me) return users
    return [me, ...users.filter((u) => u.id !== currentUserId)]
  }, [users, currentUserId])

  if (!open || !task) return null

  const name = (id: string | null | undefined): string => {
    if (!id) return 'Someone'
    if (id === currentUserId) return 'You'
    return nameById[id] ?? 'Someone'
  }

  const assigneeNames = task.assigneeIds.map((id) => nameById[id] ?? '…')

  async function post() {
    if (!instanceId) return
    const body = draft.trim()
    if (!body || posting) return
    setPosting(true)
    try {
      const ok = await postComment(instanceId, body)
      if (ok) {
        setDraft('')
        setEvents(await loadEvents(instanceId))
      }
    } finally {
      setPosting(false)
    }
  }

  async function save() {
    const trimmed = title.trim()
    if (!trimmed || saving) return
    setSaving(true)
    try {
      const assigneeUserIds = Object.entries(assignees)
        .filter(([, v]) => v)
        .map(([k]) => k)
      const ok = await onSave(trimmed, assigneeUserIds)
      if (ok) onClose()
    } finally {
      setSaving(false)
    }
  }

  const chipStyles: Record<string, React.CSSProperties> = {
    in_review: { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)' },
    signed_off: { background: '#16a34a', color: 'white' },
    on_list: { background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', color: 'var(--text-muted)' },
  }
  const chipLabel = chip === 'in_review' ? 'in review' : chip === 'signed_off' ? 'signed off' : 'on list'

  const target = typeof document !== 'undefined' ? (portalContainer ?? document.body) : null
  if (!target) return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10050,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'calc(16px + env(safe-area-inset-top, 0px)) 16px calc(16px + env(safe-area-inset-bottom, 0px))',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving && !posting) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tech-tree-task-card-title"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: 20,
          maxWidth: 460,
          width: '100%',
          maxHeight: 'min(90vh, 100%)',
          overflow: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <p style={{ margin: '0 0 4px', color: 'var(--text-slate-500)', fontSize: 13 }}>{groupTitle || '—'}</p>
        <h2 id="tech-tree-task-card-title" style={{ margin: '0 0 10px', fontSize: '1.0625rem', lineHeight: 1.35 }}>
          {task.title}
        </h2>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {chip ? (
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: 999,
                whiteSpace: 'nowrap',
                ...chipStyles[chip],
              }}
            >
              {chipLabel}
            </span>
          ) : null}
          {assigneeNames.map((n) => (
            <span
              key={n}
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: 999,
                background: 'var(--bg-blue-tint)',
                color: 'var(--text-blue-800)',
                whiteSpace: 'nowrap',
              }}
            >
              {n}
            </span>
          ))}
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-slate-500)', marginBottom: 8 }}>Activity</div>
          {!instanceId ? (
            <p style={{ margin: '0 0 4px', fontSize: '0.9375rem', color: 'var(--text-muted)' }}>
              {task.assigneeIds.length === 0
                ? 'Not on anyone’s list yet — assign someone and this task lands on their list when the stage unlocks.'
                : 'Not on the list yet — it lands on the assignees’ lists when this stage unlocks.'}
            </p>
          ) : (
            <>
              {eventsLoading ? (
                <p style={{ margin: '0 0 8px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading…</p>
              ) : events.length === 0 ? (
                <p style={{ margin: '0 0 8px', fontSize: '0.9375rem', color: 'var(--text-muted)' }}>No activity yet.</p>
              ) : (
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
                        {e.event_type === 'completed' && e.body ? <> — “{e.body}”</> : null}
                      </div>
                    )
                  })}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input
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
                    height: 40,
                    boxSizing: 'border-box',
                    padding: '0 0.7rem',
                    fontSize: '0.9375rem',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 8,
                  }}
                />
                <button
                  type="button"
                  onClick={() => void post()}
                  disabled={posting || !draft.trim()}
                  style={{
                    height: 40,
                    padding: '0 0.9rem',
                    borderRadius: 8,
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
              {onOpenTodayTab ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onOpenTodayTab()
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    fontSize: 13,
                    color: 'var(--text-link)',
                    cursor: 'pointer',
                  }}
                >
                  Open on the checklist ↗
                </button>
              ) : null}
            </>
          )}
        </div>
        {canEditStructure ? (
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 14, paddingTop: 12 }}>
            <button
              type="button"
              onClick={() => setEditOpen((o) => !o)}
              aria-expanded={editOpen}
              style={{
                width: '100%',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                padding: 0,
                fontSize: '0.875rem',
                color: 'var(--text-slate-500)',
                cursor: 'pointer',
              }}
            >
              {editOpen ? '▾' : '▸'} Edit task (title, assignees)
            </button>
            {editOpen ? (
              <div style={{ paddingTop: 12 }}>
                <label
                  style={{ display: 'block', fontSize: 12, color: 'var(--text-slate-500)', marginBottom: 4 }}
                  htmlFor="tech-tree-task-card-title-input"
                >
                  Task title
                </label>
                <input
                  id="tech-tree-task-card-title-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', marginBottom: 12, boxSizing: 'border-box' }}
                  disabled={saving}
                />
                <div style={{ fontSize: 12, color: 'var(--text-slate-500)', marginBottom: 4 }}>Assignees (optional)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflow: 'auto' }}>
                  {usersOrderedForDisplay.map((u) => (
                    <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={!!assignees[u.id]}
                        onChange={(e) => setAssignees((m) => ({ ...m, [u.id]: e.target.checked }))}
                        disabled={saving}
                      />
                      {u.name || u.email}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" onClick={onClose} disabled={saving}>
            Close
          </button>
          {canEditStructure && editOpen ? (
            <button type="button" onClick={() => void save()} disabled={saving || !title.trim()}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    target,
  )
}
