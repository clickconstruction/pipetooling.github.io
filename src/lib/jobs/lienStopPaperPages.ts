import type { LienDeskData } from '../../hooks/useLienDeskData'
import type { PhysicalInvoiceIssuer } from '../physicalInvoiceIssuer'
import { buildLienAffidavitBlocks, buildLienRetainageNoticeBlocks, filingDocHtml, filingLetterheadFromIssuer } from '../jobsDocuments/lienFilingDocuments'
import { demandDate, demandMoney } from '../jobsDocuments/demandLetter'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import { lienPropertyOwnerDisplayName, resolveLienProperty } from './lienProperty'
import { buildLienAffidavitFieldsForJob, buildLienRetainageNoticeFieldsForJob, homesteadStatementApplies, lienRetainageCoverLetter } from './lienNoticeDraft'
import { coverLetterKindFor } from './gcOnNotice'
import { runCoverNoteBlocks } from './lienDeskRun'

/**
 * The pages a stop's window shows for the affidavit and the retainage notice (v2.4793), built
 * from the desk's data the way the Affidavits and Retainage panes build the same paper, so the
 * window can never differ from the pane. The § 53.056 notice's pages are the notice pane's own
 * (it already holds the draft); the host hands them over.
 */
export interface LienStopPaperPage {
  key: string
  /** `Page 1 of 2 · cover letter` */
  label: string
  html: string
}

export interface LienStopPagesInput {
  data: LienDeskData
  jobId: string
  issuer: PhysicalInvoiceIssuer | null
  signerNameFor: (masterUserId: string | null) => string
  signerPhoneFor?: (masterUserId: string | null) => string
  todayYmd: string
}

/** The affidavit as the Affidavits pane prints it; null when the job has no affidavit entry. */
export function affidavitStopPages({ data, jobId, issuer, signerNameFor, todayYmd }: LienStopPagesInput): LienStopPaperPage[] | null {
  const entry = data.affidavits.entries.find((e) => e.jobId === jobId)
  if (!entry) return null
  const job = data.jobsById[jobId]
  const gc = entry.gcCustomerId ? data.gcsById[entry.gcCustomerId] : undefined
  const address = job?.customer_address_id ? data.addressesById[job.customer_address_id] ?? null : null
  const property = resolveLienProperty(address, data.ownerByJob[jobId] ?? null)
  const correction = data.claimCorrectionsByJob[jobId] ?? null
  const fields = buildLienAffidavitFieldsForJob({
    jobName: job?.job_name,
    jobAddress: job?.job_address,
    serviceTypeName: job?.service_type?.name,
    isSub: entry.isSub,
    originalContractorName: gc?.name ?? '',
    originalContractorAddress: gc?.address ?? '',
    ownerName: lienPropertyOwnerDisplayName(property.owner),
    ownerAddress: property.owner.mailingAddress,
    county: property.county,
    legalDescription: property.legalDescription,
    customerName: job?.customer_name,
    revenue: Number(job?.revenue ?? 0),
    paymentsMade: Number(job?.payments_made ?? 0),
    claimAmountOff: correction?.amountOff,
    lastMonth: entry.lastMonth,
    noticesRecorded: entry.gates.find((g) => g.key === 'notice')?.ok ?? false,
    contactPerson: signerNameFor(job?.master_user_id ?? null),
    issuer,
  })
  const html = filingDocHtml(buildLienAffidavitBlocks(fields, { letterhead: filingLetterheadFromIssuer(issuer), refItems: [`Job #${job ? effectiveJobLedgerNumber(job.hcp_number, job.click_number) : ''}`, `Last work month ${entry.lastMonth}`, demandDate(todayYmd)] }))
  return [{ key: 'affidavit', label: 'Page 1 of 1 · the affidavit', html }]
}

/** The retainage notice behind counsel's cover letter, as the Retainage pane prints them; null when the job has no retainage entry. */
export function retainageStopPages({ data, jobId, issuer, signerNameFor, signerPhoneFor, todayYmd }: LienStopPagesInput): LienStopPaperPage[] | null {
  const entry = data.retainage.entries.find((e) => e.jobId === jobId)
  if (!entry) return null
  const job = data.jobsById[jobId]
  const gc = entry.gcCustomerId ? data.gcsById[entry.gcCustomerId] : undefined
  const address = job?.customer_address_id ? data.addressesById[job.customer_address_id] ?? null : null
  const property = resolveLienProperty(address, data.ownerByJob[jobId] ?? null)
  const jobNumber = job ? effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—' : '—'
  const label = job ? `${jobNumber}${(job.job_name ?? '').trim() ? ` · ${(job.job_name ?? '').trim()}` : ''}` : jobId.slice(0, 8)
  const fields = buildLienRetainageNoticeFieldsForJob({
    jobName: job?.job_name,
    jobAddress: job?.job_address,
    originalContractorName: gc?.name ?? '',
    retainageHeld: entry.retainageHeld,
    contactPerson: signerNameFor(job?.master_user_id ?? null),
    issuer,
    todayYmd,
    homesteadStatement: homesteadStatementApplies(property),
    serviceTypeName: job?.service_type?.name,
  })
  const extras = { letterhead: filingLetterheadFromIssuer(issuer), refItems: [`Job #${jobNumber}`, entry.contractEndedOn ? `Our contract ${entry.contractEndedHow ?? 'ended'} ${demandDate(entry.contractEndedOn)}` : '', demandDate(todayYmd)].filter(Boolean) }
  const coverLetter = lienRetainageCoverLetter({
    claimantName: fields.claimantName,
    gcName: gc?.name ?? fields.originalContractorName,
    property: (job?.job_address ?? '').trim(),
    amount: demandMoney(fields.claimAmount),
    inClaim: entry.inClaim,
    endedHow: entry.contractEndedHow,
    endedOn: entry.contractEndedOn ? demandDate(entry.contractEndedOn) : '',
    paymentBond: entry.paymentBond,
    kind: coverLetterKindFor(property),
    contact: fields.contactPerson,
    phone: (signerPhoneFor ? signerPhoneFor(job?.master_user_id ?? null) : '') || (issuer?.phone ?? '').trim(),
    trade: job?.service_type?.name,
  })
  const coverHtml = filingDocHtml(runCoverNoteBlocks({ kind: 'retainage_53_057', label, months: [], fields, extras, coverNote: null, coverLetter }))
  const docHtml = filingDocHtml(buildLienRetainageNoticeBlocks(fields, extras))
  return [
    { key: 'cover', label: 'Page 1 of 2 · cover letter', html: coverHtml },
    { key: 'retainage', label: 'Page 2 of 2 · the § 53.057 notice', html: docHtml },
  ]
}
