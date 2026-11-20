/**
 * Job pace for the next stop (punch list #406, the walk as a real superintendent on 2026-11-20). The Job pace
 * card drew only for the job the Job Mode card shows details for: the job he is clocked on, or his next job
 * before he clocks in. A superintendent who clocks in with no job linked, or onto a bid, has neither, so the
 * card went away for the whole of that clock, with his first stop still ahead of him. The owner's word: build it.
 *
 * The rule: when the Job Mode card has no job of its own and the day still has a stop, the card draws for that
 * stop, and says whose pace it is with one line, *Next stop: PLUM 1044 · Maple Court*. A job whose papers still
 * close it to him draws nothing, as on the rest of the card.
 *
 * Pure: the page's facts in, the job to draw or none.
 */
export function paceNextStopJobId(i: {
  role: string | null | undefined
  /** The Job Mode card already shows a job's details: the job he is on, or his next job before a clock in. */
  hasOwnJob: boolean
  /** His open clock names a job. Its details may still be loading, and its own card follows: never the next stop's in its place. */
  onAJob: boolean
  /** The day's next stop not yet visited, when there is one. */
  nextJobId: string | null | undefined
  /** The next stop's papers are not signed yet, so the job is closed or masked for him. */
  closed: boolean
}): string | null {
  if (i.role !== 'superintendent') return null
  if (i.hasOwnJob || i.onAJob || i.closed) return null
  return i.nextJobId ? i.nextJobId : null
}

export const PACE_NEXT_STOP_WORDS = {
  /** Over the card's reading: which job the pace is for. A label, not a sentence. */
  stop: (label: string): string => `Next stop: ${label}`,
} as const
