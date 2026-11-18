import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7699',
  date: '2026-11-17',
  title: 'Lien desk: a wrong mailed copy taken off goes to Drive’s trash, and you can put it back',
  kind: 'feature',
  highlights: [
    'Take off on a mailed copy used to leave the wrong file in the job’s Drive folder. It now moves the file to Drive’s trash, where Drive keeps it 30 days.',
    'A line under the row says where the file is now. Put it back brings the file out of the trash and lists it on the notice again.',
    'A file that a recorded mailing still uses is never trashed. The line says it stays, and why.',
    'When Drive is busy the take-off still stands, and Try again sends the file to the trash again.',
  ],
}

export default note
