import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5789',
  date: '2026-10-23',
  title: 'Quickfill: the Percent complete station is back on the page',
  kind: 'fix',
  highlights: [
    'The Percent complete station is back on Quickfill, after Property kinds, with its count in the header, its square in the jump grid and its stop in the phone round. It lists every open job whose ticked stages or paid money disagree with its % done, as it did when it shipped in v2.5764.',
    'Nothing about the station changed. Save still writes the way the Pipeline’s % done box does, with the same activity note on the job, and Dismiss for one week still hides a card for the whole office with Undo on the line it leaves.',
    'A change that landed later the same day carried an older copy of the Quickfill page and dropped the station’s lines from it. The station, its help guide and its banner question were never lost, only the page’s way to draw it.',
  ],
}

export default note
