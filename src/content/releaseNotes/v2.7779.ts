import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7779',
  date: '2026-11-18',
  title: 'Lien desk: the Ready to file bin no longer says what the print comes with, unless someone changed it',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The line Prints with the help sheet and the notice records is gone from the Board. Its Change press opened the affidavits list on a job, with nothing pointing at the setting.',
    'The print itself is the same. The help sheet and the notice records still print in front of the affidavits.',
    'If someone turned one of those pages off on this computer, or added the copies of the notices, the bin says so, like Prints without the help sheet.',
    'That line has one press, like Put it back. It sets the usual pages again right there, and you stay on To do.',
  ],
}

export default note
