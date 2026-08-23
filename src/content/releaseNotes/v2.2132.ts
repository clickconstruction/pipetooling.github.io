import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2132',
  date: '2026-08-23',
  title: 'Each bid in a package now owns its own fixture counts',
  kind: 'feature',
  highlights: [
    'Versions (the bids in a package) each have their own count list — the Counts tab shows the version picker, and every new bid to send starts with a copy of the counts it came from.',
    'Packages that already existed got one copy of the shared counts per bid, with takeoff, rough-in, and price details re-pointed — nothing was lost, and nothing is shared by accident anymore.',
    'Cover letters, the approval PDF, Share, and Documents all price each bid on its own counts. Labor and cost are still shared by the package.',
  ],
}

export default note
