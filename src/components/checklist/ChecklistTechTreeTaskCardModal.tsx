import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { stripStamp, type ChecklistCardEvent } from '../../lib/checklistCardEvents'
import type { BridgeChip, BridgeState } from '../../lib/roadmapBridge'
import { RoadmapStageNumberBadge } from './RoadmapStageNumberBadge'

type UserRow = { id: string; name: string; email: string }

type TaskForCard = { id: string; title: string; assigneeIds: string[] }

type Props = {
  open: boolean
  task: TaskForCard | null
  groupTitle: string
  /** Stage number for the crumb badge (matches Map/Plan badges). */
  stageNumber?: number
  /** Bridge row for this task (undefined when not materialized yet). */
  bridge: BridgeState | undefined
  chip: BridgeChip
  users: UserRow[]
  /** Likely names first in the picker (people already on this roadmap). */
  suggestedUserIds?: string[]
  currentUserId: string | null
  canEditStructure: boolean
  /** Oldest-first events for the bridged instance. */
  loadEvents: (instanceId: string) => Promise<ChecklistCardEvent[]>
  /** Resolves true on success; the composer clears its draft only then. */
  postComment: (instanceId: string, body: string) => Promise<boolean>
  /**
   * Persists title + assignees and reloads the parent's tasks (so the `task`
   * prop refreshes). Called per interaction: each assignee tap and each
   * inline-title save commits immediately — there is no Save button.
   */
  onSave: (title: string, assigneeUserIds: string[]) => Promise<boolean>
  /** Jump to the Today tab (the live checklist card). */
  onOpenTodayTab?: () => void
  onClose: () => void
  /** e.g. roadmap canvas in Fullscreen API — modals must mount inside the fullscreen element */
  portalContainer?: HTMLElement | null
}

/**
 * The roadmap task card (redesigned v2.1949; conversation-first since
 * v2.1901): a bottom sheet on phones / centered card on desktop with three
 * zones — header (stage crumb + inline-editable title + status chip),
 * tap-to-assign people chips, and the activity thread with the note composer
 * pinned at the bottom. Every edit commits itself (assignee taps and title
 * saves call onSave immediately), so the card has no footer and no Save
 * button; ✕ or the backdrop dismisses. Notes posted here land on the same
 * card the assignee sees on their Today list.
 */
