import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChecklistCrewTagsRow } from './ChecklistCrewTagsRow'
import {
  matchesPersonQuery,
  singleEnterTarget,
  visibleAssigneeRows,
} from '../../lib/checklistAssigneeSearch'

type UserRow = { id: string; name: string; email: string }

// Stable default: an inline `= []` default mints a new array identity on every
// render, and it sits in the reset-effect's dependency list — so each keystroke
// (setTitle → re-render → "new" dep) re-ran the reset and wiped the title.
const NO_PRESET_ASSIGNEES: readonly string[] = []

type Props = {
  open: boolean
  groupId: string | null
  groupTitle: string
  users: UserRow[]
  /** When set and present in `users`, that row is shown first. */
  currentUserId: string | null
  onClose: () => void
  onSave: (title: string, assigneeUserIds: string[]) => Promise<boolean>
  /** e.g. roadmap canvas in Fullscreen API — modals must mount inside the fullscreen element */
  portalContainer?: HTMLElement | null
  /** When set, modal is in edit mode (title + assignees pre-filled). */
  editingTaskId?: string | null
  initialEditTitle?: string
  initialEditAssigneeUserIds?: readonly string[]
}

/**
 * Add a task to a Roadmap group (title + optional assignees). Parent supplies onSave; returns true on success.
 *
 * Crew tags (the shared ChecklistCrewTagsRow above the assignee list) surface
 * People → Teams as one-tap staffing; tags never change what a task stores —
 * they only drive the same checkboxes.
 */
