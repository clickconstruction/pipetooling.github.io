import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5017',
  date: '2026-10-09',
  title: 'Pipeline map: what a job still owes counts a payment with no bill picked',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'On the Pipeline’s map, what a billed job still owes now counts a payment put on the job with no bill picked, the same way the Billed list does. The money to collect in each distance band matches the board.',
    'Capable to bill reads the same. A job whose payment with no bill picked reached a bill has nothing left to bill, so its number was already zero.',
  ],
}

export default note
