import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  companyDomain,
  hasChoices,
  jobChoices,
  nameInText,
  NEW_LANE_EMPTY,
  newLane,
  newLaneCount,
  SORT_HEADS,
  viaWords,
  whoGuesses,
  type HasPerson,
  type LaneJob,
  type NewLaneContact,
  type NewLaneMessage,
  type NewLaneRow,
  type WhoKnown,
} from './newLane'

// The four made-up lines on screen 7 of the customer Messages prototype (v0.8, mockup A), on Tue Oct 13 2026 at
// 10:00 AM in Chicago, with three people who must stay off the lane. Nothing here is a real row.
const NOW = '2026-10-13T15:00:00Z'

const CONTACTS: NewLaneContact[] = [
  { id: 'kevin', kind: 'unknown', name: '(210) 555-0188', company: '', jobIds: [], defaultJobId: null, has: null },
  { id: 'bexar', kind: 'unknown', name: 'estimating@bexarsteel.example', company: '', jobIds: [], defaultJobId: null, has: null },
  { id: 'dana', kind: 'customer', name: 'Dana Whitfield', company: '', jobIds: ['j1312', 'j1298'], defaultJobId: 'j1312', has: 'Luis' },
  { id: 'greg', kind: 'trade', name: 'Greg Paulk', company: 'Hillside Excavation', jobIds: ['boerne'], defaultJobId: 'boerne', has: null },
  // Tied by hand, and Rosa has it.
  { id: 'elena', kind: 'customer', name: 'Elena Ortiz', company: '', jobIds: ['j1301', 'j1310'], defaultJobId: 'j1301', has: 'Rosa' },
  // Nobody has her, but we answered after her line.
  { id: 'priya', kind: 'customer', name: 'Priya Raman', company: '', jobIds: ['j1305'], defaultJobId: 'j1305', has: null },
  // Two jobs on the rail, one of them closed.
  { id: 'marcus', kind: 'customer', name: 'Marcus Webb', company: '', jobIds: ['j1290', 'j1311'], defaultJobId: 'j1311', has: 'Rosa' },
  // Never wrote in.
  { id: 'jonah', kind: 'arch', name: 'Jonah Vale', company: 'Vale Studio', jobIds: ['boerne'], defaultJobId: 'boerne', has: null },
]

const MESSAGES: NewLaneMessage[] = [
  {
    id: 'm-kevin',
    contactId: 'kevin',
    jobId: null,
    channel: 'text',
    direction: 'in',
    at: '2026-10-13T13:41:00Z',
    body: 'Hi this is Kevin Alvarez, can someone come look at my water heater? It is leaking at the bottom.',
    mailbox: 'team',
  },
  {
    id: 'm-bexar',
    contactId: 'bexar',
    jobId: null,
    channel: 'email',
    direction: 'in',
    at: '2026-10-13T13:12:00Z',
    subject: 'Boerne Retail Shell, steel',
    body: 'Attached is our number for the shell, 212,400 with a six week lead. Call with questions.',
    mailbox: 'bids',
  },
  { id: 'm-dana-0', contactId: 'dana', jobId: 'j1312', channel: 'text', direction: 'out', at: '2026-10-12T15:00:00Z', body: 'We can come Wednesday or Thursday.' },
  {
    id: 'm-dana',
    contactId: 'dana',
    jobId: 'j1312',
    channel: 'text',
    direction: 'in',
    at: '2026-10-12T21:05:00Z',
    body: 'Can you do Thursday? Also is the water heater quote still good?',
    mailbox: 'team',
    tiedByHand: false,
  },
  {
    id: 'm-greg',
    contactId: 'greg',
    jobId: 'boerne',
    channel: 'email',
    direction: 'in',
    at: '2026-10-13T12:55:00Z',
    body: 'We can start the pad Monday if the permit is in. Who do we check in with on site?',
    mailbox: 'bids',
  },
  { id: 'm-elena', contactId: 'elena', jobId: 'j1301', channel: 'text', direction: 'in', at: '2026-10-12T14:00:00Z', body: 'Is the certificate in yet?', tiedByHand: true },
  { id: 'm-priya', contactId: 'priya', jobId: 'j1305', channel: 'text', direction: 'in', at: '2026-10-12T14:00:00Z', body: 'Can the sink move?' },
  { id: 'm-priya-1', contactId: 'priya', jobId: 'j1305', channel: 'text', direction: 'out', at: '2026-10-12T14:30:00Z', body: 'Yes, we can move it.' },
  { id: 'm-marcus', contactId: 'marcus', jobId: 'j1311', channel: 'text', direction: 'in', at: '2026-10-12T14:00:00Z', body: 'Thanks for coming out.' },
  { id: 'm-jonah', contactId: 'jonah', jobId: 'boerne', channel: 'email', direction: 'out', at: '2026-10-12T14:00:00Z', body: 'Addendum 2 is filed.' },
]

