import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5625',
  date: '2026-10-18',
  title: 'Training: the app’s own description of the database now knows a course can be offered',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Nothing changes on screen. The Training work of 2026-10-18 gave each course an offered switch on the server, and the app’s generated description of the database now carries it, so code that reads or saves the switch is checked when the app is built.',
    'Both of that day’s Training database changes were confirmed applied on the live database before the description was regenerated.',
  ],
}

export default note
