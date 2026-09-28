/**
 * The "Jobs:" line at the top right of the Workflow page: a chip per job on
 * the project — it opens Job Detail in place — and "+ Create Job" for the
 * roles that may create one.
 *
 * Draws the jobs it is handed; `useProjectJobs` (called by the page) reads them.
 */
import { Link } from 'react-router-dom'
import { useJobDetailModal } from '../../contexts/JobDetailModalContext'
import { createJobForProjectHref, projectJobChipLabel, type ProjectJobChip } from '../../lib/workflow/projectJobs'

export type WorkflowJobsStripProps = {
  projectId: string | undefined
  projectJobs: ProjectJobChip[]
  canCreateJobs: boolean
}

export function WorkflowJobsStrip({ projectId, projectJobs, canCreateJobs }: WorkflowJobsStripProps) {
  const jobDetailModal = useJobDetailModal()
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center', justifyContent: 'flex-end' }}>
      <span style={{ fontSize: '0.8125rem', color: 'var(--text-faint)' }}>Jobs:</span>
      {projectJobs.length === 0 && <span style={{ color: 'var(--text-faint)', fontSize: '0.8125rem' }}>None</span>}
      {projectJobs.map((j) => (
        // Chip opens Job Detail in place (v2.1193) — the modal carries the
        // full activity/notes thread, replacing the old ▶ thread expander.
        <button
          key={j.id}
          type="button"
          onClick={() => jobDetailModal?.openJobDetail({ jobId: j.id })}
          title="Open job detail"
          style={{
            padding: '0.15rem 0.4rem',
            background: 'var(--bg-neutral-100)',
            border: 'none',
            borderRadius: 4,
            fontSize: '0.8125rem',
            fontFamily: 'inherit',
            cursor: 'pointer',
            color: 'var(--text-700)',
          }}
        >
          {projectJobChipLabel(j)}
        </button>
      ))}
      {canCreateJobs && (
        <Link
          to={createJobForProjectHref(projectId)}
          style={{ padding: '0.15rem 0.4rem', background: 'var(--bg-sky-100)', borderRadius: 4, fontSize: '0.8125rem', textDecoration: 'none', color: 'var(--text-sky-700)' }}
        >
          + Create Job
        </Link>
      )}
    </div>
  )
}
