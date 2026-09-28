/**
 * What closing an open job must do beyond flushing the autosave slices. These rode the
 * edit-mode Save button until v2.1080; they run on every edit-mode close — autosave may have
 * saved the balance change long before the form is closed, so unsaved edits cannot gate them.
 */
import { normalizeJobsLedgerStatus } from '../jobsLedgerStatusPipeline'
import { shouldDemotePaidJobToBilled } from './jobFormAutosaveSlices'
import { jobFormPaidDollars, jobFormRevenueDollars } from './jobFormMoneyTotals'

/** The day the customer was met is typed here and the customer's own row has none yet. */
export function closeDateMetBackfillNeeded(args: {
  customerId: string | null
  dateMet: string
  customers: ReadonlyArray<{ id: string; date_met?: string | null }>
}): boolean {
  return !!(args.customerId && args.dateMet.trim() && args.customers.some((x) => x.id === args.customerId && !x.date_met))
}

/**
 * A Paid job with a balance due again — the line items and rider fees now come to more than
 * the payments — moves back to Billed. Read off the form's rows, not the database's.
 */
export function closeDemoteToBilledNeeded(args: {
  status: string | null | undefined
  fixtures: Parameters<typeof jobFormRevenueDollars>[0]
  riderFeesDollars: number
  payments: Parameters<typeof jobFormPaidDollars>[0]
}): boolean {
  const revNum = jobFormRevenueDollars(args.fixtures, args.riderFeesDollars)
  const paymentsMadeNum = jobFormPaidDollars(args.payments)
  return shouldDemotePaidJobToBilled(normalizeJobsLedgerStatus(args.status) ?? '', revNum, paymentsMadeNum)
}
