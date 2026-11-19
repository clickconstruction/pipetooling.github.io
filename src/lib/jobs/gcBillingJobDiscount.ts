/**
 * Add discount on a job billed from the GC desk (v2.7862, migration 20261118223000).
 *
 * A GC project's billing job is not priced by its lines: its total is the contract, the interest billed and the
 * riders, and it changes only by a signed change order. `apply_job_discount` refuses such a job, and Bill Customer
 * says why in the place of **− Add discount**, so nobody types a discount the function will turn away.
 *
 * The sentence is the function's own, word for word, so the press that is not offered and the refusal behind it
 * read the same.
 */
export const GC_BILLING_JOB_DISCOUNT_WORDS =
  'This job is billed from Owner Billing on the GC desk. Its price changes only by a signed change order, so a discount goes on a change order there.'

/** What stands in the discount press's place on a job, when it is a GC project's billing job; null on any other job. */
export function gcBillingJobDiscountWords(isGcBillingJob: boolean): string | null {
  return isGcBillingJob ? GC_BILLING_JOB_DISCOUNT_WORDS : null
}
