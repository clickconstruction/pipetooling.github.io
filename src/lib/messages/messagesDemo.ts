/**
 * The Messages build's demo data, shared by every cluster's tests and smokes: the prototype's eight people, its six jobs
 * and its twenty messages (branch spike/gc-mode, `to-dos/gc-mode/messages/prototype.html` v1.178), at its clock, Fri Oct
 * 2 2026 at 11:45 AM in Chicago. Made-up people, companies, numbers and addresses only, never a live row. The record
 * ids are made up too: they say which kind of record each person is (the person at a customer or an architect's office
 * is a `customer_contact_persons` row; a trade partner's main contact is its `gc_companies` row). What the prototype keeps for later cuts
 * stays out (Follow up's state and owed, the promises, the attachments, the transcripts): each cut adds its own.
 */
import { startOfYmdInAppTzMs } from '../../utils/dateUtils'
import type { Contact } from '../contacts/kernel'
import type { ThreadMessage } from './thread'

/** A Chicago wall time as the instant the app stores. */
const ct = (ymd: string, hour: number, minute: number): string => new Date(startOfYmdInAppTzMs(ymd) + (hour * 60 + minute) * 60_000).toISOString()

/** The prototype's clock: Fri Oct 2 2026, 11:45 AM in Chicago. */
export const DEMO_NOW = ct('2026-10-02', 11, 45)

export interface DemoJob {
  id: string
  name: string
  /** A bid, a GC project or a Pipeline job. */
  kind: 'bid' | 'project' | 'pipeline'
  /** The tile's badge: a bid's number, a project's, a Pipeline job's. */
  num: string
  /** When a bid is due. */
  dueAt?: string
  /** The day our bid went. */
  sentOn?: string
  /** A project's or a Pipeline job's stage, the day it began, and what goes with it. */
  stage?: string
  since?: string
  extra?: string
  /** A bid we did not get. */
  lost?: boolean
}

export const DEMO_JOBS: DemoJob[] = [
  { id: 'boerne', name: 'Boerne Retail Shell', kind: 'bid', num: 'B482', dueAt: ct('2026-10-08', 14, 0) },
  { id: 'padb', name: 'Boerne Retail Pad B', kind: 'bid', num: 'B491', dueAt: ct('2026-10-22', 14, 0) },
  { id: 'stoneoak', name: 'Stone Oak Pharmacy', kind: 'project', num: '#42', stage: 'building', since: '2026-09-14' },
  { id: 'helotes', name: 'Helotes Dental Office', kind: 'project', num: '#47', stage: 'buying out', since: '2026-09-19' },
  { id: 'fairoaks', name: 'Fair Oaks Shops, Building D', kind: 'pipeline', num: 'J1077', stage: 'billed', since: '2026-10-01', extra: 'pay app 3' },
  { id: 'bell', name: 'Bell Family Dental', kind: 'bid', num: 'B470', sentOn: '2026-09-21', lost: true },
]

const phone = (contactId: string, value: string) => ({ id: `${contactId}-phone`, kind: 'phone' as const, value, optedOutAt: null })
const email = (contactId: string, value: string) => ({ id: `${contactId}-email`, kind: 'email' as const, value, optedOutAt: null })

