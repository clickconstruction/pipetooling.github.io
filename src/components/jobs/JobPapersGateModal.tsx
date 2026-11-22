import { useState } from 'react'
import { isOfficeRole } from '../../lib/doorRoles'
import type { UserRole } from '../../hooks/useAuth'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { documentsQuietButton } from './jobDocumentsStyles'
import { JobDocumentsRequiredPapers } from './JobDocumentsRequiredPapers'
import { JobPapersGate } from './JobPapersGate'

/**
 * The prompt as a window, drawn in place of the job window for a person who still owes a paper on that job. The
 * office gets one door more: the job's papers and who has signed, so a paper required by mistake can come off
 * without signing it first. That door shows the papers and the people, never the job.
 */
export function JobPapersGateModal({ jobId, role, onClose, onOpenJob, returnPath, zIndex }: { jobId: string; role: UserRole | string | null; onClose: () => void; onOpenJob?: () => void; returnPath?: string; zIndex?: number }) {
  const [managing, setManaging] = useState(false)
  const office = isOfficeRole(role)
  return (
    <ResponsiveModalShell title="Papers to sign" onRequestClose={onClose} maxWidthDesktop={managing ? 860 : 480} zIndex={zIndex}>
      <div style={{ display: 'grid', gap: '0.75rem', padding: '0.25rem 0 0.75rem' }} data-testid="job-papers-gate-modal">
        <JobPapersGate jobId={jobId} onOpenJob={onOpenJob} returnPath={returnPath} />
        {office ? (
          managing ? (
            <JobDocumentsRequiredPapers job={{ id: jobId }} />
          ) : (
            <div>
              <button type="button" style={{ ...documentsQuietButton, minHeight: 44 }} onClick={() => setManaging(true)}>
                This job’s papers and who has signed
              </button>
            </div>
          )
        ) : null}
      </div>
    </ResponsiveModalShell>
  )
}

export default JobPapersGateModal
