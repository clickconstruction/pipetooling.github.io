import { Link } from 'react-router-dom'
import { estimateChipHref, estimateChipWords, type JobEstimateAuthor } from '../../lib/jobs/jobPeople'

/**
 * The small red E beside the name of the person who wrote the estimate a job came from (v2.6694, punch list #129):
 * one of the job's people since `20261108100000_job_people_estimate_author.sql`. Its press opens the estimate. The
 * red is the status red the ledger's dots use, a literal under white words; the chip stops the row's own click.
 */
export function EstimateAuthorChip({ estimate }: { estimate: JobEstimateAuthor }) {
  const words = estimateChipWords(estimate)
  return (
    <Link
      to={estimateChipHref(estimate)}
      title={words.title}
      aria-label={words.title}
      onClick={(e) => e.stopPropagation()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 15,
        height: 15,
        marginLeft: 4,
        borderRadius: 4,
        background: '#dc2626',
        color: '#fff',
        fontSize: '0.62rem',
        fontWeight: 800,
        lineHeight: 1,
        textDecoration: 'none',
        verticalAlign: 'text-bottom',
        flexShrink: 0,
      }}
    >
      {words.label}
    </Link>
  )
}
