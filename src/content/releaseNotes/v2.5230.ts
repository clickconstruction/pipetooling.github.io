import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5230',
  date: '2026-10-10',
  title: 'GC mode: three fixes in Bill the customer from the first live walk',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'Remind them to pay always starts the Pay by day five days out, even when the bill turned late while the window was open.',
    'An email to a GC customer with no contact on their record starts with Hello, not with the first word of the company.',
    'The What they said box asks who said it, and what.',
  ],
}

export default note
