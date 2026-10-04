import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4479',
  date: '2026-10-03',
  title: 'Submittals: the Edit window keeps what you typed',
  kind: 'fix',
  highlights: [
    'A click outside the Edit window used to close it and lose your typing. Now it asks first: Leave without saving?',
    'Esc works in the Edit window, in Their answer and in Choose from the takeoff. It asks the same way when something changed.',
    'With nothing changed, each window still closes at once.',
    'Save reads Saving… and holds while it saves, so a double press cannot add a row twice.',
  ],
}

export default note
