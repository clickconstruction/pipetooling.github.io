/**
 * Clearing a person's day on the Schedule Dispatch hub: "Not coming in" and
 * no-call-no-show both delete every block the person had that day, all at
 * once, and report how many went and how many did not.
 */
import { deleteJobScheduleBlock } from '../jobScheduleBlocks'

export type RemovePersonDayBlocksResult = { removed: number; failed: number }

export async function removePersonDayBlocks(blockIds: readonly string[]): Promise<RemovePersonDayBlocksResult> {
  if (blockIds.length === 0) return { removed: 0, failed: 0 }
  const settled = await Promise.all(
    blockIds.map(async (id) => {
      const { error } = await deleteJobScheduleBlock(id)
      return { id, error }
    }),
  )
  const removed = settled.filter((r) => !r.error).length
  return { removed, failed: settled.length - removed }
}
