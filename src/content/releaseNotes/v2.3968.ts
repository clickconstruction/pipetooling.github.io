import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3968',
  date: '2026-09-28',
  title: 'Bid room: the proposal the GC signs shows the same Terms and Exclusions as the printed letter',
  kind: 'fix',
  highlights: [
    'When no company default was saved and nobody had typed Terms or Exclusions for the bid, the printed letter showed the standard wording but the bid room showed neither block. The room now carries the wording the letter prints.',
    'The same goes for a box that was emptied: the letter falls back to the standard wording, and now the room does too.',
    'A room that is already published keeps what it was published with. Press Publish update on the Cover Letter to give the GC the wording.',
    'The email that carries the room link reads how long pricing is good for out of the Terms, so it now says so on bids where the Terms used to go out blank.',
  ],
}

export default note
