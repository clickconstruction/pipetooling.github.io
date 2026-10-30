import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6165',
  date: '2026-10-30',
  title: 'The Bid Board’s search is back on a phone',
  kind: 'fix',
  highlights: [
    'On a phone the Bid Board’s search box now takes a whole line of its own. Before, it was squeezed to 18 pixels beside the buttons, too narrow for one letter, so there was no search to use.',
    'The development filter and the Marked, Archived, Reply book and Customer review buttons sit on the line under it. On a desk nothing moves.',
    'The box says what it finds: a project name, a GC, a bid number or an address.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent'],
}

export default note
