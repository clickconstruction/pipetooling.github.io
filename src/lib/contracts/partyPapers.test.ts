/**
 * The party's own page (punch list #403, step 4): which papers are a party's, and what a line says. Every name is made up.
 */
import { describe, expect, it } from 'vitest'
import { plainSentence } from '../valuesInPlace'
import {
  canReadPartyPapers,
  canSendPartyPapers,
  contactIsOfParty,
  papersOfParty,
  partyContactIds,
  partyPaperCountWords,
  partyPaperKindWords,
  partyPaperLine,
  partyPaperLines,
  partyPapersEmptyWords,
  replacedPaperIds,
  type PartyContactRow,
  type PartyPaperRow,
} from './partyPapers'

const contact = (id: string, p: Partial<PartyContactRow> = {}): PartyContactRow => ({
  id,
  customer_id: null,
  customer_contact_person_id: null,
  supply_house_id: null,
  supply_house_contact_id: null,
  ...p,
})

const paper = (id: string, p: Partial<PartyPaperRow> = {}): PartyPaperRow => ({
  id,
  document_name: 'Mutual secrecy agreement',
  doc_type: 'agreement',
  status: 'sent',
  party_contact_id: 'k-house',
  signer_name: 'Lena Park',
  signer_title: 'Branch manager',
  signer_printed_name: null,
  signed_at: null,
  sent_at: '2026-11-16T15:00:00Z',
  created_at: '2026-11-16T14:00:00Z',
  signer_last_viewed_at: null,
  supersedes_person_contract_document_id: null,
  ...p,
})

const TODAY = '2026-11-21'

describe('who reads a party’s papers', () => {
  it('lists them for the four roles and the estimator, and for nobody else', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'estimator']) expect(canReadPartyPapers(role)).toBe(true)
    for (const role of ['primary', 'superintendent', 'subcontractor', 'helpers', '', null, undefined]) expect(canReadPartyPapers(role)).toBe(false)
  })

  it('keeps sending with the four roles: an estimator reads and does not send', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller']) expect(canSendPartyPapers(role)).toBe(true)
    for (const role of ['estimator', 'primary', 'superintendent', null]) expect(canSendPartyPapers(role)).toBe(false)
  })
})

describe('which contacts are a party’s', () => {
  const customer = { kind: 'customer' as const, id: 'c1' }
  const house = { kind: 'supply_house' as const, id: 'h1' }

  it('takes a customer’s own contact and the contact of a person at that customer', () => {
    expect(contactIsOfParty(contact('k1', { customer_id: 'c1' }), customer, new Set())).toBe(true)
    expect(contactIsOfParty(contact('k2', { customer_contact_person_id: 'p1' }), customer, new Set(['p1']))).toBe(true)
  })

  it('leaves out another customer, a person at another customer and a supply house of the same id', () => {
    expect(contactIsOfParty(contact('k1', { customer_id: 'c2' }), customer, new Set(['p1']))).toBe(false)
    expect(contactIsOfParty(contact('k2', { customer_contact_person_id: 'p9' }), customer, new Set(['p1']))).toBe(false)
    expect(contactIsOfParty(contact('k3', { supply_house_id: 'c1' }), customer, new Set())).toBe(false)
  })

  it('takes a supply house’s own contact and the contact of one of its reps', () => {
    expect(contactIsOfParty(contact('k1', { supply_house_id: 'h1' }), house, new Set())).toBe(true)
    expect(contactIsOfParty(contact('k2', { supply_house_contact_id: 'r1' }), house, new Set(['r1']))).toBe(true)
    expect(contactIsOfParty(contact('k3', { supply_house_contact_id: 'r2' }), house, new Set(['r1']))).toBe(false)
    expect(contactIsOfParty(contact('k4', { customer_id: 'h1' }), house, new Set())).toBe(false)
  })

  it('takes nothing for a party with no id, and no contact with no record at all', () => {
    expect(contactIsOfParty(contact('k1', { customer_id: '' }), { kind: 'customer', id: '' }, new Set())).toBe(false)
    expect(contactIsOfParty(contact('k1'), customer, new Set(['p1']))).toBe(false)
  })

  it('answers each contact once, in the order given', () => {
    const rows = [contact('k2', { supply_house_contact_id: 'r1' }), contact('k1', { supply_house_id: 'h1' }), contact('k2', { supply_house_contact_id: 'r1' }), contact('k9', { supply_house_id: 'h2' })]
    expect(partyContactIds(house, ['r1'], rows)).toEqual(['k2', 'k1'])
  })
})

