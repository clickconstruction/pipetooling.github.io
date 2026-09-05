import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2872',
  date: '2026-09-05',
  title: 'Work orders: every small chip speaks the rail\'s words',
  kind: 'fix',
  highlights: [
    'The sheet\'s Work order box (Edit a Sub Labor sheet) now draws the same seven-dot rail as Jobs → Work Orders and Sub Labor — Drafted · Sent · Signed, then Work · Walk-through · Customer pays · Paid — instead of its own segmented bar.',
    'The job window\'s Sub work order chip and strip, the Person Desk\'s Work orders list, and the dashboard\'s Needs You card use the same words as the board: No agreement, Drafted · no price yet, Sent · awaiting signature, Signed, Declined. The job window\'s buttons read Price… and Send…, like the board\'s Next column.',
  ],
}

export default note
