import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6158',
  date: '2026-10-30',
  title: 'The interest bill shows each late bill as a row (punch list #217, outside-5)',
  kind: 'feature',
  highlights: [
    'Our email billing a GC customer for interest now lists each late bill: the day it fell due, the day they paid it or open, the days late, what was open, and the arithmetic behind its interest, with the total under a rule.',
    'The reminder to pay a late bill shows the same one-row table for its bill under its interest line.',
    'Settings → What customers see shows both emails with their rows on the sample job.',
  ],
  roles: ['dev', 'master_technician', 'controller'],
}

export default note
