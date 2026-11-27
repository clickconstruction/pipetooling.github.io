/**
 * Voided test bills (punch list #443, row 7): the one read. The rule and the words are `voidedTestBills.ts`.
 *
 * Nothing is written from the app. The record is written by the edge function that voids the bill, as the service
 * role, and the table lets a developer alone read it. This read runs as the signed-in person.
 *
 * It answers an empty list whenever it has no rows to give, and never throws. That covers three cases the line
 * must draw nothing for: no bill of the job was voided, the reader is no developer and the policy returns no row,
 * and the table is not on the database yet, which the database answers with a refusal. The client ships on the
 * merge and the table waits for a push, so the last case is real for a while.
 *
 * The table is not in the generated types until the types pass that follows its migration, so it is named with a
 * cast here, as the other reads of a new table are.
 */
import { supabase } from '../supabase'
import { VOIDED_TEST_BILLS_COLS, parseVoidedTestBill, type VoidedTestBill } from './voidedTestBills'

/** The most records the line reads for one job. A test job has a handful. */
const READ_CAP = 50

/** The voided test bills of one job, the newest void first. An empty list when there are none, and when the read is refused or fails. */
export async function readVoidedTestBills(jobId: string): Promise<VoidedTestBill[]> {
  if (!jobId) return []
  try {
    const result = (await supabase
      .from('voided_test_bills' as never)
      .select(VOIDED_TEST_BILLS_COLS)
      .eq('job_id', jobId)
      .order('voided_at', { ascending: false })
      .limit(READ_CAP)) as unknown as { data: unknown[] | null; error: unknown }
    if (result.error || !Array.isArray(result.data)) return []
    return result.data.map(parseVoidedTestBill).filter((b): b is VoidedTestBill => b != null)
  } catch {
    return []
  }
}
