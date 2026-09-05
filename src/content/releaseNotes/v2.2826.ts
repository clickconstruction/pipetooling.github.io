import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2826',
  date: '2026-09-05',
  title: 'Job Summary — a Scatter view: the big jobs with thin margins',
  kind: 'feature',
  highlights: [
    'A sixth view on Jobs → Job Summary. Every job is a bubble: revenue across, true margin up, bubble size by field hours or days, color by service type, GC, or lead tech.',
    'Median lines cut the plot into quadrants; the "big and thin" list names the jobs above the median size and below the median margin, with the dollars each one left on the table. Target draws its line too.',
    'Click a bubble (or a row) to open that job on the Jobs view.',
  ],
}

export default note
