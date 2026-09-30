import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4252',
  date: '2026-09-30',
  title: 'A contract or a lien release does not go out with a half-typed date',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'primary', 'controller', 'estimator'],
  highlights: [
    'A job contract is not sent, copied as a link, handed over on paper, emailed as a PDF or filed as signed while its start or completion date is half typed. A year typed as two digits, like 26, used to go to the customer as the year 0026.',
    'A lien release is not issued while its through or signature date is half typed: Mark issued, Print for signature, Download PDF and Request signature all wait. An issued release is locked, so a wrong year could not be fixed afterwards.',
    'Filing a signed contract waits for a finished “Signed on” date too.',
    'Each of these names the date to finish, for example: Finish the “Start” date before this goes out. Type the year in full, like 2026.',
  ],
}

export default note
