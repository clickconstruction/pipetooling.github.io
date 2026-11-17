import { useState } from 'react'
import { rereadJobsClosedToMe, useJobsNeedingMe } from '../../hooks/useJobsClosedToMe'
import { useAuth } from '../../hooks/useAuth'
import { EmptyState } from '../EmptyState'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { LockedJobLine } from './JobPapersGate'
import { JobPapersGateModal } from './JobPapersGateModal'

/**
 * The window behind the Needs you line *Papers to sign*: the jobs that wait on this person's signature. One job
 * opens straight to its prompt. Several are listed by number, each a press to its own prompt. When the last paper is
 * signed the list says nothing waits.
 */
export function JobPapersWaitingWindow({ onClose }: { onClose: () => void }) {
  const { role } = useAuth()
  const jobs = useJobsNeedingMe()
  const [picked, setPicked] = useState<string | null>(null)
  const jobId = picked ?? (jobs.length === 1 ? jobs[0]!.jobId : null)

  if (jobId) {
    return (
      <JobPapersGateModal
        jobId={jobId}
        role={role}
        onClose={() => (picked && jobs.length > 1 ? setPicked(null) : onClose())}
        onOpenJob={() => {
          void rereadJobsClosedToMe().then(() => (picked && jobs.length > 1 ? setPicked(null) : onClose()))
        }}
      />
    )
  }
  return (
    <ResponsiveModalShell title="Papers to sign" onRequestClose={onClose} maxWidthDesktop={480}>
      <div style={{ display: 'grid', gap: '0.5rem', padding: '0.25rem 0 0.75rem' }} data-testid="job-papers-waiting">
        {jobs.length === 0 ? (
          <EmptyState compact main="Nothing waiting on your signature." />
        ) : (
          jobs.map((j) => (
            <button
              key={j.jobId}
              type="button"
              onClick={() => setPicked(j.jobId)}
              style={{ font: 'inherit', textAlign: 'left', cursor: 'pointer', padding: '0.6rem 0.75rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}
            >
              <LockedJobLine jobId={j.jobId} />
            </button>
          ))
        )}
      </div>
    </ResponsiveModalShell>
  )
}

export default JobPapersWaitingWindow
