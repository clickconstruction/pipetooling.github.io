import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8603',
  date: '2026-11-25',
  title: 'Dashboard: swipe a hidden bid or an opened report right to bring it back',
  kind: 'feature',
  highlights: [
    'On a phone, open Hidden on My Bids and swipe a bid to the right to show it again. Pull until the strip turns blue, then let go. Opened on Recent Reports works the same way and marks a report unread.',
    'A note says which bid or report came back, with Undo for ten seconds. Show again and Mark unread at a desk say it too.',
    'Left puts a row away and right brings one back. Swipe the wrong way and the row slides a little to show which way it goes.',
    'A swipe that starts at the very left edge of the screen is still your phone\'s own Back, so start it on the row.',
  ],
}

export default note
