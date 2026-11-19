import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7939',
  date: '2026-11-19',
  title: 'Robots: an assistant can change a price in the robot’s price book',
  kind: 'infra',
  highlights: [
    'A developer’s assistant can now change prices that already stand in the robot’s price book, up to twenty at a time, as the Pricing tab’s book panel does.',
    'Before anything changes it says which bids read each price live, and names any sent bids and locked robot bids among them.',
    'A reason is required, and each price before and after is kept in the assistant’s log.',
    'A price split across stages is left alone until all three stage prices are given.',
  ],
}

export default note
