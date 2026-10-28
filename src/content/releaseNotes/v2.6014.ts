import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6014',
  date: '2026-10-28',
  title: 'Job Mode names the job’s number when the number is a Click number',
  kind: 'fix',
  highlights: [
    'The Job Mode card hands Leave report, Turnaway and % done the job’s number. On a job numbered by its Click number those windows showed a dash where the number belongs, and a Turnaway reached the Dispatch inbox titled “Turnaway: — <job name> — Site not ready”. They now carry the Click number, as the card’s own header and New report’s job search already do.',
    'A job with neither number still reads a dash.',
  ],
}

export default note
