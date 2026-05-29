import { describe, expect, it } from 'vitest'
import { csvEscapeField, sanitizeCsvFilenamePart, buildCountsCsv } from './bidCsvExport'
import type { BidCountRow } from '../../types/bids'

function row(partial: Partial<BidCountRow>): BidCountRow {
  return { count: 0, fixture: '', group_tag: null, page: null, ...partial } as BidCountRow
}

describe('csvEscapeField', () => {
  it('returns plain values unchanged', () => {
    expect(csvEscapeField('Toilet')).toBe('Toilet')
  })

  it('quotes values containing a comma', () => {
    expect(csvEscapeField('a,b')).toBe('"a,b"')
  })

  it('quotes and doubles embedded double-quotes', () => {
    expect(csvEscapeField('say "hi"')).toBe('"say ""hi"""')
  })

  it('quotes values containing newline or carriage return', () => {
    expect(csvEscapeField('a\nb')).toBe('"a\nb"')
    expect(csvEscapeField('a\rb')).toBe('"a\rb"')
  })
})

describe('sanitizeCsvFilenamePart', () => {
  it('replaces runs of disallowed chars with a single underscore', () => {
    expect(sanitizeCsvFilenamePart('Acme Co / Bid #3')).toBe('Acme_Co_Bid_3')
  })

  it('trims leading and trailing underscores', () => {
    expect(sanitizeCsvFilenamePart('  hello  ')).toBe('hello')
  })

  it('keeps allowed punctuation (dot, underscore, hyphen)', () => {
    expect(sanitizeCsvFilenamePart('a.b-c_d')).toBe('a.b-c_d')
  })

  it('caps length at 80 characters', () => {
    expect(sanitizeCsvFilenamePart('a'.repeat(200))).toHaveLength(80)
  })
})

describe('buildCountsCsv', () => {
  it('emits a header row even with no data', () => {
    expect(buildCountsCsv([])).toBe('Count,Fixture or Tie-in,Group/Tag,Plan Page')
  })

  it('renders rows with null group/page as empty fields', () => {
    const csv = buildCountsCsv([
      row({ count: 5, fixture: 'Toilet', group_tag: 'Bath', page: 'A-101' }),
      row({ count: 2, fixture: 'Sink', group_tag: null, page: null }),
    ])
    expect(csv).toBe(
      'Count,Fixture or Tie-in,Group/Tag,Plan Page\n5,Toilet,Bath,A-101\n2,Sink,,',
    )
  })

  it('escapes fixture fields that contain commas', () => {
    const csv = buildCountsCsv([row({ count: 1, fixture: 'Tee, 2in' })])
    expect(csv).toBe('Count,Fixture or Tie-in,Group/Tag,Plan Page\n1,"Tee, 2in",,')
  })
})
