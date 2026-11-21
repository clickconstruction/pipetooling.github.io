import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8185',
  date: '2026-11-21',
  title: 'The Job window stops looking for the Bill press when it closes',
  kind: 'fix',
  highlights: [
    'After you pick lines to bill, the Job window looks for the Bill press so it can bring it into view. That looking now stops when the window closes.',
    'Before, it could carry on for up to five seconds after the window was gone. Nothing on screen went wrong, but it could fail the app’s own checks at random and hold up other changes.',
  ],
}

export default note
