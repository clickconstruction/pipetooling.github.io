import { describe, expect, it } from 'vitest'
import { shouldShowBulkDeleteAlert } from './bulkDeleteAlertDismiss'

const NOW = 1_700_000_000_000

describe('shouldShowBulkDeleteAlert', () => {
  it('shows when there are alerts and nothing is dismissed', () => {
    expect(shouldShowBulkDeleteAlert(1, {}, NOW)).toBe(true)
    expect(shouldShowBulkDeleteAlert(9, {}, NOW)).toBe(true)
  })

  it('stays hidden when there is nothing to report', () => {
    expect(shouldShowBulkDeleteAlert(0, {}, NOW)).toBe(false)
    expect(shouldShowBulkDeleteAlert(null, {}, NOW)).toBe(false)
  })

  describe('snooze', () => {
    it('hides while the snooze window is open', () => {
      expect(shouldShowBulkDeleteAlert(3, { snoozeUntil: NOW + 1000 }, NOW)).toBe(false)
    })

    it('reappears the moment the snooze expires', () => {
      expect(shouldShowBulkDeleteAlert(3, { snoozeUntil: NOW }, NOW)).toBe(true)
      expect(shouldShowBulkDeleteAlert(3, { snoozeUntil: NOW - 1 }, NOW)).toBe(true)
    })

    it('snoozes regardless of how big the burst is — an explicit choice by the dev', () => {
      expect(shouldShowBulkDeleteAlert(500, { snoozeUntil: NOW + 1000 }, NOW)).toBe(false)
    })
  })

  describe('dismiss until count increases', () => {
    it('hides at or below the dismissed level', () => {
      expect(shouldShowBulkDeleteAlert(3, { dismissedCount: 3 }, NOW)).toBe(false)
      expect(shouldShowBulkDeleteAlert(2, { dismissedCount: 3 }, NOW)).toBe(false)
    })

    it('re-raises as soon as a NEW burst pushes the count up — the whole point', () => {
      expect(shouldShowBulkDeleteAlert(4, { dismissedCount: 3 }, NOW)).toBe(true)
    })

    it('does not re-raise when the count falls (restores shrink it; that is not new activity)', () => {
      expect(shouldShowBulkDeleteAlert(1, { dismissedCount: 3 }, NOW)).toBe(false)
    })
  })

  it('snooze wins over a count increase while it is still open', () => {
    expect(shouldShowBulkDeleteAlert(10, { dismissedCount: 3, snoozeUntil: NOW + 1000 }, NOW)).toBe(false)
  })

  it('a dismissed-then-expired-snooze alert still respects the dismissed level', () => {
    expect(shouldShowBulkDeleteAlert(3, { dismissedCount: 3, snoozeUntil: NOW - 1 }, NOW)).toBe(false)
    expect(shouldShowBulkDeleteAlert(4, { dismissedCount: 3, snoozeUntil: NOW - 1 }, NOW)).toBe(true)
  })
})
