import { describe, expect, it } from 'vitest'
import type { LienDeskItemRow } from './lienDesk'
import { LETTER_TWO_KINDS, letterTwoByJobFrom, letterTwoIsDue, letterTwoStatus, summarizeLetterTwo } from './lienLetterTwo'
import { letterTwoTemplate, paidOutOwnerLetter, fillCoverLetter } from './gcOnNotice'
import { parseLienDeskDraftFields } from './lienNoticeDraft'

const TODAY = '2026-09-17'

function item(partial: Partial<LienDeskItemRow> & { id: string; status: LienDeskItemRow['status'] }): LienDeskItemRow {
  return { job_id: 'j377', kind: 'notice_53_056', months: ['2026-07', '2026-08'], fields: {}, cover_note: true, drafted_by: null, drafted_at: '2026-09-05T10:00:00Z', submitted_at: null, approved_by: null, approved_at: null, approval_mode: null, word_note: '', word_channel: '', held_by: null, held_at: null, hold_reason: '', hold_until: null, sent_filing_id: null, sent_at: null, pulled_back_by: null, pulled_back_at: null, created_at: '2026-09-05T10:00:00Z', updated_at: '2026-09-05T10:00:00Z', voided_at: null, ...partial } as LienDeskItemRow
}
const notice = { noticeDate: '2026-09-05', projectDescription: '', claimantName: 'Click', laborMaterialsType: '', originalContractorName: 'Harborline', contractedWithIfDifferent: '', claimAmount: '9800.00', contactPerson: 'Rey', claimantAddress: '' }
const first = item({ id: 'first', status: 'sent', sent_at: '2026-09-05T15:00:00Z', fields: { notice, gcEmail: '' } })

describe('letter two — the clock on a sent notice', () => {
  it('counts the days from the first packet: waiting, due from day 10, overdue from day 14', () => {
    expect(letterTwoStatus({ items: [first], openBalance: 9_800, todayYmd: '2026-09-11' })).toMatchObject({ state: 'waiting', day: 6, words: 'day 6' })
    expect(letterTwoStatus({ items: [first], openBalance: 9_800, todayYmd: '2026-09-15' })).toMatchObject({ state: 'due', day: 10, words: 'day 10 · letter two' })
    expect(letterTwoStatus({ items: [first], openBalance: 9_800, todayYmd: '2026-09-19' })).toMatchObject({ state: 'overdue', day: 14, words: 'day 14 · letter two overdue' })
    expect(letterTwoIsDue({ state: 'due' })).toBe(true)
    expect(letterTwoIsDue({ state: 'waiting' })).toBe(false)
  })

  it('is off once the GC paid, once the GC authorized direct pay, or once the owner called', () => {
    expect(letterTwoStatus({ items: [first], openBalance: 0, todayYmd: TODAY }).state).toBe('paid')
    const okayed = item({ ...first, fields: { notice, gcEmail: '', gcAuthorizedDirectPay: { at: '2026-09-15T12:00:00Z', name: 'Taunya', note: 'email from Harborline' } } })
    const s = letterTwoStatus({ items: [okayed], openBalance: 9_800, todayYmd: TODAY, formatDay: (d) => d })
    expect(s.state).toBe('gc_authorized')
    expect(s.words).toBe('GC authorized direct pay 2026-09-15')
    expect(letterTwoStatus({ items: [first], openBalance: 9_800, todayYmd: TODAY, ownerCalledAt: '2026-09-16T12:00:00Z' }).state).toBe('owner_called')
  })

  it('a letter-two draft on the job is in flight; a sent one is sent; the first packet is the latest sent item that is not a letter two', () => {
    const twoDraft = item({ id: 'two', status: 'awaiting_approval', created_at: '2026-09-16T10:00:00Z', fields: { notice, gcEmail: '', letterTwo: { kind: 'paid_out', afterItemId: 'first', afterSentAt: '2026-09-05T15:00:00Z' } } })
    expect(letterTwoStatus({ items: [first, twoDraft], openBalance: 9_800, todayYmd: TODAY })).toMatchObject({ state: 'in_flight', words: 'letter two · paid-out · awaiting the leader', letterTwo: { itemId: 'two', kind: 'paid_out' } })
    const twoSent = item({ ...twoDraft, status: 'sent', sent_at: '2026-09-19T15:00:00Z' })
    const s = letterTwoStatus({ items: [first, twoSent], openBalance: 9_800, todayYmd: '2026-09-22', formatDay: (d) => d })
    expect(s).toMatchObject({ state: 'sent', firstItemId: 'first', words: 'letter two sent 2026-09-19 · paid-out' })
    expect(letterTwoStatus({ items: [], openBalance: 9_800, todayYmd: TODAY }).state).toBe('none')
    expect(letterTwoStatus({ items: [item({ id: 'd', status: 'drafted' })], openBalance: 9_800, todayYmd: TODAY }).state).toBe('none')
  })

  it('summarizes every job for the Dashboard, by the job’s own balance', () => {
    const byJob = letterTwoByJobFrom([first, item({ ...first, id: 'other', job_id: 'j2' })], (id) => (id === 'j2' ? 0 : 9_800), TODAY)
    expect(Object.keys(byJob).sort()).toEqual(['j2', 'j377'])
    expect(byJob.j2!.state).toBe('paid')
    expect(summarizeLetterTwo(byJob)).toEqual({ due: 1, overdue: 0, jobIds: ['j377'] })
  })
})

describe('counsel’s paid-out letter', () => {
  it('asks the three questions, names § 53.101 and § 53.105, and fills like the other letters', () => {
    const t = paidOutOwnerLetter({ gcName: 'Harborline Builders', claimantName: 'Click Plumbing' })
    expect(t).toContain('reason to believe you may already have paid Harborline Builders in full')
    expect(t).toContain('§ 53.101')
    expect(t).toContain('§ 53.105')
    expect(t).toContain('whether you still owe Harborline Builders any amount, including retainage')
    expect(t).toContain('the date the original contract was completed')
    const filled = fillCoverLetter(t, { property: '44 Lantern Row', months: 'July and August 2026', job: 'J377', amount: '$9,800.00', staleNote: '', contact: 'Rey Salinas', phone: '(830) 555-0142', affidavitMonth: 'third' })
    expect(filled).toContain('Please call Rey Salinas at (830) 555-0142 this week')
    expect(filled).toContain('15th day of the third month')
    expect(filled).not.toContain('{{')
    expect(letterTwoTemplate('unresponsive', { gcName: 'Harborline', claimantName: 'Click' })).toContain('has not responded to us')
    expect(LETTER_TWO_KINDS.map((k) => k.key)).toEqual(['paid_out', 'unresponsive'])
  })

  it('the draft keeps the letter-two mark and the GC’s okay', () => {
    const d = parseLienDeskDraftFields({ notice, gcEmail: '', letterTwo: { kind: 'unresponsive', afterItemId: 'first', afterSentAt: '2026-09-05T15:00:00Z' }, gcAuthorizedDirectPay: { at: '2026-09-15T12:00:00Z', name: 'Taunya', note: 'email' } })
    expect(d?.letterTwo).toEqual({ kind: 'unresponsive', afterItemId: 'first', afterSentAt: '2026-09-05T15:00:00Z' })
    expect(d?.gcAuthorizedDirectPay).toEqual({ at: '2026-09-15T12:00:00Z', name: 'Taunya', note: 'email' })
    expect(parseLienDeskDraftFields({ notice, gcEmail: '', letterTwo: { kind: 'nope' } })?.letterTwo).toBeUndefined()
  })
})
