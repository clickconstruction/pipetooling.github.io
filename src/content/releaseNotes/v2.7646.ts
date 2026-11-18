import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7646',
  date: '2026-11-17',
  title: 'Papers before a job opens: the office picks a job’s papers and sees who has signed',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'A job’s Documents tab has a new section, Papers before this job opens. Pick papers from the Contract Book and save.',
    'The save button names how many papers it requires. The line under it counts the people it reaches, you included.',
    'A table shows each person against each paper. Copy the signing link puts a person’s links on your clipboard to text them.',
    'The job does not lock yet. That arrives with the next updates, and signatures collected now will count.',
  ],
}

export default note
