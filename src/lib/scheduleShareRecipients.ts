/**
 * Schedule → Share → Send now, the recipients (punch list #184, sweep A, PR 2). A picked person
 * with no email on file is held: listed with *no email on file* and a door to add one, while
 * the ones with an email send now. The button says both counts in the Lien run's shape,
 * *Send to 3 · 1 has no email ▸*, and is dead only when nobody picked has an email. Before this
 * the whole list went to `schedule-share-dispatch`, which skipped the ones with no email and
 * said nothing about who.
 */
import { batchOutcomeWords, batchWords, type BatchOutcome, type BatchWords } from './batchWords'

export type ShareRecipient = { id: string; name: string; email: string }

/** A picked person the send did not reach, and why. */
export type ShareRecipientFailure = { id: string; name: string; why: string }

/** The picked people, in pick order: who sends now and who is held for no email. A pick the list does not know is held too. */
export function shareRecipientSplit(selectedIds: readonly string[], users: ReadonlyMap<string, ShareRecipient>): { ready: ShareRecipient[]; held: ShareRecipient[] } {
  const ready: ShareRecipient[] = []
  const held: ShareRecipient[] = []
  for (const id of selectedIds) {
    const u = users.get(id)
    if (u && u.email.trim()) ready.push(u)
    else held.push(u ?? { id, name: '', email: '' })
  }
  return { ready, held }
}

/** The Send now button: *Send to 3 · 1 has no email ▸*; *Send now*, dead, while nobody is picked. */
export function shareSendWords(split: { ready: readonly unknown[]; held: readonly unknown[] }): BatchWords {
  if (split.ready.length === 0 && split.held.length === 0) return { button: 'Send now', foot: null, dead: true }
  const w = batchWords({ verb: 'Send to', ready: split.ready.length, held: split.held.length, heldWhy: { one: 'has no email', many: 'have no email' } })
  // Nobody picked has an email: the press keeps its name, dead, and the ▸ points at the held chips.
  return split.ready.length === 0 ? { ...w, button: 'Send now ▸' } : w
}

/** The name a chip or a line shows: the name, else the email, else the id's tail. */
export function shareRecipientLabel(r: Pick<ShareRecipient, 'id' | 'name' | 'email'>): string {
  return r.name.trim() || r.email.trim() || r.id.slice(-8)
}

/** `schedule-share-dispatch`'s per-person results → the people the send did not reach, with the function's reason. */
export function shareSendFailures(results: unknown, users: ReadonlyMap<string, ShareRecipient>): ShareRecipientFailure[] {
  if (!Array.isArray(results)) return []
  const out: ShareRecipientFailure[] = []
  for (const r of results as Array<{ recipientUserId?: unknown; ok?: unknown; error?: unknown }>) {
    if (r?.ok === true || typeof r?.recipientUserId !== 'string') continue
    const id = r.recipientUserId
    const u = users.get(id)
    out.push({ id, name: u ? shareRecipientLabel(u) : id.slice(-8), why: typeof r.error === 'string' && r.error.trim() ? r.error.trim() : 'The email did not send.' })
  }
  return out
}

/** The toast after a send: *Sent 3. 1 did not send.* */
export function shareSendOutcome(sent: number, failed: number): BatchOutcome {
  return batchOutcomeWords({ verb: 'send', past: 'sent', done: sent, failed, noun: 'email' })
}
