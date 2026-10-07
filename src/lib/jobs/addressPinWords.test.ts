import { describe, expect, it } from 'vitest'
import { addressLooksWhole, addressPinFailureReason, addressPinWords, pinSourceWords } from './addressPinWords'

describe('addressPinWords (v2.4783)', () => {
  it('spends a lookup only on a whole-looking address', () => {
    expect(addressLooksWhole('380 TX')).toBe(false)
    expect(addressLooksWhole('380 TX-123, Se')).toBe(true)
    expect(addressLooksWhole('380 TX-123, Seguin, TX 78155')).toBe(true)
    expect(addressLooksWhole('595 Cardinal Rd Rosanky TX 78953')).toBe(true)
    expect(addressLooksWhole("Zack's House")).toBe(false)
    expect(addressLooksWhole('6288 River Rd New Braunfels')).toBe(false)
  })

  it('words each state', () => {
    expect(addressPinWords({ kind: 'placing' })).toEqual({ main: 'placing…', note: '', tone: 'pulse' })
    expect(addressPinWords({ kind: 'placed', county: 'Guadalupe', source: 'nominatim' })).toEqual({ main: 'Guadalupe County', note: 'pinned from the street map', tone: 'ok' })
    expect(addressPinWords({ kind: 'placed', county: '', source: 'cache' })).toEqual({ main: 'placed', note: 'pinned earlier', tone: 'ok' })
    expect(addressPinWords({ kind: 'failed', reason: addressPinFailureReason('not_found') })).toEqual({ main: 'could not place it', note: 'it needs a street, a city or a ZIP; the night will try once more', tone: 'amber' })
    expect(addressPinWords({ kind: 'unplaced' }).main).toBe('not placed yet')
    expect(pinSourceWords('google')).toBe('pinned by Google')
    expect(addressPinFailureReason('weird')).toBe('the night will try once more')
  })
})
