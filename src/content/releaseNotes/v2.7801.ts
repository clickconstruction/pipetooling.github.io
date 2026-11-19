import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7801',
  date: '2026-11-18',
  title: 'Lien desk: a closed paper opens a window that asks what to do',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Press a chip in a closed bin, or Answer on the bin’s title line. A window says what closed, on which day, and where that day is counted from.',
    'When the lien day has passed there are three answers. The date is wrong opens the last day of work. Keep collecting takes the job off the Lien desk and keeps it in Collections. Let it go marks it Uncollectible after asking once more.',
    'When one month’s notice window closed and the lien day is ahead, the answers are a late notice, the date, or recording the month closed. A closed month never asks you to let the job go.',
    'Each answer keeps your name, the day and your note on the job. With several jobs in a bin the window walks them one at a time.',
  ],
}

export default note
