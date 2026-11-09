import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6818',
  date: '2026-11-09',
  title: 'A ticket meets its charge: the office sees the ticket on the charge and sorts with its job first',
  kind: 'feature',
  highlights: [
    'A ticket taken at the counter now finds its card charge by itself when exactly one swipe on that card sits in the half hour before the photo. Two swipes that fit are never guessed between: a typed total decides, or a person does.',
    'On the Team queue a charge with a ticket wears a green Ticket chip that names the job, and that job is the first choice when the office sorts the day. Press the chip to see the ticket.',
    'When one charge fits loosely, the charge line asks Is it this charge, with It is and It is not. The tech sees the same question on My tickets and can answer it there.',
    'A new Tickets tab on the Team queue holds every ticket that is not sitting on its charge: one with no charge yet, one on a PO code, one with no job, one for no one job, and one whose job disagrees with where the office sent its charge. Nothing changes behind the office’s back.',
  ],
}

export default note
