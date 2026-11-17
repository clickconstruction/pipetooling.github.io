import { lienAffidavitToldWords, lienTellFailureReason, type LienLeaderTellResult, type LienLeaderTold } from './lienAffidavitApprovalTell'

/**
 * What the office reads after it asks the leader to look at a paper (v2.7445): the notice's send for approval, and
 * the To do view's Remind press.
 *
 * Until now the notice's tell threw, the send for approval caught it and said *will see it on the Dashboard*, and the
 * office never learned that the message had not gone. A reminder counted every answer of the function as a reminder
 * sent, though the function answers 200 when it sends nothing. Pure: the words and the count, from what the function
 * answered or why it could not be asked. The asking is `tellLeaderOfLienApproval` and `tellLeaderOfLienAffidavits`.
 */

/** The leader by first name as a sentence names them, or *the leader*. */
function leaderWord(name: string | null | undefined): string {
  const first = (name ?? '').trim().split(/\s+/)[0] ?? ''
  return first ? `${first[0]!.toUpperCase()}${first.slice(1)}` : 'the leader'
}

/**
 * After **Send for approval** on a notice. The paper is sent whatever the tell did. A tell that reached the leader
 * says which way, in the words an affidavit's send uses. A tell that failed says so with its reason, so the office
 * knows to tell the leader another way. `leaderName` is the job's leader as the desk knows them, for the sentence a
 * failed tell needs: the function never answered, so it named nobody.
 */
export function lienNoticeToldWords(result: LienLeaderTellResult, leaderName?: string | null): { said: string; tone: 'success' | 'warning' } {
  if (result.ok) return { said: lienAffidavitToldWords(result), tone: 'success' }
  const who = leaderWord(leaderName)
  return { said: `Sent for approval. The message to ${who} did not go. ${lienTellFailureReason(result.reason)} The paper is on the Dashboard. Tell ${who} another way.`, tone: 'warning' }
}

/**
 * Why a message the function took reached no phone and no inbox, or null when it reached the leader. The function
 * answers 200 for each of these and sends nothing, so the answer alone is not a message sent.
 */
export function lienTellMissReason(told: LienLeaderTold): string | null {
  if (told.pushSent > 0 || told.emailSent || (told.textSent ?? 0) > 0) return null
  const said = (told.said ?? '').trim().toLowerCase()
  if (said === 'not awaiting approval') return 'not waiting for approval now'
  if (said === 'not waiting on a signature') return 'not waiting on a signature now'
  if (said === 'no leader to tell') return 'no leader to tell'
  if ((told.held ?? 0) > 0) return 'outside the leader’s Push me hours, so it waits on the Dashboard'
  return 'no phone set up and no email sent'
}

/**
 * One call of a reminder, counted: how many of the `asked` papers the leader was reminded of, how many not, and why
 * not. A notice is one paper a call. The affidavits are one call for the lot, and the function says how many of them
 * it told the leader of (`told`), so a paper approved since the list was drawn is not counted as a reminder sent.
 * The notices to sign are one call for the lot too (v2.7491): `waits` then names what a missed one no longer waits on.
 */
export function lienReminderTally(result: LienLeaderTellResult | null, asked: number, waits: 'approval' | 'signature' = 'approval'): { done: number; missed: number; reason: string | null } {
  if (asked <= 0) return { done: 0, missed: 0, reason: null }
  if (!result) return { done: 0, missed: asked, reason: 'the message could not be sent' }
  if (!result.ok) return { done: 0, missed: asked, reason: lienTellFailureReason(result.reason).replace(/[.?!]+$/, '') }
  const miss = lienTellMissReason(result.told)
  if (miss) return { done: 0, missed: asked, reason: miss }
  const told = result.told.told
  const done = typeof told === 'number' && Number.isFinite(told) ? Math.max(0, Math.min(asked, Math.floor(told))) : asked
  return done < asked ? { done, missed: asked - done, reason: waits === 'signature' ? 'not waiting on a signature now' : 'not waiting for approval now' } : { done, missed: 0, reason: null }
}

/**
 * A reminder's text, over every call of one press (v2.7495): whether a text went, and when none did, why not. A
 * reminder goes as a text beside the push or the email, so a press can reach the leader and still send no text; the
 * office reads the reason and can fix it (his mobile number, the Send texts switch). `why` is null when a text went,
 * when no call was answered with the text's fields (the function as it was), or when nothing was meant to be texted.
 */
export function lienReminderTextOf(results: ReadonlyArray<LienLeaderTellResult | null>): { sent: boolean; why: string | null } {
  let sent = false
  let why: string | null = null
  for (const r of results) {
    if (!r || !r.ok) continue
    if ((r.told.textSent ?? 0) > 0) sent = true
    else why = why ?? ((r.told.textSaid ?? '').trim() || null)
  }
  return sent ? { sent, why: null } : { sent, why }
}

/** The papers a reminder's one call missed, as the outcome names them: the paper, the lot, or how many of the lot. */
function lotLabel(labels: ReadonlyArray<string>, missed: number, lot: string): string {
  const n = labels.length
  if (n === 1) return labels[0]!
  return missed >= n ? `the ${n} ${lot}` : `${missed} of the ${n} ${lot}`
}

/** The affidavits a reminder's one call missed. */
export function lienReminderAffidavitLabel(labels: ReadonlyArray<string>, missed: number): string {
  return lotLabel(labels, missed, 'affidavits')
}

/** The notices to sign a reminder's one call missed (v2.7491). */
export function lienReminderSignatureLabel(labels: ReadonlyArray<string>, missed: number): string {
  return lotLabel(labels, missed, 'notices to sign')
}
