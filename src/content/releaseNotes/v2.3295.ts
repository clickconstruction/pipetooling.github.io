import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3295',
  date: '2026-09-11',
  title: 'Bids → Labor: direct costs are one list with a kind',
  kind: 'feature',
  highlights: [
    'The five amber sections under Direct Costs — equipment, permits, subs, waste, other — are one list. Each row wears its kind as a chip; + Add takes a kind and adds one row; the empty state is one line instead of five headers.',
    'Driving sits at the top of the list as a computed line — crew-days, trips, miles, the rate — so you can see it next to the other direct costs; edit the hours-per-trip and $/mile boxes above to change it.',
    'Nothing moved in the database: every row still lives in the table its kind names, and the totals, prints and Pricing read the same numbers.',
  ],
}

export default note
