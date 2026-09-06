import { describe, expect, it } from 'vitest'
import { pendingCellChipAriaLabel, pendingCellChipTitle } from './hoursGridPendingChipCopy'

describe('pending cell chip copy (J7-N1)', () => {
  const entry = { personName: 'Ana Ruiz', workDate: '2026-09-02', count: 2, diffHours: 9.5 }

  it('the tooltip says a click reviews — never "click to approve", since the popover holds the Approve', () => {
    expect(pendingCellChipTitle(entry)).toBe('+9.50 h pending — click to review')
    expect(pendingCellChipTitle(entry)).not.toMatch(/click to approve/i)
  })

  it('the screen-reader label carries the count, the person, the day and the same two-step promise', () => {
    expect(pendingCellChipAriaLabel(entry)).toBe(
      '2 pending sessions for Ana Ruiz on 2026-09-02 — adds 9.50 hours to payroll. Click to review; approve from the popover.',
    )
    expect(pendingCellChipAriaLabel({ ...entry, count: 1, diffHours: 0.25 })).toContain('1 pending session for Ana Ruiz')
  })
})
