import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4492',
  date: '2026-10-04',
  title: 'Submittals: every window that takes typing asks before it closes',
  kind: 'fix',
  highlights: [
    'The schedule window, Share, They approved all of it and the house file window now ask Leave without saving? when you click outside after typing.',
    'Esc works in each of them, and in the small windows that only ask a question.',
    'With nothing typed, each still closes at once.',
  ],
}

export default note
