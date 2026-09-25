import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3824',
  date: '2026-09-25',
  title: 'Show a property owner their bills when the GC pays',
  kind: 'feature',
  highlights: [
    'On a job billed to the GC whose customer is the property owner, the owner’s portal showed $0 and “all paid up” while the GC owed on their house. A chip beside the owner’s portal globe on the Pipeline row now says so: “owner sees $0”.',
    'Click it to show the owner every open bill at that property — every job there with the same owner, at once — for their records: no Pay button, never in their balance, and every bill after. Click again to stop.',
    'The owner’s portal window lists the same, one line per property, with the same switch, and its live preview re-reads when you flip it.',
  ],
}

export default note
