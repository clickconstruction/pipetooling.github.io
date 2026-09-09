import { describe, expect, it } from 'vitest'
import { resolveBridgeFocusTarget } from './bridgeFocusOpener'

describe('resolveBridgeFocusTarget', () => {
  it('opens Clock In when nothing is running — the Job Mode card\'s Clock In button', () => {
    expect(resolveBridgeFocusTarget({ hasOpenSession: false, userId: 'u1', userName: 'Tristen' })).toBe('clock-in')
  })
  it('opens Update Focus when a session is running — the card\'s Choose Next Job', () => {
    expect(resolveBridgeFocusTarget({ hasOpenSession: true, userId: 'u1', userName: 'Tristen' })).toBe('update-focus')
  })
  it('does nothing without a user or a display name, like the visible buttons', () => {
    expect(resolveBridgeFocusTarget({ hasOpenSession: false, userId: null, userName: 'Tristen' })).toBe('none')
    expect(resolveBridgeFocusTarget({ hasOpenSession: false, userId: 'u1', userName: '  ' })).toBe('none')
    expect(resolveBridgeFocusTarget({ hasOpenSession: true, userId: 'u1', userName: undefined })).toBe('none')
  })
})
