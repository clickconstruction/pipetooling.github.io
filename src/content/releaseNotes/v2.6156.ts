import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6156',
  date: '2026-10-30',
  title: 'Bill Customer’s RTB as the row’s bar and three rows, a prototype behind a switch (punch list #217)',
  kind: 'feature',
  highlights: [
    'Bill Customer has a Show the bars switch beside its title. With it on, the Pipeline row’s money bar sits under the header: paid in green, open bills in blue, this bill as the next segment, the bid as the frame.',
    'Under the bar the sum reads as rows: Bid, less paid with its payment count, less open bills with their count, equals this bill. Open bills unfold to each bill with its day and age.',
    'Each part has a door: the bid to the Edit tab, the payments to Payments received, each bill to Edit Job, every one in a new tab so the window stays.',
    'The switch is off by default and yours alone, remembered on this device. The RTB figure and every send are unchanged.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary'],
}

export default note
