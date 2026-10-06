import { describe, expect, it } from 'vitest'
import {
  isPayApplicationCopy,
  payApplicationFileName,
  payApplicationHistory,
  payApplicationSavedWords,
  payApplicationSummary,
  payApplicationSummaryWords,
  payApplicationWentOutWords,
  wasSavedAgain,
} from './aiaPayApplicationHistory'
import { payApplicationWriteFromForm, savedPayApplicationFromRow, type PayApplicationRow, type SavedPayApplication } from './aiaPayApplications'
import type { SentCopy } from './sent/sentCopies'

/** Job 892 as the guide tells it: a 37,745 contract at 10%, one line. */
function app(no: number, thisPeriod: number, previous: number, certified: number, stamps: Partial<PayApplicationRow> = {}): SavedPayApplication {
  const w = payApplicationWriteFromForm('job-892', {
    values: { g702_n5_project: String(no), g702_n6_period_to: `0${6 + no}/30/2026`, g702_h18_original_contract_sum: 37745, g702_c28_retainage_percent: 10, g702_h40_less_previous_certificates: certified },
    lines: [{ id: 'line-1', label: 'Plumbing', scheduledValue: 37745, labor: null, stage: null, fromPrevious: previous, thisPeriod, stored: 0 }],
    splitLaborMaterial: false,
  })
  if (!w.ok) throw new Error(w.reason)
  return savedPayApplicationFromRow({ id: `app-${no}`, updated_at: '2026-08-01T14:12:00Z', ...w.row, ...stamps } as PayApplicationRow)
}

function copy(p: Partial<SentCopy>): SentCopy {
  return {
    id: 'c1',
    kind: 'pay_application',
    title: 'Pay application 1 · AIA G702-G703',
    how: 'download',
    recipientName: '',
    recipientEmails: [],
    subject: '',
    sourceTable: 'job_pay_applications',
    sourceId: 'app-1',
    copyPath: 'c1/J892-App1.xlsx',
    copyType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    copyHash: 'h1',
    attachments: [],
    sentAt: '2026-08-01T14:12:00Z',
    sentByName: 'Taunya',
    ...p,
  }
}

const day = (iso: string) => iso.slice(0, 10)

describe('payApplicationSummary', () => {
  it('reads the job\'s standing from the latest application by number', () => {
    // 1: 15,098 of work; 2: 12,078.40 more. 27,176.40 to date at 10% held.
    const s = payApplicationSummary([app(2, 12078.4, 15098, 13588.2), app(1, 15098, 0, 0)])
    expect(s).toEqual({
      count: 2,
      latestNumber: 2,
      contractSumToDate: 37745,
      totalCompletedAndStored: 27176.4,
      fractionComplete: 27176.4 / 37745,
      retainageHeld: 2717.64,
      certifiedToDate: 24458.76,
      workLeft: 10568.6,
    })
    expect(payApplicationSummaryWords(s!)).toBe('2 saved · $24,458.76 certified · 72% complete')
  })

  it('is null with nothing saved, and 0% on a contract of 0', () => {
    expect(payApplicationSummary([])).toBeNull()
    const w = payApplicationWriteFromForm('j', { values: { g702_n5_project: '1' }, lines: [{ id: 'l', label: '', scheduledValue: 0, labor: null, stage: null, fromPrevious: 0, thisPeriod: 0, stored: 0 }], splitLaborMaterial: false })
    if (!w.ok) throw new Error(w.reason)
    const zero = savedPayApplicationFromRow({ id: 'a', updated_at: null, ...w.row } as PayApplicationRow)
    expect(payApplicationSummary([zero])?.fractionComplete).toBe(0)
  })
})

describe('payApplicationHistory', () => {
  it('puts each application on a line with the workbooks filed on it, newest first, in number order', () => {
    const apps = [app(2, 12078.4, 15098, 13588.2), app(1, 15098, 0, 0)]
    const sent = [
      copy({ id: 'c1', sentAt: '2026-08-01T14:12:00Z' }),
      copy({ id: 'c2', sentAt: '2026-08-01T14:40:00Z', copyPath: 'c2/J892-App1.xlsx' }),
      copy({ id: 'c3', sourceId: 'app-2', sentAt: '2026-09-02T13:05:00Z', copyPath: 'c3/J892-App2.xlsx' }),
      // A lien notice about the same job is another kind of paper.
      copy({ id: 'c4', kind: 'lien_notice', sourceId: null, sentAt: '2026-09-03T13:05:00Z' }),
      // A workbook downloaded before a number was typed points at no application.
      copy({ id: 'c5', sourceId: null, sentAt: '2026-07-30T10:00:00Z', copyPath: 'c5/J892-App.xlsx' }),
      // A workbook on an application that is no longer on the job.
      copy({ id: 'c6', sourceId: 'app-9', sentAt: '2026-07-31T10:00:00Z' }),
    ]
    const h = payApplicationHistory(apps, sent)
    expect(h.lines.map((l) => [l.app.applicationNumber, l.wentOut.map((c) => c.id)])).toEqual([
      [1, ['c2', 'c1']],
      [2, ['c3']],
    ])
    expect(h.unsaved.map((c) => c.id)).toEqual(['c5'])
    expect(h.summary?.latestNumber).toBe(2)
  })

  it('has no lines and no summary on a job with nothing saved, but still the unsaved workbooks', () => {
    const h = payApplicationHistory([], [copy({ sourceId: null })])
    expect(h.lines).toEqual([])
    expect(h.summary).toBeNull()
    expect(h.unsaved).toHaveLength(1)
  })
})

describe('the words', () => {
  it('names the kept file from its path', () => {
    expect(payApplicationFileName(copy({}))).toBe('J892-App1.xlsx')
    expect(payApplicationFileName(copy({ copyPath: null }))).toBe('')
    expect(isPayApplicationCopy(copy({}))).toBe(true)
    expect(isPayApplicationCopy(copy({ kind: 'bill' }))).toBe(false)
  })

  it('says who saved it and when, and when it was saved again', () => {
    const once = app(1, 15098, 0, 0, { created_at: '2026-08-01T14:12:00Z', updated_at: '2026-08-01T14:12:00Z', created_by_user: { name: 'Taunya' }, updated_by_user: { name: 'Taunya' } })
    expect(wasSavedAgain(once)).toBe(false)
    expect(payApplicationSavedWords(once, day)).toBe('Saved 2026-08-01 by Taunya')

    const again = app(1, 15098, 0, 0, { created_at: '2026-08-01T14:12:00Z', updated_at: '2026-09-18T20:31:00Z', created_by_user: { name: 'Taunya' }, updated_by_user: { name: 'Robert' } })
    expect(wasSavedAgain(again)).toBe(true)
    expect(payApplicationSavedWords(again, day)).toBe('Saved 2026-08-01 by Taunya · saved again 2026-09-18 by Robert')

    // A row read without its stamps: only the last save is known, and no name.
    const bare = app(1, 15098, 0, 0, { updated_at: '2026-08-01T14:12:00Z' })
    expect(payApplicationSavedWords(bare, day)).toBe('Saved 2026-08-01')
    expect(payApplicationSavedWords({ createdAt: null, updatedAt: null, createdByName: '', updatedByName: '' }, day)).toBe('')
  })

  it('says when a workbook went out and by whom', () => {
    expect(payApplicationWentOutWords(copy({}), day)).toBe('Went out 2026-08-01 by Taunya')
    expect(payApplicationWentOutWords(copy({ sentByName: '' }), day)).toBe('Went out 2026-08-01')
  })
})
