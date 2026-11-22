import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8253',
  date: '2026-11-21',
  title: 'Document builder: the ground for checking a certificate against a job’s sheet',
  kind: 'fix',
  highlights: [
    'Nothing changes on any screen yet. This is the database half of the certificate check, which comes next.',
    'A trade’s certificate can now keep the job it was checked for, and the lines of that job’s insurance sheet it was checked against.',
    'A certificate checked for one job is never moved to another. A second job takes a second certificate.',
  ],
}

export default note
