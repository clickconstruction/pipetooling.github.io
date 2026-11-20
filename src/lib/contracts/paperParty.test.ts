import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  PAPER_WORD_MAX,
  PARTY_AGREEMENT_KINDS,
  PARTY_PAPER_PREFIX,
  isPartyAgreementKind,
  isPartyPaperName,
  paperPartyKind,
  paperPartyTag,
  paperSaysLine,
  paperSignerFromFacts,
  paperSignerLine,
  paperWord,
  partyAgreementKind,
  partyAgreementTag,
  partyContactIdFromPaperName,
  partyNeedsAList,
  partyPaperName,
  signerEmailWord,
  signingForOf,
  signingForTail,
  type PaperPartyKind,
} from './paperParty'

// Every name here is made up.
const CONTACT = '3f2b7c1e-0a4d-4e8b-9c6f-1d2e3a4b5c6d'

describe('the name a party’s paper is filed under', () => {
  it('is the prefix and the contact’s id, and reads back', () => {
    expect(partyPaperName(CONTACT)).toBe(`party:${CONTACT}`)
    expect(isPartyPaperName(partyPaperName(CONTACT))).toBe(true)
    expect(partyContactIdFromPaperName(partyPaperName(CONTACT))).toBe(CONTACT)
  })

  it('is never a person’s name or a trade company’s', () => {
    expect(isPartyPaperName('Pat Tallman')).toBe(false)
    expect(isPartyPaperName('gc-company:3f2b7c1e-0a4d-4e8b-9c6f-1d2e3a4b5c6d')).toBe(false)
    expect(isPartyPaperName(null)).toBe(false)
    expect(partyContactIdFromPaperName('Pat Tallman')).toBeNull()
  })

  it('names no contact when the stored name is not well formed', () => {
    expect(partyContactIdFromPaperName('party:nobody')).toBeNull()
    expect(partyContactIdFromPaperName('party:')).toBeNull()
  })
})

describe('what the party is', () => {
  it('reads the view’s word, and no party when the facts carry none', () => {
    expect(paperPartyKind('customer')).toBe('customer')
    expect(paperPartyKind('supply_house')).toBe('supply_house')
    expect(paperPartyKind('trade')).toBe('trade')
    expect(paperPartyKind('none')).toBe('none')
    expect(paperPartyKind(undefined)).toBeNull()
    expect(paperPartyKind('')).toBeNull()
    expect(paperPartyKind(7)).toBeNull()
  })

  it('reads a word it does not know as some other record, never as no list', () => {
    expect(paperPartyKind('landlord')).toBe('other')
  })

  it('gives each party the view’s kind', () => {
    const want: Record<PaperPartyKind, string> = {
      customer: 'customer_agreement',
      supply_house: 'supply_house_agreement',
      trade: 'trade_agreement',
      person: 'outside_agreement',
      other: 'outside_agreement',
      none: 'outside_agreement',
    }
    for (const [party, kind] of Object.entries(want)) expect(partyAgreementKind(party as PaperPartyKind)).toBe(kind)
    for (const kind of PARTY_AGREEMENT_KINDS) expect(isPartyAgreementKind(kind)).toBe(true)
    expect(isPartyAgreementKind('person_agreement')).toBe(false)
    expect(isPartyAgreementKind('company_agreement')).toBe(false)
    expect(isPartyAgreementKind(null)).toBe(false)
  })

  it('tags a line by what the party is', () => {
    expect(paperPartyTag('customer')).toBe('Customer')
    expect(paperPartyTag('supply_house')).toBe('Supply house')
    expect(paperPartyTag('trade')).toBe('Trade company')
    expect(paperPartyTag('none')).toBe('Not on a list')
    expect(paperPartyTag('person')).toBe('On the roster')
    expect(paperPartyTag('other')).toBe('Outside party')
    expect(paperPartyTag(null)).toBe('Outside party')
  })

  it('tags a row by its kind when the facts carry no party', () => {
    expect(partyAgreementTag('supply_house_agreement', undefined)).toBe('Supply house')
    expect(partyAgreementTag('customer_agreement', null)).toBe('Customer')
    expect(partyAgreementTag('trade_agreement', '')).toBe('Trade company')
    expect(partyAgreementTag('outside_agreement', undefined)).toBe('Not on a list')
    // The facts win: an outside line whose party is on the roster says so.
    expect(partyAgreementTag('outside_agreement', 'person')).toBe('On the roster')
  })

  it('offers Add to a list only to a party on no list', () => {
    expect(partyNeedsAList('none')).toBe(true)
    for (const party of ['customer', 'supply_house', 'trade', 'person', 'other'] as const) expect(partyNeedsAList(party)).toBe(false)
    expect(partyNeedsAList(null)).toBe(false)
  })
})

