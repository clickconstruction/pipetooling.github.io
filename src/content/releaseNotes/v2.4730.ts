import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4730',
  date: '2026-10-06',
  title: 'Contracts: interest starts 45 days from the invoice date on every text',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The job service agreement said interest starts 30 days after a bill is due. The estimate and bid terms said 45 days from the invoice date. The owner, with the attorney, chose 45 days from the invoice date everywhere.',
    'The built-in agreement wording, the one used when the Contract Book has no customer document, now says 45 days from the invoice date. The office\'s Service agreement in the Book was changed to match.',
  ],
}

export default note
