import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { customerMatches, newCustomerGuess, samePerson, type KnownCustomer, type KnownPerson, type NamingJob } from './customerLink'
import { senderFacts, whoGuesses } from './newLane'
import { guessWait, namedWords } from './newLaneRows'

const CUSTOMERS: KnownCustomer[] = [
  { id: 'c-ridgeway', name: 'Ridgeway Builders', emails: ['bids@ridgewaybuilders.example'], phones: ['(210) 555-0100'] },
  { id: 'c-dental', name: 'Alvarez Family Dental', phones: [] },
  { id: 'c-kevin', name: 'Kevin Alvarez', phones: ['+1 210 555 0188'], emails: ['kevin@gmail.com'] },
  { id: 'c-dana', name: 'Dana Whitfield', phones: ['(210) 555-0142'] },
]
const PEOPLE: KnownPerson[] = [
  { id: 'p-dale', name: 'Dale Ferris', customerId: 'c-ridgeway', customer: 'Ridgeway Builders', emails: ['dale@ridgewaybuilders.example'] },
  { id: 'p-mia', name: 'Mia Chen', customerId: 'c-oakhill', customer: 'Oakhill Church', emails: ['mia@oakhillchurch.example'] },
]
const JOBS: NamingJob[] = [
  { key: 'bid:b482', label: 'B482 Oakhill Church Fellowship Hall', customerId: 'c-ridgeway', customer: 'Ridgeway Builders', emails: ['dale@ridgewaybuilders.example'], names: ['Dale Ferris'], active: true },
  { key: 'bid:b301', label: 'B301 Westside Clinic', customerId: 'c-ridgeway', customer: 'Ridgeway Builders', emails: ['estimating@ridgewaybuilders.example'], active: false },
  { key: 'pipeline:j1298', label: 'J1298 Water heater', customerId: 'c-kevin', customer: 'Kevin Alvarez', phones: ['2105550188'], active: true },
  { key: 'bid:b999', label: 'B999 No customer', customerId: null, customer: null, emails: ['dale@ridgewaybuilders.example'], active: true },
]
const KNOWN = { customers: CUSTOMERS, people: PEOPLE, jobs: JOBS }

const dale = senderFacts({ who: 'Dale Ferris', body: 'We would like to invite you to bid.', channels: [{ kind: 'email', value: 'Dale@RidgewayBuilders.example' }] })
const kevin = senderFacts({ who: '(210) 555-0188', body: 'Hi this is Kevin Alvarez, my water heater is leaking.', channels: [{ kind: 'phone', value: '(210) 555-0188' }] })

describe('senderFacts', () => {
  it('reads the address, the number, the name and the domain from the row and the channels', () => {
    expect(dale).toEqual({ address: 'dale@ridgewaybuilders.example', number: '', name: 'Dale Ferris', domain: 'ridgewaybuilders.example' })
    expect(kevin).toEqual({ address: '', number: '2105550188', name: 'Kevin Alvarez', domain: '' })
  })
  it('takes the From line’s name when the line gives none, and no name from a bare number or address', () => {
    expect(senderFacts({ who: 'Glenn Reyes', body: 'Please see the attached.' }).name).toBe('Glenn Reyes')
    expect(senderFacts({ who: 'estimating@bexarsteel.example', body: 'Attached is our number.' })).toEqual({ address: 'estimating@bexarsteel.example', number: '', name: null, domain: 'bexarsteel.example' })
    expect(senderFacts({ who: '(210) 555-0199', body: 'Can you come by?' }).name).toBeNull()
    expect(senderFacts({ who: 'sam@gmail.com', body: '' }).domain).toBe('')
  })
})

describe('samePerson', () => {
  it('is the customer’s own when every word of the name is in the customer’s, or there is no name', () => {
    expect(samePerson('Kevin', 'Kevin Alvarez')).toBe(true)
    expect(samePerson('Kevin Alvarez', 'Kevin Alvarez')).toBe(true)
    expect(samePerson(null, 'Ridgeway Builders')).toBe(true)
    expect(samePerson('Kevin Alvarez', 'Alvarez Family Dental')).toBe(false)
    expect(samePerson('Dale Ferris', 'Ridgeway Builders')).toBe(false)
  })
})

