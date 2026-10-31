/**
 * **Send as task** on a thread's ⋯ (v2.6228, from the bids-inbox sorting review of 2026-10-31): an email that is a
 * chore rather than a conversation, a W-9 or a certificate of insurance asked for, goes to someone's Checklist the way a
 * job does, the Add-task dialog's bar carrying the thread instead of a job (`checklistJobPreset.ts`, v2.3751). The
 * stored task reads `{{1:Email · Dale Ferris · W-9 needed}} — <typed>` and link [1] opens the thread at the line. Pure.
 */
import type { ChecklistJobPreset } from '../checklistJobPreset'
import { messagesThreadHref } from '../gc/links'
import { channelWord, snippetOf, type ThreadMessage } from './thread'

/** The bar's name is clipped so the stored title stays a line. */
export const THREAD_TASK_NAME_MAX = 80

/** The menu row's words. */
export const SEND_AS_TASK = { label: 'Send as task', tip: 'Opens Add a task with this thread on it. The task links back here.' } as const

const clip = (s: string, max: number): string => (s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`)

/**
 * The dialog preset for a thread: the bar's number is the line's channel word (*Email*, *Text*, *Thread* with no
 * line), its name the person and the line's words, the company under it, and link [1] the thread at the line.
 */
export function threadTaskPreset(
  contact: { id: string; name: string; company?: string | null },
  line: Pick<ThreadMessage, 'id' | 'channel' | 'subject' | 'body'> | null,
  origin: string,
): { title: string; links: string[]; job: ChecklistJobPreset } {
  const path = messagesThreadHref(contact.id, line?.id ?? null)
  const words = line ? snippetOf(line).replace(/\s+/g, ' ').trim() : ''
  const name = clip(`${contact.name.trim() || 'A conversation'}${words ? ` · ${words}` : ''}`, THREAD_TASK_NAME_MAX)
  const job: ChecklistJobPreset = {
    id: contact.id,
    number: line ? channelWord(line) : 'Thread',
    name,
    trade: null,
    address: null,
    customer: contact.company?.trim() || null,
    path,
    url: `${origin}${path}`,
  }
  return { title: '', links: [job.url], job }
}

/** Their newest line in, as the thread lists lines oldest first. Null when they have none. */
export function newestLineIn<T extends { contactId: string; direction: string }>(lines: readonly T[], contactId: string): T | null {
  let found: T | null = null
  for (const l of lines) if (l.contactId === contactId && l.direction === 'in') found = l
  return found
}
