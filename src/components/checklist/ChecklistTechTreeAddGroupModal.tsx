import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  open: boolean
  onClose: () => void
  onSave: (title: string) => Promise<boolean>
  /** e.g. roadmap canvas in Fullscreen API — modals must mount inside the fullscreen element */
  portalContainer?: HTMLElement | null
  /** When set, dialog explains prerequisite link from the named group (connect-from-pane). */
  linkFromGroupTitle?: string
}

/**
 * Add a new Roadmap group (title only). Parent supplies onSave; returns true on success.
 */
export function ChecklistTechTreeAddGroupModal({
  open,
  onClose,
  onSave,
  portalContainer,
  linkFromGroupTitle,
}: Props) {
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setTitle('')
    }
  }, [open])

  if (!open) return null

  const handleSave = async () => {
    const trimmed = title.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      const ok = await onSave(trimmed)
      if (ok) onClose()
    } finally {
      setSaving(false)
    }
  }

  const isLinkFromGroup = Boolean(linkFromGroupTitle?.trim())
  const titleId = 'tech-tree-add-group-modal-title'
  const descriptionId = 'tech-tree-add-group-modal-desc'

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
        aria-labelledby={titleId}
        aria-describedby={isLinkFromGroup ? descriptionId : undefined}
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
        <h2 id={titleId} style={{ margin: '0 0 0.5rem', fontSize: '1.125rem' }}>
          {isLinkFromGroup ? 'Name new group' : 'Add group'}
        </h2>
        {isLinkFromGroup ? (
          <p
            id={descriptionId}
            style={{ margin: '0 0 1rem', fontSize: 13, color: '#64748b', lineHeight: 1.4 }}
          >
            Creates a new group linked from {linkFromGroupTitle} (prerequisite on the left).
          </p>
        ) : null}
        <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }} htmlFor="tech-tree-add-group-title">
          Group title
        </label>
        <input
          id="tech-tree-add-group-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ width: '100%', padding: '8px 10px', marginBottom: 16, boxSizing: 'border-box' }}
          disabled={saving}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !title.trim()}
          >
            {saving ? 'Saving…' : isLinkFromGroup ? 'Create and link' : 'Add group'}
          </button>
        </div>
      </div>
    </div>,
    target,
  )
}
