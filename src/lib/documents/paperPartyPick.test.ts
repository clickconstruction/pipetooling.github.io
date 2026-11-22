/**
 * Send a paper's second window, Who is it with?: what it lists for what is typed, the pick each row makes, and what the
 * email window says about the party and the signer. Every name, company and address here is made up.
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  PARTY_CHIPS,
  UNLISTED_ROW_TITLE,
  keepSignerWords,
  ADDRESS_NOT_CHECKED,
  KNOWN_ADDRESS_PRESS_AGAIN,
  addressLookUpVerdict,
  knownAddressRefusal,
  knownAddressWords,
  partyFindAsksCustomers,
  partyFindHint,
  partyNameToKeep,
  partyRows,
  partySaysLine,
  partySigningFor,
  repName,
  sendPartyHint,
  sendWindowPartyOfPick,
  type PartyLists,
  type PartyPick,
} from './paperPartyPick'

const lists: PartyLists = {
  roster: [
    { name: 'Pat Tallman', sub: false },
    { name: 'Ortega Mechanical', sub: true },
    { name: 'Priya Nair', sub: false },
  ],
  customerPeople: [
    { id: 'cp1', name: 'Dana Ruiz', email: 'dana@ridgeway.example', customerId: 'c1', customerName: 'Ridgeway Builders' },
    { id: 'cp2', name: 'Avery Tall', email: null, customerId: 'c3', customerName: 'Dalton Property Group' },
  ],
  supplyHouses: [
    { id: 'h1', name: 'Tallgrass Supply Co.' },
    { id: 'h2', name: 'Cedar Pipe and Supply' },
  ],
  reps: [
    { id: 'r1', name: 'Lena Park', label: 'Branch manager', email: 'lena@tallgrass.example', houseId: 'h1', houseName: 'Tallgrass Supply Co.' },
    { id: 'r2', name: null, label: 'Credit desk', email: 'credit@tallgrass.example', houseId: 'h1', houseName: 'Tallgrass Supply Co.' },
  ],
  customers: [],
}

const titles = (typed: string, chip: Parameters<typeof partyRows>[2] = 'all', customers: PartyLists['customers'] = []) =>
  partyRows({ ...lists, customers }, typed, chip).map((r) => `${r.title} | ${r.sub} | ${r.tag}`)

describe('the chips', () => {
  it('are All, Team, Subs, Customers and Supply houses', () => {
    expect(PARTY_CHIPS.map((c) => c.label)).toEqual(['All', 'Team', 'Subs', 'Customers', 'Supply houses'])
  })

  it('the find box asks the database for customers at two letters, under All and Customers', () => {
    expect(partyFindAsksCustomers('t', 'all')).toBe(false)
    expect(partyFindAsksCustomers('ta', 'all')).toBe(true)
    expect(partyFindAsksCustomers('ta', 'customers')).toBe(true)
    expect(partyFindAsksCustomers('tall', 'supply')).toBe(false)
    expect(partyFindAsksCustomers('tall', 'team')).toBe(false)
  })

  it('says how a customer is found while nothing is typed', () => {
    expect(partyFindHint('', 'customers')).toBe('Type a customer’s name to find them.')
    expect(partyFindHint('', 'all')).toBe('Type a name to find a customer or a supply house.')
    expect(partyFindHint('ta', 'all')).toBe('')
    expect(partyFindHint('', 'team')).toBe('')
  })
})

describe('the rows', () => {
  it('with nothing typed, All is the roster, and Someone not in any list is last', () => {
    expect(titles('')).toEqual(['Ortega Mechanical | Signs for themselves | Sub', 'Pat Tallman | Signs for themselves | Staff', 'Priya Nair | Signs for themselves | Staff', `${UNLISTED_ROW_TITLE} | Type their name and email next. | Not on a list`])
  })

  it('Team and Subs split the roster', () => {
    expect(titles('', 'team').slice(0, -1)).toEqual(['Pat Tallman | Signs for themselves | Staff', 'Priya Nair | Signs for themselves | Staff'])
    expect(titles('', 'subs').slice(0, -1)).toEqual(['Ortega Mechanical | Signs for themselves | Sub'])
  })

  it('Supply houses lists every house with its reps, then the house for someone not listed', () => {
    expect(titles('', 'supply').slice(0, -1)).toEqual([
      'Cedar Pipe and Supply | No one on file. You name the signer next. | Supply house',
      'Credit desk | Tallgrass Supply Co. | Supply house',
      'Lena Park | Branch manager · Tallgrass Supply Co. | Supply house',
      'Tallgrass Supply Co. | Someone not listed. You name the signer next. | Supply house',
    ])
  })

  it('a typed word finds a company with its people, a customer the database found, and the roster', () => {
    expect(titles('tall', 'all', [{ id: 'c2', name: 'Tallgrass Homes' }])).toEqual([
      'Credit desk | Tallgrass Supply Co. | Supply house',
      'Lena Park | Branch manager · Tallgrass Supply Co. | Supply house',
      'Tallgrass Supply Co. | Someone not listed. You name the signer next. | Supply house',
      // A person on file whose own name holds the word brings their customer's row with them alone.
      'Avery Tall | Dalton Property Group | Customer',
      'Tallgrass Homes | No one on file. You name the signer next. | Customer',
      'Pat Tallman | Signs for themselves | Staff',
      `${UNLISTED_ROW_TITLE} | Type their name and email next. | Not on a list`,
    ])
  })

  it('a person’s name finds that person alone, without their company’s other people', () => {
    expect(titles('lena')).toEqual(['Lena Park | Branch manager · Tallgrass Supply Co. | Supply house', `${UNLISTED_ROW_TITLE} | Type their name and email next. | Not on a list`])
  })

  it('a customer the database found lists the people on file there', () => {
    expect(titles('ridge', 'customers', [{ id: 'c1', name: 'Ridgeway Builders' }])).toEqual([
      'Dana Ruiz | Ridgeway Builders | Customer',
      'Ridgeway Builders | Someone not listed. You name the signer next. | Customer',
      `${UNLISTED_ROW_TITLE} | Type their name and email next. | Not on a list`,
    ])
  })

  it('Someone not in any list is always there, whatever is typed', () => {
    expect(titles('zzzz no such')).toEqual([`${UNLISTED_ROW_TITLE} | Type their name and email next. | Not on a list`])
  })

  it('every row has its own key', () => {
    const rows = partyRows({ ...lists, customers: [{ id: 'c1', name: 'Ridgeway Builders' }] }, 'r', 'all')
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length)
  })

  it('a label that is only part of a rep’s name is no title', () => {
    const rows = partyRows({ ...lists, reps: [{ id: 'r9', name: 'Lena Park', label: 'Lena', email: 'lena@tallgrass.example', houseId: 'h1', houseName: 'Tallgrass Supply Co.' }] }, 'lena', 'supply')
    expect(rows[0]?.sub).toBe('Tallgrass Supply Co.')
    expect(rows[0]?.pick).toMatchObject({ signer: { name: 'Lena Park', title: '' } })
  })

  it('a desk with no name is named by its label', () => {
    expect(repName({ name: null, label: 'Credit desk' })).toBe('Credit desk')
    expect(repName({ name: ' Lena Park ', label: 'Lena' })).toBe('Lena Park')
    expect(repName({ name: null, label: null })).toBe('A desk')
  })
})

describe('a pick', () => {
  const pick = (title: string, typed = '', chip: Parameters<typeof partyRows>[2] = 'supply'): PartyPick => partyRows(lists, typed, chip).find((r) => r.title === title)!.pick

  it('a person on the roster is their own paper, filed under their name', () => {
    expect(pick('Pat Tallman', '', 'all')).toEqual({ kind: 'roster', personName: 'Pat Tallman' })
  })

  it('a rep names the supply house as the party and the rep as the signer', () => {
    expect(pick('Lena Park')).toEqual({
      kind: 'record',
      business: { table: 'supply_houses', id: 'h1', name: 'Tallgrass Supply Co.', party: 'supply_house' },
      record: { table: 'supply_house_contacts', id: 'r1' },
      signer: { name: 'Lena Park', title: 'Branch manager', email: 'lena@tallgrass.example' },
    })
  })

  it('a company picked alone has no signer yet', () => {
    expect(pick('Tallgrass Supply Co.')).toEqual({ kind: 'record', business: { table: 'supply_houses', id: 'h1', name: 'Tallgrass Supply Co.', party: 'supply_house' }, record: { table: 'supply_houses', id: 'h1' }, signer: null })
  })

  it('the last row is someone on no list', () => {
    expect(pick(UNLISTED_ROW_TITLE)).toEqual({ kind: 'unlisted' })
  })
})

describe('what the email window says', () => {
  const company = sendWindowPartyOfPick({ kind: 'record', business: { table: 'customers', id: 'c2', name: 'Tallgrass Homes', party: 'customer' }, record: { table: 'customers', id: 'c2' }, signer: null })
  const rep = sendWindowPartyOfPick({
    kind: 'record',
    business: { table: 'supply_houses', id: 'h1', name: 'Tallgrass Supply Co.', party: 'supply_house' },
    record: { table: 'supply_house_contacts', id: 'r1' },
    signer: { name: 'Lena Park', title: 'Branch manager', email: 'lena@tallgrass.example' },
  })
  const unlisted = sendWindowPartyOfPick({ kind: 'unlisted' })

  it('a pick becomes what the window shows', () => {
    expect(rep).toEqual({ name: 'Tallgrass Supply Co.', unlisted: false, keepWith: null })
    expect(company).toEqual({ name: 'Tallgrass Homes', unlisted: false, keepWith: 'Tallgrass Homes' })
    expect(unlisted).toEqual({ name: '', unlisted: true, keepWith: null })
  })

  it('names the paper and the party under the title', () => {
    expect(sendPartyHint('Mutual secrecy agreement', rep)).toBe('Mutual secrecy agreement · Tallgrass Supply Co.')
    expect(sendPartyHint('Mutual secrecy agreement', unlisted)).toBe('Mutual secrecy agreement · not on a list')
  })

  it('says what the paper will say', () => {
    expect(partySaysLine(rep, '', 'Lena Park', 'Branch manager')).toBe('Lena Park, Branch manager, signing for Tallgrass Supply Co.')
    expect(partySaysLine(unlisted, 'Haddad Engineering', 'Noor Haddad', 'Structural engineer')).toBe('Noor Haddad, Structural engineer, signing for Haddad Engineering')
    // Someone on no list with no company signs for themselves.
    expect(partySaysLine(unlisted, '', 'Noor Haddad', '')).toBe('Noor Haddad')
    expect(partySaysLine(company, '', '', 'Owner')).toBe('')
  })

  it('freezes the party’s name: the business, else the typed company, else the signer', () => {
    expect(partyNameToKeep(rep, 'ignored', 'Lena Park')).toBe('Tallgrass Supply Co.')
    expect(partyNameToKeep(unlisted, ' Haddad Engineering ', 'Noor Haddad')).toBe('Haddad Engineering')
    expect(partyNameToKeep(unlisted, '', ' Noor Haddad ')).toBe('Noor Haddad')
    expect(partySigningFor(unlisted, '', 'Noor Haddad')).toBeNull()
    expect(partySigningFor(company, '', 'Wren Castillo')).toBe('Tallgrass Homes')
  })

  it('the tick names who is kept with whom', () => {
    expect(keepSignerWords(' Wren Castillo ', 'Tallgrass Homes')).toBe('Keep Wren Castillo with Tallgrass Homes')
    expect(keepSignerWords('', 'Tallgrass Homes')).toBe('')
  })

  it('an address the app already knows is named, so nobody is added twice', () => {
    expect(knownAddressWords({ name: 'Lena Park', party: 'supply_house' })).toBe('The app already keeps this address: Lena Park, at a supply house. The paper goes to that record, and nobody is added twice.')
    expect(knownAddressWords({ name: 'Noor Haddad', party: 'none' })).toBe('The app already keeps this address: Noor Haddad. The paper goes to that record, and nobody is added twice.')
    expect(knownAddressWords(null)).toBe('')
    expect(knownAddressRefusal({ name: 'Lena Park', party: 'supply_house' })).toBeNull()
    expect(knownAddressRefusal(null)).toBeNull()
  })

  it('an address that is someone on the roster is refused: they are picked from the list', () => {
    expect(knownAddressRefusal({ name: 'Pat Tallman', party: 'person' })).toBe('This address is Pat Tallman, who is on the roster. Close this and pick them from the list.')
    expect(knownAddressWords({ name: 'Pat Tallman', party: 'person' })).toBe('')
  })
})

describe('a press of Send email and the address look-up', () => {
  it('sends when nobody holds the address', () => {
    expect(addressLookUpVerdict(null, false)).toEqual({ kind: 'send' })
    expect(addressLookUpVerdict(null, true)).toEqual({ kind: 'send' })
  })

  it('refuses someone on the roster, whether or not the window had named them', () => {
    const pat = { name: 'Pat Tallman', party: 'person' as const }
    expect(addressLookUpVerdict(pat, false)).toEqual({ kind: 'hold', why: 'This address is Pat Tallman, who is on the roster. Close this and pick them from the list.' })
    expect(addressLookUpVerdict(pat, true)).toEqual(addressLookUpVerdict(pat, false))
  })

  it('names who holds the address and holds once, when the press came before the window named them', () => {
    const lena = { name: 'Lena Park', party: 'supply_house' as const }
    expect(addressLookUpVerdict(lena, false)).toEqual({
      kind: 'hold',
      why: 'The app already keeps this address: Lena Park, at a supply house. The paper goes to that record, and nobody is added twice. Press Send email again to send it to them.',
    })
  })

  it('sends to someone the window had already named', () => {
    expect(addressLookUpVerdict({ name: 'Lena Park', party: 'supply_house' }, true)).toEqual({ kind: 'send' })
    expect(addressLookUpVerdict({ name: 'Noor Haddad', party: 'none' }, true)).toEqual({ kind: 'send' })
  })

  it('keeps its words plain', () => {
    for (const words of [ADDRESS_NOT_CHECKED, KNOWN_ADDRESS_PRESS_AGAIN]) expect(plainWordsFailures(words), words).toEqual([])
  })
})
