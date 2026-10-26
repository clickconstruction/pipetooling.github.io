/**
 * The order of the robots' questions on a card (punch list #184 sweep B): open
 * questions first, OLDEST first — a robot idles on every answer, so the one
 * that has waited three days leads this morning's — then the answered,
 * promoted and dismissed ones newest first, as a log reads. Pure: no React.
 */
import { compareOldestFirst } from '../ageState'

export type TwinQuestionOrderRow = {
  status: 'open' | 'answered' | 'promoted' | 'dismissed' | string
  created_at: string | null
}

export function compareTwinQuestions(a: TwinQuestionOrderRow, b: TwinQuestionOrderRow): number {
  const aOpen = a.status === 'open'
  const bOpen = b.status === 'open'
  if (aOpen !== bOpen) return aOpen ? -1 : 1
  if (aOpen) return compareOldestFirst(a.created_at, b.created_at)
  return (b.created_at ?? '').localeCompare(a.created_at ?? '')
}

export function sortTwinQuestions<T extends TwinQuestionOrderRow>(rows: ReadonlyArray<T>): T[] {
  return [...rows].sort(compareTwinQuestions)
}
