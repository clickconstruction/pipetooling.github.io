import { describe, expect, it } from 'vitest'
import { houseVerdict, letterheadHouse, printedDay, sheetHeader } from './sheetHouse'

// Every house, number and day here is made up.
const HOUSES = [
  { id: 'hill', name: 'Hillcrest Supply' },
  { id: 'bord', name: 'Borden Pipe & Supply' },
  { id: 'cany', name: 'Canyon Wholesale' },
]
const HEAD = `\f1
HILLCREST SUPPLY CO.                    Quotation
4410 Tallgrass Road                     Quote No: Q-88213
                                        Date: 11/06/2026
Bid for: Juniper Street Dental          Expires: 12/06/2026
ORDER QTY  ITEM NO  DESCRIPTION  UNIT PRICE`

describe('letterheadHouse', () => {
  it('names the one house whose name the head prints', () => {
    expect(letterheadHouse(HEAD, HOUSES)).toEqual({ houseId: 'hill', printed: 'HILLCREST SUPPLY CO.' })
  })
  it('names none when the head prints no house on file, or two', () => {
    expect(letterheadHouse('PINEBROOK PLUMBING SUPPLY\nQuotation', HOUSES).houseId).toBeNull()
    expect(letterheadHouse('HILLCREST SUPPLY for CANYON WHOLESALE', HOUSES).houseId).toBeNull()
  })
  it('reads only the head, not a house named far down the sheet', () => {
    expect(letterheadHouse(`${Array(20).fill('1ea 512207 ARLO KIT').join('\n')}\nCANYON WHOLESALE`, HOUSES).houseId).toBeNull()
  })
})

describe('houseVerdict', () => {
  const letterhead = { houseId: 'hill', printed: 'HILLCREST SUPPLY CO.' }
  it('sure when the letterhead and the bid’s request agree, with both reasons', () => {
    const v = houseVerdict({ houses: HOUSES, letterhead, askedHouseIds: ['hill', 'bord'] })
    expect(v).toMatchObject({ houseId: 'hill', sure: true, question: null })
    expect(v.reasons).toEqual(['Letterhead reads HILLCREST SUPPLY CO.', 'This bid asked Hillcrest Supply for prices'])
  })
  it('sure on the letterhead alone when the bid asked nobody', () => {
    expect(houseVerdict({ houses: HOUSES, letterhead }).sure).toBe(true)
  })
  it('asks when the letterhead names a house the bid did not ask', () => {
    const v = houseVerdict({ houses: HOUSES, letterhead: { houseId: 'cany', printed: 'CANYON WHOLESALE' }, askedHouseIds: ['hill'] })
    expect(v.sure).toBe(false)
    expect(v.houseId).toBeNull()
    expect(v.question).toBe("Which house is this sheet from? Letterhead reads CANYON WHOLESALE. This bid's price request went to Hillcrest Supply.")
    expect(v.offers).toEqual(['cany', 'hill'])
  })
  it('asks when the request it answers and the letterhead disagree', () => {
    const v = houseVerdict({ houses: HOUSES, requestHouseId: 'hill', letterhead: { houseId: 'cany', printed: 'CANYON WHOLESALE' } })
    expect(v.sure).toBe(false)
    expect(v.question).toBe('Which house is this sheet from? It answers the price request sent to Hillcrest Supply. Letterhead reads CANYON WHOLESALE.')
  })
  it('the request it answers is the surest reason, alone', () => {
    expect(houseVerdict({ houses: HOUSES, requestHouseId: 'hill' })).toMatchObject({ houseId: 'hill', sure: true })
  })
  it('known item numbers alone are a weak reason: it asks, naming the house', () => {
    const v = houseVerdict({ houses: HOUSES, codeShare: { houseId: 'hill', known: 43, total: 71 } })
    expect(v.sure).toBe(false)
    expect(v.question).toBe("Is this sheet from Hillcrest Supply? 43 of its 71 item numbers are Hillcrest Supply's on file.")
    expect(v.offers).toEqual(['hill'])
  })
  it('a few known numbers are no reason at all', () => {
    expect(houseVerdict({ houses: HOUSES, codeShare: { houseId: 'hill', known: 2, total: 71 } }).reasons).toEqual([])
  })
  it('nothing names a house: it asks, and says who the bid asked', () => {
    expect(houseVerdict({ houses: HOUSES, letterhead: { houseId: null, printed: null }, askedHouseIds: ['bord'] })).toMatchObject({
      houseId: null,
      sure: false,
      question: 'Which house is this sheet from? Nothing on it names one. This bid asked Borden Pipe & Supply for prices.',
      offers: ['bord'],
    })
  })
  it('a sheet opened again: its letterhead was not read now, so nothing is said of it', () => {
    expect(houseVerdict({ houses: HOUSES, askedHouseIds: ['bord'] }).question).toBe('Which house is this sheet from? This bid asked Borden Pipe & Supply for prices.')
  })
})

describe('sheetHeader', () => {
  it('reads the number, the day and the good-until day', () => {
    expect(sheetHeader(HEAD)).toEqual({ number: 'Q-88213', datedOn: '2026-11-06', validUntil: '2026-12-06' })
  })
  it('leaves empty what the head does not print', () => {
    expect(sheetHeader('1ea 512207 ARLO SUPPLY KIT 18.40')).toEqual({ number: '', datedOn: null, validUntil: null })
  })
  it('a day however it is printed', () => {
    expect(printedDay('Nov 6, 2026')).toBe('2026-11-06')
    expect(printedDay('11/6/26')).toBe('2026-11-06')
    expect(printedDay('2026-11-06')).toBe('2026-11-06')
    expect(printedDay('3/4 X 1/2')).toBeNull()
  })
})
