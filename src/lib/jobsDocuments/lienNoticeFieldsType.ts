/**
 * The nine values a § 53.056 notice prints, and a notice's record keeps (types alone, so a kernel that only names the
 * shape does not pull the document builder behind it, and the edge copy can carry that kernel: v2.7229).
 * `lienFilingDocuments.ts` re-exports it, so every caller's import stands.
 */
export type LienNoticeFields = {
  /** YYYY-MM-DD */
  noticeDate: string
  projectDescription: string
  claimantName: string
  laborMaterialsType: string
  originalContractorName: string
  /** '' when the claimant contracted directly with the original contractor. */
  contractedWithIfDifferent: string
  claimAmount: string
  /** "July 2026 $0.00 · August 2026 $5,900.00" — printed only when a person gave a month its own figure (v2.3682). */
  claimSplit?: string
  contactPerson: string
  claimantAddress: string
  /** Print the § 53.254(g) statement under the form (v2.3744) — set for a residential or homestead property, where a homestead lien is invalid without it. Absent on older drafts. */
  homesteadStatement?: boolean
  /** "1760.00" — the part of the claim that is unpaid subcontract retainage (v2.3753): printed as "Of which, unpaid retainage:" under the claim, so the § 53.056 notice traps it now (counsel, 2026-09-22) and the § 53.057 form is belt and suspenders. Absent = not recorded. */
  retainageIncluded?: string
}
