import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6434',
  date: '2026-11-03',
  title: 'A header search that cannot reach the server says so',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'helpers', 'subcontractor'],
  highlights: [
    'When a read of jobs, bids, estimates or customers fails, the search box says which kinds were not searched and why. Before, it said No matches.',
    'The kinds that did answer still show their rows, and pages, settings and guides always answer.',
    'With no signal, Retry runs the search again, and it runs by itself when the signal is back. A refusal shows its reason and no Retry.',
    'No matches appears only when every kind answered and none had a match.',
  ],
}

export default note
