import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8132',
  date: '2026-11-20',
  title: 'Document builder: two new breach lines are two lines',
  kind: 'fix',
  highlights: [
    'On a Sub NDA page, pressing Add a line twice under What puts a person in breach gives two lines you can type in one at a time.',
    'Typing in the second one used to change the first, and its × took the first one off.',
    'A new line at one level no longer changes or hides a new line at a stricter level.',
  ],
}

export default note
