import { supabase } from './supabase'
import { readJobMaterialsCostSnapshot, type JobMaterialsCostSnapshot } from './jobMaterialsCostSnapshotReads'

// The line shapes, totals and row mappers live in the shared kernel (v2.3645) so dev-mcp's
// get_job computes the same parts cost; this file is the browser's reads around them.
export {
  jobAccountSplitFromLines,
  jobCardChargesCountedFromLines,
  jobCardLineStatus,
  jobCardLineStatusNote,
  mercuryCardTotalFromLines,
  tallyPartsTotalFromLines,
  type JobCardLineStatus,
  type JobMercuryAllocLine,
  type JobSupplyInvoiceLine,
  type JobTallyPartLine,
} from '../../supabase/functions/_shared/jobMaterialsCostLines'

export type { JobMaterialsCostSnapshot } from './jobMaterialsCostSnapshotReads'

/**
 * Supply/Mercury/tally snapshot for a job (matches Edit Job modal materials loaders). The reads live in
 * `jobMaterialsCostSnapshotReads.ts` with the client passed in (punch list #360, PR 4); this file binds the app's.
 */
export function fetchJobMaterialsCostSnapshot(jobId: string): Promise<JobMaterialsCostSnapshot> {
  return readJobMaterialsCostSnapshot(supabase, jobId)
}
