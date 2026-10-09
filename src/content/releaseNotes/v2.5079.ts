import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5079',
  date: '2026-10-09',
  title: 'Bids: History puts back a removed row, with what hung on it',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary'],
  highlights: [
    'Anyone who can edit a bid now sees the rows removed from it in History, including rows removed before History began.',
    'Each removed row has Put back. A count row comes back with its price and part lines, and History records the put back as yours.',
    'A price whose count row is still removed waits for that count row’s Put back, and History says so.',
    'A margin brush stroke and a price book switch each read as one change in History.',
  ],
}

export default note
