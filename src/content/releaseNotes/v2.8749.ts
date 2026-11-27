import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8749',
  date: '2026-11-27',
  title: 'The app’s code check gets a rule that keeps its lower layers apart from its screens',
  kind: 'infra',
  highlights: [
    'Behind the scenes only. Nothing on any screen changes.',
    'The check that reads the app’s code before each update needs more memory as the app grows. The way to cut that is to check the code in layers, each one alone.',
    'That only works when a lower layer never reads from a screen above it. A new check now refuses a change that adds such a read, and names the mend.',
    'The 232 reads that already cross are on a list. The list only shrinks, and a later step clears it.',
  ],
}

export default note
