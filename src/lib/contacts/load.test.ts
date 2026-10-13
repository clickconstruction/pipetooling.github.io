import { describe, expect, it } from 'vitest'
import { SPINE_CHANNELS, SPINE_CONTACTS, SPINE_JOBS, SPINE_RECORDS, SPINE_USER_NAMES } from '../messages/spineRows'
import { contactById, firstName, kindOf, matchChannel, nameContact } from './kernel'
import { contactFromRows, contactRecordOfRow, contactsFromRows, offFlowFromRow, type ContactRecordRows, type ContactRow } from './load'

const loaded = contactsFromRows(SPINE_CONTACTS, SPINE_CHANNELS, SPINE_JOBS, SPINE_RECORDS)
const who = (id: string) => contactById(loaded, id)!
const row = (id: string): ContactRow => SPINE_CONTACTS.find((r) => r.id === id)!

describe('the contacts as the screens load them (rows shaped like the seed)', () => {
  it('reads the record each row points at', () => {
    expect(SPINE_CONTACTS.map((r) => contactRecordOfRow(r)?.table ?? null)).toEqual([
      'gc_companies',
      'gc_company_people',
      'customer_contact_persons',
      'customer_contact_persons',
      'customers',
      'gc_companies',
      'people',
      null,
      null,
    ])
  })

  it('names each person from their record, with the company and a trade partner’s trades', () => {
    expect(loaded.map((c) => [c.id, c.kind, c.name, c.company, c.trade ?? ''])).toEqual([
      ['c-greg', 'trade', 'Greg Paulk', 'Hillside Excavation', 'Sitework'],
      ['c-dana', 'trade', 'Dana Paulk', 'Hillside Excavation', 'Sitework'],
      ['c-elena', 'customer', 'Elena Marchetti', 'Cibolo Creek Partners', ''],
      ['c-jonah', 'arch', 'Jonah Vale', 'Marsh & Vale Architects', ''],
      // A customer with nobody named at it is its own person.
      ['c-bell', 'customer', 'Bell Family Dental', '', ''],
      // Dee on Alamo's row under her own name: the row's main contact is someone else.
      ['c-dee', 'trade', 'Dee', 'Alamo Concrete', 'Concrete, Flatwork'],
      ['c-sam', 'trade', 'Sam Roster', '', ''],
      // A number nobody has named reads as its number; a deleted person's number keeps the name.
      ['c-unknown', 'unknown', '(830) 555-0199', '', ''],
      ['c-pat', 'unknown', 'Pat Former', '', ''],
    ])
  })

  it('a person moved onto a customer’s row under her own name is at the customer', () => {
    const moved = { ...row('c-bell'), id: 'c-moved', customer_id: 'cust-cibolo', name: 'Elena Marchetti', off_since: null, off_why: null, off_by: null }
    expect(contactFromRows(moved, [], [], SPINE_RECORDS)).toMatchObject({ name: 'Elena Marchetti', company: 'Cibolo Creek Partners', record: { table: 'customers', id: 'cust-cibolo' } })
  })

  it('puts numbers before addresses, keeps a STOP on its number, and reads past a kind it does not know', () => {
    expect(who('c-greg').channels.map((ch) => ch.id)).toEqual(['ch-greg-phone', 'ch-greg-email'])
    expect(who('c-elena').channels).toEqual([
      { id: 'ch-elena-phone', kind: 'phone', value: '(210) 555-0188', optedOutAt: '2026-10-01T17:00:00.000Z' },
      { id: 'ch-elena-email', kind: 'email', value: 'elena@cibolocreek.example', optedOutAt: null },
    ])
  })

  it('reads the office’s ties as job keys in the order they were added, with the star apart', () => {
    expect(who('c-greg')).toMatchObject({ jobIds: ['bid:bid-boerne', 'project:proj-stoneoak'], defaultJobId: 'project:proj-stoneoak' })
    expect(who('c-elena')).toMatchObject({ jobIds: ['pipeline:jl-fairoaks'], defaultJobId: null })
    expect(who('c-dana')).toMatchObject({ jobIds: [], defaultJobId: null })
  })

  it('what they go by, trimmed, and a blank one is none', () => {
    expect(who('c-sam').goesBy).toBe('Sammy')
    expect(firstName(who('c-sam'))).toBe('Sammy')
    expect(contactFromRows({ ...row('c-sam'), goes_by: '  ' }, [], [], SPINE_RECORDS)!.goesBy).toBeNull()
  })

  it('a record the reader cannot see falls back to the contact’s own name, then its first number', () => {
    expect(contactFromRows(row('c-greg'), SPINE_CHANNELS, [], {})).toMatchObject({ name: '(210) 555-0113', company: '' })
    expect(contactFromRows(row('c-dee'), SPINE_CHANNELS, [], {})).toMatchObject({ name: 'Dee' })
    expect(contactFromRows(row('c-greg'), [], [], {})!.name).toBe('')
  })

  it('leaves out a kind this build does not know', () => {
    expect(contactFromRows({ ...row('c-greg'), kind: 'vendor' }, SPINE_CHANNELS, SPINE_JOBS, SPINE_RECORDS)).toBeNull()
    expect(contactsFromRows([...SPINE_CONTACTS, { ...row('c-greg'), id: 'c-odd', kind: 'vendor' }], SPINE_CHANNELS, SPINE_JOBS, SPINE_RECORDS)).toHaveLength(SPINE_CONTACTS.length)
  })

  it('reads off the flow for cut 4: since, why, and who by name', () => {
    expect(offFlowFromRow(row('c-bell'), SPINE_USER_NAMES)).toEqual({ since: '2026-09-29', why: 'Declined our bid, went with another plumber.', by: 'Rosa' })
    expect(offFlowFromRow(row('c-greg'), SPINE_USER_NAMES)).toBeNull()
    expect(offFlowFromRow({ off_since: '2026-09-29', off_why: null, off_by: 'u-gone' }, SPINE_USER_NAMES)).toEqual({ since: '2026-09-29', why: '', by: '' })
  })
})

