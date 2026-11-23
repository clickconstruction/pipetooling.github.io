import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8309',
  date: '2026-11-22',
  title: 'In kind: a GC’s statement and GC Review leave out a bill an arrangement pays',
  kind: 'feature',
  highlights: [
    'A bill an in kind arrangement pays is no longer listed as owed on a GC’s statement. One line under the total says how much is scheduled in kind.',
    'GC Review leaves the bill out of the GC’s bills, totals and age. A line at the foot of the window says how much it left out.',
    'The whole report, the printed sheet, the call sheet and the week’s check follow, and so do the office’s statement week amounts.',
    'A GC whose every open bill is on an arrangement gets no statement, since nothing is owed.',
  ],
}

export default note
