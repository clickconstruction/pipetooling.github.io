import { describe, expect, it } from 'vitest'
import { BY_HAND_SAME_NUMBER_WORDS, byHandClaimWords, byHandFilingPayloads, byHandNumberBoxes, byHandNumberNotes, byHandNumberShape, byHandProblems, byHandSameNumberTwice, byHandSends, byHandTrackingFor, otherJobsAtProperty, parsePrintedMonths, type ByHandInput } from './lienNoticeByHand'

const TODAY = '2026-09-23'
const notice = { noticeDate: '2026-09-22', projectDescription: 'Dunmere (Linmoor) — 9703 Linmor Hl', claimantName: 'Click Plumbing and Electrical', laborMaterialsType: 'Plumbing labor and materials', originalContractorName: 'RLC-Dunmere Mallin', contractedWithIfDifferent: '', claimAmount: '28987.00', contactPerson: 'Malachi Whites, Master Plumber', claimantAddress: '5501 Balcones Dr A141' }

// Taunya's Linmor paper of 2026-09-22: one notice for 273, 858 and 866, $28,987 for April, June, July and August.
const linmor: ByHandInput = {
  sentOn: '2026-09-22',
  method: 'mail',
  tracking: '',
  recipients: ['owner'],
  printedClaim: 28_987,
  printedMonths: ['2026-04', '2026-06', '2026-07', '2026-08'],
  documentUrl: 'drive.google.com/file/d/linmor/view',
  documentNote: "Taunya's mail of Sep 22",
  jobs: [
    { jobId: 'j273', label: '273 · Dunmere (Linmoor)', amount: 17_585, itemId: 'it273' },
    { jobId: 'j858', label: '858 · Service visit', amount: 7_902, itemId: null },
    { jobId: 'j866', label: '866 · Oran Karrow- Linmoor', amount: 3_500, itemId: null },
  ],
}

describe('a notice sent by hand (#35 PR 2)', () => {
  it('writes one filing per covered job on one packet — the job’s amount, the paper’s months and total, the sends, the saved copy', () => {
    const rows = byHandFilingPayloads(linmor, { userId: 'u1', packetId: 'p1', fieldsFor: () => notice })
    expect(rows).toHaveLength(3)
    expect(rows.map((r) => [r.job_id, r.amount, r.printed_claim])).toEqual([['j273', 17_585, 28_987], ['j858', 7_902, 28_987], ['j866', 3_500, 28_987]])
    expect(rows[0]).toMatchObject({ kind: 'notice_53_056', created_by: 'u1', by_hand: true, packet_id: 'p1', months_covered: ['2026-04', '2026-06', '2026-07', '2026-08'], document_url: 'https://drive.google.com/file/d/linmor/view', document_note: "Taunya's mail of Sep 22" })
    expect(rows[0]!.sends).toEqual([{ recipient: 'owner', method: 'mail', tracking: '', sent_on: '2026-09-22' }])
    expect(rows[0]!.fields).toEqual(notice)
    // One job, the paper claimed its own amount: no printed_claim, no document keys when none were typed.
    const one = byHandFilingPayloads({ ...linmor, printedClaim: 17_585, jobs: [linmor.jobs[0]!], documentUrl: '', documentNote: '' }, { userId: null, packetId: 'p2', fieldsFor: () => notice })[0]!
    expect(one.printed_claim).toBeNull()
    expect(one).not.toHaveProperty('document_url')
  })
  it('names what stops the record', () => {
    expect(byHandProblems(linmor, TODAY)).toEqual([])
    expect(byHandProblems({ ...linmor, sentOn: '2026-09-30' }, TODAY)).toEqual(['The send date is in the future'])
    expect(byHandProblems({ ...linmor, sentOn: '', recipients: [], printedClaim: 0, printedMonths: [], jobs: [] }, TODAY)).toEqual([
      'When it went out',
      'Who received it — the statute names the owner and the original contractor',
      'The claim as printed',
      'The months as printed',
      'At least one job',
    ])
    expect(byHandProblems({ ...linmor, method: 'email', tracking: '' }, TODAY)).toEqual(['An email needs the address it went to, in the tracking box'])
    expect(byHandSends({ sentOn: '2026-09-22', method: 'certified_mail', tracking: ' 9407 ', recipients: ['owner', 'original_contractor'] })).toEqual([
      { recipient: 'owner', method: 'certified_mail', tracking: '9407', sent_on: '2026-09-22' },
      { recipient: 'original_contractor', method: 'certified_mail', tracking: '9407', sent_on: '2026-09-22' },
    ])
  })
  it('words the paper’s claim against the app’s, and says nothing when they agree', () => {
    expect(byHandClaimWords(28_987, 9_802, { timely: true })).toBe("printed $28,987 · the app's timely claim would have been $9,802")
    expect(byHandClaimWords(17_585, 17_585)).toBe('')
    expect(byHandClaimWords(0, 100)).toBe('')
  })
  it('finds the other unpaid jobs at the property — the saved record first, the street as the fallback — biggest first', () => {
    const j = (id: string, addr: string | null, address: string, open: number) => ({ id, customer_address_id: addr, job_address: address, revenue: open, payments_made: 0 })
    const jobs = [j('j273', 'a1', '9703 Linmor Hl', 17_585), j('j858', 'a1', '9703 Linmor Hl', 7_902), j('j866', 'a1', '9703 Linmor Hill', 3_500), j('j1009', 'a1', '9703 Linmor Hl', 350), j('paid', 'a1', '9703 Linmor Hl', 0), j('j790', 'a2', '628 Tarrow Rd', 1_713)]
    expect(otherJobsAtProperty(jobs[0]!, jobs).map((x) => x.id)).toEqual(['j858', 'j866', 'j1009'])
    // No saved property on the job: the street number and street decide.
    const street = [j('s1', null, '9703 Linmor Hl, San Antonio', 100), j('s2', null, '9703 Linmor Hl San Antonio TX', 200), j('s3', null, '9705 Linmor Hl', 300)]
    expect(otherJobsAtProperty(street[0]!, street).map((x) => x.id)).toEqual(['s2'])
  })
  it('reads the months as typed', () => {
    expect(parsePrintedMonths('April, June, July and August 2026', 2026)).toEqual(['2026-04', '2026-06', '2026-07', '2026-08'])
    expect(parsePrintedMonths('Jul + Aug', 2026)).toEqual(['2026-07', '2026-08'])
    expect(parsePrintedMonths('2026-06 2026-6', 2026)).toEqual(['2026-06'])
    expect(parsePrintedMonths('', 2026)).toEqual([])
  })
})