describe('customerMatches', () => {
  it('an address on a person at a customer is one guess: the bid that names it joins with its key, the domain and the name add nothing', () => {
    const g = customerMatches(dale, KNOWN)
    expect(g.map((x) => [x.label, x.words, x.jobKey ?? null, x.newPerson])).toEqual([
      ['Dale Ferris at Ridgeway Builders', 'This address is on their record. Named on B482 Oakhill Church Fellowship Hall. The thread lands on it.', 'bid:b482', false],
    ])
    expect(g[0]).toMatchObject({ kind: 'customer', record: { table: 'customer_contact_persons', id: 'p-dale' }, name: null })
    // The same address with no person row: the bid names the company, and the sender is a new person there.
    const noPeople = customerMatches(dale, { customers: CUSTOMERS, jobs: JOBS })
    expect(noPeople.map((x) => [x.label, x.words, x.jobKey ?? null, x.newPerson, x.name])).toEqual([
      ['Dale Ferris at Ridgeway Builders', 'Named on B482 Oakhill Church Fellowship Hall. The thread lands on it.', 'bid:b482', true, 'Dale Ferris'],
    ])
    expect(noPeople[0]).toMatchObject({ record: { table: 'customers', id: 'c-ridgeway' } })
  })

  it('a number on file comes first and reads as the customer’s own; the job that names the number lands the thread; the last name follows', () => {
    const g = customerMatches(kevin, KNOWN)
    expect(g.map((x) => [x.label, x.words, x.jobKey ?? null, x.newPerson, x.name])).toEqual([
      ['Kevin Alvarez', 'This number is on their record. Named on J1298 Water heater. The thread lands on it.', 'pipeline:j1298', false, null],
      ['Kevin Alvarez at Alvarez Family Dental', 'A customer with this last name and no cell on file.', null, true, 'Kevin Alvarez'],
    ])
  })

  it('a bid no longer under way names them without taking the thread, and a bid with no customer names nobody', () => {
    const old = senderFacts({ who: 'estimating@ridgewaybuilders.example', body: 'Our number for the clinic.' })
    const g = customerMatches(old, { customers: CUSTOMERS, jobs: JOBS })
    expect(g.map((x) => [x.label, x.words, x.jobKey ?? null])).toEqual([['Ridgeway Builders', 'Named on B301 Westside Clinic.', null]])
    expect(customerMatches(dale, { jobs: [JOBS[3]!] })).toEqual([])
  })

  it('the whole name finds a customer or a person at one; a domain finds someone new at the company', () => {
    const mia = senderFacts({ who: 'Mia Chen', body: 'Hello', channels: [{ kind: 'email', value: 'mia.chen@oakhillchurch.example' }] })
    expect(customerMatches(mia, KNOWN).map((x) => [x.label, x.words, x.record?.table])).toEqual([['Mia Chen at Oakhill Church', 'A person at the customer with this name.', 'customer_contact_persons']])
    const dana = senderFacts({ who: 'Dana Whitfield', body: 'Hi', channels: [{ kind: 'email', value: 'dw@outlook.com' }] })
    expect(customerMatches(dana, KNOWN).map((x) => [x.label, x.words, x.newPerson])).toEqual([['Dana Whitfield', 'A customer with this name.', false]])
    const someone = senderFacts({ who: 'ap@ridgewaybuilders.example', body: 'Invoice attached.' })
    expect(customerMatches(someone, KNOWN).map((x) => [x.label, x.words, x.newPerson, x.name])).toEqual([
      ['Someone new at Ridgeway Builders', 'Same company address, @ridgewaybuilders.example. The name stays on the thread.', true, null],
    ])
  })

  it('nothing known, nothing matched', () => {
    expect(customerMatches(dale, {})).toEqual([])
    expect(customerMatches(kevin, { customers: [CUSTOMERS[3]!] })).toEqual([])
  })
})

