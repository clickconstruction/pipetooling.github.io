import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3209',
  date: '2026-09-09',
  title: 'The bid map, tightened',
  kind: 'feature',
  highlights: [
    'The Bids on a map card is about a third shorter and says a lot more. The map sits on the left, framed on the 50-mile ring instead of half the state; Fit all still shows every pin.',
    'Beside it, a rail of what the map knows: three distance buckets from the office (how many bids, their total value, how many are due soon) that also switch pins on and off; the unsent bids with a due date, overdue first then nearest first, one tap to jump to the pin and the row; the pinned total; and the “no map location” door.',
    'The instruction sentence under the map is gone (hover the title if you need it), Fit all and Hide map are plain links, and the map sits in one frame instead of a frame inside a frame.',
  ],
}

export default note
