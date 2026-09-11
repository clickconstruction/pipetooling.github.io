import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3271',
  date: '2026-09-10',
  title: 'The cost chart shows overhead: an amber band stacked on the cost line',
  kind: 'feature',
  highlights: [
    'Job Summary’s expanded row and the job window’s Costs tab draw the overhead landed on the job as an amber band on top of the red cost line. The band’s top edge is true cost, labeled at the end beside cost to date.',
    'Overhead lands day by day; between two charges it folds into the next charge, and anything after the last charge adds one final point so the band keeps growing while the job stays open.',
    'Hover any point for overhead to date, split into by hours and carry, and true cost. The green cash line is unchanged.',
    'Only the roles that see overhead in the table see the band; under the A / B / C lens methods the chart stays as it was.',
  ],
}

export default note