export const DEMO_CONTACTS: Contact[] = [
  {
    id: 'greg',
    kind: 'trade',
    name: 'Greg Paulk',
    goesBy: null,
    company: 'Hillside Excavation',
    trade: 'Sitework',
    record: { table: 'gc_companies', id: 'hillside' },
    channels: [phone('greg', '(210) 555-0113'), email('greg', 'greg@hillside.example')],
    jobIds: ['boerne', 'padb', 'stoneoak'],
    defaultJobId: 'boerne',
  },
  {
    id: 'elena',
    kind: 'customer',
    name: 'Elena Marchetti',
    goesBy: null,
    company: 'Cibolo Creek Partners',
    record: { table: 'customer_contact_persons', id: 'cibolo-elena' },
    channels: [phone('elena', '(210) 555-0188'), email('elena', 'elena@cibolocreek.example')],
    jobIds: ['boerne', 'padb', 'fairoaks', 'stoneoak'],
    defaultJobId: 'boerne',
  },
  {
    id: 'priya',
    kind: 'customer',
    name: 'Dr. Priya Raman',
    goesBy: null,
    company: 'Helotes Dental Office',
    record: { table: 'customer_contact_persons', id: 'helotes-priya' },
    channels: [phone('priya', '(210) 555-0144'), email('priya', 'priya@helotesdental.example')],
    jobIds: ['helotes'],
    defaultJobId: 'helotes',
  },
  {
    id: 'bill',
    kind: 'trade',
    name: 'Bill Sorrell',
    goesBy: null,
    company: 'Tejas Power',
    trade: 'Electrical, low voltage',
    record: { table: 'gc_companies', id: 'tejas' },
    channels: [phone('bill', '(210) 555-0121'), email('bill', 'bill@tejaspower.example')],
    jobIds: ['boerne', 'stoneoak'],
    defaultJobId: 'boerne',
  },
  {
    id: 'tom',
    kind: 'trade',
    name: 'Tom Riddle',
    goesBy: null,
    company: 'Bexar Steel Erectors',
    trade: 'Structural steel',
    record: { table: 'gc_companies', id: 'bexar' },
    channels: [phone('tom', '(210) 555-0130')],
    jobIds: ['boerne'],
    defaultJobId: 'boerne',
  },
  {
    id: 'jonah',
    kind: 'arch',
    name: 'Jonah Vale',
    goesBy: null,
    company: 'Marsh & Vale Architects',
    record: { table: 'customer_contact_persons', id: 'marsh-vale-jonah' },
    channels: [phone('jonah', '(210) 555-0160'), email('jonah', 'jonah@marshvale.example')],
    jobIds: ['boerne', 'padb'],
    defaultJobId: 'boerne',
  },
  {
    id: 'marcus',
    kind: 'customer',
    name: 'Marcus Bell',
    goesBy: null,
    company: 'Bell Family Dental',
    record: { table: 'customer_contact_persons', id: 'bell-marcus' },
    channels: [phone('marcus', '(210) 555-0177'), email('marcus', 'marcus@bellfamilydental.example')],
    jobIds: ['bell'],
    defaultJobId: 'bell',
  },
  {
    id: 'unk1',
    kind: 'unknown',
    name: '(830) 555-0172',
    goesBy: null,
    company: '',
    record: null,
    channels: [phone('unk1', '(830) 555-0172')],
    jobIds: [],
    defaultJobId: null,
  },
]

