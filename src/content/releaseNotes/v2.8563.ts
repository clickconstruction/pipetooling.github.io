import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8563',
  date: '2026-11-24',
  title: 'Messages on a phone: search rows stay on the screen, and the folded reply box shows one whole line',
  kind: 'fix',
  highlights: [
    'In the Messages search, a row under Lines that match no longer runs past the right edge of a phone.',
    'A long link in a line now breaks inside its row. On a narrow phone the date drops under the words.',
    'The folded reply box shows one whole grey line, Write to and the name. Before, a second line was cut at its foot.',
    'Press into the box and it opens to three rows with both sentences, as before.',
  ],
}

export default note
