import { useNavigate } from 'react-router-dom'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { useOptionalAuth } from '../../hooks/useAuth'
import { TaggedJobNotesSection } from '../jobs/TaggedJobNotesSection'

/**
 * Tagged job notes as a window (punch list #363): the Needs you line's door. The crew and a
 * superintendent have no Pipeline, so the same list the Pipeline draws opens here, and an answer
 * typed here goes on the job's notes. A helper has no job window to open from here, so the job's
 * name is plain words for them.
 */
export function TaggedJobNotesWindow({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const role = useOptionalAuth()?.role ?? null
  const opensJobs = role != null && role !== 'helpers'
  return (
    <ResponsiveModalShell title="Tagged job notes" onRequestClose={onClose}>
      <TaggedJobNotesSection
        variant="window"
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
