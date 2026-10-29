import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6055',
  date: '2026-10-29',
  title: 'Materials on site: a job with a Drive folder can still get its missing pictures or plans folder',
  kind: 'fix',
  highlights: [
    'The job window’s Documents tab offers Make the job’s Drive folders when the job has a folder but no pictures or plans link. The press fills in what is missing inside the job’s folder and puts the links on the job.',
    'A job with all three links shows no press.',
  ],
}

export default note
