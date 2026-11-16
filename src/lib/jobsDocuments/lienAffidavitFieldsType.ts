/**
 * The values a § 53.054 lien affidavit prints, and a filing's record keeps (types alone, so a kernel that only names
 * the shape does not pull the document builder behind it, and the edge copy can carry that kernel: the dev seat's
 * plan_lien_filing). `lienFilingDocuments.ts` re-exports it, so every caller's import stands.
 */
export type LienAffidavitFields = {
  county: string
  claimantPersonName: string
  claimantCompany: string
  claimantAddress: string
  legalDescription: string
  propertyAddress: string
  /** The party the labor/materials were furnished under contract with. */
  contractedWithName: string
  workDescription: string
  /** YYYY-MM-DD */
  workStart: string
  workEnd: string
  ownerName: string
  ownerAddress: string
  originalContractorName: string
  originalContractorAddress: string
  contractAmount: string
  paidAmount: string
  unpaidAmount: string
  /** ¶9 — sworn only when notices are recorded (subs) or not required (originals). */
  includeNoticesSworn: boolean
  /**
   * Which paper these fields print (punch list #305). `'short'` is the short form: what § 53.054(a) lists and
   * little else. Absent is the ten-paragraph form every affidavit carried before it, so a filing's stored
   * snapshot (`job_lien_filings.fields`) draws as it was filed and a paper drafted on the earlier form keeps it.
   */
  form?: 'short'
  /** Short form: the job is under an original contractor (a GC). False is a job contracted with the owner, where the paper names no months and no notices. */
  isSub?: boolean
  /** Short form ¶1: the claimant's physical address, printed only when it differs from `claimantAddress` (the mailing address), § 53.054(a)(7). */
  claimantPhysicalAddress?: string
  /** Short form: the county the paper is signed in, the venue (punch list #314). Printed on the top county line and the notary's; blank leaves both for the notary's hand. Never the property's county, which is `county`. */
  signingCounty?: string
  /** Short form ¶3: the hiring party's last known address, read only when `contractedWithName` is someone other than the original contractor, § 53.054(a)(4). */
  contractedWithAddress?: string
  /** Short form ¶5: each month payment is requested for, in words ("July and August 2026"), § 53.054(a)(3). */
  workMonthsWords?: string
  /** Short form ¶6: the method and day of each notice sent to the owner ("certified mail on August 14, 2026"), § 53.054(a)(8). */
  noticesSentWords?: string
  /** Short form: the property is a homestead, so the paper opens with the § 53.254(f) notice (`HOMESTEAD_AFFIDAVIT_NOTICE`). */
  homestead?: boolean
}
