import { describe, expect, it } from 'vitest'
import {
  TALLY_PAYROLL_HREF,
  canMarkTallyPayroll,
  draftPayrollAllGenerated,
  foldHoursApproved,
  hoursApprovedChipCopy,
} from './payWeekLinks'
import { previousCompletePayWeek } from '../payWeekAnchor'

describe('canMarkTallyPayroll (T5-03)', () => {
  it('admits dev and every pay-access role, nobody else', () => {
    expect(canMarkTallyPayroll({ isDev: true, canAccessPay: false })).toBe(true)
    expect(canMarkTallyPayroll({ isDev: false, canAccessPay: true })).toBe(true)
    expect(canMarkTallyPayroll({ isDev: false, canAccessPay: false })).toBe(false)
  })
})

describe('hours-approved nudge', () => {
  const now = new Date('2026-09-06T12:00:00-05:00')
  it('starts from the last complete pay week and adds counts', () => {
    const a = foldHoursApproved(null, 4, now)
    expect(a.count).toBe(4)
    expect(a.week).toEqual(previousCompletePayWeek(now))
    const b = foldHoursApproved(a, 2, now)
    expect(b.count).toBe(6)
    expect(b.week).toEqual(a.week)
  })
  it('an uncounted approval keeps the count it had (null when nothing counted yet)', () => {
    expect(foldHoursApproved(null, null, now).count).toBeNull()
    expect(foldHoursApproved(foldHoursApproved(null, 3, now), null, now).count).toBe(3)
  })
  it('writes the chip copy with the week label', () => {
    const n = foldHoursApproved(null, 1, now)
    const copy = hoursApprovedChipCopy(n)
    expect(copy.lead).toBe('1 session approved')
    expect(copy.action.startsWith('Draft payroll for ')).toBe(true)
    expect(copy.action.endsWith(' →')).toBe(true)
    expect(hoursApprovedChipCopy({ count: null, week: n.week }).lead).toBe('Hours approved')
    expect(hoursApprovedChipCopy({ count: 6, week: n.week }).lead).toBe('6 sessions approved')
  })
})

describe('draft payroll → tally pointer', () => {
  it('shows only when every person with hours has a report and at least one exists', () => {
    expect(draftPayrollAllGenerated({ peopleCount: 5, missingCount: 0, stubsInPeriod: 5 })).toBe(true)
    expect(draftPayrollAllGenerated({ peopleCount: 5, missingCount: 2, stubsInPeriod: 3 })).toBe(false)
    expect(draftPayrollAllGenerated({ peopleCount: 5, missingCount: 0, stubsInPeriod: 0 })).toBe(false)
    expect(draftPayrollAllGenerated({ peopleCount: 0, missingCount: 0, stubsInPeriod: 0 })).toBe(false)
  })
  it('lands on the Tally transactions view', () => {
    expect(TALLY_PAYROLL_HREF).toBe('/tally?tab=transactions')
  })
})
