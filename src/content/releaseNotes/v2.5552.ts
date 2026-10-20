import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5552',
  date: '2026-10-15',
  title: 'Messages: a teammate’s thread opens, and their text counts on Follow up',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'After naming a number as one of our own team, the thread said the person was not in Messages, and their text was missing from Follow up. Messages left the new kind of person out of its list.',
    'The thread opens now, the Our team pill lists them, and a teammate’s text waits on Follow up like anyone’s.',
  ],
}

export default note