export function ChecklistTechTreeAddTaskModal({
  open,
  groupId,
  groupTitle,
  users,
  currentUserId,
  onClose,
  onSave,
  portalContainer,
  editingTaskId = null,
  initialEditTitle = '',
  initialEditAssigneeUserIds = NO_PRESET_ASSIGNEES,
}: Props) {
  const [title, setTitle] = useState('')
  const [assignees, setAssignees] = useState<Record<string, boolean>>({})
  const [personQuery, setPersonQuery] = useState('')
  const [saving, setSaving] = useState(false)
  /** userId → crew name, for the "via crew" attribution pill; UI-only. */
  const [viaCrew, setViaCrew] = useState<Record<string, string>>({})
  const isEditMode = Boolean(editingTaskId)

  const usersOrderedForDisplay = useMemo(() => {
    if (!currentUserId) return users
    const me = users.find((u) => u.id === currentUserId)
    if (!me) return users
    return [me, ...users.filter((u) => u.id !== currentUserId)]
  }, [users, currentUserId])

  useEffect(() => {
    if (!open) return
    if (editingTaskId) {
      setTitle(initialEditTitle)
      const m: Record<string, boolean> = {}
      for (const id of initialEditAssigneeUserIds) {
        m[id] = true
      }
      setAssignees(m)
    } else {
      setTitle('')
      setAssignees({})
    }
    setViaCrew({})
    setPersonQuery('')
  }, [open, groupId, editingTaskId, initialEditTitle, initialEditAssigneeUserIds])

  if (!open || !groupId) return null

  const handleSave = async () => {
    const trimmed = title.trim()
    if (!trimmed) return
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

  const staffCrew = (memberIds: string[], checked: boolean, crewName: string) => {
    setAssignees((m) => {
      const next = { ...m }
      for (const id of memberIds) next[id] = checked
      return next
    })
    setViaCrew((v) => {
      const next = { ...v }
      for (const id of memberIds) {
        if (checked) next[id] = crewName
        else delete next[id]
      }
      return next
    })
  }

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
        if (e.target === e.currentTarget && !saving) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tech-tree-add-task-modal-title"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: 20,
          maxWidth: 440,
          width: '100%',
          maxHeight: 'min(90vh, 100%)',
          overflow: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="tech-tree-add-task-modal-title" style={{ margin: '0 0 0.5rem', fontSize: '1.125rem' }}>
          {isEditMode ? 'Edit task' : 'Add task'}
        </h2>
        <p style={{ margin: '0 0 1rem', color: 'var(--text-slate-500)', fontSize: 13 }}>Group: {groupTitle || '—'}</p>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-slate-500)', marginBottom: 4 }} htmlFor="tech-tree-add-task-title">
          Task title
        </label>
        <input
          id="tech-tree-add-task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ width: '100%', padding: '8px 10px', marginBottom: 12, boxSizing: 'border-box' }}
          disabled={saving}
        />
        <div style={{ fontSize: 12, color: 'var(--text-slate-500)', marginBottom: 4 }}>Assignees (optional)</div>
        <ChecklistCrewTagsRow
          users={users}
          assignees={assignees}
          onStaffCrew={staffCrew}
          currentUserId={currentUserId}
        />
        {(() => {
          const enterTarget = singleEnterTarget(usersOrderedForDisplay, personQuery, assignees)
          const filtering = personQuery.trim() !== ''
          const rows = visibleAssigneeRows(usersOrderedForDisplay, personQuery, assignees)
          const matchCount = filtering ? usersOrderedForDisplay.filter((u) => matchesPersonQuery(u, personQuery)).length : rows.length
          const addPerson = (id: string) => {
            setAssignees((m) => ({ ...m, [id]: true }))
            setViaCrew((v) => {
              if (!(id in v)) return v
              const next = { ...v }
              delete next[id]
              return next
            })
            setPersonQuery('')
          }
          return (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  border: '1.5px solid var(--border-strong)',
                  borderRadius: 7,
                  height: 36,
                  padding: '0 10px',
                  marginBottom: 8,
                  boxSizing: 'border-box',
                  background: 'var(--surface)',
                }}
              >
                <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: 13, flex: 'none' }}>🔍</span>
                <input
                  value={personQuery}
                  onChange={(e) => setPersonQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && enterTarget) {
                      e.preventDefault()
                      addPerson(enterTarget.id)
                    } else if (e.key === 'Escape' && personQuery !== '') {
                      e.stopPropagation()
                      setPersonQuery('')
                    }
                  }}
                  placeholder="Search people…"
                  aria-label="Search people"
                  disabled={saving}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    border: 'none',
                    outline: 'none',
                    fontSize: 14,
                    background: 'transparent',
                    color: 'var(--text-strong)',
                    padding: 0,
                  }}
                />
                {enterTarget ? (
                  <span
                    style={{
                      flex: 'none',
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: 'var(--text-blue-800)',
                      background: 'var(--bg-blue-tint)',
                      borderRadius: 999,
                      padding: '2px 8px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ↵ add {enterTarget.name || enterTarget.email}
                  </span>
                ) : null}
                {filtering ? (
                  <button
                    type="button"
                    onClick={() => setPersonQuery('')}
                    aria-label="Clear search"
                    style={{
                      flex: 'none',
                      border: 'none',
                      background: 'none',
                      padding: 2,
                      color: 'var(--text-muted)',
                      fontSize: 14,
                      lineHeight: 1,
                      cursor: 'pointer',
                    }}
                  >
                    ✕
                  </button>
                ) : null}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflow: 'auto', marginBottom: 16 }}>
                {rows.map((u) => (
                  <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!!assignees[u.id]}
                      onChange={(e) => {
                        setAssignees((m) => ({ ...m, [u.id]: e.target.checked }))
                        // A manual change means this box is yours now, not the crew's.
                        setViaCrew((v) => {
                          if (!(u.id in v)) return v
                          const next = { ...v }
                          delete next[u.id]
                          return next
                        })
                      }}
                      disabled={saving}
                    />
                    {u.name || u.email}
                    {assignees[u.id] && viaCrew[u.id] ? (
                      <span
                        style={{
                          fontSize: 11.5,
                          color: 'var(--text-blue-800)',
                          background: 'var(--bg-blue-tint)',
                          borderRadius: 999,
                          padding: '2px 8px',
                        }}
                      >
                        {viaCrew[u.id]}
                      </span>
                    ) : null}
                    {filtering && assignees[u.id] && !matchesPersonQuery(u, personQuery) ? (
                      // Checked people never filter out — this quiet tag says why the row is here.
                      <span
                        style={{
                          fontSize: 11.5,
                          color: 'var(--text-muted)',
                          border: '1px dashed var(--border-strong)',
                          borderRadius: 999,
                          padding: '2px 8px',
                        }}
                      >
                        selected
                      </span>
                    ) : null}
                  </label>
                ))}
                {filtering && matchCount === 0 ? (
                  <span style={{ fontSize: 14, color: 'var(--text-muted)', padding: '4px 2px' }}>
                    No one matches “{personQuery.trim()}”
                  </span>
                ) : null}
              </div>
            </>
          )
        })()}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !title.trim()}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>,
    target,
  )
}
