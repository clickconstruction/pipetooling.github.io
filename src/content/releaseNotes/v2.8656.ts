import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8656',
  date: '2026-11-26',
  title: 'Add a part on a small phone: the blue Add press stays above the keys',
  kind: 'fix',
  highlights: [
    'On a small phone with the number pad up, the blue Add press on the Add a part sheet was a sliver at the bottom. You had to scroll to reach it, and the number scrolled away.',
    'The blue press now stands at the foot of the sheet and does not scroll. It stays above the keys while you type the number.',
    'Add and another part is still the last thing in the list above it.',
  ],
}

export default note
