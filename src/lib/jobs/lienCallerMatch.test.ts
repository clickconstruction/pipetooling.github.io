import { describe, expect, it } from 'vitest'
import type { LienDeskItemRow } from './lienDesk'
import type { CustomerAddressRow } from './lienProperty'
import { callLetterFactsFor, callerIndex, findOnDesk, practiceCallFacts, sentNoticesForCalls, type CallerMatchInput } from './lienCallerMatch'
import { letterTwoByJobFrom } from './lienLetterTwo'

const notice = (over: Partial<LienDeskItemRow> & { id: string; job_id: string }): LienDeskItemRow =>
  ({
    kind: 'notice_53_056',
    status: 'sent',
    sent_at: '2026-09-22T15:00:00Z',
    months: ['2026-06', '2026-07', '2026-08'],
    fields: { notice: { noticeDate: '2026-09-22', projectDescription: '', claimantName: 'Click Plumbing and Electrical', laborMaterialsType: '', originalContractorName: 'RMC', contractedWithIfDifferent: '', claimAmount: '7902.00', contactPerson: 'Robert Douglas, Master Plumber', claimantAddress: '' }, gcEmail: '' },
    cover_note: true,
    voided_at: null,
    created_at: '2026-09-20T00:00:00Z',
    ...over,
  }) as unknown as LienDeskItemRow

const addr = (over: Partial<CustomerAddressRow>): CustomerAddressRow => ({ id: 'a', address: '', county: 'Bexar', legal_description: '', property_kind: 'residential', homestead: false, owner_mode: 'homeowner', owner_name: '', owner_company: '', owner_mailing_address: '', ...over }) as unknown as CustomerAddressRow

const input: CallerMatchInput = {
  items: [
    notice({ id: 'n273', job_id: 'j273' }),
    notice({ id: 'n274', job_id: 'j274', sent_at: '2026-09-23T15:00:00Z', months: ['2026-07'] }),
    notice({ id: 'draft', job_id: 'j275', status: 'approved', sent_at: null }),
    notice({ id: 'r212', job_id: 'j212', kind: 'retainage_53_057', months: [], sent_at: '2026-09-24T15:00:00Z', fields: { notice: { noticeDate: '2026-09-24', projectDescription: '', claimantName: 'Click', laborMaterialsType: '', originalContractorName: 'Harborline Builders', contractedWithIfDifferent: '', claimAmount: '4250.00', contactPerson: 'Malachi Whites, Master Plumber', claimantAddress: '' }, gcEmail: '' } }),
  ],
  jobsById: {
    j273: { id: 'j273', hcp_number: '273', click_number: null, job_name: 'Dudley (Lennox)', job_address: '9703 Lenox Hl, San Antonio, TX 78230', customer_id: null, customer_name: null, gc_customer_id: 'rmc', customer_address_id: 'a1', revenue: 7_902, payments_made: 0, master_user_id: null, last_work_date: null },
    j274: { id: 'j274', hcp_number: '', click_number: '1122', job_name: 'Terrell Rd', job_address: '4410 Terrell Rd, San Antonio, TX', customer_id: null, customer_name: null, gc_customer_id: 'rmc', customer_address_id: 'a2', revenue: 0, payments_made: 0, master_user_id: null, last_work_date: null },
    j212: { id: 'j212', hcp_number: '1234', click_number: null, job_name: 'Sample job', job_address: '212 Kettle Dr, Buda, TX 78610', customer_id: null, customer_name: null, gc_customer_id: 'harb', customer_address_id: null, revenue: 4_250, payments_made: 0, master_user_id: null, last_work_date: null },
    // Nothing mailed yet: a notice still in draft.
    j275: { id: 'j275', hcp_number: '858', click_number: null, job_name: 'Service Visit — 410 Candelaria', job_address: '410 Candelaria, Helotes, TX 78023', customer_id: null, customer_name: null, gc_customer_id: 'rmc', customer_address_id: null, revenue: 7_902, payments_made: 0, master_user_id: null, last_work_date: null },
  },
  gcsById: { rmc: { id: 'rmc', name: 'RMC', address: '', email: '', policy: 'ask', policyNote: '' }, harb: { id: 'harb', name: 'Harborline Builders', address: '', email: '', policy: 'ask', policyNote: '' } },
  addressesById: {
    a1: addr({ id: 'a1', owner_name: 'Priya Natarajan', owner_mailing_address: '9703 Lenox Hl, San Antonio, TX 78230' }),
    a2: addr({ id: 'a2', property_kind: 'non_residential', owner_mode: 'building_owner', owner_company: 'Umar Khan Holdings LLC', owner_mailing_address: 'PO Box 9, San Antonio, TX' }),
  },
  ownerByJob: { j212: { owner_mode: 'homeowner', owner_name: 'Sam Ortega', company_name: '', mailing_address: '212 Kettle Dr, Buda, TX 78610' } },
  letterTwoByJob: {},
  us: 'Click',
}
const fmt = { day: (d: string) => d }
const index = callerIndex(input, fmt)
const sentIds = (q: string) => findOnDesk(q, index).sent.map((h) => h.jobId)

