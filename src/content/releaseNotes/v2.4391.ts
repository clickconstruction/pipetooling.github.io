import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4391',
  date: '2026-10-02',
  title: 'Materials: see what your materials cost now, against February',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent'],
  highlights: [
    'Materials → Parts Book opens with a card that says how the prices of the parts you bid with moved since February.',
    'Each part counts by what you spend on it in your takeoffs. A fixed typo or a $999,999 stand-in never counts.',
    'A bar shows how fresh the prices are. When too few were checked lately, the card says so instead of showing a number.',
    'The card lists the newest price changes and how many open bids use each part.',
  ],
}

export default note
