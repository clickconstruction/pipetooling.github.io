import type { LienSubmitOutcome } from './lienDesk'

/**
 * Telling the leader that an affidavit waits for him (punch list #305, v2.7180). A notice sent for approval has told
 * him since v2.4872 (`tellLeaderOfLienApproval`); an affidavit told nobody, so the paper waited until he opened the
 * desk or the Dashboard. Pure: which papers of a press the leader is told of, and the words the office reads after.
 *
 * One press is one call, so a batch of twelve is one message that names the count (`lienAffidavitApprovalPush`,
 * shared with `notify-lien-approval`). The tell is best effort and comes after the write: a tell that fails never
 * undoes or blocks the send for approval, and the office reads why.
 */

/** What `notify-lien-approval` answered for one press. */
export type LienLeaderTold = { pushSent: number; emailSent: boolean; leaderName: string | null }

/** The tell as the office hears of it: what the function answered, or why it could not be asked. */
export type LienLeaderTellResult = { ok: true; told: LienLeaderTold } | { ok: false; reason: string }

/**
 * The papers of a press the leader is told of: the ones the send landed in Awaiting approval. A paper a standing
 * rule approved or held is not his to decide, and one whose send failed is still a draft.
 */
export function lienAffidavitTellPapers<P extends { jobId: string; outcome: LienSubmitOutcome }>(sent: ReadonlyArray<P>, doneJobIds: ReadonlyArray<string>): P[] {
  const done = new Set(doneJobIds)
  return sent.filter((p) => done.has(p.jobId) && p.outcome.status === 'awaiting_approval')
}

/**
 * Why the tell failed, in words the office can read. `Missing item_id` is the answer of the function as it was before
 * it learned the affidavit: until it is redeployed it refuses the new request, and the paper is still sent.
 */
export function lienTellFailureReason(raw: string | null | undefined): string {
  const said = (raw ?? '').trim()
  if (!said) return 'The message could not be sent.'
  if (/^missing item_id$/i.test(said)) return 'The part of the app that tells the leader is waiting for its update.'
  return /[.?!]$/.test(said) ? said : `${said}.`
}

const leaderWord = (name: string | null | undefined) => {
  const first = (name ?? '').trim().split(/\s+/)[0] || 'the leader'
  return `${first[0]!.toUpperCase()}${first.slice(1)}`
}

/**
 * After the pane's **Send for approval ▸** on one affidavit: which way it reached the leader, in the words the notice
 * send uses (`leaderToldWords`), or that he was not told and why.
 */
export function lienAffidavitToldWords(result: LienLeaderTellResult | null): string {
  if (result && !result.ok) return `Sent for approval. The leader was not told. ${lienTellFailureReason(result.reason)} The paper is on the Dashboard.`
  const told = result?.told ?? null
  const who = leaderWord(told?.leaderName)
  if (told && told.pushSent > 0) return `Sent for approval. ${who}'s phone has it.`
  if (told?.emailSent) return `Sent for approval. ${who} has it by email.`
  return `Sent for approval. ${who} will see it on the Dashboard.`
}

/**
 * After the list's **Send N for approval…**: the sentence that follows the count of what was sent. `asked` is how
 * many went to the leader; none, and there is nothing to say. Twelve are one message, and the sentence says so.
 */
export function lienAffidavitBatchToldWords(result: LienLeaderTellResult | null, asked: number): string {
  if (asked <= 0) return ''
  const wait = asked === 1 ? 'the 1 that waits for approval' : `the ${asked} that wait for approval`
  const once = asked === 1 ? '' : ' in one message'
  if (result && !result.ok) return `The leader was not told of ${wait}. ${lienTellFailureReason(result.reason)} The Dashboard shows ${asked === 1 ? 'it' : 'them'}.`
  const told = result?.told ?? null
  const who = leaderWord(told?.leaderName)
  if (told && told.pushSent > 0) return `${who}'s phone has ${wait}${once}.`
  if (told?.emailSent) return `${who} has ${wait} by email${once}.`
  return `${who} will see ${wait} on the Dashboard.`
}
