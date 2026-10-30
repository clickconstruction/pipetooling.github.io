/**
 * The job window's door to Banking → Cost batches with this job as the source (devs only): on the
 * Costs tab's strip, `Move cost ▸` closes the window and opens the Move cost screen on the job.
 */
import { useNavigate } from 'react-router-dom'
import { useOptionalAuth } from '../../hooks/useAuth'
import { moveCostHref } from '../../lib/costBatches/moveCostHref'

export function JobWindowMoveCostDoor({ jobId, onBeforeNavigate }: { jobId: string; onBeforeNavigate?: () => void }) {
  const auth = useOptionalAuth()
  const navigate = useNavigate()
  if (auth?.role !== 'dev') return null
  return (
    <button
      type="button"
      title="Move this job's cost rows onto other jobs as a recorded, reversible cost batch (devs)"
      onClick={() => {
        onBeforeNavigate?.()
        navigate(moveCostHref(jobId))
      }}
      style={{
        marginLeft: '0.5rem',
        padding: '0.2rem 0.6rem',
        fontSize: '0.75rem',
        fontWeight: 600,
        borderRadius: 999,
        border: '1px solid var(--border-strong)',
        background: 'var(--surface)',
        color: 'var(--text-700)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        font: 'inherit',
      }}
    >
      Move cost ▸
    </button>
  )
}
