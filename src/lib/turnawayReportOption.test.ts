import { describe, expect, it } from 'vitest'
import { shouldOfferTurnawayInReportPicker } from './turnawayReportOption'

describe('shouldOfferTurnawayInReportPicker', () => {
  it('only for ledger jobs on today\'s schedule', () => {
    expect(shouldOfferTurnawayInReportPicker('job_ledger', true)).toBe(true)
    expect(shouldOfferTurnawayInReportPicker('job_ledger', false)).toBe(false)
    expect(shouldOfferTurnawayInReportPicker('project', true)).toBe(false)
    expect(shouldOfferTurnawayInReportPicker('bid', true)).toBe(false)
    expect(shouldOfferTurnawayInReportPicker(null, true)).toBe(false)
  })
})