describe('the four kinds of 2026-10-13 (rows as R0’s SQL PR shapes them)', () => {
  const base: ContactRow = { ...row('c-greg'), gc_company_id: null, name: null, goes_by: null, off_since: null, off_why: null, off_by: null }
  const ROWS: ContactRow[] = [
    { ...base, id: 'c-kevin', kind: 'lead', prospect_id: 'pr-alvarez' },
    { ...base, id: 'c-shop', kind: 'lead', prospect_id: 'pr-shop' },
    { ...base, id: 'c-counter', kind: 'supply_house', supply_house_id: 'sh-hill' },
    { ...base, id: 'c-ray', kind: 'supply_house', supply_house_id: 'sh-hill', name: 'Ray' },
    { ...base, id: 'c-maria', kind: 'supply_house', supply_house_contact_id: 'shc-maria' },
    { ...base, id: 'c-luis', kind: 'candidate', team_prospect_id: 'tp-luis' },
    { ...base, id: 'c-tony', kind: 'sub', person_id: 'p-tony' },
  ]
  const RECORDS: ContactRecordRows = {
    prospects: [
      { id: 'pr-alvarez', contact_name: 'Kevin Alvarez', company_name: 'Alvarez Family Dental' },
      { id: 'pr-shop', contact_name: ' ', company_name: 'Leon Springs Coffee' },
    ],
    supplyHouses: [{ id: 'sh-hill', name: 'Hill Country Pipe Supply' }],
    supplyHouseContacts: [{ id: 'shc-maria', supply_house_id: 'sh-hill', name: 'Maria Soto' }],
    teamProspects: [{ id: 'tp-luis', name: 'Luis Ortega' }],
    people: [{ id: 'p-tony', name: 'Tony Reyes' }],
  }
  const four = contactsFromRows(ROWS, [], [], RECORDS)

  it('reads the record each new column points at', () => {
    expect(ROWS.map((r) => contactRecordOfRow(r))).toEqual([
      { table: 'prospects', id: 'pr-alvarez' },
      { table: 'prospects', id: 'pr-shop' },
      { table: 'supply_houses', id: 'sh-hill' },
      { table: 'supply_houses', id: 'sh-hill' },
      { table: 'supply_house_contacts', id: 'shc-maria' },
      { table: 'team_prospects', id: 'tp-luis' },
      { table: 'people', id: 'p-tony' },
    ])
  })

  it('names each from their record, with the company they are at', () => {
    expect(four.map((c) => [c.id, c.kind, c.name, c.company])).toEqual([
      ['c-kevin', 'lead', 'Kevin Alvarez', 'Alvarez Family Dental'],
      // Prospects names nobody at the company, so the lead is the company.
      ['c-shop', 'lead', 'Leon Springs Coffee', ''],
      // The counter is the house's own person; Ray on its row under his own name is at it.
      ['c-counter', 'supply_house', 'Hill Country Pipe Supply', ''],
      ['c-ray', 'supply_house', 'Ray', 'Hill Country Pipe Supply'],
      ['c-maria', 'supply_house', 'Maria Soto', 'Hill Country Pipe Supply'],
      ['c-luis', 'candidate', 'Luis Ortega', ''],
      ['c-tony', 'sub', 'Tony Reyes', ''],
    ])
  })

  it('a sub on the roster loads as the kind kindOf gives from the roster', () => {
    const tony = contactById(four, 'c-tony')!
    expect(kindOf(tony.record!, 'sub')).toBe(tony.kind)
    expect(firstName(tony)).toBe('Tony')
  })

  it('Who is this? finds Ray by his name on the house’s row, and Maria as her own rep', () => {
    const unknown = contactFromRows(row('c-unknown'), SPINE_CHANNELS, [], SPINE_RECORDS)!
    const all = [...four, unknown]
    expect(nameContact(all, 'c-unknown', { record: { table: 'supply_houses', id: 'sh-hill' }, kind: 'supply_house', name: ' ray ', company: '' })).toMatchObject({ way: 'merge', into: { id: 'c-ray' } })
    expect(nameContact(all, 'c-unknown', { record: { table: 'supply_house_contacts', id: 'shc-maria' }, kind: 'supply_house', name: 'Maria Soto', company: '' })).toMatchObject({ way: 'merge', into: { id: 'c-maria' } })
    expect(nameContact(all, 'c-unknown', { record: { table: 'supply_houses', id: 'sh-hill' }, kind: 'supply_house', name: 'Dee', company: '' })).toMatchObject({ way: 'repoint' })
  })

  it('a record the reader cannot see falls back to the contact’s own name, then its first number', () => {
    expect(contactFromRows(ROWS[3]!, [], [], {})).toMatchObject({ name: 'Ray', company: '' })
    expect(contactFromRows({ ...ROWS[4]!, id: 'c-unknown' }, SPINE_CHANNELS, [], {})).toMatchObject({ name: '(830) 555-0199', company: '' })
  })
})

describe('the loaded contacts under the kernels', () => {
  it('match a webhook’s number and greet by the record’s name', () => {
    expect(matchChannel(loaded, 'phone', '+12105550113')).toMatchObject({ match: 'one', contact: { id: 'c-greg' }, channel: { id: 'ch-greg-phone' } })
    expect(firstName(who('c-greg'))).toBe('Greg')
    expect(firstName(who('c-unknown'))).toBe('')
  })

  it('Who is this? on the unknown number finds Dee by her name on Alamo’s row, and Greg as Hillside’s own', () => {
    expect(nameContact(loaded, 'c-unknown', { record: { table: 'gc_companies', id: 'gc-alamo' }, kind: 'trade', name: 'dee', company: 'Alamo Concrete' })).toMatchObject({
      way: 'merge',
      into: { id: 'c-dee' },
    })
    expect(nameContact(loaded, 'c-unknown', { record: { table: 'gc_companies', id: 'gc-hillside' }, kind: 'trade', name: 'Greg Paulk', company: 'Hillside Excavation' })).toMatchObject({
      way: 'merge',
      into: { id: 'c-greg' },
    })
  })
})
