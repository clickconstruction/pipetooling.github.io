import { describe, expect, it } from 'vitest'
import { creditNoteWords, creditOfferWords, creditUsableOn, personIdOfKey, planSubSending, sendingAfterWords, sendingContext, sendingSpillLines, type SendingSheet } from './subSending'

const s = (over: Partial<SendingSheet>): SendingSheet => ({ id: 'a', key: 'id:calloway', label: '2104 Larkspur', remaining: 0, day: '2026-10-01', ...over })
const here = s({ id: 'here', remaining: 1000, day: '2026-11-01' })
const older = s({ id: 'older', label: '2090 Pinecrest', remaining: 300, day: '2026-09-10' })
const newer = s({ id: 'newer', label: '2131 Juniper', remaining: 500, day: '2026-11-08' })
const settled = s({ id: 'settled', label: '2050 Done', remaining: 0, day: '2026-08-01' })
const theirs = s({ id: 'theirs', key: 'id:brightline', label: '2117 Alder', remaining: 900 })
const ALL = [here, newer, settled, theirs, older]

describe('sendingContext', () => {
  it('finds the sub’s other open sheets oldest first, and their credit', () => {
    const ctx = sendingContext('here', ALL, new Map([['calloway', 200]]))
    expect(ctx).toEqual({ personId: 'calloway', credit: 200, others: [older, newer] })
  })
  it('a sub who is not one roster person has no id and no credit, and still has their other sheets', () => {
    const a = s({ id: 'n1', key: 'two subs', remaining: 100 })
    const b = s({ id: 'n2', key: 'two subs', remaining: 50 })
    expect(sendingContext('n1', [a, b], new Map())).toEqual({ personId: null, credit: 0, others: [b] })
    expect(personIdOfKey('id:x')).toBe('x')
    expect(personIdOfKey('two subs')).toBeNull()
    expect(personIdOfKey('id:')).toBeNull()
  })
  it('a sheet it does not know has no context, and a blank key shares sheets with nobody', () => {
    expect(sendingContext('nope', ALL, null)).toBeNull()
    expect(sendingContext('b1', [s({ id: 'b1', key: '', remaining: 10 }), s({ id: 'b2', key: '', remaining: 10 })], null)).toEqual({ personId: null, credit: 0, others: [] })
  })
  it('a credit below zero offers nothing', () => {
    expect(sendingContext('here', ALL, new Map([['calloway', -40]]))!.credit).toBe(0)
  })
})

