import { useEffect } from 'react'
import { useEditProjectModal } from '../../contexts/EditProjectModalContext'
import EditProjectForm from './EditProjectForm'

const EDIT_PROJECT_MODAL_Z_INDEX = 1200

export default function EditProjectModal() {
  const ctx = useEditProjectModal()

  // Escape closes the modal (matches NewProjectModal / EditCustomerModal feel).
  // The keydown listener is only attached while the modal is open so it can't
  // swallow Escape on other surfaces.
  useEffect(() => {
    if (!ctx?.isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        ctx.closeModal()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [ctx?.isOpen, ctx])

  if (!ctx?.isOpen || !ctx.projectId) return null

  const handleSaved = () => {
    if (typeof ctx.onSaved === 'function') {
      ctx.onSaved()
    }
    ctx.closeModal()
  }

  const handleDeleted = () => {
    if (typeof ctx.onDeleted === 'function') {
      ctx.onDeleted()
    }
    ctx.closeModal()
  }

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
        zIndex: EDIT_PROJECT_MODAL_Z_INDEX,
        padding: '1rem',
        boxSizing: 'border-box',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) ctx.closeModal()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit project"
        style={{
          background: 'white',
          padding: '1.25rem 1.5rem',
          borderRadius: 8,
          width: 'min(640px, 96vw)',
          maxHeight: '92vh',
          overflow: 'auto',
          boxSizing: 'border-box',
          border: '1px solid #e5e7eb',
          boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <EditProjectForm
          key={ctx.projectId}
          projectId={ctx.projectId}
          onSaved={handleSaved}
          onCancel={ctx.closeModal}
          onDeleted={handleDeleted}
        />
      </div>
    </div>
  )
}
