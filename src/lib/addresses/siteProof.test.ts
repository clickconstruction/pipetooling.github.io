/**
 * The proof for a site's client (punch list #439, piece 5, part 5a): the packet's list, its counts and its words.
 * Every company, person and address here is made up.
 */
import { describe, expect, it } from 'vitest'
import type { PartyPaperRow } from '../contracts/partyPapers'
import { plainWordsFailures } from '../plainWords'
import { plainSentence } from '../valuesInPlace'
import { SITE_PROOF_WORDS, asOfWords, ownPeopleWords, proofCompanies, proofCountSentence, proofDraws, proofHeading, siteProof } from './siteProof'
import type { SiteScope } from './sitePapers'

const KEY = '118 old quarry trail sampleton tx'
const SCOPE: SiteScope = { keys: new Set([KEY]), developmentId: 'dev-1' }
const paper = (id: string, over: Partial<PartyPaperRow> & { party_name?: string } = {}): PartyPaperRow =>
  ({
    id,
    document_name: 'Vendor NDA',
    doc_type: 'agreement',
    status: 'signed',
    party_contact_id: 'k1',
    party_name: 'Tallgrass Supply Co.',
    signer_name: 'Lena Park',
    signer_title: 'Branch manager',
    signer_printed_name: null,
    signed_at: '2026-11-12',
    sent_at: '2026-11-10T15:00:00Z',
    created_at: '2026-11-10T14:00:00Z',
    signer_last_viewed_at: null,
    supersedes_person_contract_document_id: null,
    site_address_key: KEY,
    site_address: '118 Old Quarry Trl, Sampleton, TX',
    site_development_id: null,
    ...over,
  }) as PartyPaperRow

describe('the packet’s list', () => {
  it('names each company that signed with who signed and the day, the oldest first', () => {
    const proof = siteProof(
      [
        paper('b', { party_name: 'Placeholder Fence Co.', party_contact_id: 'k2', signer_name: 'Sam Placeholder', signer_title: 'Owner', signed_at: '2026-11-14' }),
        paper('a'),
      ],
      SCOPE,
    )
    expect(proof.signed).toEqual([
      { id: 'a', company: 'Tallgrass Supply Co.', paper: 'Vendor NDA', signer: 'Lena Park, Branch manager', day: 'Nov 12' },
      { id: 'b', company: 'Placeholder Fence Co.', paper: 'Vendor NDA', signer: 'Sam Placeholder, Owner', day: 'Nov 14' },
    ])
    expect(proof.asked).toEqual([])
  })

  it('a paper that is out is asked, not signed, with the day it was sent', () => {
    const proof = siteProof([paper('w', { status: 'sent', signed_at: null, sent_at: '2026-11-20T18:00:00Z' })], SCOPE)
    expect(proof.signed).toEqual([])
    expect(proof.asked).toEqual([{ id: 'w', company: 'Tallgrass Supply Co.', paper: 'Vendor NDA', signer: 'Lena Park, Branch manager', day: 'Nov 20' }])
  })

  it('leaves out a paper never sent, a paper a newer one replaced, a teammate’s paper and a paper for another site', () => {
    const proof = siteProof(
      [
        paper('made', { status: 'unsent', signed_at: null }),
        paper('old', { status: 'signed' }),
        paper('new', { status: 'sent', signed_at: null, supersedes_person_contract_document_id: 'old' }),
        paper('ours', { party_contact_id: null }),
        paper('elsewhere', { site_address_key: '9 elsewhere lane' }),
        paper('none', { site_address_key: null, site_address: null }),
      ],
      SCOPE,
    )
    expect(proof.signed.map((l) => l.id)).toEqual([])
    expect(proof.asked.map((l) => l.id)).toEqual(['new'])
  })

  it('a paper that names the development is the site’s, and one filed as received counts as signed', () => {
    const proof = siteProof([paper('d', { site_address_key: null, site_address: null, site_development_id: 'dev-1', status: 'received' })], SCOPE)
    expect(proof.signed.map((l) => l.id)).toEqual(['d'])
  })

  it('the printed name is the signer’s, a paper with no name names none, and a company with no name is still a line', () => {
    const proof = siteProof(
      [
        paper('p', { signer_printed_name: 'Lena M. Park', signer_title: '' }),
        paper('q', { signer_name: null, signer_title: 'Owner', party_name: '', signing_for: 'Haddad Engineering', signed_at: '2026-11-13' }),
        paper('r', { party_name: '', signing_for: '', signer_name: '', signed_at: '2026-11-15' }),
      ],
      SCOPE,
    )
    expect(proof.signed.map((l) => [l.company, l.signer])).toEqual([
      ['Tallgrass Supply Co.', 'Lena M. Park'],
      ['Haddad Engineering', ''],
      ['A company', ''],
    ])
  })
})

