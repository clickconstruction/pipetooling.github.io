import { describe, expect, it } from 'vitest'
import { subPayPhoneAmount, subPayPhoneVerbs } from './subPayPhoneRows'

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
const verbs = (f: Parameters<typeof subPayPhoneVerbs>[0]) => subPayPhoneVerbs(f).map((v) => `${v.verb}${v.primary ? '*' : ''}`)

describe('subPayPhoneAmount', () => {
  it('is the row’s one number', () => {
    expect(subPayPhoneAmount({ totalCost: 4200, balance: 4200 }, money)).toEqual({ words: '$4,200 due', tone: 'due' })
    expect(subPayPhoneAmount({ totalCost: 4200, balance: 0 }, money)).toEqual({ words: 'Paid', tone: 'paid' })
    expect(subPayPhoneAmount({ totalCost: 4200, balance: -120 }, money)).toEqual({ words: 'Over $120', tone: 'paid' })
    expect(subPayPhoneAmount({ totalCost: 0, balance: 0 }, money)).toEqual({ words: 'unpriced', tone: 'quiet' })
  })
})

describe('subPayPhoneVerbs', () => {
  const base = { totalCost: 4200, balance: 4200, payWhenKind: 'work', writingLabel: '', payableAfter: null }
  it('leads with the agreement when nothing is in writing', () => {
    const v = subPayPhoneVerbs({ ...base, payWhenKind: 'gap', writingLabel: 'Draft a work order…' })
    expect(v[0]).toMatchObject({ verb: 'writing', label: 'Draft a work order…', primary: true })
    expect(v[1]).toMatchObject({ verb: 'payment', hint: 'Paying before it is in writing', primary: false })
    expect(v.some((x) => x.verb === 'payable_after')).toBe(false)
  })
  it('leads with the payment when the sheet is ready, and offers the date where the desk does', () => {
    expect(verbs({ ...base, payWhenKind: 'ready' })).toEqual(['payment*', 'payable_after', 'backcharge', 'edit', 'print', 'story', 'lien_waiver'])
    expect(verbs({ ...base, payWhenKind: 'wait' })).toEqual(['payment', 'payable_after', 'backcharge', 'edit', 'print', 'story', 'lien_waiver'])
    expect(subPayPhoneVerbs({ ...base, payWhenKind: 'queued', payableAfter: '2026-10-03' })[1]).toMatchObject({ label: 'Change the payable-after date', hint: 'Queued for 2026-10-03' })
  })
  it('a paid sheet has no payment, and a gap with no button has no agreement row', () => {
    expect(verbs({ ...base, balance: 0, payWhenKind: 'paid' })).toEqual(['backcharge', 'edit', 'print', 'story', 'lien_waiver'])
    expect(verbs({ ...base, payWhenKind: 'gap', writingLabel: ' ' })).toEqual(['payment', 'backcharge', 'edit', 'print', 'story', 'lien_waiver'])
    expect(subPayPhoneVerbs(base).find((x) => x.verb === 'backcharge')?.danger).toBe(true)
  })
})
