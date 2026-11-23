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
  it("on a sheet that is one person's, Work statement… takes Print's place and their statement of account follows it", () => {
    expect(verbs({ ...base, payWhenKind: 'ready', papers: true })).toEqual(['payment*', 'payable_after', 'backcharge', 'edit', 'work_statement', 'statement', 'story', 'lien_waiver'])
    const v = subPayPhoneVerbs({ ...base, papers: true })
    expect(v.find((x) => x.verb === 'work_statement')).toMatchObject({ label: 'Work statement…', primary: false, danger: false })
    expect(v.find((x) => x.verb === 'statement')).toMatchObject({ label: 'Statement of account…', primary: false, danger: false })
    // A shared sheet, a crew sheet, or a viewer who makes no papers: Print stays and no paper is offered.
    expect(verbs({ ...base, papers: false })).toEqual(verbs(base))
    expect(verbs(base)).toContain('print')
    expect(verbs(base)).not.toContain('work_statement')
  })
})
