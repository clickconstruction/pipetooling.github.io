import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7936',
  date: '2026-11-19',
  title: 'A primary reads the photos of the jobs they have a claim on',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary'],
  highlights: [
    'A job’s photo notes, its first look and its Drive photos were open to every primary in the database. No list on a primary’s screens showed them.',
    'Now a primary reads them on a job where they are the account manager or the superintendent, or on its crew or schedule.',
    'A primary still files a report with photos on any job, and still reads every photo they took. Everyone else reads as before.',
  ],
}

export default note
