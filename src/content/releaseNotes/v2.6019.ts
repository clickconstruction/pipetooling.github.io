import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6019',
  date: '2026-10-28',
  title: 'A bid can be in a development, like a job',
  kind: 'feature',
  highlights: [
    'Edit Bid gains a Development picker beside Project, the same list and + New development as Edit Job. It saves as you pick. The Bid window shows the development under the bid number, and the Bid Board row shows it under the GC.',
    'The Bid Board search finds bids by their development’s name, and once any bid has one a house filter sits beside the search, with No development set for the bids still needing one.',
    'New Job from a won bid carries the development over with the customer and the address, so the job is in it without a second pick.',
    'A saved bid or job with no development, at an address other members of one development share, gets one line on its Edit form: 4 bids and 6 jobs at this address are in Harlow Ranch, with Put it in Harlow Ranch.',
  ],
}

export default note
