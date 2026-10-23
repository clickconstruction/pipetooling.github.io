/**
 * Messages, residential R7 (PR 3): what the sort card above a thread reads and presses (`useNewLaneThreadSlots.tsx`).
 * The read is the open person only: their conversation's state and who has it, their newest line in and ours out, their
 * jobs' tiles and whether each is still under way, *Who gets a new message*'s seats and the office team. The guesses'
 * records load only for *Who is this?*: since v2.5795 the customers and the people at them, the bids and the jobs that
 * name the sender (`customerLink.ts`), each read failing soft. The presses are the spine's `name_contact` and
 * `tie_message`, cut 2's `take_it` and `hand_to`, and *A new customer*'s `makeCustomer`. One interface, so a smoke fakes it.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { APP_SETTINGS_KEY_MESSAGES_ASSIGN_RULE_V1 } from '../appSettingsKeys'
import { GC_OFFICE_TEAM } from '../gc/access'
import { parseAssignSeats } from '../messages/assignRule'
import type { JobTile } from '../messages/jobTiles'
import { resolveCompanyOwnerUserId } from '../companyOwner'
import { customerPayloadFrom } from '../messages/leadDoors'
import { jobKey } from '../messages/load'
import { loadJobTilesAndActive, nameAsLead, nameContact, tieMessage } from '../messages/messagesIo'
import { supabase } from '../supabase'
import { jobNumberLabel } from '../jobs/jobSummaryCycle'
import type { Database } from '../../types/database'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { checkSupabaseError } from '../../utils/errorHandling'
import { MESSAGE_COLUMNS, supabaseFollowUpIo } from './followUpIo'
import type { FollowUpMessageRow } from './followUpRows'
import type { ContactFollowUpRow } from './followUpTypes'
import { samePerson, type KnownCustomer, type KnownPerson, type NamingJob } from './customerLink'
import { senderFacts, type SenderFacts, type WhoGuess, type WhoKnown } from './newLane'
import { activeJobKeys } from './newLaneRows'
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
  /**
   * The records *Who is this?*'s guesses may be: the customers and the people at them carrying the sender's address,
   * number, name or domain, the bids and jobs that name them (`customerLink.ts`, v2.5795), trade partners on the
   * domain, and the roster for *One of our own team*. The channels give the address or the number behind a name.
   */
  loadKnown(row: { who: string; body: string; channels?: ReadonlyArray<{ kind: 'phone' | 'email'; value: string }> }): Promise<WhoKnown>
  /** Names the number as a guess says. Answers who holds the thread now. */
  name(contactId: string, guess: WhoGuess): Promise<string>
  /**
   * *A new customer* (v2.5795): makes the customer from the sender, the lead doors' way (the row, then `name_contact`),
   * and names the contact as them, a person at the company when the names differ. Answers who holds the thread now.
   */
  makeCustomer(contactId: string, make: NewCustomerFacts, by: { userId: string }, todayYmd: string): Promise<string>
  tie(messageId: string, jobKey: string): Promise<void>
  takeIt(contactId: string): Promise<void>
  handTo(contactId: string, userId: string | null): Promise<void>
}

/** What *A new customer* is made from: the field's name, the sender's own, their address and number, the box's kind. */
export interface NewCustomerFacts {
  customerName: string
  personName: string | null
  email: string | null
  phone: string | null
  customerType: 'commercial' | 'residential'
}

const one = <T>(result: { data: T[] | null }) => (result.data ?? [])[0] ?? null

