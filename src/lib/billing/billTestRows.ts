/**
 * Bills sent: which rows are tests. One rule, read by both views. Pure.
 *
 * The live test of 2026-11-24 found the two views of `/bills-sent` at odds. By day paid left out a payment on a
 * bill made in Stripe's test mode and still added a payment typed onto a ZZ test job to its month. By day sent
 * knew neither rule: a test-mode bill stood in its day's total, under the **Not paid** chip and in the tile a
 * leader quotes as what is owed.
 *
 * A row is a test when its bill was made in Stripe's test mode, whose link takes a test card and no money, or
 * when its job is a ZZ test job (`isZzTestJob`: the job's own name or its customer's name starts with ZZ), the
 * mark a live pass or a twin leaves on what it makes.
 *
 * What each view does with one:
 *   - By day sent (`billsSent.ts`) keeps the send on the list, since the email did go, and says it is a test.
 *     The line is in no day's total, no paid count, no tile and neither payment chip, and it carries no stamp.
 *     A test bill is never among the bills with no send on record, nor among the sends that did not arrive.
 *   - By day paid (`billsPaidDays.ts`) leaves the payment out. That view counts money, and a test's is none.
 */
import { isZzTestJob } from '../../../supabase/functions/_shared/zzTestJob'

/** What of a bill says it is a test. */
export interface BillsTestBill {
  /** *test* for a bill made in Stripe's test mode. */
  stripeMode?: string | null
}

/** What of a job says it is a test: its names. */
export interface BillsTestJob {
  job_name?: string | null
  customer_name?: string | null
}

/** True for a bill made in Stripe's test mode, and for any bill or payment on a ZZ test job. */
export function isBillsTestRow(bill: BillsTestBill | null | undefined, job: BillsTestJob | null | undefined): boolean {
  return (bill?.stripeMode ?? '').trim() === 'test' || (!!job && isZzTestJob(job))
}

/** What a test bill's send says on the list, in its print and in its spreadsheet row. */
export const BILLS_TEST_NOTE = 'A test bill. It is in no total.'

/** Where a test bill stands, on its record: the place a real bill says *Paid* or *Not paid*. */
export const BILLS_TEST_STATE = 'Test bill'
