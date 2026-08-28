import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2411',
  date: '2026-08-27',
  title: 'Bid Board: "sent 1/2" on multi-GC bids',
  kind: 'feature',
  highlights: [
    'A bid going to more than one GC now wears a small pill under its name on the Bid Board — amber "sent 1/2" while a GC\'s letter is still out, green "sent 2/2 ✓" once every packet went.',
    'Hover it for the plain-English version ("1 of 2 GC letters not sent yet"). Single-GC bids and bids with nothing sent yet stay clean — no badge noise.',
  ],
}

export default note
