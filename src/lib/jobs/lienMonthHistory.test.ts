import { describe, expect, it } from 'vitest'
import type { LienDeskItemRow, LienDeskMonth } from './lienDesk'
import { buildLienMonthHistory, lienMonthMissUnnoted, lienMonthOutcomeMeaning } from './lienMonthHistory'

const notice = { noticeDate: '', projectDescription: '', claimantName: '', laborMaterialsType: '', originalContractorName: '', contractedWithIfDifferent: '', claimAmount: '', contactPerson: '', claimantAddress: '' }
const item = (over: Partial<LienDeskItemRow>): LienDeskItemRow =>
  ({ id: 'i', job_id: 'j1', kind: 'notice_53_056', status: 'sent', months: [], fields: { notice, gcEmail: '' }, voided_at: null, created_at: '2026-05-01T00:00:00Z', updated_at: '2026-05-01T00:00:00Z', sent_at: null, approval_mode: null, ...over }) as LienDeskItemRow
const month = (key: string, over: Partial<LienDeskMonth> = {}): LienDeskMonth => ({ key, approvedHours: 10, deadline: `${key}-15`, daysLeft: 20, noticed: false, ...over })

describe('buildLienMonthHistory', () => {
  it('a sent item, a skip with its reason and who, and a closed window — oldest first', () => {
    const items = [
      item({ id: 'a', months: ['2026-04'], sent_at: '2026-05-28T15:00:00Z', approval_mode: 'leader' }),
      item({ id: 'b', status: 'missed', months: ['2026-05'], created_at: '2026-06-01T00:00:00Z', updated_at: '2026-08-11T14:00:00Z', fields: { notice, gcEmail: '', skipReason: ' TF Harper paid May in full ', skippedBy: { name: 'Taunya', at: '2026-08-11T13:59:00Z' } } as never }),
    ]
    const months = [month('2026-06', { daysLeft: -5, approvedHours: 41 }), month('2026-07')]
    expect(buildLienMonthHistory('j1', items, months)).toEqual([
      { month: '2026-04', outcome: 'sent', at: '2026-05-28T15:00:00Z', reason: '', byName: '', deadline: '', approvedHours: null, approvalMode: 'leader' },
      { month: '2026-05', outcome: 'skipped', at: '2026-08-11T13:59:00Z', reason: 'TF Harper paid May in full', byName: 'Taunya', deadline: '', approvedHours: null, approvalMode: '' },
      { month: '2026-06', outcome: 'missed', at: '', reason: '', byName: '', deadline: '2026-06-15', approvedHours: 41, approvalMode: '' },
    ])
  })

  it('a noted miss (v2.3679) keeps the outcome missed and says who wrote it down', () => {
    const items = [item({ status: 'missed', months: ['2026-06'], fields: { notice, gcEmail: '', windowClosed: { name: 'Taunya', at: '2026-09-21T15:00:00Z' } } as never })]
    const out = buildLienMonthHistory('j1', items, [month('2026-06', { daysLeft: -6 })])
    expect(out[0]).toMatchObject({ month: '2026-06', outcome: 'missed', at: '2026-09-21T15:00:00Z', byName: 'Taunya', reason: '' })
    expect(lienMonthMissUnnoted(out[0]!)).toBe(false)
    expect(lienMonthMissUnnoted({ outcome: 'missed', at: '', byName: '' })).toBe(true)
    expect(lienMonthMissUnnoted({ outcome: 'skipped', at: '', byName: '' })).toBe(false)
  })

  it('open months are not history; an older skip without a name falls back to the row’s updated_at', () => {
    const items = [item({ status: 'missed', months: ['2026-03'], updated_at: '2026-06-20T00:00:00Z', fields: { notice, gcEmail: '', skipReason: 'paid' } as never })]
    const out = buildLienMonthHistory('j1', items, [month('2026-07'), month('2026-08')])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ month: '2026-03', outcome: 'skipped', at: '2026-06-20T00:00:00Z', byName: '' })
  })

  it('a missed item with no reason is a closed window, not a decision; other jobs, affidavits and voided items are ignored', () => {
    const items = [
      item({ status: 'missed', months: ['2026-02'] }),
      item({ job_id: 'other', months: ['2026-01'] }),
      item({ kind: 'affidavit', months: ['2026-01'] }),
      item({ voided_at: '2026-03-01T00:00:00Z', months: ['2026-01'] }),
      item({ status: 'drafted', months: ['2026-01'] }),
    ]
    expect(buildLienMonthHistory('j1', items, []).map((e) => [e.month, e.outcome])).toEqual([['2026-02', 'missed']])
  })

  it('a send is final, and a month the RPC calls noticed counts as sent when no item says so', () => {
    const items = [
      item({ id: 'a', months: ['2026-04'], created_at: '2026-05-01T00:00:00Z', sent_at: '2026-05-28T00:00:00Z' }),
      item({ id: 'b', status: 'missed', months: ['2026-04'], created_at: '2026-06-01T00:00:00Z', fields: { notice, gcEmail: '', skipReason: 'oops' } as never }),
    ]
    const out = buildLienMonthHistory('j1', items, [month('2026-05', { noticed: true })])
    expect(out.map((e) => [e.month, e.outcome])).toEqual([['2026-04', 'sent'], ['2026-05', 'sent']])
  })

  it('says what each outcome means for the lien right', () => {
    expect(lienMonthOutcomeMeaning({ outcome: 'skipped' }, 'May 2026')).toBe('The lien right on May 2026 work was given up on purpose.')
    expect(lienMonthOutcomeMeaning({ outcome: 'missed' }, 'June 2026')).toContain('is gone')
  })
})
