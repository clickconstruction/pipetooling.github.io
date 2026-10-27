// @vitest-environment jsdom
/**
 * Render smokes for AccountingApprovalGroupHeader (punch list #184 sweep B): the grouped Approvals
 * header carries how long its oldest suggestion has waited, on the LABEL_APPROVAL_AGE scale.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import type { ApprovalGroup } from '../../lib/accountingApprovalGroups'
import { AccountingApprovalGroupHeader } from './AccountingApprovalGroupHeader'

const group = (over: Partial<ApprovalGroup> = {}): ApprovalGroup => ({
  labelId: 'L1',
  labelName: 'Materials',
  count: 3,
  totalAmount: -412.5,
  conflictCount: 0,
  oldestCreatedAt: '2026-10-21T15:00:00+00:00',
  items: [],
  ...over,
})

function renderHeader(g: ApprovalGroup) {
  return render(
    <AccountingApprovalGroupHeader group={g} expanded={false} busy={false} onToggle={() => {}} onApproveGroup={() => {}} onRejectGroup={() => {}} />,
  )
}

describe('AccountingApprovalGroupHeader', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-26T17:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('names the oldest suggestion’s wait beside the count: amber at three days', () => {
    const { container } = renderHeader(group())
    const chip = container.querySelector('[data-group-age]')!
    expect(chip.getAttribute('data-group-age')).toBe('amber')
    expect(chip.textContent).toBe('5 days waiting')
    expect(container.textContent).toContain('3 items')
  })

  it('reads red at a week, and draws no chip when nothing is stamped', () => {
    expect(renderHeader(group({ oldestCreatedAt: '2026-10-12T15:00:00+00:00' })).container.querySelector('[data-group-age]')!.getAttribute('data-group-age')).toBe('red')
    expect(renderHeader(group({ labelId: 'L2', oldestCreatedAt: null })).container.querySelector('[data-group-age]')).toBeNull()
  })
})
