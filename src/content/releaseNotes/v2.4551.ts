import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4551',
  date: '2026-10-05',
  title: 'Dashboard on a phone: windows answer your taps when My Inbox is empty',
  kind: 'fix',
  highlights: [
    'For an office person on a phone with nothing in My Inbox, the Dashboard kept reloading that section about twice a second.',
    'While it did, an iPhone ignored taps inside a window. Quick clock opened, but its buttons and its text box did nothing.',
    'The section now loads once and stays put, so quick clock and the other windows work.',
  ],
}

export default note
