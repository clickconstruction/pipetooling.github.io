/**
 * Messages, cut 6 (email in): how far one run of the bids@ reader (`gmail-sync`) got through Gmail's history, and where
 * the next run starts. The records come oldest first, each with the messages it added to the Inbox and, since v2.5982,
 * the messages that reached the Inbox by a label change (out of Spam, out of a filter's hold: the owner's own reply on
 * 2026-10-26 sat in Primary unread by the app because Gmail never recorded it as added). The point moves past a record
 * only once every message in it was taken, so a run stopped by a failure, or by its cap, leaves the point at the last
 * record it took whole, and the next run starts there. What it already took is passed over then by its label. Reading
 * every page moves the point to the box's newest. Pure: the function passes Gmail's calls in.
 */

export interface HistoryRecord {
  id: string
  messagesAdded?: { message: { id: string } }[]
  /** A label put on a message after it arrived; the Inbox's among them is a message that reached the Inbox late. */
  labelsAdded?: { message: { id: string }; labelIds?: string[] }[]
}

/** The Gmail label a record's label change must carry for the message to count as reaching the Inbox. */
export const INBOX_LABEL = 'INBOX'

/** The messages one record brought to the Inbox: added, or given the Inbox label, each once. */
export function recordMessageIds(record: Omit<HistoryRecord, 'id'> & { id?: string }): string[] {
  const ids: string[] = []
  for (const added of record.messagesAdded ?? []) if (!ids.includes(added.message.id)) ids.push(added.message.id)
  for (const labelled of record.labelsAdded ?? []) {
    if (!(labelled.labelIds ?? []).includes(INBOX_LABEL)) continue
    if (!ids.includes(labelled.message.id)) ids.push(labelled.message.id)
  }
  return ids
}

export interface HistoryPage {
  history?: HistoryRecord[]
  nextPageToken?: string
  /** The box's history point as of this page. */
  historyId?: string
}

/** What became of one message: written, passed over as taken before, left out, or gone from the box. */
export type Took = 'taken' | 'already' | 'left' | 'gone'

export interface HistoryWalk {
  /** Where the next run starts. */
  cursor: string
  counts: Record<Took, number>
  /** The run stopped at its cap: the next run takes the rest. */
  full: boolean
  /** What stopped the run, when a message failed. */
  error: unknown
}

/**
 * Walks the history after `start` through `page` (a page by its token) and `take` (one message), at most `max`
 * messages. A page that fails throws to the caller, with nothing taken past the point; a message that fails stops the
 * walk and answers with the error.
 */
export async function walkHistory(
  start: string,
  page: (pageToken?: string) => Promise<HistoryPage>,
  take: (messageId: string) => Promise<Took>,
  max: number,
): Promise<HistoryWalk> {
  const counts: Record<Took, number> = { taken: 0, already: 0, left: 0, gone: 0 }
  let cursor = start
  let read = 0
  let newest: string | undefined
  let pageToken: string | undefined
  do {
    const p = await page(pageToken)
    newest = p.historyId ?? newest
    for (const record of p.history ?? []) {
      for (const id of recordMessageIds(record)) {
        if (read >= max) return { cursor, counts, full: true, error: null }
        read++
        try {
          counts[await take(id)]++
        } catch (e) {
          return { cursor, counts, full: false, error: e }
        }
      }
      cursor = record.id
    }
    pageToken = p.nextPageToken
  } while (pageToken)
  return { cursor: newest ?? cursor, counts, full: false, error: null }
}
