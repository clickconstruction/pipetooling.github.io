import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5441',
  date: '2026-10-13',
  title: 'Jobs: a customer’s name on a phone card opens their profile again',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'superintendent', 'primary'],
  highlights: [
    'On a phone, pressing a customer’s name on a Jobs card now opens their profile, as it does on a computer.',
    'A GC’s name on a card opens their timeline again too.',
  ],
}

export default note
