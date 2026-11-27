import { useMemo, type CSSProperties } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useDevelopmentSitePapers } from '../../hooks/useSitePapers'
import { siteProof } from '../../lib/addresses/siteProof'
import { SITE_PAPERS_WORDS, developmentSiteScope, sitePaperLinesInScope } from '../../lib/addresses/sitePapers'
import { canReadPartyPapers } from '../../lib/contracts/partyPapers'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { SitePapersList } from '../jobs/SitePapersList'
import { SiteProof } from './SiteProof'

/**
 * A development's page: **Papers for this site** (punch list #439, piece 3). A development carries all its jobs, so
 * its papers are the ones that name the development and the ones that name the address of a job or a bid in it. The
 * lines are a job's own (`SitePapersList`): the company, the paper, where it stands and its day. It reads, and
 * presses nothing.
 *
 * Drawn only when the site has a paper, or the read failed, for the roles a company's papers are listed for.
 *
 * Under the lines sits **The proof** for the site's client (piece 5, `SiteProof.tsx`), from the same rows: the count of
 * the companies that signed and **Make the packet**.
 */

const box: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.4rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '0.75rem 0.9rem' }
const heading: CSSProperties = { margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-strong)' }

export function DevelopmentSitePapers({
  developmentId,
  addresses,
  clientName,
  siteName,
}: {
  developmentId: string
  addresses: ReadonlyArray<string | null | undefined>
  /** The client the proof is for, when the page knows one. */
  clientName?: string | null
  /** The development's name, for the packet's head. */
  siteName?: string | null
}) {
  const { role } = useAuth()
  const read = useDevelopmentSitePapers(developmentId, addresses, canReadPartyPapers(role))
  const today = todayYmdInAppTz()
  // The addresses as one string, so the lines are worked out again only when they change.
  const asked = addresses.map((a) => (a ?? '').trim()).filter(Boolean).join('\n')
  const scope = useMemo(() => developmentSiteScope(developmentId, asked ? asked.split('\n') : [], read.answers), [developmentId, asked, read.answers])
  const lines = useMemo(() => sitePaperLinesInScope(read.rows ?? [], scope, today), [read.rows, scope, today])
  const proof = useMemo(() => siteProof(read.rows ?? [], scope), [read.rows, scope])
  const site = useMemo(() => ({ developmentId }), [developmentId])
  if (!read.failure && lines.length === 0) return null
  return (
    <section aria-labelledby="development-site-papers" data-testid="development-site-papers" style={box}>
      <h3 id="development-site-papers" style={heading}>
        {SITE_PAPERS_WORDS.heading}
      </h3>
      {read.failure ? <OfflineRetryPanel failure={read.failure} onRetry={read.retry} surface="development-site-papers" idempotent busy={read.reading} /> : null}
      <SitePapersList lines={lines} lead={SITE_PAPERS_WORDS.developmentLead} testId="development-site-papers" />
      <SiteProof proof={proof} clientName={clientName} siteName={siteName} site={site} todayYmd={today} />
    </section>
  )
}

export default DevelopmentSitePapers
