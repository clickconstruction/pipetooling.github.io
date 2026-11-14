import { describe, expect, it } from 'vitest'
import type { LienDeskItemRow } from './lienDesk'
import { LIEN_DESK_LEAD_DAYS } from './lienDesk'
import { LIEN_DESK_STARTED_READ_DAYS, lienDeskDayInsideLead, lienDeskItemStarted, lienDeskKeepNoticeRows, lienDeskKeepRows, lienDeskStartedJobIds, lienDeskStartedNoticeMonths } from './lienDeskStarted'

const TODAY = '2026-11-14'
/** Inside the lead: Nov 16 is two days out. Outside it: Dec 15 is thirty-one. */
const NEAR = '2026-11-16'
const FAR = '2026-12-15'

function item(partial: Partial<LienDeskItemRow> & { job_id: string; kind: LienDeskItemRow['kind']; status: LienDeskItemRow['status'] }): LienDeskItemRow {
  return { id: 'i-' + partial.job_id + '-' + partial.kind, months: [], fields: {}, cover_note: true, drafted_by: null, drafted_at: '2026-11-14T10:00:00Z', submitted_at: null, approved_by: null, approved_at: null, approval_mode: null, word_note: '', word_channel: '', held_by: null, held_at: null, hold_reason: '', hold_until: null, sent_filing_id: null, sent_at: null, pulled_back_by: null, pulled_back_at: null, created_at: '2026-11-14T10:00:00Z', updated_at: '2026-11-14T10:00:00Z', voided_at: null, ...partial } as LienDeskItemRow
}

const affRow = (job_id: string, deadline: string | null) => ({ job_id, deadline, last_month: '2026-09' })
const noticeRow = (job_id: string, work_month: string, deadline: string | null) => ({ job_id, work_month, deadline })

describe('lienDeskStarted (v2.7261, punch list #354: a started paper stays on the desk, whatever its day)', () => {
  it('asks the readers further ahead than the lead', () => {
    expect(LIEN_DESK_STARTED_READ_DAYS).toBeGreaterThan(LIEN_DESK_LEAD_DAYS)
  })

  it('a started item is one that is not voided, not sent and not missed', () => {
    for (const status of ['drafted', 'awaiting_approval', 'approved', 'held'] as const) expect(lienDeskItemStarted(item({ job_id: 'a', kind: 'affidavit', status }))).toBe(true)
    expect(lienDeskItemStarted(item({ job_id: 'a', kind: 'affidavit', status: 'sent' }))).toBe(false)
    expect(lienDeskItemStarted(item({ job_id: 'a', kind: 'affidavit', status: 'missed' }))).toBe(false)
    expect(lienDeskItemStarted(item({ job_id: 'a', kind: 'affidavit', status: 'drafted', voided_at: '2026-11-14T11:00:00Z' }))).toBe(false)
  })

  it('a day inside the lead, a day already past, or no day at all is kept; a day past the lead is not', () => {
    expect(lienDeskDayInsideLead(NEAR, TODAY)).toBe(true)
    expect(lienDeskDayInsideLead('2026-11-10', TODAY)).toBe(true)
    expect(lienDeskDayInsideLead(null, TODAY)).toBe(true)
    expect(lienDeskDayInsideLead('', TODAY)).toBe(true)
    expect(lienDeskDayInsideLead(FAR, TODAY)).toBe(false)
    expect(lienDeskDayInsideLead('2026-12-14', TODAY)).toBe(true)
  })

  it('an affidavit row inside the lead stays, one outside goes, one outside on a job with a started paper stays', () => {
    const rows = [affRow('near', NEAR), affRow('far', FAR), affRow('drafted', FAR), affRow('held', FAR), affRow('approved', FAR), affRow('awaiting', FAR)]
    const items = [
      item({ job_id: 'drafted', kind: 'affidavit', status: 'drafted' }),
      item({ job_id: 'held', kind: 'affidavit', status: 'held' }),
      item({ job_id: 'approved', kind: 'affidavit', status: 'approved' }),
      item({ job_id: 'awaiting', kind: 'affidavit', status: 'awaiting_approval' }),
    ]
    expect(lienDeskKeepRows(rows, items, 'affidavit', TODAY).map((r) => r.job_id)).toEqual(['near', 'drafted', 'held', 'approved', 'awaiting'])
  })

  it('a row outside the lead on a job whose paper was sent, missed or voided goes', () => {
    const rows = [affRow('sent', FAR), affRow('missed', FAR), affRow('voided', FAR)]
    const items = [
      item({ job_id: 'sent', kind: 'affidavit', status: 'sent', sent_at: '2026-11-01T10:00:00Z' }),
      item({ job_id: 'missed', kind: 'affidavit', status: 'missed' }),
      item({ job_id: 'voided', kind: 'affidavit', status: 'drafted', voided_at: '2026-11-14T11:00:00Z' }),
    ]
    expect(lienDeskKeepRows(rows, items, 'affidavit', TODAY)).toEqual([])
  })

  it('a started paper of another kind keeps nothing: a drafted notice does not hold the affidavit row', () => {
    const rows = [affRow('a', FAR)]
    expect(lienDeskKeepRows(rows, [item({ job_id: 'a', kind: 'notice_53_056', status: 'drafted', months: ['2026-09'] })], 'affidavit', TODAY)).toEqual([])
    expect(lienDeskKeepRows(rows, [item({ job_id: 'a', kind: 'retainage_53_057', status: 'drafted' })], 'affidavit', TODAY)).toEqual([])
    expect(lienDeskStartedJobIds([item({ job_id: 'a', kind: 'retainage_53_057', status: 'drafted' })], 'retainage_53_057')).toEqual(new Set(['a']))
  })

  it('a retainage row with no day (the clock not started) stays, as the reader kept it', () => {
    const rows = [{ job_id: 'open', deadline: null }, { job_id: 'far', deadline: FAR }]
    expect(lienDeskKeepRows(rows, [], 'retainage_53_057', TODAY).map((r) => r.job_id)).toEqual(['open'])
  })

  it('a far notice month stays only when a started notice on the job names it', () => {
    const rows = [noticeRow('a', '2026-08', NEAR), noticeRow('a', '2026-09', FAR), noticeRow('a', '2026-10', '2027-01-15'), noticeRow('b', '2026-09', FAR)]
    const items = [item({ job_id: 'a', kind: 'notice_53_056', status: 'drafted', months: ['2026-09'] })]
    expect(lienDeskKeepNoticeRows(rows, items, TODAY).map((r) => `${r.job_id} ${r.work_month}`)).toEqual(['a 2026-08', 'a 2026-09'])
    expect([...lienDeskStartedNoticeMonths(items).get('a')!]).toEqual(['2026-09'])
  })

  it('a sent notice naming a far month keeps nothing, and a drafted affidavit keeps no notice month', () => {
    const rows = [noticeRow('a', '2026-09', FAR)]
    expect(lienDeskKeepNoticeRows(rows, [item({ job_id: 'a', kind: 'notice_53_056', status: 'sent', months: ['2026-09'], sent_at: '2026-11-01T10:00:00Z' })], TODAY)).toEqual([])
    expect(lienDeskKeepNoticeRows(rows, [item({ job_id: 'a', kind: 'affidavit', status: 'drafted', months: ['2026-09'] })], TODAY)).toEqual([])
  })

  it('keeps the readers’ order and every column', () => {
    const rows = [{ ...affRow('b', NEAR), open_balance: 2 }, { ...affRow('a', NEAR), open_balance: 1 }]
    expect(lienDeskKeepRows(rows, [], 'affidavit', TODAY)).toEqual(rows)
  })
})
