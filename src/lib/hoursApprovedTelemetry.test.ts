import { describe, expect, it, vi } from 'vitest'

vi.mock('./navClickTelemetry', () => ({ recordNavClick: vi.fn() }))

import { recordNavClick } from './navClickTelemetry'
import { HOURS_APPROVED_CONTROL, hoursApprovedTarget, recordHoursApproved } from './hoursApprovedTelemetry'

describe('hoursApprovedTarget', () => {
  it('encodes surface and count as one parseable target', () => {
    expect(hoursApprovedTarget('strip-pill', 1)).toBe('strip-pill?count=1')
    expect(hoursApprovedTarget('bulk-modal', 37)).toBe('bulk-modal?count=37')
    expect(hoursApprovedTarget('approvals-queue', 2.9)).toBe('approvals-queue?count=2')
    expect(hoursApprovedTarget('moneyfill-queue', Number.NaN)).toBe('moneyfill-queue?count=0')
  })
})

describe('recordHoursApproved', () => {
  it('records one ui_nav_clicks row with the role and the surface+count target', () => {
    vi.mocked(recordNavClick).mockClear()
    recordHoursApproved('u1', 'assistant', 'cell-popover', 3)
    expect(recordNavClick).toHaveBeenCalledWith('u1', 'assistant', HOURS_APPROVED_CONTROL, 'cell-popover?count=3')
  })

  it('skips zero-count approvals (all-skipped batches) and null roles become null', () => {
    vi.mocked(recordNavClick).mockClear()
    recordHoursApproved('u1', 'assistant', 'bulk-modal', 0)
    expect(recordNavClick).not.toHaveBeenCalled()
    recordHoursApproved('u1', undefined, 'sessions-list', 1)
    expect(recordNavClick).toHaveBeenCalledWith('u1', null, HOURS_APPROVED_CONTROL, 'sessions-list?count=1')
  })
})
