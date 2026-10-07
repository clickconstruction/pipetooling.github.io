/** Main's own test for the chart's weekend mark, which the moved tests reach only through the working calendar (the schedule's PR 1a). */
import { describe, expect, it } from 'vitest'
import { isWeekend } from './gantt'

describe('the working calendar', () => {
  it('marks Saturday and Sunday, and no other day', () => {
    expect(['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'].map(isWeekend)).toEqual([false, true, true, false])
  })
})
