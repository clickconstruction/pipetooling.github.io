import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5003',
  date: '2026-10-08',
  title: 'GC projects: bill the customer for interest on late bills',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'Once interest builds up on a job that charges it, Bill the customer shows Bill the interest with the amount.',
    'The interest bill goes on the billing job with the customer’s other bills. Tick Email the customer the bill now to email it to them.',
    'Each interest bill shows its day, its amount, whether it is paid and who it was emailed to.',
  ],
}

export default note