describe('the words a paper keeps', () => {
  it('trims a word and keeps none for nothing', () => {
    expect(paperWord('  Lena   Park ')).toBe('Lena Park')
    expect(paperWord('   ')).toBeNull()
    expect(paperWord('')).toBeNull()
    expect(paperWord(null)).toBeNull()
    expect(paperWord('x'.repeat(PAPER_WORD_MAX + 20))).toHaveLength(PAPER_WORD_MAX)
  })

  it('keeps an address, and none for what is no address', () => {
    expect(signerEmailWord(' lena@tallgrass.example ')).toBe('lena@tallgrass.example')
    expect(signerEmailWord('nobody')).toBeNull()
    expect(signerEmailWord('@tallgrass.example')).toBeNull()
    expect(signerEmailWord('')).toBeNull()
    expect(signerEmailWord(null)).toBeNull()
  })
})

describe('who signs', () => {
  it('says who signs while the paper waits', () => {
    expect(paperSignerLine({ name: 'Lena Park', title: 'Branch manager' }, false)).toBe('Lena Park signs, Branch manager')
    expect(paperSignerLine({ name: 'Omar Reyes' }, false)).toBe('Omar Reyes signs')
  })

  it('says who signed once it is signed, by the name they typed', () => {
    expect(paperSignerLine({ name: 'Dana Ruiz', title: 'Project manager' }, true)).toBe('signed by Dana Ruiz, Project manager')
    expect(paperSignerLine({ name: 'Dana Ruiz', title: 'Project manager', printedName: 'Dana M. Ruiz' }, true)).toBe('signed by Dana M. Ruiz, Project manager')
    // A paper sent before the signer was kept still says who signed.
    expect(paperSignerLine({ printedName: 'Marco Ibarra' }, true)).toBe('signed by Marco Ibarra')
  })

  it('says nothing with no name, and never the typed name before a signature', () => {
    expect(paperSignerLine({}, false)).toBe('')
    expect(paperSignerLine({ title: 'Owner' }, false)).toBe('')
    expect(paperSignerLine({ printedName: 'Marco Ibarra' }, false)).toBe('')
  })

  it('says what the paper will say', () => {
    expect(paperSaysLine({ name: 'Lena Park', title: 'Branch manager', signingFor: 'Tallgrass Supply Co.' })).toBe('Lena Park, Branch manager, signing for Tallgrass Supply Co.')
    expect(paperSaysLine({ name: 'Noor Haddad', signingFor: 'Haddad Engineering' })).toBe('Noor Haddad, signing for Haddad Engineering')
    expect(paperSaysLine({ name: 'Pat Tallman' })).toBe('Pat Tallman')
    expect(paperSaysLine({ title: 'Owner', signingFor: 'Juniper Mechanical LLC' })).toBe('')
  })

  it('a person who is the party signs for themselves', () => {
    expect(signingForOf('Tallgrass Supply Co.', 'Lena Park')).toBe('Tallgrass Supply Co.')
    expect(signingForOf('Harlan Pierce', 'harlan pierce')).toBeNull()
    expect(signingForOf('', 'Lena Park')).toBeNull()
    expect(signingForOf('Tallgrass Supply Co.', null)).toBe('Tallgrass Supply Co.')
    expect(paperSaysLine({ name: 'Harlan Pierce', signingFor: 'Harlan Pierce' })).toBe('Harlan Pierce')
  })

  it('gives a person’s own paper its signing for tail', () => {
    expect(signingForTail({ name: 'Dario Vega', signingFor: 'Juniper Mechanical LLC' })).toBe('signing for Juniper Mechanical LLC')
    expect(signingForTail({ name: 'Pat Tallman' })).toBe('')
    expect(signingForTail({ name: 'Harlan Pierce', signingFor: 'Harlan Pierce' })).toBe('')
  })

  it('reads a row’s signer from the view’s facts', () => {
    const signer = paperSignerFromFacts({ signer_name: 'Lena Park', signer_title: ' Branch manager ', signing_for: 'Tallgrass Supply Co.', signer_printed_name: 'Lena M. Park', status: 'signed' })
    expect(signer).toEqual({ name: 'Lena Park', title: 'Branch manager', signingFor: 'Tallgrass Supply Co.', printedName: 'Lena M. Park' })
    expect(paperSignerFromFacts(null)).toEqual({ name: null, title: null, signingFor: null, printedName: null })
    expect(paperSignerFromFacts({ signer_name: 7 })).toEqual({ name: null, title: null, signingFor: null, printedName: null })
  })
})

describe('the kernel and the migration say the same', () => {
  const sql = readFileSync(resolve(__dirname, '../../../supabase/migrations/20261120010000_paper_party.sql'), 'utf8')

  it('the view answers the kernel’s four kinds', () => {
    for (const kind of PARTY_AGREEMENT_KINDS) expect(sql, kind).toContain(`'${kind}'`)
  })

  it('the view answers the kernel’s party words', () => {
    const view = sql.slice(sql.indexOf('CREATE OR REPLACE VIEW public.agreements_on_file'))
    for (const party of ['customer', 'supply_house', 'trade', 'person', 'other']) expect(view, party).toContain(`THEN '${party}'`)
    // Whatever points at no record is on no list.
    expect(view).toContain("ELSE 'none'")
  })

  it('the stored name is the kernel’s prefix, held both ways', () => {
    expect(sql).toContain(`person_name NOT LIKE '${PARTY_PAPER_PREFIX}%'`)
    expect(sql).toContain(`person_name = '${PARTY_PAPER_PREFIX}' || party_contact_id::text`)
  })
})
