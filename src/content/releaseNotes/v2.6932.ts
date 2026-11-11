import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6932',
  date: '2026-11-11',
  title: 'Lien affidavit: it holds while the general contractor has no address on file',
  kind: 'feature',
  highlights: [
    'On a job with a GC, the affidavit gives the GC’s last known address. An affidavit now waits in Needs the property facts until that address is on the GC’s customer record.',
    'The gate list on the Affidavits pane says so and offers Add the address, which opens the GC’s record. The Lien window’s Mechanic’s lien tab shows the same line and draws no paper until it clears.',
    'Nothing is held today: every GC on the Lien desk has an address. A job contracted with the owner is not affected.',
  ],
}

export default note
