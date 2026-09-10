import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3251',
  date: '2026-09-10',
  title: 'Bids on a map: hover a row, see its pin',
  kind: 'feature',
  highlights: [
    'On the desktop Bid Board, resting the mouse on a bid row rings that bid\'s pin on the map with a pulsing halo in its section color — the reverse of clicking a pin to light the row.',
    'If the pin is folded into a cluster, the cluster disc pulses instead. A bid hidden by a section chip, or with no address yet, shows nothing.',
  ],
}

export default note
