import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChecklistCrewTagsRow } from './ChecklistCrewTagsRow'
import { stripStamp, type ChecklistCardEvent } from '../../lib/checklistCardEvents'
import type { BridgeChip, BridgeState } from '../../lib/roadmapBridge'
import { RoadmapStageNumberBadge } from './RoadmapStageNumberBadge'
import AutoGrowTextarea from '../AutoGrowTextarea'

type UserRow = { id: string; name: string; email: string }

type TaskForCard = { id: string; title: string; assigneeIds: string[] }

type Props = {
  open: boolean
  task: TaskForCard | null
  groupTitle: string
  /** Stage number for the crumb badge (matches Map/Plan badges). */
  stageNumber?: number
  /** "4.2" — the task's number within its stage (v2.1964). */
  taskNumberLabel?: string
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
  /** ★ pin state (v2.2140) — pinned tasks lead the Plan's Next up shortlist. */
  pinned?: boolean
  /** Toggles the pin (editors only); resolves true on success. */
  onTogglePin?: () => Promise<boolean>
  /** Done state (v2.2182). */
  done?: boolean
  /** Sequential stages: "after 3.2 — ⟨title⟩" when this task waits its turn. */
  waitingAfterLabel?: string | null
  /** Done ⇄ open (same field the Map checkbox writes); pass only when the viewer may act. */
  onToggleDone?: () => Promise<boolean>
  /** Editors only: deletes the task (and its unfinished list item). */
  onDeleteTask?: () => Promise<boolean>
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
  taskNumberLabel,
  bridge,
  chip,
  users,
  suggestedUserIds,
  currentUserId,
  canEditStructure,
  loadEvents,
  postComment,
  onSave,
  pinned = false,
  onTogglePin,
  done = false,
  waitingAfterLabel = null,
  onToggleDone,
  onDeleteTask,
  onOpenTodayTab,
  onClose,
  portalContainer,
}: Props) {
  const [events, setEvents] = useState<ChecklistCardEvent[]>([])
  const [pinSaving, setPinSaving] = useState(false)
  const [doneSaving, setDoneSaving] = useState(false)
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
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  /** Optimistic done (v2.2303): the button flips instantly; the write runs
   *  behind it. On failure the button turns into an explicit retry — never a
   *  silent revert (field crews on one bar of signal must know it saved). */
  const [optimisticDone, setOptimisticDone] = useState<boolean | null>(null)
  const [doneFailed, setDoneFailed] = useState(false)
  const [quickPosting, setQuickPosting] = useState<string | null>(null)
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
    setOptimisticDone(null)
    setDoneFailed(false)
    setBusyUserId(null)
    setDeleteConfirm(false)
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

  const effectiveDone = optimisticDone ?? done

  function pressDone() {
    if (doneSaving || !onToggleDone) return
    setDoneFailed(false)
    setDoneSaving(true)
    setOptimisticDone(!effectiveDone)
    void onToggleDone()
      .then(() => setOptimisticDone(null))
      .catch(() => {
        setOptimisticDone(null)
        setDoneFailed(true)
      })
      .finally(() => setDoneSaving(false))
  }

  /** One-tap field replies — a real note on the thread, no keyboard needed. */
  async function postQuick(body: string) {
    if (!instanceId || quickPosting || posting) return
    setQuickPosting(body)
    try {
      const ok = await postComment(instanceId, body)
      if (ok) setEvents(await loadEvents(instanceId))
    } finally {
      setQuickPosting(null)
    }
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

  /** Crew chip tap: whole roster lands (or leaves) in ONE save — people outside the crew stay put. */
  async function staffCrew(memberIds: string[], checked: boolean) {
    if (!task || busyUserId || titleSaving) return
    const next = checked
      ? [...task.assigneeIds, ...memberIds.filter((id) => !task.assigneeIds.includes(id))]
      : task.assigneeIds.filter((id) => !memberIds.includes(id))
    setBusyUserId('__crew__')
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
            {taskNumberLabel ? (
              <span style={{ flex: 'none', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>· task {taskNumberLabel}</span>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{ ...iconBtnStyle, marginLeft: 'auto', width: 34, height: 34, border: 'none', background: 'transparent', fontSize: 16 }}
            >
              ✕
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            {titleEditing ? (
              // A real form so the platform's implicit submission handles
              // Enter (incl. software keyboards' "go"), not a keydown match.
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  void saveTitle()
                }}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flex: 1, minWidth: 0 }}
              >
                {/* Auto-growing textarea (v2.2121) so a long title wraps instead of
                    scrolling off the right edge; Enter still saves (titles have no
                    newlines), Escape cancels, ✓ submits the form. */}
                <AutoGrowTextarea
                  autoFocus
                  rows={1}
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => {
                    // explicit Enter path with preventDefault: covers key
                    // events whose default (implicit submission) doesn't run,
                    // without ever double-firing alongside the form submit
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void saveTitle()
                    }
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
                    lineHeight: 1.35,
                    padding: '4px 8px',
                    border: '1px solid #2563eb',
                    borderRadius: 7,
                    background: 'var(--surface)',
                    color: 'var(--text-strong)',
                  }}
                />
                <button
                  type="submit"
                  disabled={titleSaving || !titleDraft.trim()}
                  aria-label="Save title"
                  style={{ ...iconBtnStyle, background: '#2563eb', borderColor: '#2563eb', color: 'white' }}
                >
                  {titleSaving ? '…' : '✓'}
                </button>
              </form>
            ) : canEditStructure ? (
              // The title IS the rename control (v2.2303) — the boxed ✎ is gone.
              <h2
                id="tech-tree-task-card-title"
                onClick={startTitleEdit}
                title="Tap to rename"
                style={{ margin: 0, fontSize: '1.0625rem', lineHeight: 1.35, flex: 1, minWidth: 0, color: 'var(--text-strong)', cursor: 'text' }}
              >
                {task.title}
                <span aria-hidden style={{ fontSize: '0.75rem', color: 'var(--text-slate-400)', marginLeft: 7, fontWeight: 400 }}>✎</span>
              </h2>
            ) : (
              // Crew view: bigger, heavier — built for glare.
              <h2 id="tech-tree-task-card-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, lineHeight: 1.3, flex: 1, minWidth: 0, color: 'var(--text-strong)' }}>
                {task.title}
              </h2>
            )}
          </div>
          {chip || done || waitingAfterLabel ? (
            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {done ? (
                <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap', background: '#16a34a', color: 'white' }}>✓ done</span>
              ) : null}
              {chip ? (
                <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap', ...chipStyles[chip] }}>
                  {chipLabel}
                </span>
              ) : null}
              {waitingAfterLabel && canEditStructure ? (
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>⏳ waits its turn — {waitingAfterLabel}</span>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* people */}
        <div style={{ padding: '10px 16px 12px', borderBottom: '1px solid var(--border)', flex: 'none' }}>
          <div style={{ ...sectionLabelStyle, marginBottom: 7 }}>{pickerOpen ? 'Assign — saves as you tap' : 'Assigned'}</div>
          {!canEditStructure ? (
            // Crew view: names as plain bold text — no controls, nothing subtle.
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-700)' }}>
              {task.assigneeIds.length === 0 ? 'unassigned' : task.assigneeIds.map((id) => nameById[id] ?? '…').join(' · ')}
            </div>
          ) : pickerOpen ? (
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
              <ChecklistCrewTagsRow
                users={users}
                assignees={Object.fromEntries(task.assigneeIds.map((id) => [id, true]))}
                onStaffCrew={(memberIds, checked) => void staffCrew(memberIds, checked)}
                manage={false}
                countMode="toAdd"
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
                      gap: 8,
                      fontSize: 14,
                      fontWeight: 600,
                      padding: '9px 13px',
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
                        style={{ border: 'none', background: 'none', color: 'inherit', opacity: 0.75, cursor: 'pointer', padding: '6px', margin: '-6px', fontSize: 14, lineHeight: 1 }}
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
                      fontSize: 14,
                      fontWeight: 600,
                      padding: '9px 14px',
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

        {/* one-tap field replies (v2.2303): most of what a crew member says is
            one of these — a real note on the thread, no keyboard needed. */}
        {instanceId && !canEditStructure ? (
          <div style={{ display: 'flex', gap: 8, padding: '8px 16px 0', flex: 'none' }}>
            {(['👍 On it', '⚠️ Problem'] as const).map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => void postQuick(label)}
                disabled={quickPosting !== null}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: 12,
                  border: '1.5px solid var(--border-strong)',
                  background: 'var(--surface)',
                  color: 'var(--text-700)',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  cursor: quickPosting ? 'default' : 'pointer',
                }}
              >
                {quickPosting === label ? '…' : label}
              </button>
            ))}
          </div>
        ) : null}

        {/* composer */}
        {instanceId ? (
          <form
            className="roadmap-task-composer"
            onSubmit={(e) => {
              e.preventDefault()
              void post()
            }}
            style={{ display: 'flex', gap: 8, padding: '10px 16px 12px', borderTop: '1px solid var(--border)', flex: 'none' }}
          >
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void post()
                }
              }}
              placeholder="Add a note…"
              disabled={posting}
              style={{
                flex: 1,
                minWidth: 0,
                height: 44,
                boxSizing: 'border-box',
                padding: '0 14px',
                fontSize: '0.9375rem',
                border: '1px solid var(--border-strong)',
                borderRadius: 999,
                background: 'var(--bg-slate-tint)',
              }}
            />
            <button
              type="submit"
              disabled={posting || !draft.trim()}
              aria-label="Post"
              style={{
                flex: 'none',
                width: 44,
                height: 44,
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
          </form>
        ) : null}

        {/* thumb dock (v2.2303): everything you press, at the bottom on both
            screens. Editors: Mark done + Pin + Delete, all 48px. Crew: one
            giant filled DONE — outlines wash out in sunlight, fills don't. */}
        {canEditStructure ? (
          deleteConfirm && onDeleteTask ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 16px 14px', borderTop: '1px solid var(--border)', flex: 'none', flexWrap: 'wrap' }}>
              <span style={{ flexBasis: '100%', fontSize: 12.5, color: 'var(--text-red-700)' }}>
                Removes this task from the roadmap and any unfinished list entry. Completed history stays.
              </span>
              <button
                type="button"
                disabled={deleting}
                onClick={() => {
                  setDeleting(true)
                  void onDeleteTask()
                    .then((ok) => {
                      if (ok) onClose()
                    })
                    .finally(() => setDeleting(false))
                }}
                style={{ flex: 1, height: 48, borderRadius: 12, border: 'none', background: '#dc2626', color: '#fff', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer' }}
              >
                {deleting ? 'Deleting…' : 'Delete permanently'}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteConfirm(false)}
                style={{ flex: 'none', height: 48, padding: '0 18px', borderRadius: 12, border: '1.5px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Keep it
              </button>
            </div>
          ) : onToggleDone || done || onTogglePin || onDeleteTask ? (
            <div style={{ display: 'flex', gap: 10, padding: '10px 16px 14px', borderTop: '1px solid var(--border)', flex: 'none' }}>
              {onToggleDone ? (
                <button
                  type="button"
                  onClick={pressDone}
                  aria-pressed={effectiveDone}
                  aria-label={effectiveDone ? 'Reopen task' : 'Mark task done'}
                  style={{
                    flex: 1,
                    height: 48,
                    borderRadius: 12,
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    ...(doneFailed
                      ? { border: '1.5px solid #dc2626', background: 'transparent', color: 'var(--text-red-700)' }
                      : effectiveDone
                        ? { border: '1.5px solid #16a34a', background: '#16a34a', color: 'white' }
                        : { border: '1.5px solid #16a34a', background: 'transparent', color: 'var(--text-green-700)' }),
                  }}
                >
                  {doneFailed ? 'Tap to retry — not saved' : effectiveDone ? '✓ Done · reopen' : '○ Mark done'}
                </button>
              ) : done ? (
                <span style={{ flex: 1, height: 48, borderRadius: 12, background: '#16a34a', color: 'white', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  ✓ done
                </span>
              ) : (
                <span style={{ flex: 1 }} />
              )}
              {onTogglePin ? (
                <button
                  type="button"
                  onClick={() => {
                    if (pinSaving) return
                    setPinSaving(true)
                    void onTogglePin().finally(() => setPinSaving(false))
                  }}
                  disabled={pinSaving}
                  aria-pressed={pinned}
                  aria-label={pinned ? 'Unpin task' : 'Pin task — do this next'}
                  title={pinned ? 'Unpin — drop it back into the ranked order' : "Pin — leads the Plan's ⚡ Next up shortlist"}
                  style={{
                    width: 48,
                    height: 48,
                    flex: 'none',
                    borderRadius: 12,
                    fontSize: 18,
                    cursor: 'pointer',
                    ...(pinned
                      ? { border: '1.5px solid var(--border-amber)', background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' }
                      : { border: '1.5px solid var(--border-strong)', background: 'transparent', color: 'var(--text-muted)' }),
                  }}
                >
                  {pinSaving ? '…' : pinned ? '★' : '☆'}
                </button>
              ) : null}
              {onDeleteTask ? (
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(true)}
                  aria-label="Delete task"
                  title="Delete task…"
                  style={{ width: 48, height: 48, flex: 'none', borderRadius: 12, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text-red-700)', fontSize: 17, cursor: 'pointer' }}
                >
                  🗑
                </button>
              ) : null}
            </div>
          ) : null
        ) : onToggleDone || done ? (
          <div style={{ padding: '8px 16px 14px', flex: 'none' }}>
            <button
              type="button"
              onClick={pressDone}
              disabled={!onToggleDone}
              aria-pressed={effectiveDone}
              aria-label={effectiveDone ? 'Reopen task' : 'Mark task done'}
              style={{
                width: '100%',
                height: 58,
                borderRadius: 14,
                fontSize: '1.1rem',
                fontWeight: 800,
                letterSpacing: '0.01em',
                cursor: onToggleDone ? 'pointer' : 'default',
                ...(doneFailed
                  ? { background: 'transparent', border: '2px solid #dc2626', color: 'var(--text-red-700)' }
                  : { background: '#15803d', border: 'none', color: 'white' }),
              }}
            >
              {doneFailed ? 'Tap to retry — not saved' : effectiveDone ? (onToggleDone ? '✓ Done · tap to undo' : '✓ Done') : '✓ DONE'}
            </button>
          </div>
        ) : waitingAfterLabel ? (
          <div style={{ padding: '8px 16px 14px', flex: 'none' }}>
            <div
              style={{
                minHeight: 58,
                borderRadius: 14,
                border: '2px solid var(--border-amber)',
                background: 'var(--bg-amber-100)',
                color: 'var(--text-amber-800)',
                fontSize: '0.95rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '10px 16px',
                textAlign: 'center',
                lineHeight: 1.4,
              }}
            >
              ⏳ Waits its turn — {waitingAfterLabel}
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    target,
  )
}
