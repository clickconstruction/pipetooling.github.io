import { describe, expect, it } from 'vitest'
import type { RunNotice } from './lienDeskRun'
import { combineKey, combineNoticesByProperty, combineSummary, combinedFilingPayloads } from './lienNoticeCombine'

const fields = (claim: string, gc = 'RMC-Dudley Mason') => ({ noticeDate: '2026-09-23', projectDescription: '9703 Lenox Hl', claimantName: 'Click Plumbing and Electrical', laborMaterialsType: 'Plumbing labor and materials', originalContractorName: gc, contractedWithIfDifferent: '', claimAmount: claim, contactPerson: 'Malachi Whites', claimantAddress: '5501 Balcones Dr' })
const owner = (name: string, address: string) => ({ key: 'owner' as const, label: 'Owner of record', name, address, email: '', method: 'certified_mail' as const, tracking: '' })
const gcRecipient = { key: 'original_contractor' as const, label: 'Original contractor', name: 'RMC-Dudley Mason', address: '1 GC Way', email: '', method: 'certified_mail' as const, tracking: '' }
function notice(jobNumber: string, name: string, amount: number, months: string[], ownerName = 'Umar Khan', address = '9703 Lenox Hl, San Antonio, TX 78255', gc = 'RMC-Dudley Mason'): RunNotice {
  return { kind: 'notice_53_056', itemId: `it${jobNumber}`, jobId: `j${jobNumber}`, label: `${jobNumber} · ${name}`, jobNumber, months, amount, fields: fields(amount.toFixed(2), gc), extras: { refItems: [`Job #${jobNumber}`, 'Sep 23, 2026'] }, coverNote: 'routine', coverLetter: null, recipients: [owner(ownerName, address), gcRecipient], ownerUnconfirmed: false }
}
const lenox = [notice('273', 'Dudley (Lennox)', 17_585, ['2026-08']), notice('858', 'Service visit', 7_902, ['2026-08']), notice('866', 'Omar Khan- Lennox', 3_500, ['2026-08', '2026-09'])]
const terrell = notice('790', 'Dudley Mason-Terrell Rd', 1_713, ['2026-05'], 'Someone Else', '628 Terrell Rd')

describe('one notice per property (#35 PR 3)', () => {
  it('keys on the owner, the address and the original contractor', () => {
    expect(combineKey(lenox[0]!)).toBe(combineKey(lenox[1]!))
    expect(combineKey(lenox[0]!)).not.toBe(combineKey(terrell))
    expect(combineKey(notice('x', 'x', 1, [], 'Umar Khan', '9703 Lenox Hl', 'Another GC'))).not.toBe(combineKey(lenox[0]!))
    expect(combineKey({ ...lenox[0]!, recipients: [gcRecipient] })).toBe('')
  })
  it('folds the jobs at one property into one notice: the biggest leads, the months join, the claim sums; the rest pass through', () => {
    const out = combineNoticesByProperty([...lenox, terrell], { combine: true })
    expect(out).toHaveLength(2)
    const one = out[0]!
    expect(one.jobNumber).toBe('273 + 858 + 866')
    expect(one.label).toBe('Dudley (Lennox) · 273 + 858 + 866')
    expect(one.months).toEqual(['2026-08', '2026-09'])
    expect(one.amount).toBe(28_987)
    expect(one.fields.claimAmount).toBe('28987.00')
    expect(one.extras.refItems).toEqual(['Jobs #273, #858, #866', 'Sep 23, 2026'])
    expect(one.parts!.map((p) => [p.jobNumber, p.amount])).toEqual([['273', 17_585], ['858', 7_902], ['866', 3_500]])
    expect(one.itemId).toBe('it273')
    expect(out[1]!.jobNumber).toBe('790')
    expect(out[1]!.parts).toBeUndefined()
    expect(combineSummary(out)).toEqual({ notices: 2, jobs: 4, combined: 1 })
    // Off: nothing changes.
    expect(combineNoticesByProperty([...lenox, terrell], { combine: false }).map((n) => n.jobNumber)).toEqual(['273', '858', '866', '790'])
  })
  it('records one filing per job on one packet — the job’s share, the paper’s months and total; a plain notice records as before', () => {
    const [one, plain] = combineNoticesByProperty([...lenox, terrell], { combine: true })
    const sends = [{ recipient: 'owner' as const, method: 'certified_mail' as const, tracking: '9407', sent_on: '2026-09-23' }]
    const rows = combinedFilingPayloads(one!, sends, { userId: 'u1', packetId: 'p1', document: { url: 'drive.google.com/x', note: '' } })
    expect(rows.map((r) => [r.job_id, r.amount, r.printed_claim, r.packet_id])).toEqual([['j273', 17_585, 28_987, 'p1'], ['j858', 7_902, 28_987, 'p1'], ['j866', 3_500, 28_987, 'p1']])
    expect(rows[0]).toMatchObject({ months_covered: ['2026-08', '2026-09'], sends, document_url: 'https://drive.google.com/x' })
    const solo = combinedFilingPayloads(plain!, sends, { userId: 'u1', packetId: 'p2' })
    expect(solo).toHaveLength(1)
    expect(solo[0]).toMatchObject({ job_id: 'j790', amount: 1_713, months_covered: ['2026-05'] })
    expect(solo[0]).not.toHaveProperty('packet_id')
  })
})
