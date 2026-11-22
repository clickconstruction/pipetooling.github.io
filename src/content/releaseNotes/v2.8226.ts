import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8226',
  date: '2026-11-21',
  title: 'Punch list: see who is working on a card',
  kind: 'feature',
  highlights: [
    'A tick on a punch list card is now a claim. Everyone who opens the board sees your name on the card, and how long ago the last update was.',
    'A claim goes quiet after 12 hours with no update. The card then reads as free to pick up, with who had it.',
    'An update is a tick, a press on Still on it, or a change to the card’s file. Your own tick stays when your claim goes quiet, with Still on it beside it.',
    'Two people can tick the same card, and the card names both. A card that moves to another section still loses its ticks.',
  ],
}

export default note
