import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6735',
  date: '2026-11-08',
  title: 'The Development page opens lighter: History reads a long line’s first words',
  kind: 'fix',
  roles: ['dev', 'controller', 'master_technician', 'assistant', 'estimator'],
  highlights: [
    'History used to bring every kept line down whole on every open, the long emails the robots keep included. On the busiest site that was a third of what the page read. Now the list reads each line’s first words and how long the whole is.',
    'Press more › on a long line and the window reads the rest as it opens. Until it lands the window shows the first words with Reading the rest…, and if the read fails it says why.',
    'Typing in the History search reads every long line whole once, so a search still finds a word deep in an email.',
  ],
}

export default note
