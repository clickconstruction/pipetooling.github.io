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
})
