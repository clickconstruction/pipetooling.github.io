/**
 * Messages, cut 1's screens: every email the app already sent, read into the thread of each person it went to. A
 * read-side overlay over `sent_documents` (through `sentCopiesIo`), never rows written into `messages`: until the bids@
 * reader (cut 6) backfills them, a thread shows the sent copies beside its own lines. Pure.
 *
 * A copy lands on every contact with an address it went to, compared normalized. Its job is the copy's own: its bid,
 * else its first Pipeline job. Its id is `sent:<sent_documents.id>`, so the thread can tell an overlay line from a row
 * of its own (a tie, a highlight and a message window's tools act on rows only).
 */
import { normalizeChannel, type Contact } from '../contacts/kernel'
import type { SentCopy } from '../sent/sentCopies'
import { jobKey } from './load'
import type { ThreadMessage } from './thread'

/** The prefix an overlay line's id carries. */
export const SENT_LINE_PREFIX = 'sent:'

export function isSentLine(m: Pick<ThreadMessage, 'id'>): boolean {
  return m.id.startsWith(SENT_LINE_PREFIX)
}

/** A sent copy with the job ties the overlay reads. */
export type SentCopyWithJobs = Pick<SentCopy, 'id' | 'kind' | 'title' | 'how' | 'recipientEmails' | 'subject' | 'sentAt' | 'sentByName'> & {
  bidId?: string | null
  jobIds?: string[]
}

/** The emails among the copies, as thread lines on each person they went to, one per person per copy. */
export function sentLines(copies: readonly SentCopyWithJobs[], contacts: readonly Contact[]): ThreadMessage[] {
  const byAddress = new Map<string, { contactId: string; channelId: string }[]>()
  for (const c of contacts) {
    for (const ch of c.channels) {
      if (ch.kind !== 'email') continue
      const key = normalizeChannel('email', ch.value)
      if (key) byAddress.set(key, [...(byAddress.get(key) ?? []), { contactId: c.id, channelId: ch.id }])
    }
  }
  const lines: ThreadMessage[] = []
  for (const copy of copies) {
    if (copy.how !== 'email') continue
    const jobId = copy.bidId ? jobKey({ kind: 'bid', id: copy.bidId }) : copy.jobIds?.[0] ? jobKey({ kind: 'pipeline', id: copy.jobIds[0] }) : null
    const seen = new Set<string>()
    for (const address of copy.recipientEmails) {
      for (const hit of byAddress.get(normalizeChannel('email', address)) ?? []) {
        if (seen.has(hit.contactId)) continue
        seen.add(hit.contactId)
        lines.push({
          id: `${SENT_LINE_PREFIX}${copy.id}`,
          contactId: hit.contactId,
          jobId,
          channel: 'email',
          direction: 'out',
          at: copy.sentAt,
          who: copy.sentByName ? `${copy.sentByName} · the app` : 'the app',
          subject: copy.subject || copy.title,
          body: copy.title,
          channelId: hit.channelId,
        })
      }
    }
  }
  return lines
}