const ACTIVE = new Set(['j1312', 'j1298', 'boerne', 'j1301', 'j1310', 'j1305', 'j1311'])

const JOBS: LaneJob[] = [
  { id: 'j1312', number: '1312', name: 'Oakridge sewer line', active: true },
  { id: 'j1298', number: '1298', name: 'Water heater', active: true },
  { id: 'j1290', number: '1290', name: 'Kitchen repipe', active: false },
]

const KNOWN: WhoKnown = {
  customers: [
    { id: 'c-dental', name: 'Alvarez Family Dental', phones: [] },
    { id: 'c-dana', name: 'Dana Whitfield', phones: ['(210) 555-0142'] },
  ],
  trades: [
    { id: 'g-bexar', company: 'Bexar Steel Erectors', contactName: 'Tom Riddle', emails: ['tom@bexarsteel.example'], openAsk: 'Boerne' },
    { id: 'g-hillside', company: 'Hillside Excavation', contactName: 'Greg Paulk', emails: ['greg@hillside.example'], openAsk: 'Boerne' },
    { id: 'g-open', company: 'Two Guys Steel', contactName: 'Sam Reyes', emails: ['twoguys@gmail.com'], openAsk: null },
  ],
}

const PEOPLE: HasPerson[] = [
  { name: 'Wendi', words: 'The superintendent.' },
  { name: 'Robert', words: 'The estimator.', office: true },
  { name: 'Rosa', words: 'The office.', office: true },
]

const lane = () => newLane(CONTACTS, MESSAGES, ACTIVE, NOW)
const row = (id: string): NewLaneRow => lane().find((r) => r.contactId === id)!

describe('newLane', () => {
  it('gives the four lines on screen 7, the oldest waiting first, each with its sort', () => {
    expect(lane().map((r) => [r.contactId, r.sort, r.head])).toEqual([
      ['dana', 'job', 'Which job?'],
      ['greg', 'has', 'Who has it?'],
      ['bexar', 'who', 'Who is this?'],
      ['kevin', 'who', 'Who is this?'],
    ])
  })

  it('carries the line, when it came and the box it came in on', () => {
    expect(row('kevin')).toMatchObject({
      who: '(210) 555-0188',
      kind: 'unknown',
      messageId: 'm-kevin',
      words: 'Hi this is Kevin Alvarez, can someone come look at my water heater? It is leaking at the bottom.',
      when: 'today at 8:41 AM',
      mailbox: 'team',
      via: 'Text on the team number',
      why: 'A number nobody has named came in on the team number. Someone asking for work is a lead until they book.',
    })
    expect(row('bexar')).toMatchObject({
      words: 'Boerne Retail Shell, steel',
      when: 'today at 8:12 AM',
      via: 'Email to bids@',
      why: 'An address nobody has named came in on bids@. On bids@, trade partners come first.',
    })
    expect(row('dana')).toMatchObject({
      when: 'yesterday',
      jobIds: ['j1312', 'j1298'],
      defaultJobId: 'j1312',
      why: 'Dana has two active jobs. The default job took this line, so check it is the right one.',
    })
    expect(row('greg')).toMatchObject({
      who: 'Greg Paulk',
      company: 'Hillside Excavation',
      words: 'We can start the pad Monday if the permit is in. Who do we check in with on site?',
      via: 'Email to bids@',
      why: 'Nobody is on this conversation yet.',
    })
  })

  it('leaves off a line tied by hand, one we answered, a closed job, and someone who never wrote', () => {
    const ids = lane().map((r) => r.contactId)
    for (const id of ['elena', 'priya', 'marcus', 'jonah']) expect(ids).not.toContain(id)
  })

  it('asks Which job? once a line sits on the default with no tie, even when we answered and nobody has them', () => {
    const contacts = CONTACTS.map((c) => (c.id === 'dana' ? { ...c, has: null } : c))
    expect(newLane(contacts, MESSAGES, ACTIVE, NOW).find((r) => r.contactId === 'dana')?.sort).toBe('job')
  })

  it('asks Which job? of a line on the person when there is no default and two active jobs', () => {
    const contacts = CONTACTS.map((c) => (c.id === 'dana' ? { ...c, defaultJobId: null } : c))
    const messages = MESSAGES.map((m) => (m.id === 'm-dana' ? { ...m, jobId: null } : m))
    expect(newLane(contacts, messages, ACTIVE, NOW).find((r) => r.contactId === 'dana')?.sort).toBe('job')
  })

  it('reads a line with no box as the team line, without naming a box it does not know', () => {
    const messages = MESSAGES.map((m) => (m.id === 'm-kevin' ? { ...m, mailbox: null } : m))
    const kevin = newLane(CONTACTS, messages, ACTIVE, NOW).find((r) => r.contactId === 'kevin')!
    expect(kevin.mailbox).toBeNull()
    expect(kevin.via).toBe('Text')
    expect(kevin.why).toBe('A number nobody has named came in. Someone asking for work is a lead until they book.')
  })

  it('counts the lane for the badge', () => {
    expect(newLaneCount(lane())).toBe(4)
    expect(newLaneCount([])).toBe(0)
  })
})

