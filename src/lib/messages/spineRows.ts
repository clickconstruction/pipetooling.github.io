/**
 * Rows shaped like the spine's tables (migration 20261012010000_messages_spine.sql) as the seed and the first lines
 * leave them, for the loaders' tests and the screens' smokes: the people of the demo (`messagesDemo.ts`) as the database
 * holds them, with the records they point at. Made-up ids, names, numbers and addresses only, never a live row.
 */
import { startOfYmdInAppTzMs } from '../../utils/dateUtils'
import { contactsFromRows, type ContactChannelRow, type ContactJobRow, type ContactRecordRows, type ContactRow } from '../contacts/load'
import { railJobKeys } from './factJobs'
import { jobTilesByKey } from './jobTiles'
import { threadMessagesFromRows, type MessageRow } from './load'
import type { MessagesView } from './messagesIo'

const ct = (ymd: string, hour: number, minute: number): string => new Date(startOfYmdInAppTzMs(ymd) + (hour * 60 + minute) * 60_000).toISOString()

export const SPINE_USER_NAMES: Readonly<Record<string, string>> = { 'u-rosa': 'Rosa', 'u-robert': 'Robert' }

export const SPINE_RECORDS: ContactRecordRows = {
  customers: [
    { id: 'cust-cibolo', name: 'Cibolo Creek Partners' },
    { id: 'cust-marsh', name: 'Marsh & Vale Architects' },
    { id: 'cust-bell', name: 'Bell Family Dental' },
  ],
  customerContactPersons: [
    { id: 'ccp-elena', customer_id: 'cust-cibolo', name: 'Elena Marchetti' },
    { id: 'ccp-jonah', customer_id: 'cust-marsh', name: 'Jonah Vale' },
  ],
  gcCompanies: [
    { id: 'gc-hillside', name: 'Hillside Excavation', contact_name: 'Greg Paulk', trades: ['Sitework'] },
    { id: 'gc-alamo', name: 'Alamo Concrete', contact_name: 'Ray Ortiz', trades: ['Concrete', 'Flatwork'] },
  ],
  gcCompanyPeople: [{ id: 'gcp-dana', company_id: 'gc-hillside', name: 'Dana Paulk' }],
  people: [{ id: 'person-sam', name: 'Sam Roster' }],
}

const contact = (id: string, kind: string, set: Partial<ContactRow>): ContactRow => ({
  id,
  kind,
  customer_id: null,
  customer_contact_person_id: null,
  gc_company_id: null,
  gc_company_person_id: null,
  person_id: null,
  name: null,
  goes_by: null,
  off_since: null,
  off_why: null,
  off_by: null,
  ...set,
})

export const SPINE_CONTACTS: ContactRow[] = [
  // The seed: a trade partner's main contact, the person it named, the people at a customer and at an architect's office,
  // and a customer with nobody named at it, which is its own contact.
  contact('c-greg', 'trade', { gc_company_id: 'gc-hillside' }),
  contact('c-dana', 'trade', { gc_company_person_id: 'gcp-dana' }),
  contact('c-elena', 'customer', { customer_contact_person_id: 'ccp-elena' }),
  contact('c-jonah', 'arch', { customer_contact_person_id: 'ccp-jonah' }),
  contact('c-bell', 'customer', {
    customer_id: 'cust-bell',
    off_since: '2026-09-29',
    off_why: 'Declined our bid, went with another plumber.',
    off_by: 'u-rosa',
  }),
  // Who is this? since: Dee on the trade partner under her own name, and a roster person who goes by a nickname.
  contact('c-dee', 'trade', { gc_company_id: 'gc-alamo', name: 'Dee' }),
  contact('c-sam', 'trade', { person_id: 'person-sam', goes_by: 'Sammy' }),
  // A number nobody has named, and the number a deleted roster person left, which kept the name.
  contact('c-unknown', 'unknown', {}),
  contact('c-pat', 'unknown', { name: 'Pat Former' }),
]

const channel = (id: string, contactId: string, kind: string, value: string, createdAt: string, optedOutAt: string | null = null): ContactChannelRow => ({
  id,
  contact_id: contactId,
  kind,
  value,
  opted_out_at: optedOutAt,
  created_at: createdAt,
})

