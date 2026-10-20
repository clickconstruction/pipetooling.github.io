import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5235',
  date: '2026-10-11',
  title: 'The Bridge: Market and Sales read from the bids and estimates (link PR 4)',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'The Market card counts the asks that came in over the window: bids invited and estimates requested, by value, and reads whether demand is short of what the field builds.',
    'The Sales card shows sent, won and lost for bids and estimates on their own lines, what awaits an answer from the last 90 days, and what was sold a week against what the field builds.',
    'Won counts the bids marked won and the bids that became jobs, so a win with no date still counts.',
  ],
}

export default note
