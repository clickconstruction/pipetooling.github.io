import { describe, it, expect } from 'vitest'
import { acceptedEstimateOptionKeys, describeAcceptedEstimateRecord } from './estimateAcceptedRecord'
import type { EstimateOption } from './estimateOptions'

const money = (c: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(c / 100)
const line = (description: string, amount_cents: number) => ({ line_item: '', description, quantity: 1, unit_price_cents: amount_cents, amount_cents })
const opt = (key: string, name: string, cents: number, kind: EstimateOption['kind'], recommended = false): EstimateOption => ({
  key,
  name,
  description: '',
  recommended,
  kind,
  line_items: [line(name, cents)],
})
const mixed = [opt('repair', 'Repair', 185000, 'choice'), opt('replace', 'Replace 50-gal', 340000, 'choice', true), opt('soft', 'Water softener', 195000, 'add_on'), opt('bibs', 'Hose bibs (2)', 39000, 'add_on')]

describe('acceptedEstimateOptionKeys', () => {
  it('prefers the list, falls back to the single key, tolerates junk', () => {
    expect(acceptedEstimateOptionKeys({ accepted_option_key: 'replace', accepted_option_keys: ['replace', 'soft'] })).toEqual(['replace', 'soft'])
    expect(acceptedEstimateOptionKeys({ accepted_option_key: 'replace', accepted_option_keys: null })).toEqual(['replace'])
    expect(acceptedEstimateOptionKeys({ accepted_option_key: 'replace', accepted_option_keys: [] })).toEqual(['replace'])
    expect(acceptedEstimateOptionKeys({ accepted_option_key: null })).toEqual([])
    expect(acceptedEstimateOptionKeys(null)).toEqual([])
    expect(acceptedEstimateOptionKeys({ accepted_option_keys: ['a', ' ', 'b'] })).toEqual(['a', 'b'])
  })
})

describe('describeAcceptedEstimateRecord', () => {
  it('an acceptance from before add-ons reads exactly as it did', () => {
    const r = describeAcceptedEstimateRecord(mixed.slice(0, 2), ['replace'], money, 340000)
    expect(r.headline).toBe('Accepted "Replace 50-gal" · $3,400.00')
    expect(r.offeredNote).toBe('(of 2 offered)')
    expect(r.addOnLines).toEqual([])
    expect(r.notChosenLines).toEqual(['Not chosen: Repair · $1,850.00'])
    expect(r.bannerNote).toBe('option "Replace 50-gal"')
  })

  it('a choice plus add-ons: the headline counts them, add-ons listed, the rest not chosen', () => {
    const r = describeAcceptedEstimateRecord(mixed, ['replace', 'soft', 'bibs'], money, 0)
    expect(r.headline).toBe('Accepted "Replace 50-gal" + 2 add-ons · $5,740.00')
    expect(r.offeredNote).toBe('(of 4 offered)')
    expect(r.addOnLines).toEqual(['Add-on: Water softener · $1,950.00', 'Add-on: Hose bibs (2) · $390.00'])
    expect(r.notChosenLines).toEqual(['Not chosen: Repair · $1,850.00'])
    expect(r.bannerNote).toBe('option "Replace 50-gal" + 2 add-ons')
  })

  it('a key that names nothing falls back to the frozen total and lists everything as not chosen', () => {
    const r = describeAcceptedEstimateRecord(mixed, ['gone'], money, 123400)
    expect(r.headline).toBe('Accepted an option · $1,234.00')
    expect(r.notChosenLines).toHaveLength(4)
    expect(r.bannerNote).toBeNull()
  })

  it('fewer than two options: nothing to record', () => {
    expect(describeAcceptedEstimateRecord([mixed[0]!], ['repair'], money, 1).headline).toBeNull()
  })
})
