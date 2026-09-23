import { describe, expect, it } from 'vitest'
import type { LienDeskItemRow } from './lienDesk'
import { AFFIDAVIT_PILE_WORDS, affidavitPileFor, buildPlaybookGridRow, ownerCallByJobFrom, ownerCallWords, parseOwnerCall, playbookGridHtml, reservationHoldEndsOn, type OwnerCall } from './lienOwnerCall'
import { letterTwoStatus } from './lienLetterTwo'

const call = (p: Partial<OwnerCall> = {}): OwnerCall => ({ at: '2026-09-17T15:00:00Z', name: 'Taunya', owesGc: 'yes', owesAmount: 14_000, reserved: 'held', originalContractCompletedOn: null, note: 'will hold the last draw', ...p })
const fmt = { day: (d: string) => d, month: (m: string) => m, money: (n: number) => `$${n.toLocaleString('en-US')}` }

describe('the owner’s call → counsel’s piles', () => {
  it('A when the owner still owes the GC or holds the 10%, B when paid and never reserved, C when paid and released, else none', () => {
    expect(affidavitPileFor(call())).toBe('A')
    expect(affidavitPileFor(call({ owesGc: 'no', reserved: 'held' }))).toBe('A')
    expect(affidavitPileFor(call({ owesGc: 'no', reserved: 'never' }))).toBe('B')
    expect(affidavitPileFor(call({ owesGc: 'no', reserved: 'released' }))).toBe('C')
    expect(affidavitPileFor(call({ owesGc: 'unknown', reserved: 'unknown' }))).toBeNull()
    expect(affidavitPileFor(null)).toBeNull()
    expect(AFFIDAVIT_PILE_WORDS.C.next).toContain('do not wait for the 15th')
  })

  it('reads the stored answers tolerantly, words them, and ends the § 53.101 hold 30 days after their contract completed', () => {
    expect(parseOwnerCall({ at: '2026-09-17T15:00:00Z', owesGc: 'nope', reserved: 'never', owesAmount: 'x', originalContractCompletedOn: '2026-08-20' })).toEqual({ at: '2026-09-17T15:00:00Z', name: '', owesGc: 'unknown', owesAmount: null, reserved: 'never', originalContractCompletedOn: '2026-08-20', note: '' })
    expect(parseOwnerCall({ name: 'x' })).toBeNull()
    expect(ownerCallWords(call(), fmt.day, fmt.money)).toBe('owner called 2026-09-17 · still owes the GC ($14,000) · 10% held')
    expect(ownerCallWords(call({ owesGc: 'no', owesAmount: null, reserved: 'never' }), fmt.day, fmt.money)).toBe('owner called 2026-09-17 · owes the GC nothing · never reserved the 10%')
    expect(reservationHoldEndsOn('2026-08-20')).toBe('2026-09-21') // Sep 19 is a Saturday
    expect(reservationHoldEndsOn(null)).toBe('')
  })

  it('the latest call per job comes off the notice items, and turns letter two off', () => {
    const item = (id: string, at: string, c: OwnerCall | null): LienDeskItemRow => ({ id, job_id: 'j1', kind: 'notice_53_056', status: 'sent', sent_at: '2026-09-05T15:00:00Z', months: ['2026-07'], fields: { notice: { noticeDate: '2026-09-05', projectDescription: '', claimantName: 'Click', laborMaterialsType: '', originalContractorName: '', contractedWithIfDifferent: '', claimAmount: '1.00', contactPerson: '', claimantAddress: '' }, gcEmail: '', ...(c ? { ownerCall: c } : {}) }, cover_note: true, drafted_by: null, drafted_at: at, submitted_at: null, approved_by: null, approved_at: null, approval_mode: null, word_note: '', word_channel: '', held_by: null, held_at: null, hold_reason: '', hold_until: null, sent_filing_id: null, pulled_back_by: null, pulled_back_at: null, created_at: at, updated_at: at, voided_at: null }) as LienDeskItemRow
    const older = item('a', '2026-09-01T10:00:00Z', call({ at: '2026-09-10T10:00:00Z', owesGc: 'no', reserved: 'never' }))
    const newer = item('b', '2026-09-02T10:00:00Z', call())
    expect(ownerCallByJobFrom([older, newer]).j1?.owesGc).toBe('yes')
    expect(ownerCallByJobFrom([item('c', '2026-09-01T10:00:00Z', null)])).toEqual({})
    expect(letterTwoStatus({ items: [newer], openBalance: 9_800, todayYmd: '2026-09-20', formatDay: (d) => d })).toMatchObject({ state: 'owner_called', words: 'owner called 2026-09-17' })
  })

  it('the grid row carries every date and fact, with "?" for what the office still owes it', () => {
    const base = { jobId: 'j1', label: 'J377 · Lantern Row', owner: 'Pat Okafor', kindWords: 'Res · Comal', homestead: false, lastMonth: '2026-09', unpaid: 9_800, noticedMonths: ['2026-07'], openMonths: [{ key: '2026-08', deadline: '2026-11-16' }], affidavitBy: '2026-12-15', bond: 'no' as const, retainage: { deadline: '2026-10-05', daysLeft: 11, noticed: false, contractEndedOn: '2026-09-03' }, call: call({ originalContractCompletedOn: '2026-08-20' }), letterTwo: { state: 'due' as const, words: 'day 12 · letter two' } }
    const r = buildPlaybookGridRow(base, fmt)
    expect(r).toMatchObject({ notice56: '2026-07 ✓ · 2026-08 by 2026-11-16', notice57: 'by 2026-10-05', affidavitBy: '2026-12-15', paidOut: 'no · $14,000 owed', reserved: 'yes · held', theirContractDone: '2026-08-20', holdEndsOn: '2026-09-21', letterTwo: 'day 12 · letter two', pile: 'A' })
    const q = buildPlaybookGridRow({ ...base, call: null, retainage: null, letterTwo: null, noticedMonths: [], openMonths: [] }, fmt)
    expect(q).toMatchObject({ notice56: '—', notice57: '—', paidOut: '?', reserved: '?', theirContractDone: '?', letterTwo: '—', pile: null })
    const html = playbookGridHtml('Harborline Builders', [r, { ...q, homestead: true }], 'September 24, 2026', fmt)
    expect(html).toContain('A · owner still owes the GC')
    expect(html).toContain('no call yet')
    expect(html).toContain('counsel reads the original contract')
    expect(html).toContain('10% hold ends 2026-09-21')
  })
})