describe('which papers are a party’s', () => {
  it('keeps the papers with one of the party’s contacts and leaves the rest out', () => {
    const rows = [paper('a', { party_contact_id: 'k-house' }), paper('b', { party_contact_id: 'k-rep' }), paper('c', { party_contact_id: 'k-other' }), paper('d', { party_contact_id: null })]
    expect(papersOfParty(rows, ['k-house', 'k-rep']).map((r) => r.id).sort()).toEqual(['a', 'b'])
  })

  it('never takes a paper with no party, even when no contact is asked for', () => {
    expect(papersOfParty([paper('d', { party_contact_id: null })], [])).toEqual([])
  })

  it('lists a paper once, newest first: the signed day, the moment it was sent, the moment it was made', () => {
    const rows = [
      paper('made', { status: 'unsent', sent_at: null, created_at: '2026-11-21T04:00:00Z' }),
      paper('sent', { status: 'sent', sent_at: '2026-11-18T15:00:00Z' }),
      paper('signed', { status: 'signed', signed_at: '2026-11-20', sent_at: '2026-11-10T15:00:00Z' }),
      paper('sent', { status: 'sent', sent_at: '2026-11-18T15:00:00Z' }),
    ]
    expect(papersOfParty(rows, ['k-house']).map((r) => r.id)).toEqual(['made', 'signed', 'sent'])
  })

  it('knows the papers a newer one replaced', () => {
    const rows = [paper('old', { status: 'signed', signed_at: '2026-10-01' }), paper('new', { supersedes_person_contract_document_id: 'old' })]
    expect([...replacedPaperIds(rows)]).toEqual(['old'])
  })
})

