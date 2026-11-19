import { describe, expect, it } from 'vitest'
import { SAMPLE_SUB_PAYER_GAP_DAYS, sampleSubPortalPage } from '../../../supabase/functions/_shared/customerSampleSub'
import { USUAL_PAY_MIN_PAYMENTS, usualPayWeeks } from '../../../supabase/functions/_shared/subPortalCustomerPaid'
import { parseSubPortalPayload } from './subPortalPayload'
import { isSubPortalSheetQueued, subPortalCustomerPaidDay, subPortalUsualPay } from './subPortalRail'

/**
 * The office's sample of a sub's page (Settings → What customers see → Sub portal) shows the two lines of punch
 * list #388, each on a sheet of its own, beside the queued sheet it always showed. Both come from the page's own
 * rules, so the sample cannot say what a real page would not.
 */

const COMPANY = { name: 'Sample Plumbing', cityLine: 'Kyle, TX', licenseLine: 'M-00000', phone: '(512) 555-0100', email: 'office@example.com' }
const TODAY = '2026-11-19'
const sample = () => {
  const payload = parseSubPortalPayload(sampleSubPortalPage(COMPANY, TODAY, { day: 'friday', nextRun: '2026-11-20', explainer: null }))
  if (!payload) throw new Error('the sample no longer parses as a sub portal payload')
  return payload
}
const sheet = (id: string) => {
  const s = sample().sheets.find((x) => x.id === id)
  if (!s) throw new Error(`the sample has no sheet ${id}`)
  return s
}

describe('the sample sub portal: the customer paid, and how long this customer usually takes', () => {
  it('parses whole, with four sheets', () => {
    expect(sample().sheets.map((s) => s.id)).toEqual(['sample-sheet-1', 'sample-sheet-2', 'sample-sheet-3', 'sample-sheet-4'])
  })

  it('one sheet waits on the customer and says how long this customer usually takes, in weeks', () => {
    const s = sheet('sample-sheet-3')
    expect(s.stage).toBe('customer_pay')
    expect(isSubPortalSheetQueued(s)).toBe(false)
    expect(subPortalCustomerPaidDay(s)).toBeNull()
    expect(subPortalUsualPay(s)).toEqual({ key: 'usualPayRange', vars: { lo: '4', hi: '6' } })
  })

  it('the weeks are the rule’s answer for the sample payer, who is over the floor of five payments', () => {
    expect(SAMPLE_SUB_PAYER_GAP_DAYS.length).toBeGreaterThanOrEqual(USUAL_PAY_MIN_PAYMENTS)
    expect(sheet('sample-sheet-3').usualPayWeeks).toEqual(usualPayWeeks(SAMPLE_SUB_PAYER_GAP_DAYS))
  })

  it('one sheet says the customer paid, with the day, and no line about the usual time', () => {
    const s = sheet('sample-sheet-4')
    expect(s.stage).toBe('customer_pay')
    expect(isSubPortalSheetQueued(s)).toBe(false)
    expect(subPortalCustomerPaidDay(s)).toBe('2026-11-18')
    expect(subPortalUsualPay(s)).toBeNull()
  })

  it('the queued sheet reads as it did: Queued, and neither new line', () => {
    const s = sheet('sample-sheet-2')
    expect(isSubPortalSheetQueued(s)).toBe(true)
    expect(subPortalCustomerPaidDay(s)).toBeNull()
    expect(subPortalUsualPay(s)).toBeNull()
  })

  it('the open total is the four sheets added up', () => {
    const p = sample()
    expect(p.totals.open).toBe(p.sheets.reduce((n, s) => n + s.open, 0))
    expect(p.totals.earned - p.totals.paid).toBe(p.totals.open)
  })

  it('carries no days, no count of payments and no payer on the wire', () => {
    const wire = JSON.stringify(sampleSubPortalPage(COMPANY, TODAY, { day: null, nextRun: null, explainer: null }))
    expect(wire).not.toMatch(/gapDays|samples|loDays|hiDays|payer/i)
  })
})
