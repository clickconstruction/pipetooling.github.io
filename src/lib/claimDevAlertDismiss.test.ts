import { describe, expect, it } from 'vitest'
import { shouldShowClaimDevAlert } from './claimDevAlertDismiss'

const NOW = 1_700_000_000_000

describe('shouldShowClaimDevAlert', () => {
  it('shows when someone has been refused and nothing is dismissed', () => {
    expect(shouldShowClaimDevAlert(1, {}, NOW)).toBe(true)
  })

  it('stays hidden when nobody has tried', () => {
    expect(shouldShowClaimDevAlert(0, {}, NOW)).toBe(false)
    expect(shouldShowClaimDevAlert(null, {}, NOW)).toBe(false)
  })

  it('hides while snoozed, reappears when the snooze expires', () => {
    expect(shouldShowClaimDevAlert(2, { snoozeUntil: NOW + 1000 }, NOW)).toBe(false)
    expect(shouldShowClaimDevAlert(2, { snoozeUntil: NOW - 1 }, NOW)).toBe(true)
  })

  it('hides at or below the dismissed level', () => {
    expect(shouldShowClaimDevAlert(2, { dismissedCount: 2 }, NOW)).toBe(false)
    expect(shouldShowClaimDevAlert(1, { dismissedCount: 2 }, NOW)).toBe(false)
  })

  // The point of the notice: someone trying AGAIN must break through a dismissal.
  it('re-raises when a new attempt pushes the count up', () => {
    expect(shouldShowClaimDevAlert(3, { dismissedCount: 2 }, NOW)).toBe(true)
  })

  it('snooze wins over a count increase while still open', () => {
    expect(shouldShowClaimDevAlert(9, { dismissedCount: 2, snoozeUntil: NOW + 1000 }, NOW)).toBe(false)
  })
})
