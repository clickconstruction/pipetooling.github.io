import { describe, expect, it } from 'vitest'
import { classifyLegalRead, LEGAL_READ_FAILED_WORDS, LEGAL_READ_MISSING_WORDS, LEGAL_READ_RETRY_MS, legalReadRetryDelay, legalReadWords } from './legalTablesRead'

describe('classifyLegalRead (v2.5780)', () => {
  it('reads ok when no table errored', () => {
    expect(classifyLegalRead([null, undefined, null, null])).toBe('ok')
  })
  it('a missing table is missing, by code or by message', () => {
    expect(classifyLegalRead([null, { code: '42P01', message: 'relation "legal_matters" does not exist' }])).toBe('missing')
    expect(classifyLegalRead([{ code: 'PGRST205', message: "Could not find the table 'public.legal_firms' in the schema cache" }])).toBe('missing')
    expect(classifyLegalRead([{ code: null, message: 'relation "public.legal_matter_jobs" does not exist' }])).toBe('missing')
  })
  it('any other failure is failed — retried, never read as the migration being missing', () => {
    expect(classifyLegalRead([{ code: '', message: 'TypeError: Failed to fetch' }])).toBe('failed')
    expect(classifyLegalRead([null, { code: '57014', message: 'canceling statement due to statement timeout' }])).toBe('failed')
    expect(classifyLegalRead([{ code: 'PGRST301', message: 'JWT expired' }])).toBe('failed')
  })
  it('one missing table among failed ones is missing', () => {
    expect(classifyLegalRead([{ code: '', message: 'Failed to fetch' }, { code: '42P01', message: 'does not exist' }])).toBe('missing')
  })
})

describe('legalReadRetryDelay', () => {
  it('waits longer each time and stops after the schedule', () => {
    expect(legalReadRetryDelay(0)).toBeNull()
    expect(legalReadRetryDelay(1)).toBe(LEGAL_READ_RETRY_MS[0])
    expect(legalReadRetryDelay(2)).toBe(LEGAL_READ_RETRY_MS[1])
    expect(legalReadRetryDelay(3)).toBe(LEGAL_READ_RETRY_MS[2])
    expect(legalReadRetryDelay(4)).toBeNull()
  })
})

describe('legalReadWords', () => {
  it('tells the truth in each state', () => {
    expect(legalReadWords('ok')).toBeNull()
    expect(legalReadWords('missing')).toBe(LEGAL_READ_MISSING_WORDS)
    expect(legalReadWords('failed')).toBe(LEGAL_READ_FAILED_WORDS)
  })
})
