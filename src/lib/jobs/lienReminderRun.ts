/**
 * One reminder press, sent (punch list #365, PR 2): the calls behind a `LienReminderPlan`, for a screen that is
 * not the Lien desk. The desk's own press makes the same calls in the same order (`remindLeader` in
 * `LienDesk.tsx`): a notice is one message each, the affidavits are one message for the lot, and so are the
 * notices to sign. A reminder counts only when a message went (`lienReminderTally`), and the press keeps going
 * past one that fails and names it afterwards with its reason.
 */
import type { LienLeaderTellResult } from './lienAffidavitApprovalTell'
import { tellLeaderOfLienAffidavits, tellLeaderOfLienApproval, tellLeaderOfLienSignatures } from './lienDeskIo'
import type { LienReminderPlan } from './lienLeaderReminder'
import { lienReminderAffidavitLabel, lienReminderSignatureLabel, lienReminderTally, lienReminderTextOf } from './lienLeaderTold'

export type LienReminderTell = {
  approval: (itemId: string, dueYmd: string | null, opts: { remind: true }) => Promise<LienLeaderTellResult>
  affidavits: (papers: ReadonlyArray<{ itemId: string; dueYmd: string | null }>, opts: { remind: true }) => Promise<LienLeaderTellResult | null>
  signatures: (papers: ReadonlyArray<{ itemId: string; dueYmd: string | null }>) => Promise<LienLeaderTellResult | null>
}

const TELL: LienReminderTell = { approval: tellLeaderOfLienApproval, affidavits: tellLeaderOfLienAffidavits, signatures: tellLeaderOfLienSignatures }

export type LienReminderSent = {
  /** Papers a message went for. */
  done: number
  /** What did not send, each with its reason. */
  failed: Array<{ label: string; reason: string }>
  /** The reminder's text over the press: whether one went, and when none did, why. */
  text: { sent: boolean; why: string | null }
}

export async function sendLienReminder(plan: LienReminderPlan, tell: LienReminderTell = TELL): Promise<LienReminderSent> {
  let done = 0
  const failed: LienReminderSent['failed'] = []
  const answers: Array<LienLeaderTellResult | null> = []
  const heard = <R extends LienLeaderTellResult | null>(r: R): R => (answers.push(r), r)
  for (const p of plan.notices) {
    const t = lienReminderTally(heard(await tell.approval(p.itemId, p.dueYmd, { remind: true })), 1)
    done += t.done
    if (t.reason) failed.push({ label: p.label, reason: t.reason })
  }
  if (plan.affidavits.length > 0) {
    const t = lienReminderTally(heard(await tell.affidavits(plan.affidavits.map((p) => ({ itemId: p.itemId, dueYmd: p.dueYmd })), { remind: true })), plan.affidavits.length)
    done += t.done
    if (t.reason) failed.push({ label: lienReminderAffidavitLabel(plan.affidavits.map((p) => p.label), t.missed), reason: t.reason })
  }
  if (plan.signatures.length > 0) {
    const t = lienReminderTally(heard(await tell.signatures(plan.signatures.map((p) => ({ itemId: p.itemId, dueYmd: p.dueYmd })))), plan.signatures.length, 'signature')
    done += t.done
    if (t.reason) failed.push({ label: lienReminderSignatureLabel(plan.signatures.map((p) => p.label), t.missed), reason: t.reason })
  }
  return { done, failed, text: lienReminderTextOf(answers) }
}
