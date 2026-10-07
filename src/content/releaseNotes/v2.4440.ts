import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4440',
  date: '2026-10-02',
  title: 'Held for suppliers: catch a paid job a supply house can still notice',
  kind: 'feature',
  highlights: [
    'A new filter, Paid, house can still notice, lists jobs where the customer paid in full and a supply house that is still owed can still send its own lien notice. The soonest date comes first.',
    'Open a job to see each house’s own notice date. It is our estimate until the house tells you.',
    'Press They told us… on a house to record its balance and the day its notice goes out. The Lien desk shows the same words.',
    'The help guide for this tab is rewritten in plain words.',
  ],
}

export default note
