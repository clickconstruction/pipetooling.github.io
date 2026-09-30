import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4213',
  date: '2026-09-29',
  title: 'Assign work: the busy bars say which job',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'In Assign work, each blue bar on a person’s day now reads the job number, the customer (first two words of the name) and the job’s town — “J568 · Diamondback Homes · Neeses” — so you can see what they are on without the long press.',
    'A bar too narrow for the words clips them; hover it for the job name and address, or long-press the row for the full day as before.',
  ],
}

export default note
