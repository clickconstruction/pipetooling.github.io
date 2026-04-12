import { useNewProjectModal } from '../contexts/NewProjectModalContext'
import NewProjectForm from './projects/NewProjectForm'

const NEW_PROJECT_MODAL_Z_INDEX = 1020

export default function NewProjectModal() {
  const ctx = useNewProjectModal()

  if (!ctx?.isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: NEW_PROJECT_MODAL_Z_INDEX,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-project-modal-title"
        style={{
          background: 'white',
          padding: '1rem 1.5rem 1.5rem',
          borderRadius: 8,
          width: 'min(960px, 96vw)',
          maxHeight: '92vh',
          overflow: 'auto',
          boxSizing: 'border-box',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="new-project-modal-title" style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '1.25rem' }}>
          New project
        </h2>
        <NewProjectForm
          key={ctx.formKey}
          prefill={ctx.prefill}
          onCancel={ctx.closeModal}
          onCreated={(projectId) => {
            ctx.onCreated?.(projectId)
            ctx.closeModal()
          }}
        />
      </div>
    </div>
  )
}
