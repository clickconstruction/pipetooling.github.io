import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2275',
  date: '2026-08-25',
  title: 'Team review: due count up front + schedule',
  kind: 'feature',
  highlights: [
    'The team review deck now leads with where you stand — an orange "N due" pill next to your average when reviews are waiting, a green "Caught up · next in 5d" when they\'re not.',
    'Tap the pill for Upcoming reviews: who\'s due now and how many days until each next person comes due; tapping a person opens their card.',
    'Role labels in the person picker use the short names — "Master" and "Sub" — so names stop wrapping on phones.',
  ],
}

export default note
