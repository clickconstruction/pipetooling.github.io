import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5902',
  date: '2026-10-26',
  title: 'The search box opens a page, a tab, a window or a Settings card by name',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Type a word in the header search and the pages, tabs, windows and Settings cards that match list under your jobs, three a kind, with N more to see a kind whole. Office hours lands on the card, Legal desk opens the Collections desk, Billing opens the tab.',
    'Nothing above the first job moves. A number alone still searches jobs, bids, estimates and customers only, and the first row is lit, so Enter alone opens the best match.',
    'You only see doors your role can open. An assistant never sees the Punch list or the signing code card.',
    'On a desk, Tab jumps to the next group and a > first shows places alone. Open the box with nothing typed and Recent lists the last doors you opened on this device.',
  ],
}

export default note
