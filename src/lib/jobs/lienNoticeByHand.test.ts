import { describe, expect, it } from 'vitest'
import { byHandClaimWords, byHandFilingPayloads, byHandProblems, byHandSends, otherJobsAtProperty, parsePrintedMonths, type ByHandInput } from './lienNoticeByHand'

const TODAY = '2026-09-23'
const notice = { noticeDate: '2026-09-22', projectDescription: 'Dudley (Lennox) — 9703 Lenox Hl', claimantName: 'Click Plumbing and Electrical', laborMaterialsType: 'Plumbing labor and materials', originalContractorName: 'RMC-Dudley Mason', contractedWithIfDifferent: '', claimAmount: '28987.00', contactPerson: 'Malachi Whites, Master Plumber', claimantAddress: '5501 Balcones Dr A141' }

// Taunya's Lenox paper of 2026-09-22: one notice for 273, 858 and 866, $28,987 for April, June, July and August.
const lenox: ByHandInput = {
  sentOn: '2026-09-22',
  method: 'mail',
  tracking: '',
  recipients: ['owner'],
  printedClaim: 28_987,
  printedMonths: ['2026-04', '2026-06', '2026-07', '2026-08'],
  documentUrl: 'drive.google.com/file/d/lenox/view',
  documentNote: "Taunya's mail of Sep 22",
  jobs: [
    { jobId: 'j273', label: '273 · Dudley (Lennox)', amount: 17_585, itemId: 'it273' },
    { jobId: 'j858', label: '858 · Service visit', amount: 7_902, itemId: null },
    { jobId: 'j866', label: '866 · Omar Khan- Lennox', amount: 3_500, itemId: null },
  ],
}

describe('a notice sent by hand (#35 PR 2)', () => {
  it('writes one filing per covered job on one packet — the job’s amount, the paper’s months and total, the sends, the saved copy', () => {
    const rows = byHandFilingPayloads(lenox, { userId: 'u1', packetId: 'p1', fieldsFor: () => notice })
    expect(rows).toHaveLength(3)
    expect(rows.map((r) => [r.job_id, r.amount, r.printed_claim])).toEqual([['j273', 17_585, 28_987], ['j858', 7_902, 28_987], ['j866', 3_500, 28_987]])
    expect(rows[0]).toMatchObject({ kind: 'notice_53_056', created_by: 'u1', by_hand: true, packet_id: 'p1', months_covered: ['2026-04', '2026-06', '2026-07', '2026-08'], document_url: 'https://drive.google.com/file/d/lenox/view', document_note: "Taunya's mail of Sep 22" })
    expect(rows[0]!.sends).toEqual([{ recipient: 'owner', method: 'mail', tracking: '', sent_on: '2026-09-22' }])
    expect(rows[0]!.fields).toEqual(notice)
    // One job, the paper claimed its own amount: no printed_claim, no document keys when none were typed.
    const one = byHandFilingPayloads({ ...lenox, printedClaim: 17_585, jobs: [lenox.jobs[0]!], documentUrl: '', documentNote: '' }, { userId: null, packetId: 'p2', fieldsFor: () => notice })[0]!
    expect(one.printed_claim).toBeNull()
    expect(one).not.toHaveProperty('document_url')
  })
  it('names what stops the record', () => {
    expect(byHandProblems(lenox, TODAY)).toEqual([])
    expect(byHandProblems({ ...lenox, sentOn: '2026-09-30' }, TODAY)).toEqual(['The send date is in the future'])
    expect(byHandProblems({ ...lenox, sentOn: '', recipients: [], printedClaim: 0, printedMonths: [], jobs: [] }, TODAY)).toEqual([
      'When it went out',
      'Who received it — the statute names the owner and the original contractor',
      'The claim as printed',
      'The months as printed',
      'At least one job',
    ])
    expect(byHandProblems({ ...lenox, method: 'email', tracking: '' }, TODAY)).toEqual(['An email needs the address it went to, in the tracking box'])
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
    const jobs = [j('j273', 'a1', '9703 Lenox Hl', 17_585), j('j858', 'a1', '9703 Lenox Hl', 7_902), j('j866', 'a1', '9703 Lenox Hill', 3_500), j('j1009', 'a1', '9703 Lenox Hl', 350), j('paid', 'a1', '9703 Lenox Hl', 0), j('j790', 'a2', '628 Terrell Rd', 1_713)]
    expect(otherJobsAtProperty(jobs[0]!, jobs).map((x) => x.id)).toEqual(['j858', 'j866', 'j1009'])
    // No saved property on the job: the street number and street decide.
    const street = [j('s1', null, '9703 Lenox Hl, San Antonio', 100), j('s2', null, '9703 Lenox Hl San Antonio TX', 200), j('s3', null, '9705 Lenox Hl', 300)]
    expect(otherJobsAtProperty(street[0]!, street).map((x) => x.id)).toEqual(['s2'])
  })
  it('reads the months as typed', () => {
    expect(parsePrintedMonths('April, June, July and August 2026', 2026)).toEqual(['2026-04', '2026-06', '2026-07', '2026-08'])
    expect(parsePrintedMonths('Jul + Aug', 2026)).toEqual(['2026-07', '2026-08'])
    expect(parsePrintedMonths('2026-06 2026-6', 2026)).toEqual(['2026-06'])
    expect(parsePrintedMonths('', 2026)).toEqual([])
  })
})
