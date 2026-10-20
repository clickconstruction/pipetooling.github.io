import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5578',
  date: '2026-10-16',
  title: 'Prospects: a refreshed lane shows its own deck',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Opening Jobs to GC or Subs from a bookmark, a refresh or a Calendar link now shows that lane’s own queue. Before, the Customers deck could appear under the lane’s tab wearing the lane’s last press.',
    'While a lane’s first load is still coming, the deck says Loading Subs… instead of showing another lane’s card.',
  ],
}

export default note
