import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6470',
  date: '2026-11-03',
  title: 'The Job Summary cost print lists only the card charges its total counts',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'When a Job Summary row had not loaded its card charges yet, its cost breakdown print read them on its own and listed Internal Transfers too. The card charges total leaves those out.',
    'The print now reads them the way the open row does. Its card lines add up to the card charges total, and an Internal Transfer no longer shows as anyone’s card charges in the Person summary.',
  ],
}

export default note
