/**
 * The job whose squares the Job Mode card holds (the new phone layout, `jobCard.ts`).
 *
 * The row of squares above the card and the card itself are drawn by different parts of the Dashboard, and each
 * reads the day for itself. The squares may only leave once the card has drawn every press they had, so the card
 * says which job it has laid out the new way, and the squares read it. Null whenever the card is drawn the old
 * way, shows no job, or is not on the screen, and then the squares stay.
 *
 * One card is on the screen at a time, so one value. A plain store: the tests set it and read it with no screen.
 */

let folded: string | null = null
const listeners = new Set<() => void>()

/** The card says which job it holds the squares of, or null when it holds none. */
export function setFoldedJobId(jobId: string | null): void {
  const next = jobId || null
  if (next === folded) return
  folded = next
  for (const listener of [...listeners]) listener()
}

/** The job the card holds the squares of, or null. */
export function foldedJobId(): string | null {
  return folded
}

/** Hear when the folded job changes. Returns the way to stop hearing. */
export function subscribeFoldedJob(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
