import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3603',
  date: '2026-09-18',
  title: 'Jobs tabs: switching back to Pipeline within half a minute is instant',
  kind: 'feature',
  highlights: [
    'Coming back to Pipeline (or Billing, Parts, Sub Labor, Work Orders) within 30 seconds of its last load shows the board you already had instead of reloading every job. The rows, the section totals and the chips are the same ones you left.',
    'A change on the board still refreshes it: bill a customer, mark a job paid, save an edit, or come back to the app after a while, and the list reloads as before. Only the plain tab switch is skipped.',
  ],
}

export default note
