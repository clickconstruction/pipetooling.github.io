import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7926',
  date: '2026-11-19',
  title: 'A primary reads the test papers of their own jobs',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary'],
  highlights: [
    'A job’s test paper and its PDF were open to every primary, on any job. No screen listed them, but the database answered.',
    'Now a primary reads a test paper only on a job where they are the account manager.',
    'The office reads and writes test papers as before.',
  ],
}

export default note
