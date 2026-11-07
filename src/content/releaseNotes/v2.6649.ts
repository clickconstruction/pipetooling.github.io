import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6649',
  date: '2026-11-07',
  title: 'Messages: the bids@ reader waits out Gmail’s rate limit instead of knocking every minute',
  kind: 'fix',
  highlights: [
    'When Gmail tells the reader a box is being read too fast and names a time to try again, the reader now waits for that time. Before, it tried again every minute, and each try pushed the time further out, so bids@ sat unread for most of a day while the team box read fine.',
    'The reader remembers the label it puts on each email it took, instead of asking Gmail for the list of labels at the start of every run. If someone removes the label from the box, the reader makes it again on the next email.',
    'Settings → Phone and texts → Read bids@ shows the same health line as before: the last good read, and the last run’s own words when one stopped.',
  ],
}

export default note
