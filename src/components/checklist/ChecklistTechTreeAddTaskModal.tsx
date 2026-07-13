import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

type UserRow = { id: string; name: string; email: string }

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
  initialEditAssigneeUserIds = [],
}: Props) {
  const [title, setTitle] = useState('')
  const [assignees, setAssignees] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
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
        padding: 16,
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
          maxHeight: '90vh',
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflow: 'auto', marginBottom: 16 }}>
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