describe('someone’s calling (v2.3854)', () => {
  it('one sent notice per job with the letter’s facts — kind, letter, mailed, amount, months, GC, signer, the affidavit date by property kind', () => {
    const all = sentNoticesForCalls(input)
    expect(all.map((n) => n.jobId)).toEqual(['j212', 'j274', 'j273']) // newest packet first; the draft is not a notice anyone is holding
    const lenox = all.find((n) => n.jobId === 'j273')!.facts
    expect(lenox).toEqual({ jobLabel: '273 · Dudley (Lennox)', property: '9703 Lenox Hl, San Antonio, TX 78230', ownerName: 'Priya Natarajan', gcName: 'RMC', us: 'Click', instrument: 'notice_53_056', letterKind: 'residential', mailedOn: '2026-09-22', amount: '$7,902.00', months: 'June, July and August 2026', signer: 'Robert Douglas, Master Plumber', phone: '', affidavitBy: '2026-11-16' })
    const terrell = all.find((n) => n.jobId === 'j274')!.facts
    expect(terrell.letterKind).toBe('commercial')
    expect(terrell.ownerName).toBe('Umar Khan Holdings LLC')
    expect(terrell.affidavitBy).toBe('2026-11-16') // July, commercial: the 15th of the 4th month, weekend-rolled
    const ret = all.find((n) => n.jobId === 'j212')!.facts
    expect(ret).toMatchObject({ instrument: 'retainage_53_057', letterKind: 'retainage', amount: '$4,250.00', months: '', affidavitBy: '', ownerName: 'Sam Ortega', gcName: 'Harborline Builders' })
  })

  it('a sent letter matches the owner’s name, the street, the job number or the company, every word of the query', () => {
    const lenox = findOnDesk('lenox', index)
    expect(lenox.sent).toHaveLength(1)
    expect(lenox.sent[0]).toMatchObject({ kind: 'owner', jobId: 'j273', itemId: 'n273', who: 'Priya Natarajan · owner of 9703 Lenox Hl, San Antonio, TX 78230' })
    expect(lenox.sent[0]!.what).toBe('§ 53.056 notice · residential letter · mailed 2026-09-22 · $7,902.00 for June, July and August 2026 · GC RMC · job 273 · Dudley (Lennox) · signed Robert Douglas')
    expect(sentIds('priya nat')).toEqual(['j273'])
    expect(sentIds('1122')).toEqual(['j274'])
    expect(sentIds('khan')).toEqual(['j274'])
    expect(sentIds('kettle')).toEqual(['j212'])
    expect(sentIds('san antonio')).toEqual(['j274', 'j273'])
    expect(findOnDesk('lenox buda', index)).toMatchObject({ sent: [], trimmed: false })
    expect(findOnDesk('l', index)).toMatchObject({ sent: [] })
    expect(sentIds('candelaria')).toEqual([]) // a job with nothing mailed is not a letter anyone is holding
  })

  it('a GC’s name finds its sent letters, newest first', () => {
    expect(sentIds('rmc')).toEqual(['j274', 'j273'])
    expect(sentIds('harbor')).toEqual(['j212'])
  })

  it('a slip is forgiven: a word that is nowhere on the desk loses letters from its end, down to three, and the find says which words it used', () => {
    expect(findOnDesk('lenoz', index)).toMatchObject({ used: 'leno', trimmed: true, sent: [{ jobId: 'j273' }] })
    expect(findOnDesk('priya natx', index)).toMatchObject({ used: 'priya nat', trimmed: true, sent: [{ jobId: 'j273' }] })
    expect(findOnDesk('lenoz hl', index)).toMatchObject({ used: 'leno hl', trimmed: true, sent: [{ jobId: 'j273' }] }) // the slip need not be in the last word
    expect(findOnDesk('kettlz budda', index)).toMatchObject({ used: 'kettl bud', trimmed: true, sent: [{ jobId: 'j212' }] })
    expect(findOnDesk('lenox buda', index)).toMatchObject({ used: 'lenox buda', trimmed: false, sent: [] }) // both words are on a letter, never on one: nothing is cut
    expect(findOnDesk('lenox', index)).toMatchObject({ used: 'lenox', trimmed: false })
    expect(findOnDesk('zzzzz', index)).toMatchObject({ used: 'zzzzz', trimmed: false, sent: [] })
  })

  it('the practice call’s letter is made up and dated from today — mailed eight days ago for the two months before', () => {
    expect(practiceCallFacts({ us: 'Click', todayYmd: '2026-09-30', signer: 'Robert Douglas, Master Plumber', phone: ' 210-555-0100 ' })).toEqual({ jobLabel: '000 · Practice job', property: '100 Practice Ln, San Antonio, TX', ownerName: 'Pat Sample', gcName: 'Sample Builders', us: 'Click', instrument: 'notice_53_056', letterKind: 'residential', mailedOn: '2026-09-22', amount: '$4,250.00', months: 'July and August 2026', signer: 'Robert Douglas, Master Plumber', phone: '210-555-0100', affidavitBy: '2026-11-16' })
    expect(practiceCallFacts({ us: 'Click', todayYmd: '2027-01-05', signer: '', phone: '' })).toMatchObject({ mailedOn: '2026-12-28', months: 'October and November 2026' })
  })

  it('letter two: the hit is the first packet (the call is recorded there), and its facts say which letter went out', () => {
    const two = notice({ id: 'two', job_id: 'j273', sent_at: '2026-10-06T15:00:00Z', fields: { ...(notice({ id: 'x', job_id: 'j273' }).fields as object), letterTwo: { kind: 'paid_out', afterItemId: 'n273', afterSentAt: '2026-09-22T15:00:00Z' } } })
    const items = [...input.items, two]
    const letterTwoByJob = letterTwoByJobFrom(items, () => 7_902, '2026-10-08')
    const hits = findOnDesk('lenox', callerIndex({ ...input, items, letterTwoByJob }, fmt)).sent
    expect(hits).toHaveLength(1)
    expect(hits[0]).toMatchObject({ kind: 'owner', itemId: 'n273' })
    // the second letter's own facts, when asked directly
    const f = callLetterFactsFor({ item: two, job: input.jobsById.j273, gc: input.gcsById.rmc, address: input.addressesById.a1!, owner: null, us: 'Click' })
    expect(f.letterKind).toBe('paid_out')
    expect(f.mailedOn).toBe('2026-10-06')
  })
})

describe('a notice mailed in the evening keeps its day on the call sheet (v2.4468)', () => {
  it('reads the Central day', () => {
    // 00:30 UTC on Sep 23 is 7:30 pm CDT on Sep 22; 00:30 UTC on Dec 2 is 6:30 pm CST on Dec 1.
    const facts = (sent_at: string) => callLetterFactsFor({ item: notice({ id: 'n', job_id: 'j273', sent_at }), job: undefined, gc: undefined, address: null, owner: null, us: 'Click' }).mailedOn
    expect(facts('2026-09-23T00:30:00Z')).toBe('2026-09-22')
    expect(facts('2026-12-02T00:30:00+00:00')).toBe('2026-12-01')
    expect(facts('2026-09-23T12:00:00Z')).toBe('2026-09-23')
  })
})
