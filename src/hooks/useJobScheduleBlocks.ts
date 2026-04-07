/**
 * Job schedule blocks: prefer importing from {@link ../lib/jobScheduleBlocks}
 * for tree-shaking. This module exists as the plan hook entry point.
 */
export {
  deleteJobScheduleBlock,
  fetchJobScheduleBlocksForJobDay,
  fetchScheduleBlocksForAssigneeDateRange,
  fetchScheduleBlocksForAssigneesOnDay,
  insertJobScheduleBlock,
  updateJobScheduleBlock,
  type JobScheduleBlockRow,
} from '../lib/jobScheduleBlocks'
