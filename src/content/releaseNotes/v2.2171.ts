import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2171',
  date: '2026-08-23',
  title: 'Builder hit rates and Why we lost count each GC, not the bid',
  kind: 'feature',
  highlights: [
    'A bid won with one GC and lost with another is now a win in that builder\'s numbers and a loss in the other\'s — Call queue, By builder, the bid map and the call session all read each GC\'s packet. Single-GC bids count exactly as before.',
    'Mark one GC won and the other GCs you sent to are marked lost · "GC lost the project" for you (tagged auto in Why we lost — tap a different reason any time).',
    'Why we lost triages each GC\'s loss: the card shows which GC this is, its ★ price and what the other GCs did, and the reason you tap is that GC\'s. Waiting to hear drops a GC that has answered and keeps the rest.',
  ],
}

export default note
