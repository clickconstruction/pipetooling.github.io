import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5677',
  date: '2026-10-20',
  title: 'The move window: a charge moves onto a job account only while it is current',
  kind: 'feature',
  roles: ['assistant', 'controller', 'master_technician', 'dev'],
  highlights: [
    'A teal strip above the aging table counts the still-current charges not yet on a job account, with the soonest window to close — Work the list opens them by house with the job-accounts rep to call.',
    'A current charge’s + Job acct chip opens the move window: tick “I called the house — this charge was moved” to mark it moved, or send the request to the rep by email from the app, with replies to you.',
    'A sent ask reads “asked · follow up ☎” on the row until the call confirms it — amber after 3 days, red after 7 — and Email the list asks a house for all of its movable charges in one send.',
    'Past-due rows say plainly that their window has closed; recording a flag the house already carries is never blocked.',
  ],
}

export default note
