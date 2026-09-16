/**
 * The review room, office side (Submittals stage 4a): the link, the token, the words
 * the tab uses for the trail. The room's payload shapes and the customer's words live
 * in the shared kernel (`supabase/functions/_shared/submittalRoomPayload.ts`) so the
 * edge function and the page agree.
 */
import type { Database } from '../../types/database'
import { asRoomRole, ROOM_ROLE_LABELS, type RoomRole, type SubmittalRoomPayload, type RoomMessage} from '../../../supabase/functions/_shared/submittalRoomPayload'

export type SubmittalRoomRow = Database['public']['Tables']['bid_submittal_rooms']['Row']
export type SubmittalPersonRow = Database['public']['Tables']['bid_submittal_people']['Row']
export type SubmittalEventRow = Database['public']['Tables']['bid_submittal_events']['Row']

export { asRoomRole, ROOM_ROLE_LABELS }
export type { RoomRole }

/** 48 hex characters — the Bid Room's token shape. */
export function newRoomToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** The page every token opens: /submittal?t=… */
export function roomLink(origin: string, token: string): string {
  return `${origin.replace(/\/$/, '')}/submittal?t=${encodeURIComponent(token)}`
}

export type PersonHow = 'named' | 'identified' | 'forwarded'
export function asPersonHow(v: string | null | undefined): PersonHow {
  return v === 'named' || v === 'forwarded' ? v : 'identified'
}

/** "named by you" · "identified herself via the room link" · "identified via a forwarded link". */
export function describeHow(how: PersonHow): string {
  return how === 'named' ? 'named by you' : how === 'forwarded' ? 'identified via a forwarded link' : 'identified via the room link'
}

export type PersonTrail = {
  opened: number
  lastOpenedAt: string | null
  decided: number
  asked: number
}

/** One person's trail from the events (views, decisions, replies) and the items they decided. */
export function personTrail(personId: string, events: ReadonlyArray<Pick<SubmittalEventRow, 'person_id' | 'event_type' | 'occurred_at' | 'metadata'>>, decidedCount: number): PersonTrail {
  let opened = 0
  let lastOpenedAt: string | null = null
  let asked = 0
  for (const e of events) {
    if (e.person_id !== personId) continue
    if (e.event_type === 'view') {
      opened += 1
      if (!lastOpenedAt || e.occurred_at > lastOpenedAt) lastOpenedAt = e.occurred_at
    } else if (e.event_type === 'reply') asked += 1
  }
  return { opened, lastOpenedAt, decided: decidedCount, asked }
}

/** Opens by people who did not say who they were. */
export function anonymousOpens(events: ReadonlyArray<Pick<SubmittalEventRow, 'person_id' | 'event_type'>>): number {
  return events.filter((e) => e.event_type === 'view' && e.person_id == null).length
}

function short(iso: string | null | undefined, tz: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: tz })
}

/** "opened Sep 16 · 3× · decided 22 · asked 1" — "not opened yet" when nothing. */
export function describeTrail(t: PersonTrail, tz: string): string {
  const parts: string[] = []
  if (t.opened > 0) parts.push(`opened ${short(t.lastOpenedAt, tz)}${t.opened > 1 ? ` · ${t.opened}×` : ''}`.trim())
  else parts.push('not opened yet')
  if (t.decided > 0) parts.push(`decided ${t.decided}`)
  if (t.asked > 0) parts.push(`asked ${t.asked}`)
  return parts.join(' · ')
}

/** "Room link · shared Sep 16 · opened 9×" */
export function describeRoomLine(room: Pick<SubmittalRoomRow, 'status' | 'shared_at' | 'closed_at'>, opens: number, tz: string): string {
  if (room.status === 'closed') return `Room closed${room.closed_at ? ` · ${short(room.closed_at, tz)}` : ''}`
  const parts = ['Room link']
  if (room.shared_at) parts.push(`shared ${short(room.shared_at, tz)}`)
  parts.push(opens === 0 ? 'not opened yet' : `opened ${opens}×`)
  return parts.join(' · ')
}