export const SPINE_CHANNELS: ContactChannelRow[] = [
  // Greg's address was filed before his number; his number still reads first.
  channel('ch-greg-email', 'c-greg', 'email', 'greg@hillside.example', ct('2026-09-01', 9, 0)),
  channel('ch-greg-phone', 'c-greg', 'phone', '(210) 555-0113', ct('2026-09-01', 9, 5)),
  channel('ch-dana-email', 'c-dana', 'email', 'dana@hillside.example', ct('2026-09-01', 9, 0)),
  channel('ch-elena-phone', 'c-elena', 'phone', '(210) 555-0188', ct('2026-09-01', 9, 0), ct('2026-10-01', 12, 0)),
  channel('ch-elena-email', 'c-elena', 'email', 'elena@cibolocreek.example', ct('2026-09-01', 9, 1)),
  channel('ch-jonah-email', 'c-jonah', 'email', 'jonah@marshvale.example', ct('2026-09-01', 9, 0)),
  channel('ch-bell-phone', 'c-bell', 'phone', '(210) 555-0177', ct('2026-09-01', 9, 0)),
  channel('ch-dee-phone', 'c-dee', 'phone', '(830) 555-0172', ct('2026-10-01', 9, 0)),
  channel('ch-sam-phone', 'c-sam', 'phone', '(210) 555-0170', ct('2026-09-01', 9, 0)),
  channel('ch-unknown-phone', 'c-unknown', 'phone', '(830) 555-0199', ct('2026-10-02', 9, 0)),
  channel('ch-pat-phone', 'c-pat', 'phone', '(210) 555-0171', ct('2026-09-01', 9, 0)),
  // A kind a later build may add: read past, never drawn.
  channel('ch-greg-fax', 'c-greg', 'fax', '(210) 555-0119', ct('2026-09-01', 9, 0)),
]

const job = (contactId: string, kind: 'bid' | 'project' | 'pipeline', id: string, isDefault: boolean, createdAt: string): ContactJobRow => ({
  contact_id: contactId,
  bid_id: kind === 'bid' ? id : null,
  project_id: kind === 'project' ? id : null,
  jobs_ledger_id: kind === 'pipeline' ? id : null,
  is_default: isDefault,
  created_at: createdAt,
})

export const SPINE_JOBS: ContactJobRow[] = [
  job('c-greg', 'bid', 'bid-boerne', false, ct('2026-09-20', 9, 0)),
  job('c-greg', 'project', 'proj-stoneoak', true, ct('2026-09-21', 9, 0)),
  job('c-elena', 'pipeline', 'jl-fairoaks', false, ct('2026-09-22', 9, 0)),
]

const line = (id: string, contactId: string, set: Partial<MessageRow>): MessageRow => ({
  id,
  contact_id: contactId,
  channel_id: null,
  bid_id: null,
  project_id: null,
  jobs_ledger_id: null,
  channel: 'text',
  direction: 'in',
  who_user_id: null,
  who_text: '',
  at: ct('2026-10-02', 9, 0),
  subject: null,
  body: '',
  optout_line: null,
  back_on: null,
  back_by: null,
  ...set,
})

