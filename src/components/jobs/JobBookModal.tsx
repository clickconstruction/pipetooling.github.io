import { useEffect, useId } from 'react'
import JobBookEditorPanel from '../settings/JobBookEditorPanel'

export type JobBookModalProps = {
  open: boolean
  onClose: () => void
  onDbError: (message: string) => void
}

export default function JobBookModal({ open, onClose, onDbError }: JobBookModalProps) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          background: 'var(--surface)',
          padding: '1.5rem',
          borderRadius: 8,
          minWidth: 320,
          maxWidth: 720,
          width: 'min(720px, calc(100vw - 2rem))',
          maxHeight: '90vh',
          margin: '1rem',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          boxSizing: 'border-box',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '0.75rem',
            marginBottom: '0.75rem',
            flexShrink: 0,
          }}
        >
          <h2 id={titleId} style={{ margin: 0, fontSize: '1.25rem', flex: 1, minWidth: 0 }}>
            Job Book
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.35rem 0.65rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              background: 'var(--bg-muted)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              flexShrink: 0,
            }}
          >
            Close
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <JobBookEditorPanel active={open} onDbError={onDbError} showIntro hideIntroLinkedBidPhrase />
        </div>
      </div>
    </div>
  )
}
