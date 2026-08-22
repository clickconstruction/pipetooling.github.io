import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2076',
  date: '2026-08-22',
  title: 'My Team: approvals first, Approve all, long-day flags',
  kind: 'feature',
  highlights: [
    'The crew-lead My Team section now leads with what needs you: an amber "7 to approve" chip on the header and the pending list right up top, with a one-tap "Approve all 7 · 46.4h" button.',
    'Each Approve button states the hours it signs off on, and any session over 12 hours wears a ⚠ long day tag so a forgotten clock-out gets a second look.',
    'The week is one row (‹ This week · Aug 16–22 › — tap the label for exact dates), each person is a one-line summary instead of a table that ran off the screen, and the bell next to their name toggles clock in/out notifications.',
  ],
}

export default note
