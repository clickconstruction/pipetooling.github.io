import { describe, expect, it } from 'vitest'
import { parseTypedHoursMode, TYPED_HOURS_MODE_CHOICES } from './typedHoursSwitch'

describe('parseTypedHoursMode', () => {
  it('reads the three settings', () => {
    expect(parseTypedHoursMode('on')).toBe('on')
    expect(parseTypedHoursMode(' test ')).toBe('test')
    expect(parseTypedHoursMode('off')).toBe('off')
  })
  it('falls to off for anything else, as the database does', () => {
    expect(parseTypedHoursMode(null)).toBe('off')
    expect(parseTypedHoursMode(undefined)).toBe('off')
    expect(parseTypedHoursMode('ON')).toBe('off')
    expect(parseTypedHoursMode('yes')).toBe('off')
  })
  it('offers each setting once', () => {
    expect(TYPED_HOURS_MODE_CHOICES.map((c) => c.mode).sort()).toEqual(['off', 'on', 'test'])
  })
})