describe('whoGuesses', () => {
  it('on the team line: a customer by last name, then a new lead, then a new customer, a candidate, someone else', () => {
    const g = whoGuesses(row('kevin'), 'team', KNOWN)
    expect(g.map((x) => [x.kind, x.label])).toEqual([
      ['customer', 'Kevin Alvarez at Alvarez Family Dental'],
      ['lead', 'Kevin Alvarez, a new lead on Prospects'],
      ['customer', 'Kevin Alvarez, a new customer'],
      ['candidate', 'A candidate, to the hiring board'],
      ['someone_else', 'Someone else'],
    ])
    expect(g[0]).toMatchObject({ record: { table: 'customers', id: 'c-dental' }, newPerson: true, words: 'A customer with this last name and no cell on file.' })
  })

  it('puts a customer with this number on file before a last name', () => {
    const known: WhoKnown = { customers: [...KNOWN.customers!, { id: 'c-kevin', name: 'Kevin Alvarez', phones: ['+1 210 555 0188'] }] }
    const g = whoGuesses(row('kevin'), 'team', known)
    expect(g.slice(0, 2).map((x) => [x.label, x.newPerson])).toEqual([
      ['Kevin Alvarez', false],
      ['Kevin Alvarez at Alvarez Family Dental', true],
    ])
  })

  it('on bids@: the trade partner on the open ask, someone new there, then new, a supply house, a candidate, someone else', () => {
    const g = whoGuesses(row('bexar'), 'bids', KNOWN)
    expect(g.map((x) => [x.kind, x.label])).toEqual([
      ['trade', 'Tom Riddle at Bexar Steel Erectors'],
      ['trade', 'Someone new at Bexar Steel Erectors'],
      ['trade', 'A new trade partner'],
      ['supply_house', 'A supply house'],
      ['candidate', 'A candidate, to the hiring board'],
      ['someone_else', 'Someone else'],
    ])
    expect(g[0]).toMatchObject({ record: { table: 'gc_companies', id: 'g-bexar' }, newPerson: false, words: 'The trade partner asked on Boerne. This address goes on their record.' })
  })

  it('orders the guesses by the box, not by the sender', () => {
    expect(whoGuesses(row('kevin'), 'bids', KNOWN).map((x) => x.kind)).toEqual(['trade', 'supply_house', 'candidate', 'someone_else'])
    expect(whoGuesses(row('bexar'), 'team', KNOWN).map((x) => x.label)).toEqual([
      'A new lead on Prospects',
      'A new customer',
      'A candidate, to the hiring board',
      'Someone else',
    ])
    expect(whoGuesses(row('kevin'), null, KNOWN)).toEqual(whoGuesses(row('kevin'), 'team', KNOWN))
  })

  it('puts a domain on an open ask before one that is not, and never matches an open mail service', () => {
    const known: WhoKnown = {
      trades: [
        { id: 'g-old', company: 'Bexar Steel Supply', contactName: null, emails: ['sales@bexarsteel.example'], openAsk: null },
        ...KNOWN.trades!,
      ],
    }
    expect(whoGuesses(row('bexar'), 'bids', known).slice(0, 4).map((x) => x.label)).toEqual([
      'Tom Riddle at Bexar Steel Erectors',
      'Someone new at Bexar Steel Erectors',
      'Bexar Steel Supply',
      'Someone new at Bexar Steel Supply',
    ])
    const gmail = { ...row('bexar'), who: 'steelguy@gmail.com' }
    expect(whoGuesses(gmail, 'bids', KNOWN)[0]?.label).toBe('A new trade partner')
  })
})

