import { useMemo, type CSSProperties } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useSitePapers } from '../../hooks/useSitePapers'
import { SITE_PAPERS_WORDS, sitePaperLines, type SiteJob } from '../../lib/addresses/sitePapers'
import { canReadPartyPapers } from '../../lib/contracts/partyPapers'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { SitePapersList } from './SitePapersList'

/**
 * A job's Documents tab: **Papers for this site** (punch list #439, piece 3). A paper sent to an outside company for
 * the place this job is at shows here, whichever job or screen it was sent from: the company, the paper, where it
 * stands and its day. It reads, and presses nothing: a paper is sent again or copied from its line on Agreements.
 *
 * The section is drawn only when the site has a paper, or a read failed. Most jobs are at no site with papers, and an
 * empty heading on every job would be noise. It reads for the roles a company's papers are listed for.
 */

const heading: CSSProperties = { margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-strong)' }

export function JobDocumentsSitePapers({ job }: { job: SiteJob }) {
  const { role } = useAuth()
  const read = useSitePapers(job, canReadPartyPapers(role))
  const today = todayYmdInAppTz()
  const lines = useMemo(() => sitePaperLines(read.rows ?? [], job, read.answers, today), [read.rows, read.answers, job, today])
  if (!read.failure && lines.length === 0) return null
  return (
    <section aria-labelledby="job-documents-site-papers" data-testid="job-site-papers" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <h3 id="job-documents-site-papers" style={heading}>
        {SITE_PAPERS_WORDS.heading}
      </h3>
      {read.failure ? <OfflineRetryPanel failure={read.failure} onRetry={read.retry} surface="job-site-papers" idempotent busy={read.reading} /> : null}
      <SitePapersList lines={lines} lead={SITE_PAPERS_WORDS.lead} testId="job-site-papers" />
    </section>
  )
}

export default JobDocumentsSitePapers
