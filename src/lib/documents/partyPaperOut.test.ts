import { describe, expect, it } from 'vitest'
import { sentenceParts } from '../valuesInPlace'
import {
  PARTY_CONTACT_COLUMN,
  SECOND_COPY_LABEL,
  copiesOutLead,
  copiesOutTitle,
  copyOutLine,
  copyOutSentDay,
  copyOutSentence,
  copyOutWho,
  partyContactIsOwn,
  partyContactsToLook,
  partyPapersOut,
  sendAgainLabel,
  type PartyCopyOut,
} from './partyPaperOut'

/** Every name here is made up. */
const CONTACT = '3f2b7c1e-0a4d-4e8b-9c6f-1d2e3a4b5c6d'
const row = (over: Partial<{ id: string; person_name: string; document_name: string; status: string; sent_at: string | null }>) => ({
  id: 'd1',
  person_name: `party:${CONTACT}`,
  document_name: 'Mutual secrecy agreement',
  status: 'sent',
  sent_at: '2026-11-20T18:00:00Z',
  ...over,
})
const copy = (over: Partial<PartyCopyOut> = {}): PartyCopyOut => ({ docId: 'd1', signerName: 'Lena Park', signerTitle: 'Branch manager', signerEmail: 'lena@tallgrass.example', sentAt: '2026-11-20T18:00:00Z', ...over })

describe('partyPapersOut', () => {
  it('finds the copies of one paper a party has out, newest first', () => {
    const docs = [row({ id: 'old', sent_at: '2026-11-18T18:00:00Z' }), row({ id: 'new', sent_at: '2026-11-21T18:00:00Z' })]
    expect(partyPapersOut(docs, CONTACT, 'Mutual secrecy agreement').map((d) => d.id)).toEqual(['new', 'old'])
  })

  it('leaves out a copy never sent, a signed one, another paper and another party', () => {
    const docs = [
      row({ id: 'unsent', status: 'unsent' }),
      row({ id: 'signed', status: 'signed' }),
      row({ id: 'other paper', document_name: 'W-9' }),
      row({ id: 'other party', person_name: 'party:9a1b2c3d-0a4d-4e8b-9c6f-1d2e3a4b5c6d' }),
      row({ id: 'a person', person_name: 'Lena Park' }),
    ]
    expect(partyPapersOut(docs, CONTACT, 'Mutual secrecy agreement')).toEqual([])
  })

  it('reads a company’s copies on every contact handed in, and still by paper and state', () => {
    const NAMED = '7c4d2e1f-0a4d-4e8b-9c6f-1d2e3a4b5c6d'
    const docs = [
      row({ id: 'own', sent_at: '2026-11-18T18:00:00Z' }),
      row({ id: 'named', person_name: `party:${NAMED}`, sent_at: '2026-11-21T18:00:00Z' }),
      row({ id: 'named signed', person_name: `party:${NAMED}`, status: 'signed' }),
      row({ id: 'elsewhere', person_name: 'party:9a1b2c3d-0a4d-4e8b-9c6f-1d2e3a4b5c6d' }),
    ]
    expect(partyPapersOut(docs, [CONTACT, NAMED], 'Mutual secrecy agreement').map((d) => d.id)).toEqual(['named', 'own'])
    expect(partyPapersOut(docs, [NAMED], 'Mutual secrecy agreement').map((d) => d.id)).toEqual(['named'])
    expect(partyPapersOut(docs, [], 'Mutual secrecy agreement')).toEqual([])
  })

  it('a party with no contact yet has nothing out', () => {
    expect(partyPapersOut([row({})], null, 'Mutual secrecy agreement')).toEqual([])
    expect(partyPapersOut([row({})], undefined, 'Mutual secrecy agreement')).toEqual([])
  })
})

describe('partyContactsToLook', () => {
  const own = { id: 'own', name: null }
  const ana = { id: 'ana', name: 'Ana Reyes' }
  const ben = { id: 'ben', name: 'Ben Ortiz' }

  it('a company is looked at on its own contact first, then on each person named under it', () => {
    expect(partyContactsToLook('customers', [ana, own, ben])).toEqual(['own', 'ana', 'ben'])
    expect(partyContactsToLook('supply_houses', [ana])).toEqual(['ana'])
    expect(partyContactsToLook('customers', [])).toEqual([])
  })

  it('a person on file is looked at on their one contact', () => {
    expect(partyContactsToLook('customer_contact_persons', [ana, ben])).toEqual(['ana'])
    expect(partyContactsToLook('supply_house_contacts', [])).toEqual([])
  })
})

describe('the words of the choice', () => {
  it('says who has the paper and when it went, in the company’s day', () => {
    expect(copyOutLine(copy())).toBe('Lena Park already has this paper out, sent Nov 20.')
    // 03:00 UTC is the evening before in the company’s time zone.
    expect(copyOutSentDay('2026-11-21T03:00:00Z')).toBe('Nov 20')
    expect(copyOutSentDay(null)).toBe('')
    expect(copyOutLine(copy({ sentAt: null }))).toBe('Lena Park already has this paper out.')
  })

  it('marks who and the day as values, for the window to draw apart', () => {
    expect(sentenceParts(copyOutSentence(copy()))).toEqual([{ kind: 'who', text: 'Lena Park' }, ' already has this paper out, sent ', { kind: 'day', text: 'Nov 20' }, '.'])
  })

  it('names a copy by its address when it kept no name, and by a word when it kept neither', () => {
    expect(copyOutWho(copy({ signerName: ' ' }))).toBe('lena@tallgrass.example')
    expect(copyOutWho(copy({ signerName: '', signerEmail: '' }))).toBe('someone')
    expect(sendAgainLabel(copy({ signerName: '' }))).toBe('Send it to lena@tallgrass.example again')
  })

  it('names each press by what it does', () => {
    expect(sendAgainLabel(copy())).toBe('Send it to Lena Park again')
    expect(SECOND_COPY_LABEL).toBe('Send a second copy to someone else')
    expect(copiesOutTitle('Mutual secrecy agreement')).toBe('Mutual secrecy agreement is already out')
  })

  it('counts the copies in the lead', () => {
    expect(copiesOutLead('Tallgrass Supply Co.', 1)).toBe('Tallgrass Supply Co. has one copy waiting on a signature.')
    expect(copiesOutLead('Tallgrass Supply Co.', 2)).toBe('Tallgrass Supply Co. has 2 copies waiting on a signature.')
    expect(copiesOutLead(' ', 1)).toBe('This company has one copy waiting on a signature.')
  })
})

describe('where a record’s contact is', () => {
  it('names the column of contacts for each kind of record', () => {
    expect(PARTY_CONTACT_COLUMN).toEqual({ customers: 'customer_id', customer_contact_persons: 'customer_contact_person_id', supply_houses: 'supply_house_id', supply_house_contacts: 'supply_house_contact_id' })
  })

  it('a business’s own contact carries no name, and a person’s is the one that points at them', () => {
    expect(partyContactIsOwn('customers')).toBe(true)
    expect(partyContactIsOwn('supply_houses')).toBe(true)
    expect(partyContactIsOwn('customer_contact_persons')).toBe(false)
    expect(partyContactIsOwn('supply_house_contacts')).toBe(false)
  })
})