export const SPINE_MESSAGES: MessageRow[] = [
  line('m-greg-text-out', 'c-greg', {
    channel_id: 'ch-greg-phone',
    bid_id: 'bid-boerne',
    direction: 'out',
    who_user_id: 'u-robert',
    who_text: 'Robert · from the company number',
    at: ct('2026-09-30', 9, 40),
    body: 'Greg, checking on the Boerne sitework number. Still good for today?',
    optout_line: 'first',
  }),
  line('m-greg-text-in', 'c-greg', {
    channel_id: 'ch-greg-phone',
    bid_id: 'bid-boerne',
    at: ct('2026-10-02', 8, 44),
    body: 'Also is the detention pond in sitework or concrete? Addendum 1 is not clear.',
  }),
  line('m-greg-email-in', 'c-greg', {
    channel_id: 'ch-greg-email',
    bid_id: 'bid-boerne',
    channel: 'email',
    who_text: 'Greg Paulk <greg@hillside.example> to bids@',
    at: ct('2026-10-02', 11, 30),
    subject: 'Hillside sitework, Boerne, rev 1',
    body: 'Robert,\n\nNumbers attached for the Boerne sitework.',
  }),
  line('m-elena-call', 'c-elena', {
    channel_id: 'ch-elena-phone',
    project_id: 'proj-stoneoak',
    channel: 'call',
    who_text: 'Rosa answered',
    at: ct('2026-10-01', 15, 10),
    body: 'She wants the number by Thursday morning.',
    duration_seconds: 362,
  }),
  line('m-elena-email-out', 'c-elena', {
    channel_id: 'ch-elena-email',
    jobs_ledger_id: 'jl-fairoaks',
    channel: 'email',
    direction: 'out',
    who_user_id: 'u-rosa',
    at: ct('2026-10-01', 16, 0),
    body: 'Pay application 3 for Fair Oaks Shops, Building D, $4,536.',
  }),
  line('m-elena-note', 'c-elena', {
    channel: 'note',
    direction: 'team',
    who_user_id: 'u-rosa',
    at: ct('2026-09-26', 14, 30),
    body: 'Start date waits on the award of Plumbing. Tell her Monday.',
    back_on: '2026-10-02',
    back_by: 'u-rosa',
  }),
  line('m-elena-missed', 'c-elena', {
    channel_id: 'ch-elena-phone',
    channel: 'missed',
    who_text: 'rang everyone · no voicemail',
    at: ct('2026-10-02', 10, 5),
    body: 'Missed call.',
  }),
  line('m-bell-event', 'c-bell', {
    channel: 'event',
    direction: 'team',
    who_user_id: 'u-rosa',
    at: ct('2026-09-29', 17, 5),
    body: 'Rosa marked the bid lost: went with another plumber.',
  }),
  line('m-unknown-text', 'c-unknown', { channel_id: 'ch-unknown-phone', at: ct('2026-10-02', 9, 12), body: 'Can we quote the concrete?' }),
  line('m-sam-text', 'c-sam', { channel_id: 'ch-sam-phone', at: ct('2026-10-02', 7, 30), body: 'Running late.' }),
  // A channel and an opt-out value a later build may add: the first is left out, the second reads as none.
  line('m-greg-fax', 'c-greg', { channel: 'fax', body: 'A fax.' }),
  line('m-greg-odd-optout', 'c-greg', { direction: 'out', at: ct('2026-10-01', 9, 0), body: 'Hello.', optout_line: 'later' }),
]

/** The jobs the rows name, as their tables hold them, for the tiles. */
export const SPINE_TILE_ROWS = {
  bids: [{ id: 'bid-boerne', bid_number: 'B482', project_name: 'Boerne Retail Shell', bid_due_date: '2026-10-08', bid_date_sent: null, outcome: null }],
  projects: [
    { project_id: 'proj-stoneoak', name: 'Stone Oak Pharmacy', project_number: '42', stage: 'building', bid_due: null, our_bid_sent_on: null, lost_on: null, started_on: '2026-09-14' },
  ],
  pipeline: [{ id: 'jl-fairoaks', hcp_number: 'J1077', click_number: null, job_name: 'Fair Oaks Shops, Building D', status: 'Billed' }],
}

/** The rows above as the Messages view and the thread window draw them, at the demo's clock: the screens' smokes. */
export function spineMessagesView(): MessagesView {
  const contacts = contactsFromRows(SPINE_CONTACTS, SPINE_CHANNELS, SPINE_JOBS, SPINE_RECORDS)
  const messages = threadMessagesFromRows(SPINE_MESSAGES, { userNames: SPINE_USER_NAMES, contacts })
  return {
    contacts,
    messages,
    rails: Object.fromEntries(contacts.map((c) => [c.id, railJobKeys(c)])),
    tiles: jobTilesByKey(SPINE_TILE_ROWS, '2026-10-02'),
    userNames: { ...SPINE_USER_NAMES },
  }
}
