import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2625',
  date: '2026-09-01',
  title: 'Division 22 codes audit now loads every fixture name',
  kind: 'fix',
  highlights: [
    'The audit modal was silently capped at the 1,000 most-counted names — rarely-used names (and their gaps) never appeared, and the coverage bar read higher than reality.',
    'It now loads the full list (~3,700 names and counting), so the coverage percentage is honest — expect it to drop; that\'s the fix, not a regression.',
  ],
}

export default note
