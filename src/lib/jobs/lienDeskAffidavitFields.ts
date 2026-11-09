import type { LienAffidavitFields } from '../jobsDocuments/lienFilingDocuments'
import type { PhysicalInvoiceIssuer } from '../physicalInvoiceIssuer'
import type { LienAffidavitEntry } from './lienDeskAffidavits'
import type { LienClaimCorrection } from './lienClaimCorrection'
import { buildLienAffidavitFieldsForJob } from './lienNoticeDraft'
import type { LienWorkSpanJob } from './lienWorkSpan'

/**
 * The § 53.054 affidavit as the Lien desk fills it. Pure. The desk draws the paper in three places: the Affidavits
 * pane, the paper preview behind a Do now row, and a timeline stop's window. Each handed `buildLienAffidavitFieldsForJob`
 * its own list, and the lists drifted: the stop's window never passed what the sent bills owe, so its paper swore the
 * job's whole balance beside a pane that swore the bills. Now the three hand over what the desk holds for the job (its
 * row, its affidavit entry, the GC's row, the property as resolved, the claim set by hand) and this fills the paper.
 *
 * The sworn amount is the entry's `openBalance` (the RPC's `open_balance`, what the sent bills still owe) less the
 * correction. A row with no entry keeps the old reading, the job's price less its payments, and a sub's gates.
 */
export type LienDeskAffidavitFacts = {
  /** The desk's job row. */
  job: (LienWorkSpanJob & { job_name?: string | null; job_address?: string | null; customer_name?: string | null; revenue?: number | null; payments_made?: number | null; service_type?: { name: string } | null }) | null | undefined
  /** The job's affidavit entry (`list_lien_affidavit_windows`). */
  entry: Pick<LienAffidavitEntry, 'isSub' | 'openBalance' | 'lastMonth' | 'gates'> | null | undefined
  /** The GC's customer row; none on a job contracted with the owner. */
  gc: { name?: string | null; address?: string | null } | null | undefined
  ownerName: string
  ownerAddress: string
  county: string
  legalDescription: string
  /** The claim set by hand on the job (`job_lien_claim_corrections`), when there is one. */
  correction: Pick<LienClaimCorrection, 'amountOff'> | null | undefined
  /** The signer's name and title. */
  contactPerson: string
  issuer: PhysicalInvoiceIssuer | null
  todayYmd: string
}

export function buildLienDeskAffidavitFields(f: LienDeskAffidavitFacts): LienAffidavitFields {
  const { job, entry } = f
  return buildLienAffidavitFieldsForJob({
    jobName: job?.job_name,
    jobAddress: job?.job_address,
    serviceTypeName: job?.service_type?.name,
    isSub: entry?.isSub ?? true,
    originalContractorName: f.gc?.name ?? '',
    originalContractorAddress: f.gc?.address ?? '',
    ownerName: f.ownerName,
    ownerAddress: f.ownerAddress,
    county: f.county,
    legalDescription: f.legalDescription,
    customerName: job?.customer_name,
    revenue: Number(job?.revenue ?? 0),
    paymentsMade: Number(job?.payments_made ?? 0),
    openBalance: entry?.openBalance,
    claimAmountOff: f.correction?.amountOff,
    lastMonth: entry?.lastMonth ?? '',
    workDays: job ?? null,
    todayYmd: f.todayYmd,
    noticesRecorded: entry?.gates.find((g) => g.key === 'notice')?.ok ?? false,
    contactPerson: f.contactPerson,
    issuer: f.issuer,
  })
}
