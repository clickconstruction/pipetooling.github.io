import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3166',
  date: '2026-09-08',
  title: 'Supply Houses opens with a Directory',
  kind: 'feature',
  highlights: [
    'Materials → Supply Houses now leads with a Directory: every vendor with its reps (the starred one is who a price request goes to), phone, website and how many parts it has priced. The invoices, aging and balances you had before sit right below it as Accounts payable.',
    'Above the list, a coverage line says how many houses have a rep and how many still need one — and the ones that need one sit together at the bottom under their own band, so adding a rep is one tap away.',
    'Expand a house to add or star reps in place, read its notes, and see its last three price requests: which bid, who sent it, and whether the vendor answered. Hover a rep to see who added it.',
    'On a phone the Directory is cards with big call and email buttons.',
  ],
}

export default note
