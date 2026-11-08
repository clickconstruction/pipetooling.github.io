/**
 * The master's signing code on someone else's screen (punch list #150: v2.5791 the desk's footers, v2.6733 the run
 * window's amber card and the office's Ready footer). What every sign line that offers his code needs to know, from
 * the status the screen read: his first name, whether his code can be taken right now, the sentence a refused code
 * puts under the field, and whether that refusal means the status is stale. Pure; the desk, the run window and the
 * footers share it so the three lines say the same thing.
 */
import type { LienSignCodeStatus, SignLienDeskItemWithCodeResult } from './lienDeskSignIo'
import { lienSignatureWhen } from './lienNoticeSignature'

/** Who signs with a code on this screen, and whether his code can be taken right now. */
export type LienNoticeSignLineCodeSigner = {
  /** His first name, as the words use it: "Malachi signs here with his code". */
  firstName: string
  /** `ready` = he has a code; `none` = not set; `locked` = five wrong tries; `not_live` = the database side is not pushed; `loading` = still asking. */
  status: 'ready' | 'none' | 'locked' | 'not_live' | 'loading'
  /** "2:29 PM" while locked. */
  lockedUntilClock?: string | null
}

/** What a screen knows of his code: the status row, `not_live` when the RPC is missing, `loading` while asking, null before it asked. */
export type LienCodeStatusRead = LienSignCodeStatus | 'not_live' | 'loading' | null

/** "Malachi Whites" → "Malachi"; a blank name reads as the fallback. */
export function lienFirstName(name: string | null | undefined, fallback = 'The leader'): string {
  return (name ?? '').trim().split(/\s+/)[0] || fallback
}

/** The job has a master and he is not the one signed in here: the line is his, by his code or his hand. */
export function lienOtherScreen(masterUserId: string | null | undefined, viewerUserId: string | null | undefined): boolean {
  return Boolean(masterUserId && masterUserId !== viewerUserId)
}

/** The sign line's signer from the status the screen read. */
export function lienCodeSignerFrom(leaderName: string | null | undefined, status: LienCodeStatusRead): LienNoticeSignLineCodeSigner {
  const firstName = lienFirstName(leaderName)
  if (status === null || status === 'loading') return { firstName, status: 'loading', lockedUntilClock: null }
  if (status === 'not_live') return { firstName, status: 'not_live', lockedUntilClock: null }
  if (!status.set) return { firstName, status: 'none', lockedUntilClock: null }
  if (status.lockedUntilIso) return { firstName, status: 'locked', lockedUntilClock: lienSignatureWhen(status.lockedUntilIso).clock }
  return { firstName, status: 'ready', lockedUntilClock: null }
}

/** The sentence under the field after a refused code: the database's words, with the tries left after a wrong one. */
export function lienCodeRefusalWords(r: Extract<SignLienDeskItemWithCodeResult, { ok: false }>): string {
  if (r.reason === 'wrong' && r.triesLeft != null) return `${r.message} ${r.triesLeft} ${r.triesLeft === 1 ? 'try' : 'tries'} left.`
  return r.message
}

/** A refusal that changed what the status says (a lock, no code, not live): the screen reads it again. */
export function lienCodeStatusStale(reason: Extract<SignLienDeskItemWithCodeResult, { ok: false }>['reason']): boolean {
  return reason === 'locked' || reason === 'none' || reason === 'not_live'
}
