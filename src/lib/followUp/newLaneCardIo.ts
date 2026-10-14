/**
 * Messages, residential R7 (PR 3): what the sort card above a thread reads and presses (`useNewLaneThreadSlots.tsx`).
 * The read is the open person only: their conversation's state and who has it, their newest line in and ours out, their
 * jobs' tiles and whether each is still under way, *Who gets a new message*'s seats and the office team. The guesses'
 * records load only for *Who is this?*. The presses are the spine's `name_contact` and `tie_message` and cut 2's
 * `take_it` and `hand_to`. One interface, so a smoke fakes it.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { APP_SETTINGS_KEY_MESSAGES_ASSIGN_RULE_V1 } from '../appSettingsKeys'
import { GC_OFFICE_TEAM } from '../gc/access'
import { parseAssignSeats } from '../messages/assignRule'
import type { JobTile } from '../messages/jobTiles'
import { loadJobTilesAndActive, nameAsLead, nameContact, tieMessage } from '../messages/messagesIo'
import { supabase } from '../supabase'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { checkSupabaseError } from '../../utils/errorHandling'
import { MESSAGE_COLUMNS, supabaseFollowUpIo } from './followUpIo'
import type { FollowUpMessageRow } from './followUpRows'
import type { ContactFollowUpRow } from './followUpTypes'
import { companyDomain, nameInText, type WhoGuess, type WhoKnown } from './newLane'
import type { AssignSeats } from './queue'
import { followUpTeamOf, type Teammate } from './team'

/** The open person's rows, as the card reads them. */
export interface NewLaneCardRows {
  /** Cut 2's columns on their contact: the conversation's state and who has it. Null once the row is gone. */
  contact: Pick<ContactFollowUpRow, 'state' | 'snoozed_until' | 'has_user_id'> | null
  /** Their newest line in and our newest line out, each when there is one. */
  lines: FollowUpMessageRow[]
  /** Their jobs' tiles, by key, and the ones still under way. */
  tiles: Record<string, JobTile>
  active: Set<string>
  /** *Who gets a new message*'s seats (Settings → Phone and texts). */
  seats: AssignSeats
  team: Teammate[]
}

export interface NewLaneCardIo {
  loadCard(contactId: string, jobKeys: readonly string[], nowIso: string): Promise<NewLaneCardRows>
  /** The records *Who is this?*'s guesses may be: customers with the line's last name, trade partners on its domain. */
  loadKnown(row: { who: string; body: string }): Promise<WhoKnown>
  /** Names the number as a guess says. Answers who holds the thread now. */
  name(contactId: string, guess: WhoGuess): Promise<string>
  tie(messageId: string, jobKey: string): Promise<void>
  takeIt(contactId: string): Promise<void>
  handTo(contactId: string, userId: string | null): Promise<void>
}

const one = <T>(result: { data: T[] | null }) => (result.data ?? [])[0] ?? null

export function supabaseNewLaneCardIo(client: unknown = supabase): NewLaneCardIo {
  // The spine's and cut 2's tables join the generated types with the lead's types PR; until then the client is untyped.
  const db = client as SupabaseClient
  const presses = supabaseFollowUpIo(client)
  return {
    async loadCard(contactId, jobKeys, nowIso) {
      const newest = (direction: 'in' | 'out') =>
        db.from('messages').select(MESSAGE_COLUMNS).eq('contact_id', contactId).eq('direction', direction).order('at', { ascending: false }).limit(1)
      const [contact, lastIn, lastOut, seats, team, jobs] = await Promise.all([
        db.from('contacts').select('state, snoozed_until, has_user_id').eq('id', contactId).maybeSingle(),
        newest('in'),
        newest('out'),
        db.from('app_settings').select('value_text').eq('key', APP_SETTINGS_KEY_MESSAGES_ASSIGN_RULE_V1).maybeSingle(),
        db.from('users').select('id, name, role').in('role', [...GC_OFFICE_TEAM]).is('archived_at', null).eq('is_digital_twin', false).eq('is_sample', false),
        loadJobTilesAndActive(jobKeys, calendarYmdInAppTzFromIso(nowIso)),
      ])
      checkSupabaseError(contact, 'load who has the conversation')
      checkSupabaseError(lastIn, 'load their newest line')
      checkSupabaseError(lastOut, 'load our newest line to them')
      checkSupabaseError(seats, 'read who gets a new message')
      checkSupabaseError(team, 'load the office team')
      const people = (team.data ?? []) as Array<{ id: string; name: string | null; role: string | null }>
      return {
        contact: (contact.data ?? null) as NewLaneCardRows['contact'],
        lines: [one(lastIn), one(lastOut)].filter((l) => l !== null) as unknown as FollowUpMessageRow[],
        tiles: jobs.tiles,
        active: jobs.active,
        seats: parseAssignSeats((seats.data as { value_text: string | null } | null)?.value_text),
        team: followUpTeamOf(people.map((p) => ({ id: p.id, name: p.name ?? '', role: p.role ?? '' }))),
      }
    },
    async loadKnown(row) {
      const last = nameInText(row.body)?.split(' ')[1] ?? ''
      const domain = companyDomain(row.who)
      const none = { data: [], error: null }
      const [customers, trades] = await Promise.all([
        last.length >= 3 ? db.from('customers').select('id, name, contact_info').ilike('name', `%${last}%`).limit(8) : none,
        domain ? db.from('gc_companies').select('id, name, contact_name, email').ilike('email', `%@${domain}`).limit(8) : none,
      ])
      checkSupabaseError(customers, 'look for the customer')
      checkSupabaseError(trades, 'look for the trade partner')
      return {
        customers: ((customers.data ?? []) as Array<{ id: string; name: string | null; contact_info: { phone?: string | null } | null }>).map((c) => ({
          id: c.id,
          name: c.name ?? '',
          phones: c.contact_info?.phone ? [c.contact_info.phone] : [],
        })),
        trades: ((trades.data ?? []) as Array<{ id: string; name: string; contact_name: string | null; email: string | null }>).map((t) => ({
          id: t.id,
          company: t.name,
          contactName: t.contact_name,
          emails: t.email ? [t.email] : [],
          // The asks a trade partner is on come with Sort all (mockup C).
          openAsk: null,
        })),
      }
    },
    async name(contactId, guess) {
      if (guess.kind === 'lead') return nameAsLead(contactId, guess.name)
      if (guess.record && (guess.kind === 'customer' || guess.kind === 'trade')) {
        return nameContact(contactId, { record: guess.record, kind: guess.kind, name: guess.newPerson ? guess.name : null })
      }
      throw new Error('That one needs its record made first.')
    },
    async tie(messageId, jobKey) {
      await tieMessage(messageId, jobKey)
    },
    takeIt: presses.takeIt,
    handTo: presses.handTo,
  }
}
