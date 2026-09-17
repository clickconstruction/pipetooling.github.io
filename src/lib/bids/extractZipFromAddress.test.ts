import { describe, expect, it } from 'vitest'
import { lastZipInAddress } from './extractZipFromAddress'

describe('lastZipInAddress', () => {
  it('takes the last five-digit run, not the first', () => {
    expect(lastZipInAddress('12345 Main St, Fort Worth, TX 76102')).toBe('76102')
  })
  it('ignores runs that are not exactly five digits', () => {
    expect(lastZipInAddress('Suite 1234, Dallas TX 752011')).toBe('')
    expect(lastZipInAddress('PO Box 98765-4321')).toBe('98765')
  })
  it('is empty for no address or no ZIP', () => {
    expect(lastZipInAddress(null)).toBe('')
    expect(lastZipInAddress(undefined)).toBe('')
    expect(lastZipInAddress('Fort Worth, TX')).toBe('')
  })
})
