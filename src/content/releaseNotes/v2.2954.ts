import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2954',
  date: '2026-09-06',
  title: 'Security: job and bid lookups no longer answer without a sign-in',
  kind: 'fix',
  highlights: [
    'An audit found that 28 database lookups — job searches, the paid-jobs list with revenue and payments, bid searches, customer hours, the roster names — would answer anyone holding the app\'s public key, no sign-in needed. They now require a signed-in session.',
    'Nothing changes for you when signed in: Clock In, header search, Dashboard billing, People, Materials and Tally work exactly as before.',
    'Four unused database writers that could bypass row security were closed to all app users as well.',
  ],
}

export default note
