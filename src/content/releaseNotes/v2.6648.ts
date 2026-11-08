import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6648',
  date: '2026-11-07',
  title: 'The lien month across the top of the Lien desk',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Do now opens under a bar of five zones, each as wide as its days: Reminders on days 1 to 5, Notices on 6 to 9, Liens on 10 to 13, Catch-up on the 14th and 15th, and Nothing scheduled from the 16th. Today is marked.',
    'Each zone reads what is left and what went, like 12 to send · 4 sent. A zone behind reads green with a tick when everything went, or red with the count that slipped and the first job’s name. What slipped carries into Catch-up.',
    'Press a zone and the list shows only that zone’s rows, with a Show all to put it back. On a phone the zones stack as rows and the one today falls in says so.',
    'The bar sends, files and moves nothing. The policy is the owner’s; the desk only reads it back every morning.',
  ],
}

export default note
