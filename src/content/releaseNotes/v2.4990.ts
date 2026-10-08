import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4990',
  date: '2026-10-08',
  title: 'GC mode: our pay application to the customer as a file',
  kind: 'infra',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'A GC job’s pay application to its customer can be made as the AIA G702 and G703 in Excel, and as a PDF.',
    'It goes to the customer, the architect certifies it, the property’s owner shows when that is someone else, and the notary block waits for a wet signature.',
    'The Pipeline’s own AIA form prints as before. Nothing on screen makes these files yet: Bill the customer comes next.',
  ],
}

export default note
