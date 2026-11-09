import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  emptyPersonDraft,
  letterCopies,
  letterRecipients,
  peopleFromRows,
  personDraftProblem,
  personRoleWords,
  personUseWords,
  reachWords,
  recipientLabel,
  refusedWords,
  seedPeople,
  seededFromWords,
  LEGAL_PERSON_ROLES,
  PEOPLE_EMPTY_WORDS,
  type LegalMatterPersonLike,
  type LegalMatterPersonRow,
} from './legalMatterPeople'

const row = (id: string, more: Partial<LegalMatterPersonRow> = {}): LegalMatterPersonRow => ({
  id,
  name: 'R. Calloway',
  role: 'president',
  organization: 'Sable Ridge Builders',
  email: 'rcalloway@srb-partners.example',
  phone: '',
  mailing_address: '',
  use: 'letters',
  reason: '',
  seeded_from: null,
  added_at: '2026-10-20T15:00:00Z',
  ...more,
})

describe('peopleFromRows: the stored rows as the list reads them', () => {
  it('keeps the order added and reads an unknown role or use as other and copies', () => {
    const people = peopleFromRows([row('b', { added_at: '2026-10-21T15:00:00Z', role: 'ceo', use: 'maybe' }), row('a')])
    expect(people.map((p) => p.id)).toEqual(['a', 'b'])
    expect(people[1]).toMatchObject({ role: 'other', use: 'copies', seededFrom: null })
  })

  it('words every role and use in plain words, and says where a seeded row came from', () => {
    for (const r of LEGAL_PERSON_ROLES) expect(plainWordsFailures(personRoleWords(r))).toEqual([])
    expect(personUseWords('never', 'a witness, not a recipient')).toBe('never — a witness, not a recipient')
    expect(personUseWords('letters', 'ignored')).toBe('letters')
    expect(seededFromWords('property')).toBe('seeded from the property record')
    expect(reachWords({ email: '', phone: '(555) 014-2251', mailingAddress: '' })).toBe('(555) 014-2251')
    expect(reachWords({ email: '', phone: '', mailingAddress: '' })).toBe('no way to reach them on file')
    expect(plainWordsFailures(PEOPLE_EMPTY_WORDS)).toEqual([])
  })
})

describe('personDraftProblem: the RPC’s rules, client side', () => {
  it('needs a name, a role, a use, and a reason on a never', () => {
    expect(personDraftProblem(emptyPersonDraft())).toBe('Name the person.')
    expect(personDraftProblem({ ...emptyPersonDraft(), name: 'D. Marsh', use: 'never' })).toBe('Say why letters never go to them.')
    expect(personDraftProblem({ ...emptyPersonDraft(), name: 'D. Marsh', use: 'never', reason: 'a witness, not a recipient' })).toBeNull()
    expect(emptyPersonDraft('witness').use).toBe('never')
    expect(emptyPersonDraft('billing').use).toBe('letters')
  })
})

describe('seedPeople: the first rows from the record', () => {
  const account = {
    payer: { key: 'c:1', customerId: '1', name: 'Sable Ridge Builders', viaGc: true },
    customerAddress: '2200 Mercer Mill Rd, Ste 140',
    contacts: [{ name: 'M. Osei', email: 'accounts@srb-partners.example', phone: null, note: null }, { name: 'M. Osei', email: 'accounts@srb-partners.example', phone: '(555) 014-7720', note: null }],
    emails: ['legal@sableridgebuild.example'],
    phones: ['(555) 014-7720'],
    properties: [
      { owner: 'Pecan Hollow Holdings LLC', ownerMailingAddress: 'PO Box 418, Brenham TX' },
      { owner: '', ownerMailingAddress: '' },
    ] as unknown as Parameters<typeof seedPeople>[0]['properties'],
  }

  it('seeds the payer as a To, each contact as a To, each owner of record as a copy, and never the same person twice', () => {
    const rows = seedPeople(account)
    expect(rows.map((r) => [r.name, r.role, r.use, r.seeded_from])).toEqual([
      ['Sable Ridge Builders', 'customer', 'letters', 'customer'],
      ['M. Osei', 'billing', 'letters', 'contact_person'],
      ['Pecan Hollow Holdings LLC', 'owner', 'copies', 'property'],
    ])
    expect(rows[0]).toMatchObject({ email: 'legal@sableridgebuild.example', phone: '(555) 014-7720', mailing_address: '2200 Mercer Mill Rd, Ste 140' })
    expect(rows[2]!.mailing_address).toBe('PO Box 418, Brenham TX')
  })
})

