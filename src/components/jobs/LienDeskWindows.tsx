import type { LienDeskData } from '../../hooks/useLienDeskData'
import { resolveLienProperty } from '../../lib/jobs/lienProperty'
import type { LienProperty } from '../../lib/jobs/lienPropertyPapers'
import type { LienScanTarget } from '../../lib/jobs/lienScanBatch'
import type { LienServeJob } from '../../lib/jobs/lienServePackets'
import type { PhysicalInvoiceIssuer } from '../../lib/physicalInvoiceIssuer'
import LienJobPathWindow from './LienJobPathWindow'
import LienPaperPropertyWindow from './LienPaperPropertyWindow'
import LienPropertyCard from './LienPropertyCard'
import LienPublicPropertyWindow from './LienPublicPropertyWindow'
import LienPublicPutBackWindow from './LienPublicPutBackWindow'
import LienScanBatchWindow from './LienScanBatchWindow'
import type { LienDocKnown } from '../../lib/jobs/lienDocNumber'
import LienServeWindow from './LienServeWindow'
import type { LienDeskWindowFlags } from './useLienDeskWindows'
import type { LienServeLanding } from '../../lib/jobs/lienServeStage'

/**
 * The windows the Lien desk opens over itself from the Board and a pane (its own file since v2.7588, out of
 * `LienDesk.tsx` as they stood, in the order they were drawn): a pane's property fix, Serve the filed liens and Add
 * the stamped scans (punch list #366), the public-property review and its put-back (v2.7443), a property's card,
 * and a job's lien path (v2.7526). Each is drawn only while its flag is up; the five flags the Board raises are
 * `useLienDeskWindows`, the other two stay the desk's.
 */
export function LienDeskWindows({
  data,
  isMobile,
  todayYmd,
  issuer,
  windows,
  serveJobs,
  serveMailedJobs,
  docKnown,
  servePrinted,
  serveLand = null,
  onServeClosed,
  onServePrinted,
  scanTargets,
  paneFix,
  onClosePaneFix,
  propertyCard,
  setPropertyCard,
  bookProperties,
  bookLoading,
  bookError,
  onChanged,
  onOpenJob,
  onOpenAffidavit,
  onOpenJobPaper,
}: {
  data: LienDeskData | null
  isMobile: boolean
  todayYmd: string
  issuer: PhysicalInvoiceIssuer | null
  /** The five flags the Board raises, with their setters. */
  windows: LienDeskWindowFlags
  serveJobs: LienServeJob[]
  /** The mailed liens the copies window still shows: a copy lacks its number or its receipt. */
  serveMailedJobs?: LienServeJob[]
  /** Every filed lien's document number on the desk, for the check on a typed one. */
  docKnown?: LienDocKnown[]
  /** The filings whose copies a print is filed for. */
  servePrinted?: ReadonlySet<string>
  /** Where the copies window opens, from the door that opened it (`lienServeStage.ts`); null opens it at the top. */
  serveLand?: LienServeLanding | null
  /** The copies window sent these filings' copies to the printer. */
  onServePrinted?: (filingIds: string[]) => void
  /** The copies window closed: the desk forgets where it landed. */
  onServeClosed?: () => void
  scanTargets: LienScanTarget[]
  /** A pane's property fix: the job and the field to land on. */
  paneFix: { jobId: string; focus: 'owner' | 'owner_address' | 'legal' | 'homestead_answer' } | null
  onClosePaneFix: () => void
  /** A property's card: the address, and the job it was opened from. */
  propertyCard: { addressId: string; fromJobId: string | null } | null
  setPropertyCard: (card: { addressId: string; fromJobId: string | null } | null) => void
  bookProperties: ReadonlyArray<LienProperty>
  bookLoading: boolean
  bookError: string
  /** The desk re-reads after a write. */
  onChanged: () => void
  onOpenJob?: (jobId: string) => void
  /** A filed lien's own window (the Lien window on its affidavit). */
  onOpenAffidavit: (jobId: string) => void
  /** A paper on the property's card: the desk opens that job's notice or affidavit. */
  onOpenJobPaper: (jobId: string, paper: 'notice' | 'affidavit') => void
}) {
  const { serveOpen, setServeOpen, scansOpen, setScansOpen, publicReview, setPublicReview, publicPutBack, setPublicPutBack, jobPath, setJobPath } = windows
  return (
    <>
    {paneFix && data && data.jobsById[paneFix.jobId] ? (() => {
      const fixJob = data.jobsById[paneFix.jobId]!
      const fixAddress = fixJob.customer_address_id ? data.addressesById[fixJob.customer_address_id] ?? null : null
      return (
        <LienPaperPropertyWindow
          job={fixJob}
          address={fixAddress}
          ownerOnJob={resolveLienProperty(fixAddress, data.ownerByJob[fixJob.id] ?? null).owner.source === 'job_override'}
          focus={paneFix.focus}
          onClose={(saved) => {
            onClosePaneFix()
            if (saved) onChanged()
          }}
        />
      )
    })() : null}
    {serveOpen ? (
      <LienServeWindow
        jobs={serveJobs}
        mailed={serveMailedJobs}
        docKnown={docKnown}
        printed={servePrinted}
        todayYmd={todayYmd}
        issuer={issuer}
        isMobile={isMobile}
        zIndex={805}
        land={serveLand}
        onPrinted={onServePrinted}
        onOpenJob={(jobId) => {
          setServeOpen(false)
          onServeClosed?.()
          onOpenAffidavit(jobId)
        }}
        onChanged={onChanged}
        onClose={() => {
          setServeOpen(false)
          onServeClosed?.()
        }}
        onAddScans={() => {
          setServeOpen(false)
          onServeClosed?.()
          setScansOpen(true)
        }}
      />
    ) : null}
    {scansOpen && data ? <LienScanBatchWindow targets={scanTargets} isMobile={isMobile} zIndex={805} onChanged={onChanged} onClose={() => setScansOpen(false)} /> : null}
    {publicReview?.[0] ? (
      <LienPublicPropertyWindow
        key={publicReview[0]}
        addressId={publicReview[0]}
        zIndex={805}
        onClose={(answered) => {
          const rest = publicReview.slice(1)
          setPublicReview(rest.length ? rest : null)
          if (answered) onChanged()
        }}
      />
    ) : null}
    {propertyCard ? (
      <LienPropertyCard
        property={bookProperties.find((p) => p.key === propertyCard.addressId) ?? null}
        loading={bookLoading}
        error={bookError}
        fromJobId={propertyCard.fromJobId}
        phone={isMobile}
        zIndex={805}
        onClose={() => setPropertyCard(null)}
        onOpenJob={onOpenJob}
        onOpenProperty={(addressId) => setPropertyCard({ addressId, fromJobId: null })}
        onOpenPaper={(jobId, paper) => {
          setPropertyCard(null)
          onOpenJobPaper(jobId, paper)
        }}
      />
    ) : null}
    {publicPutBack ? (
      <LienPublicPutBackWindow
        addressId={publicPutBack}
        zIndex={805}
        onClose={(changed) => {
          setPublicPutBack(null)
          if (changed) onChanged()
        }}
      />
    ) : null}
    {jobPath ? (
      <LienJobPathWindow
        key={jobPath}
        jobId={jobPath}
        zIndex={805}
        onClose={(changed) => {
          setJobPath(null)
          if (changed) onChanged()
        }}
      />
    ) : null}
    </>
  )
}
