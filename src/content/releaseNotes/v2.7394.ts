import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7394',
  date: '2026-11-15',
  title: 'New Sub Labor: a sheet names the one person it pays (PR 5 of the sub labor train)',
  kind: 'feature',
  highlights: [
    'The sheet form’s second step is now Paid to, and it is one pick. Tapping a second name takes the place of the first.',
    'Picking a job no longer ticks everyone on that job’s team. The team is offered under the chips, and you tap the one person the sheet pays. A ticked team is how teammates came to be named on subs’ sheets.',
    'A line under the chips says whose the sheet is. An older sheet that still names a teammate beside a sub shows a warning and one press that takes the teammates off.',
    'A line you are typing that the job already carries on another sheet, words and amount alike, is flagged before you save.',
  ],
}

export default note
