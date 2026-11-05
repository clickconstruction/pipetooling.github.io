import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6525',
  date: '2026-11-04',
  title: '+ Hire finds a teammate who left and offers Bring back',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Typing the name or the email of someone who left stops the Hire form with an amber line: who they are and the day they left, with Bring back and This is someone else. Bring back opens their desk with the window up, so their hours, logbook and HR file stay on one account.',
    'A match on the old email under a new name counts too. After This is someone else the form goes on, but an exact archived name is still refused on the Hire press, since pay is keyed by name.',
  ],
}

export default note
