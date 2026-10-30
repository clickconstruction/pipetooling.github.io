import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6111',
  date: '2026-10-29',
  title: 'Other job charges keep their identity when a job is saved',
  kind: 'fix',
  highlights: [
    'Editing a job’s Other job charges no longer rewrites every row. Each charge is updated in place and keeps the id and the created date it had, and only a charge you removed is deleted.',
    'A charge written by a cost batch can therefore still be reverted after the job has been edited; until now one edit of the charges put the batch’s row beyond its revert.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
