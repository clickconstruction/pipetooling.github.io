import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2661',
  date: '2026-09-02',
  title: 'Faint text is readable again',
  kind: 'fix',
  highlights: [
    'The lightest gray text — timestamps, empty-state notes, calendar day numbers, Banking posted/bank metadata — was too faint to read comfortably in both themes. It now meets contrast guidelines everywhere while staying visibly quieter than regular text.',
  ],
}

export default note
