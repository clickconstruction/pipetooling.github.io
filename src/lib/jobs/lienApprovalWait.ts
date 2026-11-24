/**
 * Who a drafted lien paper waits on, in one place (punch list #335, Also seen).
 *
 * A notice or an affidavit sent for approval read two ways. The billed row and the Lien desk's row named the
 * leader, *Waiting on Rosa*. The header above the paper said *Waiting on us* and then *the leader’s approval of
 * the notice*, so the person reading it still had to work out who. The row's name and the header's line now come
 * from here: the act table (`lienActWords.ts`) reads `lienLeaderWords` and the path (`lienTimeline.ts`) reads
 * `lienApprovalWaitWords`.
 *
 * The name is the one the app has for the job's leader, the same one the row prints. With no name the words are
 * the old ones, *the leader*, so a reader that cannot know who leads the job (the firm's page, the desk's Timeline
 * tab) reads as before. A leader reading a paper that waits on him reads *your approval*.
 *
 * `lienApproverFor` is the row's own rule for whose approval it is (`buildLienNextUp`): a leader's own job, or a
 * job with no leader set, waits on the leader who is looking. Pure.
 */
import { isLienLeader } from './lienDesk'
import { lienOtherScreen } from './lienCodeSigner'

export type LienApprovalPaper = 'notice' | 'affidavit'

/** The leader a drafted paper waits on, as a builder of the path is handed him. */
export type LienApprover = {
  /** The name the app has for the job's leader; blank reads *the leader*. */
  name?: string | null
  /** The person looking is the leader the paper waits on. */
  yours?: boolean
}

/** The leader by name, as the row prints him; *the leader* when the name is not known. */
export function lienLeaderWords(name?: string | null): string {
  return name?.trim() || 'the leader'
}

/** What a paper sent for approval waits on, for the *Waiting on* line: *Rosa’s approval of the notice*. */
export function lienApprovalWaitWords(paper: LienApprovalPaper, approver?: LienApprover | null): string {
  if (approver?.yours) return `your approval of the ${paper}`
  return `${lienLeaderWords(approver?.name)}’s approval of the ${paper}`
}

/** Whose approval a job's paper waits on, from what a screen holds: the leader's name, the job's leader and the person looking. */
export function lienApproverFor(f: { leaderName?: string | null; masterUserId?: string | null; viewerUserId?: string | null; role?: string | null }): LienApprover {
  return { name: f.leaderName?.trim() || null, yours: isLienLeader(f.role) && !lienOtherScreen(f.masterUserId, f.viewerUserId) }
}
