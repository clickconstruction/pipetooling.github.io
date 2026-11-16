import { supabase } from '../supabase'
import { readJobDayLedger, type JobDayLedgerReadArgs } from './jobDayLedgerReads'
import type { JobDayLedger } from './jobDayLedger'

/**
 * The job day ledger for a window (v2.2692), as the app reads it: the reads live in `jobDayLedgerReads.ts` with the
 * client passed in (punch list #360, PR 4), and this file binds the app's client, as `overheadPoolSnapshot.ts` does.
 */
export function loadJobDayLedger(args: JobDayLedgerReadArgs): Promise<JobDayLedger | null> {
  return readJobDayLedger(supabase, args)
}
