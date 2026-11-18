import { useNavigate } from 'react-router-dom'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { useOptionalAuth } from '../../hooks/useAuth'
import { TaggedJobNotesSection } from '../jobs/TaggedJobNotesSection'

/**
 * Tagged notes as a window (punch list #363, and task notes since #375): the Needs you line's
 * door. It lists both kinds, oldest first, and an answer typed here goes on the job's notes or the
 * task's. The crew and a superintendent have no Pipeline, so this is where they answer a job tag.
 * A helper has no job window to open from here, so the job's name is plain words for them. A
 * task's title opens the Checklist at Today, which shows the task when it is on that page.
 */
export function TaggedJobNotesWindow({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const role = useOptionalAuth()?.role ?? null
  const opensJobs = role != null && role !== 'helpers'
  return (
    <ResponsiveModalShell title="Tagged notes" onRequestClose={onClose}>
      <TaggedJobNotesSection
        variant="window"
        onOpenTask={(instanceId) => {
          onClose()
          navigate(`/checklist?tab=today&task=${instanceId}`)
        }}
        onOpenJob={
          opensJobs
            ? (jobId) => {
                onClose()
                navigate(`/jobs?edit=${jobId}`)
              }
            : undefined
        }
      />
    </ResponsiveModalShell>
  )
}
