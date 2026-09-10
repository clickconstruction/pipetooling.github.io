import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3213',
  date: '2026-09-09',
  title: 'Cluster the bid map’s piles',
  kind: 'feature',
  highlights: [
    'A new Cluster link beside Fit all on the Bid Board map groups pins that overlap at the current zoom into one disc with a count. Click a disc to zoom to its bids; zoom in and the piles break back into pins on their own.',
    'A disc takes the color of the section most of its bids are in, and wears a red or amber ring when any bid inside is overdue or due soon, so urgency doesn’t hide in a pile.',
    'It’s off unless you turn it on, and the choice is remembered on that device. Section chips, the distance boxes and Play all keep working while clustered.',
    'The trade name at the front of the Bid Board’s pill row is now plain text — “Plumbing:” — instead of a dashed bubble.',
  ],
}

export default note
