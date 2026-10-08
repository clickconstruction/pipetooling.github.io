import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4876',
  date: '2026-10-07',
  title: 'Contracts: a paper shows the day it was signed, with no made-up time',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'A paper filed with its Signed on date now reads Signed on paper by Michael Palmer and Grace Palmer on Sep 30, 2026. Before, it said recorded Sep 30, 2026, 7:00 AM CT, a time nobody recorded.',
    'The green banner in the Contract window and the printed copy show that day alone too.',
    'A paper filed without a Signed on date still says when the office recorded it, with the time.',
  ],
}

export default note
