/**
 * Equipment pre-use check (punch list #270): a day's machine plan for the schedule's chips and the block editor's
 * Equipment row, one read shared by every block that draws the day.
 */
import { useEffect, useState } from 'react'
import { formatErrorMessage } from '../utils/errorHandling'
import { loadDay, peekDay, subscribePlans, type DayPlan } from '../lib/machines/assignmentsIo'

export function useDayPlan(day: string | null | undefined): { plan: DayPlan | null; problem: string | null } {
  const [plan, setPlan] = useState<DayPlan | null>(() => (day ? peekDay(day) : null))
  const [problem, setProblem] = useState<string | null>(null)
  useEffect(() => {
    if (!day) return
    let live = true
    const read = () => {
      loadDay(day)
        .then((p) => live && setPlan(p))
        .catch((e) => live && setProblem(formatErrorMessage(e, 'The machines did not read.')))
    }
    read()
    const off = subscribePlans(() => {
      const have = peekDay(day)
      if (have) setPlan(have)
      else read()
    })
    return () => {
      live = false
      off()
    }
  }, [day])
  return { plan, problem }
}