describe('planSubSending', () => {
  const ctx = sendingContext('here', ALL, new Map())!
  const sheet = { id: 'here', label: here.label, remaining: 1000 }

  it('an amount up to what is left is one payment, as before', () => {
    const part = planSubSending('400', sheet, ctx)
    expect(part).toEqual({ ok: true, sent: 400, lines: [{ jobId: 'here', label: '2104 Larkspur', amount: 400, settles: false }], credit: 0, leaves: 600, spills: false })
    expect(sendingAfterWords(part)).toBe('A part payment. $600.00 stays due on the sheet.')
    const full = planSubSending('1,000.00', sheet, ctx)
    expect(full).toMatchObject({ ok: true, sent: 1000, credit: 0, leaves: 0, spills: false })
    expect(sendingAfterWords(full)).toBe('This pays the sheet in full.')
  })

  it('the extra fills their other open sheets oldest first, and the rest is their credit', () => {
    const plan = planSubSending('2000', sheet, ctx)
    expect(plan).toEqual({
      ok: true,
      sent: 2000,
      lines: [
        { jobId: 'here', label: '2104 Larkspur', amount: 1000, settles: true },
        { jobId: 'older', label: '2090 Pinecrest', amount: 300, settles: true },
        { jobId: 'newer', label: '2131 Juniper', amount: 500, settles: true },
      ],
      credit: 200,
      leaves: 0,
      spills: true,
    })
    expect(sendingSpillLines(plan)).toEqual(['$1,000.00 on this sheet, paid in full', '$300.00 on 2090 Pinecrest, paid in full', '$500.00 on 2131 Juniper, paid in full', '$200.00 kept as their credit'])
    expect(sendingAfterWords(plan)).toBe('')
  })

  it('the lines and the credit always add up to what was sent', () => {
    for (const text of ['1000.01', '1150', '1299.99', '1300', '1650.55', '1800', '9999.99']) {
      for (const spill of [true, false]) {
        const plan = planSubSending(text, sheet, ctx, { spill })
        if (!plan.ok) throw new Error(`refused ${text}`)
        const total = Math.round((plan.lines.reduce((sum, l) => sum + l.amount, 0) + plan.credit) * 100) / 100
        expect(total).toBe(plan.sent)
      }
    }
  })

  it('an extra that stops part way leaves the last sheet open and keeps no credit', () => {
    const plan = planSubSending('1450', sheet, ctx)
    expect(plan).toMatchObject({ ok: true, credit: 0 })
    if (plan.ok) expect(plan.lines.map((l) => [l.jobId, l.amount, l.settles])).toEqual([['here', 1000, true], ['older', 300, true], ['newer', 150, false]])
    expect(sendingSpillLines(plan)[2]).toBe('$150.00 on 2131 Juniper')
  })

  it('with the fill switched off, all of the extra is their credit', () => {
    expect(planSubSending('1450', sheet, ctx, { spill: false })).toMatchObject({ ok: true, lines: [{ jobId: 'here', amount: 1000 }], credit: 450, spills: true })
  })

  it('a sub who cannot hold a credit is refused past what their sheets need, and told what fits', () => {
    const a = s({ id: 'n1', key: 'two subs', label: 'A', remaining: 100 })
    const b = s({ id: 'n2', key: 'two subs', label: 'B', remaining: 50 })
    const noPerson = sendingContext('n1', [a, b], null)!
    expect(planSubSending('150', { id: 'n1', label: 'A', remaining: 100 }, noPerson)).toMatchObject({ ok: true, credit: 0, lines: [{ amount: 100 }, { amount: 50 }] })
    const over = planSubSending('175', { id: 'n1', label: 'A', remaining: 100 }, noPerson)
    expect(over).toEqual({ ok: false, reason: 'over', error: '$175.00 is $25.00 more than this sheet and their other open sheets need. The extra would be kept as a credit, and a credit needs the sub on the roster as one person. Record up to $150.00 here.' })
    expect(planSubSending('175', { id: 'n1', label: 'A', remaining: 100 }, null)).toMatchObject({ ok: false, reason: 'over' })
    expect(planSubSending('175', { id: 'n1', label: 'A', remaining: 100 }, null).ok ? '' : (planSubSending('175', { id: 'n1', label: 'A', remaining: 100 }, null) as { error: string }).error).toContain('more than this sheet needs')
  })

  it('refuses a blank, a bad amount and a sheet with nothing left', () => {
    expect(planSubSending(' ', sheet, ctx)).toMatchObject({ ok: false, reason: 'blank' })
    expect(planSubSending('abc', sheet, ctx)).toMatchObject({ ok: false, reason: 'invalid' })
    expect(planSubSending('0', sheet, ctx)).toMatchObject({ ok: false, reason: 'invalid' })
    expect(planSubSending('50', { id: 'settled', label: 'x', remaining: 0 }, ctx)).toMatchObject({ ok: false, reason: 'nothing_left' })
  })
})

describe('the credit’s words', () => {
  it('what the credit can pay on a sheet is the smaller of the two', () => {
    expect(creditUsableOn(200, 1000)).toBe(200)
    expect(creditUsableOn(200, 150)).toBe(150)
    expect(creditUsableOn(0, 150)).toBe(0)
    expect(creditUsableOn(200, 0)).toBe(0)
    expect(creditUsableOn(-5, 100)).toBe(0)
  })
  it('says the offer and the note', () => {
    expect(creditOfferWords('Calloway Tile', 200)).toBe('Calloway Tile has a credit of $200.00.')
    expect(creditOfferWords(' ', 5)).toBe('This sub has a credit of $5.00.')
    expect(creditNoteWords(200)).toBe('credit $200.00')
    expect(creditNoteWords(0)).toBe('')
    expect(creditNoteWords(-40)).toBe('credit short by $40.00')
  })
})
