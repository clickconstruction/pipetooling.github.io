import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5774',
  date: '2026-10-23',
  title: 'Quickfill: Fill them in, a deck that clears lost bids one at a time',
  kind: 'feature',
  roles: ['assistant', 'controller', 'master_technician', 'dev'],
  highlights: [
    'Quickfill’s Needs you station has a third view beside Cards and Walk the list: Fill them in. It walks the lost bids with no reason one at a time, biggest first, with what the app already knows about each.',
    'Tap a reason, add what they said and who you talked to, press Save and next. A note suggests the reason until you tap one. With a name, the call lands on the bid’s contact log too.',
    'Skip sends a bid to the back. Saved bids collect under the card with Undo. The end counts what was saved and offers the station’s Mark.',
    'The lost-bids line’s button now reads Fill them in and opens the deck on those rows. Vehicles, job accounts and contracts follow in the next releases.',
  ],
}

export default note
