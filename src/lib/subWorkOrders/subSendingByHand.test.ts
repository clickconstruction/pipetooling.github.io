import { describe, expect, it } from 'vitest'
import type { SendingContext } from './subSending'
import { handBoxesFromFill, HAND_CREDIT_BOX, planSubSendingByHand, sendingConfirmLabel } from './subSendingByHand'

// Made-up sheets: the mock-up's window (to-dos/sub-papers-statement-of-account/mockup.html, section 4).
const SHEET = { id: 'cedar-1', label: '2041 Cedar Hollow Clinic', remaining: 2600 }
const CTX: SendingContext = {
  personId: 'harlan',
  credit: 0,
  others: [
    { id: 'ridge-1', key: 'id:harlan', label: '2057 Ridgeway Lot 12', remaining: 2500, day: '2026-11-03' },
    { id: 'cedar-2', key: 'id:harlan', label: '2041 Cedar Hollow Clinic, trim', remaining: 1200, day: '2026-11-06' },
  ],
}

describe('placing a sending by hand', () => {
  it('starts from Oldest first: the fill is the boxes', () => {
    expect(handBoxesFromFill('3000', SHEET, CTX)).toEqual({ 'cedar-1': '2600.00', 'ridge-1': '400.00' })
    expect(handBoxesFromFill('7000', SHEET, CTX)).toEqual({ 'cedar-1': '2600.00', 'ridge-1': '2500.00', 'cedar-2': '1200.00', [HAND_CREDIT_BOX]: '700.00' })
    expect(handBoxesFromFill('', SHEET, CTX)).toEqual({})
  })
  it('the office moves it: $1,000 here, nothing on the middle sheet, the trim paid in full', () => {
    const h = planSubSendingByHand('2200', SHEET, CTX, { 'cedar-1': '1000', 'ridge-1': '', 'cedar-2': '1200' })
    expect(h.plan).toMatchObject({ ok: true, sent: 2200, credit: 0, leaves: 1600, spills: true })
    expect(h.plan.ok && h.plan.lines).toEqual([
      { jobId: 'cedar-1', label: '2041 Cedar Hollow Clinic', amount: 1000, settles: false },
      { jobId: 'cedar-2', label: '2041 Cedar Hollow Clinic, trim', amount: 1200, settles: true },
    ])
    expect(h.rows.map((r) => [r.open, r.placed, r.staysOpen])).toEqual([[2600, 1000, 1600], [2500, 0, 2500], [1200, 1200, 0]])
    expect(h.placedWords).toBe('$2,200.00 of $2,200.00 placed')
    expect(h.effectWords).toBe('part payment on 2041 Cedar Hollow Clinic · 2041 Cedar Hollow Clinic, trim paid in full')
    expect(sendingConfirmLabel(h.plan)).toBe('Record $2,200.00 on 2 sheets')
  })
  it('the press is dead until the parts sum to the amount, and says what is missing', () => {
    const h = planSubSendingByHand('2200', SHEET, CTX, { 'cedar-1': '1000', 'cedar-2': '700' })
    expect(h.plan).toMatchObject({ ok: false, error: '$500.00 of the $2,200.00 is not placed yet. Put it on a sheet, or keep it as their credit.' })
    expect(h.placedWords).toBe('$1,700.00 of $2,200.00 placed · $500.00 still to place')
    expect(sendingConfirmLabel(h.plan)).toBe('Record payment')
  })
  it('refuses a box past what its sheet needs, and parts past the amount', () => {
    expect(planSubSendingByHand('2200', SHEET, CTX, { 'cedar-1': '1000', 'cedar-2': '1300' }).plan).toMatchObject({ ok: false, error: '2041 Cedar Hollow Clinic, trim: $1,300.00 is more than the $1,200.00 this sheet needs.' })
    expect(planSubSendingByHand('2000', SHEET, CTX, { 'cedar-1': '1000', 'cedar-2': '1200' }).plan).toMatchObject({ ok: false, error: 'The boxes add to $2,200.00, which is $200.00 more than the $2,000.00 sent.' })
  })
  it('the rest can be kept as their credit, by hand, when they are one person on the roster', () => {
    const h = planSubSendingByHand('1500', SHEET, CTX, { 'cedar-2': '1200', [HAND_CREDIT_BOX]: '300' })
    expect(h.plan).toMatchObject({ ok: true, credit: 300, leaves: 2600 })
    expect(sendingConfirmLabel(h.plan)).toBe('Record $1,500.00 on 1 sheet and their credit')
    expect(planSubSendingByHand('1500', SHEET, { ...CTX, personId: null }, { 'cedar-2': '1200', [HAND_CREDIT_BOX]: '300' }).plan).toMatchObject({ ok: false, error: 'A credit needs the sub on the roster as one person. Place the whole amount on sheets.' })
  })
  it('one sheet, the whole amount: the plain payment it always was', () => {
    const h = planSubSendingByHand('2600', SHEET, { ...CTX, others: [] }, { 'cedar-1': '2600' })
    expect(h.plan).toMatchObject({ ok: true, spills: false, leaves: 0 })
  })
})