describe('the block', () => {
  it('is drawn once a company signed or was asked, and not before', () => {
    expect(proofDraws({ signed: [], asked: [] })).toBe(false)
    expect(proofDraws(siteProof([paper('a')], SCOPE))).toBe(true)
    expect(proofDraws(siteProof([paper('w', { status: 'sent', signed_at: null })], SCOPE))).toBe(true)
  })

  it('counts companies, not papers: two papers of one company are one company bound', () => {
    const proof = siteProof([paper('a'), paper('b', { document_name: 'Site rules', signed_at: '2026-11-13' }), paper('w', { status: 'sent', signed_at: null, party_name: 'Example Pipe & Valve', party_contact_id: 'k9' })], SCOPE)
    expect(proofCompanies(proof.signed)).toBe(1)
    expect(plainSentence(proofCountSentence(proof))).toBe('1 company signed. 1 asked, not yet signed.')
    expect(plainSentence(proofCountSentence(siteProof([paper('a'), paper('c', { party_name: 'Placeholder Fence Co.' })], SCOPE)))).toBe('2 companies signed.')
    expect(plainSentence(proofCountSentence(siteProof([paper('w', { status: 'sent', signed_at: null })], SCOPE)))).toBe('0 companies signed. 1 asked, not yet signed.')
  })

  it('names the client when the page knows one', () => {
    expect(proofHeading('Sample Owner LLC')).toBe('The proof for Sample Owner LLC')
    expect(proofHeading('  ')).toBe('The proof for this site’s client')
    expect(proofHeading(null)).toBe('The proof for this site’s client')
  })
})

describe('our own people', () => {
  it('are counted, never named, and a site whose secrecy is off says nothing of them', () => {
    expect(ownPeopleWords({ kind: 'not-asked' })).toBeNull()
    expect(ownPeopleWords({ kind: 'counted', signed: 18, asked: 21 })).toBe('18 of 21 have signed. A job at this site stays shut to a person until they sign. Workers are counted, not named.')
  })
  it('a count that could not be read is said, never guessed', () => {
    expect(ownPeopleWords({ kind: 'unread' })).toMatch(/could not be read just now\.$/)
  })
})

describe('the words', () => {
  it('the foot says the day and that the copies are not attached', () => {
    expect(asOfWords('2026-11-27')).toBe('As of Nov 27.')
    expect(asOfWords('')).toBe('')
    expect(SITE_PROOF_WORDS.listAlone).toBe('This is the list. The signed copies are not attached.')
  })
  it('every sentence a first-timer reads passes the plain-words rules', () => {
    const said = [SITE_PROOF_WORDS.lead, SITE_PROOF_WORDS.listAlone, SITE_PROOF_WORDS.nobodySigned, ownPeopleWords({ kind: 'unread' })!, ownPeopleWords({ kind: 'counted', signed: 2, asked: 3 })!]
    for (const words of said) expect(plainWordsFailures(words), words).toEqual([])
  })
})