// Made-up label numbers: 22 digits each, as a counter label prints them, and one of 20.
const OWNER_NO = '9407 1000 0000 0000 0000 11'
const GC_NO = '9407 1000 0000 0000 0000 28'
const TWENTY = '7000 1000 0000 0000 0035'

describe('a number for each envelope (v2.7705)', () => {
  const both = { sentOn: '2026-09-22', method: 'certified_mail' as const, tracking: '', recipients: ['owner' as const, 'original_contractor' as const] }

  it('a carrier gives each recipient a box of its own, in the statute’s order; mail, email and hand keep the one box', () => {
    expect(byHandNumberBoxes(both)).toEqual(['owner', 'original_contractor'])
    expect(byHandNumberBoxes({ method: 'traceable_courier', recipients: ['original_contractor', 'owner'] })).toEqual(['owner', 'original_contractor'])
    expect(byHandNumberBoxes({ method: 'certified_mail', recipients: ['original_contractor'] })).toEqual(['original_contractor'])
    for (const method of ['mail', 'email', 'hand'] as const) expect(byHandNumberBoxes({ method, recipients: ['owner', 'original_contractor'] })).toEqual([])
  })

  it('each send carries its own envelope’s number', () => {
    expect(byHandSends({ ...both, trackingBy: { owner: ` ${OWNER_NO} `, original_contractor: GC_NO } })).toEqual([
      { recipient: 'owner', method: 'certified_mail', tracking: OWNER_NO, sent_on: '2026-09-22' },
      { recipient: 'original_contractor', method: 'certified_mail', tracking: GC_NO, sent_on: '2026-09-22' },
    ])
    // A number the post office has not handed back yet stays blank on its own send: the other's never fills it.
    expect(byHandSends({ ...both, tracking: 'stale text from the one box', trackingBy: { owner: OWNER_NO } }).map((s) => s.tracking)).toEqual([OWNER_NO, ''])
    // One recipient: the one number, from either door.
    expect(byHandSends({ ...both, recipients: ['original_contractor'], trackingBy: { owner: OWNER_NO, original_contractor: GC_NO } }).map((s) => [s.recipient, s.tracking])).toEqual([['original_contractor', GC_NO]])
    expect(byHandSends({ ...both, recipients: ['owner'], tracking: OWNER_NO }).map((s) => s.tracking)).toEqual([OWNER_NO])
  })

  it('email and hand delivery read the one box for everyone, whatever the number boxes held', () => {
    expect(byHandSends({ ...both, method: 'email', tracking: 'office@example.test', trackingBy: { owner: OWNER_NO, original_contractor: GC_NO } }).map((s) => s.tracking)).toEqual(['office@example.test', 'office@example.test'])
    expect(byHandTrackingFor({ method: 'hand', tracking: 'the site super', trackingBy: { owner: OWNER_NO } }, 'owner')).toBe('the site super')
  })

  it('the rows every covered job keeps carry the two numbers', () => {
    const rows = byHandFilingPayloads({ ...linmor, ...both, trackingBy: { owner: OWNER_NO, original_contractor: GC_NO } }, { userId: 'u1', packetId: 'p1', fieldsFor: () => notice })
    expect(rows).toHaveLength(3)
    for (const row of rows) expect((row.sends as Array<{ recipient: string; tracking: string }>).map((s) => [s.recipient, s.tracking])).toEqual([['owner', OWNER_NO], ['original_contractor', GC_NO]])
  })

  it('checks a certified number’s length as the run window does: 20 or 22 digits', () => {
    expect(byHandNumberShape({ ...both, trackingBy: { owner: OWNER_NO } }, 'owner')).toEqual({ ok: true, hint: '22 digits · certified', digits: 22 })
    expect(byHandNumberShape({ ...both, trackingBy: { owner: TWENTY } }, 'owner')).toEqual({ ok: true, hint: '20 digits · certified', digits: 20 })
    expect(byHandNumberShape({ ...both, trackingBy: { owner: '9407 1000' } }, 'owner')).toEqual({ ok: false, hint: '8 digits — a certified number has 20 or 22', digits: 8 })
    // A courier's number is any text, and a blank box says nothing.
    expect(byHandNumberShape({ ...both, method: 'traceable_courier', trackingBy: { owner: 'ZZ-123' } }, 'owner').hint).toBe('')
    expect(byHandNumberShape({ ...both, trackingBy: {} }, 'owner').hint).toBe('')
  })

  it('says when both envelopes carry the same number, however it was spaced', () => {
    expect(byHandSameNumberTwice({ ...both, trackingBy: { owner: OWNER_NO, original_contractor: OWNER_NO.replace(/ /g, '') } })).toBe(true)
    expect(byHandSameNumberTwice({ ...both, trackingBy: { owner: OWNER_NO, original_contractor: GC_NO } })).toBe(false)
    // One number typed for every envelope is the same number twice.
    expect(byHandSameNumberTwice({ ...both, tracking: OWNER_NO })).toBe(true)
    // Blank boxes, one recipient, or a method with one box: nothing to say.
    expect(byHandSameNumberTwice({ ...both, trackingBy: {} })).toBe(false)
    expect(byHandSameNumberTwice({ ...both, recipients: ['owner'], tracking: OWNER_NO })).toBe(false)
    expect(byHandSameNumberTwice({ ...both, method: 'email', tracking: 'office@example.test' })).toBe(false)
  })

  it('the notes name the recipient and never stop the record', () => {
    const short = { ...linmor, ...both, trackingBy: { owner: '9407 1000', original_contractor: GC_NO } }
    expect(byHandNumberNotes(short)).toEqual(['owner of record: 8 digits — a certified number has 20 or 22'])
    expect(byHandProblems(short, TODAY)).toEqual([])
    const twice = { ...linmor, ...both, trackingBy: { owner: OWNER_NO, original_contractor: OWNER_NO } }
    expect(byHandNumberNotes(twice)).toEqual([BY_HAND_SAME_NUMBER_WORDS])
    expect(byHandProblems(twice, TODAY)).toEqual([])
    expect(byHandNumberNotes({ ...both, trackingBy: { owner: OWNER_NO, original_contractor: GC_NO } })).toEqual([])
    expect(byHandNumberNotes({ ...both, method: 'hand', tracking: 'x' })).toEqual([])
  })
})
