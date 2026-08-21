import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2002',
  date: '2026-08-21',
  title: 'Customer profile: bids, projects, and estimates you can read',
  kind: 'feature',
  highlights: [
    'Bids in the customer profile stop being a wall of numbered pills: a summary line ("44 total · 9 won · 11 lost · 24 undecided") and two-line rows with the bid value, the address, and a clock — "due in 3d", "sent 22d ago · undecided", or "won · Jun 12" — sorted so the ones to chase come first.',
    'Projects show their full name, current step, and who\'s on it (with a flag when the step is stuck); estimates show their status and dollar amount.',
  ],
}

export default note
