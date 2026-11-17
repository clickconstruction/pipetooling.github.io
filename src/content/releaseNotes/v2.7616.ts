import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7616',
  date: '2026-11-17',
  title: 'Waiting on card: a window that has passed says closed',
  kind: 'fix',
  highlights: [
    'On the office’s Waiting on card, a lien notice whose first window has already passed now reads "First window closed" with its day. It used to read "closes" for a day that was behind us.',
    'On the day itself the line reads "First window closes today."',
  ],
}

export default note
