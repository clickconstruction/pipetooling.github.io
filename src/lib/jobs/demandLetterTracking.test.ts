import { describe, expect, it } from 'vitest'
import {
  demandLetterOpenRemaining,
  demandLettersOverdue,
  liveDemandLetters,
  type JobDemandLetterRow,
} from './demandLetterTracking'

function letter(partial: Partial<JobDemandLetterRow>): JobDemandLetterRow {
  return {
    id: 'd1',
    job_id: 'j1',
    invoice_ids: ['inv-a'],
    amount: 2711.5,
    deadline_date: '2026-09-16',
    fields: {},
    recipient_name: 'Knight Contracting',
    recipient_email: '',
    recipient_address: '',
    sent_method: 'certified_mail',
    tracking_number: '9407',
    sent_at: '2026-09-02',
    created_by: null,
    created_at: '2026-09-02T16:00:00Z',
    voided_at: null,
    ...partial,
  } as JobDemandLetterRow
}

const amounts = new Map([['inv-a', 3850]])

describe('liveDemandLetters', () => {
  it('drops voided, newest first', () => {
    const rows = [
      letter({ id: 'old', created_at: '2026-08-01T00:00:00Z' }),
      letter({ id: 'void', voided_at: '2026-08-02T00:00:00Z' }),
      letter({ id: 'new', created_at: '2026-09-02T00:00:00Z' }),
    ]
    expect(liveDemandLetters(rows).map((r) => r.id)).toEqual(['new', 'old'])
  })
})

describe('demandLetterOpenRemaining', () => {
  it('open = covered line amounts minus applied', () => {
    expect(demandLetterOpenRemaining(letter({}), amounts, new Map([['inv-a', 1138.5]]))).toBe(2711.5)
    expect(demandLetterOpenRemaining(letter({}), amounts, new Map([['inv-a', 3850]]))).toBe(0)
  })
  it('no line snapshot falls back to the letter amount', () => {
    expect(demandLetterOpenRemaining(letter({ invoice_ids: [] }), amounts, new Map())).toBe(2711.5)
  })
})

describe('demandLettersOverdue', () => {
  const applied = new Map([['inv-a', 1138.5]])
  it('flags a sent letter past deadline with money open', () => {
    const r = demandLettersOverdue([letter({})], amounts, applied, '2026-09-19')
    expect(r.count).toBe(1)
    expect(r.total).toBe(2711.5)
    expect(r.jobIds).toEqual(['j1'])
  })
  it('quiet before the deadline, when paid, when voided, when never sent, or with no deadline', () => {
    expect(demandLettersOverdue([letter({})], amounts, applied, '2026-09-16').count).toBe(0)
    expect(demandLettersOverdue([letter({})], amounts, new Map([['inv-a', 3850]]), '2026-09-19').count).toBe(0)
    expect(demandLettersOverdue([letter({ voided_at: '2026-09-03T00:00:00Z' })], amounts, applied, '2026-09-19').count).toBe(0)
    expect(demandLettersOverdue([letter({ sent_at: null })], amounts, applied, '2026-09-19').count).toBe(0)
    expect(demandLettersOverdue([letter({ deadline_date: null })], amounts, applied, '2026-09-19').count).toBe(0)
  })
})