describe('A new customer, one live press', () => {
  it('starts with the sender’s name, commercial on bids@ and residential on the team number, and never waits', () => {
    const onBids = newCustomerGuess(dale, 'bids')
    expect(onBids).toMatchObject({ kind: 'customer', label: 'Dale Ferris, a new customer', words: 'Makes the customer with this address. The thread moves to them.', record: null, newPerson: false, name: 'Dale Ferris' })
    expect(onBids.makes).toEqual({ customerName: 'Dale Ferris', customerType: 'commercial', hint: 'A company? Type its name. Dale stays the person on the thread.' })
    expect(guessWait(onBids)).toBeNull()
    const onTeam = newCustomerGuess(senderFacts({ who: '(210) 555-0199', body: 'Can you come by?' }), 'team')
    expect(onTeam).toMatchObject({ label: 'A new customer', words: 'Makes the customer with this number. The thread moves to them.', name: null })
    expect(onTeam.makes).toEqual({ customerName: '', customerType: 'residential', hint: 'Type their name, or the company they are at.' })
    expect(newCustomerGuess(kevin, null).makes?.customerType).toBe('residential')
  })

  it('says what the press did, with the name typed in the field', () => {
    const g = newCustomerGuess(dale, 'bids')
    expect(namedWords({ ...g, makes: { ...g.makes!, customerName: 'Ridgeway Builders' } })).toBe('Ridgeway Builders is a customer now. The thread moves to them.')
    expect(namedWords(g)).toBe('Dale Ferris is a customer now. The thread moves to them.')
  })
})

describe('whoGuesses with the customers first (v2.5795)', () => {
  const row = { who: 'Dale Ferris', body: 'We would like to invite you to bid.', channels: [{ kind: 'email' as const, value: 'dale@ridgewaybuilders.example' }] }
  it('on bids@: the customers we know, the new customer, then the trade partners and the rest', () => {
    expect(whoGuesses(row, 'bids', { ...KNOWN, trades: [{ id: 'g-ridge', company: 'Ridgeway Steel', contactName: null, emails: ['steel@ridgewaybuilders.example'], openAsk: null }] }).map((x) => [x.kind, x.label])).toEqual([
      ['customer', 'Dale Ferris at Ridgeway Builders'],
      ['customer', 'Dale Ferris, a new customer'],
      ['trade', 'Ridgeway Steel'],
      ['trade', 'Dale Ferris at Ridgeway Steel'],
      ['trade', 'Dale Ferris, a new trade partner'],
      ['supply_house', 'A supply house'],
      ['candidate', 'A candidate, to the hiring board'],
      ['team', 'One of our own team'],
      ['someone_else', 'Someone else'],
      // A notice, not a person (v2.6202): an email's card ends with the address's press, then the domain's.
      ['notice', 'Mark dale@ridgewaybuilders.example a notice'],
      ['notice', 'And everything from ridgewaybuilders.example'],
    ])
  })
  it('on the team line: the customers we know, the lead, the new customer, the rest', () => {
    const kevinRow = { who: '(210) 555-0188', body: 'Hi this is Kevin Alvarez, my water heater is leaking.' }
    expect(whoGuesses(kevinRow, 'team', KNOWN).map((x) => [x.kind, x.label, guessWait(x)])).toEqual([
      ['customer', 'Kevin Alvarez', null],
      ['customer', 'Kevin Alvarez at Alvarez Family Dental', null],
      ['lead', 'Kevin Alvarez, a new lead on Prospects', null],
      ['customer', 'Kevin Alvarez, a new customer', null],
      ['candidate', 'A candidate, to the hiring board', null],
      ['team', 'One of our own team', null],
      ['someone_else', 'Someone else', null],
    ])
  })
  it('every word a person reads passes plain words', () => {
    const texts = [...whoGuesses(row, 'bids', KNOWN), ...whoGuesses({ who: '(210) 555-0188', body: 'Hi this is Kevin Alvarez.' }, 'team', KNOWN)].flatMap((g) => [g.label, g.words, g.makes?.hint ?? '', namedWords(g)])
    expect(texts.filter(Boolean).flatMap(plainWordsFailures)).toEqual([])
  })
})
