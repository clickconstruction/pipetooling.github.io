import { jobPeopleRows, type JobEstimateAuthor } from '../../lib/jobs/jobPeople'
import { EstimateAuthorChip } from './EstimateAuthorChip'

/**
 * The job's people as one line of names (v2.6694): the team in its order and, with the E chip beside their name, the
 * author of the signed estimate the job came from, added at the end when the office never put them on the crew.
 * Renders nothing when there is nobody, so the host keeps its own empty words.
 */
export function JobPeopleNames({ team, author }: { team: ReadonlyArray<{ user_id: string; name: string | null }>; author: JobEstimateAuthor | null | undefined }) {
  const rows = jobPeopleRows(team, author)
  if (rows.length === 0) return null
  return (
    <>
      {rows.map((r, i) => (
        <span key={r.userId} style={{ whiteSpace: 'nowrap' }}>
          {i > 0 ? ', ' : ''}
          {r.name}
          {r.estimate ? <EstimateAuthorChip estimate={r.estimate} /> : null}
        </span>
      ))}
    </>
  )
}
