import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4954',
  date: '2026-10-08',
  title: 'Bids: Put back sets a value back to what it was',
  kind: 'feature',
  highlights: [
    'In a bid’s History, each changed value has a Put back button. Press it to set the value back to what it was before that change.',
    'The tab you are on shows the old value again, and History lists your put back, so it can be put back too.',
    'Anyone who can edit the bid can put a value back. A removed row cannot come back from here yet.',
  ],
  roles: ['estimator', 'master_technician', 'assistant', 'controller', 'primary', 'dev'],
}

export default note
