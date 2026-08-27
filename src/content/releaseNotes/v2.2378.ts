import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2378',
  date: '2026-08-26',
  title: 'Workbench: slider on press, coverage as a chip',
  kind: 'feature',
  highlights: [
    'The margin slider now lives behind a ▾ beside the % box — press it for a long-track slider that runs the full 20–95 (it used to stop at 65), solves when you let go, and tucks away when you click elsewhere. Typing a margin works exactly as before.',
    'The "N of N priced" bar collapses to a small chip on the solver line — green ✓ when everything\'s priced, amber while work remains. Its caret drops the familiar bar and "Show unpriced only" filter; open or closed is remembered on your device.',
    'Together that hands back two rows of space to the fixture table.',
  ],
}

export default note
