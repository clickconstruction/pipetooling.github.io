import { describe, expect, it } from 'vitest'
import { stripTrailingZip } from './displayAddress'

describe('stripTrailingZip', () => {
  it('drops a trailing 5-digit zip but keeps the state', () => {
    expect(stripTrailingZip('105 Dover Rd San Antonio, TX 78209')).toBe('105 Dover Rd San Antonio, TX')
    expect(stripTrailingZip('10605 Starcrest Dr. San Antonio Tx 78217')).toBe('10605 Starcrest Dr. San Antonio Tx')
  })

  it('drops zip+4 and a comma before the zip', () => {
    expect(stripTrailingZip('123 Main St Austin, TX 78751-1234')).toBe('123 Main St Austin, TX')
    expect(stripTrailingZip('123 Main St Austin TX, 78751')).toBe('123 Main St Austin TX')
  })

  it('leaves addresses without a trailing zip alone', () => {
    expect(stripTrailingZip('123 Main St Austin, TX')).toBe('123 Main St Austin, TX')
    expect(stripTrailingZip('Gun Dog Trail, Neeses, SC')).toBe('Gun Dog Trail, Neeses, SC')
    expect(stripTrailingZip('12925 FM 20')).toBe('12925 FM 20')
  })

  it('never strips the whole string and handles null/blank', () => {
    expect(stripTrailingZip('78209')).toBe('78209')
    expect(stripTrailingZip(null)).toBe('')
    expect(stripTrailingZip('  ')).toBe('')
  })

  it('drops the imported literal "Null" where the zip belongs (v2.2609)', () => {
    expect(stripTrailingZip('9703 Lenox Hl San Antonio, TX Null')).toBe('9703 Lenox Hl San Antonio, TX')
    expect(stripTrailingZip('628 Terrell Rd, San Antonio, TX null')).toBe('628 Terrell Rd, San Antonio, TX')
    expect(stripTrailingZip('123 Main St Austin, TX 78751 Null')).toBe('123 Main St Austin, TX')
    // A string that IS just the junk token stays as-is (never strip to empty).
    expect(stripTrailingZip('Null')).toBe('Null')
    // Mid-string "null" is untouched.
    expect(stripTrailingZip('12 Nullarbor Way, Austin, TX')).toBe('12 Nullarbor Way, Austin, TX')
  })
})