describe('what a line says', () => {
  it('names the kind: an agreement, a W-9, a certificate, a license, and a plain paper for the rest', () => {
    expect(partyPaperKindWords('agreement')).toBe('Agreement')
    expect(partyPaperKindWords('w9')).toBe('W-9')
    expect(partyPaperKindWords('coi')).toBe('Insurance certificate')
    expect(partyPaperKindWords('license')).toBe('License')
    expect(partyPaperKindWords('other')).toBe('Paper')
    expect(partyPaperKindWords(null)).toBe('Paper')
  })

  it('reads a paper that waits in the Agreements tab’s own words, with who signs and the day it was sent', () => {
    const l = partyPaperLine(paper('a'), new Set(), TODAY)
    expect(l.state).toEqual({ words: 'never opened', tone: 'waiting' })
    expect(l.signer).toBe('Lena Park signs, Branch manager')
    expect(plainSentence(l.day)).toBe('Sent Nov 16')
    expect(l.opens).toBe(false)
    expect(partyPaperLine(paper('a', { signer_last_viewed_at: '2026-11-17T10:00:00Z' }), new Set(), TODAY).state.words).toBe('viewed, not signed')
  })

  it('reads a signed paper as signed, by the name the signer typed, and opens its record', () => {
    const l = partyPaperLine(paper('a', { status: 'signed', signed_at: '2026-11-20', signer_printed_name: 'Lena M. Park' }), new Set(), TODAY)
    expect(l.state).toEqual({ words: 'signed ✓', tone: 'signed' })
    expect(l.signer).toBe('signed by Lena M. Park, Branch manager')
    expect(plainSentence(l.day)).toBe('Signed Nov 20')
    expect(l.opens).toBe(true)
  })

  it('reads a paper that was made and never sent as not sent, with the day it was made and no press', () => {
    const l = partyPaperLine(paper('w', { document_name: 'W-9', doc_type: 'w9', status: 'unsent', sent_at: null, signer_name: null, signer_title: null, created_at: '2026-11-21T04:23:00Z' }), new Set(), TODAY)
    expect(l.kind).toBe('W-9')
    expect(l.state).toEqual({ words: 'not sent', tone: 'unsent' })
    expect(l.signer).toBe('')
    expect(plainSentence(l.day)).toBe('Made Nov 20')
    expect(l.opens).toBe(false)
  })

  it('marks the day as a value, so the screen draws it apart from the word before it', () => {
    expect(partyPaperLine(paper('a'), new Set(), TODAY).day).toBe('Sent ⟪day|Nov 16⟫')
  })

  it('says a replaced paper is replaced, and still opens a signed one', () => {
    const l = partyPaperLine(paper('old', { status: 'signed', signed_at: '2026-10-01' }), new Set(['old']), TODAY)
    expect(l.state).toEqual({ words: 'replaced by a newer one', tone: 'ended' })
    expect(l.opens).toBe(true)
  })

  it('adds the year once the day is not this year, and falls back to the kind for a paper with no name', () => {
    const l = partyPaperLine(paper('a', { status: 'signed', signed_at: '2025-03-04', document_name: ' ' }), new Set(), TODAY)
    expect(plainSentence(l.day)).toContain('2025')
    expect(l.name).toBe('Agreement')
  })

  it('builds the lines of a party’s papers and leaves another party’s out', () => {
    const rows = [paper('a'), paper('b', { party_contact_id: 'k-other' }), paper('c', { supersedes_person_contract_document_id: 'a', sent_at: '2026-11-19T15:00:00Z' })]
    const lines = partyPaperLines(rows, ['k-house'], TODAY)
    expect(lines.map((l) => l.id)).toEqual(['c', 'a'])
    expect(lines[1]?.state.words).toBe('replaced by a newer one')
  })

  it('says signing for the business a paper names when it is not the party whose page this is', () => {
    const typedIn = paper('a', { signer_name: 'Noor Haddad', signer_title: null, signing_for: 'Haddad Engineering' })
    expect(partyPaperLine(typedIn, new Set(), TODAY, 'Ridgeway Builders').signingFor).toBe('signing for Haddad Engineering')
    expect(partyPaperLine(typedIn, new Set(), TODAY, 'haddad engineering').signingFor).toBe('')
  })

  it('says no signing for on a paper that kept no business, or with no party name to hold it against', () => {
    expect(partyPaperLine(paper('a'), new Set(), TODAY, 'Tallgrass Supply Co.').signingFor).toBe('')
    expect(partyPaperLine(paper('a', { signing_for: 'Haddad Engineering' }), new Set(), TODAY).signingFor).toBe('')
    expect(partyPaperLine(paper('a', { signing_for: 'Haddad Engineering' }), new Set(), TODAY, '  ').signingFor).toBe('')
  })

  it('carries the party’s name through to every line', () => {
    const lines = partyPaperLines([paper('a', { signing_for: 'Haddad Engineering' }), paper('b', { signing_for: 'Ridgeway Builders' })], ['k-house'], TODAY, 'Ridgeway Builders')
    expect(lines.map((l) => l.signingFor).sort()).toEqual(['', 'signing for Haddad Engineering'])
  })

  it('counts the papers with the count marked as a value', () => {
    expect(plainSentence(partyPaperCountWords(1))).toBe('1 paper')
    expect(plainSentence(partyPaperCountWords(3))).toBe('3 papers')
    expect(partyPaperCountWords(3)).toBe('⟪count|3⟫ papers')
  })
})

describe('the empty list', () => {
  it('names the page that fills it for the office, with the press', () => {
    expect(partyPapersEmptyWords(true)).toEqual({ main: 'No papers yet.', next: 'Agreements', tail: 'is where Send a paper sends one.' })
  })

  it('tells an estimator the office sends one, and offers no press', () => {
    expect(partyPapersEmptyWords(false)).toEqual({ main: 'No papers yet.', next: '', tail: 'The office sends one from Documents.' })
  })
})
