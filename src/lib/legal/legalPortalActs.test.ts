import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { firmVoidProblem, isLegalClientId, isVoidedEntry, legalActDateProblem, legalRateLimitMessage, officeCanVoid, recordedByOf } from '../../../supabase/functions/_shared/legalPortalActs'
import { buildFirmActivity, type LegalMatterRow } from './legalMatters'
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

describe('an unknown Recorded by is refused, never saved as the firm (review)', () => {
  it('submit-legal-portal answers 400 when the id names nobody live on the firm’s list', () => {
    const src = readFileSync('supabase/functions/submit-legal-portal/index.ts', 'utf8')
    expect(src).toMatch(/if \(!who\) return jsonResponse\(\{ error: 'Pick who recorded this from the list\.' \}, 400\)/)
  })
})

describe('undo with a reason (#85 item 18, PR 2)', () => {
  const e = (over: Record<string, unknown>) => ({ kind: 'fee', via_portal: true, voided_at: null, acknowledged_at: null, ...over }) as { kind: string; via_portal: boolean; voided_at: string | null; acknowledged_at: string | null }
  it('each side undoes its own: the firm its fees, costs and an unapplied payment; the office its fees, costs and notes', () => {
    expect(firmVoidProblem(e({}))).toBeNull()
    expect(firmVoidProblem(e({ kind: 'cost' }))).toBeNull()
    expect(firmVoidProblem(e({ kind: 'payment_received' }))).toBeNull()
    expect(firmVoidProblem(e({ kind: 'payment_received', acknowledged_at: '2026-10-05T00:00:00Z' }))).toMatch(/already applied/)
    expect(firmVoidProblem(e({ kind: 'step' }))).toBe('Record the right step instead.')
    expect(firmVoidProblem(e({ via_portal: false }))).toMatch(/office’s/)
    expect(firmVoidProblem(e({ voided_at: '2026-10-05T00:00:00Z' }))).toBe('Already undone.')
    expect(officeCanVoid(e({ via_portal: false, kind: 'note' }))).toBe(true)
    expect(officeCanVoid(e({ via_portal: false, kind: 'recovery_applied' }))).toBe(false)
    expect(officeCanVoid(e({ via_portal: true }))).toBe(false)
    expect(isVoidedEntry({ voided_at: '2026-10-05T00:00:00Z' })).toBe(true)
  })
  it('a voided act leaves the office’s Needs You', () => {
    const m = { id: 'm1', payer_key: 'c:x', payer_name: 'Lenox' } as LegalMatterRow
    const row = { id: 'f1', matter_id: 'm1', kind: 'fee', amount: 3500, body: 'Filing fee', occurred_on: '2026-10-01', meta: {}, via_portal: true, created_by: null, acknowledged_at: null, created_at: '2026-10-01T15:00:00Z' }
    expect(buildFirmActivity([row], [m]).count).toBe(1)
    expect(buildFirmActivity([{ ...row, voided_at: '2026-10-05T00:00:00Z' }], [m]).count).toBe(0)
  })
})
