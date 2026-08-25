import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'

type Props = {
  open: boolean
  groupId: string | null
  initialTitle: string
  onClose: () => void
  /** Called after save or delete; parent should reload data */
  onSuccess: () => void
  /** Only after delete — e.g. clear UI selection for this group */
  /** Current tasks-run-in-order flag (v2.2264); default true. */
  initialSequential?: boolean
  onDeletedGroup?: (groupId: string) => void
  setError: (s: string | null) => void
  /** e.g. roadmap canvas in Fullscreen API — modals must mount inside the fullscreen element */
  portalContainer?: HTMLElement | null
}

/**
 * Rename or delete a Checklist Roadmap group (staff / primary per RLS).
 */
export function ChecklistTechTreeGroupModal({
  open,
  groupId,
  initialTitle,
  initialSequential = true,
  onClose,
  onSuccess,
  onDeletedGroup,
  setError,
  portalContainer,
}: Props) {
  const [title, setTitle] = useState(initialTitle)
  const [sequential, setSequential] = useState(initialSequential)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (open) {
      setTitle(initialTitle)
      setSequential(initialSequential)
      setShowDeleteConfirm(false)
    }
  }, [open, initialTitle, initialSequential, groupId])

  if (!open || !groupId) return null

  const handleSave = async () => {
    const trimmed = title.trim()
    if (!trimmed) {
      setError('Group title is required')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await withSupabaseRetry(
        () => supabase.from('checklist_tech_tree_groups').update({ title: trimmed, sequential }).eq('id', groupId),
        'update tech tree group title',
      )
      onSuccess()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save group')
    } finally {
      setSaving(false)
    }
  }

  const performDelete = async () => {
    setError(null)
    setDeleting(true)
    try {
      await withSupabaseRetry(
        () => supabase.from('checklist_tech_tree_groups').delete().eq('id', groupId),
        'delete tech tree group',
      )
      onDeletedGroup?.(groupId)
      onSuccess()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete group')
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
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
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tech-tree-group-modal-title"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: 20,
          maxWidth: 420,
          width: '100%',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="tech-tree-group-modal-title" style={{ margin: '0 0 1rem', fontSize: '1.125rem' }}>
          Edit group
        </h2>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-slate-500)', marginBottom: 4 }} htmlFor="tech-tree-group-title">
          Group title
        </label>
        <input
          id="tech-tree-group-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ width: '100%', padding: '8px 10px', marginBottom: 16, boxSizing: 'border-box' }}
          disabled={saving || deleting}
        />
        <div style={{ fontSize: 12, color: 'var(--text-slate-500)', marginBottom: 4 }}>Tasks run</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {([
            [true, '→ In order'],
            [false, '⇄ Any order'],
          ] as const).map(([value, label]) => (
            <button
              key={String(value)}
              type="button"
              onClick={() => setSequential(value)}
              aria-pressed={sequential === value}
              disabled={saving || deleting}
              style={{
                flex: 1,
                padding: '7px 10px',
                borderRadius: 9,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                border: sequential === value ? '1.5px solid #2563eb' : '1.5px solid var(--border-strong)',
                background: sequential === value ? 'var(--bg-blue-tint)' : 'var(--surface)',
                color: sequential === value ? 'var(--text-blue-800)' : 'var(--text-muted)',
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {sequential ? (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '-8px 0 16px' }}>
            One task at a time: the next task lands on its assignee's list only when the one before it is done.
          </p>
        ) : null}
        {showDeleteConfirm ? (
          <p style={{ color: 'var(--text-red-700)', fontSize: 14, margin: '0 0 1rem' }}>
            Delete this group and all of its tasks and related links? This cannot be undone.
          </p>
        ) : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose} disabled={saving || deleting}>
              Cancel
            </button>
            <button type="button" onClick={() => void handleSave()} disabled={saving || deleting}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
          {showDeleteConfirm ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false)
                }}
                disabled={deleting}
              >
                Don&apos;t delete
              </button>
              <button
                type="button"
                onClick={() => void performDelete()}
                disabled={deleting}
                style={{ color: '#fff', background: '#dc2626', border: 'none', borderRadius: 4, padding: '6px 12px' }}
              >
                {deleting ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={saving || deleting}
              style={{ color: 'var(--text-red-700)' }}
            >
              Delete group…
            </button>
          )}
        </div>
      </div>
    </div>,
    target,
  )
}
