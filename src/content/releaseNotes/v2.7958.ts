import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7958',
  date: '2026-11-19',
  title: 'Robots: an assistant can ask the pricing robot to price a bid',
  kind: 'infra',
  highlights: [
    'A developer’s assistant can now put a bid on the pricing robot’s queue, as Price it with the robot on Bids → Pricing does.',
    'It reads the counted rows and the quote links off the bid itself, and says which supply houses are skipped because nothing is linked yet.',
    'It warns when no pricing robot has a key, so the ask would only wait.',
    'It can take the ask back while it is still queued. Nothing is emailed and no cost or bid is changed.',
  ],
}

export default note
