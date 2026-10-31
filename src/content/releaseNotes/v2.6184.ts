import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6184',
  date: '2026-10-30',
  title: 'Legal desk: the Contract with cell reads the signer’s name and the payer’s city cleanly',
  kind: 'fix',
  highlights: [
    'When a signer’s printed name was typed with its signing mode after it, such as “Sam Owner electronically”, the Contract with cell read the mode as part of the name. It reads the name alone now.',
    'When a payer’s address has a suite typed before the city with no comma between them, the cell read the suite as part of the city. It reads the city now.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
