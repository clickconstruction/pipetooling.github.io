import type { LienAffidavitFields } from '../jobsDocuments/lienAffidavitFieldsType'
import { cleanStoredAddress } from '../displayAddress'
import { lienTradeWords } from './lienTradeWords'
import { lienWorkSpan, type LienWorkSpanJob } from './lienWorkSpan'
import { lienAffidavitNoticesWords, lienAffidavitOwnerSends, lienAffidavitSwornMonths, type LienAffidavitNoticeRow } from './lienAffidavitNotices'
import { describeNoticeMonths } from './lienNoticeMonthWords'
import { DEFAULT_CLAIMANT_NAME } from './lienNoticeJobFields'

/**
 * The § 53.054 affidavit, filled from the job (pure): the one recipe the Lien desk, the job's Lien window and the dev
 * seat's recorded filing fill the paper from. It lived in `lienNoticeDraft.ts`, which re-exports it, so every import
 * there stands; it moved here so the edge copy can carry it without the cover letters and the settings file behind it
 * (the dev seat's plan_lien_filing).
 */

/**
 * The company on a lien affidavit, as much of Settings → Company as the paper reads: its name, where its mail goes,
 * where it is when that differs, and the county it signs in. A shape, not the settings file's own type, so this kernel
 * pulls no settings code behind it.
 */
export type LienAffidavitIssuer = { companyName?: string | null; addressText?: string | null; physicalAddressText?: string | null; signingCounty?: string | null }

/** The § 53.054 affidavit, filled from the job — the Lien window's affidavit tab's recipe. */
export type LienAffidavitJobFacts = {
  jobName: string | null | undefined
  jobAddress: string | null | undefined
  isSub: boolean
  /** The GC's name and address as its customer row holds them. Read on a job under a GC alone: with no GC the paper names our own company (`lienOriginalContractor`). */
  originalContractorName: string
  originalContractorAddress: string
  ownerName: string
  ownerAddress: string
  county: string
  legalDescription: string
  customerName: string | null | undefined
  revenue: number
  paymentsMade: number
  /** The claim set by hand (v2.3682): dollars off the unpaid balance the affidavit swears to. */
  claimAmountOff?: number
  /** What the sent bills still owe (v2.4969, the desk's open_balance). Given, the sworn unpaid amount is this less the correction; absent, revenue − paymentsMade as before. */
  openBalance?: number
  /** 'YYYY-MM' — the last month worked, as the desk's RPC names it; the span's fallback when the job carries no day — its first to its last day (v2.6061). */
  lastMonth: string
  /** 'YYYY-MM' — the first month with a session, when the caller knows it (the Lien window's months, v2.6809); the start's fallback while the job has no first day. */
  firstMonth?: string | null
  /** The job's work days (v2.6061): the first and last approved clock day as the ledger keeps them (`first_work_date`, `last_work_date`) and the last day set by hand (`lien_last_work_on`); paragraph 5 swears the span from them. Absent, the month's. */
  workDays?: LienWorkSpanJob | null
  /** Today, 'YYYY-MM-DD' — a month still running ends today on the paper. */
  todayYmd?: string | null
  /** The months set by hand on the job (v2.7270, punch list #356): when any, paragraph 5 names these in place of the record's months. */
  monthsByHand?: ReadonlyArray<string> | null
  noticesRecorded: boolean
  contactPerson: string
  issuer: LienAffidavitIssuer | null
  /** The job's service type name (v2.3849) — the affidavit's kind of work. */
  serviceTypeName?: string | null
  /**
   * Which paper to fill (punch list #305): the short form unless the caller says `'long'`, the ten-paragraph form a
   * paper drafted before the short form keeps (`lienAffidavitFormForItem`).
   */
  form?: 'short' | 'long'
  /** The job's recorded filings (`job_lien_filings`): the short form reads the § 53.056 notices among them for the months it names (those inside the job's own work span) and the day and method each went to the owner. */
  filings?: ReadonlyArray<LienAffidavitNoticeRow> | null
  /** The property record says homestead (`customer_addresses.homestead`): the short form opens with the § 53.254(f) notice. The flag alone, never the property kind: a house that is not a homestead must not say its affidavit is not a lien. */
  homestead?: boolean
}

