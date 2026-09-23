import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3774',
  date: '2026-09-23',
  title: 'The Bank payments combo-chip check stops going red on unrelated work',
  kind: 'fix',
  highlights: [
    'One of the automated checks on the Bank payments window — the one that proves a deposit covering two bills offers to fill both allocation lines — could fail when the whole check suite ran on a busy machine, even on changes nowhere near Banking. It now waits long enough for the window to load the way a real one does.',
    'Nothing in the app changed; the check still proves exactly what it did before.',
  ],
}

export default note