/** A read that fails soft: a signal the office cannot read (a role's door) leaves its matches out and the card stands. */
const soft = async <T>(read: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> => {
  try {
    const r = await read
    return r.error ? [] : (r.data ?? [])
  } catch {
    return []
  }
}

const last4 = (number: string) => number.slice(-4)
const nameOf = (embedded: { name: string | null } | { name: string | null }[] | null | undefined): string | null => {
  const row = Array.isArray(embedded) ? embedded[0] : embedded
  return row?.name?.trim() || null
}

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
        db.from('users').select('id, name, role').in('role', [...GC_OFFICE_TEAM]).is('archived_at', null).eq('is_digital_twin', false).eq('is_sample', false).eq('is_walk_tester', false),
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
      const sender: SenderFacts = senderFacts(row)
      const { address, number, name, domain } = sender
      const nameWords = (name ?? '').trim().split(/\s+/).filter(Boolean)
      const last = nameWords.length >= 2 ? nameWords[nameWords.length - 1]! : ''
      const none = { data: [], error: null }
      type CustomerRow = { id: string; name: string | null; contact_info: { phone?: string | null; email?: string | null } | null }
      type PersonRow = { id: string; name: string | null; email: string | null; phone: string | null; customer_id: string; customers: { name: string | null } | { name: string | null }[] | null }
      type BidRow = { id: string; bid_number: string | null; project_name: string | null; customer_id: string | null; outcome: string | null; gc_contact_email: string | null; gc_contact_name: string | null; gc_contact_phone: string | null; customers: { name: string | null } | { name: string | null }[] | null }
      type JobRow = { id: string; job_name: string | null; hcp_number: string | null; click_number: string | null; status: string | null; customer_id: string | null; customer_email: string | null; customer_phone: string | null; customers: { name: string | null } | { name: string | null }[] | null }
      const customerCols = 'id, name, contact_info'
      const personCols = 'id, name, email, phone, customer_id, customers(name)'
      const bidCols = 'id, bid_number, project_name, customer_id, outcome, gc_contact_email, gc_contact_name, gc_contact_phone, customers(name)'
      const jobCols = 'id, job_name, hcp_number, click_number, status, customer_id, customer_email, customer_phone, customers(name)'
      // The customers and the people at them: by the address, by the number's last four (settled in the kernel), by the
      // name's last word and by the company's domain; the bids and jobs that name the address, the number or the name.
      const [byAddress, byNumber, byLast, byDomain, peopleByAddress, peopleByNumber, peopleByLast, peopleByDomain, bidsByAddress, bidsByNumber, bidsByName, jobsByAddress, jobsByNumber, trades, roster] = await Promise.all([
        address ? soft<CustomerRow>(db.from('customers').select(customerCols).ilike('contact_info->>email', address).limit(8)) : [],
        number ? soft<CustomerRow>(db.from('customers').select(customerCols).ilike('contact_info->>phone', `%${last4(number)}%`).limit(20)) : [],
        last.length >= 3 ? soft<CustomerRow>(db.from('customers').select(customerCols).ilike('name', `%${last}%`).limit(8)) : [],
        domain ? soft<CustomerRow>(db.from('customers').select(customerCols).ilike('contact_info->>email', `%@${domain}`).limit(8)) : [],
        address ? soft<PersonRow>(db.from('customer_contact_persons').select(personCols).ilike('email', address).limit(8)) : [],
        number ? soft<PersonRow>(db.from('customer_contact_persons').select(personCols).ilike('phone', `%${last4(number)}%`).limit(20)) : [],
        last.length >= 3 ? soft<PersonRow>(db.from('customer_contact_persons').select(personCols).ilike('name', `%${last}%`).limit(8)) : [],
        domain ? soft<PersonRow>(db.from('customer_contact_persons').select(personCols).ilike('email', `%@${domain}`).limit(8)) : [],
        address ? soft<BidRow>(db.from('bids').select(bidCols).ilike('gc_contact_email', address).limit(8)) : [],
        number ? soft<BidRow>(db.from('bids').select(bidCols).ilike('gc_contact_phone', `%${last4(number)}%`).limit(20)) : [],
        name && name.length >= 3 ? soft<BidRow>(db.from('bids').select(bidCols).ilike('gc_contact_name', `%${name}%`).limit(8)) : [],
        address ? soft<JobRow>(db.from('jobs_ledger').select(jobCols).ilike('customer_email', address).limit(8)) : [],
        number ? soft<JobRow>(db.from('jobs_ledger').select(jobCols).ilike('customer_phone', `%${last4(number)}%`).limit(20)) : [],
        domain ? db.from('gc_companies').select('id, name, contact_name, email').ilike('email', `%@${domain}`).limit(8) : none,
        // Everyone on the roster but the subs, for *One of our own team* (v2.5546).
        db.from('people').select('id, name, kind, phone').neq('kind', 'sub').is('archived_at', null).order('name').limit(80),
      ])
      checkSupabaseError(trades, 'look for the trade partner')
      checkSupabaseError(roster, 'load the roster')
      const once = <T extends { id: string }>(rows: T[][]): T[] => {
        const seen = new Set<string>()
        return rows.flat().filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
      }
      const customers: KnownCustomer[] = once([byAddress, byNumber, byLast, byDomain]).map((c) => ({
        id: c.id,
        name: c.name ?? '',
        phones: c.contact_info?.phone ? [c.contact_info.phone] : [],
        emails: c.contact_info?.email ? [c.contact_info.email] : [],
      }))
      const people: KnownPerson[] = once([peopleByAddress, peopleByNumber, peopleByLast, peopleByDomain]).map((p) => ({
        id: p.id,
        name: p.name ?? '',
        customerId: p.customer_id,
        customer: nameOf(p.customers) ?? 'a customer',
        phones: p.phone ? [p.phone] : [],
        emails: p.email ? [p.email] : [],
      }))
      const bids = once([bidsByAddress, bidsByNumber, bidsByName])
      const pipeline = once([jobsByAddress, jobsByNumber])
      const active = activeJobKeys({ bids: bids.map((b) => ({ id: b.id, outcome: b.outcome })), pipeline: pipeline.map((j) => ({ id: j.id, status: j.status })) })
      const jobs: NamingJob[] = [
        ...bids.map((b): NamingJob => {
          const key = jobKey({ kind: 'bid', id: b.id })
          return {
            key,
            label: `${b.bid_number?.trim() || 'Bid'} ${b.project_name?.trim() || ''}`.trim(),
            customerId: b.customer_id,
            customer: nameOf(b.customers),
            emails: b.gc_contact_email ? [b.gc_contact_email] : [],
            phones: b.gc_contact_phone ? [b.gc_contact_phone] : [],
            names: b.gc_contact_name ? [b.gc_contact_name] : [],
            active: active.has(key),
          }
        }),
        ...pipeline.map((j): NamingJob => {
          const key = jobKey({ kind: 'pipeline', id: j.id })
          return {
            key,
            label: `${jobNumberLabel({ id: j.id, hcp_number: j.hcp_number, click_number: j.click_number })} ${j.job_name?.trim() || ''}`.trim(),
            customerId: j.customer_id,
            customer: nameOf(j.customers),
            emails: j.customer_email ? [j.customer_email] : [],
            phones: j.customer_phone ? [j.customer_phone] : [],
            active: active.has(key),
          }
        }),
      ]
      return {
        roster: ((roster.data ?? []) as Array<{ id: string; name: string | null; kind: string | null; phone: string | null }>).map((p) => ({
          id: p.id,
          name: p.name ?? '',
          kind: p.kind ?? '',
          phone: p.phone,
        })),
        customers,
        people,
        jobs,
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
        // A bid or a job that names them takes the thread (`jobKey`, v2.5795).
        return nameContact(contactId, { record: guess.record, kind: guess.kind, name: guess.newPerson ? guess.name : null, jobKey: guess.jobKey ?? null })
      }
      // One of our own team: the roster row *Which of ours?* picked; the roster learns the number on the server.
      if (guess.record && guess.kind === 'team') return nameContact(contactId, { record: guess.record, kind: 'team', name: null })
      throw new Error('That one needs its record made first.')
    },
    async makeCustomer(contactId, make, by, todayYmd) {
      const typed = db as unknown as SupabaseClient<Database>
      const owner = await resolveCompanyOwnerUserId(typed, by.userId)
      const customerName = make.customerName.trim()
      const payload = { ...customerPayloadFrom({ contactId, name: customerName, phone: make.phone, email: make.email, words: null }, owner, todayYmd), customer_type: make.customerType }
      const made = await typed.from('customers').insert(payload).select('id').single()
      checkSupabaseError(made, 'make them a customer')
      const customerId = (made.data as { id: string }).id
      // The sender is the customer's own person when the names read as one, else a person at the company by name.
      const person = make.personName?.trim() || null
      return nameContact(contactId, { record: { table: 'customers', id: customerId }, kind: 'customer', name: person && !samePerson(person, customerName) ? person : null })
    },
    async tie(messageId, jobKey) {
      await tieMessage(messageId, jobKey)
    },
    takeIt: presses.takeIt,
    handTo: presses.handTo,
  }
}
