import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3212',
  date: '2026-09-10',
  title: 'A robot asking for a different plan set goes to the bid, not to Standing rulings',
  kind: 'feature',
  highlights: [
    'When a robot says the wrong set is on a bid ("attach the plumbing sheets?"), that is a fix on one bid, not a ruling. Standing rulings now shows a single line with the bid number instead of a card, and the count only counts real rulings.',
    'The link opens that bid\'s robot needs sheet on the Bid Board. The ask sits with the blocking gaps, with Edit bid and Copy intake address beside it and the robot\'s taps underneath: ★ Attached — rerun, Use what is on the bid, Skip this bid.',
    'The amber robot icon lands on your bid even though the robot asked from its own practice copy, and its tooltip says what it needs. Every other question on the needs sheet now has tap answers too.',
  ],
}

export default note