describe('nameInText and companyDomain', () => {
  it('reads the name a line gives', () => {
    expect(nameInText('Hi this is Kevin Alvarez, can someone come look')).toBe('Kevin Alvarez')
    expect(nameInText('Hey, it’s Maria. The sink is fixed.')).toBe('Maria')
    expect(nameInText('This is Kevin from down the street')).toBe('Kevin')
    expect(nameInText('It’s Monday already')).toBeNull()
    expect(nameInText('Attached is our number. Call with questions.')).toBeNull()
  })

  it('keeps a company’s own domain and drops an open mail service', () => {
    expect(companyDomain('Estimating@BexarSteel.example')).toBe('bexarsteel.example')
    expect(companyDomain('someone@gmail.com')).toBe('')
    expect(companyDomain('(210) 555-0188')).toBe('')
  })
})

describe('jobChoices', () => {
  it('gives the active jobs in the rail’s order with the default marked', () => {
    expect(jobChoices(row('dana'), JOBS)).toEqual([
      { id: 'j1312', number: '1312', name: 'Oakridge sewer line', isDefault: true },
      { id: 'j1298', number: '1298', name: 'Water heater', isDefault: false },
    ])
  })

  it('leaves out a closed job', () => {
    expect(jobChoices({ jobIds: ['j1290', 'j1312'], defaultJobId: 'j1290' }, JOBS).map((j) => j.number)).toEqual(['1312'])
  })
})

describe('hasChoices', () => {
  it('puts the rule’s pick first, then the office, then everyone else, each once', () => {
    expect(hasChoices(row('greg'), PEOPLE, { name: 'Robert', why: 'Has Hillside on Boerne.' })).toEqual([
      { name: 'Robert', words: 'Has Hillside on Boerne. The rule picks them.', rulePick: true },
      { name: 'Rosa', words: 'The office.', rulePick: false },
      { name: 'Wendi', words: 'The superintendent.', rulePick: false },
    ])
  })

  it('starts with the office when the rule picks nobody', () => {
    expect(hasChoices(row('greg'), PEOPLE, null).map((c) => c.name)).toEqual(['Robert', 'Rosa', 'Wendi'])
  })
})

describe('plain words', () => {
  it('every sentence a person reads passes', () => {
    const r = lane()
    const texts = [
      ...Object.values(SORT_HEADS),
      NEW_LANE_EMPTY,
      ...r.flatMap((x) => [x.why, x.via, x.when]),
      ...(['team', 'bids', null] as const).flatMap((box) =>
        r.flatMap((x) => whoGuesses(x, box, KNOWN)).flatMap((g) => [g.label, g.words]),
      ),
      ...hasChoices(row('greg'), PEOPLE, { name: 'Robert', why: 'Has Hillside on Boerne.' }).map((c) => c.words),
      ...(['call', 'voicemail', 'missed', 'text', 'email', 'portal'] as const).flatMap((ch) => [viaWords(ch, 'team'), viaWords(ch, 'bids'), viaWords(ch, null)]),
    ]
    expect(texts.flatMap(plainWordsFailures)).toEqual([])
  })
})
