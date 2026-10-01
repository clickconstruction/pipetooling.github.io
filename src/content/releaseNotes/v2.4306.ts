import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4306',
  date: '2026-10-01',
  title: 'Contracts: the Contract window holds still after you type',
  kind: 'fix',
  highlights: [
    'Typing anything in the Contract window made it save the draft over and over, about once a second, for as long as the window stayed open. The status line flipped between Saving… and Saved as you type, and the whole window bounced up and down with it.',
    'Now one edit saves once. Nothing about the draft itself changes.',
  ],
}

export default note
