import type { ReactNode } from 'react'
import { jobPeopleRows, type JobEstimateAuthor } from '../../lib/jobs/jobPeople'
import { EstimateAuthorChip } from './EstimateAuthorChip'

/**
 * The job's people as one line of names (v2.6694): the team in its order and, with the E chip beside their name, the
 * author of the signed estimate the job came from, added at the end when the office never put them on the crew.
 * The names stay one run of text with the chip set in where it falls, so a line with no author reads exactly as the
 * joined names did ("Abraham, Paige"). Renders nothing when there is nobody, so the host keeps its own empty words.
 */
export function JobPeopleNames({ team, author }: { team: ReadonlyArray<{ user_id: string; name: string | null }>; author: JobEstimateAuthor | null | undefined }) {
  const rows = jobPeopleRows(team, author)
  if (rows.length === 0) return null
  const parts: ReactNode[] = []
  let text = ''
  rows.forEach((r, i) => {
    text += `${i > 0 ? ', ' : ''}${r.name}`
    if (r.estimate) {
      parts.push(text, <EstimateAuthorChip key={`chip-${r.userId}`} estimate={r.estimate} />)
      text = ''
    }
  })
  if (text) parts.push(text)
  return <>{parts}</>
}
