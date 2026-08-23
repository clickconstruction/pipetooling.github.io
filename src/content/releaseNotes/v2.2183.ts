import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2183',
  date: '2026-08-23',
  title: 'Bid Board: a multi-GC bid lists its GCs in the GC cell',
  kind: 'fix',
  highlights: [
    'No more extra rows under the bid: a bid sent to several GCs lists each GC inside its GC/Builder cell — name · sent m/d · a small state pill (waiting / won / lost). The row is exactly as tall as its GC list.',
    'The pill is the control: tap it and the three choices pop beside it. The old dropdown and the "+1 GC" chip are gone on those bids.',
    'Same lines on the phone card and in Followup → Full bid details.',
  ],
}

export default note
