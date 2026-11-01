/**
 * Messages, cut 6 (email in): Gmail's REST API as the bids@ reader (`gmail-sync`) calls it, as the impersonated mailbox
 * (`users/me` under domain-wide delegation). Read the profile and the history since a point, search, read one message
 * and one attachment, find or make a label, and add a label to a message. Nothing here deletes, archives, moves or
 * marks a message read. Since punch list #230 PR 2 also the My email tab's calls (`gmail-mine`, as the signed-in
 * person's own mailbox): a page of a search, a message raw, a conversation whole or by its headers, and a label taken
 * off a message.
 */
import type { GmailMessage } from './gcKernels/lib/emailIn/gmailMessage.ts'
import type { GmailThreadMeta } from './gcKernels/lib/emailIn/labelSweep.ts'

/** Reading the box and adding a label: `gmail.modify` covers both. The delegation grants it on the Workspace. */
export const GMAIL_SCOPES: readonly string[] = ['https://www.googleapis.com/auth/gmail.modify']
/**
 * Counting a box's labels for Quickfill's Email station (`gmail-count`, v2.5820): labels, counts, thread ids, dates and
 * the headers From, Subject and Date. Google refuses a body, an attachment and a `q` search under it, so the "never the
 * words" promise is Google's. Granted on the Workspace beside the reader's (the admin step of punch list #159).
 */
export const GMAIL_METADATA_SCOPES: readonly string[] = ['https://www.googleapis.com/auth/gmail.metadata']

const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me'

