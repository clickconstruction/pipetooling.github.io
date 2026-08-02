import { useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import TeamLeadsManager from './TeamLeadsManager'

const MODAL_Z = 1030
const TITLE_ID = 'team-leads-modal-title'

/**
 * Team leads modal (People → Users → Team leads button): pure modal chrome —
 * backdrop, panel, title, close button, Escape handler, body scroll-lock —
 * around the shared leader-centric TeamLeadsManager, which the People → Teams
 * tab also renders. All data/write logic lives in the manager (and
 * useTeamLeaderAssignments underneath it). The role gate here mirrors the
 * manager's own gate so a non-manager renders nothing at all.
 */
export default function TeamLeadsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { role: myRole } = useAuth()
  const canManage = myRole === 'dev' || myRole === 'master_technician' || isAssistantLike(myRole)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open || !canManage) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={TITLE_ID}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: MODAL_Z,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        boxSizing: 'border-box',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 720,
          maxHeight: '88vh',
          overflowY: 'auto',
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '1rem 1.25rem 1.25rem',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <h2 id={TITLE_ID} style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700 }}>
            Team leads
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: '1.1rem', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
          >
            ✕
          </button>
        </div>
        <TeamLeadsManager />
      </div>
    </div>
  )
}
