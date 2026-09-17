import { describe, it, expect } from 'vitest'
import { estimateAcceptSelectionView } from './estimateAcceptSelection'
import type { EstimateOption } from './estimateOptions'

const money = (c: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(c / 100)
const line = (description: string, amount_cents: number) => ({ line_item: '', description, quantity: 1, unit_price_cents: amount_cents, amount_cents })
const opt = (key: string, name: string, cents: number, kind: EstimateOption['kind'], recommended = false): EstimateOption => ({
  key,
  name,
  description: '',
  recommended,
  kind,
  line_items: [line(`${name} line`, cents)],
})

const mixed = [opt('repair', 'Repair', 185000, 'choice'), opt('replace', 'Replace 50-gal', 340000, 'choice', true), opt('soft', 'Water softener', 195000, 'add_on'), opt('bibs', 'Hose bibs (2)', 39000, 'add_on')]
const allAddOns = [opt('kitchen', 'Kitchen rough-in', 420000, 'add_on', true), opt('bath', 'Hall bath', 365000, 'add_on'), opt('laundry', 'Laundry relocation', 210000, 'add_on')]

describe('estimateAcceptSelectionView', () => {
  it('inactive under two options: plain Approve, no caption, no groups, legacy totals', () => {
    const v = estimateAcceptSelectionView([opt('only', 'Only', 1, 'choice')], [], money)
    expect(v).toMatchObject({ active: false, valid: true, totalCents: null, approveLabel: 'Approve', cardCaption: null, linesHeading: null, groups: [] })
    expect(estimateAcceptSelectionView([], [], money, { isChangeOrder: true }).approveLabel).toBe('Approve change order')
  })

  it('a lone choice reads exactly as it did before add-ons', () => {
    const v = estimateAcceptSelectionView(mixed, ['replace'], money)
    expect(v.valid).toBe(true)
    expect(v.approveLabel).toBe('Approve "Replace 50-gal" — $3,400.00')
    expect(v.cardCaption).toBe('Replace 50-gal')
    expect(v.linesHeading).toBe('Your selection — Replace 50-gal')
    expect(v.groups).toHaveLength(1)
    expect(v.totalCents).toBe(340000)
  })

  it('a choice plus add-ons: the label counts them, the groups are in offered order with Add-on headings', () => {
    const v = estimateAcceptSelectionView(mixed, ['bibs', 'replace', 'soft'], money)
    expect(v.approveLabel).toBe('Approve "Replace 50-gal" + 2 add-ons — $5,740.00')
    expect(v.cardCaption).toBe('Replace 50-gal + 2 add-ons')
    expect(v.linesHeading).toBe('Your selection — Replace 50-gal · Water softener · Hose bibs (2)')
    expect(v.groups.map((g) => g.heading)).toEqual(['Replace 50-gal', 'Add-on — Water softener', 'Add-on — Hose bibs (2)'])
    expect(v.groups.flatMap((g) => g.lines.map((l) => l.description))).toEqual(['Replace 50-gal line', 'Water softener line', 'Hose bibs (2) line'])
    expect(estimateAcceptSelectionView(mixed, ['replace', 'soft'], money).cardCaption).toBe('Replace 50-gal + 1 add-on')
  })

  it('an add-on without a choice is invalid: Approve reads Choose an option', () => {
    const v = estimateAcceptSelectionView(mixed, ['soft'], money)
    expect(v.valid).toBe(false)
    expect(v.approveLabel).toBe('Choose an option')
    // the card and the document still show what is ticked
    expect(v.cardCaption).toBe('Water softener')
    expect(v.totalCents).toBe(195000)
  })

  it('all add-ons: nothing ticked disables with Choose at least one option; ticks read as N options with plain headings', () => {
    const none = estimateAcceptSelectionView(allAddOns, [], money)
    expect(none.valid).toBe(false)
    expect(none.approveLabel).toBe('Choose at least one option')
    expect(none.cardCaption).toBeNull()
    expect(none.linesHeading).toBe('Your selection')
    expect(none.groups).toEqual([])
    expect(none.totalCents).toBe(0)
    const one = estimateAcceptSelectionView(allAddOns, ['bath'], money)
    expect(one.approveLabel).toBe('Approve "Hall bath" — $3,650.00')
    expect(one.groups.map((g) => g.heading)).toEqual(['Hall bath'])
    const three = estimateAcceptSelectionView(allAddOns, ['laundry', 'kitchen', 'bath'], money)
    expect(three.approveLabel).toBe('Approve 3 options — $9,950.00')
    expect(three.cardCaption).toBe('3 options')
    expect(three.groups.map((g) => g.heading)).toEqual(['Kitchen rough-in', 'Hall bath', 'Laundry relocation'])
  })

  it('a change order never names options', () => {
    expect(estimateAcceptSelectionView(mixed, ['replace'], money, { isChangeOrder: true }).approveLabel).toBe('Approve change order')
  })
})
