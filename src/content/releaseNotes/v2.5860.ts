import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5860',
  date: '2026-10-25',
  title: 'A written-down bill trims its fees with it',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary'],
  highlights: [
    'A fee that rides on a bill — a trip charge, a returned check fee, a card fee — now counts no more than the bill’s amount.',
    'Before, writing a trip charge’s bill down to an agreed amount left the full charge in the job’s total at the next money edit.',
    'A bill that still covers its fees reads exactly as before.',
  ],
}

export default note
