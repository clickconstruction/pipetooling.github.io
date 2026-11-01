/**
 * Messages → My email (punch list #230 PR 3): what the tab borrows from the page's view of Messages
 * (`useMessagesHost`, read while the tab is open, as for Everyone). The job picker lists *their jobs* first, as *Tie
 * to* does on a thread: the jobs on the rail of every person an address is theirs of (`contact_channels`, read
 * case-blind). And the thread a tagged line sits on, so *open the thread ›* lands at the line. Pure.
 */
import { normalizeChannel } from '../contacts/kernel'
import type { JobTile } from '../messages/jobTiles'
import type { MessagesView } from '../messages/messagesIo'

/** The jobs on the rail of whoever holds this address, in their rails' order, each once. None while the view is not read. */
export function jobsOfAddress(view: Pick<MessagesView, 'contacts' | 'rails' | 'tiles'> | null, address: string): JobTile[] {
  const want = address.trim() ? normalizeChannel('email', address) : ''
  if (!view || !want) return []
  const keys: string[] = []
  for (const c of view.contacts) {
    if (!c.channels.some((ch) => ch.kind === 'email' && normalizeChannel('email', ch.value) === want)) continue
    for (const key of view.rails[c.id] ?? []) if (!keys.includes(key)) keys.push(key)
  }
  return keys.map((k) => view.tiles[k]).filter((t): t is JobTile => Boolean(t))
}

/** The person a line sits on, from the view, or null while the view is not read or does not hold the line yet. */
export function contactOfLine(view: Pick<MessagesView, 'messages'> | null, messageId: string): string | null {
  return view?.messages.find((m) => m.id === messageId)?.contactId ?? null
}
