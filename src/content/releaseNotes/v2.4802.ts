import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4802',
  date: '2026-10-07',
  title: 'Map: pins by status, chips as the key and the switches, Cluster',
  kind: 'feature',
  highlights: [
    'A pin on the Map page means what the row\'s dot means elsewhere: a job takes its Pipeline section\'s color and a red ring in Collections, a bid its Bid Board section\'s color and the due ring, an estimate is violet.',
    'The chips over the map are the key and the switches, each with its count of placed records. Paid, Lost and Estimates start off, so the live work is what you see first.',
    'Cluster groups pins that overlap at the current zoom into count discs, remembered on that device. A disc wears the most urgent ring any pin inside it has.',
  ],
}

export default note
