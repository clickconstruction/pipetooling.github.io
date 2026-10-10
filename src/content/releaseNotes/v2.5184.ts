import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5184',
  date: '2026-10-10',
  title: 'GC projects: the groundwork for telling a customer a bill is due in 3 days',
  kind: 'infra',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'The app can now work out which customers have a certified bill due in 3 days, on the same due day Bill the customer shows.',
    'Nothing is sent yet. The email and its switch come next, and the owner turns it on after a test copy.',
  ],
}

export default note