/** The twenty messages, by the prototype's ids. */
export const DEMO_MESSAGES: ThreadMessage[] = [
  { id: '1', contactId: 'greg', jobId: 'boerne', channel: 'call', direction: 'in', at: ct('2026-09-26', 0, 0), who: 'Robert answered', body: 'Greg is busy on a subdivision. He will price the Boerne sitework by Wednesday, Sep 30. He asked whether striping is in his scope; Robert said it is listed under Sitework.', channelId: 'greg-phone', durationSeconds: 252 },
  { id: '2', contactId: 'greg', jobId: 'boerne', channel: 'text', direction: 'out', at: ct('2026-09-30', 9, 40), who: 'Robert · from the company number', body: 'Greg, checking on the Boerne sitework number. Still good for today?', channelId: 'greg-phone' },
  { id: '3', contactId: 'greg', jobId: 'boerne', channel: 'voicemail', direction: 'in', at: ct('2026-10-02', 8, 41), who: 'rang everyone on the company number', body: '"Hey Robert, it\'s Greg with Hillside. Sorry, ran behind. I\'ll have Boerne sitework over by Wednesday the 7th. Call me if you need it sooner."', channelId: 'greg-phone', durationSeconds: 38 },
  { id: '4', contactId: 'greg', jobId: 'boerne', channel: 'text', direction: 'in', at: ct('2026-10-02', 8, 44), who: 'Greg', body: 'Also is the detention pond in sitework or concrete? Addendum 1 is not clear.', channelId: 'greg-phone' },
  { id: '5', contactId: 'elena', jobId: 'boerne', channel: 'call', direction: 'in', at: ct('2026-10-01', 15, 10), who: 'Rosa answered', body: 'She wants the Boerne number by Thursday morning, not afternoon. The board meets at 1.', channelId: 'elena-phone', durationSeconds: 362 },
  { id: '6', contactId: 'elena', jobId: 'boerne', channel: 'missed', direction: 'in', at: ct('2026-10-02', 10, 5), who: 'rang everyone · no voicemail', body: 'Missed call.', channelId: 'elena-phone' },
  { id: '7', contactId: 'elena', jobId: 'fairoaks', channel: 'email', direction: 'out', at: ct('2026-10-01', 16, 0), who: 'Rosa · bids@', body: 'Pay application 3 for Fair Oaks Shops, Building D, $4,536. Opened at 3:12 PM.', channelId: 'elena-email' },
  { id: '8', contactId: 'priya', jobId: 'helotes', channel: 'text', direction: 'in', at: ct('2026-09-26', 14, 14), who: 'Priya', body: 'Thanks! Can you send me the start date when you have it?', channelId: 'priya-phone' },
  { id: '9', contactId: 'priya', jobId: 'helotes', channel: 'note', direction: 'team', at: ct('2026-09-26', 14, 30), who: 'Rosa', body: 'Start date waits on the Board\'s award of Plumbing. Tell her Monday.', channelId: null, backOn: '2026-10-02', backBy: 'Rosa' },
  { id: '10', contactId: 'bill', jobId: 'boerne', channel: 'text', direction: 'in', at: ct('2026-10-02', 7, 58), who: 'Bill', body: 'Quote is in your portal now, end of day like I said.', channelId: 'bill-phone' },
  { id: '11', contactId: 'bill', jobId: 'boerne', channel: 'text', direction: 'out', at: ct('2026-10-02', 8, 2), who: 'Rosa · from the company number', body: 'Got it, thank you Bill.', channelId: 'bill-phone' },
  { id: '12', contactId: 'tom', jobId: 'boerne', channel: 'text', direction: 'out', at: ct('2026-09-30', 11, 0), who: 'Robert · from the company number', body: 'Tom, did the Boerne steel invite come through?', channelId: 'tom-phone' },
  { id: '13', contactId: 'jonah', jobId: 'boerne', channel: 'email', direction: 'in', at: ct('2026-10-02', 10, 48), who: 'Jonah Vale <jonah@marshvale.example> to bids@', subject: 'Boerne Retail Shell, Addendum 2', body: 'Robert,\n\nAddendum 2 is at the link below, 184 MB. It settles the panel size (520 A, per the utility letter of Sep 28) and the roof curbs (see A-401 and M-101; the curbs move 18 inches north to clear the new RTU pad). The bid date holds: Thursday Oct 8, 2 PM.\n\nSheets changed: E-301, E-302 (new), M-101, M-201, A-401, FP-101. The specification section 23 05 00 is reissued in full; please discard the Sep 15 copy.\n\nQuestions close Monday Oct 5 at noon. Anything after that is answered at the pre-bid walk if there is one, otherwise by addendum 3.\n\nfiles.marshvale.example/s/7Hq2\n\nJonah Vale, AIA\nMarsh & Vale Architects', channelId: 'jonah-email' },
  { id: '14', contactId: 'unk1', jobId: null, channel: 'text', direction: 'in', at: ct('2026-10-02', 9, 12), who: '(830) 555-0172', body: 'Hi this is Dee at Alamo Concrete, new cell. Saw the Pad B pricing set, can we quote the concrete?', channelId: 'unk1-phone' },
  { id: '15', contactId: 'elena', jobId: 'fairoaks', channel: 'voicemail', direction: 'in', at: ct('2026-10-02', 9, 50), who: 'rang everyone on the company number', body: '"Rosa, it\'s Elena. The check for pay application 3 goes out Friday the 9th, our accounting runs then. Call me about the glass."', channelId: 'elena-phone', durationSeconds: 24 },
  { id: '16', contactId: 'greg', jobId: 'boerne', channel: 'email', direction: 'in', at: ct('2026-10-02', 11, 30), who: 'Greg Paulk <greg@hillside.example> to bids@', subject: 'Hillside sitework, Boerne, rev 1', body: 'Robert,\n\nNumbers attached for the Boerne sitework. A few things to know when you read it:\n\n1. Detention pond excluded per our call. We can price it at $38,500 if you need it in; that assumes the geotech report\'s clay depth holds.\n2. Striping is in, per Robert\'s note that it sits under Sitework.\n3. Rock clause: anything over 4 inches of limestone at grade is extra at $42 a yard; we hit it on the Pad B side last year.\n4. We can start the Monday after award with a crew of six, two weeks on site, weather permitting.\n\nPrice holds 30 days. Call me on the cell with anything.\n\nGreg\nHillside Excavation', channelId: 'greg-email' },
  { id: '17', contactId: 'priya', jobId: 'helotes', channel: 'email', direction: 'out', at: ct('2026-09-19', 16, 5), who: 'Rosa · bids@', body: 'Dr. Raman, the contract is signed on our side and the trades are being lined up. I will send the start date as soon as Plumbing is awarded.', channelId: 'priya-email' },
  { id: '18', contactId: 'marcus', jobId: 'bell', channel: 'email', direction: 'out', at: ct('2026-09-21', 10, 15), who: 'Rosa · bids@', subject: 'Bell Family Dental: our bid', body: 'Hello Marcus,\n\nOur bid for the Bell Family Dental build-out is attached: $48,900, forty working days from permit.\n\nRosa\nClick Construction', channelId: 'marcus-email' },
  { id: '19', contactId: 'marcus', jobId: 'bell', channel: 'text', direction: 'in', at: ct('2026-09-29', 16, 40), who: 'Marcus Bell', body: 'Thanks for the number, Rosa. We are going with another plumber this time. Appreciate the quick turnaround.', channelId: 'marcus-phone' },
  { id: '20', contactId: 'marcus', jobId: null, channel: 'event', direction: 'team', at: ct('2026-09-29', 17, 5), who: 'Rosa', body: 'Rosa marked the bid lost: went with another plumber. Marcus is off the flow.', channelId: null },
]
