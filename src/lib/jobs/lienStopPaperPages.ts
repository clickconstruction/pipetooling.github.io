import type { LienDeskData } from '../../hooks/useLienDeskData'
import type { PhysicalInvoiceIssuer } from '../physicalInvoiceIssuer'
import { buildLienAffidavitBlocks, buildLienNoticeBlocks, buildLienRetainageNoticeBlocks, buildReleaseOfRecordBlocks, filingDocHtml, filingLetterheadFromIssuer, type FilingDocBlock, type FilingDocExtras, type LienAffidavitFields, type LienNoticeFields, type ReleaseOfRecordFields } from '../jobsDocuments/lienFilingDocuments'
import type { JobLienFilingRow } from './lienDeadlines'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
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

const SEND_METHOD_WORDS: Record<string, string> = { certified_mail: 'certified mail, return receipt', traceable_courier: 'traceable courier', email: 'email', hand: 'hand delivery' }

/**
 * A filing's paper as it went out (v2.4793): the row stores the fields it printed with (`fields`) and
 * the sends it recorded, so the page is rebuilt from the record, not from today's job — the Lien
 * window's *View* on a recorded filing does the same. Null when the row stores no snapshot.
 */
export function filingSnapshotPage(f: JobLienFilingRow, { issuer, jobNumber }: { issuer: PhysicalInvoiceIssuer | null; jobNumber: string }): LienStopPaperPage | null {
  const snap = f.fields as unknown
  if (!snap || typeof snap !== 'object') return null
  const sends = Array.isArray(f.sends) ? (f.sends as { recipient?: string; method?: string; tracking?: string; sent_on?: string }[]) : []
  const extras: FilingDocExtras = {
    letterhead: filingLetterheadFromIssuer(issuer),
    refItems: [`Job #${jobNumber}`, ...((f.months_covered ?? []).length > 0 ? [`Work month ${(f.months_covered ?? []).join(', ')}`] : []), demandDate(calendarYmdInAppTzFromIso(f.created_at ?? ''))],
    deliveryLines: sends.map((s) => `${s.recipient === 'owner' ? 'Owner of record' : 'Original contractor'} — ${SEND_METHOD_WORDS[s.method ?? ''] ?? s.method ?? '—'}${s.tracking ? ` · ${s.tracking}` : ''}${s.sent_on ? ` · ${demandDate(s.sent_on)}` : ''}`),
  }
  let blocks: FilingDocBlock[] | null = null
  let label = 'the notice'
  if (f.kind === 'notice_53_056') blocks = buildLienNoticeBlocks(snap as LienNoticeFields, extras)
  else if (f.kind === 'retainage_53_057') { blocks = buildLienNoticeBlocks(snap as LienNoticeFields, extras, { instrument: 'retainage_53_057' }); label = 'the § 53.057 notice' }
  else if (f.kind === 'affidavit') { blocks = buildLienAffidavitBlocks(snap as LienAffidavitFields, extras); label = 'the affidavit' }
  else if (f.kind === 'release_of_record') { blocks = buildReleaseOfRecordBlocks(snap as ReleaseOfRecordFields, extras); label = 'the release of record' }
  if (!blocks) return null
  return { key: `filing:${f.id}`, label: `As it went out · ${label}`, html: filingDocHtml(blocks) }
}
