import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3396',
  date: '2026-09-14',
  title: 'Jobs on a map, at the top of the Pipeline',
  kind: 'feature',
  highlights: [
    'Jobs → Pipeline now opens with the same map card the Bid Board has: one pin per job, colored by its Pipeline section in the row colors you already know, with the office diamond and its 25 and 50 mile rings. A job in Collections wears a red ring.',
    'The map follows the board: the search box and the GC, development, Account Man and contract filters change the pins. Click a pin for the job’s card — who the bills go to, the section and percent, the address and miles from the office, what is still owed — with Open job, Edit and Directions. The pin click lights the row below and scrolls to it.',
    'Chips next to the title hide or show each section on the map only. Paid starts hidden; its first tap loads the paid jobs. Cluster, Fit all and Hide map work as on the Bid Board and remember your choice on this device.',
  ],
}

export default note
