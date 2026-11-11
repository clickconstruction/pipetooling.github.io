import { describe, expect, it } from 'vitest'
import type { PartMatch } from '../partMatch'
import { dollars, priceSourceWords, rowCard, shortDay } from './rowCard'

// Every house, part, number and price here is made up.
const kit = { id: 'kit', name: 'AX8802XL-LR-PC ARLO SUPPLY KIT' }
const twin = { id: 'twin', name: 'ARLO AX8802XL LAV SUPPLY KIT' }
const m = (over: Partial<PartMatch>): PartMatch => ({ how: 'house_number', part: kit, rivals: [kit], model: null, unitFactor: 1, ...over })
const row = (over: object = {}) => ({ houseCode: '512207', description: 'AX8802XL-LR-PC ARLO SUPPLY KIT', unitPrice: 18.4, pricingUnit: 'each' as const, lines: 1, ...over })
const base = { houseName: 'Hillcrest Supply', onFile: null, datedOn: '2026-11-06' }

describe('rowCard', () => {
  it('the house’s own number, a price near the one on file: ready, nothing to ask', () => {
    const c = rowCard({ ...base, row: row(), match: m({}), onFile: { price: 17.9, effectiveDate: '2026-08-12' } })
    expect(c.status).toBe('ready')
    expect(c.chip).toEqual({ tone: 'green', label: 'Same Hillcrest Supply number' })
    expect(c.each).toBe(18.4)
    expect(c.question).toBe('$17.90 on file from Hillcrest Supply, Aug 12.')
    expect(c.bigMove).toBe(false)
  })
  it('the house’s number with no price on file yet', () => {
    expect(rowCard({ ...base, row: row(), match: m({}) }).question).toBe('Hillcrest Supply has no price on file for this part yet.')
  })
  it('the model number: offered, and it says the house’s number is new', () => {
    const c = rowCard({ ...base, row: row(), match: m({ how: 'model_number', model: 'AX8802XLLRPC', unitFactor: undefined }) })
    expect(c.status).toBe('offer')
    expect(c.chip).toEqual({ tone: 'blue', label: 'Same model number' })
    expect(c.question).toBe("The model number is on this part. Hillcrest Supply's number is new for it.")
  })
  it('two parts on file: nothing is picked', () => {
    const c = rowCard({ ...base, row: row(), match: m({ how: 'model_number', part: null, rivals: [kit, twin] }) })
    expect(c.status).toBe('pick')
    expect(c.chip.label).toBe('Two parts on file')
    expect(c.question).toBe('Two parts in the book carry this model number. Which one is it?')
    expect(c.each).toBeNull()
  })
  it('a move past a quarter waits, and says the old price, the new one and the change', () => {
    const c = rowCard({ ...base, row: row({ unitPrice: 312.5 }), match: m({}), onFile: { price: 214, effectiveDate: '2026-08-12' } })
    expect(c.status).toBe('ask')
    expect(c.chip.label).toBe('Price moved a lot')
    expect(c.question).toBe('$214.00 on file from Hillcrest Supply, Aug 12. This paper says $312.50. That is up 46%.')
    expect(c.bigMove).toBe(true)
  })
  it('a move down past a quarter says down', () => {
    expect(rowCard({ ...base, row: row({ unitPrice: 10 }), match: m({}), onFile: { price: 20, effectiveDate: null } }).question).toBe(
      '$20.00 on file from Hillcrest Supply. This paper says $10.00. That is down 50%.',
    )
  })
  it('a price by the hundred on a number not met before: asks, and offers both readings', () => {
    const c = rowCard({ ...base, row: row({ unitPrice: 38.4, pricingUnit: 'per_hundred' }), match: m({ how: 'model_number', unitFactor: undefined }) })
    expect(c.status).toBe('ask')
    expect(c.chip.label).toBe('Unit differs')
    expect(c.question).toBe('Hillcrest Supply prices this by the hundred. The book prices it each.')
    expect([c.each, c.eachAsPrinted]).toEqual([0.38, 38.4])
  })
  it('the house’s number remembers the answer, so the next paper does not ask', () => {
    const c = rowCard({ ...base, row: row({ unitPrice: 38.4, pricingUnit: 'per_hundred' }), match: m({ unitFactor: 100 }), onFile: { price: 0.38, effectiveDate: '2026-09-01' } })
    expect(c.status).toBe('ready')
    expect(c.each).toBe(0.38)
    expect(c.unitAsk).toBe(false)
  })
  it('a number typed by hand says nothing of units, so a paper by the hundred still asks', () => {
    const c = rowCard({ ...base, row: row({ unitPrice: 38.4, pricingUnit: 'per_hundred' }), match: m({ unitFactor: 1 }) })
    expect(c.status).toBe('ask')
    expect(c.unitAsk).toBe(true)
  })
  it('a newer price on file is kept unless a person says so', () => {
    const c = rowCard({ ...base, row: row(), match: m({}), onFile: { price: 19, effectiveDate: '2026-11-08' } })
    expect(c.status).toBe('ask')
    expect(c.older).toBe(true)
    expect(c.question).toBe('The price on file is newer: $19.00 from Nov 8. This paper is dated Nov 6. It is kept unless you say so.')
  })
  it('nothing on file, a catch-all number, no house and a kit row', () => {
    expect(rowCard({ ...base, row: row(), match: { how: 'none', part: null, rivals: [], model: null } })).toMatchObject({ status: 'new', question: 'No part has this number, this model number or these words.' })
    expect(rowCard({ ...base, row: row({ houseCode: '440118' }), match: { how: 'not_a_part', part: null, rivals: [], model: null } }).question).toBe(
      'Hillcrest Supply uses 440118 for anything it does not stock, so it is never matched to a part.',
    )
    expect(rowCard({ ...base, houseName: null, row: row(), match: m({ how: 'model_number' }) }).status).toBe('no_house')
    expect(rowCard({ ...base, row: row({ unitPrice: null }), match: m({}) }).status).toBe('no_price')
  })
  it('a description that ran over says how many lines it took', () => {
    expect(rowCard({ ...base, row: row({ lines: 3 }), match: m({}) }).ranOver).toBe(3)
    expect(rowCard({ ...base, row: row(), match: m({}) }).ranOver).toBe(0)
  })
})

describe('words', () => {
  it('a day and a sum', () => {
    expect(shortDay('2026-08-12')).toBe('Aug 12')
    expect(shortDay('2025-08-12', '2026')).toBe('Aug 12, 2025')
    expect(shortDay(null)).toBe('')
    expect(dollars(1284)).toBe('$1,284.00')
  })
  it('where a price came from', () => {
    expect(priceSourceWords({ cameBy: 'sheet', kind: 'quote', number: 'Q-88213', validUntil: '2026-12-06', filedPrice: 312.5, replacedPrice: 214 })).toBe('Quote Q-88213 · good until Dec 6 · was $214.00')
    expect(priceSourceWords({ cameBy: 'phone', kind: 'quote', number: '', validUntil: null, filedPrice: 5, replacedPrice: null })).toBe('By phone')
    expect(priceSourceWords({ cameBy: '', kind: 'invoice', number: 'INV-7', validUntil: null, filedPrice: 5, replacedPrice: null })).toBe('Bill INV-7')
    expect(priceSourceWords(null)).toBe('')
  })
})