describe('letterRecipients: the picker from the list', () => {
  const people: LegalMatterPersonLike[] = peopleFromRows([
    row('p1'),
    row('p2', { name: 'M. Osei', role: 'billing', email: 'accounts@srb-partners.example' }),
    row('p3', { name: 'Pecan Hollow Holdings LLC', role: 'owner', email: '', mailing_address: 'PO Box 418, Brenham TX', use: 'copies', seeded_from: 'property' }),
    row('p4', { name: 'D. Marsh', role: 'inspector', email: '', phone: '(555) 014-2251', use: 'never', reason: 'a witness, not a recipient' }),
    row('p5', { name: 'legal@sableridgebuild.example', role: 'customer', email: 'legal@sableridgebuild.example', use: 'never', reason: 'bounces (Oct 3)' }),
    row('p6', { name: 'J. Trinh', role: 'tenant', email: '', mailing_address: '', use: 'copies' }),
  ])

  it('splits To, copies and never, labels each with the role, and refuses a never with its reason or a row with nowhere to go', () => {
    const r = letterRecipients(people)
    expect(r.to.map((x) => x.label)).toEqual(['R. Calloway · their president', 'M. Osei · their billing'])
    expect(r.copies.map((x) => x.person.id)).toEqual(['p3', 'p6'])
    expect(r.copies[1]!.refused).toBe('no email or mailing address on file')
    expect(r.never.map((x) => x.refused)).toEqual(['never — a witness, not a recipient', 'never — bounces (Oct 3)'])
    expect(recipientLabel({ name: 'A. Ferris', role: 'counsel' })).toBe('A. Ferris · our counsel')
    expect(refusedWords([...r.never, ...r.copies])).toEqual([
      'D. Marsh cannot be picked: never — a witness, not a recipient.',
      'legal@sableridgebuild.example cannot be picked: never — bounces (Oct 3).',
      'J. Trinh cannot be picked: no email or mailing address on file.',
    ])
  })
})

describe('letterCopies: the letter’s Copies to line (v2.6741)', () => {
  it('takes every row marked copies, in order, with the role in words and the mailing address; never a To or a never', () => {
    const people: LegalMatterPersonLike[] = [
      { id: 'p1', name: 'R. Calloway', role: 'president', organization: '', email: 'r@x.test', phone: '', mailingAddress: '', use: 'letters', reason: '', seededFrom: null },
      { id: 'p2', name: 'Pecan Hollow Holdings LLC', role: 'owner', organization: '', email: '', phone: '', mailingAddress: 'PO Box 418, Brenham TX', use: 'copies', reason: '', seededFrom: 'property' },
      { id: 'p3', name: 'D. Marsh', role: 'inspector', organization: '', email: '', phone: '', mailingAddress: '', use: 'never', reason: 'a witness', seededFrom: null },
      { id: 'p4', name: 'T. Nguyen', role: 'tenant', organization: '', email: '', phone: '', mailingAddress: '', use: 'copies', reason: '', seededFrom: null },
    ]
    expect(letterCopies(people)).toEqual([
      { personId: 'p2', name: 'Pecan Hollow Holdings LLC', role: 'owner of record', address: 'PO Box 418, Brenham TX' },
      { personId: 'p4', name: 'T. Nguyen', role: 'tenant', address: '' },
    ])
    expect(letterCopies([])).toEqual([])
  })
})
