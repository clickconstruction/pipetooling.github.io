import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6647',
  date: '2026-11-07',
  title: 'Messages: a known contractor’s new invitation asks Bid it? instead of landing on their old bid',
  kind: 'fix',
  highlights: [
    'When a general contractor we already bid for emails a new invitation to bid or a solicitation, the email no longer files itself under their starred bid. It sits on them, and the New lane asks Bid it? with Start a bid on that contractor ready.',
    'An addendum or a pre-bid notice from them still lands on their starred bid, since those are about a bid already open.',
    'A subject that names a job number or a live bid still wins. Only the fallback to the starred job changed.',
    'An email whose subject says Bid Request now reads as an invitation to bid, not as an addendum the body mentions in passing.',
  ],
}

export default note
