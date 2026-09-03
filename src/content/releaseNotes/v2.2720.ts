import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2720',
  date: '2026-09-03',
  title: 'Pricing: older bids open on the book that actually holds their prices',
  kind: 'fix',
  highlights: [
    'A bid priced straight on a shared price book (before bids kept their own copy, spring 2026) opens on that book again — its assigned entries and typed prices show instead of "$0 · assign…".',
    'Before, such a bid opened on whichever book you last picked for new bids, so a bid priced on Default looked empty to anyone whose default was WENDI. About 200 bids from that era were affected; none lost data.',
    'Your default book for new bids is unchanged. Bids with their own price copy are untouched.',
  ],
}

export default note