export function ChecklistTechTreeTaskCardModal({
  open,
  task,
  groupTitle,
  stageNumber,
  bridge,
  chip,
  users,
  suggestedUserIds,
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
  const [pickerOpen, setPickerOpen] = useState(false)
  const [personSearch, setPersonSearch] = useState('')
  /** User id whose assign/unassign is in flight (one at a time). */
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [titleEditing, setTitleEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [titleSaving, setTitleSaving] = useState(false)
  const threadRef = useRef<HTMLDivElement | null>(null)

  const instanceId = bridge?.instanceId ?? null
  const taskId = task?.id ?? null

  // Reset per card, not per task-prop identity — the prop refreshes after
  // every per-tap save and the picker must stay open through that.
  useEffect(() => {
    if (!open) return
    setDraft('')
    setPickerOpen(false)
    setPersonSearch('')
    setTitleEditing(false)
    setBusyUserId(null)
  }, [open, taskId])

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

  useEffect(() => {
    const el = threadRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [events])

  const nameById = useMemo(() => {
    const m: Record<string, string> = {}
    for (const u of users) m[u.id] = u.name || u.email
    return m
  }, [users])

  const { suggested, everyone } = useMemo(() => {
    const suggestedSet = new Set(suggestedUserIds ?? [])
    if (currentUserId) suggestedSet.add(currentUserId)
    const q = personSearch.trim().toLowerCase()
    const match = (u: UserRow) => !q || (u.name || u.email).toLowerCase().includes(q)
    return {
      suggested: users.filter((u) => suggestedSet.has(u.id) && match(u)),
      everyone: users.filter((u) => !suggestedSet.has(u.id) && match(u)),
    }
  }, [users, suggestedUserIds, currentUserId, personSearch])

  if (!open || !task) return null

  const name = (id: string | null | undefined): string => {
    if (!id) return 'Someone'
    if (id === currentUserId) return 'You'
    return nameById[id] ?? 'Someone'
  }

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

  async function toggleAssignee(userId: string) {
    if (!task || busyUserId || titleSaving) return
    const has = task.assigneeIds.includes(userId)
    const next = has ? task.assigneeIds.filter((id) => id !== userId) : [...task.assigneeIds, userId]
    setBusyUserId(userId)
    try {
      await onSave(task.title, next)
    } finally {
      setBusyUserId(null)
    }
  }

  function startTitleEdit() {
    if (!task) return
    setTitleDraft(task.title)
    setTitleEditing(true)
  }

  async function saveTitle() {
    if (!task || titleSaving) return
    const trimmed = titleDraft.trim()
    if (!trimmed || trimmed === task.title) {
      setTitleEditing(false)
      return
    }
    setTitleSaving(true)
    try {
      const ok = await onSave(trimmed, task.assigneeIds)
      if (ok) setTitleEditing(false)
    } finally {
      setTitleSaving(false)
    }
  }

  const chipStyles: Record<string, React.CSSProperties> = {
    in_review: { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)' },
    signed_off: { background: '#16a34a', color: 'white' },
    on_list: { background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', color: 'var(--text-muted)' },
  }
  const chipLabel = chip === 'in_review' ? 'in review' : chip === 'signed_off' ? 'signed off' : 'on list'

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-muted)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  }
  const iconBtnStyle: React.CSSProperties = {
    flex: 'none',
    width: 28,
    height: 28,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid var(--border)',
    borderRadius: 7,
    background: 'var(--surface)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: 13,
    padding: 0,
  }
  const personChipStyle = (active: boolean): React.CSSProperties => ({
    fontSize: 13,
    fontWeight: 600,
    padding: '7px 13px',
    borderRadius: 999,
    border: active ? '1px solid #2563eb' : '1px solid var(--border-strong)',
    background: active ? '#2563eb' : 'var(--surface)',
    color: active ? 'white' : 'var(--text-700)',
    cursor: 'pointer',
  })

  const target = typeof document !== 'undefined' ? (portalContainer ?? document.body) : null
  if (!target) return null

  return createPortal(
    <div
      className="roadmap-task-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !posting && !busyUserId && !titleSaving) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tech-tree-task-card-title"
        className="roadmap-task-card"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="roadmap-task-grabber" aria-hidden />

        {/* header */}
        <div style={{ padding: '12px 16px 12px', borderBottom: '1px solid var(--border)', flex: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: 'var(--text-slate-500)', fontSize: 13 }}>
            {stageNumber ? <RoadmapStageNumberBadge n={stageNumber} /> : null}
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{groupTitle || '—'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            {titleEditing ? (
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void saveTitle()
                  if (e.key === 'Escape') setTitleEditing(false)
                }}
                disabled={titleSaving}
                aria-label="Task title"
                style={{
                  flex: 1,
                  minWidth: 0,
                  font: 'inherit',
                  fontSize: '1.0625rem',
                  fontWeight: 600,
                  padding: '4px 8px',
                  border: '1px solid #2563eb',
                  borderRadius: 7,
                  background: 'var(--surface)',
                  color: 'var(--text-strong)',
                }}
              />
            ) : (
              <h2 id="tech-tree-task-card-title" style={{ margin: 0, fontSize: '1.0625rem', lineHeight: 1.35, flex: 1, minWidth: 0, color: 'var(--text-strong)' }}>
                {task.title}
              </h2>
            )}
            {canEditStructure && !titleEditing ? (
              <button type="button" onClick={startTitleEdit} aria-label="Rename task" title="Rename task" style={iconBtnStyle}>
                ✎
              </button>
            ) : null}
            {titleEditing ? (
              <button
                type="button"
                onClick={() => void saveTitle()}
                disabled={titleSaving || !titleDraft.trim()}
                aria-label="Save title"
                style={{ ...iconBtnStyle, background: '#2563eb', borderColor: '#2563eb', color: 'white' }}
              >
                {titleSaving ? '…' : '✓'}
              </button>
            ) : null}
            <button type="button" onClick={onClose} aria-label="Close" style={iconBtnStyle}>
              ✕
            </button>
          </div>
          {chip ? (
            <div style={{ marginTop: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap', ...chipStyles[chip] }}>
                {chipLabel}
              </span>
            </div>
          ) : null}
        </div>

        {/* people */}
        <div style={{ padding: '10px 16px 12px', borderBottom: '1px solid var(--border)', flex: 'none' }}>
          <div style={{ ...sectionLabelStyle, marginBottom: 7 }}>{pickerOpen ? 'Assign — saves as you tap' : 'Assigned'}</div>
          {pickerOpen ? (
            <div>
              <input
                type="text"
                value={personSearch}
                onChange={(e) => setPersonSearch(e.target.value)}
                placeholder="Search people…"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  height: 36,
                  padding: '0 12px',
                  fontSize: 13,
                  border: '1px solid var(--border-strong)',
                  borderRadius: 9,
                  background: 'var(--bg-slate-tint)',
                  marginBottom: 8,
                }}
              />
              {suggested.length > 0 ? (
                <>
                  <div style={{ ...sectionLabelStyle, fontSize: 10.5, margin: '2px 0 6px' }}>On this roadmap</div>
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 8 }}>
                    {suggested.map((u) => {
                      const active = task.assigneeIds.includes(u.id)
                      return (
                        <button key={u.id} type="button" onClick={() => void toggleAssignee(u.id)} aria-pressed={active} disabled={busyUserId !== null} style={personChipStyle(active)}>
                          {busyUserId === u.id ? '…' : `${u.name || u.email}${active ? ' ✓' : ''}`}
                        </button>
                      )
                    })}
                  </div>
                </>
              ) : null}
              {everyone.length > 0 ? (
                <>
                  {suggested.length > 0 ? <div style={{ ...sectionLabelStyle, fontSize: 10.5, margin: '2px 0 6px' }}>Everyone</div> : null}
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                    {everyone.map((u) => {
                      const active = task.assigneeIds.includes(u.id)
                      return (
                        <button key={u.id} type="button" onClick={() => void toggleAssignee(u.id)} aria-pressed={active} disabled={busyUserId !== null} style={personChipStyle(active)}>
                          {busyUserId === u.id ? '…' : `${u.name || u.email}${active ? ' ✓' : ''}`}
                        </button>
                      )
                    })}
                  </div>
                </>
              ) : null}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    setPickerOpen(false)
                    setPersonSearch('')
                  }}
                  style={{ fontSize: 13, fontWeight: 600, padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {task.assigneeIds.map((id) => (
                  <span
                    key={id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      padding: '6px 11px',
                      borderRadius: 999,
                      background: 'var(--bg-blue-tint)',
                      color: 'var(--text-blue-800)',
                    }}
                  >
                    {nameById[id] ?? '…'}
                    {canEditStructure ? (
                      <button
                        type="button"
                        onClick={() => void toggleAssignee(id)}
                        disabled={busyUserId !== null}
                        aria-label={`Unassign ${nameById[id] ?? 'person'}`}
                        style={{ border: 'none', background: 'none', color: 'inherit', opacity: 0.75, cursor: 'pointer', padding: 0, fontSize: 13, lineHeight: 1 }}
                      >
                        {busyUserId === id ? '…' : '✕'}
                      </button>
                    ) : null}
                  </span>
                ))}
                {canEditStructure ? (
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      padding: '6px 12px',
                      borderRadius: 999,
                      border: '1.5px dashed var(--border-strong)',
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    {task.assigneeIds.length === 0 ? '＋ Assign someone' : '＋'}
                  </button>
                ) : task.assigneeIds.length === 0 ? (
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>unassigned</span>
                ) : null}
              </div>
              {!instanceId ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 7 }}>
                  {task.assigneeIds.length === 0
                    ? 'Not on anyone’s list yet — assign someone and this task lands on their list when the stage unlocks.'
                    : 'Lands on their Today list when this stage unlocks.'}
                </div>
              ) : null}
            </>
          )}
        </div>

        {/* activity */}
        <div ref={threadRef} style={{ padding: '10px 16px 8px', overflowY: 'auto', flex: '1 1 auto', minHeight: 0 }}>
          <div style={{ ...sectionLabelStyle, marginBottom: 8 }}>Activity</div>
          {!instanceId ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              Nothing yet — notes posted here follow the task onto the assignee’s list.
            </p>
          ) : eventsLoading ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Loading…</p>
          ) : events.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>No activity yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {events.map((e) => {
                if (e.event_type === 'comment') {
                  return (
                    <div
                      key={e.id}
                      style={{
                        background: 'var(--bg-slate-tint)',
                        border: '1px solid var(--border)',
                        borderRadius: '4px 12px 12px 12px',
                        padding: '7px 11px',
                        maxWidth: '92%',
                        alignSelf: 'flex-start',
                      }}
                    >
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-strong)' }}>{name(e.actor_user_id)}</span>{' '}
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{stripStamp(e.created_at)}</span>
                      </div>
                      <div style={{ fontSize: 13.5, color: 'var(--text-700)', lineHeight: 1.45 }}>{e.body}</div>
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
                  <div key={e.id} style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 10, borderLeft: '2px solid var(--border)' }}>
                    {name(e.actor_user_id)} {label} · {stripStamp(e.created_at)}
                    {e.event_type === 'completed' && e.body ? <> — “{e.body}”</> : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {instanceId && onOpenTodayTab ? (
          <button
            type="button"
            onClick={() => {
              onClose()
              onOpenTodayTab()
            }}
            style={{ background: 'none', border: 'none', padding: '0 16px 8px', fontSize: 13, color: 'var(--text-link)', cursor: 'pointer', textAlign: 'left', flex: 'none' }}
          >
            Open on the checklist ↗
          </button>
        ) : null}

        {/* composer */}
        {instanceId ? (
          <div className="roadmap-task-composer" style={{ display: 'flex', gap: 8, padding: '10px 16px 12px', borderTop: '1px solid var(--border)', flex: 'none' }}>
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
                height: 42,
                boxSizing: 'border-box',
                padding: '0 14px',
                fontSize: '0.9375rem',
                border: '1px solid var(--border-strong)',
                borderRadius: 999,
                background: 'var(--bg-slate-tint)',
              }}
            />
            <button
              type="button"
              onClick={() => void post()}
              disabled={posting || !draft.trim()}
              aria-label="Post"
              style={{
                flex: 'none',
                width: 42,
                height: 42,
                borderRadius: 999,
                border: 'none',
                background: posting || !draft.trim() ? '#9ca3af' : '#2563eb',
                color: 'white',
                fontSize: 16,
                cursor: posting || !draft.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {posting ? '…' : '➤'}
            </button>
          </div>
        ) : null}
      </div>
    </div>,
    target,
  )
}
