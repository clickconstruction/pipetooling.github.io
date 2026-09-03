import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2691',
  date: '2026-09-03',
  title: 'Crew time split now counts bid hours as part of the day',
  kind: 'fix',
  highlights: [
    'When someone clocks part of a day on a job and part on a bid, the job now gets only its share of the day. Before, the whole day landed on the job and the bid hours were counted again as overhead.',
    'This corrects labor and revenue shares on People → Review, team labor on Jobs → Job Summary, pay-report breakdown lines, and the unassigned-time queues for those days. Pay amounts do not change.',
    'Days with only job time, or only bid time, read exactly as before.',
  ],
}

export default note
