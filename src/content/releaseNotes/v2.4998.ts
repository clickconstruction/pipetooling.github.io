import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4998',
  date: '2026-10-08',
  title: 'GC projects: email the pay application to the customer and the architect',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'Bill the customer has a new tick, Email it to the customer and the architect now. It starts off.',
    'With it on, Send emails the customer the pay application and asks the architect to certify it. Both get the form as a PDF.',
    'The emails come from Click Construction, and replies go to the project manager. A copy of each is kept on the billing job’s Documents tab.',
    'Each sent bill says who it was emailed to and when.',
  ],
}

export default note
