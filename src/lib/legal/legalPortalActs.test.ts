import { describe, expect, it } from 'vitest'
import { isLegalClientId, legalActDateProblem, legalRateLimitMessage, recordedByOf } from '../../../supabase/functions/_shared/legalPortalActs'
import { conversationRows, conversationWho, entryRecordedByWords } from './legalAsks'
import type { LegalEntryRow } from './legalMatters'

describe('the firm’s acts (#85 item 18)', () => {
  it('takes a real date up to today and up to three years back', () => {
    expect(legalActDateProblem('2026-10-01', '2026-10-05')).toBeNull()
    expect(legalActDateProblem('2026-10-05', '2026-10-05')).toBeNull()
    expect(legalActDateProblem('2026-10-06', '2026-10-05')).toBe('The date cannot be in the future.')
    expect(legalActDateProblem('2026-02-30', '2026-10-05')).toBe('Pick a date.')
    expect(legalActDateProblem('', '2026-10-05')).toBe('Pick a date.')
    expect(legalActDateProblem('2023-10-05', '2026-10-05')).toBeNull()
    expect(legalActDateProblem('2023-10-04', '2026-10-05')).toMatch(/three years/)
  })
  it('knows a one-time key and names the matter when the hourly limit is hit', () => {
    expect(isLegalClientId('3f2b8c1e-9d4a-4b7e-8c21-5a6f0e9d1b2c')).toBe(true)
    expect(isLegalClientId('not-a-key')).toBe(false)
    expect(isLegalClientId(42)).toBe(false)
    expect(legalRateLimitMessage('Lenox Builders', '3:40 PM')).toBe('60 changes on Lenox Builders in the last hour is the limit. Try again after 3:40 PM.')
    expect(legalRateLimitMessage(' ', null)).toBe('60 changes on this matter in the last hour is the limit. Try again in an hour.')
  })
  it('reads who recorded an act, and words it for each side', () => {
    expect(recordedByOf({ recordedBy: { id: 'r1', name: ' Dana Reyes ' } })).toEqual({ id: 'r1', name: 'Dana Reyes' })
    expect(recordedByOf({ recordedBy: { id: 'r1', name: '' } })).toBeNull()
    expect(recordedByOf(null)).toBeNull()
    const base = { id: 'e', matter_id: 'm', kind: 'fee', amount: 450, body: '', occurred_on: '2026-10-01', via_portal: true, created_by: null, acknowledged_at: null, created_at: '' } as LegalEntryRow
    const dana = { ...base, meta: { recordedBy: { id: 'r1', name: 'Dana Reyes' } } }
    expect(entryRecordedByWords(dana, 'firm')).toBe('Dana Reyes')
    expect(entryRecordedByWords(dana, 'office')).toBe('Dana Reyes · firm')
    expect(entryRecordedByWords({ ...base, meta: {} }, 'firm')).toBe('your firm')
    expect(entryRecordedByWords({ ...base, meta: {} }, 'office')).toBe('the firm')
    expect(entryRecordedByWords({ ...base, meta: {}, via_portal: false, created_by: 'u1' }, 'firm')).toBe('the office')
    expect(entryRecordedByWords({ ...base, meta: {}, via_portal: false, created_by: 'u1' }, 'office', () => 'Grace')).toBe('Grace')
    const [q] = conversationRows([{ ...dana, kind: 'question', created_at: '2026-10-01T15:00:00Z' }])
    expect(conversationWho(q!, 'firm')).toBe('Dana Reyes asked')
    expect(conversationWho(q!, 'office')).toBe('Dana Reyes at the firm asked')
  })
})
