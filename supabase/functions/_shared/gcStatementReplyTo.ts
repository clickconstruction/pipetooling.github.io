/**
 * Where a GC's replies go (punch list #49, step 4). An assistant sends the
 * statement; the account man knows the account. So the sender may name him as
 * the reply-to — his address answers the GC's "Reply", and she is copied so
 * the thread reaches the office too. One rule, run by the edge function and
 * read by the client (no mirror): src/lib/gcStatementReplyTo.ts re-exports it.
 */

export const REPLY_TO_ROLES = ['dev', 'master_technician', 'assistant', 'controller', 'primary'] as const

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type ReplyToPerson = { id: string; name?: string | null; email?: string | null; role?: string | null }

export type StatementReplyTo =
  | { ok: true; replyTo: string | null; replyToName: string; cc: string[]; onBehalf: boolean }
  | { ok: false; error: string }

/** Someone who can take a GC's replies: an office role with an address. */
export function canTakeStatementReplies(person: ReplyToPerson | null | undefined): boolean {
  if (!person) return false
  return (REPLY_TO_ROLES as readonly string[]).includes(String(person.role ?? '')) && EMAIL.test((person.email ?? '').trim())
}

/**
 * The reply-to and the CC list for one send. No one named, or the sender
 * named: replies go to the sender, as they always have. Someone else named:
 * replies go to them and the sender is copied — unless she is already the To
 * or on the CC, and never past the CC cap.
 */
export function resolveStatementReplyTo(input: {
  sender: ReplyToPerson
  /** The person named to take replies; null/undefined = the sender. */
  replyToPerson?: ReplyToPerson | null
  /** True when a reply_to_user_id was sent but no such person could be read. */
  replyToMissing?: boolean
  toEmail: string
  ccEmails: readonly string[]
  ccMax?: number
}): StatementReplyTo {
  const senderEmail = (input.sender.email ?? '').trim()
  const senderName = (input.sender.name ?? '').trim()
  const cc = [...input.ccEmails]
  if (input.replyToMissing) return { ok: false, error: 'The person named to take replies was not found.' }
  const named = input.replyToPerson
  if (!named || named.id === input.sender.id) {
    return { ok: true, replyTo: EMAIL.test(senderEmail) ? senderEmail : null, replyToName: senderName, cc, onBehalf: false }
  }
  if (!canTakeStatementReplies(named)) {
    return { ok: false, error: `${(named.name ?? '').trim() || 'That person'} has no email on file to take replies.` }
  }
  const to = input.toEmail.trim().toLowerCase()
  const sender = senderEmail.toLowerCase()
  if (EMAIL.test(sender) && sender !== to && !cc.some((e) => e.toLowerCase() === sender) && cc.length < (input.ccMax ?? 10)) cc.push(sender)
  return { ok: true, replyTo: (named.email ?? '').trim(), replyToName: (named.name ?? '').trim(), cc, onBehalf: true }
}

/** Who takes replies by default: the GC's account man when he can and is not the sender; otherwise the sender. */
export function defaultReplyToUserId(senderId: string, accountMan: ReplyToPerson | null | undefined): string {
  return accountMan && accountMan.id !== senderId && canTakeStatementReplies(accountMan) ? accountMan.id : senderId
}

/**
 * What the sender is told after a send. An edge function from before this
 * rule echoes no reply_to — the statement went, and replies came to her.
 */
export function describeReplyToOutcome(asked: { id: string; name: string } | null, senderId: string, echoedReplyTo: string | null | undefined): string {
  if (!asked || asked.id === senderId) return ''
  if (echoedReplyTo == null) return ` Replies will come to you — sending on ${asked.name}’s behalf is not switched on yet.`
  return ` Replies go to ${asked.name}; you are copied.`
}
