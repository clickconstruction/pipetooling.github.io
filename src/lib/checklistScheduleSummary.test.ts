import { describe, expect, it } from 'vitest'
import { checklistScheduleSummary, startNotOnChosenDay, type ScheduleSummaryInput } from './checklistScheduleSummary'

const base: ScheduleSummaryInput = {
  when: 'today',
  repeatMode: 'weekly',
  startDate: '2026-08-22',
  todayStr: '2026-08-22',
  daysOfWeek: [],
  daysAfter: 1,
  endDate: null,
  staysUntilDone: true,
  assigneeNames: ['Robert'],
}

describe('checklistScheduleSummary', () => {
  it('today one-off, stays', () => {
    expect(checklistScheduleSummary(base)).toBe("One task on Robert's list today — stays until completed.")
  })

  it('future date one-off names the day', () => {
    const s = checklistScheduleSummary({ ...base, when: 'date', startDate: '2026-08-28' })
    expect(s).toContain('on Fri, Aug 28')
    expect(s).toContain('stays until completed')
  })

  it('non-sticky one-off says it goes away', () => {
    const s = checklistScheduleSummary({ ...base, staysUntilDone: false })
    expect(s).toContain('gone after that day')
  })

  it('a due date folds into the sentence as from-start → due (v2.2351)', () => {
    const s = checklistScheduleSummary({ ...base, when: 'date', startDate: '2026-08-31', dueDate: '2026-09-04' })
    expect(s).toBe("One task on Robert's list from Mon, Aug 31 — due Fri, Sep 4, stays until completed.")
  })

  it('a due date equal to the start day reads as a plain one-off', () => {
    const s = checklistScheduleSummary({ ...base, when: 'date', startDate: '2026-08-31', dueDate: '2026-08-31' })
    expect(s).toContain('on Mon, Aug 31 — stays until completed')
  })

  it('weekly with days, start, end, and carry-over rule', () => {
    const s = checklistScheduleSummary({
      ...base,
      when: 'repeat',
      repeatMode: 'weekly',
      daysOfWeek: [4, 1],
      startDate: '2026-08-25',
      endDate: '2026-12-01',
    })
    expect(s).toBe(
      "Every Mon & Thu on Robert's list, starting Tue, Aug 25, until Tue, Dec 1 — a missed day doesn't carry over.",
    )
  })

  it('weekly without days asks for one', () => {
    expect(checklistScheduleSummary({ ...base, when: 'repeat', daysOfWeek: [] })).toBe('Pick at least one weekday.')
  })

  it('after-done chains read naturally', () => {
    const s = checklistScheduleSummary({ ...base, when: 'repeat', repeatMode: 'after_done', daysAfter: 3 })
    expect(s).toBe("On Robert's list today, then again 3 days after each completion.")
  })

  it('names join politely and empty asks for people', () => {
    expect(checklistScheduleSummary({ ...base, assigneeNames: ['A', 'B'] })).toContain("A & B's list")
    expect(checklistScheduleSummary({ ...base, assigneeNames: ['A', 'B', 'C', 'D'] })).toContain("A, B +2's list")
    expect(checklistScheduleSummary({ ...base, assigneeNames: [] })).toBe('Pick at least one person.')
  })
})

describe('startNotOnChosenDay', () => {
  it('flags a start date whose weekday is not selected', () => {
    // 2026-08-25 is a Tuesday (2).
    expect(startNotOnChosenDay('2026-08-25', [1, 4])).toBe(true)
    expect(startNotOnChosenDay('2026-08-25', [2])).toBe(false)
    expect(startNotOnChosenDay('2026-08-25', [])).toBe(false)
  })
})
