import { describe, expect, it } from 'vitest'
import { pairKeys, type PlaceAnswer } from './lookAlikes'
import { SITE_KEYS_MAX, SITE_PAPERS_WORDS, rowIsForJobSite, siteKeysToRead, sitePaperLines, sitePapersCountSentence } from './sitePapers'
import type { PartyPaperRow } from '../contracts/partyPapers'
import { normalizeAddressKey } from '../developments/notInIt'
import { plainWordsFailures } from '../plainWords'
import { plainSentence } from '../valuesInPlace'

// Every name and address here is made up.
const QUARRY = '118 Old Quarry Trl, Sampleton, TX'
const BARN = '118 Old Quarry Trl Barn, Sampleton, TX'
const COVE = '801 Magnolia Cove, Exampleville, TX'
const key = normalizeAddressKey
const TODAY = '2026-11-26'
const same = (one: string, other: string): PlaceAnswer => ({ ...pairKeys(key(one), key(other)), same: true, byName: 'Cora Sample', at: '2026-11-24T15:00:00Z' })

const paper = (id: string, p: Partial<PartyPaperRow> = {}): PartyPaperRow => ({
  id,
  document_name: 'Vendor NDA',
  doc_type: 'agreement',
  status: 'sent',
  party_contact_id: 'k1',
  party_name: 'Tallgrass Supply Co.',
  signer_name: 'Lena Park',
  signer_title: 'Branch manager',
  signer_printed_name: null,
  signed_at: null,
  sent_at: '2026-11-20T15:00:00Z',
  created_at: '2026-11-20T14:00:00Z',
  signer_last_viewed_at: null,
  supersedes_person_contract_document_id: null,
  site_address_key: key(QUARRY),
  site_address: QUARRY,
  ...p,
})
const JOB = { job_address: QUARRY, development_id: 'd1' }

describe('which papers are a job’s site’s', () => {
  it('reads by the job’s own key, and by each spelling answered Same place', () => {
    expect(siteKeysToRead(JOB)).toEqual([key(QUARRY)])
    expect(siteKeysToRead(JOB, [same(QUARRY, BARN)]).sort()).toEqual([key(BARN), key(QUARRY)].sort())
    expect(siteKeysToRead({ job_address: null, development_id: 'd1' })).toEqual([])
    const chain = Array.from({ length: 60 }, (_, i) => same(i === 0 ? QUARRY : `${i} Chain Rd, Sampleton, TX`, `${i + 1} Chain Rd, Sampleton, TX`))
    expect(siteKeysToRead(JOB, chain)).toHaveLength(SITE_KEYS_MAX)
  })

  it('takes a paper at the job’s address, at a spelling answered Same place, and one that names its development', () => {
    expect(rowIsForJobSite(paper('a'), JOB)).toBe(true)
    expect(rowIsForJobSite(paper('b', { site_address_key: key(BARN) }), JOB)).toBe(false)
    expect(rowIsForJobSite(paper('b', { site_address_key: key(BARN) }), JOB, [same(QUARRY, BARN)])).toBe(true)
    expect(rowIsForJobSite(paper('c', { site_address_key: null, site_address: null, site_development_id: 'd1' }), JOB)).toBe(true)
    expect(rowIsForJobSite(paper('c', { site_address_key: null, site_address: null, site_development_id: 'd2' }), JOB)).toBe(false)
    expect(rowIsForJobSite(paper('d', { site_address_key: null, site_address: null }), JOB)).toBe(false)
    expect(rowIsForJobSite(paper('e', { site_address_key: key(COVE) }), JOB)).toBe(false)
    // A job in no development never matches a paper by a blank development.
    expect(rowIsForJobSite(paper('f', { site_address_key: null, site_address: null, site_development_id: null }), { job_address: QUARRY, development_id: null })).toBe(false)
  })
})

describe('sitePaperLines', () => {
  const rows = [
    paper('signed', { status: 'signed', signed_at: '2026-11-12', party_name: 'Sample Well Drilling', signer_printed_name: 'Rae Sample', signer_name: 'Rae Sample', signer_title: null }),
    paper('waiting'),
    paper('later', { party_name: 'Example Pipe & Valve', sent_at: '2026-11-22T15:00:00Z' }),
    paper('elsewhere', { site_address_key: key(COVE), site_address: COVE }),
    paper('ours', { party_contact_id: null, party_name: null }),
    paper('old', { party_name: 'Old Copy Co.' }),
    paper('new', { party_name: 'Old Copy Co.', supersedes_person_contract_document_id: 'old', sent_at: '2026-11-25T15:00:00Z' }),
    paper('waiting'),
  ]

  it('lists outside companies’ papers for the site, the ones still to sign first, each once', () => {
    const lines = sitePaperLines(rows, JOB, [], TODAY)
    expect(lines.map((l) => l.id)).toEqual(['new', 'later', 'waiting', 'signed'])
    expect(lines.map((l) => l.company)).toEqual(['Old Copy Co.', 'Example Pipe & Valve', 'Tallgrass Supply Co.', 'Sample Well Drilling'])
  })

  it('says each line in the words a company’s own page uses', () => {
    const [, , waiting, signed] = sitePaperLines(rows, JOB, [], TODAY)
    expect(waiting).toMatchObject({ name: 'Vendor NDA', state: { words: 'never opened', tone: 'waiting' }, signer: 'Lena Park signs, Branch manager' })
    expect(plainSentence(waiting!.day)).toBe('Sent Nov 20')
    expect(signed).toMatchObject({ state: { words: 'signed ✓', tone: 'signed' } })
    expect(plainSentence(signed!.day)).toBe('Signed Nov 12')
  })

  it('names a company by what the paper keeps, then by who it says is signed for, then plainly', () => {
    const lines = sitePaperLines([paper('a', { party_name: '  ', signing_for: 'Haddad Engineering' }), paper('b', { party_name: null, signing_for: null })], JOB, [], TODAY)
    expect(lines.map((l) => l.company).sort()).toEqual(['A company', 'Haddad Engineering'])
  })

  it('counts the signed of the listed, with the counts as values', () => {
    const lines = sitePaperLines(rows, JOB, [], TODAY)
    expect(plainSentence(sitePapersCountSentence(lines))).toBe('1 of 4 papers signed.')
    expect(plainSentence(sitePapersCountSentence(lines.slice(3)))).toBe('1 of 1 paper signed.')
    expect(sitePapersCountSentence(lines)).not.toBe(plainSentence(sitePapersCountSentence(lines)))
  })

  it('passes the plain-words rules', () => {
    for (const line of [SITE_PAPERS_WORDS.heading, SITE_PAPERS_WORDS.lead, '1 of 4 papers signed.']) expect(plainWordsFailures(line), line).toEqual([])
  })
})