/** A Gmail call that failed, with its status: 404 on a history point Gmail no longer keeps, or a message gone. */
export class GmailError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function call<T>(token: string, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${GMAIL}${path}`, {
    method: init.method ?? 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new GmailError(res.status, `Gmail ${path.split('?')[0]} failed (${res.status}): ${body?.error?.message ?? 'unknown'}`)
  return body as T
}

const q = (params: Record<string, string | undefined>): string =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
    .join('&')

/** The mailbox's newest history point: where a first run starts, with nothing read before it. */
export function gmailProfile(token: string): Promise<{ emailAddress: string; historyId: string }> {
  return call(token, '/profile')
}

export interface GmailHistoryPage {
  history?: {
    id: string
    messagesAdded?: { message: { id: string; labelIds?: string[] } }[]
    /** A label put on a message after it arrived (v2.5982): the Inbox's marks a message that reached the Inbox late. */
    labelsAdded?: { message: { id: string; labelIds?: string[] }; labelIds?: string[] }[]
  }[]
  nextPageToken?: string
  /** The mailbox's history point as of this page. */
  historyId?: string
}

/**
 * The Inbox's new messages since a history point, a page at a time, oldest first: the messages added to it, and since
 * v2.5982 the ones given its label later (out of Spam, out of a filter's hold). 404 when Gmail no longer keeps the point.
 */
export function gmailHistory(token: string, startHistoryId: string, pageToken?: string): Promise<GmailHistoryPage> {
  return call(token, `/history?${q({ startHistoryId, historyTypes: 'messageAdded', labelId: 'INBOX', maxResults: '100', pageToken })}&historyTypes=labelAdded`)
}

/** Messages a Gmail search finds, a page at a time. */
export function gmailSearch(token: string, query: string, pageToken?: string): Promise<{ messages?: { id: string }[]; nextPageToken?: string }> {
  return call(token, `/messages?${q({ q: query, maxResults: '100', pageToken })}`)
}

/** One message, whole (`format=full`): what `readGmailMessage` reads. */
export function gmailMessage(token: string, id: string): Promise<GmailMessage> {
  return call(token, `/messages/${encodeURIComponent(id)}?format=full`)
}

/** One attachment's bytes, base64url. */
export function gmailAttachment(token: string, messageId: string, attachmentId: string): Promise<{ size?: number; data?: string }> {
  return call(token, `/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`)
}

/** The id of the label named `name`, made when the box has none. */
/**
 * Send a message as the mailbox (the walk kit's reply from bids@, punch list #142 PR 7): `raw` is the RFC 2822 message
 * as base64url, `threadId` keeps it in the estimate email's thread. Needs `gmail.modify` or `gmail.send`.
 */
export function gmailSend(token: string, raw: string, threadId?: string | null): Promise<{ id: string; threadId: string; labelIds?: string[] }> {
  return call(token, '/messages/send', { method: 'POST', body: { raw, ...(threadId ? { threadId } : {}) } })
}

export async function gmailLabelId(token: string, name: string): Promise<string> {
  const { labels } = await call<{ labels?: { id: string; name: string }[] }>(token, '/labels')
  const found = labels?.find((l) => l.name === name)
  if (found) return found.id
  const made = await call<{ id: string }>(token, '/labels', { method: 'POST', body: { name, labelListVisibility: 'labelShow', messageListVisibility: 'show' } })
  return made.id
}

/** Adds a label to a message. Nothing else about the message changes. */
export async function gmailAddLabel(token: string, messageId: string, labelId: string): Promise<void> {
  await call(token, `/messages/${encodeURIComponent(messageId)}/modify`, { method: 'POST', body: { addLabelIds: [labelId] } })
}

// ---- the counter's calls (gmail-count, v2.5820): read only, under the metadata scope ----

/** The box's labels: the system ones (INBOX) and the person's own, by id and name. */
export function gmailLabels(token: string): Promise<{ labels?: { id: string; name: string }[] }> {
  return call(token, '/labels')
}

/** One label with Gmail's own counts: `threadsTotal` is the live count, exact however big the box. */
export function gmailLabelCounts(token: string, labelId: string): Promise<{ id: string; name: string; messagesTotal?: number; threadsTotal?: number }> {
  return call(token, `/labels/${encodeURIComponent(labelId)}`)
}

/** The threads in a label, a page of 100 at a time, newest first. */
export function gmailThreadsByLabel(token: string, labelId: string, pageToken?: string): Promise<{ threads?: { id: string }[]; nextPageToken?: string; resultSizeEstimate?: number }> {
  return call(token, `/threads?${q({ labelIds: labelId, maxResults: '100', pageToken })}`)
}

/** One thread's metadata: its messages' ids and dates and the headers From, Subject and Date. Never the words. */
export function gmailThread(token: string, threadId: string): Promise<GmailThreadMeta> {
  return call(token, `/threads/${encodeURIComponent(threadId)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`)
}

// ---- the My email tab's calls (gmail-mine, punch list #230 PR 2): the person's own box, under gmail.modify ----

/** A conversation as `users.threads.get` answers it: its messages oldest first, each with Gmail's snippet. */
export interface GmailThread {
  id: string
  historyId?: string
  messages?: (GmailMessage & { snippet?: string })[]
}

/** One page of a Gmail search, newest first: up to `maxResults` ids, and the next page's token while there is more. */
export function gmailMessagePage(token: string, query: string, maxResults: number, pageToken?: string): Promise<{ messages?: { id: string; threadId?: string }[]; nextPageToken?: string; resultSizeEstimate?: number }> {
  return call(token, `/messages?${q({ q: query, maxResults: String(maxResults), pageToken })}`)
}

/** One message as sent, the whole RFC 2822 mail in base64url (`format=raw`): the court-ready copy. */
export function gmailMessageRaw(token: string, id: string): Promise<{ id: string; threadId?: string; raw?: string; sizeEstimate?: number }> {
  return call(token, `/messages/${encodeURIComponent(id)}?format=raw`)
}

/** A conversation whole (`format=full`): what `readGmailMessage` reads, mail by mail. */
export function gmailThreadFull(token: string, threadId: string): Promise<GmailThread> {
  return call(token, `/threads/${encodeURIComponent(threadId)}?format=full`)
}

/** A conversation by its headers alone (`format=metadata`), each header named; Gmail sends only those. */
export function gmailThreadHeaders(token: string, threadId: string, headers: readonly string[]): Promise<GmailThread> {
  const asked = headers.map((h) => `&metadataHeaders=${encodeURIComponent(h)}`).join('')
  return call(token, `/threads/${encodeURIComponent(threadId)}?format=metadata${asked}`)
}

/** Takes a label off a message. Nothing else about the message changes. */
export async function gmailRemoveLabel(token: string, messageId: string, labelId: string): Promise<void> {
  await call(token, `/messages/${encodeURIComponent(messageId)}/modify`, { method: 'POST', body: { removeLabelIds: [labelId] } })
}
