import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2682',
  date: '2026-09-03',
  title: 'Review: Jobs Worked rolls up per job, recurring tasks collapse',
  kind: 'feature',
  highlights: [
    'A person’s Jobs Worked now shows one line per job — hours, labor, share of the job’s labor, revenue, profit, and per-hour — sorted by profit. Click a job to open its day-by-day rows, which keep their full detail.',
    'Jobs with no bill amount or no % complete are chipped on their line, and days with zero hours are counted instead of hiding among the rows.',
    'Tasks outstanding folds a recurring item into one line: how often it repeats, how many were missed since when, how many are still ahead, and the next due date. One-off tasks stay as they were.',
  ],
}

export default note
