import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

type GroupOption = { id: string; title: string }

type Props = {
  open: boolean
  onClose: () => void
  groups: GroupOption[]
  onAddLink: (fromGroupId: string, toGroupId: string) => Promise<boolean>
  /** e.g. roadmap canvas in Fullscreen API — modals must mount inside the fullscreen element */
  portalContainer?: HTMLElement | null
}

/**
 * Add a prerequisite link between roadmap groups (from → to). Parent returns true to close on success.
 */
export function ChecklistTechTreeLineUpModal({ open, onClose, groups, onAddLink, portalContainer }: Props) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setFrom('')
      setTo('')
    }
  }, [open])

  if (!open) return null

  const canSubmit = Boolean(from && to && from !== to) && !saving

  const handleAdd = async () => {
    if (!canSubmit) return
    setSaving(true)
    try {
      const ok = await onAddLink(from, to)
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
        aria-labelledby="tech-tree-line-up-modal-title"
        style={{
          background: '#fff',
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
        <h2 id="tech-tree-line-up-modal-title" style={{ margin: '0 0 0.5rem', fontSize: '1.125rem' }}>
          Prerequisite link (from → to)
        </h2>
        <p style={{ margin: '0 0 1rem', fontSize: 12, color: '#64748b' }}>
          Choose which group must be completed before another unlocks.
        </p>
        <label
          style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}
          htmlFor="tech-tree-line-up-from"
        >
          From group (first)
        </label>
        <select
          id="tech-tree-line-up-from"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          style={{ width: '100%', padding: '8px 10px', marginBottom: 12, boxSizing: 'border-box' }}
          disabled={saving}
        >
          <option value="">Select group…</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
        </select>
        <label
          style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}
          htmlFor="tech-tree-line-up-to"
        >
          To group (after)
        </label>
        <select
          id="tech-tree-line-up-to"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          style={{ width: '100%', padding: '8px 10px', marginBottom: 16, boxSizing: 'border-box' }}
          disabled={saving}
        >
          <option value="">Select group…</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" onClick={() => void handleAdd()} disabled={!canSubmit}>
            {saving ? 'Adding…' : 'Add link'}
          </button>
        </div>
      </div>
    </div>,
    target,
  )
}
