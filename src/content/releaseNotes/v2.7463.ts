import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7463',
  date: '2026-11-16',
  title: 'Lien desk: By job draws sooner',
  kind: 'fix',
  highlights: [
    'Pressing By job on the Lien desk draws its rows in about half the time. It asked the database for its facts in five steps, one after another. It now asks in three, and the facts that do not depend on each other come together.',
    'Opened by its own link, By job no longer waits for the rest of the desk to finish reading before it starts. Both read side by side, and the page says Reading every unpaid job… from the first moment.',
    'The rows, their order and their words are the same.',
  ],
}

export default note
