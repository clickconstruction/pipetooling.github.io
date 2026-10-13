import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5500',
  date: '2026-10-13',
  title: 'Dashboard: the Customers line counts the customers waiting in New',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'To sort on the Customers line now counts the customers waiting in New, the same number Messages shows with Customers picked.',
    'A sender nobody has named is no longer counted there. They wait in New under All.',
  ],
}

export default note
