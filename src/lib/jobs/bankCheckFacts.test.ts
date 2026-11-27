import { describe, expect, it } from 'vitest'
import { BANK_CHECK_COLUMNS, BANK_CHECK_FACT_COLUMNS, bankCheckFacts, bankCheckFromRow } from './checkCleared'

/**
 * What the bank itself says of a check, read off its row (punch list #437, piece 2): a pending row, a posted
 * row and a failed one. Every check, number and day here is made up.
 */
describe('bankCheckFacts', () => {
  it('a pending check: the number the bank read and the day it names, and no posting', () => {
    // 22:00 UTC on Dec 2 is still Dec 2 in the company's calendar.
    expect(bankCheckFacts({ posted_at: null, check_number: ' 01184 ', bank_day: '2026-12-02T22:00:00Z', failure_reason: null })).toEqual({ postedYmd: null, bankDayYmd: '2026-12-02', checkNumber: '01184', failureReason: null })
  })

  it('a posted check: the day it posted beside the day the bank names, each in the company’s calendar', () => {
    // 03:10 UTC on Nov 26 is the evening of Nov 25 where the company is.
    expect(bankCheckFacts({ posted_at: '2026-11-26T03:10:00Z', check_number: '01184', bank_day: '2026-12-02T22:00:00Z', failure_reason: ' ' })).toEqual({ postedYmd: '2026-11-25', bankDayYmd: '2026-12-02', checkNumber: '01184', failureReason: null })
  })

  it('a failed check: the bank’s own reason, trimmed', () => {
    expect(bankCheckFacts({ posted_at: null, check_number: '01184', bank_day: null, failure_reason: ' Insufficient funds ' })).toEqual({ postedYmd: null, bankDayYmd: null, checkNumber: '01184', failureReason: 'Insufficient funds' })
  })

  it('a row that is no check, or one read without the bank’s columns, answers all four empty', () => {
    expect(bankCheckFacts({})).toEqual({ postedYmd: null, bankDayYmd: null, checkNumber: '', failureReason: null })
    expect(bankCheckFacts({ check_number: null, bank_day: null })).toEqual({ postedYmd: null, bankDayYmd: null, checkNumber: '', failureReason: null })
    // A day the bank wrote that is no day is not guessed at.
    expect(bankCheckFacts({ bank_day: 'soon' }).bankDayYmd).toBeNull()
  })

  it('is what the whole row reads through, so the two never differ', () => {
    const row = { id: 'b1', amount: '16455.50', status: 'sent', created_at: '2026-11-25T03:10:00Z', posted_at: '2026-11-25T23:02:00Z', check_number: ' 01184 ', bank_day: '2026-12-02T22:00:00Z', failure_reason: ' ' }
    expect(bankCheckFromRow(row)).toMatchObject(bankCheckFacts(row))
  })

  it('names its two columns as the whole read names them', () => {
    for (const column of BANK_CHECK_FACT_COLUMNS.split(', ')) expect(BANK_CHECK_COLUMNS).toContain(column)
  })
})
