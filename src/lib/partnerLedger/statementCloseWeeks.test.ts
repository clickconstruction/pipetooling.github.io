import { describe, expect, it } from 'vitest'
import { planStatementClose } from './statementCloseWeeks'

// Current company week: Sun 2026-08-16 – Sat 2026-08-22 (prev week = 2026-08-09).
const CUR = '2026-08-16'

describe('planStatementClose', () => {
  it('empty archive: targets last week, no gaps', () => {
    const plan = planStatementClose([], CUR)
    expect(plan).toEqual({
      prevWeek: '2026-08-09',
      target: '2026-08-09',
      prevWeekClosed: false,
      nextOpensOn: '2026-08-23',
      olderUncovered: [],
    })
  })

  it('contiguous archive through last week: nothing to close', () => {
    const plan = planStatementClose(['2026-08-09', '2026-08-02', '2026-07-26'], CUR)
    expect(plan.target).toBeNull()
    expect(plan.prevWeekClosed).toBe(true)
    expect(plan.olderUncovered).toEqual([])
  })

  it('last week open with older gaps: targets last week and lists gaps oldest first', () => {
    // Bryan-shaped archive: 6/28, 7/05, 7/12, 7/19 exist; 7/26 and 8/02 missing; 8/09 not generated.
    const plan = planStatementClose(['2026-07-19', '2026-07-12', '2026-07-05', '2026-06-28'], CUR)
    expect(plan.target).toBe('2026-08-09')
    expect(plan.prevWeekClosed).toBe(false)
    expect(plan.olderUncovered).toEqual(['2026-07-26', '2026-08-02'])
  })

  it('last week closed but older gaps remain: null target, gaps still listed', () => {
    const plan = planStatementClose(['2026-08-09', '2026-07-19', '2026-06-28'], CUR)
    expect(plan.target).toBeNull()
    expect(plan.prevWeekClosed).toBe(true)
    expect(plan.olderUncovered).toEqual(['2026-07-05', '2026-07-12', '2026-07-26', '2026-08-02'])
  })

  it('normalizes non-Sunday period starts into their company week', () => {
    // 2026-08-10 is the Monday of the 08-09 week — still counts as covering it.
    const plan = planStatementClose(['2026-08-10'], CUR)
    expect(plan.target).toBeNull()
    expect(plan.prevWeekClosed).toBe(true)
  })

  it('ignores malformed dates instead of crashing', () => {
    const plan = planStatementClose(['not-a-date', ''], CUR)
    expect(plan.target).toBe('2026-08-09')
    expect(plan.olderUncovered).toEqual([])
  })

  it('weeks before the earliest statement are out of scope', () => {
    const plan = planStatementClose(['2026-08-09'], CUR)
    expect(plan.olderUncovered).toEqual([])
  })
})