/**
 * Who the original contractor is on a lien paper, and where. Pure, the one rule the desk and the Lien window share.
 * The original contractor is whoever contracted with the owner (§ 53.001(7)). On a job under a GC that is the GC:
 * its name and address as the customer row holds them, blank when none is on file, which the desk lists as a blank
 * to fill. On a job with no GC we contracted with the owner, so it is our own company at its own address, the
 * claimant the paper already names. The desk's draft read the GC's row alone and printed a blank there.
 */
export function lienOriginalContractor(f: { isSub: boolean; gcName: string | null | undefined; gcAddress?: string | null; issuer: LienAffidavitIssuer | null }): { name: string; address: string } {
  if (f.isSub) return { name: f.gcName ?? '', address: f.gcAddress ?? '' }
  return { name: (f.issuer?.companyName ?? '').trim() || DEFAULT_CLAIMANT_NAME, address: (f.issuer?.addressText ?? '').replace(/\r?\n/g, ', ').trim() }
}

export function buildLienAffidavitFieldsForJob(f: LienAffidavitJobFacts): LienAffidavitFields {
  const unpaid = Math.max(0, (f.openBalance ?? f.revenue - f.paymentsMade) - (f.claimAmountOff ?? 0))
  // One rule for paragraph 7: the GC on a job under one, our own company on a job contracted with the owner, whatever the caller handed over.
  const originalContractor = lienOriginalContractor({ isSub: f.isSub, gcName: f.originalContractorName, gcAddress: f.originalContractorAddress, issuer: f.issuer })
  // The period paragraph 5 swears (v2.6061): the first approved day through the last, or the day set by hand; the month's first to last day as the fallback. Until v2.6061 both ends were the 28th of the last month.
  const span = lienWorkSpan(f.workDays, { firstMonth: f.firstMonth, lastMonth: f.lastMonth, todayYmd: f.todayYmd })
  // The company's second address (punch list #305), when Settings hold one: the short form prints it after the mailing address when the two differ.
  // Line by line, so a field holding only blank lines is no address.
  const physicalAddress = (f.issuer?.physicalAddressText ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).join(', ')
  return {
    county: f.county,
    claimantPersonName: f.contactPerson,
    claimantCompany: (f.issuer?.companyName ?? '').trim() || DEFAULT_CLAIMANT_NAME,
    claimantAddress: (f.issuer?.addressText ?? '').replace(/\r?\n/g, ', ').trim(),
    legalDescription: f.legalDescription,
    propertyAddress: cleanStoredAddress(f.jobAddress),
    contractedWithName: f.isSub ? f.originalContractorName : f.ownerName || (f.customerName ?? '').trim(),
    // The trade, never the job's name (v2.4719): a job is often named for its customer, and the affidavit swore "the kind of work … was: Bruce Hall".
    workDescription: lienTradeWords(f.serviceTypeName).laborMaterials,
    workStart: span.workStart,
    workEnd: span.workEnd,
    ownerName: f.ownerName,
    ownerAddress: f.ownerAddress,
    originalContractorName: originalContractor.name,
    originalContractorAddress: originalContractor.address,
    contractAmount: f.revenue.toFixed(2),
    paidAmount: f.paymentsMade.toFixed(2),
    unpaidAmount: unpaid.toFixed(2),
    includeNoticesSworn: !f.isSub || f.noticesRecorded,
    ...(f.form === 'long'
      ? {}
      : {
          form: 'short' as const,
          isSub: f.isSub,
          ...(f.homestead === true ? { homestead: true } : {}),
          ...(physicalAddress ? { claimantPhysicalAddress: physicalAddress } : {}),
          // The county the company signs in (punch list #314), when Settings or the print press names one: both county lines print it.
          ...((f.issuer?.signingCounty ?? '').trim() ? { signingCounty: (f.issuer?.signingCounty ?? '').trim() } : {}),
          // A job contracted with the owner names no months and no notices: neither is asked of an original contractor.
          // The months are the noticed ones inside this job's own span: a notice mailed for several jobs stores the whole paper's months on each.
          ...(f.isSub ? { workMonthsWords: describeNoticeMonths(lienAffidavitSwornMonths(f)), noticesSentWords: lienAffidavitNoticesWords(lienAffidavitOwnerSends(f.filings)) } : {}),
        }),
  }
}
