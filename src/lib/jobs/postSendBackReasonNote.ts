import { postJobThreadNoteBody } from './postJobThreadNote'
import { composeSendBackNoteBody } from './jobSendBackNote'

/**
 * Records the send-back reason as a job thread note right after a successful
 * RTB → Working move (v2.2065). Best-effort: the status change already
 * happened, so a note failure must not roll the flow back — callers toast a
 * warning on false so the office can drop the reason in Job activity by hand.
 */
export async function postSendBackReasonNote(
  jobId: string,
  authorUserId: string | undefined | null,
  reason: string,
): Promise<boolean> {
  if (!authorUserId) return false
  return postJobThreadNoteBody(jobId, authorUserId, composeSendBackNoteBody(reason))
}
