import { describe, expect, it } from 'vitest'

import { shouldHideHcpEntryField } from './hideHcpFieldSetting'

describe('shouldHideHcpEntryField (v2.1533)', () => {
  it('never hides while the flag is off', () => {
    expect(shouldHideHcpEntryField(false, '')).toBe(false)
    expect(shouldHideHcpEntryField(false, '1234')).toBe(false)
  })

  it('hides the empty field when the flag is on (new jobs and no-HCP jobs)', () => {
    expect(shouldHideHcpEntryField(true, '')).toBe(true)
    expect(shouldHideHcpEntryField(true, null)).toBe(true)
    expect(shouldHideHcpEntryField(true, undefined)).toBe(true)
    expect(shouldHideHcpEntryField(true, '   ')).toBe(true)
  })

  it('keeps the field for jobs that already carry an HCP number', () => {
    expect(shouldHideHcpEntryField(true, '9271')).toBe(false)
  })
})
