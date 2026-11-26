import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8631',
  date: '2026-11-26',
  title: 'Lien desk: the run’s step strip counts what the press will print',
  kind: 'fix',
  highlights: [
    'The Print step on the run’s checklist now counts the papers its press will print, and nothing else.',
    'An affidavit that printed already and says the same today is said apart as printed, not counted as to print.',
    'A right notice the run window still holds, or whose copies go without paper, is said apart with why.',
    'When nothing is left to print, the strip moves on to Out the door instead of counting a paper the press will not take.',
  ],
}

export default note
