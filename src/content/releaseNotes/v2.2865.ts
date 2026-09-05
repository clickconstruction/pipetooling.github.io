import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2865',
  date: '2026-09-05',
  title: 'Work Orders: "Needs a work order" reads the sheets, not a paid stamp',
  kind: 'fix',
  highlights: [
    'The list at the top of Jobs → Work Orders now counts a Sub Labor sheet only when money is still open on it (items minus payments) or it was never priced. Paid-up sheets no longer show as needing an order — job 892\'s three paid sheets are gone from the list.',
    'Sheets whose job number has no Pipeline row now appear too, labelled by the sheet\'s own job number and address with a "not in Pipeline" tag — 977 Springtown\'s $40,000 sheet was invisible before.',
    'Crew pay sheets (a sheet with a superintendent, master or helper on it) never need a work order and are left out. Each row shows the open amount, and "Draft a work order…" opens the assembler on that sheet with the sheet total as the price.',
  ],
}

export default note
