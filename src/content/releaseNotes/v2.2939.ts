import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2939',
  date: '2026-09-06',
  title: 'Robots: duplicate questions start collapsing into single rulings',
  kind: 'infra',
  highlights: [
    'Robot questions can now carry a topic — the same doctrine issue asked on five bids becomes one ruling to answer, not five reads.',
    'Reports filed with a run label are no longer logged as "unlabeled", and a robot can verify which live bid its sealed shadow is paired to.',
  ],
}

export default note