/** Defensive parse of the function's JSON — the page never trusts the wire blindly. */
export function parseSubmittalRoomPayload(json: unknown): SubmittalRoomPayload | null {
  if (!json || typeof json !== 'object') return null
  const j = json as Record<string, unknown>
  const bid = j.bid as Record<string, unknown> | undefined
  const company = j.company as Record<string, unknown> | undefined
  if (!bid || !company || !Array.isArray(j.revisions)) return null
  const status = j.status === 'closed' ? 'closed' : 'open'
  const person = j.person && typeof j.person === 'object' ? (j.person as Record<string, unknown>) : null
  return {
    status,
    closedAt: typeof j.closedAt === 'string' ? j.closedAt : null,
    bid: { label: String(bid.label ?? ''), projectName: String(bid.projectName ?? ''), address: typeof bid.address === 'string' ? bid.address : null },
    company: { name: String(company.name ?? ''), tagline: String(company.tagline ?? ''), phone: String(company.phone ?? '') },
    person: person ? { id: String(person.id ?? ''), name: String(person.name ?? ''), role: asRoomRole(person.role), mayDecide: person.mayDecide !== false, ...(typeof person.messagesThisHour === 'number' ? { messagesThisHour: person.messagesThisHour } : {}) } : null,
    messages: Array.isArray(j.messages) ? threadOrder((j.messages as unknown[]).map(parseRoomMessage).filter((m): m is RoomMessage => m != null)) : [],
    revisions: (j.revisions as unknown[])
      .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
      .map((r) => ({
        id: String(r.id ?? ''),
        rev: Number(r.rev ?? 0),
        sharedAt: typeof r.sharedAt === 'string' ? r.sharedAt : null,
        current: r.current === true,
        hasPackage: r.hasPackage === true,
        rows: Array.isArray(r.rows) ? (r.rows as SubmittalRoomPayload['revisions'][number]['rows']) : [],
        counts: (r.counts as SubmittalRoomPayload['revisions'][number]['counts']) ?? { total: 0, matches: 0, differs: 0, notQuoted: 0, added: 0, decided: 0, open: 0 },
      })),
  }
}

// ---------- stage 5a: the thread ----------

export function parseRoomMessage(raw: unknown): RoomMessage | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const kinds = ['office', 'reviewer', 'watcher', 'system', 'robot'] as const
  const authorKind = kinds.includes(r.authorKind as (typeof kinds)[number]) ? (r.authorKind as RoomMessage['authorKind']) : 'system'
  const entryKinds = ['message', 'reply', 'decision', 'shared'] as const
  const kind = entryKinds.includes(r.kind as (typeof entryKinds)[number]) ? (r.kind as RoomMessage['kind']) : 'message'
  const body = typeof r.body === 'string' ? r.body : ''
  if (!r.id || !body) return null
  return {
    id: String(r.id),
    at: typeof r.at === 'string' ? r.at : '',
    authorKind,
    authorName: typeof r.authorName === 'string' && r.authorName.trim() ? r.authorName : null,
    body,
    kind,
    revNumber: typeof r.revNumber === 'number' ? r.revNumber : null,
    tags: Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === 'string') : [],
  }
}

/** Oldest first, ties by id — the thread reads top to bottom like a conversation. */
export function threadOrder(messages: ReadonlyArray<RoomMessage>): RoomMessage[] {
  return [...messages].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))
}

/** The name line above an entry: "Dana Whitfield · Sep 16", "Click Plumbing · Sep 17", or "Sep 16" for a system line. */
export function describeThreadEntry(m: RoomMessage, tz: string): { who: string | null; when: string; quiet: boolean } {
  const when = m.at ? new Date(m.at).toLocaleDateString('en-US', { timeZone: tz, month: 'short', day: 'numeric' }) : ''
  if (m.authorKind === 'system' || m.authorKind === 'robot') return { who: null, when, quiet: true }
  return { who: m.authorName, when, quiet: false }
}

/** "3 entries · last: Dana asked Sep 17" for the office tab's collapsed panel. */
export function summarizeThread(messages: ReadonlyArray<RoomMessage>, tz: string): string {
  if (messages.length === 0) return 'No conversation yet'
  const last = threadOrder(messages)[messages.length - 1]!
  const who = last.authorKind === 'office' ? 'you' : last.authorKind === 'system' ? (last.authorName ?? 'the room') : (last.authorName ?? 'someone')
  const verb = last.kind === 'reply' ? 'answered' : last.kind === 'decision' ? 'decided' : last.kind === 'shared' ? 'shared' : 'asked'
  const when = last.at ? new Date(last.at).toLocaleDateString('en-US', { timeZone: tz, month: 'short', day: 'numeric' }) : ''
  return `${messages.length} ${messages.length === 1 ? 'entry' : 'entries'} · last: ${who} ${verb}${when ? ` ${when}` : ''}`
}
