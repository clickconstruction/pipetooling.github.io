import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8040',
  date: '2026-11-20',
  title: 'My Inbox: the title and View all on one line, and a quiet label for each section',
  kind: 'feature',
  highlights: [
    'On the Dashboard, My Inbox now reads on one line: the title at the left and View all → at the right, as My Schedule does with Calendar →. The empty space beside the title is gone.',
    'Due Today and Overdue are small labels under the title, each with a count of what is still open. On a phone the counts are new. The title always reads My Inbox, on a day with only overdue tasks too.',
    'One View all → opens the Checklist for the whole inbox. The two older links opened the same page, so nothing is lost. The press is taller, for a thumb.',
    'For the office, Recently Completed moved from the corner of the title to a fold near the foot of the card, with its unread count beside it.',
  ],
}

export default note
