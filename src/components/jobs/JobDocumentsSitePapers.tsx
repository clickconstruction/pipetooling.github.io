import { useMemo, type CSSProperties } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useSitePapers } from '../../hooks/useSitePapers'
import { SITE_PAPERS_WORDS, sitePaperLines, sitePapersCountSentence, type SiteJob } from '../../lib/addresses/sitePapers'
import { PARTY_PAPER_TONE_COLORS, canReadPartyPapers } from '../../lib/contracts/partyPapers'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { ValueSentence } from '../valuesInPlace/ValuesInPlace'

/**
 * A job's Documents tab: **Papers for this site** (punch list #439, piece 3). A paper sent to an outside company for
 * the place this job is at shows here, whichever job or screen it was sent from: the company, the paper, where it
 * stands and its day. It reads, and presses nothing: a paper is sent again or copied from its line on Agreements.
 *
 * The section is drawn only when the site has a paper, or a read failed. Most jobs are at no site with papers, and an
 * empty heading on every job would be noise. It reads for the roles a company's papers are listed for.
 */

const heading: CSSProperties = { margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-strong)' }
const quiet: CSSProperties = { margin: 0, color: 'var(--text-muted)', fontSize: '0.8125rem' }
const line: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.2rem 0.75rem', padding: '0.45rem 0', borderTop: '1px solid var(--border)' }
const subLine: CSSProperties = { display: 'block', color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: '0.1rem', overflowWrap: 'anywhere' }
const stateChip: CSSProperties = { padding: '0.08rem 0.5rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap' }

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
      {lines.length > 0 ? (
        <>
          <p style={quiet}>{SITE_PAPERS_WORDS.lead}</p>
          <p style={quiet} data-testid="job-site-papers-count">
            <ValueSentence text={sitePapersCountSentence(lines)} />
          </p>
          <div>
            {lines.map((l) => {
              const colors = PARTY_PAPER_TONE_COLORS[l.state.tone]
              return (
                <div key={l.id} style={line} data-testid="job-site-paper-row">
                  <div style={{ minWidth: 0, flex: '1 1 14rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-strong)', overflowWrap: 'anywhere' }}>{l.company}</span>
                    <span style={subLine}>{[l.name, l.signer].filter(Boolean).join(' · ')}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexShrink: 0 }}>
                    <span style={{ ...stateChip, background: colors.background, color: colors.color }}>{l.state.words}</span>
                    {l.day ? (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                        <ValueSentence text={l.day} />
                      </span>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      ) : null}
    </section>
  )
}

export default JobDocumentsSitePapers
