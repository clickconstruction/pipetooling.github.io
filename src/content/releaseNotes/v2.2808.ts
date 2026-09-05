import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2808',
  date: '2026-09-04',
  title: 'Contract library: rows that hold still',
  kind: 'fix',
  highlights: [
    'In People → Contracts → Contract library, each document row now puts the name and the buttons on the first line, with the packet, audience, and tag chips and the version date on the line below.',
    'The Send to…, Preview, View, and Edit buttons stay top-right no matter how long the name is or how many chips a document carries, so they line up down the list.',
    'The version date and "sent to N people" text follows the chips and wraps under the buttons when it needs the room.',
  ],
}

export default note
