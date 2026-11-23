import { describe, expect, it } from 'vitest'
import { formatCurrency, formatCurrencyNoCents } from './jobs/jobFormatting'
import { MONEY_CENTS_EM, moneyFigureParts, moneyParts, moneyTextParts, moneyWords, type MoneyTextPart } from './moneyParts'

const joined = (parts: MoneyTextPart[]) => parts.map((p) => (typeof p === 'string' ? p : `${p.dollars}${p.cents}`)).join('')

describe('moneyParts', () => {
  it('splits a figure into its sign, its dollars and its cents', () => {
    expect(moneyParts(250537.73)).toEqual({ sign: '', dollars: '$250,537', cents: '.73', words: '$250,537.73' })
    expect(moneyParts(8)).toEqual({ sign: '', dollars: '$8', cents: '.00', words: '$8.00' })
    expect(moneyParts(0.05)).toEqual({ sign: '', dollars: '$0', cents: '.05', words: '$0.05' })
    expect(moneyParts(384.6)).toMatchObject({ dollars: '$384', cents: '.60' })
  })

  it('marks a loss with a true minus before the dollar sign', () => {
    expect(moneyParts(-537.73)).toEqual({ sign: '−', dollars: '$537', cents: '.73', words: '−$537.73' })
    expect(moneyParts(-12.5).words).toBe('−$12.50')
  })

  it('a figure that rounds to nothing is not a loss', () => {
    expect(moneyParts(-0.004).words).toBe('$0.00')
    expect(moneyParts(-0).words).toBe('$0.00')
    expect(moneyParts(-0.4, { cents: false }).words).toBe('$0')
  })

  it('reads a figure that is not a number as nothing', () => {
    expect(moneyWords(Number.NaN)).toBe('$0.00')
    expect(moneyWords(Number.POSITIVE_INFINITY)).toBe('$0.00')
  })

  it('marks both ways when the screen asks: a gain with a plus', () => {
    expect(moneyParts(166.21, { sign: 'both' })).toEqual({ sign: '+', dollars: '$166', cents: '.21', words: '+$166.21' })
    expect(moneyParts(-83.79, { sign: 'both' }).words).toBe('−$83.79')
    expect(moneyParts(0, { sign: 'both' }).words).toBe('+$0.00')
  })

  it('whole dollars have no cents to draw', () => {
    expect(moneyParts(48700.49, { cents: false })).toEqual({ sign: '', dollars: '$48,700', cents: '', words: '$48,700' })
    expect(moneyParts(48700.5, { cents: false }).words).toBe('$48,701')
    expect(moneyParts(-1234.5, { cents: false }).words).toBe('−$1,234')
  })

  it('a column of bare figures drops the dollar sign', () => {
    expect(moneyParts(39796.7, { symbol: '' })).toEqual({ sign: '', dollars: '39,796', cents: '.70', words: '39,796.70' })
    expect(moneyParts(-40, { symbol: '' }).words).toBe('−40.00')
  })

  it('shows the digits formatCurrency shows, to the cent', () => {
    // 1.115 is held as a hair under 1.115: formatCurrency says 1.11, and so must the door.
    for (const n of [0, 0.005, 1.005, 1.115, 1.255, 8.345, 0.285, 60, 97647.41, 104857.29, 1234567.891, 999.995]) {
      expect(moneyParts(n, { symbol: '' }).words).toBe(formatCurrency(n))
      expect(moneyParts(-n, { symbol: '' }).words.replace('−', '')).toBe(formatCurrency(n))
      expect(moneyParts(n, { symbol: '', cents: false }).words).toBe(formatCurrencyNoCents(n))
    }
    expect(moneyParts(-2.5, { symbol: '', cents: false }).words).toBe(formatCurrencyNoCents(-2.5).replace('-', '−'))
  })

  it('one ratio for the cents', () => {
    expect(MONEY_CENTS_EM).toBeGreaterThan(0.5)
    expect(MONEY_CENTS_EM).toBeLessThan(1)
  })
})

describe('moneyTextParts', () => {
  it('cuts a line of text at each amount that has its dollar sign', () => {
    expect(moneyTextParts('Overhead to date: $7,209.88 · by hours $6,692.85 · carry $517.03')).toEqual([
      'Overhead to date: ',
      { dollars: '$7,209', cents: '.88' },
      ' · by hours ',
      { dollars: '$6,692', cents: '.85' },
      ' · carry ',
      { dollars: '$517', cents: '.03' },
    ])
    expect(moneyTextParts('$1,820.40 true cost')).toEqual([{ dollars: '$1,820', cents: '.40' }, ' true cost'])
    expect(moneyTextParts('$1,250.00')).toEqual([{ dollars: '$1,250', cents: '.00' }])
    expect(moneyTextParts('+$166.21')).toEqual(['+', { dollars: '$166', cents: '.21' }])
    expect(moneyTextParts('Cash position: −$4,599.65')).toEqual(['Cash position: −', { dollars: '$4,599', cents: '.65' }])
  })

  it('leaves anything that is not money as words', () => {
    for (const words of ['—', '…', '8.0 h', '8.50 h on site', '12.50', '1,250', '$1,250', 'v2.83 is live', '12.50%', '$3.141 is not cents', '']) {
      expect(moneyTextParts(words)).toEqual([words])
    }
  })

  it('joins back to the text it was given, character for character', () => {
    for (const text of ['Paid: $1,250.00', ' $40.00 ', 'A $5.00 fee and a $10.25 fee.', '−$40.00', 'no money here']) {
      expect(joined(moneyTextParts(text))).toBe(text)
    }
  })
})

describe('moneyFigureParts', () => {
  it('reads a cell that is one figure, with or without a sign or a dollar sign', () => {
    expect(moneyFigureParts('14,115.35')).toEqual({ dollars: '14,115', cents: '.35' })
    expect(moneyFigureParts('−40.00')).toEqual({ dollars: '−40', cents: '.00' })
    expect(moneyFigureParts('-12.50')).toEqual({ dollars: '-12', cents: '.50' })
    expect(moneyFigureParts('$1,250.00')).toEqual({ dollars: '$1,250', cents: '.00' })
    expect(moneyFigureParts(' +$166.21 ')).toEqual({ dollars: '+$166', cents: '.21' })
  })

  it('passes anything that is not one figure through as null', () => {
    for (const words of ['—', '…', '8.0 h', '1,250', '$1,250.00 still out', '']) {
      expect(moneyFigureParts(words)).toBeNull()
    }
  })
})
