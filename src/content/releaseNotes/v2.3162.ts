import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3162',
  date: '2026-09-08',
  title: 'Bids on a map, on the Bid Board',
  kind: 'feature',
  highlights: [
    'The Bid Board has a new Bids on a map card above the sections: one pin per bid, colored by section, with the office and its 25 and 50 mile rings so distance reads at a glance.',
    'The map follows the board — the search box, the trade pill and My bids all change the pins. Click a pin to see the bid, open it, edit it or get directions; its row lights up below.',
    'An unsent bid due this week wears an amber ring, red once it is past due. Tap a section chip to show or hide those pins; Lost starts hidden.',
    'Hide map collapses the card to its title line and remembers that on your device. The new Map pill in the section row brings it back.',
  ],
}

export default note
